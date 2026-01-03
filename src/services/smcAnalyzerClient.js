/**
 * Client-side SMC Analyzer
 * Processes trading signals in the browser
 */

import { getBinanceKlines } from './binanceClient.js';
import { analyzeSMC } from '../shared/smcDetectors.js';
import { getHTFTimeframe } from '../shared/strategyConfig.js';

/**
 * Scans a single symbol for SMC signals (client-side)
 * @param {string} symbol - Trading pair symbol
 * @param {string} timeframe - Timeframe interval
 * @returns {Promise<Object>} Analysis result with signals
 */
export async function scanSymbol(symbol, timeframe) {
  try {
    // Fetch kline data from Binance (from user's browser)
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
      signals: [],
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Scans multiple symbols for SMC signals (client-side)
 * @param {Array} symbols - Array of trading pair symbols
 * @param {string} timeframe - Timeframe interval
 * @param {Function} progressCallback - Callback for progress updates
 * @returns {Promise<Array>} Array of scan results
 */
export async function scanMultipleSymbols(symbols, timeframe, progressCallback) {
  const results = [];
  const total = symbols.length;

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];

    // Update progress
    if (progressCallback) {
      progressCallback({
        current: i + 1,
        total: total,
        percentage: Math.round(((i + 1) / total) * 100),
        symbol: symbol
      });
    }

    // Scan symbol
    const result = await scanSymbol(symbol, timeframe);
    results.push(result);

    // Small delay to avoid rate limiting (Binance allows ~1200 requests/min)
    if (i < symbols.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Format signals for display
 * @param {Array} scanResults - Raw scan results
 * @returns {Array} Formatted signals
 */
export function formatSignalsForDisplay(scanResults) {
  const signals = [];

  for (const result of scanResults) {
    if (!result.success || !result.signals || result.signals.length === 0) {
      continue;
    }

    for (const signal of result.signals) {
      signals.push({
        symbol: result.symbol,
        timeframe: result.timeframe,
        type: signal.type,
        direction: signal.direction,
        entry: typeof signal.entry === 'number' ? signal.entry.toFixed(8) : signal.entry,
        stopLoss: typeof signal.stopLoss === 'number' ? signal.stopLoss.toFixed(8) : signal.stopLoss,
        takeProfit: typeof signal.takeProfit === 'number' ? signal.takeProfit.toFixed(8) : signal.takeProfit,
        riskReward: typeof signal.riskReward === 'number' ? signal.riskReward.toFixed(2) : signal.riskReward,
        confidence: signal.confidence,
        patterns: signal.patterns || [],
        patternsText: signal.patterns ? signal.patterns.join(', ') : '',
        price: result.lastPrice,
        lastPrice: typeof result.lastPrice === 'number' ? result.lastPrice.toFixed(8) : result.lastPrice,
        strength: signal.strength || 'medium',
        timestamp: signal.timestamp || result.timestamp,
        scanTime: result.timestamp,
        patternDetails: signal.patternDetails,
        confluenceReason: signal.confluenceReason,
        riskRewardBreakdown: signal.riskRewardBreakdown,
        // NEW ENHANCED FIELDS
        premiumDiscount: signal.premiumDiscount,
        ote: signal.ote,
        structureAnalysis: signal.structureAnalysis,
        liquidityAnalysis: signal.liquidityAnalysis,
        fvgStatus: signal.fvgStatus,
        orderBlockDetails: signal.orderBlockDetails,
        volumeAnalysis: signal.volumeAnalysis,
        entryTiming: signal.entryTiming,
        confluenceScore: signal.confluenceScore,
        riskManagement: signal.riskManagement,
        details: signal,
        // HTF METADATA (for UI display)
        htfTimeframe: getHTFTimeframe(result.timeframe),
        isHTFAligned: signal.confluenceScore >= 100,
        confluenceMax: 145, // Maximum possible confluence score with HTF
        htfAlignment: signal.htfAlignment || null
      });
    }
  }

  return signals;
}
