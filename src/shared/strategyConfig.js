/**
 * Strategy Configuration
 * Allows toggling between conservative and moderate SMC settings
 */

export const STRATEGY_MODES = {
  CONSERVATIVE: 'conservative',
  MODERATE: 'moderate',
  AGGRESSIVE: 'aggressive',
  SCALPING: 'scalping',
  ELITE: 'elite',
  SNIPER: 'sniper'
};

// Current mode - change this to switch strategies
export const CURRENT_MODE = STRATEGY_MODES.MODERATE; // Moderate mode: 87.5% WR, 11.05 PF (1h) - BEST OVERALL

export const STRATEGY_CONFIG = {
  [STRATEGY_MODES.CONSERVATIVE]: {
    name: 'Conservative (Ultra-Safe)',
    description: 'High-quality setups with strict trend-following per SMC PDF',

    // Order Block Settings
    obImpulseThreshold: 0.005, // 0.5% (lowered from 0.6%)

    // Confirmation Requirements
    requireAllConfirmations: false,
    requiredConfirmations: [], // No hard requirements, rely on confluence
    preferredPatterns: ['liquiditySweep', 'fvg', 'bos'], // All add confluence

    // Zone Settings
    allowNeutralZone: false, // STRICT: Only trade in discount/premium zones (SMC PDF)
    neutralZoneScore: 0,

    // Stop Loss Settings
    stopLossATRMultiplier: 2.5,

    // Confluence Settings
    minimumConfluence: 55, // BALANCED: 45 → 55 (65 without rejection)
    confluenceWeights: {
      liquiditySweep: 30,      // Best pattern (68% WR) - increased
      fvg: 20,
      bos: 15,
      validZone: 10,
      volume: 15,
      ote: 15,                 // Good pattern (67% WR)
      breakerBlock: 10,
      bms: 10,
      rejectionPattern: 20,    // Rejection confirmation
      // INDUCEMENT WEIGHTS (UPDATED - removed supplyDemandInducement)
      basicInducement: 10,
      // supplyDemandInducement: REMOVED (7.1% WR)
      consolidationInducement: 12,
      prematureReversalInducement: 8,
      firstPullbackInducement: 15,
      // HTF confluence weights
      htfOBAlignment: 15,
      htfFVGConfluence: 10,
      htfZoneAlignment: 10,
      htfStructureAlignment: 10
    },

    // Entry Settings
    requireBOSConfirmation: false,
    requireRejectionPattern: false, // Rejection is optional, adds confluence bonus
    bosLookback: 10, // candles
    strictHTFAlignment: true,       // STRICT: Only trade WITH HTF trend (SMC PDF principle)

    // Risk Management
    minimumRiskReward: 2.0,

    // Expected Performance
    expectedSignalsPerDay: '15-25 per 1000 candles',
    targetWinRate: '60-65%',
    targetProfitFactor: '2.2+'
  },

  [STRATEGY_MODES.MODERATE]: {
    name: 'Moderate (Balanced)',
    description: 'Balanced approach with strict trend-following per SMC PDF',

    // Order Block Settings
    obImpulseThreshold: 0.005, // 0.5% (works well on 1h)

    // Confirmation Requirements
    requireAllConfirmations: false,
    requiredConfirmations: [], // No hard requirements, use confluence scoring
    preferredPatterns: ['liquiditySweep', 'fvg', 'bos'], // All patterns add confluence

    // Zone Settings
    allowNeutralZone: false,   // ENHANCED: Disable neutral zone (strict SMC principles)
    neutralZoneScore: 5,       // Lower score for neutral (was 10)

    // Stop Loss Settings
    stopLossATRMultiplier: 2.5,

    // Confluence Settings
    minimumConfluence: 40, // BALANCED: 30 → 40 (55 without rejection)
    confluenceWeights: {
      liquiditySweep: 30,      // Best pattern (68% WR) - increased
      fvg: 20,
      bos: 15,
      validZone: 10,
      neutralZone: 5,
      volume: 15,
      ote: 15,                 // Good pattern (67% WR)
      breakerBlock: 10,
      bms: 10,
      rejectionPattern: 20,    // Rejection confirmation
      // INDUCEMENT WEIGHTS (UPDATED)
      basicInducement: 10,
      // supplyDemandInducement: REMOVED (7.1% WR)
      consolidationInducement: 12,
      prematureReversalInducement: 8,
      firstPullbackInducement: 15,
      // HTF confluence weights
      htfOBAlignment: 15,
      htfFVGConfluence: 10,
      htfZoneAlignment: 10,
      htfStructureAlignment: 10
    },

    // Entry Settings
    requireBOSConfirmation: false,
    requireRejectionPattern: true,  // Add rejection requirement
    strictHTFAlignment: true,       // STRICT: Only trade WITH HTF trend (SMC PDF principle)
    bosLookback: 10,

    // Risk Management
    minimumRiskReward: 1.8,

    // Expected Performance
    expectedSignalsPerDay: '30-50 per 1000 candles',
    targetWinRate: '50-55%',
    targetProfitFactor: '2.0+'
  },

  [STRATEGY_MODES.AGGRESSIVE]: {
    name: 'Aggressive (High Frequency)',
    description: 'Higher trade frequency with strict trend-following per SMC PDF',

    // Order Block Settings
    obImpulseThreshold: 0.004, // 0.4% (slightly higher than 0.3% for quality)

    // Confirmation Requirements
    requireAllConfirmations: false,
    requiredConfirmations: [], // No hard requirements
    preferredPatterns: ['fvg', 'liquiditySweep'], // Bonus scoring

    // Zone Settings
    allowNeutralZone: true,
    neutralZoneScore: 10,

    // Stop Loss Settings
    stopLossATRMultiplier: 2.0,

    // Confluence Settings
    minimumConfluence: 28, // BALANCED: 20 → 28 (43 without rejection)
    confluenceWeights: {
      liquiditySweep: 30,      // Best pattern (68% WR)
      fvg: 20,
      bos: 15,
      validZone: 10,
      neutralZone: 10,
      volume: 10,
      ote: 15,                 // Good pattern (67% WR)
      breakerBlock: 10,
      bms: 10,
      rejectionPattern: 10,    // Lower weight for aggressive (optional)
      // INDUCEMENT WEIGHTS (UPDATED)
      basicInducement: 10,
      // supplyDemandInducement: REMOVED (7.1% WR)
      consolidationInducement: 12,
      prematureReversalInducement: 8,
      firstPullbackInducement: 15,
      // HTF confluence weights
      htfOBAlignment: 10,
      htfFVGConfluence: 8,
      htfZoneAlignment: 8,
      htfStructureAlignment: 8
    },

    // Entry Settings
    requireBOSConfirmation: false,
    requireRejectionPattern: false, // More lenient
    strictHTFAlignment: true,       // STRICT: Only trade WITH HTF trend (SMC PDF principle)
    bosLookback: 10,

    // Risk Management
    minimumRiskReward: 1.5,

    // Expected Performance
    expectedSignalsPerDay: '80-120 per 1000 candles',
    targetWinRate: '45-50%',
    targetProfitFactor: '1.5+'
  },

  [STRATEGY_MODES.SCALPING]: {
    name: 'Scalping (High-Frequency Quality)',
    description: 'Optimized for fast trades with strict trend-following per SMC PDF',

    // TIMEFRAME-ADAPTIVE PARAMETERS (KEY INNOVATION)
    timeframeParams: {
      '1m': {
        obImpulseThreshold: 0.0015,      // 0.15% - micro-moves
        stopLossATRMultiplier: 1.5,      // Tighter stops
        swingLookback: 1,                // Fast swing detection
        fvgLookback: 5,
        sweepLookback: 3,
        bosLookback: 5,
      },
      '5m': {
        obImpulseThreshold: 0.003,       // 0.3%
        stopLossATRMultiplier: 2.0,
        swingLookback: 2,
        fvgLookback: 10,
        sweepLookback: 7,
        bosLookback: 8,
      },
      '15m': {
        obImpulseThreshold: 0.004,       // 0.4%
        stopLossATRMultiplier: 2.2,
        swingLookback: 3,
        fvgLookback: 15,
        sweepLookback: 10,
        bosLookback: 10,
      },
      '1h': {
        obImpulseThreshold: 0.005,       // 0.5%
        stopLossATRMultiplier: 2.5,
        swingLookback: 4,
        fvgLookback: 20,
        sweepLookback: 15,
        bosLookback: 12,
      }
    },

    // Order Block Settings (default, can be overridden by timeframe params)
    obImpulseThreshold: 0.003, // Default for 5m (keep original)

    // Confirmation Requirements (High quality) - MODERATE OPTIMIZATION
    requireAllConfirmations: false,
    requiredConfirmations: ['fvg', 'validZone'], // FVG and valid zone required
    optionalConfirmations: ['liquiditySweep', 'bos'], // Sweep adds bonus points

    // Zone Settings
    allowNeutralZone: false,
    neutralZoneScore: 0,

    // Stop Loss Settings
    stopLossATRMultiplier: 2.0, // Default for 5m

    // Confluence Settings - OPTIMIZED FOR 15M
    minimumConfluence: 38, // BALANCED: 25 → 38 (53 without rejection)
    confluenceWeights: {
      liquiditySweep: 30,      // Best pattern
      fvg: 20,
      bos: 15,
      validZone: 15,
      volume: 10,
      ote: 15,
      breakerBlock: 10,
      bms: 10,
      directionalConfirmation: 15,
      rejectionPattern: 10,    // Lower weight (optional for scalping)
      // INDUCEMENT WEIGHTS (UPDATED)
      basicInducement: 10,
      // supplyDemandInducement: REMOVED (7.1% WR)
      consolidationInducement: 12,
      prematureReversalInducement: 8,
      firstPullbackInducement: 15,
      // HTF confluence weights (reduced importance for scalping)
      htfOBAlignment: 8,
      htfFVGConfluence: 6,
      htfZoneAlignment: 6,
      htfStructureAlignment: 6
    },

    // Entry Settings
    requireDirectionalConfirmation: false, // Faster entries
    requireBOSConfirmation: false,
    requireRejectionPattern: false,  // Optional for scalping
    strictHTFAlignment: true,        // STRICT: Only trade WITH HTF trend (SMC PDF principle)
    bosLookback: 5,

    // Risk Management
    minimumRiskReward: 1.3, // Lower R:R for scalping (quick profits)

    // SCALPING-SPECIFIC FEATURES
    scalping: {
      enableTimeoutExit: true,
      timeoutMinutes: {
        '1m': 30,
        '5m': 60,
        '15m': 120,
        '1h': 240,
      },
      timeoutThresholdR: 0.2,

      enableTrailingStop: true,
      breakEvenTriggerR: 0.5,
      trailingStartR: 1.0,
      trailingDistanceR: 0.5,

      enablePartialClose: true,
      partialCloseR: 1.0,
      partialClosePercent: 50,
    },

    // Expected Performance (15m optimized)
    expectedSignalsPerDay: '150-200 per 1000 candles',
    targetWinRate: '45-48%',
    targetProfitFactor: '1.4+'
  },

  [STRATEGY_MODES.ELITE]: {
    name: 'Elite (80%+ Win Rate)',
    description: 'Ultra-selective mode targeting 80%+ win rate with perfect setups only (1-2 trades/day)',

    // ELITE MODE PHILOSOPHY:
    // Based on backtest analysis of 103 trades with only 3 winners (2.9% WR)
    // Winners had:  FVG + Breaker Block + Liquidity Sweep, Confluence 87-96, R:R ~1.3
    // Only accept PERFECT setups that match winning trade characteristics

    // Order Block Settings - More lenient to capture setups
    obImpulseThreshold: 0.004, // 0.4% for 15m

    // STRICT PATTERN REQUIREMENTS - Use confluence scoring instead of hard requirements
    requireAllConfirmations: false,
    requiredConfirmations: [], // No hard requirements, rely on high confluence
    preferredPatterns: ['fvg', 'liquiditySweep', 'ote', 'bos'], // All add to confluence

    // Zone Settings - Must be in correct zone
    allowNeutralZone: true, // Winners were in neutral, allow it
    neutralZoneScore: 10,

    // Stop Loss Settings - WIDER for better tolerance (reduce -0.83R MAE)
    stopLossATRMultiplier: 3.0, // 1.5x wider than normal for 15m volatility

    // Confluence Settings - VERY HIGH REQUIREMENT
    minimumConfluence: 60, // Start at 60, will analyze and increase based on win rates
    confluenceWeights: {
      liquiditySweep: 35,      // Critical pattern
      fvg: 25,                 // Critical pattern
      breakerBlock: 25,        // Critical pattern
      ote: 20,                 // Bonus pattern
      validZone: 15,
      bos: 10,
      volume: 10,
      bms: 5,
      rejectionPattern: 25,    // REQUIRE rejection for better entry timing
      // Reduced inducement weights
      basicInducement: 5,
      consolidationInducement: 8,
      prematureReversalInducement: 5,
      firstPullbackInducement: 10,
      // HTF alignment
      htfOBAlignment: 10,
      htfFVGConfluence: 10,
      htfZoneAlignment: 10,
      htfStructureAlignment: 10
    },

    // Entry Settings - STRICT CONFIRMATION
    requireDirectionalConfirmation: true,
    requireBOSConfirmation: false,
    requireRejectionPattern: true,  // MUST have rejection candle (reduce MAE)
    strictHTFAlignment: false,      // Winners were neutral/bearish, don't filter by HTF
    bosLookback: 10,

    // Risk Management - LOWER TARGET (winners averaged 1.3 R:R, not 2.0)
    minimumRiskReward: 1.2, // Realistic for 15m (winners had 1.3)

    // AGGRESSIVE TRADE MANAGEMENT to capture profits
    scalping: {
      enableTimeoutExit: true,
      timeoutMinutes: {
        '15m': 180,  // 3 hours max hold
        '1h': 360,
      },
      timeoutThresholdR: 0.3,  // Exit if below 0.3R after timeout

      // CRITICAL: Breakeven quickly to protect capital
      enableTrailingStop: true,
      breakEvenTriggerR: 0.3,  // Move to BE at just 0.3R profit
      trailingStartR: 0.5,     // Start trailing at 0.5R
      trailingDistanceR: 0.3,  // Trail 0.3R behind peak

      // CRITICAL: Partial profit taking (7 trades went 0.5R+ then reversed!)
      enablePartialClose: true,
      partialCloseR: 0.8,      // Take 50% profit at 0.8R
      partialClosePercent: 50  // Close 50% of position
    },

    // Expected Performance
    expectedSignalsPerDay: '1-3 per 1000 candles (ultra-selective)',
    targetWinRate: '80%+',
    targetProfitFactor: '4.0+'
  },

  [STRATEGY_MODES.SNIPER]: {
    name: 'Sniper (1H Setup + Precision Entry)',
    description: '1H timeframe with strict entry requirements for 80%+ WR and 2.5:1+ R:R',

    // SNIPER MODE PHILOSOPHY:
    // Based on backtest showing 1H achieves 60-83% WR across multiple symbols
    // Strategy: Use 1H structure, wait for best entry timing (simulating pullback/retest)
    // Target: 75-83% WR with 2.5:1+ R:R

    // Optimized for 1H timeframe
    obImpulseThreshold: 0.005, // 0.5% for 1H

    // STRICT ENTRY REQUIREMENTS - Simulate waiting for pullback/retest
    requireAllConfirmations: false,
    requiredConfirmations: ['fvg'], // Core requirement
    preferredPatterns: ['liquiditySweep', 'ote', 'bos'], // All strongly preferred

    // Zone Settings - Must be in correct zone (no neutral)
    allowNeutralZone: false,
    neutralZoneScore: 0,

    // Stop Loss Settings - Normal for 1H
    stopLossATRMultiplier: 2.5, // Standard 1H stop

    // Confluence Settings - VERY HIGH (75+ for sniper precision)
    minimumConfluence: 75, // High bar for entry
    confluenceWeights: {
      liquiditySweep: 35,      // Critical for sniper entries
      fvg: 30,                 // Critical pattern
      ote: 25,                 // Optimal entry zone
      bos: 20,                 // Structure confirmation
      validZone: 20,           // Premium/discount zone
      breakerBlock: 15,
      volume: 15,              // Volume confirmation
      bms: 10,
      rejectionPattern: 30,    // CRITICAL: Must have rejection for sniper entry
      // HTF alignment (if using 4H for 1H trading)
      htfOBAlignment: 15,
      htfFVGConfluence: 12,
      htfZoneAlignment: 12,
      htfStructureAlignment: 12
    },

    // Entry Settings - STRICT SNIPER REQUIREMENTS
    requireDirectionalConfirmation: true,  // Must confirm direction
    requireBOSConfirmation: false,
    requireRejectionPattern: true,         // MUST have rejection candle pattern
    strictHTFAlignment: true,              // Must align with HTF trend
    bosLookback: 15,

    // Risk Management - HIGHER R:R for 1H structure
    minimumRiskReward: 2.5, // Target 2.5:1 or better (sniper advantage)

    // AGGRESSIVE PROFIT PROTECTION
    scalping: {
      enableTimeoutExit: false, // Don't timeout on 1H (let trades run)
      timeoutMinutes: {},

      // Protect profits aggressively
      enableTrailingStop: true,
      breakEvenTriggerR: 0.8,   // Move to BE at 0.8R
      trailingStartR: 1.5,      // Start trailing at 1.5R
      trailingDistanceR: 0.5,   // Trail 0.5R behind peak

      // Partial profits
      enablePartialClose: true,
      partialCloseR: 2.0,       // Take 50% at 2R (lock in profit)
      partialClosePercent: 50   // Close 50% of position
    },

    // Expected Performance (based on 1H backtest results)
    expectedSignalsPerDay: '1-2 per symbol per week (ultra-selective)',
    targetWinRate: '75-83%',
    targetProfitFactor: '3.0-5.0+',

    // Recommended symbols for SNIPER mode (from backtest)
    recommendedSymbols: ['DOGEUSDT', 'SOLUSDT', 'MATICUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT'],

    // Notes
    notes: [
      'Best performance on 1H timeframe',
      'Focus on DOGE (83.3% WR), SOL (80% WR), MATIC (75% WR)',
      'Requires rejection pattern for entry',
      'Higher R:R targets due to 1H structure',
      'Run on 4-6 symbols for 1-2 trades/day total'
    ]
  },

};

