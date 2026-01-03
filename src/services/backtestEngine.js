/**
 * Backtesting Engine for SMC Strategy
 * Simulates trades on historical data and tracks outcomes
 */

import { getBinanceKlines, getBinanceKlinesExtended } from '../server/binanceService.js';
import { analyzeSMC } from '../shared/smcDetectors.js';
import { getHTFTimeframe } from '../shared/strategyConfig.js';

/**
 * Simulates a single trade on historical data with scalping features
 * @param {Object} signal - The trading signal
 * @param {Array} futureCandles - Candles after signal generation
 * @param {string} timeframe - Timeframe (for timeout calculation)
 * @returns {Object} Trade outcome
 */
export function simulateTrade(signal, futureCandles, timeframe = '1h') {
  const entry = parseFloat(signal.entry);
  const initialStopLoss = parseFloat(signal.stopLoss);
  const takeProfit = parseFloat(signal.takeProfit);
  const isBuy = signal.type === 'BUY';

  const riskDistance = Math.abs(entry - initialStopLoss);
  const scalpingConfig = signal.scalpingConfig || null;
  const isScalping = scalpingConfig !== null;

  // Scalping state tracking
  let currentStopLoss = initialStopLoss;
  let peakPnlR = 0;
  let positionSize = 100; // percentage (100% = full position)
  let breakEvenActivated = false;
  let trailingActivated = false;
  let partialCloseExecuted = false;

  // Calculate timeout threshold
  let timeoutBars = Infinity;
  if (isScalping && scalpingConfig.timeoutMinutes) {
    const tfMinutes = timeframe === '1m' ? 1 : timeframe === '5m' ? 5 : 60;
    timeoutBars = Math.floor(scalpingConfig.timeoutMinutes / tfMinutes);
  }

  let outcome = {
    signal,
    entry,
    stopLoss: initialStopLoss,
    takeProfit,
    type: signal.type,
    direction: signal.type, // BUY or SELL for trend analysis
    htfTrend: signal.htfTrend || 'unknown', // HTF trend at signal time
    mtfConsensus: signal.mtfConsensus || 'unknown', // Multi-timeframe consensus (1h+4h for 15m)
    result: 'PENDING',
    exitPrice: null,
    exitTime: null,
    pnlPercent: 0,
    pnlR: 0,
    barsInTrade: 0,
    maxAdverseExcursion: 0, // MAE - worst drawdown
    maxFavorableExcursion: 0, // MFE - best profit
    invalidated: false,
    invalidationReason: null,
    // Scalping-specific tracking
    breakEvenActivated: false,
    trailingActivated: false,
    partialCloseExecuted: false,
    timedOut: false
  };

  // Track price action
  for (let i = 0; i < futureCandles.length; i++) {
    const candle = futureCandles[i];
    outcome.barsInTrade = i + 1;

    // Calculate current P&L in R-multiples
    let currentPnlR;
    if (isBuy) {
      currentPnlR = (candle.close - entry) / riskDistance;
      const adverseMove = (entry - candle.low) / riskDistance;
      const favorableMove = (candle.high - entry) / riskDistance;
      if (-adverseMove < outcome.maxAdverseExcursion) outcome.maxAdverseExcursion = -adverseMove;
      if (favorableMove > outcome.maxFavorableExcursion) outcome.maxFavorableExcursion = favorableMove;
    } else {
      currentPnlR = (entry - candle.close) / riskDistance;
      const adverseMove = (candle.high - entry) / riskDistance;
      const favorableMove = (entry - candle.low) / riskDistance;
      if (-adverseMove < outcome.maxAdverseExcursion) outcome.maxAdverseExcursion = -adverseMove;
      if (favorableMove > outcome.maxFavorableExcursion) outcome.maxFavorableExcursion = favorableMove;
    }

    // Update peak P&L
    if (currentPnlR > peakPnlR) peakPnlR = currentPnlR;

    // ===== SCALPING FEATURE 1: Move to breakeven at +0.5R =====
    if (isScalping && !breakEvenActivated && scalpingConfig.breakEvenR &&
        currentPnlR >= scalpingConfig.breakEvenR) {
      currentStopLoss = entry;
      breakEvenActivated = true;
      outcome.breakEvenActivated = true;
    }

    // ===== SCALPING FEATURE 2: Trailing stop at +1R =====
    if (isScalping && scalpingConfig.trailingStopEnabled &&
        scalpingConfig.trailingStartR && scalpingConfig.trailingDistanceR &&
        peakPnlR >= scalpingConfig.trailingStartR) {

      const trailStopR = peakPnlR - scalpingConfig.trailingDistanceR;
      const newStopLoss = entry + (trailStopR * riskDistance * (isBuy ? 1 : -1));

      if (isBuy) {
        currentStopLoss = Math.max(currentStopLoss, newStopLoss);
      } else {
        currentStopLoss = Math.min(currentStopLoss, newStopLoss);
      }

      if (!trailingActivated) {
        trailingActivated = true;
        outcome.trailingActivated = true;
      }
    }

    // ===== SCALPING FEATURE 3: Partial close at +1R =====
    if (isScalping && !partialCloseExecuted && scalpingConfig.partialCloseEnabled &&
        scalpingConfig.partialCloseR && scalpingConfig.partialClosePercent &&
        currentPnlR >= scalpingConfig.partialCloseR) {

      partialCloseExecuted = true;
      positionSize = 100 - scalpingConfig.partialClosePercent; // Keep remaining %
      outcome.partialCloseExecuted = true;
    }

    // ===== SCALPING FEATURE 4: Timeout exit =====
    if (isScalping && i >= timeoutBars && scalpingConfig.timeoutThresholdR &&
        currentPnlR < scalpingConfig.timeoutThresholdR) {

      outcome.result = 'TIMEOUT';
      outcome.exitPrice = candle.close;
      outcome.exitTime = candle.timestamp;
      outcome.barsInTrade = i + 1;
      outcome.timedOut = true;

      const pnlPercent = currentPnlR * (riskDistance / entry) * 100;
      outcome.pnlPercent = pnlPercent;
      outcome.pnlR = currentPnlR * (positionSize / 100);
      return outcome;
    }

    // ===== GENERAL TRADE MANAGEMENT (ALL MODES) =====
    // OPTIMIZED: Using SNIPER-style management (proven 2.85 PF)

    // Move to breakeven at +0.8R (earlier protection)
    if (!isScalping && !breakEvenActivated && currentPnlR >= 0.8) {
      currentStopLoss = entry;
      breakEvenActivated = true;
      outcome.breakEvenActivated = true;
    }

    // Partial profit at +1.5R: Close 50% of position (was 1.0R - let winners run!)
    if (!isScalping && !partialCloseExecuted && currentPnlR >= 1.5) {
      partialCloseExecuted = true;
      positionSize = 50; // Keep 50% of position
      outcome.partialCloseExecuted = true;
    }

    // Trailing stop after +1.5R: Trail at 0.7R distance from peak (was 1.0R/0.5R - more room!)
    if (!isScalping && peakPnlR >= 1.5) {
      const trailingDistance = 0.7; // Trail 0.7R behind peak (wider for breathing room)
      const trailStopR = peakPnlR - trailingDistance;
      const newStopLoss = entry + (trailStopR * riskDistance * (isBuy ? 1 : -1));

      if (isBuy) {
        // Only move stop up, never down
        if (newStopLoss > currentStopLoss) {
          currentStopLoss = newStopLoss;
          if (!trailingActivated) {
            trailingActivated = true;
            outcome.trailingActivated = true;
          }
        }
      } else {
        // Only move stop down, never up
        if (newStopLoss < currentStopLoss) {
          currentStopLoss = newStopLoss;
          if (!trailingActivated) {
            trailingActivated = true;
            outcome.trailingActivated = true;
          }
        }
      }
    }

    // ===== Check Stop Loss =====
    const slHit = isBuy ? candle.low <= currentStopLoss : candle.high >= currentStopLoss;
    if (slHit) {
      const slPnlR = (currentStopLoss - entry) / riskDistance * (isBuy ? 1 : -1);

      // Binary outcome: WIN or LOSS (no breakeven)
      // If stopped out at entry or better = WIN (protected capital)
      // If stopped out below entry = LOSS
      if (slPnlR >= -0.05) {
        // Stopped at or near breakeven = count as WIN (0R or small profit)
        outcome.result = slPnlR > 0.1 ? 'TRAILING_STOP_WIN' : 'BREAKEVEN_WIN';
        outcome.pnlR = Math.max(0, slPnlR) * (positionSize / 100); // Minimum 0R
      } else {
        // Stopped below entry = LOSS
        outcome.result = 'STOP_LOSS';
        outcome.pnlR = slPnlR * (positionSize / 100);
      }

      outcome.exitPrice = currentStopLoss;
      outcome.exitTime = candle.timestamp;

      const pnlPercent = outcome.pnlR * (riskDistance / entry) * 100;
      outcome.pnlPercent = pnlPercent;
      return outcome;
    }

    // ===== Check Take Profit (PHASE 17: Multiple TP Levels) =====
    if (signal.takeProfitLevels) {
      // PHASE 17: Check multiple TP levels for partial closures
      const tpLevels = signal.takeProfitLevels;
      let tp1Hit = false, tp2Hit = false, tp3Hit = false;
      let totalR = 0;
      let remainingPosition = 100;

      // Check TP1 (50% at 1:1 R:R)
      if (isBuy ? candle.high >= tpLevels.tp1 : candle.low <= tpLevels.tp1) {
        tp1Hit = true;
        totalR += tpLevels.riskRewards.tp1 * tpLevels.allocations.tp1; // 1.0 * 0.50 = 0.50R
        remainingPosition -= tpLevels.allocations.tp1 * 100; // 50% closed
      }

      // Check TP2 (30% at main target)
      if (isBuy ? candle.high >= tpLevels.tp2 : candle.low <= tpLevels.tp2) {
        tp2Hit = true;
        totalR += tpLevels.riskRewards.tp2 * tpLevels.allocations.tp2;
        remainingPosition -= tpLevels.allocations.tp2 * 100; // 30% closed
      }

      // Check TP3 (20% at 1:3 R:R)
      if (isBuy ? candle.high >= tpLevels.tp3 : candle.low <= tpLevels.tp3) {
        tp3Hit = true;
        totalR += tpLevels.riskRewards.tp3 * tpLevels.allocations.tp3; // 3.0 * 0.20 = 0.60R
        remainingPosition -= tpLevels.allocations.tp3 * 100; // 20% closed
      }

      // If all TPs hit, close full position
      if (tp3Hit) {
        outcome.result = 'TAKE_PROFIT_FULL';
        outcome.exitPrice = tpLevels.tp3;
        outcome.exitTime = candle.timestamp;
        outcome.pnlR = totalR; // Total weighted R
        outcome.pnlPercent = totalR * (riskDistance / entry) * 100;
        outcome.tpLevelsHit = { tp1: true, tp2: true, tp3: true };
        return outcome;
      }
      // If TP2 hit (but not TP3), partial win
      else if (tp2Hit) {
        outcome.result = 'TAKE_PROFIT_PARTIAL';
        outcome.exitPrice = tpLevels.tp2;
        outcome.exitTime = candle.timestamp;
        outcome.pnlR = totalR; // Partial R (TP1 + TP2)
        outcome.pnlPercent = totalR * (riskDistance / entry) * 100;
        outcome.tpLevelsHit = { tp1: true, tp2: true, tp3: false };
        positionSize = remainingPosition; // Keep 20% position for TP3
        // Don't return - continue monitoring for TP3
      }
      // If only TP1 hit, continue monitoring
      else if (tp1Hit) {
        positionSize = remainingPosition; // Keep 50% position for TP2/TP3
        // Don't return - continue monitoring
      }
    } else {
      // Legacy single TP logic (fallback)
      const tpHit = isBuy ? candle.high >= takeProfit : candle.low <= takeProfit;
      if (tpHit) {
        outcome.result = 'TAKE_PROFIT';
        outcome.exitPrice = takeProfit;
        outcome.exitTime = candle.timestamp;

        const tpPnlR = (takeProfit - entry) / riskDistance * (isBuy ? 1 : -1);
        const pnlPercent = tpPnlR * (riskDistance / entry) * 100;
        outcome.pnlPercent = pnlPercent;
        outcome.pnlR = tpPnlR * (positionSize / 100);
        return outcome;
      }
    }

    // ===== Check pattern invalidation (OB break) =====
    if (signal.orderBlock) {
      const obInvalidated = isBuy ?
        candle.close < signal.orderBlock.bottom * 0.98 :
        candle.close > signal.orderBlock.top * 1.02;

      if (obInvalidated) {
        outcome.result = 'INVALIDATED';
        outcome.exitPrice = candle.close;
        outcome.exitTime = candle.timestamp;
        outcome.invalidated = true;
        outcome.invalidationReason = isBuy ?
          'Price broke below order block' :
          'Price broke above order block';

        const pnlPercent = currentPnlR * (riskDistance / entry) * 100;
        outcome.pnlPercent = pnlPercent;
        outcome.pnlR = currentPnlR * (positionSize / 100);
        return outcome;
      }
    }
  }

  // If still pending after all candles
  if (outcome.result === 'PENDING') {
    const lastCandle = futureCandles[futureCandles.length - 1];
    const finalPnlR = isBuy ?
      (lastCandle.close - entry) / riskDistance :
      (entry - lastCandle.close) / riskDistance;
    const pnlPercent = finalPnlR * (riskDistance / entry) * 100;

    outcome.result = 'EXPIRED';
    outcome.exitPrice = lastCandle.close;
    outcome.exitTime = lastCandle.timestamp;
    outcome.pnlPercent = pnlPercent;
    outcome.pnlR = finalPnlR * (positionSize / 100);
  }

  return outcome;
}

