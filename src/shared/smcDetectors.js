/**
 * SMC (Smart Money Concept) Detection Algorithms
 * This module contains all the pattern detection logic for SMC trading strategy
 */

import { getCurrentConfig, getScalpingParams } from './strategyConfig.js';
import {
  detectMarketRegime,
  shouldAllowSignal,
  adjustConfluenceForRegime
} from './marketRegime.js';

/**
 * PHASE 13: Detects break-and-retest pattern for better entries
 * For bullish OB: Price breaks BELOW OB, then retests from below
 * For bearish OB: Price breaks ABOVE OB, then retests from above
 * @param {Array} candles - Recent candles
 * @param {Object} orderBlock - The OB being tested
 * @param {string} direction - 'bullish' or 'bearish'
 * @returns {Object} { hasBreakRetest: boolean, breakIndex: number, retestIndex: number, strength: number }
 */
function detectBreakAndRetest(candles, orderBlock, direction) {
  if (!candles || candles.length < 5 || !orderBlock) {
    return { hasBreakRetest: false, strength: 0 };
  }

  const latestIndex = candles.length - 1;
  const lookback = Math.min(10, candles.length - 1); // Look back max 10 candles

  // For BULLISH OB: Look for break below → retest from below
  if (direction === 'bullish') {
    let breakIndex = -1;

    // Step 1: Find where price broke BELOW the OB
    for (let i = latestIndex - lookback; i < latestIndex; i++) {
      if (i < 0) continue;
      const candle = candles[i];

      // Check if candle broke below OB bottom
      if (candle.low < orderBlock.bottom * 0.998) {
        breakIndex = i;
        break; // Found the break
      }
    }

    if (breakIndex === -1) {
      return { hasBreakRetest: false, strength: 0 }; // No break found
    }

    // Step 2: Check if price RETESTED from below (came back up to OB level)
    const currentCandle = candles[latestIndex];
    const previousCandle = candles[latestIndex - 1];

    // Retest conditions:
    // 1. Current/previous candle is AT or NEAR OB bottom (within OB zone)
    // 2. Price came from BELOW (previous candles were below OB)
    const priceAtOB = currentCandle.low <= orderBlock.top * 1.002 &&
                      currentCandle.high >= orderBlock.bottom * 0.998;

    const cameFromBelow = previousCandle.low < orderBlock.bottom * 1.01;

    if (priceAtOB && cameFromBelow) {
      // Valid break-and-retest pattern!
      const candlesSinceBreak = latestIndex - breakIndex;

      // Stronger if retest is quick (2-5 candles)
      let strength = 15; // Base points
      if (candlesSinceBreak <= 3) strength = 20; // Quick retest = stronger
      else if (candlesSinceBreak > 6) strength = 10; // Slow retest = weaker

      return {
        hasBreakRetest: true,
        breakIndex,
        retestIndex: latestIndex,
        candlesSinceBreak,
        strength,
        entryImprovement: 0.05 // Expect 5% better entry price
      };
    }
  }
  // For BEARISH OB: Look for break above → retest from above
  else if (direction === 'bearish') {
    let breakIndex = -1;

    // Step 1: Find where price broke ABOVE the OB
    for (let i = latestIndex - lookback; i < latestIndex; i++) {
      if (i < 0) continue;
      const candle = candles[i];

      // Check if candle broke above OB top
      if (candle.high > orderBlock.top * 1.002) {
        breakIndex = i;
        break; // Found the break
      }
    }

    if (breakIndex === -1) {
      return { hasBreakRetest: false, strength: 0 }; // No break found
    }

    // Step 2: Check if price RETESTED from above (came back down to OB level)
    const currentCandle = candles[latestIndex];
    const previousCandle = candles[latestIndex - 1];

    // Retest conditions:
    const priceAtOB = currentCandle.high >= orderBlock.bottom * 0.998 &&
                      currentCandle.low <= orderBlock.top * 1.002;

    const cameFromAbove = previousCandle.high > orderBlock.top * 0.99;

    if (priceAtOB && cameFromAbove) {
      // Valid break-and-retest pattern!
      const candlesSinceBreak = latestIndex - breakIndex;

      // Stronger if retest is quick (2-5 candles)
      let strength = 15; // Base points
      if (candlesSinceBreak <= 3) strength = 20; // Quick retest = stronger
      else if (candlesSinceBreak > 6) strength = 10; // Slow retest = weaker

      return {
        hasBreakRetest: true,
        breakIndex,
        retestIndex: latestIndex,
        candlesSinceBreak,
        strength,
        entryImprovement: 0.05 // Expect 5% better entry price
      };
    }
  }

  return { hasBreakRetest: false, strength: 0 };
}

/**
 * PHASE 14: Calculate adaptive stop loss multiplier based on volatility
 * @param {Array} candles - Recent candles for volatility analysis
 * @param {number} currentATR - Current ATR value
 * @returns {Object} { multiplier: number, volatilityState: string, reason: string }
 */
function calculateAdaptiveStopLoss(candles, currentATR) {
  // Validate inputs
  if (!candles || candles.length < 30 || !currentATR || currentATR <= 0) {
    return { multiplier: 2.5, volatilityState: 'normal', reason: 'Insufficient data', volatilityRatio: '1.00' };
  }

  try {
    // Calculate ATR for last 20 candles (short-term volatility)
    const recentCandles = candles.slice(-20);
    const recentATRs = recentCandles.map((candle, i) => {
      if (i === 0) return 0;
      if (!candle || typeof candle.high !== 'number' || typeof candle.low !== 'number') return 0;
      const high = candle.high;
      const low = candle.low;
      const prevClose = recentCandles[i - 1]?.close || candle.close;
      return Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
    }).filter(val => val > 0); // Remove invalid values

    if (recentATRs.length === 0) {
      return { multiplier: 2.5, volatilityState: 'normal', reason: 'Invalid candle data', volatilityRatio: '1.00' };
    }

    const shortTermATR = recentATRs.reduce((sum, val) => sum + val, 0) / recentATRs.length;

    // Calculate ATR for last 50 candles (medium-term baseline)
    const mediumCandles = candles.slice(-Math.min(50, candles.length));
    const mediumATRs = mediumCandles.map((candle, i) => {
      if (i === 0) return 0;
      if (!candle || typeof candle.high !== 'number' || typeof candle.low !== 'number') return 0;
      const high = candle.high;
      const low = candle.low;
      const prevClose = mediumCandles[i - 1]?.close || candle.close;
      return Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
    }).filter(val => val > 0); // Remove invalid values

    if (mediumATRs.length === 0) {
      return { multiplier: 2.5, volatilityState: 'normal', reason: 'Invalid baseline data', volatilityRatio: '1.00' };
    }

    const baselineATR = mediumATRs.reduce((sum, val) => sum + val, 0) / mediumATRs.length;

    // Prevent division by zero
    if (baselineATR <= 0) {
      return { multiplier: 2.5, volatilityState: 'normal', reason: 'Zero baseline ATR', volatilityRatio: '1.00' };
    }

    // Compare short-term to baseline
    const volatilityRatio = shortTermATR / baselineATR;

    // Determine volatility state and stop loss multiplier
    if (volatilityRatio > 1.3) {
      // HIGH VOLATILITY: Wider stops to avoid premature stop-outs
      return {
        multiplier: 3.0,
        volatilityState: 'high',
        reason: 'High volatility detected - using wider stops (3.0 ATR)',
        volatilityRatio: volatilityRatio.toFixed(2)
      };
    } else if (volatilityRatio < 0.7) {
      // LOW VOLATILITY: Tighter stops for better risk management
      return {
        multiplier: 2.0,
        volatilityState: 'low',
        reason: 'Low volatility detected - using tighter stops (2.0 ATR)',
        volatilityRatio: volatilityRatio.toFixed(2)
      };
    } else {
      // NORMAL VOLATILITY: Standard stops
      return {
        multiplier: 2.5,
        volatilityState: 'normal',
        reason: 'Normal volatility - standard stops (2.5 ATR)',
        volatilityRatio: volatilityRatio.toFixed(2)
      };
    }
  } catch (error) {
    // Fallback to normal if any error occurs
    console.error('Error in calculateAdaptiveStopLoss:', error);
    return { multiplier: 2.5, volatilityState: 'normal', reason: 'Calculation error', volatilityRatio: '1.00' };
  }
}

/**
 * PHASE 16: Detect correlated trading pairs for risk management
 * @param {string} symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @returns {Object|null} { group: string, correlatedPairs: Array<string>, riskLevel: string } or null
 */
function detectCorrelatedPairs(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    return null;
  }

  // Normalize symbol to base currency
  const baseCurrency = symbol.replace('USDT', '').replace('BUSD', '').replace('USD', '');

  // Define correlation groups based on crypto market dynamics
  const correlationGroups = {
    'BTC-Dominance': {
      pairs: ['BTC', 'WBTC'],
      riskLevel: 'extreme',
      description: 'Bitcoin and wrapped Bitcoin move identically'
    },
    'ETH-Ecosystem': {
      pairs: ['ETH', 'WETH', 'STETH'],
      riskLevel: 'extreme',
      description: 'Ethereum and wrapped/staked variants'
    },
    'Layer-1-Alts': {
      pairs: ['SOL', 'AVAX', 'ADA', 'DOT', 'ATOM', 'NEAR', 'ALGO'],
      riskLevel: 'high',
      description: 'Layer-1 blockchain platforms (high correlation during market moves)'
    },
    'Layer-2-Scaling': {
      pairs: ['MATIC', 'ARB', 'OP', 'IMX'],
      riskLevel: 'high',
      description: 'Layer-2 scaling solutions (correlated with Ethereum)'
    },
    'DeFi-Tokens': {
      pairs: ['UNI', 'AAVE', 'COMP', 'MKR', 'SNX', 'CRV'],
      riskLevel: 'high',
      description: 'DeFi protocol tokens'
    },
    'Meme-Coins': {
      pairs: ['DOGE', 'SHIB', 'PEPE', 'FLOKI'],
      riskLevel: 'extreme',
      description: 'Meme coins (highly correlated sentiment-driven)'
    },
    'Exchange-Tokens': {
      pairs: ['BNB', 'FTT', 'CRO', 'HT'],
      riskLevel: 'medium',
      description: 'Exchange utility tokens'
    },
    'Stablecoins': {
      pairs: ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD'],
      riskLevel: 'low',
      description: 'Stablecoins (minimal correlation risk)'
    }
  };

  // Find which group this symbol belongs to
  for (const [groupName, groupData] of Object.entries(correlationGroups)) {
    if (groupData.pairs.includes(baseCurrency)) {
      return {
        group: groupName,
        correlatedPairs: groupData.pairs.filter(p => p !== baseCurrency).map(p => `${p}USDT`),
        riskLevel: groupData.riskLevel,
        description: groupData.description,
        warningMessage: groupData.riskLevel === 'extreme'
          ? `⚠️ EXTREME CORRELATION: Avoid multiple positions in ${groupName}`
          : groupData.riskLevel === 'high'
            ? `⚠️ HIGH CORRELATION: Use caution with ${groupName} positions`
            : null
      };
    }
  }

  // No specific correlation group found
  return {
    group: 'Independent',
    correlatedPairs: [],
    riskLevel: 'low',
    description: 'No strong correlations detected',
    warningMessage: null
  };
}

/**
 * PHASE 17: Calculate multiple take-profit levels for partial position closing
 * @param {number} entry - Entry price
 * @param {number} stopLoss - Stop loss price
 * @param {number} mainTP - Main take profit target
 * @param {string} direction - 'bullish' or 'bearish'
 * @param {number} atr - Average True Range
 * @returns {Object} { tp1, tp2, tp3, allocations: { tp1: 50%, tp2: 30%, tp3: 20% } }
 */
function calculateMultipleTakeProfits(entry, stopLoss, mainTP, direction, atr) {
  const riskDistance = Math.abs(entry - stopLoss);

  if (direction === 'bullish') {
    // Bullish: Entry < TP levels
    const tp1 = entry + riskDistance; // 1:1 R:R (50% position)
    const tp2 = mainTP; // Main target (30% position)
    const tp3 = entry + (riskDistance * 3); // 1:3 R:R (20% position)

    return {
      tp1,
      tp2,
      tp3,
      allocations: { tp1: 0.50, tp2: 0.30, tp3: 0.20 },
      riskRewards: { tp1: 1.0, tp2: (tp2 - entry) / riskDistance, tp3: 3.0 }
    };
  } else {
    // Bearish: Entry > TP levels
    const tp1 = entry - riskDistance; // 1:1 R:R (50% position)
    const tp2 = mainTP; // Main target (30% position)
    const tp3 = entry - (riskDistance * 3); // 1:3 R:R (20% position)

    return {
      tp1,
      tp2,
      tp3,
      allocations: { tp1: 0.50, tp2: 0.30, tp3: 0.20 },
      riskRewards: { tp1: 1.0, tp2: (entry - tp2) / riskDistance, tp3: 3.0 }
    };
  }
}

/**
 * PHASE 11: Session-Based Filtering for optimal trading times
 * Analyzes trading session to filter low-liquidity periods
 * @param {number} timestamp - Candle timestamp in milliseconds
 * @returns {Object} { session: string, quality: string, confluenceBonus: number, shouldTrade: boolean }
 */
function analyzeSessionQuality(timestamp) {
  if (!timestamp) {
    return { session: 'unknown', quality: 'neutral', confluenceBonus: 0, shouldTrade: true };
  }

  const date = new Date(timestamp);
  const utcHour = date.getUTCHours(); // 0-23 UTC hour

  // Session definitions (UTC times)
  const londonOpen = utcHour >= 8 && utcHour < 16;   // 08:00-16:00 UTC
  const newYorkOpen = utcHour >= 13 && utcHour < 21; // 13:00-21:00 UTC
  const londonNYOverlap = utcHour >= 13 && utcHour < 16; // 13:00-16:00 UTC (PREMIUM)
  const asianSession = utcHour >= 0 && utcHour < 8;  // 00:00-08:00 UTC
  const deadZone = utcHour >= 2 && utcHour < 6;      // 02:00-06:00 UTC (AVOID)

  // Determine session quality and confluence bonus
  if (deadZone) {
    // Dead zone - very low liquidity, avoid trading
    return {
      session: 'dead-zone',
      quality: 'poor',
      confluenceBonus: 0,
      shouldTrade: false, // Block trades during dead zone
      reason: 'Extremely low liquidity period (02:00-06:00 UTC)'
    };
  } else if (londonNYOverlap) {
    // Premium time - both London & NY active
    return {
      session: 'london-ny-overlap',
      quality: 'premium',
      confluenceBonus: 15,
      shouldTrade: true,
      reason: 'Peak liquidity: London/NY overlap'
    };
  } else if (londonOpen || newYorkOpen) {
    // Good time - major session active
    const sessionName = londonOpen ? 'london' : 'new-york';
    return {
      session: sessionName,
      quality: 'good',
      confluenceBonus: 10,
      shouldTrade: true,
      reason: `Major session active: ${sessionName}`
    };
  } else if (asianSession) {
    // Asian session - lower volatility but still tradeable
    return {
      session: 'asian',
      quality: 'neutral',
      confluenceBonus: 5,
      shouldTrade: true,
      reason: 'Asian session: lower volatility'
    };
  } else {
    // Off-hours but not dead zone
    return {
      session: 'off-hours',
      quality: 'neutral',
      confluenceBonus: 3,
      shouldTrade: true,
      reason: 'Off-peak hours'
    };
  }
}

/**
 * PHASE 15: Detects volume divergence for smart money confirmation
 * Bullish divergence: Price making lower lows while volume increases (accumulation)
 * Bearish divergence: Price making higher highs while volume increases (distribution)
 * @param {Array} candles - Array of recent candles (last 10-15)
 * @param {string} direction - 'long' or 'short'
 * @returns {Object} { hasDivergence: boolean, strength: number (0-15 confluence points) }
 */
function detectVolumeDivergence(candles, direction) {
  if (!candles || candles.length < 10) {
    return { hasDivergence: false, strength: 0 };
  }

  const recent = candles.slice(-10); // Last 10 candles for analysis
  const firstCandle = recent[0];
  const lastCandle = recent[recent.length - 1];

  // Calculate average volume for first 5 vs last 5 candles
  const firstHalfVolume = recent.slice(0, 5).reduce((sum, c) => sum + c.volume, 0) / 5;
  const secondHalfVolume = recent.slice(5).reduce((sum, c) => sum + c.volume, 0) / 5;

  const volumeIncrease = secondHalfVolume > firstHalfVolume * 1.2; // 20% increase

  if (direction === 'long') {
    // BULLISH DIVERGENCE: Lower lows in price + increasing volume = smart money accumulation
    const priceDowntrend = lastCandle.low < firstCandle.low;
    const hasBullishDivergence = priceDowntrend && volumeIncrease;

    if (hasBullishDivergence) {
      // Measure strength based on volume increase ratio
      const volumeRatio = secondHalfVolume / firstHalfVolume;
      let strength = 10; // Base points

      if (volumeRatio >= 1.5) strength = 15; // Very strong divergence (50%+ volume increase)
      else if (volumeRatio >= 1.3) strength = 12; // Strong divergence (30%+ volume increase)

      return { hasDivergence: true, strength, type: 'bullish' };
    }
  } else {
    // BEARISH DIVERGENCE: Higher highs in price + increasing volume = smart money distribution
    const priceUptrend = lastCandle.high > firstCandle.high;
    const hasBearishDivergence = priceUptrend && volumeIncrease;

    if (hasBearishDivergence) {
      // Measure strength based on volume increase ratio
      const volumeRatio = secondHalfVolume / firstHalfVolume;
      let strength = 10; // Base points

      if (volumeRatio >= 1.5) strength = 15; // Very strong divergence
      else if (volumeRatio >= 1.3) strength = 12; // Strong divergence

      return { hasDivergence: true, strength, type: 'bearish' };
    }
  }

  return { hasDivergence: false, strength: 0 };
}

/**
 * Identifies swing highs and swing lows in price data
 * A swing high has a higher high than surrounding candles
 * A swing low has a lower low than surrounding candles
 * @param {Array} candles - Array of kline objects
 * @param {number} lookback - Number of candles to look back/forward (default: 2)
 * @param {Object} config - Optional config object with timeframe info for scalping mode
 * @returns {Object} Object with swingHighs and swingLows arrays
 */
export function detectSwingPoints(candles, lookback = 2, config = null) {
  // Use timeframe-specific lookback if in scalping mode
  if (config?.timeframe) {
    const baseConfig = getCurrentConfig();
    if (baseConfig.scalping?.enableTimeoutExit) {
      const scalpingParams = getScalpingParams(config.timeframe);
      lookback = scalpingParams?.swingLookback || lookback;
    }
  }

  const swingHighs = [];
  const swingLows = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];

    // Check if it's a swing high
    let isSwingHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].high >= current.high) {
        isSwingHigh = false;
        break;
      }
    }

    if (isSwingHigh) {
      swingHighs.push({
        index: i,
        price: current.high,
        timestamp: current.timestamp,
        candle: current
      });
    }

    // Check if it's a swing low
    let isSwingLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].low <= current.low) {
        isSwingLow = false;
        break;
      }
    }

    if (isSwingLow) {
      swingLows.push({
        index: i,
        price: current.low,
        timestamp: current.timestamp,
        candle: current
      });
    }
  }

  return { swingHighs, swingLows };
}

/**
 * Detects Fair Value Gaps (FVG) - imbalances in price
 * Bullish FVG: Gap between candle[i-2].high and candle[i].low (upward move)
 * Bearish FVG: Gap between candle[i-2].low and candle[i].high (downward move)
 * @param {Array} candles - Array of kline objects
 * @param {Object} config - Optional config object with timeframe info for scalping mode
 * @returns {Array} Array of FVG objects
 */
export function detectFairValueGaps(candles, config = null) {
  const fvgs = [];

  // Timeframe-adaptive minimum gap size (filters out noise)
  // BALANCED: Finding sweet spot between too loose and too strict
  const timeframe = config?.timeframe || '1h';
  const minGapConfig = {
    '15m': 0.0010, // 0.10% minimum gap for 15m - BALANCED: 0.03% → 0.10% (3.3x stricter)
    '1h': 0.0008,  // 0.08% minimum gap for 1h - BALANCED: 0.05% → 0.08% (1.6x stricter)
    '4h': 0.0008   // 0.08% minimum gap for 4h (keeps balance)
  };
  const minGapSize = minGapConfig[timeframe] || minGapConfig['1h'];

  for (let i = 2; i < candles.length; i++) {
    const prev2 = candles[i - 2];
    const prev1 = candles[i - 1];
    const current = candles[i];

    // Bullish FVG (gap up)
    const bullishGap = current.low - prev2.high;
    const bullishGapPercent = Math.abs(bullishGap / prev2.high);

    if (bullishGap > 0 && bullishGapPercent >= minGapSize) {
      fvgs.push({
        type: 'bullish',
        index: i,
        top: current.low,
        bottom: prev2.high,
        gap: bullishGap,
        gapPercent: bullishGapPercent,
        timestamp: current.timestamp,
        mitigated: false
      });
    }

    // Bearish FVG (gap down)
    const bearishGap = prev2.low - current.high;
    const bearishGapPercent = Math.abs(bearishGap / current.high);

    if (bearishGap > 0 && bearishGapPercent >= minGapSize) {
      fvgs.push({
        type: 'bearish',
        index: i,
        top: prev2.low,
        bottom: current.high,
        gap: bearishGap,
        gapPercent: bearishGapPercent,
        timestamp: current.timestamp,
        mitigated: false
      });
    }
  }

  return fvgs;
}

/**
 * Detects Order Blocks - areas where institutions placed large orders
 * Bullish OB: Last down candle before strong up move
 * Bearish OB: Last up candle before strong down move
 * @param {Array} candles - Array of kline objects
 * @param {number} impulseThreshold - Minimum % move to consider an impulse (default: 1%)
 * @returns {Array} Array of order block objects
 */