// Runtime configuration overrides (loaded from settings)
let runtimeConfig = null;

/**
 * Get timeframe-specific adjustments for 5m (very relaxed for scalping)
 * @param {Object} baseConfig - Base strategy config
 * @returns {Object} Adjusted config for 5m
 */
function get5mAdjustments(baseConfig) {
  return {
    ...baseConfig,
    // CRITICAL: Even lower confluence for 5m (very choppy, scalping timeframe)
    minimumConfluence: Math.max(10, baseConfig.minimumConfluence - 40),

    // CRITICAL: Allow neutral zone (5m constantly sideways)
    allowNeutralZone: true,
    neutralZoneScore: 15, // More points for neutral zone on 5m

    // CRITICAL: Don't require HTF alignment (5m is pure scalping)
    strictHTFAlignment: false,

    // CRITICAL: Don't require rejection (candles extremely fast on 5m)
    requireRejectionPattern: false,

    // CRITICAL: Remove required confirmations (way too restrictive for 5m)
    requiredConfirmations: [],

    // Even lower OB threshold for tiny 5m moves
    obImpulseThreshold: 0.002, // 0.2% (vs 0.5% on higher TF) - scalping moves

    // Much lower R:R target (5m has very small moves, quick scalps)
    minimumRiskReward: Math.max(0.8, baseConfig.minimumRiskReward - 1.0),

    // Very tight stop loss for 5m (tiny moves, very tight risk)
    stopLossATRMultiplier: Math.max(1.2, baseConfig.stopLossATRMultiplier - 1.0)
  };
}

