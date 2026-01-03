/**
 * Market Regime Detection - ADX-based trend strength analysis
 * Filters out choppy/ranging markets to improve win rate
 */

/**
 * Calculate True Range for ATR and ADX calculations
 */
function calculateTrueRange(candles) {
  const tr = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);

    tr.push(Math.max(tr1, tr2, tr3));
  }

  return tr;
}

/**
 * Calculate Average Directional Index (ADX)
 * Measures trend strength (not direction)
 *
 * @param {Array} candles - Array of OHLCV candles
 * @param {number} period - ADX period (default 14)
 * @returns {number} ADX value (0-100, higher = stronger trend)
 */
export function calculateADX(candles, period = 14) {
  if (candles.length < period + 1) {
    return 0;
  }

  // Calculate directional movement
  const plusDM = [];
  const minusDM = [];

  for (let i = 1; i < candles.length; i++) {
    const highDiff = candles[i].high - candles[i - 1].high;
    const lowDiff = candles[i - 1].low - candles[i].low;

    if (highDiff > lowDiff && highDiff > 0) {
      plusDM.push(highDiff);
      minusDM.push(0);
    } else if (lowDiff > highDiff && lowDiff > 0) {
      plusDM.push(0);
      minusDM.push(lowDiff);
    } else {
      plusDM.push(0);
      minusDM.push(0);
    }
  }

  // Calculate True Range
  const tr = calculateTrueRange(candles);

  // Smooth the values using Wilder's smoothing
  const smoothPlusDM = [];
  const smoothMinusDM = [];
  const smoothTR = [];

  // First smoothed value is simple average
  let sumPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let sumMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let sumTR = tr.slice(0, period).reduce((a, b) => a + b, 0);

  smoothPlusDM.push(sumPlusDM);
  smoothMinusDM.push(sumMinusDM);
  smoothTR.push(sumTR);

  // Subsequent values use Wilder's smoothing
  for (let i = period; i < plusDM.length; i++) {
    sumPlusDM = sumPlusDM - (sumPlusDM / period) + plusDM[i];
    sumMinusDM = sumMinusDM - (sumMinusDM / period) + minusDM[i];
    sumTR = sumTR - (sumTR / period) + tr[i];

    smoothPlusDM.push(sumPlusDM);
    smoothMinusDM.push(sumMinusDM);
    smoothTR.push(sumTR);
  }

  // Calculate Directional Indicators (DI+ and DI-)
  const plusDI = smoothPlusDM.map((val, i) => (val / smoothTR[i]) * 100);
  const minusDI = smoothMinusDM.map((val, i) => (val / smoothTR[i]) * 100);

  // Calculate Directional Index (DX)
  const dx = plusDI.map((val, i) => {
    const sum = val + minusDI[i];
    if (sum === 0) return 0;
    return (Math.abs(val - minusDI[i]) / sum) * 100;
  });

  // Calculate ADX (smoothed DX)
  if (dx.length < period) return 0;

  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < dx.length; i++) {
    adx = ((adx * (period - 1)) + dx[i]) / period;
  }

  return adx;
}

/**
 * Calculate Bollinger Band Width
 * Measures market volatility/compression
 *
 * @param {Array} candles - Array of OHLCV candles
 * @param {number} period - BB period (default 20)
 * @param {number} stdDev - Standard deviations (default 2)
 * @returns {number} BB width as percentage of price
 */