export function detectOrderBlocks(candles, impulseThreshold = null, config = null) {
  // Timeframe-adaptive configuration
  const timeframe = config?.timeframe || '1h';
  const tfConfig = {
    '15m': { lookforward: [3, 5, 7, 10, 15], defaultThreshold: 0.006, maxLookforward: 15 }, // BALANCED: 0.003 → 0.006 (2x stricter)
    '1h': { lookforward: [4, 6, 8, 12, 16], defaultThreshold: 0.008, maxLookforward: 16 }, // BALANCED: 0.005 → 0.008 (1.6x stricter)
    '4h': { lookforward: [4, 6, 8, 10, 12], defaultThreshold: 0.008, maxLookforward: 12 }
  };

  const tfParams = tfConfig[timeframe] || tfConfig['1h'];

  // Use timeframe-specific threshold if not provided
  if (impulseThreshold === null) {
    const baseConfig = getCurrentConfig();

    if (config?.timeframe && baseConfig.scalping?.enableTimeoutExit) {
      const scalpingParams = getScalpingParams(config.timeframe);
      impulseThreshold = scalpingParams?.obImpulseThreshold || baseConfig.obImpulseThreshold || tfParams.defaultThreshold;
    } else {
      impulseThreshold = baseConfig.obImpulseThreshold || tfParams.defaultThreshold;
    }
  }

  const orderBlocks = [];
  const maxLookforward = tfParams.maxLookforward;

  for (let i = 1; i < candles.length - maxLookforward; i++) {
    const current = candles[i];

    // Check for bullish order block (bearish candle followed by strong up move)
    const isBearishCandle = current.close < current.open;

    if (isBearishCandle) {
      // Find maximum impulse within lookforward range
      let maxUpMove = 0;
      let impulseCandle = null;

      for (const offset of tfParams.lookforward) {
        if (i + offset >= candles.length) break;
        const futureCandle = candles[i + offset];
        const upMove = ((futureCandle.high - current.low) / current.low) * 100;

        if (upMove > maxUpMove) {
          maxUpMove = upMove;
          impulseCandle = futureCandle;
        }
      }

      if (maxUpMove >= impulseThreshold * 100) {
        orderBlocks.push({
          type: 'bullish',
          index: i,
          top: current.high,
          bottom: current.low,
          timestamp: current.timestamp,
          candle: current,
          strength: maxUpMove,
          impulseCandle: impulseCandle
        });
      }
    }

    // Check for bearish order block (bullish candle followed by strong down move)
    const isBullishCandle = current.close > current.open;

    if (isBullishCandle) {
      // Find maximum impulse within lookforward range
      let maxDownMove = 0;
      let impulseCandle = null;

      for (const offset of tfParams.lookforward) {
        if (i + offset >= candles.length) break;
        const futureCandle = candles[i + offset];
        const downMove = ((current.high - futureCandle.low) / current.high) * 100;

        if (downMove > maxDownMove) {
          maxDownMove = downMove;
          impulseCandle = futureCandle;
        }
      }

      if (maxDownMove >= impulseThreshold * 100) {
        orderBlocks.push({
          type: 'bearish',
          index: i,
          top: current.high,
          bottom: current.low,
          timestamp: current.timestamp,
          candle: current,
          strength: maxDownMove,
          impulseCandle: impulseCandle
        });
      }
    }
  }

  // PHASE 12 ENHANCEMENT: Filter out already-mitigated (tested) Order Blocks
  // Only keep FRESH OBs that haven't been touched yet
  const freshOrderBlocks = orderBlocks.filter(ob => {
    // Check if price has tested this OB after it was created
    let touches = 0;

    for (let j = ob.index + 1; j < candles.length; j++) {
      const testCandle = candles[j];

      if (ob.type === 'bullish') {
        // For bullish OB, check if price came back down to test it
        // Consider it tested if low touches within OB zone
        const touchedOB = testCandle.low <= ob.top * 1.001 && testCandle.low >= ob.bottom * 0.999;
        if (touchedOB) touches++;
      } else {
        // For bearish OB, check if price came back up to test it
        // Consider it tested if high touches within OB zone
        const touchedOB = testCandle.high >= ob.bottom * 0.999 && testCandle.high <= ob.top * 1.001;
        if (touchedOB) touches++;
      }

      // CRITICAL: Only accept FIRST touch (fresh OBs)
      // Retested OBs have much lower success rate
      if (touches > 0) {
        return false; // This OB has been tested - skip it
      }
    }

    return true; // Fresh OB - never tested before
  });

  // Group by type for easier access
  const grouped = {
    bullish: freshOrderBlocks.filter(ob => ob.type === 'bullish'),
    bearish: freshOrderBlocks.filter(ob => ob.type === 'bearish')
  };

  return grouped;
}

/**
 * Analyzes market structure to identify trend direction
 * HH/HL = Uptrend, LH/LL = Downtrend
 * @param {Object} swingPoints - Object with swingHighs and swingLows
 * @returns {Object} Market structure analysis
 */
export function analyzeMarketStructure(swingPoints) {
  const { swingHighs, swingLows } = swingPoints;

  if (swingHighs.length < 2 || swingLows.length < 2) {
    return { trend: 'neutral', confidence: 'low' };
  }

  // Get last 3 swing highs and lows
  const recentHighs = swingHighs.slice(-3);
  const recentLows = swingLows.slice(-3);

  // Check for higher highs
  let higherHighs = 0;
  for (let i = 1; i < recentHighs.length; i++) {
    if (recentHighs[i].price > recentHighs[i - 1].price) higherHighs++;
  }

  // Check for higher lows
  let higherLows = 0;
  for (let i = 1; i < recentLows.length; i++) {
    if (recentLows[i].price > recentLows[i - 1].price) higherLows++;
  }

  // Check for lower highs
  let lowerHighs = 0;
  for (let i = 1; i < recentHighs.length; i++) {
    if (recentHighs[i].price < recentHighs[i - 1].price) lowerHighs++;
  }

  // Check for lower lows
  let lowerLows = 0;
  for (let i = 1; i < recentLows.length; i++) {
    if (recentLows[i].price < recentLows[i - 1].price) lowerLows++;
  }

  // Calculate price range for ranging detection
  const highestHigh = Math.max(...recentHighs.map(h => h.price));
  const lowestLow = Math.min(...recentLows.map(l => l.price));
  const range = highestHigh - lowestLow;
  const midpoint = (highestHigh + lowestLow) / 2;
  const rangePercent = (range / midpoint) * 100;

  // Determine trend with improved logic
  let trend = 'neutral';
  let confidence = 'low';

  // STRONG UPTREND: Requires 2+ HH and 2+ HL
  if (higherHighs >= 2 && higherLows >= 2) {
    trend = 'uptrend';
    confidence = 'high';
  }
  // WEAK UPTREND: Only 1 HH and 1 HL (less reliable)
  else if (higherHighs >= 1 && higherLows >= 1) {
    trend = 'uptrend';
    confidence = 'low';
  }
  // STRONG DOWNTREND: Requires 2+ LH and 2+ LL
  else if (lowerHighs >= 2 && lowerLows >= 2) {
    trend = 'downtrend';
    confidence = 'high';
  }
  // WEAK DOWNTREND: Only 1 LH and 1 LL (less reliable)
  else if (lowerHighs >= 1 && lowerLows >= 1) {
    trend = 'downtrend';
    confidence = 'low';
  }
  // RANGING: No clear HH/HL or LH/LL pattern
  // Also check if price range is relatively tight (< 3% range)
  else if ((higherHighs === 0 && lowerHighs === 0) || (higherLows === 0 && lowerLows === 0) || rangePercent < 3.0) {
    trend = 'ranging';
    confidence = 'medium';
  }
  // NEUTRAL: Mixed signals, no clear trend
  else {
    trend = 'neutral';
    confidence = 'low';
  }

  return {
    trend,
    confidence,
    lastSwingHigh: recentHighs[recentHighs.length - 1],
    lastSwingLow: recentLows[recentLows.length - 1],
    higherHighs,
    higherLows,
    lowerHighs,
    lowerLows,
    range,
    rangePercent
  };
}

/**
 * Detects liquidity sweeps - when price briefly breaks swing points
 * then reverses (stop hunt)
 * @param {Array} candles - Array of kline objects
 * @param {Object} swingPoints - Object with swingHighs and swingLows
 * @returns {Array} Array of liquidity sweep events
 */
export function detectLiquiditySweeps(candles, swingPoints, config = null) {
  const sweeps = [];
  const { swingHighs, swingLows } = swingPoints;

  // Timeframe-adaptive lookback window
  const timeframe = config?.timeframe || '1h';
  const lookbackConfig = {
    '15m': { min: 2, max: 15 },
    '1h': { min: 3, max: 20 },
    '4h': { min: 5, max: 30 }
  };
  const lookback = lookbackConfig[timeframe] || lookbackConfig['1h'];

  for (let i = 0; i < candles.length - 2; i++) {
    const current = candles[i];
    const next = candles[i + 1];

    // Check for sell-side liquidity sweep (break below swing low then reversal)
    for (const swingLow of swingLows) {
      if (swingLow.index < i - lookback.min && swingLow.index > i - lookback.max) {
        const brokeBelow = current.low < swingLow.price;
        const closedAbove = current.close > swingLow.price;
        const nextHigher = next.close > current.close;

        // ENHANCED: Require ALL 3 conditions for valid sweep (was 2/3)
        const conditionsMet = [brokeBelow, closedAbove, nextHigher].filter(Boolean).length;

        if (conditionsMet === 3) {
          // Only accept strong sweeps with all conditions met
          sweeps.push({
            type: 'buy-side',
            direction: 'bullish',
            index: i,
            swingLevel: swingLow.price,
            timestamp: current.timestamp,
            candle: current,
            strength: 'strong',
            conditionsMet: 3
          });
        }
        // REMOVED: Partial sweeps (2/3 conditions) - too many false positives
      }
    }

    // Check for buy-side liquidity sweep (break above swing high then reversal)
    for (const swingHigh of swingHighs) {
      if (swingHigh.index < i - lookback.min && swingHigh.index > i - lookback.max) {
        const brokeAbove = current.high > swingHigh.price;
        const closedBelow = current.close < swingHigh.price;
        const nextLower = next.close < current.close;

        // ENHANCED: Require ALL 3 conditions for valid sweep (was 2/3)
        const conditionsMet = [brokeAbove, closedBelow, nextLower].filter(Boolean).length;

        if (conditionsMet === 3) {
          // Only accept strong sweeps with all conditions met
          sweeps.push({
            type: 'sell-side',
            direction: 'bearish',
            index: i,
            swingLevel: swingHigh.price,
            timestamp: current.timestamp,
            candle: current,
            strength: 'strong',
            conditionsMet: 3
          });
        }
        // REMOVED: Partial sweeps (2/3 conditions) - too many false positives
      }
    }
  }

  return sweeps;
}

/**
 * Detects Break of Market Structure (BMS) - when price breaks
 * previous structure confirming trend change
 * @param {Array} candles - Array of kline objects
 * @param {Object} structure - Market structure from analyzeMarketStructure
 * @returns {Array} Array of BMS events
 */
export function detectBreakOfStructure(candles, structure) {
  const breaks = [];

  if (!structure.lastSwingHigh || !structure.lastSwingLow) {
    return breaks;
  }

  for (let i = Math.max(structure.lastSwingHigh.index, structure.lastSwingLow.index) + 1;
       i < candles.length; i++) {
    const current = candles[i];

    // Bullish BMS: In downtrend, price breaks above last swing high
    if (structure.trend === 'downtrend' && current.close > structure.lastSwingHigh.price) {
      breaks.push({
        type: 'bullish',
        index: i,
        breakLevel: structure.lastSwingHigh.price,
        timestamp: current.timestamp,
        previousTrend: 'downtrend'
      });
    }

    // Bearish BMS: In uptrend, price breaks below last swing low
    if (structure.trend === 'uptrend' && current.close < structure.lastSwingLow.price) {
      breaks.push({
        type: 'bearish',
        index: i,
        breakLevel: structure.lastSwingLow.price,
        timestamp: current.timestamp,
        previousTrend: 'uptrend'
      });
    }
  }

  return breaks;
}

/**
 * Detect higher timeframe trend using multiple methods
 * @param {Array} htfCandles - Higher timeframe candles (e.g., 4h when trading 1h)
 * @returns {string} 'bullish', 'bearish', or 'neutral'
 */
export function detectHigherTimeframeTrend(htfCandles) {
  if (!htfCandles || htfCandles.length < 100) {
    return 'neutral';
  }

  // Use last 100 candles for robust trend analysis (increased from 50)
  const recentCandles = htfCandles.slice(-100);

  // Method 1: EMA 20 vs EMA 50
  const calculateEMA = (data, period) => {
    const k = 2 / (period + 1);
    let ema = data[0].close;

    for (let i = 1; i < data.length; i++) {
      ema = (data[i].close * k) + (ema * (1 - k));
    }

    return ema;
  };

  const ema20 = calculateEMA(recentCandles, 20);
  const ema50 = calculateEMA(recentCandles, 50);

  // Method 2: Higher Highs and Higher Lows (bullish) vs Lower Highs and Lower Lows (bearish)
  const swingPoints = detectSwingPoints(recentCandles, 3);
  const recentSwingHighs = swingPoints.swingHighs.slice(-3);
  const recentSwingLows = swingPoints.swingLows.slice(-3);

  let hhhl = false; // Higher Highs Higher Lows
  let lhll = false; // Lower Highs Lower Lows

  if (recentSwingHighs.length >= 2 && recentSwingLows.length >= 2) {
    // Check for Higher Highs and Higher Lows
    const lastHigh = recentSwingHighs[recentSwingHighs.length - 1].price;
    const prevHigh = recentSwingHighs[recentSwingHighs.length - 2].price;
    const lastLow = recentSwingLows[recentSwingLows.length - 1].price;
    const prevLow = recentSwingLows[recentSwingLows.length - 2].price;

    hhhl = (lastHigh > prevHigh) && (lastLow > prevLow);
    lhll = (lastHigh < prevHigh) && (lastLow < prevLow);
  }

  // Method 3: Price relative to EMAs
  const currentPrice = recentCandles[recentCandles.length - 1].close;
  const priceAboveEMAs = currentPrice > ema20 && currentPrice > ema50;
  const priceBelowEMAs = currentPrice < ema20 && currentPrice < ema50;

  // Combine methods for robust trend detection
  let bullishSignals = 0;
  let bearishSignals = 0;

  if (ema20 > ema50) bullishSignals++;
  if (ema20 < ema50) bearishSignals++;

  if (hhhl) bullishSignals++;
  if (lhll) bearishSignals++;

  if (priceAboveEMAs) bullishSignals++;
  if (priceBelowEMAs) bearishSignals++;

  // BALANCED: Require 2 of 3 confirmations for trend detection
  // Combined with strict counter-trend blocking to prevent losses
  // This correctly identifies obvious trends while blocking counter-trend entries
  if (bullishSignals >= 2) return 'bullish';
  if (bearishSignals >= 2) return 'bearish';

  return 'neutral';
}

/**
 * Calculate HTF trend strength to allow flexible filtering
 * @param {Array} htfCandles - Higher timeframe candles
 * @returns {Object} { strength: 'strong'|'medium'|'weak', signals: number, details: {...} }
 */
export function calculateHTFTrendStrength(htfCandles) {
  if (!htfCandles || htfCandles.length < 50) {
    return { strength: 'weak', signals: 0, details: {} };
  }

  const recentCandles = htfCandles.slice(-50);

  // Calculate EMAs
  const calculateEMA = (data, period) => {
    const k = 2 / (period + 1);
    let ema = data[0].close;
    for (let i = 1; i < data.length; i++) {
      ema = (data[i].close * k) + (ema * (1 - k));
    }
    return ema;
  };

  const ema20 = calculateEMA(recentCandles, 20);
  const ema50 = calculateEMA(recentCandles, 50);

  // Analyze swing points
  const swingPoints = detectSwingPoints(recentCandles, 3);
  const recentSwingHighs = swingPoints.swingHighs.slice(-3);
  const recentSwingLows = swingPoints.swingLows.slice(-3);

  let higherHighs = 0;
  let higherLows = 0;
  let lowerHighs = 0;
  let lowerLows = 0;

  // Count Higher Highs
  for (let i = 1; i < recentSwingHighs.length; i++) {
    if (recentSwingHighs[i].price > recentSwingHighs[i - 1].price) higherHighs++;
    if (recentSwingHighs[i].price < recentSwingHighs[i - 1].price) lowerHighs++;
  }

  // Count Higher Lows
  for (let i = 1; i < recentSwingLows.length; i++) {
    if (recentSwingLows[i].price > recentSwingLows[i - 1].price) higherLows++;
    if (recentSwingLows[i].price < recentSwingLows[i - 1].price) lowerLows++;
  }

  const currentPrice = recentCandles[recentCandles.length - 1].close;

  // Count bullish and bearish signals
  let bullishSignals = 0;
  let bearishSignals = 0;

  if (ema20 > ema50) bullishSignals++;
  if (ema20 < ema50) bearishSignals++;

  if (higherHighs >= 1 && higherLows >= 1) bullishSignals++;
  if (lowerHighs >= 1 && lowerLows >= 1) bearishSignals++;

  if (currentPrice > ema20 && currentPrice > ema50) bullishSignals++;
  if (currentPrice < ema20 && currentPrice < ema50) bearishSignals++;

  // Determine strength based on number of confirming signals
  const maxSignals = Math.max(bullishSignals, bearishSignals);
  let strength = 'weak';

  if (maxSignals >= 3) {
    strength = 'strong';  // All 3 signals confirm
  } else if (maxSignals === 2) {
    strength = 'medium';  // 2 out of 3 signals
  } else {
    strength = 'weak';    // Only 1 or 0 signals
  }

  return {
    strength,
    bullishSignals,
    bearishSignals,
    details: {
      emaAlignment: ema20 > ema50 ? 'bullish' : (ema20 < ema50 ? 'bearish' : 'neutral'),
      swingStructure: (higherHighs >= 1 && higherLows >= 1) ? 'bullish' :
                      (lowerHighs >= 1 && lowerLows >= 1) ? 'bearish' : 'neutral',
      pricePosition: (currentPrice > ema20 && currentPrice > ema50) ? 'bullish' :
                     (currentPrice < ema20 && currentPrice < ema50) ? 'bearish' : 'neutral',
      higherHighs,
      higherLows,
      lowerHighs,
      lowerLows
    }
  };
}

/**
 * Detects Higher Timeframe Order Blocks
 * Institutional zones on HTF that act as strong support/resistance
 * @param {Array} htfCandles - Higher timeframe candles
 * @returns {Object} HTF order blocks { bullish: [...], bearish: [...] }
 */
export function detectHTFOrderBlocks(htfCandles) {
  if (!htfCandles || htfCandles.length < 10) {
    return { bullish: [], bearish: [] };
  }

  // Use higher impulse threshold for HTF (HTF moves are larger)
  const htfImpulseThreshold = 0.006; // 0.6% for HTF (lowered for more detections)
  const orderBlocks = [];

  for (let i = 1; i < htfCandles.length - 3; i++) {
    const current = htfCandles[i];
    const next1 = htfCandles[i + 1];
    const next2 = htfCandles[i + 2];
    const next3 = htfCandles[i + 3];

    // HTF Bullish OB: Down candle before strong up move
    const isBearishCandle = current.close < current.open;
    const upMove = ((next3.high - current.low) / current.low) * 100;

    if (isBearishCandle && upMove >= htfImpulseThreshold * 100) {
      orderBlocks.push({
        type: 'bullish',
        index: i,
        top: current.high,
        bottom: current.low,
        timestamp: current.timestamp,
        candle: current,
        strength: upMove,
        htf: true // Mark as HTF OB
      });
    }

    // HTF Bearish OB: Up candle before strong down move
    const isBullishCandle = current.close > current.open;
    const downMove = ((current.high - next3.low) / current.high) * 100;

    if (isBullishCandle && downMove >= htfImpulseThreshold * 100) {
      orderBlocks.push({
        type: 'bearish',
        index: i,
        top: current.high,
        bottom: current.low,
        timestamp: current.timestamp,
        candle: current,
        strength: downMove,
        htf: true // Mark as HTF OB
      });
    }
  }

  // Group by type and keep only most recent 5 of each
  const grouped = {
    bullish: orderBlocks.filter(ob => ob.type === 'bullish').slice(-5),
    bearish: orderBlocks.filter(ob => ob.type === 'bearish').slice(-5)
  };

  return grouped;
}

/**
 * Detects Higher Timeframe Fair Value Gaps
 * Large imbalances on HTF that price tends to fill
 * @param {Array} htfCandles - Higher timeframe candles
 * @returns {Object} HTF FVGs { bullish: [...], bearish: [...] }
 */
export function detectHTFFairValueGaps(htfCandles) {
  if (!htfCandles || htfCandles.length < 3) {
    return { bullish: [], bearish: [] };
  }

  const fvgs = [];

  for (let i = 0; i < htfCandles.length - 2; i++) {
    const candle1 = htfCandles[i];
    const candle2 = htfCandles[i + 1];
    const candle3 = htfCandles[i + 2];

    // Bullish FVG: Gap between candle1 high and candle3 low
    if (candle1.high < candle3.low) {
      const gap = candle3.low - candle1.high;
      const gapPercent = (gap / candle1.high) * 100;

      // Only consider significant HTF gaps (>0.2% - lowered for more detections)
      if (gapPercent > 0.2) {
        fvgs.push({
          type: 'bullish',
          index: i + 1,
          top: candle3.low,
          bottom: candle1.high,
          gap: gap,
          gapPercent: gapPercent,
          timestamp: candle2.timestamp,
          mitigated: false,
          fillPercentage: 0,
          htf: true // Mark as HTF FVG
        });
      }
    }

    // Bearish FVG: Gap between candle3 high and candle1 low
    if (candle3.high < candle1.low) {
      const gap = candle1.low - candle3.high;
      const gapPercent = (gap / candle1.low) * 100;

      // Only consider significant HTF gaps (>0.2% - lowered for more detections)
      if (gapPercent > 0.2) {
        fvgs.push({
          type: 'bearish',
          index: i + 1,
          top: candle1.low,
          bottom: candle3.high,
          gap: gap,
          gapPercent: gapPercent,
          timestamp: candle2.timestamp,
          mitigated: false,
          fillPercentage: 0,
          htf: true // Mark as HTF FVG
        });
      }
    }
  }

  // Group by type and keep only most recent 8 of each
  const grouped = {
    bullish: fvgs.filter(fvg => fvg.type === 'bullish').slice(-8),
    bearish: fvgs.filter(fvg => fvg.type === 'bearish').slice(-8)
  };

  return grouped;
}

/**
 * Analyzes HTF Premium/Discount Zones
 * Determines if current price is at wholesale (discount) or retail (premium) on HTF
 * @param {Array} htfCandles - Higher timeframe candles
 * @returns {Object} HTF zone analysis { zone, strength, high, low, range }
 */
export function analyzeHTFPremiumDiscount(htfCandles) {
  if (!htfCandles || htfCandles.length < 20) {
    return { zone: 'neutral', strength: 0, high: 0, low: 0, range: 0 };
  }

  // Use recent 50 candles to determine HTF range
  const lookbackCandles = htfCandles.slice(-50);

  // Find HTF swing high and low
  let htfHigh = -Infinity;
  let htfLow = Infinity;

  lookbackCandles.forEach(candle => {
    if (candle.high > htfHigh) htfHigh = candle.high;
    if (candle.low < htfLow) htfLow = candle.low;
  });

  const htfRange = htfHigh - htfLow;
  const currentPrice = htfCandles[htfCandles.length - 1].close;
  const pricePosition = (currentPrice - htfLow) / htfRange;

  // Determine zone
  let zone = 'neutral';
  let strength = 0;

  if (pricePosition <= 0.382) {
    // In discount zone (below 38.2% of range)
    zone = 'discount';
    strength = (0.382 - pricePosition) / 0.382; // 0-1, higher = stronger discount
  } else if (pricePosition >= 0.618) {
    // In premium zone (above 61.8% of range)
    zone = 'premium';
    strength = (pricePosition - 0.618) / 0.382; // 0-1, higher = stronger premium
  } else {
    // In equilibrium/neutral zone
    zone = 'neutral';
    strength = 0;
  }

  return {
    zone,
    strength: Math.min(strength, 1), // Cap at 1
    high: htfHigh,
    low: htfLow,
    range: htfRange,
    pricePosition,
    currentPrice
  };
}

/**
 * Detects HTF Break of Structure (BOS)
 * Identifies when HTF structure shifts from bullish to bearish or vice versa
 * @param {Array} htfCandles - Higher timeframe candles
 * @returns {Object} HTF structure state { structure, recentBOS, strength }
 */