/**
 * Get timeframe-specific adjustments for 15m (less strict)
 * @param {Object} baseConfig - Base strategy config
 * @returns {Object} Adjusted config for 15m
 */
function get15mAdjustments(baseConfig) {
  return {
    ...baseConfig,
    // CRITICAL: Much lower confluence for 15m (choppy timeframe, more signals)
    minimumConfluence: Math.max(15, baseConfig.minimumConfluence - 30),

    // CRITICAL: Allow neutral zone (15m often sideways)
    allowNeutralZone: true,
    neutralZoneScore: 10, // Give points for neutral zone

    // CRITICAL: Don't require HTF alignment (15m can counter-trend scalp)
    strictHTFAlignment: false,

    // CRITICAL: Don't require rejection (candles too fast on 15m)
    requireRejectionPattern: false,

    // CRITICAL: Remove required confirmations (too restrictive for 15m)
    requiredConfirmations: [],

    // Lower OB threshold for smaller 15m moves
    obImpulseThreshold: 0.0025, // 0.25% (vs 0.5% on higher TF) - catch smaller moves

    // Lower R:R target (15m has smaller moves, quick scalps)
    minimumRiskReward: Math.max(1.0, baseConfig.minimumRiskReward - 0.8),

    // Tighter stop loss for 15m (smaller moves, tighter risk)
    stopLossATRMultiplier: Math.max(1.5, baseConfig.stopLossATRMultiplier - 0.7)
  };
}

