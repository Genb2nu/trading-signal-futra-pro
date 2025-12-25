/**
 * Live Trading Engine for Paper Trading
 * Orchestrates automated signal scanning, order placement, and position management
 */

import { getBinanceKlines } from './binanceClient.js';
import { analyzeSMC } from '../shared/smcDetectors.js';
import PositionManager from './positionManager.js';
import OrderSimulator from './orderSimulator.js';
import TradeLogger from './tradeLogger.js';
import PaperAccountManager from './paperAccountManager.js';
import wsManager from './binanceWebSocket.js';

class LiveTradingEngine {
  constructor() {
    this.isRunning = false;
    this.scanInterval = null;
    this.monitorInterval = null;
    this.priceCache = new Map(); // Cache current prices from WebSocket

    // Initialize managers
    this.positionManager = new PositionManager();
    this.orderSimulator = new OrderSimulator();
    this.tradeLogger = new TradeLogger();
    this.accountManager = new PaperAccountManager();

    console.log('[LiveTradingEngine] Initialized');
  }

  /**
   * Start automated paper trading
   * @param {Object} config - Configuration { symbols, timeframe, scanFrequency }
   */
  async start(config) {
    if (this.isRunning) {
      console.warn('[LiveTradingEngine] Already running');
      return;
    }

    this.isRunning = true;
    this.config = config;

    console.log(`[LiveTradingEngine] Starting paper trading...`);
    console.log(`  Symbols: ${config.symbols.length}`);
    console.log(`  Timeframe: ${config.timeframe}`);
    console.log(`  Scan Frequency: ${config.scanFrequency / 60000} minutes`);

    // Subscribe to WebSocket price feeds for all symbols
    this.subscribeToSymbols(config.symbols);

    // Run first scan immediately
    await this.scanForSignals(config.symbols, config.timeframe);

    // Start continuous scanning loop
    this.scanInterval = setInterval(async () => {
      await this.scanForSignals(config.symbols, config.timeframe);
    }, config.scanFrequency);

    // Start position monitoring loop (every 5 seconds)
    this.monitorInterval = setInterval(() => {
      this.monitorPositions();
    }, 5000);

    console.log('[LiveTradingEngine] Paper trading started');
    this.emitEvent('started', { config });
  }

  /**
   * Stop automated paper trading
   */
  stop() {
    if (!this.isRunning) {
      console.warn('[LiveTradingEngine] Not running');
      return;
    }

    this.isRunning = false;

    // Clear intervals
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    // Unsubscribe from WebSocket feeds
    this.unsubscribeFromSymbols();

    console.log('[LiveTradingEngine] Paper trading stopped');
    this.emitEvent('stopped', {});
  }