export function detectHTFStructureBreak(htfCandles) {
  if (!htfCandles || htfCandles.length < 20) {
    return { structure: 'neutral', recentBOS: false, strength: 0, direction: null };
  }

  // Detect HTF swing points
  const htfSwings = detectSwingPoints(htfCandles, 4); // Larger lookback for HTF

  const recentHighs = htfSwings.swingHighs.slice(-4);
  const recentLows = htfSwings.swingLows.slice(-4);

  if (recentHighs.length < 2 || recentLows.length < 2) {
    return { structure: 'neutral', recentBOS: false, strength: 0, direction: null };
  }

  // Check for Higher Highs and Higher Lows (bullish structure)
  let higherHighs = 0;
  let higherLows = 0;

  for (let i = 1; i < recentHighs.length; i++) {
    if (recentHighs[i].price > recentHighs[i - 1].price) higherHighs++;
  }

  for (let i = 1; i < recentLows.length; i++) {
    if (recentLows[i].price > recentLows[i - 1].price) higherLows++;
  }

  // Check for Lower Highs and Lower Lows (bearish structure)
  let lowerHighs = 0;
  let lowerLows = 0;

  for (let i = 1; i < recentHighs.length; i++) {
    if (recentHighs[i].price < recentHighs[i - 1].price) lowerHighs++;
  }

  for (let i = 1; i < recentLows.length; i++) {
    if (recentLows[i].price < recentLows[i - 1].price) lowerLows++;
  }

  // Determine structure
  let structure = 'neutral';
  let strength = 0;
  let recentBOS = false;
  let direction = null;

  const bullishConfidence = (higherHighs + higherLows) / ((recentHighs.length - 1) + (recentLows.length - 1));
  const bearishConfidence = (lowerHighs + lowerLows) / ((recentHighs.length - 1) + (recentLows.length - 1));

  if (bullishConfidence >= 0.6) {
    structure = 'bullish';
    strength = bullishConfidence;
    // Check if recent (within last 10 candles)
    const lastSwingIndex = Math.max(
      recentHighs[recentHighs.length - 1].index,
      recentLows[recentLows.length - 1].index
    );
    recentBOS = (htfCandles.length - lastSwingIndex) <= 10;
    direction = 'bullish';
  } else if (bearishConfidence >= 0.6) {
    structure = 'bearish';
    strength = bearishConfidence;
    const lastSwingIndex = Math.max(
      recentHighs[recentHighs.length - 1].index,
      recentLows[recentLows.length - 1].index
    );
    recentBOS = (htfCandles.length - lastSwingIndex) <= 10;
    direction = 'bearish';
  }

  return {
    structure,
    recentBOS,
    strength,
    direction,
    lastHighIndex: recentHighs[recentHighs.length - 1].index,
    lastLowIndex: recentLows[recentLows.length - 1].index
  };
}

// ============= HTF HELPER FUNCTIONS =============

/**
 * Check if a price is within any HTF Order Block zone
 * @param {number} price - The price to check (LTF entry price)
 * @param {Array} htfOBs - Array of HTF order blocks
 * @returns {boolean} True if price is within any HTF OB
 */