/**
 * Gets the current strategy configuration
 * @param {string} timeframe - Optional timeframe for adjustments
 * @returns {Object} Current strategy config
 */
export function getCurrentConfig(timeframe = null) {
  // Use runtime mode if set (from setStrategyMode), otherwise use CURRENT_MODE
  const activeMode = runtimeMode || CURRENT_MODE;

  let config = STRATEGY_CONFIG[activeMode];

  // If runtime config is set (from settings), merge it with the base config
  if (runtimeConfig) {
    config = { ...config, ...runtimeConfig };
  }

  // Apply timeframe-specific adjustments
  if (timeframe === '5m') {
    config = get5mAdjustments(config);
  } else if (timeframe === '15m') {
    config = get15mAdjustments(config);
  }

  return config;
}

/**
 * Gets configuration for a specific mode
 * @param {string} mode - Strategy mode
 * @param {string} timeframe - Optional timeframe for adjustments
 * @returns {Object} Strategy config
 */
export function getConfig(mode, timeframe = null) {
  let config = STRATEGY_CONFIG[mode] || STRATEGY_CONFIG[STRATEGY_MODES.MODERATE];

  // Apply timeframe-specific adjustments
  if (timeframe === '5m') {
    config = get5mAdjustments(config);
  } else if (timeframe === '15m') {
    config = get15mAdjustments(config);
  }

  return config;
}

