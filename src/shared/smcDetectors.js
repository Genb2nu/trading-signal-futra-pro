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

  // Group by type for easier access
  const grouped = {
    bullish: orderBlocks.filter(ob => ob.type === 'bullish'),
    bearish: orderBlocks.filter(ob => ob.type === 'bearish')
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

  // ===== EXISTING DETECTIONS =====
  const swingPoints = detectSwingPoints(candles);
  const fvgs = detectFairValueGaps(candles);
  const orderBlocks = detectOrderBlocks(candles);
  const structure = analyzeMarketStructure(swingPoints);
  const liquiditySweeps = detectLiquiditySweeps(candles, swingPoints);
  const bmsEvents = detectBreakOfStructure(candles, structure);

  // ===== NEW ENHANCED DETECTIONS =====
  const chochEvents = detectChangeOfCharacter(candles, structure);
  const { bos, bms } = distinguishBOSvsBMS(candles, structure);
  const externalLiquidity = detectExternalLiquidity(swingPoints);
  const internalLiquidity = detectInternalLiquidity(candles, swingPoints);
  const inducement = detectInducementZones(candles, structure);
  const volumeAnalysis = analyzeVolume(candles);
  const mitigatedFVGs = trackFVGMitigation(fvgs, candles);
  const breakerBlocks = detectBreakerBlocks(orderBlocks, candles);
  const latestCandle = candles[candles.length - 1];
  const premiumDiscount = calculatePremiumDiscount(candles, swingPoints, latestCandle.close);

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
    premiumDiscount
  });

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
    premiumDiscount
  };
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

