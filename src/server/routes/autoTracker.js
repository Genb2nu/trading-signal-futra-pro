/**
 * Auto-Tracker API Routes
 * Endpoints for automatic signal tracking and validation
 */

import express from 'express';
import { getLoggedSignals, updateSignalTracking, logSignalOutcome, getValidationSummary, addSignalNote } from '../../services/validationLogger.js';
import { isAutoTracked, addAutoTracked } from '../../services/database.js';
import axios from 'axios';

const router = express.Router();

/**
 * Get all tracked signals with current prices
 */
router.get('/tracked-signals', async (req, res) => {
  try {
    const trackedSignals = getLoggedSignals({ tracked: true });

    // Fetch current prices for open trades
    const signalsWithPrices = await Promise.all(
      trackedSignals.map(async (signal) => {
        if (!signal.outcome) {
          // Trade is still open, fetch current price
          try {
            const priceResponse = await axios.get(
              `https://api.binance.com/api/v3/ticker/price?symbol=${signal.symbol}`
            );
            const currentPrice = parseFloat(priceResponse.data.price);

            // Calculate progress
            const progress = calculateProgress(
              signal.signal.entry,
              currentPrice,
              signal.signal.stopLoss,
              signal.signal.takeProfit,
              signal.signal.direction
            );

            return { ...signal, currentPrice, progress };
          } catch (error) {
            console.error(`Error fetching price for ${signal.symbol}:`, error.message);
            return signal;
          }
        }
        return signal;
      })
    );

    res.json({
      success: true,
      signals: signalsWithPrices
    });
  } catch (error) {
    console.error('Error getting tracked signals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get all ENTRY_READY signals (for auto-tracking)
 */
router.get('/ready-signals', async (req, res) => {
  try {
    const readySignals = getLoggedSignals({ entryState: 'ENTRY_READY' });

    res.json({
      success: true,
      signals: readySignals
    });
  } catch (error) {
    console.error('Error getting ready signals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Track a signal
 */
router.post('/track-signal/:signalId', (req, res) => {
  try {
    const { signalId } = req.params;

    updateSignalTracking(signalId, true);

    // Also mark as auto-tracked to prevent duplicates
    const signal = getLoggedSignals().find(s => s.id === signalId);
    if (signal) {
      const signalKey = `${signal.symbol}_${signal.signal.direction}_${signal.timeframe}`;
      addAutoTracked(signalKey, signalId);
    }

    res.json({
      success: true,
      message: 'Signal tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking signal:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Untrack a signal
 */
router.post('/untrack-signal/:signalId', (req, res) => {
  try {
    const { signalId } = req.params;

    updateSignalTracking(signalId, false);

    res.json({
      success: true,
      message: 'Signal untracked successfully'
    });
  } catch (error) {
    console.error('Error untracking signal:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Record trade outcome
 */
router.post('/record-outcome/:signalId', (req, res) => {
  try {
    const { signalId } = req.params;
    const { result, exitPrice, notes } = req.body;

    const signal = getLoggedSignals().find(s => s.id === signalId);

    if (!signal) {
      return res.status(404).json({
        success: false,
        error: 'Signal not found'
      });
    }

    // Calculate P/L and R:R achieved
    const entry = signal.signal.entry;
    const sl = signal.signal.stopLoss;
    const tp = signal.signal.takeProfit;
    const direction = signal.signal.direction;

    let profitLoss, riskRewardAchieved;

    if (direction === 'bullish') {
      profitLoss = ((exitPrice - entry) / entry) * 100;
      const risk = entry - sl;
      const actualGain = exitPrice - entry;
      riskRewardAchieved = actualGain / risk;
    } else {
      profitLoss = ((entry - exitPrice) / entry) * 100;
      const risk = sl - entry;
      const actualGain = entry - exitPrice;
      riskRewardAchieved = actualGain / risk;
    }

    logSignalOutcome(signalId, result, {
      exitPrice,
      profitLoss: profitLoss.toFixed(2),
      riskRewardAchieved: riskRewardAchieved.toFixed(2),
      notes
    });

    res.json({
      success: true,
      message: 'Outcome recorded successfully',
      outcome: {
        result,
        profitLoss: profitLoss.toFixed(2),
        riskRewardAchieved: riskRewardAchieved.toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error recording outcome:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Add note to signal
 */
router.post('/add-note/:signalId', (req, res) => {
  try {
    const { signalId } = req.params;
    const { note } = req.body;

    addSignalNote(signalId, note);

    res.json({
      success: true,
      message: 'Note added successfully'
    });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get validation summary statistics
 */
router.get('/stats', (req, res) => {
  try {
    const summary = getValidationSummary();

    res.json({
      success: true,
      stats: summary
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Auto-track all ENTRY_READY signals that aren't already tracked
 */
router.post('/auto-track', async (req, res) => {
  try {
    const readySignals = getLoggedSignals({ entryState: 'ENTRY_READY' });
    let trackedCount = 0;

    for (const signal of readySignals) {
      const signalKey = `${signal.symbol}_${signal.signal.direction}_${signal.timeframe}`;

      // Check if already auto-tracked
      if (!isAutoTracked(signalKey) && !signal.tracked) {
        updateSignalTracking(signal.id, true);
        addAutoTracked(signalKey, signal.id);
        addSignalNote(signal.id, 'Auto-tracked by UI auto-tracker');
        trackedCount++;
      }
    }

    res.json({
      success: true,
      message: `Auto-tracked ${trackedCount} signal(s)`,
      trackedCount
    });
  } catch (error) {
    console.error('Error auto-tracking:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper function to calculate trade progress
 */
function calculateProgress(entry, currentPrice, stopLoss, takeProfit, direction) {
  if (!currentPrice) return null;

  if (direction === 'bullish') {
    const risk = entry - stopLoss;
    const reward = takeProfit - entry;
    const currentGain = currentPrice - entry;
    const percentToTP = (currentGain / reward) * 100;
    const rMultiple = currentGain / risk;

    return {
      pnl: ((currentPrice - entry) / entry) * 100,
      rMultiple: rMultiple.toFixed(2),
      percentToTP: percentToTP.toFixed(1),
      status: currentPrice >= takeProfit ? 'HIT TP' :
              currentPrice <= stopLoss ? 'HIT SL' :
              currentGain > 0 ? 'IN PROFIT' : 'IN LOSS'
    };
  } else {
    const risk = stopLoss - entry;
    const reward = entry - takeProfit;
    const currentGain = entry - currentPrice;
    const percentToTP = (currentGain / reward) * 100;
    const rMultiple = currentGain / risk;

    return {
      pnl: ((entry - currentPrice) / entry) * 100,
      rMultiple: rMultiple.toFixed(2),
      percentToTP: percentToTP.toFixed(1),
      status: currentPrice <= takeProfit ? 'HIT TP' :
              currentPrice >= stopLoss ? 'HIT SL' :
              currentGain > 0 ? 'IN PROFIT' : 'IN LOSS'
    };
  }
}

export default router;
