/**
 * SMC (Smart Money Concept) Detection Algorithms
 * This module contains all the pattern detection logic for SMC trading strategy
 */

/**
 * Identifies swing highs and swing lows in price data
 * A swing high has a higher high than surrounding candles
 * A swing low has a lower low than surrounding candles
 * @param {Array} candles - Array of kline objects
 * @param {number} lookback - Number of candles to look back/forward (default: 2)
 * @returns {Object} Object with swingHighs and swingLows arrays
 */
export function detectSwingPoints(candles, lookback = 2) {
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
 * @returns {Array} Array of FVG objects
 */
export function detectFairValueGaps(candles) {
  const fvgs = [];

  for (let i = 2; i < candles.length; i++) {
    const prev2 = candles[i - 2];
    const prev1 = candles[i - 1];
    const current = candles[i];

    // Bullish FVG (gap up)
    const bullishGap = current.low - prev2.high;
    if (bullishGap > 0) {
      fvgs.push({
        type: 'bullish',
        index: i,
        top: current.low,
        bottom: prev2.high,
        gap: bullishGap,
        timestamp: current.timestamp,
        mitigated: false
      });
    }

    // Bearish FVG (gap down)
    const bearishGap = prev2.low - current.high;
    if (bearishGap > 0) {
      fvgs.push({
        type: 'bearish',
        index: i,
        top: prev2.low,
        bottom: current.high,
        gap: bearishGap,
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
export function detectOrderBlocks(candles, impulseThreshold = 0.01) {
  const orderBlocks = [];

  for (let i = 1; i < candles.length - 3; i++) {
    const current = candles[i];
    const next1 = candles[i + 1];
    const next2 = candles[i + 2];
    const next3 = candles[i + 3];

    // Check for bullish order block (down candle followed by strong up move)
    const isBearishCandle = current.close < current.open;
    const upMove = ((next3.high - current.low) / current.low) * 100;

    if (isBearishCandle && upMove >= impulseThreshold * 100) {
      orderBlocks.push({
        type: 'bullish',
        index: i,
        top: current.high,
        bottom: current.low,
        timestamp: current.timestamp,
        candle: current,
        strength: upMove
      });
    }

    // Check for bearish order block (up candle followed by strong down move)
    const isBullishCandle = current.close > current.open;
    const downMove = ((current.high - next3.low) / current.high) * 100;

    if (isBullishCandle && downMove >= impulseThreshold * 100) {
      orderBlocks.push({
        type: 'bearish',
        index: i,
        top: current.high,
        bottom: current.low,
        timestamp: current.timestamp,
        candle: current,
        strength: downMove
      });
    }
  }

  return orderBlocks;
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

  // Determine trend
  let trend = 'neutral';
  let confidence = 'low';

  if (higherHighs >= 1 && higherLows >= 1) {
    trend = 'uptrend';
    confidence = (higherHighs + higherLows >= 3) ? 'high' : 'medium';
  } else if (lowerHighs >= 1 && lowerLows >= 1) {
    trend = 'downtrend';
    confidence = (lowerHighs + lowerLows >= 3) ? 'high' : 'medium';
  }

  return {
    trend,
    confidence,
    lastSwingHigh: recentHighs[recentHighs.length - 1],
    lastSwingLow: recentLows[recentLows.length - 1]
  };
}

/**
 * Detects liquidity sweeps - when price briefly breaks swing points
 * then reverses (stop hunt)
 * @param {Array} candles - Array of kline objects
 * @param {Object} swingPoints - Object with swingHighs and swingLows
 * @returns {Array} Array of liquidity sweep events
 */
export function detectLiquiditySweeps(candles, swingPoints) {
  const sweeps = [];
  const { swingHighs, swingLows } = swingPoints;

  for (let i = 0; i < candles.length - 2; i++) {
    const current = candles[i];
    const next = candles[i + 1];

    // Check for sell-side liquidity sweep (break below swing low then reversal)
    for (const swingLow of swingLows) {
      if (swingLow.index < i - 3 && swingLow.index > i - 20) {
        const brokeBelow = current.low < swingLow.price;
        const closedAbove = current.close > swingLow.price;
        const nextHigher = next.close > current.close;

        if (brokeBelow && closedAbove && nextHigher) {
          sweeps.push({
            type: 'buy-side',
            direction: 'bullish',
            index: i,
            swingLevel: swingLow.price,
            timestamp: current.timestamp,
            candle: current
          });
        }
      }
    }

    // Check for buy-side liquidity sweep (break above swing high then reversal)
    for (const swingHigh of swingHighs) {
      if (swingHigh.index < i - 3 && swingHigh.index > i - 20) {
        const brokeAbove = current.high > swingHigh.price;
        const closedBelow = current.close < swingHigh.price;
        const nextLower = next.close < current.close;

        if (brokeAbove && closedBelow && nextLower) {
          sweeps.push({
            type: 'sell-side',
            direction: 'bearish',
            index: i,
            swingLevel: swingHigh.price,
            timestamp: current.timestamp,
            candle: current
          });
        }
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
 * Main SMC analyzer that combines all detection methods
 * and generates trading signals
 * @param {Array} candles - Array of kline objects
 * @returns {Object} Complete SMC analysis with signals
 */
export function analyzeSMC(candles) {
  if (!candles || candles.length < 50) {
    return {
      error: 'Insufficient data',
      signals: []
    };
  }

  // Run all detection algorithms
  const swingPoints = detectSwingPoints(candles);
  const fvgs = detectFairValueGaps(candles);
  const orderBlocks = detectOrderBlocks(candles);
  const structure = analyzeMarketStructure(swingPoints);
  const liquiditySweeps = detectLiquiditySweeps(candles, swingPoints);
  const bmsEvents = detectBreakOfStructure(candles, structure);

  // Generate trading signals
  const signals = generateSignals({
    candles,
    swingPoints,
    fvgs,
    orderBlocks,
    structure,
    liquiditySweeps,
    bmsEvents
  });

  return {
    swingPoints,
    fvgs,
    orderBlocks,
    structure,
    liquiditySweeps,
    bmsEvents,
    signals
  };
}

/**
 * Generates trading signals based on SMC pattern confluence
 * @param {Object} analysis - Combined analysis from all detectors
 * @returns {Array} Array of trading signal objects
 */
function generateSignals(analysis) {
  const signals = [];
  const { candles, fvgs, orderBlocks, liquiditySweeps, bmsEvents, structure } = analysis;

  // Get recent patterns (last 10 candles)
  const recentCandles = candles.slice(-10);
  const latestCandle = candles[candles.length - 1];

  // Check for bullish signals
  const recentBullishFVG = fvgs.filter(f => f.type === 'bullish' && f.index >= candles.length - 10);
  const recentBullishOB = orderBlocks.filter(ob => ob.type === 'bullish' && ob.index >= candles.length - 20);
  const recentBullishSweep = liquiditySweeps.filter(s => s.direction === 'bullish' && s.index >= candles.length - 5);
  const recentBullishBMS = bmsEvents.filter(b => b.type === 'bullish' && b.index >= candles.length - 5);

  if (recentBullishFVG.length > 0 || recentBullishOB.length > 0) {
    const hasConfluence = (recentBullishSweep.length > 0 || recentBullishBMS.length > 0);

    if (hasConfluence) {
      const orderBlock = recentBullishOB[0];
      const entry = latestCandle.close;
      const stopLoss = orderBlock ? orderBlock.bottom * 0.995 : entry * 0.98;
      const takeProfit = entry + (entry - stopLoss) * 2; // 2:1 RR

      signals.push({
        type: 'BUY',
        direction: 'bullish',
        entry: entry,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        riskReward: 2.0,
        confidence: hasConfluence ? 'high' : 'medium',
        patterns: [
          recentBullishFVG.length > 0 ? 'FVG' : null,
          recentBullishOB.length > 0 ? 'Order Block' : null,
          recentBullishSweep.length > 0 ? 'Liquidity Sweep' : null,
          recentBullishBMS.length > 0 ? 'BMS' : null
        ].filter(p => p !== null),
        timestamp: latestCandle.timestamp
      });
    }
  }

  // Check for bearish signals
  const recentBearishFVG = fvgs.filter(f => f.type === 'bearish' && f.index >= candles.length - 10);
  const recentBearishOB = orderBlocks.filter(ob => ob.type === 'bearish' && ob.index >= candles.length - 20);
  const recentBearishSweep = liquiditySweeps.filter(s => s.direction === 'bearish' && s.index >= candles.length - 5);
  const recentBearishBMS = bmsEvents.filter(b => b.type === 'bearish' && b.index >= candles.length - 5);

  if (recentBearishFVG.length > 0 || recentBearishOB.length > 0) {
    const hasConfluence = (recentBearishSweep.length > 0 || recentBearishBMS.length > 0);

    if (hasConfluence) {
      const orderBlock = recentBearishOB[0];
      const entry = latestCandle.close;
      const stopLoss = orderBlock ? orderBlock.top * 1.005 : entry * 1.02;
      const takeProfit = entry - (stopLoss - entry) * 2; // 2:1 RR

      signals.push({
        type: 'SELL',
        direction: 'bearish',
        entry: entry,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        riskReward: 2.0,
        confidence: hasConfluence ? 'high' : 'medium',
        patterns: [
          recentBearishFVG.length > 0 ? 'FVG' : null,
          recentBearishOB.length > 0 ? 'Order Block' : null,
          recentBearishSweep.length > 0 ? 'Liquidity Sweep' : null,
          recentBearishBMS.length > 0 ? 'BMS' : null
        ].filter(p => p !== null),
        timestamp: latestCandle.timestamp
      });
    }
  }

  return signals;
}