/**
 * Backtests the strategy on historical data
 * @param {string} symbol - Trading pair
 * @param {string} timeframe - Timeframe
 * @param {number} candleCount - Number of historical candles to analyze
 * @param {number} lookforward - Candles to look forward for trade outcome
 * @returns {Promise<Object>} Backtest results
 */
export async function backtestSymbol(symbol, timeframe, candleCount = 1000, lookforward = 100) {
  try {
    // Fetch historical data for both timeframes
    // Use extended version if requesting more than 1000 candles
    const candles = candleCount > 1000
      ? await getBinanceKlinesExtended(symbol, timeframe, candleCount)
      : await getBinanceKlines(symbol, timeframe, candleCount);

    // Fetch higher timeframe data for multi-timeframe confirmation (dynamic HTF selection)
    const htfTimeframe = getHTFTimeframe(timeframe);
    const htfCandleCount = Math.ceil(candleCount / 4); // Approximate ratio
    const htfCandles = htfCandleCount > 1000
      ? await getBinanceKlinesExtended(symbol, htfTimeframe, htfCandleCount + 50)
      : await getBinanceKlines(symbol, htfTimeframe, htfCandleCount + 50); // +50 for EMA calculation

    // For 15m: Also fetch 4h candles for multi-timeframe consensus (user's methodology)
    let htf2Candles = null;
    if (timeframe === '15m') {
      const htf2Count = Math.max(300, Math.ceil(candleCount / 4));
      htf2Candles = htf2Count > 1000
        ? await getBinanceKlinesExtended(symbol, '4h', htf2Count)
        : await getBinanceKlines(symbol, '4h', htf2Count);
    }

    if (!candles || candles.length < candleCount) {
      throw new Error(`Insufficient data for ${symbol}`);
    }

    const trades = [];
    const windowSize = 500; // Candles to analyze for each signal

    // Sliding window approach - analyze data in chunks
    for (let i = windowSize; i < candles.length - lookforward; i += 10) { // Step by 10 candles
      const windowCandles = candles.slice(i - windowSize, i);

      // Get corresponding HTF window (approximate based on timestamps)
      // For 1h -> 4h: we need about 125 4h candles for 500 1h candles
      const currentTime = candles[i - 1].timestamp;
      const htfWindowCandles = htfCandles ? htfCandles.filter(c => c.timestamp <= currentTime).slice(-125) : null;

      // For 15m: Get corresponding 4h window for multi-timeframe consensus
      const htf2WindowCandles = htf2Candles ? htf2Candles.filter(c => c.timestamp <= currentTime).slice(-100) : null;

      // Generate signals on this window with multi-timeframe confirmation
      // Pass timeframe parameter for scalping mode (PHASE 16: Pass symbol for correlation)
      const analysis = analyzeSMC(windowCandles, htfWindowCandles, timeframe, htf2WindowCandles, symbol);

      if (analysis.signals && analysis.signals.length > 0) {
        // For each signal, simulate the trade
        for (const signal of analysis.signals) {
          // Find the candle index that matches the signal's timestamp
          const signalCandleIndex = candles.findIndex(c => c.timestamp === signal.timestamp);

          if (signalCandleIndex === -1) {
            console.warn(`Could not find candle for signal timestamp: ${signal.timestamp}`);
            continue;
          }

          // Get future candles AFTER the signal's actual timestamp
          const futureCandles = candles.slice(signalCandleIndex + 1, signalCandleIndex + 1 + lookforward);

          if (futureCandles.length === 0) {
            // Not enough future data to simulate this trade
            continue;
          }

          // Simulate trade with timeframe parameter for scalping features
          const outcome = simulateTrade(signal, futureCandles, timeframe);

          trades.push({
            ...outcome,
            signalTime: signal.timestamp, // Use signal's actual timestamp
            signalIndex: signalCandleIndex
          });
        }
      }
    }

    return {
      symbol,
      timeframe,
      candleCount,
      lookforward,
      trades,
      metrics: calculateMetrics(trades)
    };

  } catch (error) {
    console.error(`Backtest error for ${symbol}:`, error.message);
    return {
      symbol,
      error: error.message,
      trades: [],
      metrics: null
    };
  }
}

