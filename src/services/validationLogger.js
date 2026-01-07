/**
 * Live Trading Validation Logger
 * Tracks all signals, state transitions, and outcomes for Option A validation
 *
 * Purpose: Collect data to validate system performance and inform Option E optimization
 *
 * UPDATED: Now uses SQLite database instead of JSON files for mobile deployment
 */

import * as db from './database.js';

/**
 * Log a new signal detection
 * @param {Object} signal - The detected signal
 * @param {Object} metadata - Additional context (symbol, timeframe, mode)
 */
export function logSignalDetection(signal, metadata = {}) {
  try {
    // Prepare signal data with all patterns and confirmation details
    const signalData = {
      direction: signal.direction,
      entryState: signal.entryState,
      canTrack: signal.canTrack,
      entry: signal.entry,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      riskReward: signal.riskReward,
      confluenceScore: signal.confluenceScore,
      patterns: {
        hasOrderBlock: !!signal.orderBlock,
        hasFVG: !!signal.fvg,
        hasBOS: signal.confirmationDetails?.bosDetected || false,
        hasCHOCH: signal.confirmationDetails?.chochDetected || false,
        hasLiquiditySweep: !!signal.liquiditySweep,
        hasRejection: signal.confirmationDetails?.rejectionConfirmed || false
      },
      confirmationDetails: signal.confirmationDetails,
      orderBlock: signal.orderBlock,
      fvg: signal.fvg,
      bos: signal.bos,
      choch: signal.choch,
      liquiditySweep: signal.liquiditySweep,
      entryTiming: signal.entryTiming
    };

    const signalId = db.logSignal(signalData, metadata);
    console.log(`[VALIDATION] Signal logged: ${signalId}`);
    return signalId;
  } catch (error) {
    console.error('[VALIDATION] Error logging signal:', error);
    return null;
  }
}

/**
 * Log a state transition for a signal
 * @param {string} signalId - The signal ID
 * @param {string} fromState - Previous entry state
 * @param {string} toState - New entry state
 * @param {Object} context - Additional context about the transition
 */
export function logStateTransition(signalId, fromState, toState, context = {}) {
  try {
    db.logStateTransition(signalId, fromState, toState, context);
    console.log(`[VALIDATION] State transition logged: ${signalId} (${fromState} → ${toState})`);
  } catch (error) {
    console.error('[VALIDATION] Error logging transition:', error);
  }
}

/**
 * Update signal tracking status
 * @param {string} signalId - The signal ID
 * @param {boolean} tracked - Whether user tracked this signal
 */
export function updateSignalTracking(signalId, tracked) {
  try {
    db.updateSignalTracking(signalId, tracked);
    console.log(`[VALIDATION] Signal tracking updated: ${signalId} (tracked: ${tracked})`);
  } catch (error) {
    console.error('[VALIDATION] Error updating tracking:', error);
  }
}

/**
 * Log signal outcome (for tracked signals)
 * @param {string} signalId - The signal ID
 * @param {string} outcome - 'win' | 'loss' | 'breakeven'
 * @param {Object} details - Outcome details (R:R achieved, exit price, etc.)
 */
export function logSignalOutcome(signalId, outcome, details = {}) {
  try {
    const outcomeData = {
      result: outcome,
      exitPrice: details.exitPrice,
      profitLoss: details.profitLoss || 0,
      riskRewardAchieved: details.riskRewardAchieved || 0,
      exitReason: details.exitReason || 'MANUAL',
      notes: details.notes || ''
    };

    db.logOutcome(signalId, outcomeData);
    console.log(`[VALIDATION] Outcome logged: ${signalId} (${outcome})`);
  } catch (error) {
    console.error('[VALIDATION] Error logging outcome:', error);
  }
}

/**
 * Add a note to a signal
 * @param {string} signalId - The signal ID
 * @param {string} note - The note to add
 */
export function addSignalNote(signalId, note) {
  try {
    db.addNote(signalId, note);
  } catch (error) {
    console.error('[VALIDATION] Error adding note:', error);
  }
}

/**
 * Log daily metrics summary (placeholder for future use)
 * @param {Object} metrics - Daily performance metrics
 */
export function logDailyMetrics(metrics) {
  try {
    // Future enhancement: add daily_metrics table
    console.log(`[VALIDATION] Daily metrics logged (placeholder):`, metrics);
  } catch (error) {
    console.error('[VALIDATION] Error logging daily metrics:', error);
  }
}

/**
 * Get all logged signals
 * @param {Object} filters - Optional filters (symbol, mode, entryState, etc.)
 * @returns {Array} Filtered signals
 */
export function getLoggedSignals(filters = {}) {
  try {
    // Convert entryState filter to database format
    const dbFilters = { ...filters };
    if (filters.entryState) {
      dbFilters.entryState = filters.entryState;
    }

    const signals = db.getSignals(dbFilters);

    // Additional filtering for outcome if needed
    if (filters.outcome) {
      return signals.filter(s => s.outcome?.result === filters.outcome);
    }

    return signals;
  } catch (error) {
    console.error('[VALIDATION] Error getting signals:', error);
    return [];
  }
}

/**
 * Get state transitions for a signal
 * @param {string} signalId - The signal ID
 * @returns {Array} Transitions for this signal
 */
export function getSignalTransitions(signalId) {
  try {
    return db.getStateTransitions(signalId);
  } catch (error) {
    console.error('[VALIDATION] Error getting transitions:', error);
    return [];
  }
}

/**
 * Get daily metrics (placeholder)
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Array} Daily metrics in date range
 */
export function getDailyMetrics(startDate, endDate) {
  try {
    // Future enhancement: implement daily_metrics table
    return [];
  } catch (error) {
    console.error('[VALIDATION] Error getting daily metrics:', error);
    return [];
  }
}

/**
 * Calculate validation summary statistics
 * @returns {Object} Summary statistics
 */
export function getValidationSummary() {
  try {
    const summary = db.getValidationSummary();
    const signals = db.getSignals();

    // Additional calculations
    const byDirection = {
      bullish: signals.filter(s => s.signal.direction === 'bullish').length,
      bearish: signals.filter(s => s.signal.direction === 'bearish').length
    };

    // Pattern effectiveness
    const patternStats = {
      orderBlock: signals.filter(s => s.signal.patterns?.hasOrderBlock).length,
      fvg: signals.filter(s => s.signal.patterns?.hasFVG).length,
      bos: signals.filter(s => s.signal.patterns?.hasBOS).length,
      choch: signals.filter(s => s.signal.patterns?.hasCHOCH).length,
      liquiditySweep: signals.filter(s => s.signal.patterns?.hasLiquiditySweep).length,
      rejection: signals.filter(s => s.signal.patterns?.hasRejection).length
    };

    // Data collection period
    const dataCollectionPeriod = {
      start: signals[0]?.timestamp || null,
      end: signals[signals.length - 1]?.timestamp || null
    };

    return {
      ...summary,
      byDirection,
      patterns: patternStats,
      dataCollectionPeriod,
      timing: {
        avgTimeToReady: 0, // Future enhancement
        totalTransitions: 0 // Future enhancement
      }
    };
  } catch (error) {
    console.error('[VALIDATION] Error calculating summary:', error);
    return null;
  }
}

export default {
  logSignalDetection,
  logStateTransition,
  updateSignalTracking,
  logSignalOutcome,
  addSignalNote,
  logDailyMetrics,
  getLoggedSignals,
  getSignalTransitions,
  getDailyMetrics,
  getValidationSummary
};