/**
 * Checks if a confirmation is required
 * @param {string} confirmation - Confirmation type
 * @returns {boolean} True if required
 */
export function isConfirmationRequired(confirmation) {
  const config = getCurrentConfig();
  return config.requiredConfirmations.includes(confirmation);
}

/**
 * Checks if a confirmation is optional (adds bonus points)
 * @param {string} confirmation - Confirmation type
 * @returns {boolean} True if optional
 */
export function isConfirmationOptional(confirmation) {
  const config = getCurrentConfig();
  return config.optionalConfirmations?.includes(confirmation) || false;
}

/**
 * Gets confluence score for a specific factor
 * @param {string} factor - Confluence factor
 * @returns {number} Points to add
 */
export function getConfluenceScore(factor) {
  const config = getCurrentConfig();
  return config.confluenceWeights[factor] || 0;
}

/**
 * Updates strategy configuration from settings
 * @param {Object} settings - Settings object from config.json
 */
export function updateStrategyFromSettings(settings) {
  if (!settings) {
    runtimeConfig = null;
    return;
  }

  // Build runtime config from settings
  runtimeConfig = {};

  if (settings.minimumConfluence !== undefined) {
    runtimeConfig.minimumConfluence = settings.minimumConfluence;
  }

  if (settings.stopLossATRMultiplier !== undefined) {
    runtimeConfig.stopLossATRMultiplier = settings.stopLossATRMultiplier;
  }

  if (settings.obImpulseThreshold !== undefined) {
    runtimeConfig.obImpulseThreshold = settings.obImpulseThreshold;
  }

  if (settings.allowNeutralZone !== undefined) {
    runtimeConfig.allowNeutralZone = settings.allowNeutralZone;
  }

  if (settings.minimumRiskReward !== undefined) {
    runtimeConfig.minimumRiskReward = settings.minimumRiskReward;
  }

  console.log('Strategy configuration updated from settings:', runtimeConfig);
}