/**
 * Calculates performance metrics from trades
 * @param {Array} trades - Array of trade outcomes
 * @returns {Object} Performance metrics
 */
export function calculateMetrics(trades) {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgWinR: 0,
      avgLossR: 0,
      avgR: 0,
      profitFactor: 0,
      expectancy: 0,
      maxDrawdown: 0,
      maxRunup: 0
    };
  }

  // Binary classification: WIN (pnlR >= 0) or LOSS (pnlR < 0)
  const wins = trades.filter(t => t.pnlR >= 0 ||
    t.result === 'TAKE_PROFIT' ||
    t.result === 'TAKE_PROFIT_FULL' ||
    t.result === 'TAKE_PROFIT_PARTIAL' ||
    t.result === 'TRAILING_STOP_WIN' ||
    t.result === 'BREAKEVEN_WIN' ||
    t.result === 'EXPIRED');
  const losses = trades.filter(t => t.pnlR < 0 && t.result === 'STOP_LOSS');

  const totalWinR = wins.reduce((sum, t) => sum + t.pnlR, 0);
  const totalLossR = Math.abs(losses.reduce((sum, t) => sum + t.pnlR, 0));

  const avgWinR = wins.length > 0 ? totalWinR / wins.length : 0;
  const avgLossR = losses.length > 0 ? totalLossR / losses.length : 0;

  const winRate = (wins.length / trades.length) * 100;
  const avgR = trades.reduce((sum, t) => sum + t.pnlR, 0) / trades.length;

  const profitFactor = totalLossR !== 0 ? totalWinR / totalLossR : totalWinR > 0 ? Infinity : 0;

  // Expectancy = (Win% × AvgWin) - (Loss% × AvgLoss)
  const expectancy = (winRate / 100 * avgWinR) - ((100 - winRate) / 100 * avgLossR);

  // Calculate drawdown and runup
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let maxRunup = 0;

  trades.forEach(trade => {
    equity += trade.pnlR;
    if (equity > peak) {
      peak = equity;
      maxRunup = Math.max(maxRunup, equity);
    }
    const drawdown = peak - equity;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  });

  // Outcome distribution
  const outcomes = {
    takeProfit: trades.filter(t => t.result === 'TAKE_PROFIT').length,
    stopLoss: trades.filter(t => t.result === 'STOP_LOSS').length,
    invalidated: trades.filter(t => t.result === 'INVALIDATED').length,
    expired: trades.filter(t => t.result === 'EXPIRED').length,
    timeout: trades.filter(t => t.result === 'TIMEOUT').length
  };

  // Average metrics
  const avgBarsInTrade = trades.reduce((sum, t) => sum + t.barsInTrade, 0) / trades.length;
  const avgMAE = trades.reduce((sum, t) => sum + Math.abs(t.maxAdverseExcursion), 0) / trades.length;
  const avgMFE = trades.reduce((sum, t) => sum + t.maxFavorableExcursion, 0) / trades.length;

  // Scalping-specific metrics
  const breakEvenActivations = trades.filter(t => t.breakEvenActivated).length;
  const trailingActivations = trades.filter(t => t.trailingActivated).length;
  const partialCloses = trades.filter(t => t.partialCloseExecuted).length;
  const timeouts = trades.filter(t => t.timedOut).length;

  const totalTrades = trades.length;
  const breakEvenRate = totalTrades > 0 ? ((breakEvenActivations / totalTrades) * 100).toFixed(1) : '0.0';
  const trailingRate = totalTrades > 0 ? ((trailingActivations / totalTrades) * 100).toFixed(1) : '0.0';
  const partialCloseRate = totalTrades > 0 ? ((partialCloses / totalTrades) * 100).toFixed(1) : '0.0';
  const timeoutRate = totalTrades > 0 ? ((timeouts / totalTrades) * 100).toFixed(1) : '0.0';

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: winRate.toFixed(1),
    avgWinR: avgWinR.toFixed(2),
    avgLossR: avgLossR.toFixed(2),
    avgR: avgR.toFixed(2),
    profitFactor: profitFactor.toFixed(2),
    expectancy: expectancy.toFixed(2),
    maxDrawdown: maxDrawdown.toFixed(2),
    maxRunup: maxRunup.toFixed(2),
    outcomes,
    avgBarsInTrade: avgBarsInTrade.toFixed(1),
    avgMAE: avgMAE.toFixed(2),
    avgMFE: avgMFE.toFixed(2),

    // Scalping-specific metrics
    breakEvenActivations,
    trailingActivations,
    partialCloses,
    timeouts,
    breakEvenRate,
    trailingRate,
    partialCloseRate,
    timeoutRate
  };
}