  /**
   * Main signal scanning function
   * @param {Array} symbols - Array of symbol strings
   * @param {string} timeframe - Timeframe (e.g., '1h')
   */
  async scanForSignals(symbols, timeframe) {
    if (!this.isRunning) return;

    console.log(`[LiveTradingEngine] Scanning ${symbols.length} symbols on ${timeframe}...`);

    // Check position limits
    const openPositions = this.positionManager.getOpenPositions();
    const config = this.accountManager.getConfig();

    if (openPositions.length >= config.maxConcurrentTrades) {
      console.log(`[LiveTradingEngine] Max concurrent trades reached (${config.maxConcurrentTrades})`);
      return;
    }

    let signalsFound = 0;

    // Scan each symbol
    for (const symbol of symbols) {
      // Skip if already have position in this symbol
      if (this.positionManager.hasPosition(symbol)) {
        continue;
      }

      try {
        // Get candles and analyze for SMC signals
        const candles = await getBinanceKlines(symbol, timeframe, 500);
        const htfTimeframe = this.getHTFTimeframe(timeframe);
        const htfCandles = await getBinanceKlines(symbol, htfTimeframe, 125);

        const analysis = analyzeSMC(candles, htfCandles);

        // If signal detected, attempt to open position
        if (analysis.signals && analysis.signals.length > 0) {
          for (const signal of analysis.signals) {
            await this.processSignal(signal, symbol, timeframe, candles);
            signalsFound++;
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[LiveTradingEngine] Error scanning ${symbol}:`, error.message);
      }
    }

    console.log(`[LiveTradingEngine] Scan complete. Found ${signalsFound} signals.`);
  }

  /**
   * Process a new signal and create position
   * @param {Object} signal - Trading signal
   * @param {string} symbol - Symbol string
   * @param {string} timeframe - Timeframe
   * @param {Array} candles - Candle data for reference
   */
  async processSignal(signal, symbol, timeframe, candles) {
    const account = this.accountManager.getAccount();
    const config = this.accountManager.getConfig();

    // Calculate position size based on risk
    const positionSize = this.calculatePositionSize(signal, account);

    if (positionSize === 0) {
      console.log(`[LiveTradingEngine] Skipping ${symbol} - insufficient balance or risk`);
      return;
    }

    const entryPrice = parseFloat(signal.entry);
    const positionValue = positionSize * entryPrice;

    // Check if can open position
    const openPositions = this.positionManager.getOpenPositions();
    const canOpen = this.accountManager.canOpenPosition(positionValue, openPositions.length);

    if (!canOpen.canOpen) {
      console.log(`[LiveTradingEngine] Cannot open position: ${canOpen.reason}`);
      return;
    }

    // Create limit order (pending position)
    const position = {
      id: `${symbol}_${Date.now()}`,
      symbol,
      direction: signal.type,
      status: 'PENDING',
      signal,
      entryPrice,
      stopLoss: parseFloat(signal.stopLoss),
      takeProfit: parseFloat(signal.takeProfit),
      positionSize,
      positionValue,
      riskAmount: account.balance * (config.riskPerTrade / 100),
      riskRewardRatio: signal.riskReward || 0,
      orderPlacedAt: new Date().toISOString(),
      timeframe,
      patterns: signal.patterns || [],
      confluence: signal.confluenceScore || signal.confluence || 0,
      currentPrice: entryPrice,
      floatingPnL: 0,
      floatingPnLPercent: 0,
      maxAdverseExcursion: 0,
      maxFavorableExcursion: 0,
      priceHistory: [],
      barsInTrade: 0
    };

    // Add to position manager
    this.positionManager.addPosition(position);

    console.log(`[LiveTradingEngine] LIMIT ORDER placed: ${signal.type} ${symbol} @ ${entryPrice}`);
    console.log(`  Position size: ${positionSize.toFixed(8)} (${positionValue.toFixed(2)} USDT)`);
    console.log(`  Risk amount: ${position.riskAmount.toFixed(2)} USDT (${config.riskPerTrade}%)`);
    console.log(`  SL: ${position.stopLoss} | TP: ${position.takeProfit} | R:R: ${position.riskRewardRatio}`);

    this.emitEvent('orderPlaced', position);
  }

  /**
   * Monitor all positions for fills and exits
   */
  monitorPositions() {
    if (!this.isRunning) return;

    const positions = this.positionManager.getAllPositions();

    for (const position of positions) {
      const currentPrice = this.getCurrentPrice(position.symbol);

      if (!currentPrice) {
        // console.warn(`[LiveTradingEngine] No price data for ${position.symbol}`);
        continue;
      }

      // Update price history
      position.priceHistory.push({
        price: currentPrice,
        timestamp: new Date().toISOString()
      });

      // Keep last 100 prices
      if (position.priceHistory.length > 100) {
        position.priceHistory = position.priceHistory.slice(-100);
      }

      if (position.status === 'PENDING') {
        // Check if limit order should fill
        const filled = this.orderSimulator.checkLimitOrderFill(position, currentPrice);

        if (filled) {
          this.fillPosition(position, currentPrice);
        } else {
          // Check if order should timeout/cancel
          const shouldCancel = this.orderSimulator.checkOrderTimeout(position, currentPrice);

          if (shouldCancel) {
            const reason = this.orderSimulator.getTimeoutReason(position, currentPrice);
            this.cancelOrder(position, reason);
          }
        }
      } else if (position.status === 'OPEN') {
        // Check exit conditions
        const exitCheck = this.checkExitConditions(position, currentPrice);

        if (exitCheck.shouldExit) {
          this.closePosition(position, currentPrice, exitCheck.reason);
        } else {
          // Update floating P&L and MAE/MFE
          this.updatePositionMetrics(position, currentPrice);
        }
      }
    }

    // Update account equity
    const floatingPnL = this.positionManager.getFloatingPnL();
    this.accountManager.updateEquity(floatingPnL);
  }

  /**
   * Fill a pending limit order
   * @param {Object} position - Position object
   * @param {number} fillPrice - Fill price
   */
  fillPosition(position, fillPrice) {
    position.status = 'OPEN';
    position.entryPrice = fillPrice; // May have slippage if enabled
    position.entryTime = new Date().toISOString();
    position.currentPrice = fillPrice;

    this.positionManager.updatePosition(position);

    console.log(`[LiveTradingEngine] ORDER FILLED: ${position.direction} ${position.symbol} @ ${fillPrice}`);

    this.emitEvent('positionOpened', position);
  }

  /**
   * Cancel a pending order
   * @param {Object} position - Position object
   * @param {string} reason - Cancellation reason
   */
  cancelOrder(position, reason) {
    console.log(`[LiveTradingEngine] ORDER CANCELLED: ${position.symbol} - ${reason}`);

    this.positionManager.closePosition(position.id);
    this.emitEvent('orderCancelled', { position, reason });
  }

  /**
   * Check if position should be closed
   * @param {Object} position - Position object
   * @param {number} currentPrice - Current price
   * @returns {Object} { shouldExit: boolean, reason: string }
   */
  checkExitConditions(position, currentPrice) {
    const isBuy = position.direction === 'BUY';

    // 1. Take Profit Hit
    if (isBuy && currentPrice >= position.takeProfit) {
      return { shouldExit: true, reason: 'TP_HIT' };
    }
    if (!isBuy && currentPrice <= position.takeProfit) {
      return { shouldExit: true, reason: 'TP_HIT' };
    }

    // 2. Stop Loss Hit
    if (isBuy && currentPrice <= position.stopLoss) {
      return { shouldExit: true, reason: 'SL_HIT' };
    }
    if (!isBuy && currentPrice >= position.stopLoss) {
      return { shouldExit: true, reason: 'SL_HIT' };
    }

    // 3. Pattern Invalidation (Order Block break)
    if (this.isPatternInvalidated(position, currentPrice)) {
      return { shouldExit: true, reason: 'INVALIDATED' };
    }

    // 4. Time-based exit (close after 48 hours)
    if (position.entryTime) {
      const hoursInTrade = (Date.now() - new Date(position.entryTime).getTime()) / (1000 * 60 * 60);
      if (hoursInTrade > 48) {
        return { shouldExit: true, reason: 'TIMEOUT' };
      }
    }

    return { shouldExit: false };
  }

  /**
   * Check if pattern is invalidated (Order Block break)
   * @param {Object} position - Position object
   * @param {number} currentPrice - Current price
   * @returns {boolean} True if invalidated
   */
  isPatternInvalidated(position, currentPrice) {
    // Reuse logic from backtestEngine.js
    const signal = position.signal;

    if (!signal || !signal.orderBlockDetails) {
      return false;
    }

    const isBuy = position.direction === 'BUY';
    const obDetails = signal.orderBlockDetails;

    // For BUY: invalidated if price breaks below OB bottom * 0.98
    if (isBuy && obDetails.bottom) {
      if (currentPrice < obDetails.bottom * 0.98) {
        return true;
      }
    }

    // For SELL: invalidated if price breaks above OB top * 1.02
    if (!isBuy && obDetails.top) {
      if (currentPrice > obDetails.top * 1.02) {
        return true;
      }
    }

    return false;
  }

  /**
   * Close a position
   * @param {Object} position - Position object
   * @param {number} exitPrice - Exit price
   * @param {string} reason - Exit reason
   */
  closePosition(position, exitPrice, reason) {
    position.status = 'CLOSED';
    position.exitPrice = exitPrice;
    position.exitTime = new Date().toISOString();
    position.exitReason = reason;

    // Calculate realized P&L
    const isBuy = position.direction === 'BUY';
    const pnlPercent = isBuy
      ? ((exitPrice - position.entryPrice) / position.entryPrice) * 100
      : ((position.entryPrice - exitPrice) / position.entryPrice) * 100;

    const pnlUSDT = (pnlPercent / 100) * position.positionValue;

    position.realizedPnL = pnlUSDT;
    position.realizedPnLPercent = pnlPercent;

    // Calculate R-multiple
    const riskPercent = Math.abs(((position.stopLoss - position.entryPrice) / position.entryPrice) * 100);
    position.rMultiple = pnlPercent / riskPercent;

    // Calculate duration
    const duration = Date.now() - new Date(position.entryTime).getTime();
    position.duration = Math.round(duration / (1000 * 60)); // Minutes

    // Update account balance
    this.accountManager.recordTrade(pnlUSDT);

    // Log trade
    this.tradeLogger.logTrade(position);

    // Remove from active positions
    this.positionManager.closePosition(position.id);

    console.log(`[LiveTradingEngine] CLOSED: ${position.symbol} ${reason} @ ${exitPrice}`);
    console.log(`  P&L: ${pnlUSDT >= 0 ? '+' : ''}${pnlUSDT.toFixed(2)} USDT (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%, ${position.rMultiple.toFixed(2)}R)`);

    this.emitEvent('positionClosed', position);
  }

  /**
   * Update position metrics (MAE, MFE, floating P&L)
   * @param {Object} position - Position object
   * @param {number} currentPrice - Current price
   */
  updatePositionMetrics(position, currentPrice) {
    const isBuy = position.direction === 'BUY';

    // Calculate current P&L
    const pnlPercent = isBuy
      ? ((currentPrice - position.entryPrice) / position.entryPrice) * 100
      : ((position.entryPrice - currentPrice) / position.entryPrice) * 100;

    const pnlUSDT = (pnlPercent / 100) * position.positionValue;

    position.currentPrice = currentPrice;
    position.floatingPnL = pnlUSDT;
    position.floatingPnLPercent = pnlPercent;

    // Update MAE (Maximum Adverse Excursion)
    if (!position.maxAdverseExcursion || pnlPercent < position.maxAdverseExcursion) {
      position.maxAdverseExcursion = pnlPercent;
    }

    // Update MFE (Maximum Favorable Excursion)
    if (!position.maxFavorableExcursion || pnlPercent > position.maxFavorableExcursion) {
      position.maxFavorableExcursion = pnlPercent;
    }

    this.positionManager.updatePosition(position);
  }

  /**
   * Calculate position size based on risk
   * @param {Object} signal - Trading signal
   * @param {Object} account - Account object
   * @returns {number} Position size in base currency
   */
  calculatePositionSize(signal, account) {
    const entryPrice = parseFloat(signal.entry);
    const stopLoss = parseFloat(signal.stopLoss);
    const config = this.accountManager.getConfig();
    const riskPerTrade = config.riskPerTrade / 100; // Convert to decimal

    // Risk amount in USDT
    const riskAmount = account.balance * riskPerTrade;

    // Stop loss distance in price
    const stopDistance = Math.abs(entryPrice - stopLoss);

    // Position size = riskAmount / stopDistance
    let positionSize = riskAmount / stopDistance;

    // Validate position value doesn't exceed 50% of balance
    const positionValue = positionSize * entryPrice;

    if (positionValue > account.balance * 0.5) {
      console.warn(`[LiveTradingEngine] Position size too large (${positionValue.toFixed(2)} > ${(account.balance * 0.5).toFixed(2)}), reducing`);
      positionSize = (account.balance * 0.5) / entryPrice;
    }

    return positionSize;
  }

  /**
   * Get higher timeframe for HTF analysis
   * @param {string} timeframe - Current timeframe
   * @returns {string} Higher timeframe
   */
  getHTFTimeframe(timeframe) {
    const htfMap = {
      '1m': '5m',
      '5m': '15m',
      '15m': '1h',
      '1h': '4h',
      '4h': '1d',
      '1d': '1w',
      '1w': '1M'
    };

    return htfMap[timeframe] || '1d';
  }

  /**
   * Subscribe to WebSocket price feeds
   * @param {Array} symbols - Array of symbols
   */
  subscribeToSymbols(symbols) {
    console.log(`[LiveTradingEngine] Subscribing to ${symbols.length} symbols...`);

    symbols.forEach(symbol => {
      wsManager.subscribe(symbol, (data) => {
        this.priceCache.set(symbol, parseFloat(data.price));
      });
    });
  }

  /**
   * Unsubscribe from WebSocket feeds
   */
  unsubscribeFromSymbols() {
    if (this.config && this.config.symbols) {
      console.log('[LiveTradingEngine] Unsubscribing from price feeds...');
      this.config.symbols.forEach(symbol => {
        wsManager.unsubscribe(symbol);
      });
    }

    this.priceCache.clear();
  }

  /**
   * Get current price from cache
   * @param {string} symbol - Symbol
   * @returns {number|null} Current price or null
   */
  getCurrentPrice(symbol) {
    return this.priceCache.get(symbol) || null;
  }

  /**
   * Emit event for UI updates
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   */
  emitEvent(eventName, data) {
    window.dispatchEvent(new CustomEvent(`paperTrading:${eventName}`, { detail: data }));
  }

  /**
   * Get engine status
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      positions: this.positionManager.getSummary(),
      account: this.accountManager.getSummary(),
      stats: this.tradeLogger.calculateStats()
    };
  }
}

export default LiveTradingEngine;
