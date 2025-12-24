/**
 * Strategy Configuration
 * Allows toggling between conservative and moderate SMC settings
 */

export const STRATEGY_MODES = {
  CONSERVATIVE: 'conservative',
  MODERATE: 'moderate',
  AGGRESSIVE: 'aggressive'
};

// Current mode - change this to switch strategies
export const CURRENT_MODE = STRATEGY_MODES.MODERATE; // Moderate mode optimized for real-time

export const STRATEGY_CONFIG = {
  [STRATEGY_MODES.CONSERVATIVE]: {
    name: 'Conservative (Ultra-Safe)',
    description: 'ALL 4 confirmations required, highest win rate target',

    // Order Block Settings
    obImpulseThreshold: 0.007, // 0.7%

    // Confirmation Requirements
    requireAllConfirmations: true,
    requiredConfirmations: ['liquiditySweep', 'bos', 'fvg', 'validZone'],

    // Zone Settings
    allowNeutralZone: false,
    neutralZoneScore: 0,

    // Stop Loss Settings
    stopLossATRMultiplier: 2.5,

    // Confluence Settings
    minimumConfluence: 65,
    confluenceWeights: {
      fvg: 25,
      liquiditySweep: 25,
      bos: 20,
      validZone: 20,
      volume: 15,
      ote: 10,
      breakerBlock: 10,
      bms: 10
    },

    // Entry Settings
    requireBOSConfirmation: true,
    bosLookback: 10, // candles

    // Risk Management
    minimumRiskReward: 1.5,

    // Expected Performance
    expectedSignalsPerDay: '5-15 (across 50 symbols)',
    targetWinRate: '65-75%',
    targetProfitFactor: '>2.5'
  },

  [STRATEGY_MODES.MODERATE]: {
    name: 'Moderate (Balanced)',
    description: '3 core confirmations + optional sweep, good balance',

    // Order Block Settings
    obImpulseThreshold: 0.005, // 0.5% (reduced from 0.7%)

    // Confirmation Requirements
    requireAllConfirmations: false,
    requiredConfirmations: ['fvg'], // Only FVG required for real-time
    optionalConfirmations: ['liquiditySweep', 'bos', 'validZone'], // Zone, BOS and Sweep add bonus points

    // Zone Settings
    allowNeutralZone: true,
    neutralZoneScore: 10, // Increased for real-time

    // Stop Loss Settings
    stopLossATRMultiplier: 2.5, // Optimal value (tested 3.0, but 2.5 has better performance)

    // Confluence Settings
    minimumConfluence: 40, // Reduced for real-time signal generation (from 55)
    confluenceWeights: {
      fvg: 25,
      liquiditySweep: 20, // Reduced from 25 (optional now)
      bos: 20,
      validZone: 20,
      neutralZone: 5, // Added
      volume: 15,
      ote: 10,
      breakerBlock: 10,
      bms: 10
    },

    // Entry Settings
    requireBOSConfirmation: false, // Allow immediate entry at OB for more signals
    bosLookback: 10,

    // Risk Management
    minimumRiskReward: 1.5,

    // Expected Performance
    expectedSignalsPerDay: '15-40 (across 50 symbols)',
    targetWinRate: '55-65%',
    targetProfitFactor: '>2.0'
  },

  [STRATEGY_MODES.AGGRESSIVE]: {
    name: 'Aggressive (High Frequency)',
    description: 'Lower requirements, more signals, lower win rate',

    // Order Block Settings
    obImpulseThreshold: 0.003, // 0.3%

    // Confirmation Requirements
    requireAllConfirmations: false,
    requiredConfirmations: ['bos', 'fvg'], // Only 2 required
    optionalConfirmations: ['liquiditySweep', 'validZone'],

    // Zone Settings
    allowNeutralZone: true,
    neutralZoneScore: 10,

    // Stop Loss Settings
    stopLossATRMultiplier: 2.0,

    // Confluence Settings
    minimumConfluence: 40,
    confluenceWeights: {
      fvg: 20,
      liquiditySweep: 15,
      bos: 15,
      validZone: 15,
      neutralZone: 10,
      volume: 10,
      ote: 10,
      breakerBlock: 10,
      bms: 10
    },

    // Entry Settings
    requireBOSConfirmation: false, // Allows immediate entry
    bosLookback: 10,

    // Risk Management
    minimumRiskReward: 1.3,

    // Expected Performance
    expectedSignalsPerDay: '50-100+ (across 50 symbols)',
    targetWinRate: '45-55%',
    targetProfitFactor: '>1.5'
  }
};

/**
 * Gets the current strategy configuration
 * @returns {Object} Current strategy config
 */
export function getCurrentConfig() {
  return STRATEGY_CONFIG[CURRENT_MODE];
}

/**
 * Gets configuration for a specific mode
 * @param {string} mode - Strategy mode
 * @returns {Object} Strategy config
 */
export function getConfig(mode) {
  return STRATEGY_CONFIG[mode] || STRATEGY_CONFIG[STRATEGY_MODES.MODERATE];
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

export default {
  STRATEGY_MODES,
  CURRENT_MODE,
  STRATEGY_CONFIG,
  getCurrentConfig,
  getConfig,
  isConfirmationRequired,
  isConfirmationOptional,
  getConfluenceScore
};