/**
 * Loads and applies settings from config file (server-side only)
 */
export async function loadSettingsFromConfig() {
  try {
    // Only works on server-side (Node.js)
    if (typeof window === 'undefined') {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const configPath = path.join(__dirname, '../../config.json');

      const data = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(data);

      updateStrategyFromSettings(config);
    }
  } catch (error) {
    console.log('Could not load settings from config:', error.message);
  }
}

/**
 * Gets timeframe-specific parameters for SCALPING mode
 * @param {string} timeframe - Timeframe ('1m' or '5m')
 * @returns {Object|null} Config with timeframe params merged, or null if not in scalping mode
 */
export function getScalpingParams(timeframe) {
  const config = getCurrentConfig();

  if (config.scalping?.enableTimeoutExit !== true) {
    return null;
  }

  const tf = timeframe === '1m' ? '1m' : '5m';
  const tfParams = config.timeframeParams?.[tf] || {};

  return { ...config, ...tfParams, timeframe: tf };
}

// Runtime mode override for programmatic switching (used in backtests)
let runtimeMode = null;

/**
 * Sets the strategy mode programmatically (for backtests)
 * @param {string} mode - Strategy mode to use
 */
export function setStrategyMode(mode) {
  const modeKey = mode.toUpperCase();
  if (STRATEGY_MODES[modeKey]) {
    runtimeMode = STRATEGY_MODES[modeKey]; // Use lowercase value for config lookup
    console.log(`Strategy mode set to: ${runtimeMode}`);
  } else {
    console.warn(`Invalid strategy mode: ${mode}`);
  }
}