export function checkIfInHTFOrderBlock(price, htfOBs) {
  if (!htfOBs || htfOBs.length === 0) return false;

  for (const ob of htfOBs) {
    if (price >= ob.bottom && price <= ob.top) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a target price is targeting an HTF Fair Value Gap
 * @param {number} targetPrice - The LTF take profit target
 * @param {Array} htfFVGs - Array of HTF FVGs
 * @returns {boolean} True if target is within or near any HTF FVG
 */
export function checkIfTargetingHTFFVG(targetPrice, htfFVGs) {
  if (!htfFVGs || htfFVGs.length === 0) return false;

  for (const fvg of htfFVGs) {
    // Check if target is within FVG
    if (targetPrice >= fvg.bottom && targetPrice <= fvg.top) {
      return true;
    }

    // Check if target is near FVG (within 0.5% distance)
    const distanceToBottom = Math.abs((targetPrice - fvg.bottom) / fvg.bottom);
    const distanceToTop = Math.abs((targetPrice - fvg.top) / fvg.top);

    if (distanceToBottom <= 0.005 || distanceToTop <= 0.005) {
      return true;
    }
  }

  return false;
}

/**
 * Dynamically select appropriate HTF timeframe for any LTF
 * @param {string} ltfTimeframe - Lower timeframe (e.g., '15m', '1h')
 * @returns {string} Higher timeframe (e.g., '1h', '4h')
 */
export function getHTFTimeframe(ltfTimeframe) {
  const tfMap = {
    '1m': '5m',    // 5x multiplier
    '5m': '15m',   // 3x multiplier
    '15m': '1h',   // 4x multiplier
    '30m': '2h',   // 4x multiplier
    '1h': '4h',    // 4x multiplier
    '2h': '1d',    // 12x multiplier
    '4h': '1d',    // 6x multiplier
    '1d': '1w',    // 7x multiplier
  };

  return tfMap[ltfTimeframe] || '1d'; // Default to 1d if unknown
}

/**
 * Calculate HTF swing range (high and low)
 * @param {Array} htfCandles - HTF candle data
 * @param {number} lookback - Number of candles to look back
 * @returns {Object} { high, low, range }
 */
export function calculateHTFSwingRange(htfCandles, lookback = 50) {
  if (!htfCandles || htfCandles.length < lookback) {
    return { high: 0, low: 0, range: 0 };
  }

  const recentCandles = htfCandles.slice(-lookback);

  let high = -Infinity;
  let low = Infinity;

  recentCandles.forEach(candle => {
    if (candle.high > high) high = candle.high;
    if (candle.low < low) low = candle.low;
  });

  const range = high - low;

  return { high, low, range };
}

/**
 * Main SMC analyzer that combines all detection methods
 * and generates trading signals
 * @param {Array} candles - Array of kline objects
 * @param {Array} htfCandles - Optional higher timeframe candles for trend filter
 * @returns {Object} Complete SMC analysis with signals
 */
export function analyzeSMC(candles, htfCandles = null, timeframe = null, htf2Candles = null, symbol = null) {
  if (!candles || candles.length < 50) {
    return {
      error: 'Insufficient data',
      signals: []
    };
  }

  // PHASE 16: Ensure symbol is always defined (prevent ReferenceError)
  const symbolName = symbol || null;

  // Build config object for timeframe-adaptive detection
  // Pass timeframe to get 15m adjustments if applicable
  const baseConfig = getCurrentConfig(timeframe);
  const config = baseConfig.scalping?.enableTimeoutExit && timeframe ?
    { ...baseConfig, timeframe } : baseConfig;

  // ===== EXISTING DETECTIONS (with config passed for scalping mode) =====
  const swingPoints = detectSwingPoints(candles, 2, config);
  const fvgsFlat = detectFairValueGaps(candles, config);

  // Transform flat FVG array into structured object for trackFVGMitigation
  const fvgs = {
    bullish: fvgsFlat.filter(f => f.type === 'bullish'),
    bearish: fvgsFlat.filter(f => f.type === 'bearish')
  };

  const orderBlocks = detectOrderBlocks(candles, null, config);
  const structure = analyzeMarketStructure(swingPoints);
  const liquiditySweeps = detectLiquiditySweeps(candles, swingPoints, config);
  const bmsEvents = detectBreakOfStructure(candles, structure);

  // ===== NEW ENHANCED DETECTIONS =====
  const chochEvents = detectChangeOfCharacter(candles, structure);
  const { bos, bms } = distinguishBOSvsBMS(candles, structure);
  const externalLiquidity = detectExternalLiquidity(swingPoints);
  const internalLiquidity = detectInternalLiquidity(candles, swingPoints);
  const inducement = detectEnhancedInducementZones(candles, structure, orderBlocks, fvgs, bos, swingPoints);
  const volumeAnalysis = analyzeVolume(candles);
  const mitigatedFVGs = trackFVGMitigation(fvgs, candles);
  const breakerBlocks = detectBreakerBlocks(orderBlocks, candles);
  const latestCandle = candles[candles.length - 1];
  const premiumDiscount = calculatePremiumDiscount(candles, swingPoints, latestCandle.close);

  // ===== DETECT HIGHER TIMEFRAME TREND =====
  const htfTrend = htfCandles ? detectHigherTimeframeTrend(htfCandles) : 'neutral';

  // ===== MULTI-TIMEFRAME CONFLUENCE (User's methodology - UPDATED) =====
  // For 15m trading: Check ONLY 1h trend (not 4h - too slow for 15m)
  // User's updated instruction: "for 15 mins dont check 4h only check 1h trend"
  let htf2Trend = null;
  let multiTimeframeConsensus = null;

  if (timeframe === '15m') {
    // For 15m: Use 1h trend directly as consensus
    multiTimeframeConsensus = htfTrend; // 'bullish', 'bearish', or 'neutral'

    // Still detect 4h trend if data available (for reference/display only)
    if (htf2Candles) {
      htf2Trend = detectHigherTimeframeTrend(htf2Candles);
    }
  }

  // ===== NEW: DETECT ALL HTF PATTERNS FOR CONFLUENCE =====
  let htfData = null;
  if (htfCandles && htfCandles.length > 0) {
    htfData = {
      trend: htfTrend,
      htf2Trend: htf2Trend, // Second HTF trend for 15m
      multiTimeframeConsensus: multiTimeframeConsensus, // Consensus of both HTFs
      orderBlocks: detectHTFOrderBlocks(htfCandles),
      fvgs: detectHTFFairValueGaps(htfCandles),
      zones: analyzeHTFPremiumDiscount(htfCandles),
      structure: detectHTFStructureBreak(htfCandles)
    };
  }

  // ===== MARKET REGIME DETECTION (FILTER CHOPPY MARKETS) =====
  const marketRegime = detectMarketRegime(candles);

  // ===== GENERATE SIGNALS WITH ALL DATA =====
  const signals = generateSignals({
    candles,
    swingPoints,
    fvgs: mitigatedFVGs, // Use tracked FVGs with mitigation status
    orderBlocks,
    structure,
    liquiditySweeps,
    bmsEvents,
    // NEW PARAMETERS
    chochEvents,
    bos,
    bms,
    externalLiquidity,
    internalLiquidity,
    inducement,
    volumeAnalysis,
    breakerBlocks,
    premiumDiscount,
    htfTrend, // Multi-timeframe confirmation
    htfData, // NEW: HTF patterns for confluence scoring
    htfCandles, // HTF candles for trend strength calculation
    multiTimeframeConsensus, // User's methodology: Both 1h AND 4h must agree
    config, // Pass config for scalping mode
    marketRegime // REGIME FILTER: Filter choppy/ranging markets
  }, timeframe, symbol); // PHASE 16: Pass symbol for correlation detection

  // ===== RETURN ALL DATA =====
  return {
    // Existing returns
    swingPoints,
    fvgs: mitigatedFVGs, // Return tracked FVGs
    orderBlocks,
    structure,
    liquiditySweeps,
    bmsEvents,
    signals,
    // NEW RETURNS
    chochEvents,
    bos,
    bms,
    externalLiquidity,
    internalLiquidity,
    inducement,
    volumeAnalysis,
    breakerBlocks,
    premiumDiscount,
    marketRegime // REGIME FILTER: Return for UI display
  };
}

/**
 * ============================================================================
 * INDUCEMENT VALIDATION (For Signal Filtering)
 * ============================================================================
 */

/**
 * Prioritizes inducements by type, strength, and recency
 * Returns the highest priority inducement from an array
 *
 * @param {Array} inducements - Array of inducement objects
 * @returns {Object} Highest priority inducement
 */
function prioritizeInducements(inducements) {
  if (!inducements || inducements.length === 0) return null;
  if (inducements.length === 1) return inducements[0];

  // Priority order (highest to lowest)
  const typePriority = {
    'first_pullback_inducement': 5,
    // 'supply_demand_inducement': 4, // REMOVED: 7.1% win rate pattern
    'consolidation_inducement': 3,
    'premature_reversal_inducement': 2,
    'inducement': 1
  };

  const sorted = [...inducements].sort((a, b) => {
    // 1. Sort by type priority
    const priorityDiff = (typePriority[b.type] || 0) - (typePriority[a.type] || 0);
    if (priorityDiff !== 0) return priorityDiff;

    // 2. Sort by strength
    const strengthValue = { strong: 3, moderate: 2, weak: 1 };
    const strengthDiff = (strengthValue[b.strength] || 0) - (strengthValue[a.strength] || 0);
    if (strengthDiff !== 0) return strengthDiff;

    // 3. Sort by recency (most recent first)
    const aIndex = a.candle?.index || a.reversalCandle?.index || 0;
    const bIndex = b.candle?.index || b.reversalCandle?.index || 0;
    return bIndex - aIndex;
  });

  return sorted[0]; // Return highest priority
}

/**
 * Validates inducement position relative to entry price
 * Implements "No inducement, no trade" rule from PDF
 *
 * For bullish signals: inducement must be BELOW entry (0.8-3.0 ATR distance)
 * For bearish signals: inducement must be ABOVE entry
 * Rejects signals that would enter AT inducement zones (retail traps)
 *
 * @param {number} entry - Entry price
 * @param {string} direction - 'bullish' or 'bearish'
 * @param {Object} inducementZones - All detected inducements
 * @param {Array} candles - Array of candle objects
 * @param {number} atr - Average True Range
 * @returns {Object} { valid, reason, inducementFound }
 */
function validateInducementPosition(entry, direction, inducementZones, candles, atr) {
  if (!inducementZones || !entry || !direction || !atr) {
    return {
      valid: false,
      reason: 'missing_parameters',
      inducementFound: null
    };
  }

  const relevantInducements = inducementZones[direction]; // bullish or bearish

  if (!relevantInducements || relevantInducements.length === 0) {
    return {
      valid: false,
      reason: 'no_inducement_found',
      inducementFound: null
    };
  }

  // Define distance thresholds
  const minDistance = atr * 0.8;
  const maxDistance = atr * 3.0;

  // For BULLISH signals: Inducement must be BELOW entry
  if (direction === 'bullish') {
    const validInducements = relevantInducements.filter(ind => {
      const distance = entry - ind.inducementLevel;
      const isBelow = distance > 0;
      const isReasonableDistance = distance >= minDistance && distance <= maxDistance;
      return isBelow && isReasonableDistance;
    });

    if (validInducements.length === 0) {
      // Check if entry IS AT inducement zone (reject - retail trap)
      const atInducement = relevantInducements.some(ind => {
        const distance = Math.abs(entry - ind.inducementLevel);
        return distance < (atr * 0.5); // Too close = AT inducement
      });

      if (atInducement) {
        return {
          valid: false,
          reason: 'entry_at_inducement_zone',
          inducementFound: null
        };
      }

      return {
        valid: false,
        reason: 'inducement_not_below_entry',
        inducementFound: null
      };
    }

    // Return strongest inducement (prioritize by type and recency)
    const strongest = prioritizeInducements(validInducements);
    return {
      valid: true,
      reason: 'inducement_validated',
      inducementFound: strongest
    };
  }

  // For BEARISH signals: Inducement must be ABOVE entry
  if (direction === 'bearish') {
    const validInducements = relevantInducements.filter(ind => {
      const distance = ind.inducementLevel - entry;
      const isAbove = distance > 0;
      const isReasonableDistance = distance >= minDistance && distance <= maxDistance;
      return isAbove && isReasonableDistance;
    });

    if (validInducements.length === 0) {
      const atInducement = relevantInducements.some(ind => {
        const distance = Math.abs(entry - ind.inducementLevel);
        return distance < (atr * 0.5);
      });

      if (atInducement) {
        return {
          valid: false,
          reason: 'entry_at_inducement_zone',
          inducementFound: null
        };
      }

      return {
        valid: false,
        reason: 'inducement_not_above_entry',
        inducementFound: null
      };
    }

    const strongest = prioritizeInducements(validInducements);
    return {
      valid: true,
      reason: 'inducement_validated',
      inducementFound: strongest
    };
  }

  return { valid: false, reason: 'invalid_direction', inducementFound: null };
}

/**
 * Formats inducement type into user-friendly pattern name
 * @param {Object} inducement - Inducement object
 * @returns {string} Formatted pattern name
 */
function formatInducementPattern(inducement) {
  if (!inducement) return null;

  const typeLabels = {
    'inducement': 'Inducement (Stop Hunt)',
    // 'supply_demand_inducement': 'Zone Inducement (OB/FVG Violation)', // REMOVED: 7.1% win rate
    'consolidation_inducement': 'Power of 3 (Both Sides Swept)',
    'premature_reversal_inducement': 'Premature Reversal',
    'first_pullback_inducement': 'First Pullback (Post-BOS)'
  };

  return typeLabels[inducement.type] || 'Inducement';
}

/**
 * Gets detailed description of inducement type
 * @param {Object} inducement - Inducement object
 * @returns {string} Description
 */
function getInducementDescription(inducement) {
  if (!inducement) return null;

  const descriptions = {
    'inducement': 'Fake breakout/breakdown detected. Stop hunt completed, reversal in progress.',
    'supply_demand_inducement': 'OB/FVG zone was violated then price reversed. Classic inducement trap.',
    'consolidation_inducement': 'Power of 3 pattern: Accumulation → Manipulation (both sides swept) → Distribution.',
    'premature_reversal_inducement': 'Weak reversal zone with low confluence. Expect deeper move to valid zone.',
    'first_pullback_inducement': 'First pullback after BOS. Likely to be violated before reaching deeper zone.'
  };

  return descriptions[inducement.type] || 'Inducement pattern detected.';
}

/**
 * Detects bullish/bearish rejection patterns (candlestick confirmations)
 * Implements SMC principle: "Wait for retest → enter on rejection"
 *
 * @param {Object} candle - Current candle to analyze
 * @param {Object} prevCandle - Previous candle
 * @param {string} direction - 'bullish' or 'bearish'
 * @returns {Object} { hasRejection, pattern, strength }
 */
function detectRejectionPattern(candle, prevCandle, direction) {
  if (!candle || !prevCandle) {
    return { hasRejection: false, pattern: null, strength: 0 };
  }

  const candleRange = candle.high - candle.low;
  const candleBody = Math.abs(candle.close - candle.open);
  const bodyToRange = candleBody / candleRange;

  if (direction === 'bullish') {
    // Bullish rejection patterns

    // 1. Hammer/Pin Bar (long lower wick, small body at top)
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const wickRatio = lowerWick / candleRange;
    const bodyPosition = (candle.close - candle.low) / candleRange;

    const isHammer = wickRatio > 0.6 && bodyPosition > 0.6 && candleRange / candle.close > 0.015;

    // 2. Bullish Engulfing (current candle engulfs previous bearish candle)
    const isBullishEngulfing = candle.close > prevCandle.open &&
                               candle.open < prevCandle.close &&
                               candle.close > prevCandle.high &&
                               candle.close > candle.open;

    // 3. Strong Bullish Close (closes in top 25% of range after testing lows)
    const strongClose = bodyPosition > 0.75 && wickRatio > 0.4 && candle.close > candle.open;

    // 4. Inverse Hammer (long upper wick rejected, then closed bullish)
    const isInverseHammer = upperWick / candleRange > 0.5 &&
                            candle.close > candle.open &&
                            bodyPosition < 0.4;

    if (isHammer) {
      return { hasRejection: true, pattern: 'hammer', strength: 3 };
    } else if (isBullishEngulfing) {
      return { hasRejection: true, pattern: 'bullish_engulfing', strength: 3 };
    } else if (strongClose) {
      return { hasRejection: true, pattern: 'strong_bullish_close', strength: 2 };
    } else if (isInverseHammer) {
      return { hasRejection: true, pattern: 'inverse_hammer', strength: 1 };
    }

  } else if (direction === 'bearish') {
    // Bearish rejection patterns

    // 1. Shooting Star/Inverted Hammer (long upper wick, small body at bottom)
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const wickRatio = upperWick / candleRange;
    const bodyPosition = (candle.high - candle.close) / candleRange;

    const isShootingStar = wickRatio > 0.6 && bodyPosition > 0.6 && candleRange / candle.close > 0.015;

    // 2. Bearish Engulfing (current candle engulfs previous bullish candle)
    const isBearishEngulfing = candle.close < prevCandle.open &&
                               candle.open > prevCandle.close &&
                               candle.close < prevCandle.low &&
                               candle.close < candle.open;

    // 3. Strong Bearish Close (closes in bottom 25% of range after testing highs)
    const strongClose = bodyPosition > 0.75 && wickRatio > 0.4 && candle.close < candle.open;

    // 4. Hammer Rejection (long lower wick, but bearish close)
    const isHammerRejection = lowerWick / candleRange > 0.5 &&
                              candle.close < candle.open &&
                              bodyPosition < 0.4;

    if (isShootingStar) {
      return { hasRejection: true, pattern: 'shooting_star', strength: 3 };
    } else if (isBearishEngulfing) {
      return { hasRejection: true, pattern: 'bearish_engulfing', strength: 3 };
    } else if (strongClose) {
      return { hasRejection: true, pattern: 'strong_bearish_close', strength: 2 };
    } else if (isHammerRejection) {
      return { hasRejection: true, pattern: 'hammer_rejection', strength: 1 };
    }
  }

  return { hasRejection: false, pattern: null, strength: 0 };
}

/**
 * Generates trading signals based on SMC pattern confluence
 * @param {Object} analysis - Combined analysis from all detectors
 * @returns {Array} Array of trading signal objects
 */
/**
 * ============================================================================
 * ENHANCED SIGNAL GENERATION
 * ============================================================================
 */

function generateSignals(analysis, timeframe = null, symbol = null) {
  const signals = [];

  // PHASE 16: Define symbolName for correlation detection
  const symbolName = symbol || null;
  const {
    candles,
    swingPoints,
    fvgs,
    orderBlocks,
    structure,
    liquiditySweeps,
    bmsEvents,
    // NEW PARAMETERS (optional for backward compatibility)
    chochEvents = { bullish: [], bearish: [] },
    bos = { bullish: [], bearish: [] },
    bms = { bullish: [], bearish: [] },
    externalLiquidity = { buyLiquidity: [], sellLiquidity: [] },
    internalLiquidity = [],
    inducement = { bullish: [], bearish: [] },
    volumeAnalysis = null,
    breakerBlocks = { bullish: [], bearish: [] },
    premiumDiscount = null,
    htfTrend = 'neutral', // Higher timeframe trend for multi-timeframe confirmation
    htfData = null, // NEW: HTF patterns for confluence scoring
    htfCandles = null, // HTF candles for trend strength calculation
    multiTimeframeConsensus = null, // User's methodology: Both HTFs must agree (15m only)
    marketRegime = null, // REGIME FILTER: Market regime analysis
    config: passedConfig = null // Config passed from analyzeSMC
  } = analysis;

  // Get strategy configuration FIRST (use passed config if available)
  const config = passedConfig || getCurrentConfig();

  // PREPROCESSING: Calculate all enhanced data
  const latestCandle = candles[candles.length - 1];

  // Calculate premium/discount zones (if not provided)
  const zoneAnalysis = premiumDiscount || calculatePremiumDiscount(candles, swingPoints, latestCandle.close);

  // Analyze volume (if not provided)
  const volumeData = volumeAnalysis || analyzeVolume(candles);

  // Use the FVGs passed in (already mitigated in analyzeSMC)
  const mitigatedFVGs = fvgs; // Already tracked, don't call trackFVGMitigation again!

  // Calculate ATR for stops
  const atr = calculateATR(candles, 14);

  // ===== ENTRY TIMING HELPER FUNCTIONS =====
  /**
   * Check if price is currently within an Order Block zone
   */
  const isPriceInOBZone = (price, ob) => {
    return price >= ob.bottom && price <= ob.top;
  };

  /**
   * Detect bullish rejection pattern on latest candle
   * Returns true if candle shows strong bullish rejection
   */
  const isBullishRejection = (candle, prevCandle) => {
    const body = Math.abs(candle.close - candle.open);
    const upperWick = candle.high - Math.max(candle.close, candle.open);
    const lowerWick = Math.min(candle.close, candle.open) - candle.low;
    const totalRange = candle.high - candle.low;

    if (totalRange === 0) return false;

    // Bullish candle (close > open)
    const isBullish = candle.close > candle.open;

    // Pattern 1: Hammer (long lower wick, small body, small upper wick)
    const isHammer = lowerWick > body * 2 && upperWick < body && isBullish;

    // Pattern 2: Bullish Engulfing
    const isBullishEngulfing = prevCandle &&
                                candle.close > prevCandle.open &&
                                candle.open < prevCandle.close &&
                                isBullish &&
                                body > (prevCandle.high - prevCandle.low) * 0.7;

    // Pattern 3: Strong bullish candle with rejection (lower wick > 40% of range)
    const hasLowerWickRejection = lowerWick / totalRange > 0.4 && isBullish;

    return isHammer || isBullishEngulfing || hasLowerWickRejection;
  };

  /**
   * Detect bearish rejection pattern on latest candle
   * Returns true if candle shows strong bearish rejection
   */
  const isBearishRejection = (candle, prevCandle) => {
    const body = Math.abs(candle.close - candle.open);
    const upperWick = candle.high - Math.max(candle.close, candle.open);
    const lowerWick = Math.min(candle.close, candle.open) - candle.low;
    const totalRange = candle.high - candle.low;

    if (totalRange === 0) return false;

    // Bearish candle (close < open)
    const isBearish = candle.close < candle.open;

    // Pattern 1: Shooting Star (long upper wick, small body, small lower wick)
    const isShootingStar = upperWick > body * 2 && lowerWick < body && isBearish;

    // Pattern 2: Bearish Engulfing
    const isBearishEngulfing = prevCandle &&
                                candle.close < prevCandle.open &&
                                candle.open > prevCandle.close &&
                                isBearish &&
                                body > (prevCandle.high - prevCandle.low) * 0.7;

    // Pattern 3: Strong bearish candle with rejection (upper wick > 40% of range)
    const hasUpperWickRejection = upperWick / totalRange > 0.4 && isBearish;

    return isShootingStar || isBearishEngulfing || hasUpperWickRejection;
  };

  /**
   * Check directional confirmation for entry (SCALPING MODE FEATURE)
   * This function ELIMINATED 63.5% of quick stop-outs in backtesting
   * Returns true only if candle confirms the expected direction
   */
  const checkDirectionalConfirmation = (candle, prevCandle, direction) => {
    if (!candle || !prevCandle) {
      return { confirmed: false, strength: 'none', reason: 'Insufficient candles' };
    }

    const body = Math.abs(candle.close - candle.open);
    const lowerWick = Math.min(candle.close, candle.open) - candle.low;
    const upperWick = candle.high - Math.max(candle.close, candle.open);
    const totalRange = candle.high - candle.low;

    if (totalRange === 0) {
      return { confirmed: false, strength: 'none', reason: 'No price range' };
    }

    if (direction === 'bullish') {
      const isBullish = candle.close > candle.open;
      const bodyRatio = body / totalRange;
      const lowerWickRatio = lowerWick / totalRange;

      // Strong: Bullish candle >60% body + rejection wick
      const strongConfirmation = isBullish && bodyRatio > 0.6 && lowerWickRatio > 0.2;

      // Moderate: Bullish candle OR rejection pattern
      const moderateConfirmation = isBullish || isBullishRejection(candle, prevCandle);

      const hasUpwardMomentum = candle.close > prevCandle.close;

      if (strongConfirmation && hasUpwardMomentum) {
        return { confirmed: true, strength: 'strong', reason: 'Strong bullish momentum' };
      } else if (moderateConfirmation && hasUpwardMomentum) {
        return { confirmed: true, strength: 'moderate', reason: 'Bullish directional' };
      }
    } else if (direction === 'bearish') {
      const isBearish = candle.close < candle.open;
      const bodyRatio = body / totalRange;
      const upperWickRatio = upperWick / totalRange;

      // Strong: Bearish candle >60% body + rejection wick
      const strongConfirmation = isBearish && bodyRatio > 0.6 && upperWickRatio > 0.2;

      // Moderate: Bearish candle OR rejection pattern
      const moderateConfirmation = isBearish || isBearishRejection(candle, prevCandle);

      const hasDownwardMomentum = candle.close < prevCandle.close;

      if (strongConfirmation && hasDownwardMomentum) {
        return { confirmed: true, strength: 'strong', reason: 'Strong bearish momentum' };
      } else if (moderateConfirmation && hasDownwardMomentum) {
        return { confirmed: true, strength: 'moderate', reason: 'Bearish directional' };
      }
    }

    return { confirmed: false, strength: 'none', reason: 'No confirmation' };
  };

  // Get recent patterns
  // NOTE: fvgs (mitigatedFVGs) has structure: { unfilled: {bullish:[], bearish:[]}, touched: {...}, partial: {...}, filled: {...} }
  // In moderate/aggressive mode, we accept touched and partial FVGs
  const includeTouchedFVGs = !config.requireAllConfirmations; // Moderate/Aggressive modes

  const allBullishFVGs = includeTouchedFVGs ? [
    ...(mitigatedFVGs.unfilled?.bullish || []),
    ...(mitigatedFVGs.touched?.bullish || []),
    ...(mitigatedFVGs.partial?.bullish || [])
  ] : [
    ...(mitigatedFVGs.unfilled?.bullish || [])
  ];

  const allBearishFVGs = includeTouchedFVGs ? [
    ...(mitigatedFVGs.unfilled?.bearish || []),
    ...(mitigatedFVGs.touched?.bearish || []),
    ...(mitigatedFVGs.partial?.bearish || [])
  ] : [
    ...(mitigatedFVGs.unfilled?.bearish || [])
  ];

  // Moderate mode uses wider lookback windows for more signals
  // For FVGs: if unfilled, they're valid regardless of age (no recency filter in moderate mode)
  const fvgLookback = config.requireAllConfirmations ? 10 : Infinity; // Conservative: recent only, Moderate: all unfilled
  const sweepLookback = config.requireAllConfirmations ? 5 : 15; // Conservative: 5, Moderate: 15

  const recentBullishFVG = fvgLookback === Infinity ? allBullishFVGs : allBullishFVGs.filter(f => f.index >= candles.length - fvgLookback);
  const recentBullishOB = orderBlocks.bullish ? orderBlocks.bullish.filter(ob => ob.index >= candles.length - 20) : [];
  const recentBullishSweep = liquiditySweeps.filter(s => s.direction === 'bullish' && s.index >= candles.length - sweepLookback);
  const recentBullishBMS = bmsEvents.filter(b => b.type === 'bullish' && b.index >= candles.length - sweepLookback);
  const recentBullishBreaker = breakerBlocks.bullish || [];

  const recentBearishFVG = fvgLookback === Infinity ? allBearishFVGs : allBearishFVGs.filter(f => f.index >= candles.length - fvgLookback);
  const recentBearishOB = orderBlocks.bearish ? orderBlocks.bearish.filter(ob => ob.index >= candles.length - 20) : [];
  const recentBearishSweep = liquiditySweeps.filter(s => s.direction === 'bearish' && s.index >= candles.length - sweepLookback);
  const recentBearishBMS = bmsEvents.filter(b => b.type === 'bearish' && b.index >= candles.length - sweepLookback);
  const recentBearishBreaker = breakerBlocks.bearish || [];

  // ========================================================================
  // BULLISH SIGNAL GENERATION
  // ========================================================================

  // DEBUG

  // FILTER: Zone check based on strategy mode
  // In aggressive mode with very low confluence (25), allow signals in any zone
  const validZoneForBullish = config.minimumConfluence <= 25
    ? true // Aggressive: any zone
    : config.allowNeutralZone
      ? (zoneAnalysis.zone === 'discount' || zoneAnalysis.zone === 'neutral')
      : zoneAnalysis.zone === 'discount';


  if (validZoneForBullish) {
    // Prefer breaker blocks over regular OBs
    const bullishOB = recentBullishBreaker.length > 0 ? recentBullishBreaker[0] : recentBullishOB[0];

    // DEBUG
    if (!bullishOB && recentBullishOB.length === 0) {
    }

    if (bullishOB) {

      // Check confirmations based on strategy mode
      const hasLiquiditySweep = recentBullishSweep.length > 0;
      const hasBOS = bos.bullish.length > 0;
      const hasFVG = recentBullishFVG.length > 0; // Use recent FVGs (includes touched/partial in moderate mode)
      const hasValidZone = validZoneForBullish;


      // Determine if confirmations pass based on strategy
      let confirmationsPassed = false;

      if (config.requireAllConfirmations) {
        // Conservative: ALL required confirmations must be present
        const allRequired = config.requiredConfirmations.every(conf => {
          if (conf === 'liquiditySweep') return hasLiquiditySweep;
          if (conf === 'bos') return hasBOS;
          if (conf === 'fvg') return hasFVG;
          if (conf === 'validZone') return hasValidZone;
          return false;
        });
        confirmationsPassed = allRequired;
      } else {
        // Moderate/Aggressive: Core required + optional bonuses
        const requiredPassed = config.requiredConfirmations.every(conf => {
          if (conf === 'bos') return hasBOS;
          if (conf === 'fvg') return hasFVG;
          if (conf === 'validZone') return hasValidZone;
          return false;
        });
        confirmationsPassed = requiredPassed;
        // Liquidity sweep is optional (adds bonus points but not required)
      }


      if (confirmationsPassed) {
        // Calculate OTE for this setup
        const ote = calculateOTE(
          structure.lastSwingHigh?.price || latestCandle.high,
          structure.lastSwingLow?.price || latestCandle.low,
          latestCandle.close,
          'bullish'
        );

        // ===== ENTRY CALCULATION =====
        let entry;
        let entryTiming;
        let validEntry = false;

        if (config.requireBOSConfirmation) {
          // Conservative: Only enter on Break of Structure confirmation
          // Find BOS that occurred AFTER OB formation
          const bosAfterOB = bos.bullish.find(b => {
            const bosIndex = candles.findIndex(c => c.timestamp === b.timestamp);
            const obIndex = candles.findIndex(c => c.timestamp === bullishOB.timestamp);
            // BOS must be after OB and within last 10 candles for recent confirmation
            return bosIndex > obIndex && bosIndex >= candles.length - config.bosLookback;
          });

          if (bosAfterOB) {
            // Entry at BOS break level (structure break price)
            entry = bosAfterOB.breakLevel;
            entryTiming = {
              status: 'confirmed',
              bosConfirmed: true,
              confirmationCandle: bosAfterOB.timestamp,
              confirmationType: 'BOS'
            };
            validEntry = true;
          }
        } else {
          // Moderate/Aggressive: Entry based on OB retest WITH rejection
          // Step 1: Check if price is INSIDE the OB zone (better entry quality)
          // ENHANCED: Tightened tolerance from 0.5% to 0.2% (1.005/0.995 → 1.002/0.998)
          const priceInOB = latestCandle.low <= bullishOB.top * 1.002 &&
                            latestCandle.high >= bullishOB.bottom * 0.998;

          // Step 2: Detect rejection pattern (REQUIRED for entry)
          const prevCandle = candles[candles.length - 2];
          const rejectionCheck = detectRejectionPattern(latestCandle, prevCandle, 'bullish');

          // Step 3: BALANCED - Prefer rejection but allow without it at higher confluence
          if (priceInOB) {
            if (rejectionCheck.hasRejection) {
              // BEST: Enter at OB BOTTOM with rejection confirmation
              entry = bullishOB.bottom;
              entryTiming = {
                status: 'ob_rejection',
                bosConfirmed: false,
                confirmationType: 'REJECTION',
                rejectionPattern: rejectionCheck.pattern,
                rejectionStrength: rejectionCheck.strength,
                hasRejectionBonus: true
              };
              validEntry = true;
            } else {
              // ALTERNATIVE: Enter without rejection but needs higher confluence (checked later)
              entry = bullishOB.bottom;
              entryTiming = {
                status: 'ob_retest',
                bosConfirmed: false,
                confirmationType: 'OB_RETEST',
                hasRejectionBonus: false,
                requiresExtraConfluence: true // Signal: needs +15 confluence to pass
              };
              validEntry = true;
            }
          }
        }

        // ===== INDUCEMENT VALIDATION (NEW) =====
        let validInducement = null;
        if (validEntry) {
          const inducementValidation = validateInducementPosition(
            entry,
            'bullish',
            inducement,
            candles,
            atr
          );

          // ONLY reject if entry is AT an inducement zone (retail trap)
          // Otherwise, inducement is optional but adds confluence
          if (inducementValidation.reason === 'entry_at_inducement_zone') {
            validEntry = false; // Retail trap - reject
          } else if (inducementValidation.valid) {
            validInducement = inducementValidation.inducementFound;
          }
          // If no inducement found, continue (it's optional)
        }

        // Multi-timeframe filter: DISABLED (neutral performs better than with-trend)
        // Data showed: With-trend 28.2% WR vs Neutral 33.7% WR
        // HTF trend detection is lagging - by the time trend is identified, it's reversing
        // Reversal trades in neutral conditions are more profitable than continuation
        // if (validEntry && htfTrend === 'bearish') {
        //   validEntry = false;
        // }

        // ===== USER'S METHODOLOGY: Multi-timeframe directional filter (15m only) =====
        // For 15m: Check 1h trend only (user's updated instruction)
        // If 1h bullish → LONG trades only
        // If 1h bearish → SHORT trades only (block LONGs)
        // If 1h neutral → allow both (be selective)
        if (validEntry && multiTimeframeConsensus) {
          if (multiTimeframeConsensus === 'bearish') {
            // 1h bearish → Block bullish (LONG) entries
            validEntry = false;
          }
          // If 'bullish', allow LONG trades (current signal is bullish)
          // If 'neutral', allow LONG trades but be selective
        }

        if (validEntry) {

        // ===== STOP LOSS CALCULATION (PHASE 14: Adaptive) =====
        const adaptiveSL = calculateAdaptiveStopLoss(candles, atr);
        const stopMultiplier = adaptiveSL?.multiplier || config.stopLossATRMultiplier;
        const buffer = atr * stopMultiplier;
        let stopLoss = bullishOB.bottom - buffer;

        // Check for liquidity below OB - place stop BEYOND liquidity zone
        // Liquidity sweeps are BULLISH for our trade (smart money absorbing)
        const liquidityBelow = externalLiquidity.buyLiquidity.find(
          liq => liq.price < bullishOB.bottom && liq.price > bullishOB.bottom - (atr * 3)
        );

        if (liquidityBelow) {
          // Place stop BELOW the liquidity zone, allowing sweep to happen WITHOUT hitting our stop
          stopLoss = liquidityBelow.price - (buffer * 2.0);
        }

        // Natural stop placement (removed 3% max risk cap - use position sizing for risk management)

        // ===== TAKE PROFIT CALCULATION =====
        let takeProfit;
        let takeProfitReasoning;
        const minRiskDistance = Math.abs(entry - stopLoss);
        const minRewardDistance = minRiskDistance * config.minimumRiskReward;

        // First choice: External liquidity (but must meet minimum R:R)
        const targetLiquidity = externalLiquidity.sellLiquidity.find(
          liq => liq.price > entry && liq.strength !== 'weak' && (liq.price - entry) >= minRewardDistance
        );

        if (targetLiquidity) {
          takeProfit = targetLiquidity.price - (atr * 0.15); // OPTIMIZED: 0.3 → 0.15 (closer to target)
          takeProfitReasoning = `Targeting sell-side liquidity at ${targetLiquidity.price.toFixed(8)}`;
        } else {
          // Second choice: Next swing high (but must meet minimum R:R)
          const nextStructure = findNearestStructure(candles, swingPoints, 'bullish');
          if (nextStructure && (nextStructure.price - entry) >= minRewardDistance) {
            takeProfit = nextStructure.price - (atr * 0.15); // OPTIMIZED: 0.3 → 0.15 (closer to target)
            takeProfitReasoning = `Targeting next swing high at ${nextStructure.price.toFixed(8)}`;
          } else {
            // Fallback: Use minimum R:R
            takeProfit = entry + minRewardDistance;
            takeProfitReasoning = `${config.minimumRiskReward}:1 RR (no valid structure target)`;
          }
        }

        // Validate minimum RR
        const riskReward = (takeProfit - entry) / (entry - stopLoss);

        if (riskReward >= config.minimumRiskReward) {
          // Only proceed if R:R is acceptable

        // ===== CONFLUENCE SCORING (Using strategy config weights) =====
        let confluenceScore = 0;

        // PHASE 13: Break-and-retest pattern detection for BULLISH signals
        const breakRetest = detectBreakAndRetest(candles, bullishOB, 'bullish');
        if (breakRetest.hasBreakRetest) {
          confluenceScore += breakRetest.strength; // +10 to +20 points for break-retest pattern
        }

        // PHASE 15: Volume divergence detection for BULLISH signals
        const volumeDivergence = detectVolumeDivergence(candles, 'long');
        if (volumeDivergence.hasDivergence) {
          confluenceScore += volumeDivergence.strength; // +10 to +15 points for smart money accumulation
        }

        // PHASE 11: Session-based filtering for optimal trading times
        const sessionQuality = analyzeSessionQuality(latestCandle.timestamp);
        if (!sessionQuality.shouldTrade) {
          // Dead zone (02:00-06:00 UTC) - skip this signal entirely
          validEntry = false;
        } else {
          // Add session confluence bonus
          confluenceScore += sessionQuality.confluenceBonus; // +0 to +15 points based on session
        }

        // Apply weights from strategy config
        if (hasFVG) confluenceScore += config.confluenceWeights.fvg;
        if (hasLiquiditySweep) confluenceScore += config.confluenceWeights.liquiditySweep;
        if (hasBOS) confluenceScore += config.confluenceWeights.bos;

        // Zone scoring
        if (zoneAnalysis.zone === 'discount') {
          confluenceScore += config.confluenceWeights.validZone;
        } else if (zoneAnalysis.zone === 'neutral' && config.allowNeutralZone) {
          confluenceScore += config.confluenceWeights.neutralZone || config.neutralZoneScore;
        }

        // Volume confirmation
        if (volumeData.confirmation === 'strong') confluenceScore += config.confluenceWeights.volume;
        else if (volumeData.confirmation === 'moderate') confluenceScore += Math.floor(config.confluenceWeights.volume * 0.67);

        // OTE
        if (ote.currentPriceInOTE) confluenceScore += config.confluenceWeights.ote;

        // Bonus factors
        if (recentBullishBreaker.length > 0) confluenceScore += config.confluenceWeights.breakerBlock;
        if (recentBullishBMS.length > 0) confluenceScore += config.confluenceWeights.bms;

        // ===== INDUCEMENT CONFLUENCE SCORING (NEW) =====
        if (validInducement) {
          let inducementPoints = 0;

          switch (validInducement.type) {
            case 'inducement':
              inducementPoints = config.confluenceWeights.basicInducement || 10;
              break;
            case 'supply_demand_inducement':
              inducementPoints = config.confluenceWeights.supplyDemandInducement || 15;
              break;
            case 'consolidation_inducement':
              inducementPoints = config.confluenceWeights.consolidationInducement || 12;
              break;
            case 'premature_reversal_inducement':
              inducementPoints = config.confluenceWeights.prematureReversalInducement || 8;
              break;
            case 'first_pullback_inducement':
              inducementPoints = config.confluenceWeights.firstPullbackInducement || 15;
              break;
          }

          confluenceScore += inducementPoints;

          // Bonus: Multiple inducements strengthen setup
          if (inducement.bullish && inducement.bullish.length >= 2) {
            confluenceScore += 5;
          }

          // Bonus: Strong inducement with ideal distance
          if (validInducement.strength === 'strong') {
            const distance = Math.abs(entry - validInducement.inducementLevel);
            const distanceATR = distance / atr;
            if (distanceATR >= 1.0 && distanceATR <= 2.0) {
              confluenceScore += 3; // Ideal distance range
            }
          }
        }

        // ===== NEW: HTF CONFLUENCE SCORING =====
        if (htfData) {
          // HTF Order Block alignment (+15 points)
          const isInHTFBullOB = checkIfInHTFOrderBlock(entry, htfData.orderBlocks.bullish);
          if (isInHTFBullOB && config.confluenceWeights.htfOBAlignment) {
            confluenceScore += config.confluenceWeights.htfOBAlignment;
          }

          // HTF FVG targeting (+10 points)
          const targetingHTFFVG = checkIfTargetingHTFFVG(takeProfit, htfData.fvgs.bullish);
          if (targetingHTFFVG && config.confluenceWeights.htfFVGConfluence) {
            confluenceScore += config.confluenceWeights.htfFVGConfluence;
          }

          // HTF Zone alignment (both discount) (+10 points)
          if (htfData.zones.zone === 'discount' &&
              zoneAnalysis.zone === 'discount' &&
              config.confluenceWeights.htfZoneAlignment) {
            confluenceScore += config.confluenceWeights.htfZoneAlignment;
          }

          // HTF Structure alignment (+10 points)
          if (htfData.structure.structure === 'bullish' &&
              config.confluenceWeights.htfStructureAlignment) {
            confluenceScore += config.confluenceWeights.htfStructureAlignment;
          }
        }

        // Assign confidence tier based on strategy minimum
        let confidence;
        if (confluenceScore >= 85) confidence = 'premium';
        else if (confluenceScore >= config.minimumConfluence + 10) confidence = 'high';
        else confidence = 'standard';

        // BALANCED: Require higher confluence without rejection (+15 points)
        const minRequiredConfluence = entryTiming?.requiresExtraConfluence
          ? config.minimumConfluence + 15
          : config.minimumConfluence;

        // ===== MARKET REGIME FILTER =====
        // Adjust confluence based on regime and check if signal should be allowed
        let finalConfluenceScore = confluenceScore;
        let regimeAllowsSignal = true;
        if (marketRegime) {
          finalConfluenceScore = adjustConfluenceForRegime(confluenceScore, marketRegime);

          // Check if regime allows signal (e.g., tight range in conservative mode)
          const modeFromConfig = config.mode || 'moderate'; // Get mode from config
          regimeAllowsSignal = shouldAllowSignal(marketRegime, modeFromConfig);
        }

        if (regimeAllowsSignal && finalConfluenceScore >= minRequiredConfluence) {

        // ===== DIRECTIONAL CONFIRMATION CHECK (SCALPING MODE) =====
        let dirConfirmed = true;
        if (config.requireDirectionalConfirmation) {
          const dirConfirm = checkDirectionalConfirmation(
            latestCandle,
            candles[candles.length - 2],
            'bullish'
          );
          dirConfirmed = dirConfirm.confirmed;
        }

        // ===== CREATE SIGNAL (only if directional confirmation passed) =====
        if (dirConfirmed) {

        // PHASE 17: Calculate multiple take-profit levels
        const multipleTPs = calculateMultipleTakeProfits(entry, stopLoss, takeProfit, 'bullish', atr);

        // PHASE 16: Calculate correlation analysis BEFORE signal object creation (prevents scope issues)
        const symbolCorrelation = (symbolName && typeof symbolName === 'string') ? detectCorrelatedPairs(symbolName) : null;

        signals.push({
          type: 'BUY',
          direction: 'bullish',
          entry: entry,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          riskReward: riskReward,
          confidence: confidence,
          // PHASE 17: Multiple TP levels for partial position closing
          takeProfitLevels: multipleTPs,
          patterns: [
            mitigatedFVGs.unfilled && mitigatedFVGs.unfilled.bullish && mitigatedFVGs.unfilled.bullish.length > 0 ? 'FVG (Unfilled)' : null,
            recentBullishOB.length > 0 ? 'Order Block' : null,
            recentBullishBreaker.length > 0 ? 'Breaker Block' : null,
            recentBullishSweep.length > 0 ? 'Liquidity Sweep' : null,
            recentBullishBMS.length > 0 ? 'BMS (Reversal)' : null,
            validInducement ? formatInducementPattern(validInducement) : null,
            ote.currentPriceInOTE ? 'OTE' : null
          ].filter(p => p !== null),
          timestamp: bullishOB.timestamp, // Use order block's timestamp, not latest candle

          // Pattern details (existing)
          patternDetails: {
            fvg: mitigatedFVGs.unfilled && mitigatedFVGs.unfilled.bullish && mitigatedFVGs.unfilled.bullish.length > 0 ? mitigatedFVGs.unfilled.bullish[0] : null,
            orderBlock: bullishOB,
            liquiditySweep: recentBullishSweep.length > 0 ? recentBullishSweep[0] : null,
            bms: recentBullishBMS.length > 0 ? recentBullishBMS[0] : null
          },

          // Confluence explanation (existing)
          confluenceReason: `Confluence Score: ${finalConfluenceScore}/145 (${confidence.toUpperCase()})`,

          // Risk/reward breakdown (existing)
          riskRewardBreakdown: {
            entry: entry,
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            riskAmount: Math.abs(entry - stopLoss),
            rewardAmount: Math.abs(takeProfit - entry),
            ratio: riskReward,
            stopLossDistance: `${(Math.abs(entry - stopLoss) / entry * 100).toFixed(2)}%`,
            takeProfitDistance: `${(Math.abs(takeProfit - entry) / entry * 100).toFixed(2)}%`,
            reasoning: `Stop loss below OB with ${buffer.toFixed(8)} buffer`
          },

          // NEW FIELDS
          premiumDiscount: {
            zone: zoneAnalysis.zone,
            percentage: zoneAnalysis.percentage,
            inCorrectZone: true,
            equilibrium: zoneAnalysis.equilibrium,
            range: zoneAnalysis.range
          },
          ote: ote.currentPriceInOTE ? ote : null,
          structureAnalysis: {
            chochDetected: chochEvents.bullish.length > 0,
            bosType: bos.bullish.length > 0 ? 'continuation' : null,
            bmsDetected: recentBullishBMS.length > 0,
            bmsType: recentBullishBMS.length > 0 ? 'reversal' : null,
            // Full event data for chart visualization
            chochEvents: chochEvents.bullish.slice(0, 3), // Last 3 ChoCH events
            bosEvents: bos.bullish.slice(0, 3) // Last 3 BOS events
          },
          liquidityAnalysis: {
            externalLiquidity: targetLiquidity || null,
            sweepDetected: recentBullishSweep.length > 0,
            inducementDetected: validInducement !== null,
            inducementType: validInducement?.type || null,
            inducementLevel: validInducement?.inducementLevel || null,
            inducementPosition: validInducement ?
              (validInducement.inducementLevel < entry ? 'below_entry' : 'above_entry') :
              null,
            inducementStrength: validInducement?.strength || null,
            inducementDistance: validInducement ?
              Math.abs(entry - validInducement.inducementLevel) :
              null,
            inducementDistanceATR: validInducement ?
              (Math.abs(entry - validInducement.inducementLevel) / atr).toFixed(2) :
              null,
            inducementDetails: validInducement ? {
              description: getInducementDescription(validInducement),
              candle: validInducement.candle || validInducement.reversalCandle || null,
              timestamp: validInducement.timestamp || validInducement.candle?.timestamp || null,
              zoneType: validInducement.zoneType || null,
              manipulation: validInducement.manipulation || null
            } : null,
            totalInducementsDetected: inducement.bullish?.length || 0,
            allInducements: inducement.bullish ? inducement.bullish.map(ind => ({
              type: ind.type,
              level: ind.inducementLevel,
              strength: ind.strength
            })) : []
          },
          fvgStatus: mitigatedFVGs.unfilled.bullish.length > 0 ? {
            detected: true,
            mitigationStatus: 'unfilled',
            fillPercentage: 0,
            strength: 'strong'
          } : null,
          orderBlockDetails: {
            type: recentBullishBreaker.length > 0 ? 'breakerBlock' : 'orderBlock',
            top: bullishOB.top,
            bottom: bullishOB.bottom,
            strength: bullishOB.strength,
            polarityChange: recentBullishBreaker.length > 0
          },
          volumeAnalysis: volumeData,
          entryTiming: entryTiming,
          confluenceScore: finalConfluenceScore,
          riskManagement: {
            stopLossReasoning: `Below OB with ${buffer.toFixed(8)} buffer`,
            takeProfitReasoning: takeProfitReasoning,
            atrBuffer: buffer,
            maxRiskPercent: 3.0
          },

          // SCALPING MODE CONFIGURATION
          scalpingConfig: config.scalping ? {
            timeoutMinutes: config.scalping.timeoutMinutes[config.timeframe || '5m'],
            trailingStopEnabled: config.scalping.enableTrailingStop,
            partialCloseEnabled: config.scalping.enablePartialClose,
            breakEvenR: config.scalping.breakEvenTriggerR,
            trailingStartR: config.scalping.trailingStartR,
            trailingDistanceR: config.scalping.trailingDistanceR,
            partialCloseR: config.scalping.partialCloseR,
            partialClosePercent: config.scalping.partialClosePercent,
          } : null,

          // HTF TREND (for trend analysis)
          htfTrend: htfTrend,

          // MULTI-TIMEFRAME CONSENSUS (User's methodology: Both 1h AND 4h must agree)
          mtfConsensus: multiTimeframeConsensus,

          // HTF ALIGNMENT FLAGS (for UI display)
          htfAlignment: htfData && timeframe ? {
            hasHTFOB: checkIfInHTFOrderBlock(entry, htfData.orderBlocks.bullish),
            hasHTFFVG: checkIfTargetingHTFFVG(takeProfit, htfData.fvgs.bullish),
            hasHTFZone: htfData.zones.zone === 'discount' && zoneAnalysis.zone === 'discount',
            hasHTFStructure: htfData.structure.structure === 'bullish',
            htfTimeframe: getHTFTimeframe(timeframe)
          } : null,

          // PHASE 14: Volatility state for stop loss adaptation
          volatilityState: adaptiveSL || null,

          // PHASE 16: Correlation detection for risk management
          correlationAnalysis: symbolCorrelation,

          // MARKET REGIME FILTER: ADX-based trend strength analysis
          marketRegime: marketRegime ? {
            regime: marketRegime.regime,
            adx: marketRegime.adx,
            bbWidthPercent: marketRegime.bbWidthPercent,
            action: marketRegime.recommendation.action,
            message: marketRegime.recommendation.message
          } : null
        });
        } // End if (dirConfirmed)
        } // End if (confluenceScore >= 35)
        } // End if (riskReward >= 1.5)
        } // End if (validEntry)
      }
    }
  }

  // ========================================================================
  // BEARISH SIGNAL GENERATION
  // ========================================================================

  // FILTER: Zone check based on strategy mode
  // In aggressive mode with very low confluence (25), allow signals in any zone
  const validZoneForBearish = config.minimumConfluence <= 25
    ? true // Aggressive: any zone
    : config.allowNeutralZone
      ? (zoneAnalysis.zone === 'premium' || zoneAnalysis.zone === 'neutral')
      : zoneAnalysis.zone === 'premium';

  if (validZoneForBearish) {
    // Prefer breaker blocks over regular OBs
    const bearishOB = recentBearishBreaker.length > 0 ? recentBearishBreaker[0] : recentBearishOB[0];

    if (bearishOB) {
      // Check confirmations based on strategy mode
      const hasLiquiditySweep = recentBearishSweep.length > 0;
      const hasBOS = bos.bearish.length > 0;
      const hasFVG = recentBearishFVG.length > 0; // Use recent FVGs (includes touched/partial in moderate mode)
      const hasValidZone = validZoneForBearish;

      // Determine if confirmations pass based on strategy
      let confirmationsPassed = false;

      if (config.requireAllConfirmations) {
        // Conservative: ALL required confirmations must be present
        const allRequired = config.requiredConfirmations.every(conf => {
          if (conf === 'liquiditySweep') return hasLiquiditySweep;
          if (conf === 'bos') return hasBOS;
          if (conf === 'fvg') return hasFVG;
          if (conf === 'validZone') return hasValidZone;
          return false;
        });
        confirmationsPassed = allRequired;
      } else {
        // Moderate/Aggressive: Core required + optional bonuses
        const requiredPassed = config.requiredConfirmations.every(conf => {
          if (conf === 'bos') return hasBOS;
          if (conf === 'fvg') return hasFVG;
          if (conf === 'validZone') return hasValidZone;
          return false;
        });
        confirmationsPassed = requiredPassed;
      }

      if (confirmationsPassed) {
        // Calculate OTE for this setup
        const ote = calculateOTE(
          structure.lastSwingHigh?.price || latestCandle.high,
          structure.lastSwingLow?.price || latestCandle.low,
          latestCandle.close,
          'bearish'
        );

        // ===== ENTRY CALCULATION =====
        let entry;
        let entryTiming;
        let validEntry = false;

        if (config.requireBOSConfirmation) {
          // Conservative: Only enter on Break of Structure confirmation
          // Find BOS that occurred AFTER OB formation
          const bosAfterOB = bos.bearish.find(b => {
            const bosIndex = candles.findIndex(c => c.timestamp === b.timestamp);
            const obIndex = candles.findIndex(c => c.timestamp === bearishOB.timestamp);
            // BOS must be after OB and within last 10 candles for recent confirmation
            return bosIndex > obIndex && bosIndex >= candles.length - config.bosLookback;
          });

          if (bosAfterOB) {
            // Entry at BOS break level (structure break price)
            entry = bosAfterOB.breakLevel;
            entryTiming = {
              status: 'confirmed',
              bosConfirmed: true,
              confirmationCandle: bosAfterOB.timestamp,
              confirmationType: 'BOS'
            };
            validEntry = true;
          }
        } else {
          // Moderate/Aggressive: Entry based on OB retest WITH rejection
          // Step 1: Check if price is INSIDE the OB zone (better entry quality)
          // ENHANCED: Tightened tolerance from 0.5% to 0.2% (0.995/1.005 → 0.998/1.002)
          const priceInOB = latestCandle.high >= bearishOB.bottom * 0.998 &&
                            latestCandle.low <= bearishOB.top * 1.002;

          // Step 2: Detect rejection pattern (REQUIRED for entry)
          const prevCandle = candles[candles.length - 2];
          const rejectionCheck = detectRejectionPattern(latestCandle, prevCandle, 'bearish');

          // Step 3: BALANCED - Prefer rejection but allow without it at higher confluence
          if (priceInOB) {
            if (rejectionCheck.hasRejection) {
              // BEST: Enter at OB TOP with rejection confirmation
              entry = bearishOB.top;
              entryTiming = {
                status: 'ob_rejection',
                bosConfirmed: false,
                confirmationType: 'REJECTION',
                rejectionPattern: rejectionCheck.pattern,
                rejectionStrength: rejectionCheck.strength,
                hasRejectionBonus: true
              };
              validEntry = true;
            } else {
              // ALTERNATIVE: Enter without rejection but needs higher confluence (checked later)
              entry = bearishOB.top;
              entryTiming = {
                status: 'ob_retest',
                bosConfirmed: false,
                confirmationType: 'OB_RETEST',
                hasRejectionBonus: false,
                requiresExtraConfluence: true // Signal: needs +15 confluence to pass
              };
              validEntry = true;
            }
          }
        }

        // ===== INDUCEMENT VALIDATION (NEW) =====
        let validInducement = null;
        if (validEntry) {
          const inducementValidation = validateInducementPosition(
            entry,
            'bearish',
            inducement,
            candles,
            atr
          );

          // ONLY reject if entry is AT an inducement zone (retail trap)
          // Otherwise, inducement is optional but adds confluence
          if (inducementValidation.reason === 'entry_at_inducement_zone') {
            validEntry = false; // Retail trap - reject
          } else if (inducementValidation.valid) {
            validInducement = inducementValidation.inducementFound;
          }
          // If no inducement found, continue (it's optional)
        }

        // Multi-timeframe filter: DISABLED (neutral performs better than with-trend)
        // Data showed: With-trend 28.2% WR vs Neutral 33.7% WR
        // HTF trend detection is lagging - by the time trend is identified, it's reversing
        // Reversal trades in neutral conditions are more profitable than continuation
        // if (validEntry && htfTrend === 'bullish') {
        //   validEntry = false;
        // }

        // ===== USER'S METHODOLOGY: Multi-timeframe directional filter (15m only) =====
        // For 15m: Check 1h trend only (user's updated instruction)
        // If 1h bullish → LONG trades only (block SHORTs)
        // If 1h bearish → SHORT trades only
        // If 1h neutral → allow both (be selective)
        if (validEntry && multiTimeframeConsensus) {
          if (multiTimeframeConsensus === 'bullish') {
            // 1h bullish → Block bearish (SHORT) entries
            validEntry = false;
          }
          // If 'bearish', allow SHORT trades (current signal is bearish)
          // If 'neutral', allow SHORT trades but be selective
        }

        if (validEntry) {

        // ===== STOP LOSS CALCULATION (PHASE 14: Adaptive) =====
        const adaptiveSL = calculateAdaptiveStopLoss(candles, atr);
        // SHORT trades need wider stops (data: 58.9% SL hit rate vs 38.9% for longs)
        const baseMultiplier = adaptiveSL?.multiplier || config.stopLossATRMultiplier;
        const stopMultiplier = baseMultiplier * 1.4; // 40% wider for shorts + adaptive
        const buffer = atr * stopMultiplier;
        let stopLoss = bearishOB.top + buffer;

        // Check for liquidity above OB - place stop BEYOND liquidity zone
        // Liquidity sweeps are BEARISH for our trade (smart money absorbing)
        const liquidityAbove = externalLiquidity.sellLiquidity.find(
          liq => liq.price > bearishOB.top && liq.price < bearishOB.top + (atr * 3)
        );

        if (liquidityAbove) {
          // Place stop ABOVE the liquidity zone, allowing sweep to happen WITHOUT hitting our stop
          stopLoss = liquidityAbove.price + (buffer * 2.0);
        }

        // Natural stop placement (removed 3% max risk cap - use position sizing for risk management)

        // ===== TAKE PROFIT CALCULATION =====
        let takeProfit;
        let takeProfitReasoning;
        const minRiskDistance = Math.abs(stopLoss - entry);
        const minRewardDistance = minRiskDistance * config.minimumRiskReward;

        // First choice: External liquidity (but must meet minimum R:R)
        const targetLiquidity = externalLiquidity.buyLiquidity.find(
          liq => liq.price < entry && liq.strength !== 'weak' && (entry - liq.price) >= minRewardDistance
        );

        if (targetLiquidity) {
          takeProfit = targetLiquidity.price + (atr * 0.15); // OPTIMIZED: 0.3 → 0.15 (closer to target)
          takeProfitReasoning = `Targeting buy-side liquidity at ${targetLiquidity.price.toFixed(8)}`;
        } else {
          // Second choice: Next swing low (but must meet minimum R:R)
          const nextStructure = findNearestStructure(candles, swingPoints, 'bearish');
          if (nextStructure && (entry - nextStructure.price) >= minRewardDistance) {
            takeProfit = nextStructure.price + (atr * 0.15); // OPTIMIZED: 0.3 → 0.15 (closer to target)
            takeProfitReasoning = `Targeting next swing low at ${nextStructure.price.toFixed(8)}`;
          } else {
            // Fallback: Use minimum R:R
            takeProfit = entry - minRewardDistance;
            takeProfitReasoning = `${config.minimumRiskReward}:1 RR (no valid structure target)`;
          }
        }

        // Validate minimum RR
        const riskReward = (entry - takeProfit) / (stopLoss - entry);
        if (riskReward >= config.minimumRiskReward) {

        // ===== CONFLUENCE SCORING (Using strategy config weights) =====
        let confluenceScore = 0;

        // PHASE 13: Break-and-retest pattern detection for BEARISH signals
        const breakRetest = detectBreakAndRetest(candles, bearishOB, 'bearish');
        if (breakRetest.hasBreakRetest) {
          confluenceScore += breakRetest.strength; // +10 to +20 points for break-retest pattern
        }

        // PHASE 15: Volume divergence detection for BEARISH signals
        const volumeDivergence = detectVolumeDivergence(candles, 'short');
        if (volumeDivergence.hasDivergence) {
          confluenceScore += volumeDivergence.strength; // +10 to +15 points for smart money distribution
        }

        // PHASE 11: Session-based filtering for optimal trading times
        const sessionQuality = analyzeSessionQuality(latestCandle.timestamp);
        if (!sessionQuality.shouldTrade) {
          // Dead zone (02:00-06:00 UTC) - skip this signal entirely
          validEntry = false;
        } else {
          // Add session confluence bonus
          confluenceScore += sessionQuality.confluenceBonus; // +0 to +15 points based on session
        }

        // Apply weights from strategy config
        if (hasFVG) confluenceScore += config.confluenceWeights.fvg;
        if (hasLiquiditySweep) confluenceScore += config.confluenceWeights.liquiditySweep;
        if (hasBOS) confluenceScore += config.confluenceWeights.bos;

        // Zone scoring
        if (zoneAnalysis.zone === 'premium') {
          confluenceScore += config.confluenceWeights.validZone;
        } else if (zoneAnalysis.zone === 'neutral' && config.allowNeutralZone) {
          confluenceScore += config.confluenceWeights.neutralZone || config.neutralZoneScore;
        }

        // Volume confirmation
        if (volumeData.confirmation === 'strong') confluenceScore += config.confluenceWeights.volume;
        else if (volumeData.confirmation === 'moderate') confluenceScore += Math.floor(config.confluenceWeights.volume * 0.67);

        // OTE
        if (ote.currentPriceInOTE) confluenceScore += config.confluenceWeights.ote;

        // Bonus factors
        if (recentBearishBreaker.length > 0) confluenceScore += config.confluenceWeights.breakerBlock;
        if (recentBearishBMS.length > 0) confluenceScore += config.confluenceWeights.bms;

        // ===== INDUCEMENT CONFLUENCE SCORING (NEW) =====
        if (validInducement) {
          let inducementPoints = 0;

          switch (validInducement.type) {
            case 'inducement':
              inducementPoints = config.confluenceWeights.basicInducement || 10;
              break;
            case 'supply_demand_inducement':
              inducementPoints = config.confluenceWeights.supplyDemandInducement || 15;
              break;
            case 'consolidation_inducement':
              inducementPoints = config.confluenceWeights.consolidationInducement || 12;
              break;
            case 'premature_reversal_inducement':
              inducementPoints = config.confluenceWeights.prematureReversalInducement || 8;
              break;
            case 'first_pullback_inducement':
              inducementPoints = config.confluenceWeights.firstPullbackInducement || 15;
              break;
          }

          confluenceScore += inducementPoints;

          // Bonus: Multiple inducements strengthen setup
          if (inducement.bearish && inducement.bearish.length >= 2) {
            confluenceScore += 5;
          }

          // Bonus: Strong inducement with ideal distance
          if (validInducement.strength === 'strong') {
            const distance = Math.abs(entry - validInducement.inducementLevel);
            const distanceATR = distance / atr;
            if (distanceATR >= 1.0 && distanceATR <= 2.0) {
              confluenceScore += 3; // Ideal distance range
            }
          }
        }

        // ===== NEW: HTF CONFLUENCE SCORING =====
        if (htfData) {
          // HTF Order Block alignment (+15 points)
          const isInHTFBearOB = checkIfInHTFOrderBlock(entry, htfData.orderBlocks.bearish);
          if (isInHTFBearOB && config.confluenceWeights.htfOBAlignment) {
            confluenceScore += config.confluenceWeights.htfOBAlignment;
          }

          // HTF FVG targeting (+10 points)
          const targetingHTFFVG = checkIfTargetingHTFFVG(takeProfit, htfData.fvgs.bearish);
          if (targetingHTFFVG && config.confluenceWeights.htfFVGConfluence) {
            confluenceScore += config.confluenceWeights.htfFVGConfluence;
          }

          // HTF Zone alignment (both premium) (+10 points)
          if (htfData.zones.zone === 'premium' &&
              zoneAnalysis.zone === 'premium' &&
              config.confluenceWeights.htfZoneAlignment) {
            confluenceScore += config.confluenceWeights.htfZoneAlignment;
          }

          // HTF Structure alignment (+10 points)
          if (htfData.structure.structure === 'bearish' &&
              config.confluenceWeights.htfStructureAlignment) {
            confluenceScore += config.confluenceWeights.htfStructureAlignment;
          }
        }

        // Assign confidence tier based on strategy minimum
        let confidence;
        if (confluenceScore >= 85) confidence = 'premium';
        else if (confluenceScore >= config.minimumConfluence + 10) confidence = 'high';
        else confidence = 'standard';

        // BALANCED: Require higher confluence without rejection (+15 points)
        const minRequiredConfluence = entryTiming?.requiresExtraConfluence
          ? config.minimumConfluence + 15
          : config.minimumConfluence;

        // ===== MARKET REGIME FILTER =====
        // Adjust confluence based on regime and check if signal should be allowed
        let finalConfluenceScore = confluenceScore;
        let regimeAllowsSignal = true;
        if (marketRegime) {
          finalConfluenceScore = adjustConfluenceForRegime(confluenceScore, marketRegime);

          // Check if regime allows signal (e.g., tight range in conservative mode)
          const modeFromConfig = config.mode || 'moderate'; // Get mode from config
          regimeAllowsSignal = shouldAllowSignal(marketRegime, modeFromConfig);
        }

        if (regimeAllowsSignal && finalConfluenceScore >= minRequiredConfluence) {

        // ===== DIRECTIONAL CONFIRMATION CHECK (SCALPING MODE) =====
        let dirConfirmed = true;
        if (config.requireDirectionalConfirmation) {
          const dirConfirm = checkDirectionalConfirmation(
            latestCandle,
            candles[candles.length - 2],
            'bearish'
          );
          dirConfirmed = dirConfirm.confirmed;
        }

        // ===== CREATE SIGNAL (only if directional confirmation passed) =====
        if (dirConfirmed) {

        // PHASE 17: Calculate multiple take-profit levels
        const multipleTPs = calculateMultipleTakeProfits(entry, stopLoss, takeProfit, 'bearish', atr);

        // PHASE 16: Calculate correlation analysis BEFORE signal object creation (prevents scope issues)
        const symbolCorrelation = (symbolName && typeof symbolName === 'string') ? detectCorrelatedPairs(symbolName) : null;

        signals.push({
          type: 'SELL',
          direction: 'bearish',
          entry: entry,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          riskReward: riskReward,
          confidence: confidence,
          // PHASE 17: Multiple TP levels for partial position closing
          takeProfitLevels: multipleTPs,
          patterns: [
            mitigatedFVGs.unfilled.bearish.length > 0 ? 'FVG (Unfilled)' : null,
            recentBearishOB.length > 0 ? 'Order Block' : null,
            recentBearishBreaker.length > 0 ? 'Breaker Block' : null,
            recentBearishSweep.length > 0 ? 'Liquidity Sweep' : null,
            recentBearishBMS.length > 0 ? 'BMS (Reversal)' : null,
            validInducement ? formatInducementPattern(validInducement) : null,
            ote.currentPriceInOTE ? 'OTE' : null
          ].filter(p => p !== null),
          timestamp: bearishOB.timestamp, // Use order block's timestamp, not latest candle

          // Pattern details (existing)
          patternDetails: {
            fvg: mitigatedFVGs.unfilled.bearish.length > 0 ? mitigatedFVGs.unfilled.bearish[0] : null,
            orderBlock: bearishOB,
            liquiditySweep: recentBearishSweep.length > 0 ? recentBearishSweep[0] : null,
            bms: recentBearishBMS.length > 0 ? recentBearishBMS[0] : null
          },

          // Confluence explanation (existing)
          confluenceReason: `Confluence Score: ${finalConfluenceScore}/145 (${confidence.toUpperCase()})`,

          // Risk/reward breakdown (existing)
          riskRewardBreakdown: {
            entry: entry,
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            riskAmount: Math.abs(stopLoss - entry),
            rewardAmount: Math.abs(entry - takeProfit),
            ratio: riskReward,
            stopLossDistance: `${(Math.abs(stopLoss - entry) / entry * 100).toFixed(2)}%`,
            takeProfitDistance: `${(Math.abs(entry - takeProfit) / entry * 100).toFixed(2)}%`,
            reasoning: `Stop loss above OB with ${buffer.toFixed(8)} buffer`
          },

          // NEW FIELDS
          premiumDiscount: {
            zone: zoneAnalysis.zone,
            percentage: zoneAnalysis.percentage,
            inCorrectZone: true,
            equilibrium: zoneAnalysis.equilibrium,
            range: zoneAnalysis.range
          },
          ote: ote.currentPriceInOTE ? ote : null,
          structureAnalysis: {
            chochDetected: chochEvents.bearish.length > 0,
            bosType: bos.bearish.length > 0 ? 'continuation' : null,
            bmsDetected: recentBearishBMS.length > 0,
            bmsType: recentBearishBMS.length > 0 ? 'reversal' : null,
            // Full event data for chart visualization
            chochEvents: chochEvents.bearish.slice(0, 3), // Last 3 ChoCH events
            bosEvents: bos.bearish.slice(0, 3) // Last 3 BOS events
          },
          liquidityAnalysis: {
            externalLiquidity: targetLiquidity || null,
            sweepDetected: recentBearishSweep.length > 0,
            inducementDetected: validInducement !== null,
            inducementType: validInducement?.type || null,
            inducementLevel: validInducement?.inducementLevel || null,
            inducementPosition: validInducement ?
              (validInducement.inducementLevel > entry ? 'above_entry' : 'below_entry') :
              null,
            inducementStrength: validInducement?.strength || null,
            inducementDistance: validInducement ?
              Math.abs(entry - validInducement.inducementLevel) :
              null,
            inducementDistanceATR: validInducement ?
              (Math.abs(entry - validInducement.inducementLevel) / atr).toFixed(2) :
              null,
            inducementDetails: validInducement ? {
              description: getInducementDescription(validInducement),
              candle: validInducement.candle || validInducement.reversalCandle || null,
              timestamp: validInducement.timestamp || validInducement.candle?.timestamp || null,
              zoneType: validInducement.zoneType || null,
              manipulation: validInducement.manipulation || null
            } : null,
            totalInducementsDetected: inducement.bearish?.length || 0,
            allInducements: inducement.bearish ? inducement.bearish.map(ind => ({
              type: ind.type,
              level: ind.inducementLevel,
              strength: ind.strength
            })) : []
          },
          fvgStatus: mitigatedFVGs.unfilled.bearish.length > 0 ? {
            detected: true,
            mitigationStatus: 'unfilled',
            fillPercentage: 0,
            strength: 'strong'
          } : null,
          orderBlockDetails: {
            type: recentBearishBreaker.length > 0 ? 'breakerBlock' : 'orderBlock',
            top: bearishOB.top,
            bottom: bearishOB.bottom,
            strength: bearishOB.strength,
            polarityChange: recentBearishBreaker.length > 0
          },
          volumeAnalysis: volumeData,
          entryTiming: entryTiming,
          confluenceScore: finalConfluenceScore,
          riskManagement: {
            stopLossReasoning: `Above OB with ${buffer.toFixed(8)} buffer`,
            takeProfitReasoning: takeProfitReasoning,
            atrBuffer: buffer,
            maxRiskPercent: 3.0
          },

          // SCALPING MODE CONFIGURATION
          scalpingConfig: config.scalping ? {
            timeoutMinutes: config.scalping.timeoutMinutes[config.timeframe || '5m'],
            trailingStopEnabled: config.scalping.enableTrailingStop,
            partialCloseEnabled: config.scalping.enablePartialClose,
            breakEvenR: config.scalping.breakEvenTriggerR,
            trailingStartR: config.scalping.trailingStartR,
            trailingDistanceR: config.scalping.trailingDistanceR,
            partialCloseR: config.scalping.partialCloseR,
            partialClosePercent: config.scalping.partialClosePercent,
          } : null,

          // HTF TREND (for trend analysis)
          htfTrend: htfTrend,

          // MULTI-TIMEFRAME CONSENSUS (User's methodology: Both 1h AND 4h must agree)
          mtfConsensus: multiTimeframeConsensus,

          // HTF ALIGNMENT FLAGS (for UI display)
          htfAlignment: htfData && timeframe ? {
            hasHTFOB: checkIfInHTFOrderBlock(entry, htfData.orderBlocks.bearish),
            hasHTFFVG: checkIfTargetingHTFFVG(takeProfit, htfData.fvgs.bearish),
            hasHTFZone: htfData.zones.zone === 'premium' && zoneAnalysis.zone === 'premium',
            hasHTFStructure: htfData.structure.structure === 'bearish',
            htfTimeframe: getHTFTimeframe(timeframe)
          } : null,

          // PHASE 14: Volatility state for stop loss adaptation
          volatilityState: adaptiveSL || null,

          // PHASE 16: Correlation detection for risk management
          correlationAnalysis: symbolCorrelation,

          // MARKET REGIME FILTER: ADX-based trend strength analysis
          marketRegime: marketRegime ? {
            regime: marketRegime.regime,
            adx: marketRegime.adx,
            bbWidthPercent: marketRegime.bbWidthPercent,
            action: marketRegime.recommendation.action,
            message: marketRegime.recommendation.message
          } : null
        });
        } // End if (dirConfirmed)
        } // End if (confluenceScore >= 35)
        } // End if (riskReward >= config.minimumRiskReward)
      } // End if (validEntry)
    }
  }
  }

  return signals;
}

/**
 * Generates human-readable confluence explanation for signal
 * @param {Object} confluence - Pattern confluence information
 * @returns {string} Explanation text
 */
function generateConfluenceExplanation(confluence) {
  const { hasFVG, hasOB, hasSweep, hasBMS, direction, fvgData, obData, sweepData, bmsData, entry } = confluence;
  const directionText = direction === 'bullish' ? 'bullish' : 'bearish';

  let explanation = `This ${directionText} signal was triggered at ${entry.toFixed(2)} due to multiple confirming patterns:\n\n`;
  const reasons = [];

  if (hasFVG && fvgData) {
    const fvgRange = `${fvgData.bottom.toFixed(2)} - ${fvgData.top.toFixed(2)}`;
    const gapSize = ((fvgData.gap / entry) * 100).toFixed(2);
    reasons.push(`📊 **Fair Value Gap (${directionText})**: A ${gapSize}% price imbalance was detected between ${fvgRange}, indicating strong momentum as price moved too quickly leaving an inefficiency that often gets filled.`);
  }

  if (hasOB && obData) {
    const obRange = `${obData.bottom.toFixed(2)} - ${obData.top.toFixed(2)}`;
    const strength = obData.strength.toFixed(1);
    reasons.push(`🏢 **Order Block (${directionText})**: Institutional zone identified at ${obRange} with ${strength}% impulse strength. This represents where large orders were placed before a significant price move, making it a high-probability reaction zone.`);
  }

  if (hasSweep && sweepData) {
    const sweepLevel = sweepData.swingLevel.toFixed(2);
    reasons.push(`💧 **Liquidity Sweep**: Price swept through swing level at ${sweepLevel} to trigger stop losses (liquidity grab), then reversed. This "stop hunt" pattern often precedes strong moves as smart money collects liquidity before the real move.`);
  }

  if (hasBMS && bmsData) {
    const breakLevel = bmsData.breakLevel.toFixed(2);
    const prevTrend = bmsData.previousTrend;
    reasons.push(`📈 **Break of Market Structure**: Price broke above/below the previous structure at ${breakLevel}, confirming a shift from ${prevTrend} to a new trend phase. This validates the momentum change.`);
  }

  explanation += reasons.join('\n\n');

  // Add confluence strength summary
  const patternCount = [hasFVG, hasOB, hasSweep, hasBMS].filter(Boolean).length;
  explanation += `\n\n✅ **Confluence Strength**: ${patternCount}/4 major patterns aligned, creating a ${patternCount >= 3 ? 'HIGH' : 'MEDIUM'} probability setup.`;

  return explanation;
}

/**
 * ============================================================================
 * ENHANCED SMC HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Calculate Average True Range for volatility-based buffers
 * @param {Array} candles - Array of candle objects
 * @param {number} period - Lookback period (default: 14)
 * @returns {number} Average True Range value
 */
function calculateATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) {
    return 0;
  }

  const trueRanges = [];

  // Calculate True Range for each candle
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];

    // True Range = max of:
    // 1. Current High - Current Low
    // 2. |Current High - Previous Close|
    // 3. |Current Low - Previous Close|
    const tr1 = current.high - current.low;
    const tr2 = Math.abs(current.high - previous.close);
    const tr3 = Math.abs(current.low - previous.close);

    const trueRange = Math.max(tr1, tr2, tr3);
    trueRanges.push(trueRange);
  }

  // Calculate average of last 'period' true ranges
  const recentTRs = trueRanges.slice(-period);
  const atr = recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;

  return atr;
}

