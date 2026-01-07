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
 * CRITICAL: Validates FVGs and OBs against market structure shifts
 * Only keeps patterns that formed during or near BOS/CHoCH events
 * This filters out low-probability consolidation patterns
 *
 * @param {Array} patterns - Array of FVG or OB patterns
 * @param {Array} bmsEvents - Break of market structure events
 * @param {Array} liquiditySweeps - Liquidity sweep events
 * @param {string} patternType - 'fvg' or 'ob'
 * @returns {Array} Validated patterns that occurred during structure shifts
 */
function validatePatternsWithStructureShift(patterns, bmsEvents, liquiditySweeps, patternType) {
  const validated = [];
  // OPTION 1 FIX: Increased lookback range for better detection
  // FVGs: 5 → 15 candles (3x increase)
  // OBs: 10 → 20 candles (2x increase)
  const lookbackRange = patternType === 'fvg' ? 15 : 20;

  for (const pattern of patterns) {
    let isValidated = false;
    let validationReason = null;

    // Check if pattern formed near a BOS/CHoCH event
    for (const bms of bmsEvents) {
      const candleDistance = Math.abs(pattern.index - bms.index);

      // OPTION 1 FIX: Accept patterns both BEFORE and AFTER the structure break
      // Before: Pattern forms, then market breaks structure
      // After: Market breaks structure, then price returns to test the zone (retest)
      const isInRange = candleDistance <= lookbackRange;

      // Type must match: bullish pattern near bullish BOS, or bearish pattern near bearish BOS
      const typesMatch = pattern.type === bms.type;

      if (isInRange && typesMatch) {
        const timing = pattern.index <= bms.index ? 'before' : 'after';
        isValidated = true;
        validationReason = {
          type: 'BOS',
          bmsIndex: bms.index,
          bmsType: bms.type,
          breakLevel: bms.breakLevel,
          candleDistance: candleDistance,
          timing: timing,
          explanation: `${pattern.type.toUpperCase()} ${patternType.toUpperCase()} formed ${candleDistance} candles ${timing} ${bms.type} BOS at ${bms.breakLevel.toFixed(2)}`
        };
        break;
      }
    }

    // If not validated by BOS, check if validated by liquidity sweep
    if (!isValidated) {
      for (const sweep of liquiditySweeps) {
        const candleDistance = Math.abs(pattern.index - sweep.index);
        const isInRange = candleDistance <= lookbackRange;
        const typesMatch = pattern.type === sweep.direction;

        if (isInRange && typesMatch) {
          isValidated = true;
          validationReason = {
            type: 'SWEEP',
            sweepIndex: sweep.index,
            sweepDirection: sweep.direction,
            swingLevel: sweep.swingLevel,
            candleDistance: candleDistance,
            explanation: `${pattern.type.toUpperCase()} ${patternType.toUpperCase()} formed ${candleDistance} candles from ${sweep.direction} liquidity sweep at ${sweep.swingLevel.toFixed(2)}`
          };
          break;
        }
      }
    }

    // Only include patterns validated by market structure shift
    if (isValidated) {
      validated.push({
        ...pattern,
        validated: true,
        validationReason
      });
    }
  }

  // Log filtering stats for debugging
  const filteredCount = patterns.length - validated.length;
  const detectionRate = patterns.length > 0 ? ((validated.length / patterns.length) * 100).toFixed(1) : 0;

  console.log(`🔍 ${patternType.toUpperCase()} Validation (Lookback: ${lookbackRange} candles):`);
  console.log(`   ✅ Validated: ${validated.length} | ❌ Filtered: ${filteredCount} | 📊 Detection Rate: ${detectionRate}%`);

  if (validated.length > 0) {
    const beforeCount = validated.filter(p => p.validationReason?.timing === 'before').length;
    const afterCount = validated.filter(p => p.validationReason?.timing === 'after').length;
    console.log(`   ⏮️  Before BOS: ${beforeCount} | ⏭️  After BOS (Retest): ${afterCount}`);
  }

  return validated;
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
  const allFvgs = detectFairValueGaps(candles);
  const allOrderBlocks = detectOrderBlocks(candles);
  const structure = analyzeMarketStructure(swingPoints);
  const liquiditySweeps = detectLiquiditySweeps(candles, swingPoints);
  const bmsEvents = detectBreakOfStructure(candles, structure);

  // CRITICAL FIX: Filter FVGs and OBs to only keep those near BOS/CHoCH
  // This ensures we only trade high-probability zones formed during market shifts
  const fvgs = validatePatternsWithStructureShift(allFvgs, bmsEvents, liquiditySweeps, 'fvg');
  const orderBlocks = validatePatternsWithStructureShift(allOrderBlocks, bmsEvents, liquiditySweeps, 'ob');

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
  const currentPrice = latestCandle.close;

  // OPTION 1 FIX: Check if price is CURRENTLY AT validated OB/FVG zones
  // Not just if the pattern is "recent", but if price is retesting the zone
  const priceAtBullishFVG = fvgs.filter(f =>
    f.type === 'bullish' &&
    currentPrice >= f.bottom && currentPrice <= f.top
  );
  const priceAtBullishOB = orderBlocks.filter(ob =>
    ob.type === 'bullish' &&
    currentPrice >= ob.bottom && currentPrice <= ob.top
  );
  const recentBullishSweep = liquiditySweeps.filter(s => s.direction === 'bullish' && s.index >= candles.length - 10);
  const recentBullishBMS = bmsEvents.filter(b => b.type === 'bullish' && b.index >= candles.length - 10);

  if (priceAtBullishFVG.length > 0 || priceAtBullishOB.length > 0) {
    const hasConfluence = (recentBullishSweep.length > 0 || recentBullishBMS.length > 0);

    if (hasConfluence) {
      const orderBlock = priceAtBullishOB[0];
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
          priceAtBullishFVG.length > 0 ? 'FVG' : null,
          priceAtBullishOB.length > 0 ? 'Order Block' : null,
          recentBullishSweep.length > 0 ? 'Liquidity Sweep' : null,
          recentBullishBMS.length > 0 ? 'BMS' : null
        ].filter(p => p !== null),
        timestamp: latestCandle.timestamp,

        // Pattern details for modal display
        patternDetails: {
          fvg: priceAtBullishFVG.length > 0 ? {
            type: priceAtBullishFVG[0].type,
            top: priceAtBullishFVG[0].top,
            bottom: priceAtBullishFVG[0].bottom,
            gap: priceAtBullishFVG[0].gap,
            index: priceAtBullishFVG[0].index,
            timestamp: priceAtBullishFVG[0].timestamp,
            validated: priceAtBullishFVG[0].validated,
            validationReason: priceAtBullishFVG[0].validationReason
          } : null,
          orderBlock: priceAtBullishOB.length > 0 ? {
            type: priceAtBullishOB[0].type,
            top: priceAtBullishOB[0].top,
            bottom: priceAtBullishOB[0].bottom,
            strength: priceAtBullishOB[0].strength,
            index: priceAtBullishOB[0].index,
            timestamp: priceAtBullishOB[0].timestamp,
            validated: priceAtBullishOB[0].validated,
            validationReason: priceAtBullishOB[0].validationReason
          } : null,
          liquiditySweep: recentBullishSweep.length > 0 ? {
            direction: recentBullishSweep[0].direction,
            swingLevel: recentBullishSweep[0].swingLevel,
            index: recentBullishSweep[0].index,
            timestamp: recentBullishSweep[0].timestamp
          } : null,
          bms: recentBullishBMS.length > 0 ? {
            type: recentBullishBMS[0].type,
            breakLevel: recentBullishBMS[0].breakLevel,
            previousTrend: recentBullishBMS[0].previousTrend,
            index: recentBullishBMS[0].index,
            timestamp: recentBullishBMS[0].timestamp
          } : null
        },

        // Confluence explanation
        confluenceReason: generateConfluenceExplanation({
          hasFVG: priceAtBullishFVG.length > 0,
          hasOB: priceAtBullishOB.length > 0,
          hasSweep: recentBullishSweep.length > 0,
          hasBMS: recentBullishBMS.length > 0,
          direction: 'bullish',
          fvgData: priceAtBullishFVG.length > 0 ? priceAtBullishFVG[0] : null,
          obData: priceAtBullishOB.length > 0 ? priceAtBullishOB[0] : null,
          sweepData: recentBullishSweep.length > 0 ? recentBullishSweep[0] : null,
          bmsData: recentBullishBMS.length > 0 ? recentBullishBMS[0] : null,
          entry: entry
        }),

        // Risk/reward breakdown
        riskRewardBreakdown: {
          entry: entry,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          riskAmount: Math.abs(entry - stopLoss),
          rewardAmount: Math.abs(takeProfit - entry),
          ratio: 2.0,
          stopLossDistance: `${(Math.abs(entry - stopLoss) / entry * 100).toFixed(2)}%`,
          takeProfitDistance: `${(Math.abs(takeProfit - entry) / entry * 100).toFixed(2)}%`,
          reasoning: orderBlock
            ? `Stop loss placed below Order Block support at ${stopLoss.toFixed(8)}`
            : `Stop loss placed ${(Math.abs(entry - stopLoss) / entry * 100).toFixed(2)}% from entry`
        }
      });
    }
  }

  // Check for bearish signals
  // OPTION 1 FIX: Check if price is CURRENTLY AT validated OB/FVG zones
  const priceAtBearishFVG = fvgs.filter(f =>
    f.type === 'bearish' &&
    currentPrice >= f.bottom && currentPrice <= f.top
  );
  const priceAtBearishOB = orderBlocks.filter(ob =>
    ob.type === 'bearish' &&
    currentPrice >= ob.bottom && currentPrice <= ob.top
  );
  const recentBearishSweep = liquiditySweeps.filter(s => s.direction === 'bearish' && s.index >= candles.length - 10);
  const recentBearishBMS = bmsEvents.filter(b => b.type === 'bearish' && b.index >= candles.length - 10);

  if (priceAtBearishFVG.length > 0 || priceAtBearishOB.length > 0) {
    const hasConfluence = (recentBearishSweep.length > 0 || recentBearishBMS.length > 0);

    if (hasConfluence) {
      const orderBlock = priceAtBearishOB[0];
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
          priceAtBearishFVG.length > 0 ? 'FVG' : null,
          priceAtBearishOB.length > 0 ? 'Order Block' : null,
          recentBearishSweep.length > 0 ? 'Liquidity Sweep' : null,
          recentBearishBMS.length > 0 ? 'BMS' : null
        ].filter(p => p !== null),
        timestamp: latestCandle.timestamp,

        // Pattern details for modal display
        patternDetails: {
          fvg: priceAtBearishFVG.length > 0 ? {
            type: priceAtBearishFVG[0].type,
            top: priceAtBearishFVG[0].top,
            bottom: priceAtBearishFVG[0].bottom,
            gap: priceAtBearishFVG[0].gap,
            index: priceAtBearishFVG[0].index,
            timestamp: priceAtBearishFVG[0].timestamp,
            validated: priceAtBearishFVG[0].validated,
            validationReason: priceAtBearishFVG[0].validationReason
          } : null,
          orderBlock: priceAtBearishOB.length > 0 ? {
            type: priceAtBearishOB[0].type,
            top: priceAtBearishOB[0].top,
            bottom: priceAtBearishOB[0].bottom,
            strength: priceAtBearishOB[0].strength,
            index: priceAtBearishOB[0].index,
            timestamp: priceAtBearishOB[0].timestamp,
            validated: priceAtBearishOB[0].validated,
            validationReason: priceAtBearishOB[0].validationReason
          } : null,
          liquiditySweep: recentBearishSweep.length > 0 ? {
            direction: recentBearishSweep[0].direction,
            swingLevel: recentBearishSweep[0].swingLevel,
            index: recentBearishSweep[0].index,
            timestamp: recentBearishSweep[0].timestamp
          } : null,
          bms: recentBearishBMS.length > 0 ? {
            type: recentBearishBMS[0].type,
            breakLevel: recentBearishBMS[0].breakLevel,
            previousTrend: recentBearishBMS[0].previousTrend,
            index: recentBearishBMS[0].index,
            timestamp: recentBearishBMS[0].timestamp
          } : null
        },

        // Confluence explanation
        confluenceReason: generateConfluenceExplanation({
          hasFVG: priceAtBearishFVG.length > 0,
          hasOB: priceAtBearishOB.length > 0,
          hasSweep: recentBearishSweep.length > 0,
          hasBMS: recentBearishBMS.length > 0,
          direction: 'bearish',
          fvgData: priceAtBearishFVG.length > 0 ? priceAtBearishFVG[0] : null,
          obData: priceAtBearishOB.length > 0 ? priceAtBearishOB[0] : null,
          sweepData: recentBearishSweep.length > 0 ? recentBearishSweep[0] : null,
          bmsData: recentBearishBMS.length > 0 ? recentBearishBMS[0] : null,
          entry: entry
        }),

        // Risk/reward breakdown
        riskRewardBreakdown: {
          entry: entry,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          riskAmount: Math.abs(stopLoss - entry),
          rewardAmount: Math.abs(entry - takeProfit),
          ratio: 2.0,
          stopLossDistance: `${(Math.abs(stopLoss - entry) / entry * 100).toFixed(2)}%`,
          takeProfitDistance: `${(Math.abs(entry - takeProfit) / entry * 100).toFixed(2)}%`,
          reasoning: orderBlock
            ? `Stop loss placed above Order Block resistance at ${stopLoss.toFixed(8)}`
            : `Stop loss placed ${(Math.abs(stopLoss - entry) / entry * 100).toFixed(2)}% from entry`
        }
      });
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