/**
 * Gets the active strategy mode
 * @returns {string} Current mode
 */
export function getStrategyMode() {
  return runtimeMode || CURRENT_MODE;
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
 * Get confluence score for inducement type
 * @param {string} inducementType - Type of inducement detected
 * @param {Object} config - Strategy configuration
 * @returns {number} Confluence score for the inducement type
 */
export function getInducementConfluenceScore(inducementType, config) {
  const weights = config.confluenceWeights;

  switch (inducementType) {
    case 'inducement':
      return weights.basicInducement || 10;
    case 'supply_demand_inducement':
      return weights.supplyDemandInducement || 15;
    case 'consolidation_inducement':
      return weights.consolidationInducement || 12;
    case 'premature_reversal_inducement':
      return weights.prematureReversalInducement || 8;
    case 'first_pullback_inducement':
      return weights.firstPullbackInducement || 15;
    default:
      return 0;
  }
}

/**
 * Check if inducement is required for current mode
 * @param {string} mode - Strategy mode (e.g., 'MODERATE', 'CONSERVATIVE')
 * @returns {boolean} True if inducement is required
 */
export function isInducementRequired(mode = 'MODERATE') {
  const config = STRATEGY_CONFIG[mode] || STRATEGY_CONFIG.MODERATE;
  return config.requiredConfirmations.includes('inducement');
}

/**
 * Get minimum inducement distance in ATR multiples for current mode
 * @param {string} mode - Strategy mode
 * @returns {number} Minimum distance in ATR multiples
 */
export function getMinimumInducementDistance(mode = 'MODERATE') {
  const distances = {
    CONSERVATIVE: 1.2,
    MODERATE: 0.8,
    AGGRESSIVE: 0.5,
    SCALPING: 1.0
  };
  return distances[mode] || 0.8;
}

export default {
  STRATEGY_MODES,
  CURRENT_MODE,
  STRATEGY_CONFIG,
  getCurrentConfig,
  getConfig,
  isConfirmationRequired,
  isConfirmationOptional,
  getConfluenceScore,
  updateStrategyFromSettings,
  loadSettingsFromConfig,
  getScalpingParams,
  setStrategyMode,
  getStrategyMode,
  getHTFTimeframe,
  getInducementConfluenceScore,
  isInducementRequired,
  getMinimumInducementDistance
};