/**
 * Find next significant structure level for TP targeting
 * @param {Array} candles - Array of candle objects
 * @param {Object} swingPoints - Object with swingHighs and swingLows arrays
 * @param {string} direction - 'bullish' or 'bearish'
 * @returns {Object|null} Next structure point or null if not found
 */
function findNearestStructure(candles, swingPoints, direction) {
  if (!swingPoints || !candles || candles.length === 0) {
    return null;
  }

  const currentPrice = candles[candles.length - 1].close;

  if (direction === 'bullish') {
    // Find next swing high above current price
    const targetSwings = swingPoints.swingHighs
      .filter(swing => swing.price > currentPrice)
      .sort((a, b) => a.price - b.price); // Closest first

    return targetSwings.length > 0 ? targetSwings[0] : null;

  } else if (direction === 'bearish') {
    // Find next swing low below current price
    const targetSwings = swingPoints.swingLows
      .filter(swing => swing.price < currentPrice)
      .sort((a, b) => b.price - a.price); // Closest first (descending)

    return targetSwings.length > 0 ? targetSwings[0] : null;
  }

  return null;
}

/**
 * Utility to check if price is within a range with tolerance
 * @param {number} price - Price to check
 * @param {number} top - Top of range
 * @param {number} bottom - Bottom of range
 * @param {number} tolerance - Tolerance percentage (default: 0.001 = 0.1%)
 * @returns {boolean} True if price is within range
 */
