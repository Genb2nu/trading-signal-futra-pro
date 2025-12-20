import { getBinanceKlines } from './binanceService.js';
import { analyzeSMC } from '../shared/smcDetectors.js';

/**
 * Scans a single symbol for SMC signals
 * @param {string} symbol - Trading pair symbol
 * @param {string} timeframe - Timeframe interval
 * @returns {Promise<Object>} Analysis result with signals
 */
export async function scanSymbol(symbol, timeframe) {
  try {
    // Fetch kline data
    const candles = await getBinanceKlines(symbol, timeframe, 500);

    // Run SMC analysis
    const analysis = analyzeSMC(candles);

    // Return results with symbol and timeframe info
    return {
      symbol,
      timeframe,
      success: true,
      analysis,
      signals: analysis.signals || [],
      lastPrice: candles[candles.length - 1].close,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error scanning ${symbol} on ${timeframe}:`, error.message);
    return {
      symbol,
      timeframe,
      success: false,
      error: error.message,
      signals: []
    };
  }
}

/**
 * Scans multiple symbols for SMC signals
 * @param {Array<string>} symbols - Array of trading pair symbols
 * @param {string} timeframe - Timeframe interval
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Array>} Array of analysis results
 */
export async function scanMultipleSymbols(symbols, timeframe, progressCallback = null) {
  const results = [];
  let completed = 0;

  for (const symbol of symbols) {
    const result = await scanSymbol(symbol, timeframe);
    results.push(result);

    completed++;
    if (progressCallback) {
      progressCallback({
        completed,
        total: symbols.length,
        symbol,
        percentage: Math.round((completed / symbols.length) * 100)
      });
    }

    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Filters results to only include symbols with signals
 * @param {Array} results - Array of scan results
 * @returns {Array} Filtered results with signals only
 */
export function filterSignals(results) {
  return results.filter(result =>
    result.success && result.signals && result.signals.length > 0
  );
}

/**
 * Formats signals for frontend display
 * @param {Array} results - Array of scan results
 * @returns {Array} Formatted signal objects
 */
export function formatSignalsForDisplay(results) {
  const formattedSignals = [];

  for (const result of results) {
    if (!result.success || !result.signals || result.signals.length === 0) {
      continue;
    }

    for (const signal of result.signals) {
      formattedSignals.push({
        symbol: result.symbol,
        timeframe: result.timeframe,
        type: signal.type,
        direction: signal.direction,
        entry: signal.entry.toFixed(8),
        stopLoss: signal.stopLoss.toFixed(8),
        takeProfit: signal.takeProfit.toFixed(8),
        riskReward: signal.riskReward.toFixed(2),
        confidence: signal.confidence,
        patterns: signal.patterns.join(', '),
        timestamp: signal.timestamp,
        lastPrice: result.lastPrice.toFixed(8)
      });
    }
  }

  return formattedSignals;
}