/**
 * Runs backtest across multiple symbols
 * @param {Array} symbols - Array of trading pairs
 * @param {string} timeframe - Timeframe
 * @param {number} candleCount - Number of historical candles to analyze
 * @param {number} lookforward - Candles to look forward for trade outcome
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<Object>} Combined backtest results
 */
export async function backtestMultipleSymbols(symbols, timeframe, candleCount = 1000, lookforward = 100, progressCallback) {
  const results = [];

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];

    if (progressCallback) {
      progressCallback({
        current: i + 1,
        total: symbols.length,
        symbol,
        percentage: Math.round(((i + 1) / symbols.length) * 100)
      });
    }

    const result = await backtestSymbol(symbol, timeframe, candleCount, lookforward);
    results.push(result);
  }

  // Combine all trades
  const allTrades = results.flatMap(r => r.trades || []);

  // Calculate combined metrics
  const combinedMetrics = calculateMetrics(allTrades);

  // Symbol-level analysis
  const symbolMetrics = results.map(r => ({
    symbol: r.symbol,
    trades: r.trades?.length || 0,
    winRate: r.metrics?.winRate || 0,
    avgR: r.metrics?.avgR || 0,
    profitFactor: r.metrics?.profitFactor || 0
  })).filter(s => s.trades > 0);

  return {
    timeframe,
    symbolCount: symbols.length,
    results,
    allTrades,
    combinedMetrics,
    symbolMetrics
  };
}

