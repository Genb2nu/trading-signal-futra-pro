/**
 * Real-Time Signal Tracking System
 * Tracks signal outcomes to measure win rate and performance over time
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRACKING_FILE = path.join(__dirname, '../../signal-tracking.json');

/**
 * Initialize tracking file if it doesn't exist
 */
async function initializeTracking() {
  try {
    await fs.access(TRACKING_FILE);
  } catch {
    // File doesn't exist, create it
    const initialData = {
      version: '2.0-MTF',
      startDate: new Date().toISOString(),
      signals: [],
      stats: {
        totalSignals: 0,
        closedSignals: 0,
        activeSignals: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        winRate: 0,
        avgRMultiple: 0,
        totalProfitR: 0,
        totalLossR: 0,
        profitFactor: 0,
        expectancy: 0
      }
    };
    await fs.writeFile(TRACKING_FILE, JSON.stringify(initialData, null, 2));
  }
}

/**
 * Load tracking data
 */
async function loadTracking() {
  await initializeTracking();
  const data = await fs.readFile(TRACKING_FILE, 'utf-8');
  return JSON.parse(data);
}

/**
 * Save tracking data
 */
async function saveTracking(data) {
  await fs.writeFile(TRACKING_FILE, JSON.stringify(data, null, 2));
}

/**
 * Add a new signal to tracking
 * @param {Object} signal - Signal object with entry, SL, TP, etc.
 * @returns {string} Signal ID
 */
export async function trackNewSignal(signal) {
  const tracking = await loadTracking();

  const trackedSignal = {
    id: `${signal.symbol}_${Date.now()}`,
    symbol: signal.symbol || 'UNKNOWN',
    type: signal.type,
    direction: signal.direction,
    entry: signal.entry,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    riskReward: signal.riskReward,
    confidence: signal.confidence,
    confluenceScore: signal.confluenceScore || 0,
    patterns: signal.patterns || [],
    timestamp: signal.timestamp || new Date().toISOString(),
    status: 'ACTIVE',
    outcome: null,
    closedAt: null,
    pnlR: null,
    actualRR: null,
    notes: ''
  };

  tracking.signals.push(trackedSignal);
  tracking.stats.totalSignals++;
  tracking.stats.activeSignals++;

  await saveTracking(tracking);

  console.log(`✅ Signal tracked: ${trackedSignal.id} (${signal.type} ${signal.symbol})`);
  return trackedSignal.id;
}

/**
 * Update signal outcome
 * @param {string} signalId - Signal ID
 * @param {Object} outcome - { result: 'WIN'|'LOSS', pnlR: number, notes: string }
 */
export async function updateSignalOutcome(signalId, outcome) {
  const tracking = await loadTracking();

  const signal = tracking.signals.find(s => s.id === signalId);
  if (!signal) {
    throw new Error(`Signal ${signalId} not found`);
  }

  signal.status = 'CLOSED';
  signal.outcome = outcome.result;
  signal.closedAt = new Date().toISOString();
  signal.pnlR = outcome.pnlR;
  signal.actualRR = outcome.pnlR;
  signal.notes = outcome.notes || '';

  tracking.stats.activeSignals--;
  tracking.stats.closedSignals++;

  // Binary outcome: WIN (pnlR >= 0) or LOSS (pnlR < 0)
  if (outcome.pnlR >= 0) {
    tracking.stats.wins++;
    tracking.stats.totalProfitR += outcome.pnlR;
  } else {
    tracking.stats.losses++;
    tracking.stats.totalLossR += outcome.pnlR; // pnlR will be negative
  }

  // Recalculate stats
  tracking.stats = calculateStats(tracking.signals);

  await saveTracking(tracking);

  console.log(`✅ Signal outcome updated: ${signalId} - ${outcome.result} (${outcome.pnlR}R)`);
  return signal;
}

/**
 * Calculate statistics from signals
 */
function calculateStats(signals) {
  const closed = signals.filter(s => s.status === 'CLOSED');
  const active = signals.filter(s => s.status === 'ACTIVE');

  // Binary classification: WIN (pnlR >= 0) or LOSS (pnlR < 0)
  const wins = closed.filter(s => (s.pnlR || 0) >= 0);
  const losses = closed.filter(s => (s.pnlR || 0) < 0);

  const totalProfitR = wins.reduce((sum, s) => sum + (s.pnlR || 0), 0);
  const totalLossR = losses.reduce((sum, s) => sum + (s.pnlR || 0), 0);
  const netProfitR = totalProfitR + totalLossR;

  const winRate = closed.length > 0 ? (wins.length / closed.length * 100) : 0;
  const avgRMultiple = closed.length > 0 ? (netProfitR / closed.length) : 0;
  const profitFactor = Math.abs(totalLossR) > 0 ? (totalProfitR / Math.abs(totalLossR)) : (totalProfitR > 0 ? 999 : 0);
  const expectancy = avgRMultiple;

  return {
    totalSignals: signals.length,
    closedSignals: closed.length,
    activeSignals: active.length,
    wins: wins.length,
    losses: losses.length,
    winRate: parseFloat(winRate.toFixed(2)),
    avgRMultiple: parseFloat(avgRMultiple.toFixed(2)),
    totalProfitR: parseFloat(totalProfitR.toFixed(2)),
    totalLossR: parseFloat(totalLossR.toFixed(2)),
    netProfitR: parseFloat(netProfitR.toFixed(2)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(2))
  };
}