export function calculateBollingerBandWidth(candles, period = 20, stdDev = 2) {
  if (candles.length < period) {
    return 0;
  }

  const recentCandles = candles.slice(-period);

  // Calculate SMA (middle band)
  const closes = recentCandles.map(c => c.close);
  const sma = closes.reduce((a, b) => a + b, 0) / period;

  // Calculate standard deviation
  const squaredDiffs = closes.map(close => Math.pow(close - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const stdDeviation = Math.sqrt(variance);

  // Upper and lower bands
  const upperBand = sma + (stdDeviation * stdDev);
  const lowerBand = sma - (stdDeviation * stdDev);

  // Band width
  const bandWidth = upperBand - lowerBand;

  // Return as percentage of price
  return bandWidth;
}

/**
 * Detect market regime based on ADX and Bollinger Band width
 *
 * @param {Array} candles - Array of OHLCV candles
 * @returns {Object} Market regime analysis
 */
export function detectMarketRegime(candles) {
  if (candles.length < 50) {
    return {
      regime: 'INSUFFICIENT_DATA',
      adx: 0,
      bbWidthPercent: 0,
      recommendation: {
        action: 'CAUTIOUS',
        targetR: 1.5,
        trailingStart: 1.5,
        partialClose: true,
        message: 'Insufficient data for regime analysis'
      }
    };
  }

  const adx = calculateADX(candles, 14);
  const bbWidth = calculateBollingerBandWidth(candles, 20);

  const avgPrice = candles.slice(-50).reduce((sum, c) => sum + c.close, 0) / 50;
  const bbWidthPercent = (bbWidth / avgPrice) * 100;

  let regime;

  // Strong trending market: High ADX + High volatility
  if (adx > 25 && bbWidthPercent > 3.0) {
    regime = 'STRONG_TREND';
  }
  // Weak/developing trend: Moderate ADX
  else if (adx > 20 && adx <= 25) {
    regime = 'WEAK_TREND';
  }
  // Tight range: Low ADX + Low volatility
  else if (adx <= 20 && bbWidthPercent < 1.5) {
    regime = 'TIGHT_RANGE';
  }
  // Choppy: Neither trending nor ranging
  else {
    regime = 'CHOPPY';
  }

  return {
    regime,
    adx: parseFloat(adx.toFixed(2)),
    bbWidthPercent: parseFloat(bbWidthPercent.toFixed(2)),
    recommendation: getRegimeRecommendation(regime)
  };
}

/**
 * Get trading recommendations based on market regime
 *
 * @param {string} regime - Market regime type
 * @returns {Object} Trading recommendations
 */
function getRegimeRecommendation(regime) {
  const recommendations = {
    'STRONG_TREND': {
      action: 'AGGRESSIVE',
      targetR: 3.0,
      trailingStart: 1.0,  // Start trailing earlier in trends
      partialClose: false,  // Don't scale out - let winners run
      allowEntry: true,
      message: 'Strong trend - maximize position and let it run'
    },
    'WEAK_TREND': {
      action: 'MODERATE',
      targetR: 2.0,
      trailingStart: 1.5,
      partialClose: true,
      allowEntry: true,
      message: 'Developing trend - standard approach'
    },
    'TIGHT_RANGE': {
      action: 'AVOID',
      targetR: 1.5,
      trailingStart: null,  // No trailing in tight ranges
      partialClose: true,   // Take quick profits
      allowEntry: false,     // ⚠️ Skip signals in tight ranges
      message: 'Ranging market - avoid or scalp only'
    },
    'CHOPPY': {
      action: 'CAUTIOUS',
      targetR: 1.8,
      trailingStart: 1.5,
      partialClose: true,
      allowEntry: true,      // Allow but with caution
      message: 'Choppy conditions - reduce confidence'
    },
    'INSUFFICIENT_DATA': {
      action: 'CAUTIOUS',
      targetR: 1.5,
      trailingStart: 1.5,
      partialClose: true,
      allowEntry: true,
      message: 'Insufficient data for regime analysis'
    }
  };

  return recommendations[regime] || recommendations['CAUTIOUS'];
}

/**
 * Apply regime filter to signal generation
 * Returns whether signal should be allowed based on market regime
 *
 * @param {Object} regimeData - Market regime data
 * @param {string} mode - Trading mode (conservative/moderate/aggressive/scalping)
 * @returns {boolean} Whether to allow signal generation
 */
export function shouldAllowSignal(regimeData, mode) {
  const { regime, recommendation } = regimeData;

  // Always skip tight ranges (unless scalping mode)
  if (regime === 'TIGHT_RANGE' && mode !== 'scalping') {
    return false;
  }

  // Conservative/Elite modes only trade strong trends
  if ((mode === 'conservative' || mode === 'elite' || mode === 'sniper') &&
      (regime === 'CHOPPY' || regime === 'TIGHT_RANGE')) {
    return false;
  }

  // Allow signal by default
  return recommendation.allowEntry !== false;
}

/**
 * Adjust confluence score based on market regime
 * Boosts score in strong trends, penalizes in choppy markets
 *
 * @param {number} baseScore - Original confluence score
 * @param {Object} regimeData - Market regime data
 * @returns {number} Adjusted confluence score
 */
export function adjustConfluenceForRegime(baseScore, regimeData) {
  const { regime } = regimeData;

  const adjustments = {
    'STRONG_TREND': 10,     // +10 bonus in strong trends
    'WEAK_TREND': 5,        // +5 bonus in developing trends
    'CHOPPY': -10,          // -10 penalty in choppy markets
    'TIGHT_RANGE': -15,     // -15 penalty in tight ranges
    'INSUFFICIENT_DATA': 0   // No adjustment
  };

  const adjustment = adjustments[regime] || 0;
  return Math.max(0, Math.min(145, baseScore + adjustment));
}