function priceInRange(price, top, bottom, tolerance = 0.001) {
  if (top === undefined || bottom === undefined || price === undefined) {
    return false;
  }

  // Add tolerance to range
  const rangeTolerance = (top - bottom) * tolerance;
  const adjustedTop = top + rangeTolerance;
  const adjustedBottom = bottom - rangeTolerance;

  return price >= adjustedBottom && price <= adjustedTop;
}

/**
 * ============================================================================
 * PREMIUM/DISCOUNT ZONE ANALYSIS
 * ============================================================================
 */

/**
 * Calculates premium/discount zones based on swing range
 * This is a CRITICAL FILTER: only long in discount, only short in premium
 *
 * @param {Array} candles - Array of candle objects
 * @param {Object} swingPoints - Object with swingHighs and swingLows arrays
 * @param {number} currentPrice - Current price to analyze
 * @returns {Object} Zone analysis: { zone, percentage, equilibrium, range, swingHigh, swingLow }
 */
function calculatePremiumDiscount(candles, swingPoints, currentPrice) {
  if (!candles || candles.length < 50 || !swingPoints || currentPrice === undefined) {
    return {
      zone: 'neutral',
      percentage: 50,
      equilibrium: currentPrice,
      range: 0,
      swingHigh: null,
      swingLow: null
    };
  }

  // Find most recent significant swing high and low
  // Look back 50-100 candles for structure
  const lookbackPeriod = Math.min(100, candles.length);
  const recentCandles = candles.slice(-lookbackPeriod);

  // Get swing highs and lows within lookback period
  const recentSwingHighs = swingPoints.swingHighs
    .filter(swing => {
      // Check if swing is within our lookback period
      const swingIndex = candles.findIndex(c => c.timestamp === swing.timestamp);
      return swingIndex >= candles.length - lookbackPeriod;
    })
    .sort((a, b) => b.price - a.price); // Highest first

  const recentSwingLows = swingPoints.swingLows
    .filter(swing => {
      const swingIndex = candles.findIndex(c => c.timestamp === swing.timestamp);
      return swingIndex >= candles.length - lookbackPeriod;
    })
    .sort((a, b) => a.price - b.price); // Lowest first

  // If we don't have both swing high and low, return neutral
  if (recentSwingHighs.length === 0 || recentSwingLows.length === 0) {
    return {
      zone: 'neutral',
      percentage: 50,
      equilibrium: currentPrice,
      range: 0,
      swingHigh: null,
      swingLow: null
    };
  }

  // Get the most recent significant swing high and low
  const swingHigh = recentSwingHighs[0];
  const swingLow = recentSwingLows[0];

  // Calculate range and equilibrium (50% level)
  const range = swingHigh.price - swingLow.price;
  const equilibrium = swingLow.price + (range * 0.5);

  // Calculate where current price sits in the range (0-100%)
  let percentage;
  if (currentPrice <= swingLow.price) {
    percentage = 0;
  } else if (currentPrice >= swingHigh.price) {
    percentage = 100;
  } else {
    percentage = ((currentPrice - swingLow.price) / range) * 100;
  }

  // Classify zone
  // Discount: 0-50% (below equilibrium) - LONG ENTRIES ONLY
  // Premium: 50-100% (above equilibrium) - SHORT ENTRIES ONLY
  // Neutral: Within 5% of equilibrium (45-55%) - can be either
  let zone;
  if (percentage < 45) {
    zone = 'discount';
  } else if (percentage > 55) {
    zone = 'premium';
  } else {
    zone = 'neutral'; // Near equilibrium
  }

  return {
    zone: zone,
    percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
    equilibrium: equilibrium,
    range: range,
    swingHigh: swingHigh,
    swingLow: swingLow
  };
}

/**
 * ============================================================================
 * OPTIMAL TRADE ENTRY (OTE) ANALYSIS
 * ============================================================================
 */

/**
 * Calculates Fibonacci retracement zones for Optimal Trade Entry
 * OTE Zone: 0.618-0.786 retracement (institutional entry zone)
 * Sweet Spot: 0.705 level (optimal entry point)
 *
 * @param {number} swingHigh - High point of swing
 * @param {number} swingLow - Low point of swing
 * @param {number} currentPrice - Current price to analyze
 * @param {string} direction - 'bullish' or 'bearish'
 * @returns {Object} OTE analysis with Fibonacci levels and zone status
 */
function calculateOTE(swingHigh, swingLow, currentPrice, direction) {
  if (swingHigh === undefined || swingLow === undefined || currentPrice === undefined) {
    return {
      fibLevels: {},
      oteZone: { high: null, mid: null, low: null },
      currentPriceInOTE: false,
      distanceToOTE: null,
      sweetSpot: null
    };
  }

  const range = swingHigh - swingLow;

  // Calculate Fibonacci retracement levels
  // For bullish: retracement from high back down
  // For bearish: retracement from low back up
  let fibLevels = {};
  let oteZone = {};
  let sweetSpot;

  if (direction === 'bullish') {
    // Bullish OTE: waiting for retracement from high to low
    // 0.618 = 61.8% retracement from the high
    fibLevels = {
      '0': swingHigh,                           // 0% (swing high)
      '0.236': swingHigh - (range * 0.236),    // 23.6%
      '0.382': swingHigh - (range * 0.382),    // 38.2%
      '0.5': swingHigh - (range * 0.5),        // 50%
      '0.618': swingHigh - (range * 0.618),    // 61.8% (OTE start)
      '0.705': swingHigh - (range * 0.705),    // 70.5% (sweet spot)
      '0.786': swingHigh - (range * 0.786),    // 78.6% (OTE end)
      '1': swingLow                             // 100% (swing low)
    };

    // OTE Zone for bullish: between 61.8% and 78.6%
    oteZone = {
      high: fibLevels['0.618'],   // Upper boundary (closer to swing high)
      mid: fibLevels['0.705'],    // Sweet spot
      low: fibLevels['0.786']     // Lower boundary (closer to swing low)
    };

    sweetSpot = fibLevels['0.705'];

  } else if (direction === 'bearish') {
    // Bearish OTE: waiting for retracement from low back up
    // 0.618 = 61.8% retracement from the low
    fibLevels = {
      '0': swingLow,                           // 0% (swing low)
      '0.236': swingLow + (range * 0.236),    // 23.6%
      '0.382': swingLow + (range * 0.382),    // 38.2%
      '0.5': swingLow + (range * 0.5),        // 50%
      '0.618': swingLow + (range * 0.618),    // 61.8% (OTE start)
      '0.705': swingLow + (range * 0.705),    // 70.5% (sweet spot)
      '0.786': swingLow + (range * 0.786),    // 78.6% (OTE end)
      '1': swingHigh                           // 100% (swing high)
    };

    // OTE Zone for bearish: between 61.8% and 78.6%
    oteZone = {
      low: fibLevels['0.618'],    // Lower boundary (closer to swing low)
      mid: fibLevels['0.705'],    // Sweet spot
      high: fibLevels['0.786']    // Upper boundary (closer to swing high)
    };

    sweetSpot = fibLevels['0.705'];
  }

  // Check if current price is within OTE zone
  let currentPriceInOTE = false;
  let distanceToOTE = null;

  if (direction === 'bullish') {
    // For bullish, price should be between 0.786 (low) and 0.618 (high)
    currentPriceInOTE = currentPrice >= oteZone.low && currentPrice <= oteZone.high;

    // Calculate distance to OTE
    if (currentPrice > oteZone.high) {
      distanceToOTE = currentPrice - oteZone.high; // Price above OTE
    } else if (currentPrice < oteZone.low) {
      distanceToOTE = oteZone.low - currentPrice; // Price below OTE
    } else {
      distanceToOTE = 0; // Price in OTE
    }

  } else if (direction === 'bearish') {
    // For bearish, price should be between 0.618 (low) and 0.786 (high)
    currentPriceInOTE = currentPrice >= oteZone.low && currentPrice <= oteZone.high;

    // Calculate distance to OTE
    if (currentPrice > oteZone.high) {
      distanceToOTE = currentPrice - oteZone.high; // Price above OTE
    } else if (currentPrice < oteZone.low) {
      distanceToOTE = oteZone.low - currentPrice; // Price below OTE
    } else {
      distanceToOTE = 0; // Price in OTE
    }
  }

  return {
    fibLevels: fibLevels,
    oteZone: oteZone,
    currentPriceInOTE: currentPriceInOTE,
    distanceToOTE: distanceToOTE,
    sweetSpot: sweetSpot,
    direction: direction
  };
}

/**
 * ============================================================================
 * ADVANCED MARKET STRUCTURE ANALYSIS
 * ============================================================================
 */

/**
 * Detects Change of Character (ChoCh) - minor structure breaks indicating weakness
 * ChoCh = breaks intermediate swing but not major trend (early warning signal)
 *
 * @param {Array} candles - Array of candle objects
 * @param {Object} structure - Market structure object from analyzeMarketStructure()
 * @returns {Object} ChoCh events: { bullish: [], bearish: [] }
 */
function detectChangeOfCharacter(candles, structure) {
  if (!candles || candles.length < 30 || !structure) {
    return { bullish: [], bearish: [] };
  }

  const chochEvents = {
    bullish: [],  // Bearish trend showing weakness (price breaks above intermediate high)
    bearish: []   // Bullish trend showing weakness (price breaks below intermediate low)
  };

  // Look at recent 30 candles for ChoCh
  const recentCandles = candles.slice(-30);

  // ChoCh detection logic:
  // In downtrend: price breaks above recent lower high (not necessarily the swing high)
  // In uptrend: price breaks below recent higher low (not necessarily the swing low)

  if (structure.trend === 'downtrend') {
    // Look for bullish ChoCh: price breaking above intermediate high
    // Find recent lower highs in the downtrend
    for (let i = 5; i < recentCandles.length - 1; i++) {
      const candle = recentCandles[i];
      const isLocalHigh = candle.high > recentCandles[i - 1].high &&
                          candle.high > recentCandles[i + 1].high;

      if (isLocalHigh) {
        // Check if a later candle breaks above this intermediate high
        for (let j = i + 1; j < recentCandles.length; j++) {
          const laterCandle = recentCandles[j];
          if (laterCandle.close > candle.high) {
            // ChoCh detected - trend weakness
            chochEvents.bullish.push({
              type: 'ChoCh',
              direction: 'bullish',
              brokenLevel: candle.high,
              breakCandle: laterCandle,
              timestamp: laterCandle.timestamp,
              significance: 'warning' // Not a full reversal yet
            });
            break; // Only record first break
          }
        }
      }
    }

  } else if (structure.trend === 'uptrend') {
    // Look for bearish ChoCh: price breaking below intermediate low
    for (let i = 5; i < recentCandles.length - 1; i++) {
      const candle = recentCandles[i];
      const isLocalLow = candle.low < recentCandles[i - 1].low &&
                         candle.low < recentCandles[i + 1].low;

      if (isLocalLow) {
        // Check if a later candle breaks below this intermediate low
        for (let j = i + 1; j < recentCandles.length; j++) {
          const laterCandle = recentCandles[j];
          if (laterCandle.close < candle.low) {
            // ChoCh detected - trend weakness
            chochEvents.bearish.push({
              type: 'ChoCh',
              direction: 'bearish',
              brokenLevel: candle.low,
              breakCandle: laterCandle,
              timestamp: laterCandle.timestamp,
              significance: 'warning'
            });
            break;
          }
        }
      }
    }
  }

  return chochEvents;
}

/**
 * Distinguishes Break of Structure (BOS) from Break of Market Structure (BMS)
 * BOS = break in trend direction (continuation signal)
 * BMS = break against trend (reversal signal)
 *
 * @param {Array} candles - Array of candle objects
 * @param {Object} structure - Market structure object
 * @returns {Object} { bos: {bullish: [], bearish: []}, bms: {bullish: [], bearish: []} }
 */
function distinguishBOSvsBMS(candles, structure) {
  if (!candles || candles.length < 20 || !structure) {
    return {
      bos: { bullish: [], bearish: [] },
      bms: { bullish: [], bearish: [] }
    };
  }

  const result = {
    bos: { bullish: [], bearish: [] },  // Continuation breaks
    bms: { bullish: [], bearish: [] }   // Reversal breaks
  };

  const recentCandles = candles.slice(-20);

  // BOS (Break of Structure) - Continuation:
  // In uptrend: breaking above previous swing high = bullish BOS
  // In downtrend: breaking below previous swing low = bearish BOS

  // BMS (Break of Market Structure) - Reversal:
  // In uptrend: breaking below previous swing low = bearish BMS (reversal)
  // In downtrend: breaking above previous swing high = bullish BMS (reversal)

  if (structure.trend === 'uptrend') {
    // Check for bullish BOS (continuation): breaking above swing high
    if (structure.lastSwingHigh) {
      const breakAbove = recentCandles.find(c =>
        c.close > structure.lastSwingHigh.price
      );

      if (breakAbove) {
        result.bos.bullish.push({
          type: 'BOS',
          direction: 'bullish',
          brokenLevel: structure.lastSwingHigh.price,
          breakCandle: breakAbove,
          timestamp: breakAbove.timestamp,
          significance: 'continuation',
          trendAlignment: true
        });
      }
    }

    // Check for bearish BMS (reversal): breaking below swing low
    if (structure.lastSwingLow) {
      const breakBelow = recentCandles.find(c =>
        c.close < structure.lastSwingLow.price
      );

      if (breakBelow) {
        result.bms.bearish.push({
          type: 'BMS',
          direction: 'bearish',
          brokenLevel: structure.lastSwingLow.price,
          breakCandle: breakBelow,
          timestamp: breakBelow.timestamp,
          significance: 'reversal',
          trendAlignment: false
        });
      }
    }

  } else if (structure.trend === 'downtrend') {
    // Check for bearish BOS (continuation): breaking below swing low
    if (structure.lastSwingLow) {
      const breakBelow = recentCandles.find(c =>
        c.close < structure.lastSwingLow.price
      );

      if (breakBelow) {
        result.bos.bearish.push({
          type: 'BOS',
          direction: 'bearish',
          brokenLevel: structure.lastSwingLow.price,
          breakCandle: breakBelow,
          timestamp: breakBelow.timestamp,
          significance: 'continuation',
          trendAlignment: true
        });
      }
    }

    // Check for bullish BMS (reversal): breaking above swing high
    if (structure.lastSwingHigh) {
      const breakAbove = recentCandles.find(c =>
        c.close > structure.lastSwingHigh.price
      );

      if (breakAbove) {
        result.bms.bullish.push({
          type: 'BMS',
          direction: 'bullish',
          brokenLevel: structure.lastSwingHigh.price,
          breakCandle: breakAbove,
          timestamp: breakAbove.timestamp,
          significance: 'reversal',
          trendAlignment: false
        });
      }
    }
  }

  return result;
}