/**
 * Analyzes common failure patterns
 * @param {Array} trades - Array of trade outcomes
 * @returns {Object} Failure pattern analysis
 */
export function analyzeFailures(trades) {
  const losses = trades.filter(t => t.result === 'STOP_LOSS' && t.pnlR < 0);

  if (losses.length === 0) {
    return { totalLosses: 0, patterns: [] };
  }

  const patterns = {
    // Stopped out quickly (within 5 bars)
    quickStopOut: losses.filter(t => t.barsInTrade <= 5).length,

    // Large MAE before stop (price went deep against us)
    largeMAE: losses.filter(t => Math.abs(t.maxAdverseExcursion) > 3).length,

    // Had good MFE but reversed (went in our favor first)
    reversalLoss: losses.filter(t => t.maxFavorableExcursion > 1 && t.result === 'STOP_LOSS').length,

    // Invalidated signals
    invalidated: losses.filter(t => t.invalidated).length,

    // Stop distance issues (MAE exceeded stop by large margin)
    stopTooTight: losses.filter(t =>
      Math.abs(t.maxAdverseExcursion) > Math.abs(((t.stopLoss - t.entry) / t.entry) * 100) * 1.5
    ).length
  };

  const recommendations = [];

  if (patterns.quickStopOut / losses.length > 0.5) {
    recommendations.push({
      issue: 'Quick Stop Outs',
      severity: 'HIGH',
      description: `${Math.round(patterns.quickStopOut / losses.length * 100)}% of losses happen within 5 bars`,
      suggestion: 'Entry timing may be too early. Wait for stronger confirmation or price to pull back into OB.'
    });
  }

  if (patterns.stopTooTight / losses.length > 0.4) {
    recommendations.push({
      issue: 'Stop Loss Too Tight',
      severity: 'HIGH',
      description: `${Math.round(patterns.stopTooTight / losses.length * 100)}% of losses exceeded stop by 50%+`,
      suggestion: 'Increase stop buffer from ATR×2.5 to ATR×3.0 or ATR×3.5'
    });
  }

  if (patterns.reversalLoss / losses.length > 0.3) {
    recommendations.push({
      issue: 'Reversal Losses',
      severity: 'MEDIUM',
      description: `${Math.round(patterns.reversalLoss / losses.length * 100)}% of losses went in our favor first`,
      suggestion: 'Consider partial profit taking when trade moves 1R in favor'
    });
  }

  if (patterns.invalidated / losses.length > 0.2) {
    recommendations.push({
      issue: 'Pattern Invalidation',
      severity: 'MEDIUM',
      description: `${Math.round(patterns.invalidated / losses.length * 100)}% of losses invalidated the pattern`,
      suggestion: 'Exit early when price breaks OB structure rather than waiting for full stop loss'
    });
  }

  return {
    totalLosses: losses.length,
    patterns,
    recommendations,
    avgLossMAE: losses.reduce((sum, t) => sum + Math.abs(t.maxAdverseExcursion), 0) / losses.length,
    avgLossMFE: losses.reduce((sum, t) => sum + t.maxFavorableExcursion, 0) / losses.length
  };
}
