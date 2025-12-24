/**
 * Backtesting Engine for SMC Strategy
 * Simulates trades on historical data and tracks outcomes
 */

import { getBinanceKlines } from './binanceClient.js';
import { analyzeSMC } from '../shared/smcDetectors.js';

/**
 * Simulates a single trade on historical data
 * @param {Object} signal - The trading signal
 * @param {Array} futureCandles - Candles after signal generation
 * @returns {Object} Trade outcome
 */
export function simulateTrade(signal, futureCandles) {
  const entry = parseFloat(signal.entry);
  const stopLoss = parseFloat(signal.stopLoss);
  const takeProfit = parseFloat(signal.takeProfit);
  const type = signal.type;

  let outcome = {
    signal,
    entry,
    stopLoss,
    takeProfit,
    type,
    result: 'PENDING',
    exitPrice: null,
    exitTime: null,
    pnlPercent: 0,
    pnlR: 0,
    barsInTrade: 0,
    maxAdverseExcursion: 0, // MAE - worst drawdown
    maxFavorableExcursion: 0, // MFE - best profit
    invalidated: false,
    invalidationReason: null
  };

  // Track price action
  for (let i = 0; i < futureCandles.length; i++) {
    const candle = futureCandles[i];
    outcome.barsInTrade = i + 1;

    if (type === 'BUY') {
      // Calculate MAE and MFE
      const mae = ((candle.low - entry) / entry) * 100;
      const mfe = ((candle.high - entry) / entry) * 100;

      if (mae < outcome.maxAdverseExcursion) outcome.maxAdverseExcursion = mae;
      if (mfe > outcome.maxFavorableExcursion) outcome.maxFavorableExcursion = mfe;

      // Check stop loss hit
      if (candle.low <= stopLoss) {
        outcome.result = 'STOP_LOSS';
        outcome.exitPrice = stopLoss;
        outcome.exitTime = candle.timestamp;
        outcome.pnlPercent = ((stopLoss - entry) / entry) * 100;
        outcome.pnlR = -1; // Always -1R on stop loss
        break;
      }

      // Check take profit hit
      if (candle.high >= takeProfit) {
        outcome.result = 'TAKE_PROFIT';
        outcome.exitPrice = takeProfit;
        outcome.exitTime = candle.timestamp;
        outcome.pnlPercent = ((takeProfit - entry) / entry) * 100;
        outcome.pnlR = outcome.pnlPercent / Math.abs(((stopLoss - entry) / entry) * 100);
        break;
      }

      // Check invalidation (price breaks below OB after entry)
      if (signal.orderBlock && candle.close < signal.orderBlock.bottom * 0.98) {
        outcome.result = 'INVALIDATED';
        outcome.invalidated = true;
        outcome.invalidationReason = 'Price broke below order block';
        outcome.exitPrice = candle.close;
        outcome.exitTime = candle.timestamp;
        outcome.pnlPercent = ((candle.close - entry) / entry) * 100;
        outcome.pnlR = outcome.pnlPercent / Math.abs(((stopLoss - entry) / entry) * 100);
        break;
      }

    } else { // SELL
      // Calculate MAE and MFE
      const mae = ((entry - candle.high) / entry) * 100;
      const mfe = ((entry - candle.low) / entry) * 100;

      if (mae < outcome.maxAdverseExcursion) outcome.maxAdverseExcursion = mae;
      if (mfe > outcome.maxFavorableExcursion) outcome.maxFavorableExcursion = mfe;

      // Check stop loss hit
      if (candle.high >= stopLoss) {
        outcome.result = 'STOP_LOSS';
        outcome.exitPrice = stopLoss;
        outcome.exitTime = candle.timestamp;
        outcome.pnlPercent = ((entry - stopLoss) / entry) * 100;
        outcome.pnlR = -1; // Always -1R on stop loss
        break;
      }

      // Check take profit hit
      if (candle.low <= takeProfit) {
        outcome.result = 'TAKE_PROFIT';
        outcome.exitPrice = takeProfit;
        outcome.exitTime = candle.timestamp;
        outcome.pnlPercent = ((entry - takeProfit) / entry) * 100;
        outcome.pnlR = outcome.pnlPercent / Math.abs(((entry - stopLoss) / entry) * 100);
        break;
      }

      // Check invalidation (price breaks above OB after entry)
      if (signal.orderBlock && candle.close > signal.orderBlock.top * 1.02) {
        outcome.result = 'INVALIDATED';
        outcome.invalidated = true;
        outcome.invalidationReason = 'Price broke above order block';
        outcome.exitPrice = candle.close;
        outcome.exitTime = candle.timestamp;
        outcome.pnlPercent = ((entry - candle.close) / entry) * 100;
        outcome.pnlR = outcome.pnlPercent / Math.abs(((entry - stopLoss) / entry) * 100);
        break;
      }
    }
  }

  // If still pending after all candles
  if (outcome.result === 'PENDING') {
    const lastCandle = futureCandles[futureCandles.length - 1];
    outcome.result = 'EXPIRED';
    outcome.exitPrice = lastCandle.close;
    outcome.exitTime = lastCandle.timestamp;
    outcome.pnlPercent = type === 'BUY'
      ? ((lastCandle.close - entry) / entry) * 100
      : ((entry - lastCandle.close) / entry) * 100;
    outcome.pnlR = outcome.pnlPercent / Math.abs(
      type === 'BUY'
        ? ((stopLoss - entry) / entry) * 100
        : ((entry - stopLoss) / entry) * 100
    );
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
    const candles = await getBinanceKlines(symbol, timeframe, candleCount);

    // Fetch higher timeframe data for multi-timeframe confirmation
    // For 1h trading, use 4h for higher timeframe
    const htfTimeframe = timeframe === '1h' ? '4h' : '1d';
    const htfCandleCount = Math.ceil(candleCount / 4); // 4h has 1/4 the candles of 1h
    const htfCandles = await getBinanceKlines(symbol, htfTimeframe, htfCandleCount + 50); // +50 for EMA calculation

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

      // Generate signals on this window with multi-timeframe confirmation
      const analysis = analyzeSMC(windowCandles, htfWindowCandles);

      if (analysis.signals && analysis.signals.length > 0) {
        // For each signal, simulate the trade
        for (const signal of analysis.signals) {
          // Get future candles for trade simulation
          const futureCandles = candles.slice(i, i + lookforward);

          // Simulate trade
          const outcome = simulateTrade(signal, futureCandles);

          trades.push({
            ...outcome,
            signalTime: candles[i - 1].timestamp,
            signalIndex: i
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

  const wins = trades.filter(t => t.result === 'TAKE_PROFIT' || t.pnlR > 0);
  const losses = trades.filter(t => t.result === 'STOP_LOSS' || (t.pnlR < 0 && t.result !== 'TAKE_PROFIT'));

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
    expired: trades.filter(t => t.result === 'EXPIRED').length
  };

  // Average metrics
  const avgBarsInTrade = trades.reduce((sum, t) => sum + t.barsInTrade, 0) / trades.length;
  const avgMAE = trades.reduce((sum, t) => sum + Math.abs(t.maxAdverseExcursion), 0) / trades.length;
  const avgMFE = trades.reduce((sum, t) => sum + t.maxFavorableExcursion, 0) / trades.length;

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: winRate,
    avgWinR: avgWinR,
    avgLossR: avgLossR,
    avgR: avgR,
    profitFactor: profitFactor,
    expectancy: expectancy,
    maxDrawdown: maxDrawdown,
    maxRunup: maxRunup,
    outcomes,
    avgBarsInTrade: avgBarsInTrade,
    avgMAE: avgMAE,
    avgMFE: avgMFE
  };
}

/**
 * Runs backtest across multiple symbols
 * @param {Array} symbols - Array of trading pairs
 * @param {string} timeframe - Timeframe
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<Object>} Combined backtest results
 */
export async function backtestMultipleSymbols(symbols, timeframe, progressCallback) {
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

    const result = await backtestSymbol(symbol, timeframe);
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
  const losses = trades.filter(t => t.result === 'STOP_LOSS' || t.pnlR < 0);

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