/**
 * Get current statistics
 */
export async function getStats() {
  const tracking = await loadTracking();
  return tracking.stats;
}

/**
 * Get all signals (with optional filter)
 */
export async function getSignals(filter = {}) {
  const tracking = await loadTracking();
  let signals = tracking.signals;

  if (filter.status) {
    signals = signals.filter(s => s.status === filter.status);
  }

  if (filter.symbol) {
    signals = signals.filter(s => s.symbol === filter.symbol);
  }

  if (filter.outcome) {
    signals = signals.filter(s => s.outcome === filter.outcome);
  }

  return signals;
}

/**
 * Get performance report
 */
export async function getPerformanceReport() {
  const tracking = await loadTracking();
  const stats = tracking.stats;

  const report = {
    summary: {
      version: tracking.version,
      startDate: tracking.startDate,
      lastUpdate: new Date().toISOString(),
      totalSignals: stats.totalSignals,
      activeSignals: stats.activeSignals,
      closedSignals: stats.closedSignals
    },
    performance: {
      winRate: `${stats.winRate}%`,
      wins: stats.wins,
      losses: stats.losses,
      breakeven: stats.breakeven,
      profitFactor: stats.profitFactor,
      expectancy: `${stats.expectancy}R`,
      netProfit: `${stats.netProfitR}R`
    },
    comparison: {
      baseline: {
        winRate: '78.1%',
        profitFactor: 7.96,
        expectancy: '+1.05R'
      },
      current: {
        winRate: `${stats.winRate}%`,
        profitFactor: stats.profitFactor,
        expectancy: `${stats.expectancy}R`
      },
      improvement: {
        winRate: `${(stats.winRate - 78.1).toFixed(1)}%`,
        profitFactor: `${(stats.profitFactor - 7.96).toFixed(2)}`,
        expectancy: `${(stats.expectancy - 1.05).toFixed(2)}R`
      }
    },
    signals: {
      recentWins: tracking.signals
        .filter(s => s.outcome === 'WIN')
        .slice(-5)
        .map(s => ({ id: s.id, symbol: s.symbol, pnlR: s.pnlR, confluenceScore: s.confluenceScore })),
      recentLosses: tracking.signals
        .filter(s => s.outcome === 'LOSS')
        .slice(-5)
        .map(s => ({ id: s.id, symbol: s.symbol, pnlR: s.pnlR, confluenceScore: s.confluenceScore })),
      activeSignals: tracking.signals
        .filter(s => s.status === 'ACTIVE')
        .map(s => ({ id: s.id, symbol: s.symbol, entry: s.entry, confluenceScore: s.confluenceScore }))
    }
  };

  return report;
}

/**
 * Export data to CSV
 */
export async function exportToCSV() {
  const tracking = await loadTracking();

  const headers = [
    'ID', 'Symbol', 'Type', 'Entry', 'StopLoss', 'TakeProfit', 'RiskReward',
    'ConfluenceScore', 'Confidence', 'Timestamp', 'Status', 'Outcome',
    'ClosedAt', 'PnL_R', 'Notes'
  ];

  const rows = tracking.signals.map(s => [
    s.id,
    s.symbol,
    s.type,
    s.entry,
    s.stopLoss,
    s.takeProfit,
    s.riskReward,
    s.confluenceScore,
    s.confidence,
    s.timestamp,
    s.status,
    s.outcome || '',
    s.closedAt || '',
    s.pnlR || '',
    s.notes || ''
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  const csvPath = path.join(__dirname, '../../signal-tracking-export.csv');
  await fs.writeFile(csvPath, csv);

  return csvPath;
}

/**
 * Reset tracking data (use with caution!)
 */
export async function resetTracking() {
  const data = {
    version: '2.0-MTF',
    startDate: new Date().toISOString(),
    signals: [],
    stats: {
      totalSignals: 0,
      closedSignals: 0,
      activeSignals: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      winRate: 0,
      avgRMultiple: 0,
      totalProfitR: 0,
      totalLossR: 0,
      profitFactor: 0,
      expectancy: 0
    }
  };

  await saveTracking(data);
  console.log('⚠️  Tracking data reset!');
}

export default {
  trackNewSignal,
  updateSignalOutcome,
  getStats,
  getSignals,
  getPerformanceReport,
  exportToCSV,
  resetTracking
};
