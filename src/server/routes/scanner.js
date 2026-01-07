/**
 * Continuous Scanner API Routes
 * Control background scanning and data collection
 */

import express from 'express';
import scanner from '../../services/continuousScanner.js';
import { getValidationSummary, getLoggedSignals } from '../../services/validationLogger.js';
import { exportToJSON } from '../../services/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * Start continuous scanner
 */
router.post('/start', async (req, res) => {
  try {
    const { symbols, timeframes, scanFrequency } = req.body;

    if (!symbols || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No symbols provided'
      });
    }

    const result = await scanner.start(
      symbols,
      timeframes || ['15m', '1h', '4h'],
      scanFrequency || 5 * 60 * 1000 // 5 minutes default
    );

    res.json(result);
  } catch (error) {
    console.error('Error starting scanner:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Stop continuous scanner
 */
router.post('/stop', (req, res) => {
  try {
    const result = scanner.stop();
    res.json(result);
  } catch (error) {
    console.error('Error stopping scanner:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get scanner status
 */
router.get('/status', (req, res) => {
  try {
    const status = scanner.getStatus();
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting scanner status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Export all validation data to JSON
 */
router.get('/export-data', (req, res) => {
  try {
    const filename = exportToJSON();
    const filepath = path.join(__dirname, '../../../validation-data', filename);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).json({
          success: false,
          error: 'Error downloading file'
        });
      }
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get validation data summary (for analysis)
 */
router.get('/data-summary', (req, res) => {
  try {
    const summary = getValidationSummary();
    const allSignals = getLoggedSignals();

    // Group by timeframe
    const byTimeframe = {};
    allSignals.forEach(s => {
      if (!byTimeframe[s.timeframe]) {
        byTimeframe[s.timeframe] = 0;
      }
      byTimeframe[s.timeframe]++;
    });

    // Group by symbol
    const bySymbol = {};
    allSignals.forEach(s => {
      if (!bySymbol[s.symbol]) {
        bySymbol[s.symbol] = { total: 0, tracked: 0, wins: 0, losses: 0 };
      }
      bySymbol[s.symbol].total++;
      if (s.tracked) bySymbol[s.symbol].tracked++;
      if (s.outcome?.result === 'win') bySymbol[s.symbol].wins++;
      if (s.outcome?.result === 'loss') bySymbol[s.symbol].losses++;
    });

    // Calculate win rate by symbol (for symbols with outcomes)
    Object.keys(bySymbol).forEach(symbol => {
      const total = bySymbol[symbol].wins + bySymbol[symbol].losses;
      bySymbol[symbol].winRate = total > 0
        ? ((bySymbol[symbol].wins / total) * 100).toFixed(1)
        : 'N/A';
    });

    res.json({
      success: true,
      summary: {
        ...summary,
        byTimeframe,
        bySymbol,
        totalDataPoints: allSignals.length,
        collectionPeriod: summary.dataCollectionPeriod
      }
    });
  } catch (error) {
    console.error('Error getting data summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get all signals (for export/analysis)
 */
router.get('/all-signals', (req, res) => {
  try {
    const { limit, offset, entryState, tracked, outcome } = req.query;

    let signals = getLoggedSignals();

    // Apply filters
    if (entryState) {
      signals = signals.filter(s => s.signal.entryState === entryState);
    }
    if (tracked !== undefined) {
      signals = signals.filter(s => s.tracked === (tracked === 'true'));
    }
    if (outcome) {
      signals = signals.filter(s => s.outcome?.result === outcome);
    }

    // Apply pagination
    const total = signals.length;
    const start = parseInt(offset) || 0;
    const end = limit ? start + parseInt(limit) : signals.length;
    signals = signals.slice(start, end);

    res.json({
      success: true,
      total,
      offset: start,
      limit: limit ? parseInt(limit) : total,
      signals
    });
  } catch (error) {
    console.error('Error getting all signals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get learning insights from collected data
 */
router.get('/learning-insights', (req, res) => {
  try {
    const signals = getLoggedSignals({ tracked: true });
    const withOutcomes = signals.filter(s => s.outcome);

    if (withOutcomes.length < 5) {
      return res.json({
        success: true,
        message: 'Not enough data yet. Need at least 5 completed trades.',
        insights: null
      });
    }

    // Analyze patterns
    const insights = {
      totalTrades: withOutcomes.length,
      overallWinRate: 0,
      bestTimeframe: null,
      bestSymbols: [],
      patternEffectiveness: {},
      recommendations: []
    };

    // Calculate overall win rate
    const wins = withOutcomes.filter(s => s.outcome.result === 'win').length;
    insights.overallWinRate = ((wins / withOutcomes.length) * 100).toFixed(1);

    // Best timeframe
    const tfStats = {};
    withOutcomes.forEach(s => {
      if (!tfStats[s.timeframe]) {
        tfStats[s.timeframe] = { wins: 0, total: 0 };
      }
      tfStats[s.timeframe].total++;
      if (s.outcome.result === 'win') tfStats[s.timeframe].wins++;
    });

    let bestTF = null;
    let bestTFRate = 0;
    Object.keys(tfStats).forEach(tf => {
      const rate = (tfStats[tf].wins / tfStats[tf].total) * 100;
      if (rate > bestTFRate) {
        bestTFRate = rate;
        bestTF = tf;
      }
    });
    insights.bestTimeframe = { timeframe: bestTF, winRate: bestTFRate.toFixed(1) };

    // Best symbols (top 5)
    const symbolStats = {};
    withOutcomes.forEach(s => {
      if (!symbolStats[s.symbol]) {
        symbolStats[s.symbol] = { wins: 0, total: 0 };
      }
      symbolStats[s.symbol].total++;
      if (s.outcome.result === 'win') symbolStats[s.symbol].wins++;
    });

    insights.bestSymbols = Object.entries(symbolStats)
      .filter(([_, stats]) => stats.total >= 2) // At least 2 trades
      .map(([symbol, stats]) => ({
        symbol,
        winRate: ((stats.wins / stats.total) * 100).toFixed(1),
        trades: stats.total
      }))
      .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))
      .slice(0, 5);

    // Pattern effectiveness
    const patterns = ['hasOrderBlock', 'hasFVG', 'hasBOS', 'hasCHOCH', 'hasRejection'];
    patterns.forEach(pattern => {
      const withPattern = withOutcomes.filter(s => s.signal.patterns?.[pattern]);
      if (withPattern.length > 0) {
        const patternWins = withPattern.filter(s => s.outcome.result === 'win').length;
        insights.patternEffectiveness[pattern] = {
          winRate: ((patternWins / withPattern.length) * 100).toFixed(1),
          trades: withPattern.length
        };
      }
    });

    // Recommendations
    if (parseFloat(insights.overallWinRate) < 50) {
      insights.recommendations.push('Win rate below 50%. Consider tightening entry criteria.');
    }
    if (insights.bestTimeframe && parseFloat(insights.bestTimeframe.winRate) > 70) {
      insights.recommendations.push(`Focus on ${insights.bestTimeframe.timeframe} - highest win rate.`);
    }
    if (insights.bestSymbols.length > 0 && parseFloat(insights.bestSymbols[0].winRate) > 75) {
      insights.recommendations.push(`${insights.bestSymbols[0].symbol} shows strong performance.`);
    }

    res.json({
      success: true,
      insights
    });
  } catch (error) {
    console.error('Error getting learning insights:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