/**
 * ============================================================================
 * LIQUIDITY DETECTION
 * ============================================================================
 */

/**
 * Detects internal liquidity within trading ranges (consolidation zones)
 * Internal liquidity = stops resting within sideways ranges
 *
 * @param {Array} candles - Array of candle objects
 * @param {Object} swingPoints - Swing points object
 * @returns {Array} Internal liquidity zones
 */
function detectInternalLiquidity(candles, swingPoints) {
  if (!candles || candles.length < 20 || !swingPoints) {
    return [];
  }

  const internalLiquidity = [];
  const recentCandles = candles.slice(-50);

  // Find consolidation ranges (sideways movement)
  // Consolidation = price moving within a tight range for multiple candles
  for (let i = 10; i < recentCandles.length - 5; i++) {
    const rangeCandles = recentCandles.slice(i - 10, i + 5); // 15 candle window

    // Calculate range
    const highs = rangeCandles.map(c => c.high);
    const lows = rangeCandles.map(c => c.low);
    const rangeHigh = Math.max(...highs);
    const rangeLow = Math.min(...lows);
    const rangeSize = rangeHigh - rangeLow;
    const avgPrice = (rangeHigh + rangeLow) / 2;

    // Check if it's a consolidation (range < 2% of price)
    const rangePercent = (rangeSize / avgPrice) * 100;

    if (rangePercent < 2.0) {
      // This is a consolidation zone
      // Internal liquidity sits at the highs and lows of this range
      internalLiquidity.push({
        type: 'internal',
        high: rangeHigh,
        low: rangeLow,
        midpoint: avgPrice,
        startIndex: i - 10,
        endIndex: i + 5,
        rangePercent: rangePercent,
        buyLiquidity: rangeLow,   // Buy stops below range
        sellLiquidity: rangeHigh  // Sell stops above range
      });
    }
  }

  // Remove duplicates (overlapping ranges)
  const uniqueLiquidity = [];
  for (const liq of internalLiquidity) {
    const isDuplicate = uniqueLiquidity.some(existing =>
      Math.abs(existing.high - liq.high) < (liq.high * 0.001) &&
      Math.abs(existing.low - liq.low) < (liq.low * 0.001)
    );

    if (!isDuplicate) {
      uniqueLiquidity.push(liq);
    }
  }

  return uniqueLiquidity;
}

/**
 * Detects external liquidity (equal highs/lows where stops cluster)
 * Equal highs = sell-side liquidity (shorts' stops above)
 * Equal lows = buy-side liquidity (longs' stops below)
 *
 * @param {Object} swingPoints - Swing points object
 * @returns {Object} { buyLiquidity: [], sellLiquidity: [] }
 */
function detectExternalLiquidity(swingPoints) {
  if (!swingPoints || !swingPoints.swingHighs || !swingPoints.swingLows) {
    return { buyLiquidity: [], sellLiquidity: [] };
  }

  const externalLiquidity = {
    buyLiquidity: [],   // Equal lows (buy stops)
    sellLiquidity: []   // Equal highs (sell stops)
  };

  const tolerance = 0.003; // 0.3% tolerance for "equal" levels

  // Detect equal highs (sell-side liquidity)
  for (let i = 0; i < swingPoints.swingHighs.length; i++) {
    const swing = swingPoints.swingHighs[i];

    // Find other swing highs at similar price
    const equalSwings = swingPoints.swingHighs.filter((other, idx) => {
      if (idx === i) return false;

      const priceDiff = Math.abs(other.price - swing.price);
      const pricePercent = (priceDiff / swing.price);

      return pricePercent <= tolerance;
    });

    // If we have 2+ equal highs, that's external liquidity
    if (equalSwings.length >= 1) { // Including current swing = 2+ total
      const allEqualSwings = [swing, ...equalSwings];
      const avgPrice = allEqualSwings.reduce((sum, s) => sum + s.price, 0) / allEqualSwings.length;

      // Check if we already added this level
      const alreadyAdded = externalLiquidity.sellLiquidity.some(liq =>
        Math.abs(liq.price - avgPrice) < (avgPrice * tolerance)
      );

      if (!alreadyAdded) {
        externalLiquidity.sellLiquidity.push({
          type: 'external',
          direction: 'sell-side',
          price: avgPrice,
          touchCount: allEqualSwings.length,
          strength: allEqualSwings.length >= 3 ? 'strong' : 'moderate',
          swings: allEqualSwings
        });
      }
    }
  }

  // Detect equal lows (buy-side liquidity)
  for (let i = 0; i < swingPoints.swingLows.length; i++) {
    const swing = swingPoints.swingLows[i];

    // Find other swing lows at similar price
    const equalSwings = swingPoints.swingLows.filter((other, idx) => {
      if (idx === i) return false;

      const priceDiff = Math.abs(other.price - swing.price);
      const pricePercent = (priceDiff / swing.price);

      return pricePercent <= tolerance;
    });

    if (equalSwings.length >= 1) {
      const allEqualSwings = [swing, ...equalSwings];
      const avgPrice = allEqualSwings.reduce((sum, s) => sum + s.price, 0) / allEqualSwings.length;

      const alreadyAdded = externalLiquidity.buyLiquidity.some(liq =>
        Math.abs(liq.price - avgPrice) < (avgPrice * tolerance)
      );

      if (!alreadyAdded) {
        externalLiquidity.buyLiquidity.push({
          type: 'external',
          direction: 'buy-side',
          price: avgPrice,
          touchCount: allEqualSwings.length,
          strength: allEqualSwings.length >= 3 ? 'strong' : 'moderate',
          swings: allEqualSwings
        });
      }
    }
  }

  return externalLiquidity;
}

/**
 * Identifies basic inducement zones (retail traps / stop hunts)
 * Inducement = failed breakouts that quickly reverse
 * NOTE: This is the original basic detection, now part of enhanced system
 *
 * @param {Array} candles - Array of candle objects
 * @param {Object} structure - Market structure object
 * @returns {Object} { bullish: [], bearish: [] }
 */
function detectBasicInducement(candles, structure) {
  if (!candles || candles.length < 30 || !structure) {
    return { bullish: [], bearish: [] };
  }

  const inducement = {
    bullish: [],  // Fake breakdown that reverses up (bullish trap)
    bearish: []   // Fake breakout that reverses down (bearish trap)
  };

  const recentCandles = candles.slice(-30);

  // Inducement detection:
  // 1. Price wicks beyond structure level (stop hunt)
  // 2. Body closes back inside structure (failed break)
  // 3. Reverses within 1-3 candles

  for (let i = 5; i < recentCandles.length - 3; i++) {
    const candle = recentCandles[i];
    const nextCandle = recentCandles[i + 1];
    const next2Candle = recentCandles[i + 2];

    // Bullish inducement: fake breakdown below support
    // Wick goes below recent low, body closes above it
    const recentLows = recentCandles.slice(Math.max(0, i - 10), i).map(c => c.low);
    const supportLevel = Math.min(...recentLows);

    if (candle.low < supportLevel && candle.close > supportLevel) {
      // Wick hunt below support, but closed above
      // Check if it reversed up within 3 candles
      const reversedUp = [nextCandle, next2Candle].some(c =>
        c && c.close > candle.close && c.close > supportLevel
      );

      if (reversedUp) {
        inducement.bullish.push({
          type: 'inducement',
          direction: 'bullish',
          huntedLevel: supportLevel,
          wickLow: candle.low,
          closePrice: candle.close,
          candle: candle,
          timestamp: candle.timestamp,
          description: 'Fake breakdown (stop hunt below support)'
        });
      }
    }

    // Bearish inducement: fake breakout above resistance
    // Wick goes above recent high, body closes below it
    const recentHighs = recentCandles.slice(Math.max(0, i - 10), i).map(c => c.high);
    const resistanceLevel = Math.max(...recentHighs);

    if (candle.high > resistanceLevel && candle.close < resistanceLevel) {
      // Wick hunt above resistance, but closed below
      const reversedDown = [nextCandle, next2Candle].some(c =>
        c && c.close < candle.close && c.close < resistanceLevel
      );

      if (reversedDown) {
        inducement.bearish.push({
          type: 'inducement',
          direction: 'bearish',
          huntedLevel: resistanceLevel,
          wickHigh: candle.high,
          closePrice: candle.close,
          candle: candle,
          timestamp: candle.timestamp,
          description: 'Fake breakout (stop hunt above resistance)'
        });
      }
    }
  }

  return inducement;
}

/**
 * ============================================================================
 * ADVANCED INDUCEMENT DETECTION (From Inducement Trading PDF)
 * ============================================================================
 */

/**
 * Detects Supply/Demand Zone Inducement
 * Price breaks through OB/FVG zone (hunts stops), then reverses back
 * The violated zone becomes inducement for deeper entry
 *
 * @param {Array} candles - Array of candle objects
 * @param {Object} orderBlocks - Order blocks object with bullish/bearish arrays
 * @param {Object} fvgs - FVG object with bullish/bearish arrays
 * @returns {Object} { bullish: [], bearish: [] }
 */
function detectSupplyDemandInducement(candles, orderBlocks, fvgs) {
  if (!candles || candles.length < 20 || !orderBlocks || !fvgs) {
    return { bullish: [], bearish: [] };
  }

  const inducements = {
    bullish: [],  // Bullish zone that got violated (avoid long entry here)
    bearish: []   // Bearish zone that got violated (avoid short entry here)
  };

  const lookbackWindow = 30;
  const recentCandles = candles.slice(-lookbackWindow);

  // Combine all zones (OB + FVG)
  const bullishZones = [
    ...(orderBlocks.bullish || []).map(ob => ({ ...ob, zoneType: 'orderBlock' })),
    ...(fvgs.bullish || []).map(fvg => ({ ...fvg, zoneType: 'fvg' }))
  ];

  const bearishZones = [
    ...(orderBlocks.bearish || []).map(ob => ({ ...ob, zoneType: 'orderBlock' })),
    ...(fvgs.bearish || []).map(fvg => ({ ...fvg, zoneType: 'fvg' }))
  ];

  // Detect bullish zone inducement (price breaks ABOVE, then reverses DOWN)
  for (const zone of bullishZones) {
    const zoneTop = zone.top || zone.high;
    const zoneBottom = zone.bottom || zone.low;

    // Filter noise: minimum zone size
    const zoneSizePercent = ((zoneTop - zoneBottom) / zoneBottom) * 100;
    if (zoneSizePercent < 0.3) continue;

    // Find breakout above zone
    for (let i = 5; i < recentCandles.length - 3; i++) {
      const candle = recentCandles[i];

      // Breakout: high breaks ABOVE zone top
      if (candle.high > zoneTop && candle.low < zoneTop) {
        // Check for reversal DOWN within 1-3 candles
        let reversalCandle = null;
        let candlesToReversal = 0;

        for (let j = i + 1; j <= Math.min(i + 3, recentCandles.length - 1); j++) {
          const nextCandle = recentCandles[j];

          // Reversal: price comes back DOWN through zone
          if (nextCandle.low < zoneBottom && nextCandle.close < zoneTop) {
            reversalCandle = nextCandle;
            candlesToReversal = j - i;
            break;
          }
        }

        if (reversalCandle) {
          // Determine strength
          let strength = 'weak';
          if (candlesToReversal === 1) {
            strength = candle.volume > (candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20) ? 'strong' : 'moderate';
          } else if (candlesToReversal === 2) {
            strength = 'moderate';
          }

          inducements.bullish.push({
            type: 'supply_demand_inducement',
            direction: 'bullish',
            zoneType: zone.zoneType,
            originalZone: { top: zoneTop, bottom: zoneBottom, timestamp: zone.timestamp },
            breakoutCandle: { index: i, price: candle.high, timestamp: candle.timestamp },
            reversalCandle: { index: i + candlesToReversal, price: reversalCandle.low, timestamp: reversalCandle.timestamp },
            candlesToReversal,
            strength,
            inducementLevel: (zoneTop + zoneBottom) / 2,
            candle: candle
          });
          break; // Move to next zone
        }
      }
    }
  }

  // Detect bearish zone inducement (price breaks BELOW, then reverses UP)
  for (const zone of bearishZones) {
    const zoneTop = zone.top || zone.high;
    const zoneBottom = zone.bottom || zone.low;

    const zoneSizePercent = ((zoneTop - zoneBottom) / zoneBottom) * 100;
    if (zoneSizePercent < 0.3) continue;

    for (let i = 5; i < recentCandles.length - 3; i++) {
      const candle = recentCandles[i];

      // Breakout: low breaks BELOW zone bottom
      if (candle.low < zoneBottom && candle.high > zoneBottom) {
        let reversalCandle = null;
        let candlesToReversal = 0;

        for (let j = i + 1; j <= Math.min(i + 3, recentCandles.length - 1); j++) {
          const nextCandle = recentCandles[j];

          // Reversal: price comes back UP through zone
          if (nextCandle.high > zoneTop && nextCandle.close > zoneBottom) {
            reversalCandle = nextCandle;
            candlesToReversal = j - i;
            break;
          }
        }

        if (reversalCandle) {
          let strength = 'weak';
          if (candlesToReversal === 1) {
            strength = candle.volume > (candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20) ? 'strong' : 'moderate';
          } else if (candlesToReversal === 2) {
            strength = 'moderate';
          }

          inducements.bearish.push({
            type: 'supply_demand_inducement',
            direction: 'bearish',
            zoneType: zone.zoneType,
            originalZone: { top: zoneTop, bottom: zoneBottom, timestamp: zone.timestamp },
            breakoutCandle: { index: i, price: candle.low, timestamp: candle.timestamp },
            reversalCandle: { index: i + candlesToReversal, price: reversalCandle.high, timestamp: reversalCandle.timestamp },
            candlesToReversal,
            strength,
            inducementLevel: (zoneTop + zoneBottom) / 2,
            candle: candle
          });
          break;
        }
      }
    }
  }

  return inducements;
}

/**
 * Detects Consolidation Inducement (Power of 3 Pattern)
 * Accumulation → Manipulation (both sides swept) → Distribution
 * The sweep opposite to final breakout direction = inducement
 *
 * @param {Array} candles - Array of candle objects
 * @param {Array} swingPoints - Array of swing highs and lows
 * @returns {Object} { bullish: [], bearish: [] }
 */
function detectConsolidationInducement(candles, swingPoints) {
  if (!candles || candles.length < 50 || !swingPoints || swingPoints.length < 4) {
    return { bullish: [], bearish: [] };
  }

  const inducements = {
    bullish: [],  // Consolidation that broke UP (low sweep = inducement)
    bearish: []   // Consolidation that broke DOWN (high sweep = inducement)
  };

  const lookbackWindow = 50;
  const recentCandles = candles.slice(-lookbackWindow);

  // Calculate ATR for range identification
  const atr = calculateATR(candles.slice(-20));

  // Identify potential consolidation ranges
  for (let startIdx = 0; startIdx < recentCandles.length - 25; startIdx++) {
    const rangeCandles = recentCandles.slice(startIdx, startIdx + 25);

    // Define range boundaries
    const rangeHigh = Math.max(...rangeCandles.map(c => c.high));
    const rangeLow = Math.min(...rangeCandles.map(c => c.low));
    const rangeSize = rangeHigh - rangeLow;
    const rangeMidpoint = (rangeHigh + rangeLow) / 2;

    // Check if it's a tight consolidation (< 2 ATR)
    if (rangeSize > atr * 2) continue;

    // Check range percentage (1-2% is typical consolidation)
    const rangeSizePercent = (rangeSize / rangeMidpoint) * 100;
    if (rangeSizePercent < 0.5 || rangeSizePercent > 3) continue;

    // Find sweeps above and below the range
    let sweepAbove = null;
    let sweepBelow = null;

    for (let i = 0; i < rangeCandles.length; i++) {
      const candle = rangeCandles[i];

      // Sweep above: wick exceeds range high, body closes back inside
      if (candle.high > rangeHigh * 1.002 && candle.close < rangeHigh) {
        if (!sweepAbove || candle.high > sweepAbove.high) {
          sweepAbove = { index: startIdx + i, high: candle.high, timestamp: candle.timestamp, candle };
        }
      }

      // Sweep below: wick exceeds range low, body closes back inside
      if (candle.low < rangeLow * 0.998 && candle.close > rangeLow) {
        if (!sweepBelow || candle.low < sweepBelow.low) {
          sweepBelow = { index: startIdx + i, low: candle.low, timestamp: candle.timestamp, candle };
        }
      }
    }

    // Power of 3 requires BOTH sides to be swept
    if (!sweepAbove || !sweepBelow) continue;

    // Check for final breakout (distribution phase)
    const afterRange = recentCandles.slice(startIdx + 25, Math.min(startIdx + 35, recentCandles.length));
    if (afterRange.length < 3) continue;

    let breakoutDirection = null;
    let breakoutCandle = null;

    for (const candle of afterRange) {
      // Bullish breakout: breaks decisively above range
      if (candle.close > rangeHigh * 1.005) {
        breakoutDirection = 'bullish';
        breakoutCandle = candle;
        break;
      }

      // Bearish breakout: breaks decisively below range
      if (candle.close < rangeLow * 0.995) {
        breakoutDirection = 'bearish';
        breakoutCandle = candle;
        break;
      }
    }

    if (!breakoutDirection) continue;

    // Determine strength: time between sweeps (closer = stronger manipulation)
    const sweepTimeDiff = Math.abs(sweepAbove.index - sweepBelow.index);
    const strength = sweepTimeDiff < 10 ? 'strong' : 'moderate';

    // BULLISH breakout → Low sweep was inducement (trapped shorts)
    if (breakoutDirection === 'bullish') {
      inducements.bullish.push({
        type: 'consolidation_inducement',
        direction: 'bullish',
        rangeTop: rangeHigh,
        rangeBottom: rangeLow,
        rangeStartIndex: startIdx,
        rangeEndIndex: startIdx + 25,
        rangeDuration: 25,
        sweepAboveCandle: sweepAbove,
        sweepBelowCandle: sweepBelow,
        manipulation: 'both_sides',
        inducementZone: { top: sweepBelow.low * 1.001, bottom: rangeLow * 0.998 },
        inducementLevel: sweepBelow.low,
        strength,
        candle: sweepBelow.candle,
        timestamp: sweepBelow.timestamp
      });
    }

    // BEARISH breakout → High sweep was inducement (trapped longs)
    if (breakoutDirection === 'bearish') {
      inducements.bearish.push({
        type: 'consolidation_inducement',
        direction: 'bearish',
        rangeTop: rangeHigh,
        rangeBottom: rangeLow,
        rangeStartIndex: startIdx,
        rangeEndIndex: startIdx + 25,
        rangeDuration: 25,
        sweepAboveCandle: sweepAbove,
        sweepBelowCandle: sweepBelow,
        manipulation: 'both_sides',
        inducementZone: { top: rangeHigh * 1.002, bottom: sweepAbove.high * 0.999 },
        inducementLevel: sweepAbove.high,
        strength,
        candle: sweepAbove.candle,
        timestamp: sweepAbove.timestamp
      });
    }
  }

  return inducements;
}

/**
 * Detects Premature Reversal Inducement
 * Reversal occurs before reaching valid OB/FVG zone (low confluence)
 * Indicates deeper zone will be reached
 *
 * @param {Array} candles - Array of candle objects
 * @param {Object} orderBlocks - Order blocks object
 * @param {Object} fvgs - FVG object
 * @param {Object} structure - Market structure object
 * @returns {Object} { bullish: [], bearish: [] }
 */
function detectPrematureReversalInducement(candles, orderBlocks, fvgs, structure) {
  if (!candles || candles.length < 30 || !structure) {
    return { bullish: [], bearish: [] };
  }

  const inducements = {
    bullish: [],  // Premature bullish reversal (expect deeper demand)
    bearish: []   // Premature bearish reversal (expect deeper supply)
  };

  const lookbackWindow = 20;
  const recentCandles = candles.slice(-lookbackWindow);

  // Helper: Check if OB or FVG exists near price level
  const hasNearbyZone = (price, zones, tolerance = 0.005) => {
    return zones.some(zone => {
      const zoneTop = zone.top || zone.high;
      const zoneBottom = zone.bottom || zone.low;
      const zoneMid = (zoneTop + zoneBottom) / 2;
      const distance = Math.abs(price - zoneMid) / price;
      return distance < tolerance;
    });
  };

  // Helper: Detect reversal candle patterns
  const isReversalCandle = (current, previous) => {
    // Bullish reversal: long lower wick, closes near high
    const bullishReversal = (current.close > current.open) &&
      ((current.open - current.low) / (current.high - current.low) > 0.6) &&
      (current.close > previous.close);

    // Bearish reversal: long upper wick, closes near low
    const bearishReversal = (current.close < current.open) &&
      ((current.high - current.open) / (current.high - current.low) > 0.6) &&
      (current.close < previous.close);

    return { bullish: bullishReversal, bearish: bearishReversal };
  };

  // Analyze each candle for premature reversals
  for (let i = 5; i < recentCandles.length - 1; i++) {
    const candle = recentCandles[i];
    const prevCandle = recentCandles[i - 1];
    const reversal = isReversalCandle(candle, prevCandle);

    // BEARISH TREND: Check for premature bullish reversal
    if (structure.trend === 'bearish' && reversal.bullish) {
      let confluenceScore = 0;
      const missingConfluence = [];

      // Check for bullish OB nearby
      const hasBullishOB = hasNearbyZone(
        candle.low,
        orderBlocks.bullish || [],
        0.005
      );
      if (hasBullishOB) {
        confluenceScore += 25;
      } else {
        missingConfluence.push('no_ob');
      }

      // Check for bullish FVG nearby
      const hasBullishFVG = hasNearbyZone(
        candle.low,
        fvgs.bullish || [],
        0.005
      );
      if (hasBullishFVG) {
        confluenceScore += 25;
      } else {
        missingConfluence.push('no_fvg');
      }

      // Check volume
      const avgVolume = recentCandles.slice(0, i).reduce((sum, c) => sum + c.volume, 0) / i;
      if (candle.volume > avgVolume * 1.5) {
        confluenceScore += 15;
      } else {
        missingConfluence.push('weak_volume');
      }

      // If confluence is low, it's a premature reversal (inducement)
      if (confluenceScore < 30) {
        inducements.bullish.push({
          type: 'premature_reversal_inducement',
          direction: 'bullish',
          reversalPrice: candle.low,
          reversalCandle: { index: i, timestamp: candle.timestamp },
          missingConfluence,
          confluenceScore,
          expectedDeeper: {
            direction: 'bullish',
            reason: 'expect_deeper_demand'
          },
          strength: confluenceScore < 15 ? 'weak' : 'moderate',
          inducementLevel: candle.low,
          candle,
          timestamp: candle.timestamp
        });
      }
    }

    // BULLISH TREND: Check for premature bearish reversal
    if (structure.trend === 'bullish' && reversal.bearish) {
      let confluenceScore = 0;
      const missingConfluence = [];

      // Check for bearish OB nearby
      const hasBearishOB = hasNearbyZone(
        candle.high,
        orderBlocks.bearish || [],
        0.005
      );
      if (hasBearishOB) {
        confluenceScore += 25;
      } else {
        missingConfluence.push('no_ob');
      }

      // Check for bearish FVG nearby
      const hasBearishFVG = hasNearbyZone(
        candle.high,
        fvgs.bearish || [],
        0.005
      );
      if (hasBearishFVG) {
        confluenceScore += 25;
      } else {
        missingConfluence.push('no_fvg');
      }

      // Check volume
      const avgVolume = recentCandles.slice(0, i).reduce((sum, c) => sum + c.volume, 0) / i;
      if (candle.volume > avgVolume * 1.5) {
        confluenceScore += 15;
      } else {
        missingConfluence.push('weak_volume');
      }

      // If confluence is low, it's a premature reversal
      if (confluenceScore < 30) {
        inducements.bearish.push({
          type: 'premature_reversal_inducement',
          direction: 'bearish',
          reversalPrice: candle.high,
          reversalCandle: { index: i, timestamp: candle.timestamp },
          missingConfluence,
          confluenceScore,
          expectedDeeper: {
            direction: 'bearish',
            reason: 'expect_deeper_supply'
          },
          strength: confluenceScore < 15 ? 'weak' : 'moderate',
          inducementLevel: candle.high,
          candle,
          timestamp: candle.timestamp
        });
      }
    }
  }

  return inducements;
}

