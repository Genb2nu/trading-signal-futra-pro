/**
 * SQLite Database for Signal Validation and Auto-Trading
 * Replaces JSON file storage for mobile deployment
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file location
const DB_DIR = path.join(__dirname, '../../validation-data');
const DB_FILE = path.join(DB_DIR, 'signals.db');

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database connection
const db = new Database(DB_FILE);

// Enable WAL mode for better concurrency (important for mobile)
db.pragma('journal_mode = WAL');

/**
 * Initialize database schema
 */
export function initializeDatabase() {
  // Signals table - stores all detected signals
  db.exec(`
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      mode TEXT NOT NULL,
      direction TEXT NOT NULL,
      entry_state TEXT NOT NULL,
      entry_price REAL NOT NULL,
      stop_loss REAL NOT NULL,
      take_profit REAL NOT NULL,
      risk_reward REAL NOT NULL,
      confluence_score INTEGER NOT NULL,
      signal_data TEXT NOT NULL,
      tracked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
    CREATE INDEX IF NOT EXISTS idx_signals_tracked ON signals(tracked);
    CREATE INDEX IF NOT EXISTS idx_signals_entry_state ON signals(entry_state);
    CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);
  `);

  // State transitions table - tracks signal progression
  db.exec(`
    CREATE TABLE IF NOT EXISTS state_transitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_id TEXT NOT NULL,
      from_state TEXT NOT NULL,
      to_state TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      context TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (signal_id) REFERENCES signals(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transitions_signal_id ON state_transitions(signal_id);
    CREATE INDEX IF NOT EXISTS idx_transitions_timestamp ON state_transitions(timestamp);
  `);

  // Outcomes table - stores trade results
  db.exec(`
    CREATE TABLE IF NOT EXISTS outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_id TEXT NOT NULL,
      result TEXT NOT NULL,
      exit_price REAL NOT NULL,
      profit_loss REAL NOT NULL,
      risk_reward_achieved REAL NOT NULL,
      exit_reason TEXT,
      notes TEXT,
      timestamp TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (signal_id) REFERENCES signals(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_outcomes_signal_id ON outcomes(signal_id);
    CREATE INDEX IF NOT EXISTS idx_outcomes_result ON outcomes(result);
  `);

  // Auto-tracked signals table - prevents duplicate tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS auto_tracked (
      signal_key TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      tracked_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (signal_id) REFERENCES signals(id)
    )
  `);

  // Notes table - additional notes for signals
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_id TEXT NOT NULL,
      note TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (signal_id) REFERENCES signals(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notes_signal_id ON notes(signal_id);
  `);

  console.log('✅ Database initialized:', DB_FILE);
}

/**
 * Log a signal detection
 */
export function logSignal(signal, metadata) {
  const stmt = db.prepare(`
    INSERT INTO signals (
      id, timestamp, symbol, timeframe, mode, direction,
      entry_state, entry_price, stop_loss, take_profit,
      risk_reward, confluence_score, signal_data, tracked
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const id = `${metadata.symbol}_${signal.direction}_${Date.now()}`;
  const signalData = JSON.stringify(signal);

  stmt.run(
    id,
    new Date().toISOString(),
    metadata.symbol,
    metadata.timeframe,
    metadata.mode || 'MODERATE',
    signal.direction,
    signal.entryState || 'MONITORING',
    signal.entry,
    signal.stopLoss,
    signal.takeProfit,
    signal.riskReward,
    signal.confluenceScore,
    signalData,
    0 // not tracked initially
  );

  return id;
}

/**
 * Log a state transition
 */
export function logStateTransition(signalId, fromState, toState, context = {}) {
  const stmt = db.prepare(`
    INSERT INTO state_transitions (signal_id, from_state, to_state, timestamp, context)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    signalId,
    fromState,
    toState,
    new Date().toISOString(),
    JSON.stringify(context)
  );
}

/**
 * Update signal tracking status
 */
export function updateSignalTracking(signalId, tracked) {
  const stmt = db.prepare(`
    UPDATE signals SET tracked = ? WHERE id = ?
  `);

  stmt.run(tracked ? 1 : 0, signalId);
}

/**
 * Add auto-tracked signal
 */
export function addAutoTracked(signalKey, signalId) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO auto_tracked (signal_key, signal_id, tracked_at)
    VALUES (?, ?, ?)
  `);

  stmt.run(signalKey, signalId, new Date().toISOString());
}

/**
 * Check if signal is already auto-tracked
 */
export function isAutoTracked(signalKey) {
  const stmt = db.prepare(`
    SELECT 1 FROM auto_tracked WHERE signal_key = ?
  `);

  return stmt.get(signalKey) !== undefined;
}

/**
 * Log trade outcome
 */
export function logOutcome(signalId, outcome) {
  const stmt = db.prepare(`
    INSERT INTO outcomes (signal_id, result, exit_price, profit_loss, risk_reward_achieved, exit_reason, notes, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    signalId,
    outcome.result,
    outcome.exitPrice,
    outcome.profitLoss || 0,
    outcome.riskRewardAchieved || 0,
    outcome.exitReason || 'MANUAL',
    outcome.notes || '',
    new Date().toISOString()
  );
}