function generateSignals(analysis) {
  const signals = [];
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
    premiumDiscount = null
  } = analysis;

  // PREPROCESSING: Calculate all enhanced data
  const latestCandle = candles[candles.length - 1];

  // Calculate premium/discount zones (if not provided)
  const zoneAnalysis = premiumDiscount || calculatePremiumDiscount(candles, swingPoints, latestCandle.close);

  // Analyze volume (if not provided)
  const volumeData = volumeAnalysis || analyzeVolume(candles);

  // Track FVG mitigation status
  const mitigatedFVGs = trackFVGMitigation(fvgs, candles);

  // Calculate ATR for stops
  const atr = calculateATR(candles, 14);

  // Get recent patterns
  // NOTE: fvgs (mitigatedFVGs) has structure: { unfilled: {bullish:[], bearish:[]}, touched: {...}, partial: {...}, filled: {...} }
  const allBullishFVGs = [
    ...(mitigatedFVGs.unfilled?.bullish || []),
    ...(mitigatedFVGs.touched?.bullish || []),
    ...(mitigatedFVGs.partial?.bullish || [])
  ];
  const allBearishFVGs = [
    ...(mitigatedFVGs.unfilled?.bearish || []),
    ...(mitigatedFVGs.touched?.bearish || []),
    ...(mitigatedFVGs.partial?.bearish || [])
  ];

  const recentBullishFVG = allBullishFVGs.filter(f => f.index >= candles.length - 10);
  const recentBullishOB = orderBlocks.bullish ? orderBlocks.bullish.filter(ob => ob.index >= candles.length - 20) : [];
  const recentBullishSweep = liquiditySweeps.filter(s => s.direction === 'bullish' && s.index >= candles.length - 5);
  const recentBullishBMS = bmsEvents.filter(b => b.type === 'bullish' && b.index >= candles.length - 5);
  const recentBullishBreaker = breakerBlocks.bullish || [];

  const recentBearishFVG = allBearishFVGs.filter(f => f.index >= candles.length - 10);
  const recentBearishOB = orderBlocks.bearish ? orderBlocks.bearish.filter(ob => ob.index >= candles.length - 20) : [];
  const recentBearishSweep = liquiditySweeps.filter(s => s.direction === 'bearish' && s.index >= candles.length - 5);
  const recentBearishBMS = bmsEvents.filter(b => b.type === 'bearish' && b.index >= candles.length - 5);
  const recentBearishBreaker = breakerBlocks.bearish || [];

  // ========================================================================
  // BULLISH SIGNAL GENERATION
  // ========================================================================

  // FILTER: Prefer discount zone, allow neutral zone (relaxed filtering)
  if (zoneAnalysis.zone === 'discount' || zoneAnalysis.zone === 'neutral') {
    // Prefer breaker blocks over regular OBs
    const bullishOB = recentBullishBreaker.length > 0 ? recentBullishBreaker[0] : recentBullishOB[0];

    if (bullishOB) {
      // Check base pattern requirement: FVG OR OB
      const hasBasePattern = (mitigatedFVGs.unfilled.bullish.length > 0) || bullishOB;

      // Check confirmation: Sweep OR BMS OR Inducement OR BOS (relaxed)
      const hasConfirmation = (recentBullishSweep.length > 0) ||
                             (recentBullishBMS.length > 0) ||
                             (inducement.bullish.length > 0) ||
                             (bos.bullish.length > 0); // Added BOS as confirmation

      if (hasBasePattern && hasConfirmation) {
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

        // Entry at OB mitigation - use current price if near OB, otherwise wait
        let validEntry = false;

        // For BUY: Only valid if price is at or approaching OB from above
        if (priceInRange(latestCandle.close, bullishOB.top, bullishOB.bottom)) {
          // Price is IN the OB - immediate entry at current price
          entry = latestCandle.close;
          entryTiming = { status: 'immediate', inOB: true };
          validEntry = true;
        } else if (latestCandle.close > bullishOB.top && latestCandle.close < bullishOB.top * 1.02) {
          // Price is slightly above OB (within 2%) - set entry at OB top
          entry = bullishOB.top;
          entryTiming = { status: 'pending', inOB: false };
          validEntry = true;
        }
        // If price is far above OB or below OB, skip (invalid/missed entry)

        if (validEntry) {

        // ===== STOP LOSS CALCULATION =====
        const buffer = atr * 0.5; // Half ATR for wick allowance
        let stopLoss = bullishOB.bottom - buffer;

        // Check for liquidity below OB (avoid stop hunt)
        const liquidityBelow = externalLiquidity.buyLiquidity.find(
          liq => liq.price < bullishOB.bottom && liq.price > stopLoss - (atr * 0.5)
        );

        if (liquidityBelow) {
          stopLoss = liquidityBelow.price - (buffer * 1.5);
        }

        // Maximum 3% risk
        const maxRisk = entry * 0.97;
        if (stopLoss < maxRisk) stopLoss = maxRisk;

        // ===== TAKE PROFIT CALCULATION =====
        let takeProfit;
        let takeProfitReasoning;

        // First choice: External liquidity
        const targetLiquidity = externalLiquidity.sellLiquidity.find(
          liq => liq.price > entry && liq.strength !== 'weak'
        );

        if (targetLiquidity) {
          takeProfit = targetLiquidity.price - (atr * 0.3);
          takeProfitReasoning = `Targeting sell-side liquidity at ${targetLiquidity.price.toFixed(8)}`;
        } else {
          // Second choice: Next swing high
          const nextStructure = findNearestStructure(candles, swingPoints, 'bullish');
          if (nextStructure) {
            takeProfit = nextStructure.price - (atr * 0.3);
            takeProfitReasoning = `Targeting next swing high at ${nextStructure.price.toFixed(8)}`;
          } else {
            // Fallback: 2:1 RR minimum
            takeProfit = entry + ((entry - stopLoss) * 2);
            takeProfitReasoning = '2:1 RR (no clear structure target)';
          }
        }

        // Validate minimum RR
        const riskReward = (takeProfit - entry) / (entry - stopLoss);
        if (riskReward >= 1.5) {
          // Only proceed if R:R is acceptable

        // ===== CONFLUENCE SCORING =====
        let confluenceScore = 0;

        // Core requirements (40 points)
        if (zoneAnalysis.zone === 'discount') confluenceScore += 20;
        else if (zoneAnalysis.zone === 'neutral') confluenceScore += 10; // Less points for neutral
        if (volumeData.confirmation === 'strong') confluenceScore += 20;
        else if (volumeData.confirmation === 'moderate') confluenceScore += 10;

        // High-value confluence (45 points)
        if (ote.currentPriceInOTE) confluenceScore += 15;
        if (mitigatedFVGs.unfilled.bullish.length > 0) confluenceScore += 15;
        if (recentBullishBMS.length > 0) confluenceScore += 15; // Reversal

        // Moderate confluence (15 points each)
        if (bos.bullish.length > 0) confluenceScore += 10; // Continuation
        if (recentBullishSweep.length > 0) confluenceScore += 10;
        if (inducement.bullish.length > 0) confluenceScore += 10;
        if (recentBullishBreaker.length > 0) confluenceScore += 10;

        // Assign confidence tier
        let confidence;
        if (confluenceScore >= 70) confidence = 'premium';
        else if (confluenceScore >= 50) confidence = 'high';
        else if (confluenceScore >= 35) confidence = 'standard';

        if (confluenceScore >= 35) {
          // Only create signal if score is acceptable


        // ===== CREATE SIGNAL =====
        signals.push({
          type: 'BUY',
          direction: 'bullish',
          entry: entry,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          riskReward: riskReward,
          confidence: confidence,
          patterns: [
            mitigatedFVGs.unfilled.bullish.length > 0 ? 'FVG (Unfilled)' : null,
            recentBullishOB.length > 0 ? 'Order Block' : null,
            recentBullishBreaker.length > 0 ? 'Breaker Block' : null,
            recentBullishSweep.length > 0 ? 'Liquidity Sweep' : null,
            recentBullishBMS.length > 0 ? 'BMS (Reversal)' : null,
            inducement.bullish.length > 0 ? 'Inducement' : null,
            ote.currentPriceInOTE ? 'OTE' : null
          ].filter(p => p !== null),
          timestamp: latestCandle.timestamp,

          // Pattern details (existing)
          patternDetails: {
            fvg: mitigatedFVGs.unfilled.bullish.length > 0 ? mitigatedFVGs.unfilled.bullish[0] : null,
            orderBlock: bullishOB,
            liquiditySweep: recentBullishSweep.length > 0 ? recentBullishSweep[0] : null,
            bms: recentBullishBMS.length > 0 ? recentBullishBMS[0] : null
          },

          // Confluence explanation (existing)
          confluenceReason: `Confluence Score: ${confluenceScore}/100 (${confidence.toUpperCase()})`,

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
            bmsType: recentBullishBMS.length > 0 ? 'reversal' : null
          },
          liquidityAnalysis: {
            externalLiquidity: targetLiquidity || null,
            sweepDetected: recentBullishSweep.length > 0,
            inducementDetected: inducement.bullish.length > 0
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
          confluenceScore: confluenceScore,
          riskManagement: {
            stopLossReasoning: `Below OB with ${buffer.toFixed(8)} buffer`,
            takeProfitReasoning: takeProfitReasoning,
            atrBuffer: buffer,
            maxRiskPercent: 3.0
          }
        });
        } // End if (confluenceScore >= 35)
        } // End if (riskReward >= 1.5)
        } // End if (validEntry)
      }
    }
  }

  // ========================================================================
  // BEARISH SIGNAL GENERATION
  // ========================================================================

  // FILTER: Prefer premium zone, allow neutral zone (relaxed filtering)
  if (zoneAnalysis.zone === 'premium' || zoneAnalysis.zone === 'neutral') {
    // Prefer breaker blocks over regular OBs
    const bearishOB = recentBearishBreaker.length > 0 ? recentBearishBreaker[0] : recentBearishOB[0];

    if (bearishOB) {
      // Check base pattern requirement: FVG OR OB
      const hasBasePattern = (mitigatedFVGs.unfilled.bearish.length > 0) || bearishOB;

      // Check confirmation: Sweep OR BMS OR Inducement OR BOS (relaxed)
      const hasConfirmation = (recentBearishSweep.length > 0) ||
                             (recentBearishBMS.length > 0) ||
                             (inducement.bearish.length > 0) ||
                             (bos.bearish.length > 0); // Added BOS as confirmation

      if (hasBasePattern && hasConfirmation) {
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

        // Entry at OB mitigation - use current price if near OB, otherwise wait
        let validEntry = false;

        // For SELL: Only valid if price is at or approaching OB from below
        if (priceInRange(latestCandle.close, bearishOB.top, bearishOB.bottom)) {
          // Price is IN the OB - immediate entry at current price
          entry = latestCandle.close;
          entryTiming = { status: 'immediate', inOB: true };
          validEntry = true;
        } else if (latestCandle.close < bearishOB.bottom && latestCandle.close > bearishOB.bottom * 0.98) {
          // Price is slightly below OB (within 2%) - set entry at OB bottom
          entry = bearishOB.bottom;
          entryTiming = { status: 'pending', inOB: false };
          validEntry = true;
        }
        // If price is far below OB or above OB, skip (invalid/missed entry)

        if (validEntry) {

        // ===== STOP LOSS CALCULATION =====
        const buffer = atr * 0.5; // Half ATR for wick allowance
        let stopLoss = bearishOB.top + buffer;

        // Check for liquidity above OB (avoid stop hunt)
        const liquidityAbove = externalLiquidity.sellLiquidity.find(
          liq => liq.price > bearishOB.top && liq.price < stopLoss + (atr * 0.5)
        );

        if (liquidityAbove) {
          stopLoss = liquidityAbove.price + (buffer * 1.5);
        }

        // Maximum 3% risk
        const maxRisk = entry * 1.03;
        if (stopLoss > maxRisk) stopLoss = maxRisk;

        // ===== TAKE PROFIT CALCULATION =====
        let takeProfit;
        let takeProfitReasoning;

        // First choice: External liquidity
        const targetLiquidity = externalLiquidity.buyLiquidity.find(
          liq => liq.price < entry && liq.strength !== 'weak'
        );

        if (targetLiquidity) {
          takeProfit = targetLiquidity.price + (atr * 0.3);
          takeProfitReasoning = `Targeting buy-side liquidity at ${targetLiquidity.price.toFixed(8)}`;
        } else {
          // Second choice: Next swing low
          const nextStructure = findNearestStructure(candles, swingPoints, 'bearish');
          if (nextStructure) {
            takeProfit = nextStructure.price + (atr * 0.3);
            takeProfitReasoning = `Targeting next swing low at ${nextStructure.price.toFixed(8)}`;
          } else {
            // Fallback: 2:1 RR minimum
            takeProfit = entry - ((stopLoss - entry) * 2);
            takeProfitReasoning = '2:1 RR (no clear structure target)';
          }
        }

        // Validate minimum RR
        const riskReward = (entry - takeProfit) / (stopLoss - entry);
        if (riskReward >= 1.5) {

        // ===== CONFLUENCE SCORING =====
        let confluenceScore = 0;

        // Core requirements (40 points)
        if (zoneAnalysis.zone === 'premium') confluenceScore += 20;
        else if (zoneAnalysis.zone === 'neutral') confluenceScore += 10; // Less points for neutral
        if (volumeData.confirmation === 'strong') confluenceScore += 20;
        else if (volumeData.confirmation === 'moderate') confluenceScore += 10;

        // High-value confluence (45 points)
        if (ote.currentPriceInOTE) confluenceScore += 15;
        if (mitigatedFVGs.unfilled.bearish.length > 0) confluenceScore += 15;
        if (recentBearishBMS.length > 0) confluenceScore += 15; // Reversal

        // Moderate confluence (15 points each)
        if (bos.bearish.length > 0) confluenceScore += 10; // Continuation
        if (recentBearishSweep.length > 0) confluenceScore += 10;
        if (inducement.bearish.length > 0) confluenceScore += 10;
        if (recentBearishBreaker.length > 0) confluenceScore += 10;

        // Assign confidence tier
        let confidence;
        if (confluenceScore >= 70) confidence = 'premium';
        else if (confluenceScore >= 50) confidence = 'high';
        else if (confluenceScore >= 35) confidence = 'standard';

        if (confluenceScore >= 35) {

        // ===== CREATE SIGNAL =====
        signals.push({
          type: 'SELL',
          direction: 'bearish',
          entry: entry,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          riskReward: riskReward,
          confidence: confidence,
          patterns: [
            mitigatedFVGs.unfilled.bearish.length > 0 ? 'FVG (Unfilled)' : null,
            recentBearishOB.length > 0 ? 'Order Block' : null,
            recentBearishBreaker.length > 0 ? 'Breaker Block' : null,
            recentBearishSweep.length > 0 ? 'Liquidity Sweep' : null,
            recentBearishBMS.length > 0 ? 'BMS (Reversal)' : null,
            inducement.bearish.length > 0 ? 'Inducement' : null,
            ote.currentPriceInOTE ? 'OTE' : null
          ].filter(p => p !== null),
          timestamp: latestCandle.timestamp,

          // Pattern details (existing)
          patternDetails: {
            fvg: mitigatedFVGs.unfilled.bearish.length > 0 ? mitigatedFVGs.unfilled.bearish[0] : null,
            orderBlock: bearishOB,
            liquiditySweep: recentBearishSweep.length > 0 ? recentBearishSweep[0] : null,
            bms: recentBearishBMS.length > 0 ? recentBearishBMS[0] : null
          },

          // Confluence explanation (existing)
          confluenceReason: `Confluence Score: ${confluenceScore}/100 (${confidence.toUpperCase()})`,

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
            bmsType: recentBearishBMS.length > 0 ? 'reversal' : null
          },
          liquidityAnalysis: {
            externalLiquidity: targetLiquidity || null,
            sweepDetected: recentBearishSweep.length > 0,
            inducementDetected: inducement.bearish.length > 0
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
          confluenceScore: confluenceScore,
          riskManagement: {
            stopLossReasoning: `Above OB with ${buffer.toFixed(8)} buffer`,
            takeProfitReasoning: takeProfitReasoning,
            atrBuffer: buffer,
            maxRiskPercent: 3.0
          }
        });
        } // End if (confluenceScore >= 35)
        } // End if (riskReward >= 1.5)
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
 * Identifies inducement zones (retail traps / stop hunts)
 * Inducement = failed breakouts that quickly reverse
 *
 * @param {Array} candles - Array of candle objects
 * @param {Object} structure - Market structure object
 * @returns {Object} { bullish: [], bearish: [] }
 */
function detectInducementZones(candles, structure) {
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