/**
 * Detects First Pullback Inducement
 * First pullback after BOS is often inducement (gets violated for deeper zone)
 * TRUE entry is at second pullback or deeper zone
 *
 * @param {Array} candles - Array of candle objects
 * @param {Object} bos - BOS detection results
 * @param {Object} orderBlocks - Order blocks object
 * @param {Object} fvgs - FVG object
 * @returns {Object} { bullish: [], bearish: [] }
 */
function detectFirstPullbackInducement(candles, bos, orderBlocks, fvgs) {
  if (!candles || candles.length < 30) {
    return { bullish: [], bearish: [] };
  }

  const inducements = {
    bullish: [],  // First pullback in bullish BOS (expect violation down)
    bearish: []   // First pullback in bearish BOS (expect violation up)
  };

  const lookbackWindow = 30;
  const recentCandles = candles.slice(-lookbackWindow);

  // Helper: Find nearest zone to price
  const findNearestZone = (price, zones, direction) => {
    if (!zones || zones.length === 0) return null;

    let nearest = null;
    let minDistance = Infinity;

    for (const zone of zones) {
      const zoneTop = zone.top || zone.high;
      const zoneBottom = zone.bottom || zone.low;
      const zoneMid = (zoneTop + zoneBottom) / 2;
      const distance = Math.abs(price - zoneMid);

      // Check if price touched the zone
      const touched = (direction === 'bullish' && price <= zoneTop && price >= zoneBottom) ||
                     (direction === 'bearish' && price >= zoneBottom && price <= zoneTop);

      if (touched && distance < minDistance) {
        minDistance = distance;
        nearest = { ...zone, top: zoneTop, bottom: zoneBottom };
      }
    }

    return nearest;
  };

  // Process bullish BOS events (looking for downward pullback)
  if (bos && bos.bullish && bos.bullish.length > 0) {
    for (const bosEvent of bos.bullish.slice(-3)) { // Check last 3 BOS events
      const bosIndex = recentCandles.findIndex(c =>
        c.timestamp === bosEvent.timestamp ||
        Math.abs(c.high - bosEvent.breakLevel) < bosEvent.breakLevel * 0.001
      );

      if (bosIndex === -1 || bosIndex >= recentCandles.length - 10) continue;

      // Track price after BOS
      const afterBOS = recentCandles.slice(bosIndex + 1, Math.min(bosIndex + 20, recentCandles.length));
      if (afterBOS.length < 5) continue;

      // Find first pullback (retracement down after bullish BOS)
      let pullbackStart = null;
      let pullbackLow = Infinity;
      let pullbackCandle = null;

      for (let i = 0; i < afterBOS.length; i++) {
        const candle = afterBOS[i];

        // Pullback: price moves down (at least 38.2% retracement)
        if (candle.low < bosEvent.breakLevel) {
          if (pullbackStart === null) {
            pullbackStart = i;
          }

          if (candle.low < pullbackLow) {
            pullbackLow = candle.low;
            pullbackCandle = { ...candle, index: bosIndex + 1 + i };
          }
        }
      }

      if (!pullbackCandle) continue;

      // Find first zone touched during pullback
      const allBullishZones = [
        ...(orderBlocks.bullish || []).map(ob => ({ ...ob, zoneType: 'ob' })),
        ...(fvgs.bullish || []).map(fvg => ({ ...fvg, zoneType: 'fvg' }))
      ];

      const touchedZone = findNearestZone(pullbackLow, allBullishZones, 'bullish');

      if (touchedZone) {
        const strength = (bosEvent.breakLevel - pullbackLow) / bosEvent.breakLevel > 0.02 ? 'strong' : 'moderate';

        inducements.bullish.push({
          type: 'first_pullback_inducement',
          direction: 'bullish',
          bosEvent: {
            breakLevel: bosEvent.breakLevel,
            timestamp: bosEvent.timestamp,
            index: bosIndex
          },
          pullbackStartIndex: pullbackStart,
          firstZoneTouched: {
            top: touchedZone.top,
            bottom: touchedZone.bottom,
            type: touchedZone.zoneType,
            index: pullbackCandle.index
          },
          touchCandle: {
            index: pullbackCandle.index,
            price: pullbackLow,
            timestamp: pullbackCandle.timestamp
          },
          isFirstPullback: true,
          expectedDeeperZone: {
            price: pullbackLow * 0.98, // Expect 2% deeper
            reason: 'expect_violation_to_deeper_zone'
          },
          strength,
          inducementLevel: (touchedZone.top + touchedZone.bottom) / 2,
          candle: pullbackCandle,
          timestamp: pullbackCandle.timestamp
        });
      }
    }
  }

  // Process bearish BOS events (looking for upward pullback)
  if (bos && bos.bearish && bos.bearish.length > 0) {
    for (const bosEvent of bos.bearish.slice(-3)) {
      const bosIndex = recentCandles.findIndex(c =>
        c.timestamp === bosEvent.timestamp ||
        Math.abs(c.low - bosEvent.breakLevel) < bosEvent.breakLevel * 0.001
      );

      if (bosIndex === -1 || bosIndex >= recentCandles.length - 10) continue;

      const afterBOS = recentCandles.slice(bosIndex + 1, Math.min(bosIndex + 20, recentCandles.length));
      if (afterBOS.length < 5) continue;

      let pullbackStart = null;
      let pullbackHigh = -Infinity;
      let pullbackCandle = null;

      for (let i = 0; i < afterBOS.length; i++) {
        const candle = afterBOS[i];

        if (candle.high > bosEvent.breakLevel) {
          if (pullbackStart === null) {
            pullbackStart = i;
          }

          if (candle.high > pullbackHigh) {
            pullbackHigh = candle.high;
            pullbackCandle = { ...candle, index: bosIndex + 1 + i };
          }
        }
      }

      if (!pullbackCandle) continue;

      const allBearishZones = [
        ...(orderBlocks.bearish || []).map(ob => ({ ...ob, zoneType: 'ob' })),
        ...(fvgs.bearish || []).map(fvg => ({ ...fvg, zoneType: 'fvg' }))
      ];

      const touchedZone = findNearestZone(pullbackHigh, allBearishZones, 'bearish');

      if (touchedZone) {
        const strength = (pullbackHigh - bosEvent.breakLevel) / bosEvent.breakLevel > 0.02 ? 'strong' : 'moderate';

        inducements.bearish.push({
          type: 'first_pullback_inducement',
          direction: 'bearish',
          bosEvent: {
            breakLevel: bosEvent.breakLevel,
            timestamp: bosEvent.timestamp,
            index: bosIndex
          },
          pullbackStartIndex: pullbackStart,
          firstZoneTouched: {
            top: touchedZone.top,
            bottom: touchedZone.bottom,
            type: touchedZone.zoneType,
            index: pullbackCandle.index
          },
          touchCandle: {
            index: pullbackCandle.index,
            price: pullbackHigh,
            timestamp: pullbackCandle.timestamp
          },
          isFirstPullback: true,
          expectedDeeperZone: {
            price: pullbackHigh * 1.02, // Expect 2% higher
            reason: 'expect_violation_to_deeper_zone'
          },
          strength,
          inducementLevel: (touchedZone.top + touchedZone.bottom) / 2,
          candle: pullbackCandle,
          timestamp: pullbackCandle.timestamp
        });
      }
    }
  }

  return inducements;
}

/**
 * Helper: Deduplicates overlapping inducements (keeps strongest)
 * @param {Array} inducements - Array of inducement objects
 * @returns {Array} Deduplicated array
 */
function deduplicateInducements(inducements) {
  if (!inducements || inducements.length <= 1) return inducements;

  const deduplicated = [];
  const used = new Set();

  // Sort by priority first
  const typePriority = {
    'first_pullback_inducement': 5,
    'supply_demand_inducement': 4,
    'consolidation_inducement': 3,
    'premature_reversal_inducement': 2,
    'inducement': 1
  };

  const sorted = [...inducements].sort((a, b) => {
    const priorityDiff = (typePriority[b.type] || 0) - (typePriority[a.type] || 0);
    if (priorityDiff !== 0) return priorityDiff;

    const strengthValue = { strong: 3, moderate: 2, weak: 1 };
    return (strengthValue[b.strength] || 0) - (strengthValue[a.strength] || 0);
  });

  for (const ind of sorted) {
    const level = ind.inducementLevel;

    // Check if overlaps with existing
    let overlaps = false;
    for (const existing of deduplicated) {
      const existingLevel = existing.inducementLevel;
      const distance = Math.abs(level - existingLevel) / level;

      // If within 1% of each other, consider overlap
      if (distance < 0.01) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      deduplicated.push(ind);
    }
  }

  return deduplicated;
}

/**
 * MASTER INDUCEMENT DETECTION FUNCTION
 * Combines all 5 inducement detection methods from the PDF
 * Replaces the old detectInducementZones() with enhanced version
 *
 * @param {Array} candles - Array of candle objects
 * @param {Object} structure - Market structure object
 * @param {Object} orderBlocks - Order blocks object
 * @param {Object} fvgs - FVG object
 * @param {Object} bos - BOS detection results
 * @param {Array} swingPoints - Array of swing highs and lows
 * @returns {Object} { bullish: [], bearish: [] }
 */
function detectEnhancedInducementZones(candles, structure, orderBlocks, fvgs, bos, swingPoints) {
  if (!candles || candles.length < 20) {
    return { bullish: [], bearish: [] };
  }

  const allInducements = {
    bullish: [],
    bearish: []
  };

  try {
    // 1. Basic inducement (existing logic - stop hunts)
    const basic = detectBasicInducement(candles, structure || {});
    if (basic.bullish) allInducements.bullish.push(...basic.bullish);
    if (basic.bearish) allInducements.bearish.push(...basic.bearish);

    // 2. Supply/Demand Zone Inducement (zone violations) - DISABLED: 7.1% win rate
    // REMOVED: This pattern was causing 7.1% win rate in backtests
    // if (orderBlocks && fvgs) {
    //   const sdInducement = detectSupplyDemandInducement(candles, orderBlocks, fvgs);
    //   if (sdInducement.bullish) allInducements.bullish.push(...sdInducement.bullish);
    //   if (sdInducement.bearish) allInducements.bearish.push(...sdInducement.bearish);
    // }

    // 3. Consolidation Inducement (Power of 3)
    if (swingPoints && swingPoints.length > 0) {
      const consolidation = detectConsolidationInducement(candles, swingPoints);
      if (consolidation.bullish) allInducements.bullish.push(...consolidation.bullish);
      if (consolidation.bearish) allInducements.bearish.push(...consolidation.bearish);
    }

    // 4. Premature Reversal Inducement (weak reversals)
    if (orderBlocks && fvgs && structure) {
      const premature = detectPrematureReversalInducement(candles, orderBlocks, fvgs, structure);
      if (premature.bullish) allInducements.bullish.push(...premature.bullish);
      if (premature.bearish) allInducements.bearish.push(...premature.bearish);
    }

    // 5. First Pullback Inducement (post-BOS)
    if (bos && orderBlocks && fvgs) {
      const firstPullback = detectFirstPullbackInducement(candles, bos, orderBlocks, fvgs);
      if (firstPullback.bullish) allInducements.bullish.push(...firstPullback.bullish);
      if (firstPullback.bearish) allInducements.bearish.push(...firstPullback.bearish);
    }
  } catch (error) {
    console.error('Error in enhanced inducement detection:', error);
    // Return what we have so far
  }

  // Deduplication: Remove overlapping inducements (keep strongest)
  allInducements.bullish = deduplicateInducements(allInducements.bullish);
  allInducements.bearish = deduplicateInducements(allInducements.bearish);

  // Sort by recency (most recent first)
  allInducements.bullish.sort((a, b) => {
    const aIndex = a.candle?.index || a.reversalCandle?.index || 0;
    const bIndex = b.candle?.index || b.reversalCandle?.index || 0;
    return bIndex - aIndex;
  });
  allInducements.bearish.sort((a, b) => {
    const aIndex = a.candle?.index || a.reversalCandle?.index || 0;
    const bIndex = b.candle?.index || b.reversalCandle?.index || 0;
    return bIndex - aIndex;
  });

  return allInducements;
}

// Alias for backward compatibility
const detectInducementZones = detectEnhancedInducementZones;

/**
 * ============================================================================
 * ENHANCED PATTERN TRACKING
 * ============================================================================
 */

/**
 * Dynamically tracks Fair Value Gap (FVG) fill/mitigation levels
 * Categorizes FVGs as: unfilled, touched, partial, or filled
 *
 * @param {Object} fvgs - FVG object with bullish and bearish arrays
 * @param {Array} candles - Array of candle objects
 * @returns {Object} Enhanced FVG tracking with mitigation status
 */
function trackFVGMitigation(fvgs, candles) {
  if (!fvgs || !candles || candles.length < 10) {
    return {
      unfilled: { bullish: [], bearish: [] },
      touched: { bullish: [], bearish: [] },
      partial: { bullish: [], bearish: [] },
      filled: { bullish: [], bearish: [] }
    };
  }

  const tracked = {
    unfilled: { bullish: [], bearish: [] },
    touched: { bullish: [], bearish: [] },
    partial: { bullish: [], bearish: [] },
    filled: { bullish: [], bearish: [] }
  };

  // Track bullish FVGs
  for (const fvg of fvgs.bullish || []) {
    const fvgIndex = candles.findIndex(c => c.timestamp === fvg.timestamp);
    if (fvgIndex === -1) continue;

    // Check candles after the FVG for mitigation
    const laterCandles = candles.slice(fvgIndex + 1);

    let fillPercentage = 0;
    let touchCount = 0;
    let highestFill = fvg.gap.bottom; // Start from bottom of gap

    for (const candle of laterCandles) {
      // Check if price entered the FVG
      if (candle.low <= fvg.gap.top && candle.high >= fvg.gap.bottom) {
        touchCount++;

        // Calculate how much of the gap was filled
        const gapSize = fvg.gap.top - fvg.gap.bottom;
        const fillLevel = Math.min(candle.low, fvg.gap.top);

        if (fillLevel > highestFill) {
          highestFill = fillLevel;
        }

        const filled = highestFill - fvg.gap.bottom;
        fillPercentage = (filled / gapSize) * 100;
      }
    }

    // Categorize based on fill percentage
    const enhancedFVG = {
      ...fvg,
      fillPercentage: Math.round(fillPercentage),
      touchCount: touchCount,
      highestFill: highestFill,
      strength: fillPercentage === 0 ? 'strong' : fillPercentage < 50 ? 'moderate' : 'weak'
    };

    if (fillPercentage === 0) {
      tracked.unfilled.bullish.push(enhancedFVG);
    } else if (fillPercentage < 30) {
      tracked.touched.bullish.push(enhancedFVG);
    } else if (fillPercentage < 80) {
      tracked.partial.bullish.push(enhancedFVG);
    } else {
      tracked.filled.bullish.push(enhancedFVG);
    }
  }

  // Track bearish FVGs
  for (const fvg of fvgs.bearish || []) {
    const fvgIndex = candles.findIndex(c => c.timestamp === fvg.timestamp);
    if (fvgIndex === -1) continue;

    const laterCandles = candles.slice(fvgIndex + 1);

    let fillPercentage = 0;
    let touchCount = 0;
    let lowestFill = fvg.gap.top; // Start from top of gap

    for (const candle of laterCandles) {
      if (candle.high >= fvg.gap.bottom && candle.low <= fvg.gap.top) {
        touchCount++;

        const gapSize = fvg.gap.top - fvg.gap.bottom;
        const fillLevel = Math.max(candle.high, fvg.gap.bottom);

        if (fillLevel < lowestFill) {
          lowestFill = fillLevel;
        }

        const filled = fvg.gap.top - lowestFill;
        fillPercentage = (filled / gapSize) * 100;
      }
    }

    const enhancedFVG = {
      ...fvg,
      fillPercentage: Math.round(fillPercentage),
      touchCount: touchCount,
      lowestFill: lowestFill,
      strength: fillPercentage === 0 ? 'strong' : fillPercentage < 50 ? 'moderate' : 'weak'
    };

    if (fillPercentage === 0) {
      tracked.unfilled.bearish.push(enhancedFVG);
    } else if (fillPercentage < 30) {
      tracked.touched.bearish.push(enhancedFVG);
    } else if (fillPercentage < 80) {
      tracked.partial.bearish.push(enhancedFVG);
    } else {
      tracked.filled.bearish.push(enhancedFVG);
    }
  }

  return tracked;
}

/**
 * Detects Breaker Blocks - Order Blocks that failed and flipped polarity
 * Bullish OB broken = becomes bearish breaker (support → resistance)
 * Bearish OB broken = becomes bullish breaker (resistance → support)
 *
 * @param {Object} orderBlocks - Order blocks object
 * @param {Array} candles - Array of candle objects
 * @returns {Object} Breaker blocks: { bullish: [], bearish: [] }
 */
function detectBreakerBlocks(orderBlocks, candles) {
  if (!orderBlocks || !candles || candles.length < 10) {
    return { bullish: [], bearish: [] };
  }

  const breakerBlocks = {
    bullish: [],  // Failed bearish OB now acting as support
    bearish: []   // Failed bullish OB now acting as resistance
  };

  // Check bullish OBs for failure (price breaks below)
  for (const ob of orderBlocks.bullish || []) {
    const obIndex = candles.findIndex(c => c.timestamp === ob.timestamp);
    if (obIndex === -1) continue;

    // Check if price broke below the bullish OB (invalidation)
    const laterCandles = candles.slice(obIndex + 1);
    const breakBelow = laterCandles.find(c => c.close < ob.bottom);

    if (breakBelow) {
      // Bullish OB failed - now becomes bearish breaker (resistance)
      breakerBlocks.bearish.push({
        ...ob,
        type: 'breakerBlock',
        originalType: 'bullish',
        polarityChange: 'support_to_resistance',
        breakCandle: breakBelow,
        breakTimestamp: breakBelow.timestamp,
        priority: 'high', // Breaker blocks are high priority
        description: 'Failed bullish OB, now resistance'
      });
    }
  }

  // Check bearish OBs for failure (price breaks above)
  for (const ob of orderBlocks.bearish || []) {
    const obIndex = candles.findIndex(c => c.timestamp === ob.timestamp);
    if (obIndex === -1) continue;

    const laterCandles = candles.slice(obIndex + 1);
    const breakAbove = laterCandles.find(c => c.close > ob.top);

    if (breakAbove) {
      // Bearish OB failed - now becomes bullish breaker (support)
      breakerBlocks.bullish.push({
        ...ob,
        type: 'breakerBlock',
        originalType: 'bearish',
        polarityChange: 'resistance_to_support',
        breakCandle: breakAbove,
        breakTimestamp: breakAbove.timestamp,
        priority: 'high',
        description: 'Failed bearish OB, now support'
      });
    }
  }

  return breakerBlocks;
}

/**
 * ============================================================================
 * VOLUME ANALYSIS
 * ============================================================================
 */

/**
 * Analyzes volume patterns for institutional confirmation
 * High volume = institutional activity, validates patterns
 *
 * @param {Array} candles - Array of candle objects
 * @returns {Object} Volume analysis with confirmation strength
 */
function analyzeVolume(candles) {
  if (!candles || candles.length < 20) {
    return {
      confirmation: 'weak',
      avgVolume: 0,
      currentVolume: 0,
      volumeRatio: 1,
      climaxDetected: false,
      divergence: false,
      trend: 'neutral'
    };
  }

  const recentCandles = candles.slice(-20);
  const latestCandle = candles[candles.length - 1];

  // Calculate average volume (exclude latest for comparison)
  const volumeHistory = recentCandles.slice(0, -1).map(c => c.volume || 0);
  const avgVolume = volumeHistory.reduce((sum, v) => sum + v, 0) / volumeHistory.length;

  const currentVolume = latestCandle.volume || 0;
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;

  // Volume climax detection (extremely high volume)
  // Climax often marks exhaustion/reversal points
  const climaxThreshold = 2.5; // 250% of average
  const climaxDetected = volumeRatio >= climaxThreshold;

  // Volume divergence detection
  // Price making new highs/lows but volume decreasing = divergence
  let divergence = false;

  if (recentCandles.length >= 10) {
    const first5 = recentCandles.slice(0, 5);
    const last5 = recentCandles.slice(-5);

    const first5AvgPrice = first5.reduce((sum, c) => sum + c.close, 0) / 5;
    const last5AvgPrice = last5.reduce((sum, c) => sum + c.close, 0) / 5;

    const first5AvgVolume = first5.reduce((sum, c) => sum + (c.volume || 0), 0) / 5;
    const last5AvgVolume = last5.reduce((sum, c) => sum + (c.volume || 0), 0) / 5;

    // Price up but volume down = bearish divergence
    // Price down but volume down = bullish divergence (capitulation)
    if (last5AvgPrice > first5AvgPrice && last5AvgVolume < first5AvgVolume * 0.7) {
      divergence = 'bearish'; // Price up, volume down
    } else if (last5AvgPrice < first5AvgPrice && last5AvgVolume < first5AvgVolume * 0.7) {
      divergence = 'bullish'; // Price down, volume down
    }
  }

  // Volume trend (increasing or decreasing)
  const earlyVolumes = recentCandles.slice(0, 10).map(c => c.volume || 0);
  const lateVolumes = recentCandles.slice(-10).map(c => c.volume || 0);

  const earlyAvg = earlyVolumes.reduce((sum, v) => sum + v, 0) / earlyVolumes.length;
  const lateAvg = lateVolumes.reduce((sum, v) => sum + v, 0) / lateVolumes.length;

  let volumeTrend = 'neutral';
  if (lateAvg > earlyAvg * 1.2) {
    volumeTrend = 'increasing';
  } else if (lateAvg < earlyAvg * 0.8) {
    volumeTrend = 'decreasing';
  }

  // Determine confirmation strength
  let confirmation;

  if (volumeRatio >= 1.5 && !divergence && volumeTrend === 'increasing') {
    // High volume, no divergence, increasing trend = strong
    confirmation = 'strong';
  } else if (volumeRatio >= 1.2 || volumeTrend === 'increasing') {
    // Moderate volume or increasing trend = moderate
    confirmation = 'moderate';
  } else if (volumeRatio < 0.7 || divergence) {
    // Low volume or divergence present = weak
    confirmation = 'weak';
  } else {
    // Average conditions = moderate
    confirmation = 'moderate';
  }

  return {
    confirmation: confirmation,
    avgVolume: Math.round(avgVolume),
    currentVolume: Math.round(currentVolume),
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    climaxDetected: climaxDetected,
    divergence: divergence,
    volumeTrend: volumeTrend,
    details: {
      highVolume: volumeRatio >= 1.5,
      lowVolume: volumeRatio < 0.7,
      climaxWarning: climaxDetected ? 'Potential exhaustion/reversal' : null
    }
  };
}
