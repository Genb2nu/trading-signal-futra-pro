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
export const CURRENT_MODE = STRATEGY_MODES.MODERATE; // Moderate mode for 1h real-time trading

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
    minimumRiskReward: 2.0,

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
    minimumRiskReward: 2.0,

    // Expected Performance
    expectedSignalsPerDay: '15-40 (across 50 symbols)',
    targetWinRate: '55-65%',
    targetProfitFactor: '>2.0'
  },

  [STRATEGY_MODES.AGGRESSIVE]: {
    name: 'Aggressive (High Frequency)',
    description: 'Optimized for faster timeframes (15m, 5m) - no FVG required',

    // Order Block Settings
    obImpulseThreshold: 0.003, // 0.3% - more sensitive for faster timeframes

    // Confirmation Requirements
    requireAllConfirmations: false,
    requiredConfirmations: [], // No hard requirements - OB + any confluence is enough
    optionalConfirmations: ['liquiditySweep', 'bos', 'fvg', 'validZone'],

    // Zone Settings
    allowNeutralZone: true,
    neutralZoneScore: 10,

    // Stop Loss Settings
    stopLossATRMultiplier: 2.0,

    // Confluence Settings
    minimumConfluence: 25, // Lower threshold for faster timeframes
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
    minimumRiskReward: 1.5,

    // Expected Performance
    expectedSignalsPerDay: '50-100+ (across 50 symbols)',
    targetWinRate: '45-55%',
    targetProfitFactor: '>1.5'
  }
};

// Runtime configuration overrides (loaded from settings)
let runtimeConfig = null;

/**
 * Gets the current strategy configuration
 * @returns {Object} Current strategy config
 */
export function getCurrentConfig() {
  // If runtime config is set (from settings), merge it with the base config
  if (runtimeConfig) {
    const baseConfig = STRATEGY_CONFIG[CURRENT_MODE];
    return { ...baseConfig, ...runtimeConfig };
  }
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
  loadSettingsFromConfig
};