/**
 * Add note to signal
 */
export function addNote(signalId, note) {
  const stmt = db.prepare(`
    INSERT INTO notes (signal_id, note, timestamp)
    VALUES (?, ?, ?)
  `);

  stmt.run(signalId, note, new Date().toISOString());
}

/**
 * Get signals with filters
 */
export function getSignals(filters = {}) {
  let query = 'SELECT * FROM signals WHERE 1=1';
  const params = [];

  if (filters.symbol) {
    query += ' AND symbol = ?';
    params.push(filters.symbol);
  }

  if (filters.tracked !== undefined) {
    query += ' AND tracked = ?';
    params.push(filters.tracked ? 1 : 0);
  }

  if (filters.entryState) {
    query += ' AND entry_state = ?';
    params.push(filters.entryState);
  }

  if (filters.mode) {
    query += ' AND mode = ?';
    params.push(filters.mode);
  }

  query += ' ORDER BY timestamp DESC';

  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  const stmt = db.prepare(query);
  const rows = stmt.all(...params);

  // Parse signal_data JSON and add outcomes if any
  return rows.map(row => {
    const signal = JSON.parse(row.signal_data);
    const outcome = getOutcome(row.id);

    return {
      id: row.id,
      timestamp: row.timestamp,
      symbol: row.symbol,
      timeframe: row.timeframe,
      mode: row.mode,
      signal: signal,
      tracked: row.tracked === 1,
      trackedAt: row.tracked ? row.timestamp : null,
      outcome: outcome
    };
  });
}

/**
 * Get outcome for a signal
 */
export function getOutcome(signalId) {
  const stmt = db.prepare(`
    SELECT * FROM outcomes WHERE signal_id = ? ORDER BY timestamp DESC LIMIT 1
  `);

  const row = stmt.get(signalId);
  if (!row) return null;

  return {
    result: row.result,
    exitPrice: row.exit_price,
    profitLoss: row.profit_loss,
    riskRewardAchieved: row.risk_reward_achieved,
    exitReason: row.exit_reason,
    notes: row.notes,
    timestamp: row.timestamp
  };
}

/**
 * Get validation summary statistics
 */
export function getValidationSummary() {
  const totalSignals = db.prepare('SELECT COUNT(*) as count FROM signals').get().count;

  const byState = db.prepare(`
    SELECT entry_state, COUNT(*) as count FROM signals GROUP BY entry_state
  `).all();

  const byMode = db.prepare(`
    SELECT mode, COUNT(*) as count FROM signals GROUP BY mode
  `).all();

  const tracked = db.prepare('SELECT COUNT(*) as count FROM signals WHERE tracked = 1').get().count;

  const withOutcome = db.prepare(`
    SELECT COUNT(DISTINCT signal_id) as count FROM outcomes
  `).get().count;

  const wins = db.prepare(`
    SELECT COUNT(*) as count FROM outcomes WHERE result = 'win'
  `).get().count;

  const losses = db.prepare(`
    SELECT COUNT(*) as count FROM outcomes WHERE result = 'loss'
  `).get().count;

  const winRate = withOutcome > 0 ? ((wins / withOutcome) * 100).toFixed(1) : 0;

  return {
    totalSignals,
    byState: Object.fromEntries(byState.map(r => [r.entry_state, r.count])),
    byMode: Object.fromEntries(byMode.map(r => [r.mode, r.count])),
    tracking: {
      tracked,
      trackedWithOutcome: withOutcome,
      wins,
      losses,
      winRate: parseFloat(winRate)
    }
  };
}

/**
 * Get state transitions for a signal
 */
export function getStateTransitions(signalId) {
  const stmt = db.prepare(`
    SELECT * FROM state_transitions WHERE signal_id = ? ORDER BY timestamp ASC
  `);

  return stmt.all(signalId).map(row => ({
    fromState: row.from_state,
    toState: row.to_state,
    timestamp: row.timestamp,
    context: row.context ? JSON.parse(row.context) : {}
  }));
}

/**
 * Get notes for a signal
 */
export function getNotes(signalId) {
  const stmt = db.prepare(`
    SELECT * FROM notes WHERE signal_id = ? ORDER BY timestamp ASC
  `);

  return stmt.all(signalId).map(row => ({
    note: row.note,
    timestamp: row.timestamp
  }));
}

/**
 * Export data to JSON (for backup/migration)
 */
export function exportToJSON() {
  const signals = getSignals();
  const summary = getValidationSummary();

  const data = {
    exportDate: new Date().toISOString(),
    summary,
    signals
  };

  const filename = `validation-export-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(DB_DIR, filename),
    JSON.stringify(data, null, 2)
  );

  console.log(`✅ Data exported to: ${filename}`);
  return filename;
}

/**
 * Close database connection (for cleanup)
 */
export function closeDatabase() {
  db.close();
}

// Initialize on import
initializeDatabase();

export default db;
