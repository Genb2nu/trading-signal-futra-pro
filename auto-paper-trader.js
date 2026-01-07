/**
 * Automatic Paper Trading System
 * Automatically tracks signals when they reach ENTRY_READY state
 */

import axios from 'axios';
import { updateSignalTracking, getLoggedSignals, addSignalNote } from './src/services/validationLogger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRACKED_SIGNALS_FILE = path.join(__dirname, 'auto-tracked-signals.json');
const CHECK_INTERVAL = 60000; // Check every 1 minute
const SCAN_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT',
  'LINKUSDT', 'ATOMUSDT', 'NEARUSDT', 'UNIUSDT', 'LTCUSDT'
];
const SCAN_TIMEFRAMES = ['15m', '1h', '4h'];

// Track which signals we've already auto-tracked
let autoTrackedSignals = new Set();

// Load previously tracked signals
function loadTrackedSignals() {
  try {
    if (fs.existsSync(TRACKED_SIGNALS_FILE)) {
      const data = JSON.parse(fs.readFileSync(TRACKED_SIGNALS_FILE, 'utf8'));
      autoTrackedSignals = new Set(data.tracked || []);
      console.log(`📋 Loaded ${autoTrackedSignals.size} previously tracked signal(s)`);
    }
  } catch (error) {
    console.error('Error loading tracked signals:', error.message);
  }
}

// Save tracked signals
function saveTrackedSignals() {
  try {
    fs.writeFileSync(TRACKED_SIGNALS_FILE, JSON.stringify({
      tracked: Array.from(autoTrackedSignals),
      lastUpdate: new Date().toISOString()
    }, null, 2));
  } catch (error) {
    console.error('Error saving tracked signals:', error.message);
  }
}

// Scan symbols for ENTRY_READY signals
async function scanForReadySignals() {
  const readySignals = [];

  for (const timeframe of SCAN_TIMEFRAMES) {
    try {
      const response = await axios.post('http://localhost:3000/api/scan', {
        symbols: SCAN_SYMBOLS,
        timeframe,
        strategy: 'moderate'
      });

      if (response.data.success && response.data.signals) {
        // Filter for ENTRY_READY signals only
        const ready = response.data.signals.filter(sig => {
          // Check from validation logs for accurate state
          const loggedSignals = getLoggedSignals({
            symbol: sig.symbol,
            entryState: 'ENTRY_READY'
          });
          return loggedSignals.length > 0;
        });

        readySignals.push(...ready);
      }

      // Small delay between scans
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error scanning ${timeframe}:`, error.message);
    }
  }

  return readySignals;
}

// Auto-track a signal
function autoTrackSignal(signal) {
  const signalKey = `${signal.symbol}_${signal.direction}_${signal.timeframe}`;

  if (autoTrackedSignals.has(signalKey)) {
    return false; // Already tracked
  }

  // Mark as tracked in validation system
  const loggedSignals = getLoggedSignals({ symbol: signal.symbol });
  const matchingSignal = loggedSignals.find(s =>
    s.signal.direction === signal.direction &&
    s.timeframe === signal.timeframe &&
    s.signal.entryState === 'ENTRY_READY'
  );

  if (matchingSignal) {
    updateSignalTracking(matchingSignal.id, true);
    addSignalNote(matchingSignal.id, 'Auto-tracked by paper trading system');

    autoTrackedSignals.add(signalKey);
    saveTrackedSignals();

    console.log(`\n✅ AUTO-TRACKED: ${signal.symbol} ${signal.direction.toUpperCase()} [${signal.timeframe}]`);
    console.log(`   Entry: $${signal.entry}`);
    console.log(`   SL: $${signal.stopLoss} | TP: $${signal.takeProfit}`);
    console.log(`   R:R: ${signal.riskReward} | Confluence: ${signal.confidence}`);

    return true;
  }

  return false;
}

// Main monitoring loop
async function monitorAndTrack() {
  console.log('\n🔍 Checking for ENTRY_READY signals...');

  const readySignals = await scanForReadySignals();

  if (readySignals.length > 0) {
    console.log(`\n🎯 Found ${readySignals.length} ENTRY_READY signal(s)!`);

    let newlyTracked = 0;
    for (const signal of readySignals) {
      if (autoTrackSignal(signal)) {
        newlyTracked++;
      }
    }

    if (newlyTracked > 0) {
      console.log(`\n📊 ${newlyTracked} new signal(s) auto-tracked!`);
      console.log(`💡 View tracked signals: node view-tracked-signals.js`);
    } else {
      console.log(`\nℹ️  All ENTRY_READY signals already tracked.`);
    }
  } else {
    console.log(`   No ENTRY_READY signals found yet.`);
  }

  // Show current tracked count
  console.log(`\n📈 Total auto-tracked signals: ${autoTrackedSignals.size}`);
  console.log(`⏰ Next check in ${CHECK_INTERVAL / 1000} seconds...`);
}

// Start the auto-trader
async function startAutoTrader() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  AUTOMATIC PAPER TRADING SYSTEM                          ║');
  console.log('║  Auto-tracks signals when they reach ENTRY_READY         ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('⚙️  Configuration:');
  console.log(`   Symbols: ${SCAN_SYMBOLS.join(', ')}`);
  console.log(`   Timeframes: ${SCAN_TIMEFRAMES.join(', ')}`);
  console.log(`   Check interval: ${CHECK_INTERVAL / 1000} seconds`);
  console.log('');

  loadTrackedSignals();

  console.log('🚀 Auto-trader started! Press Ctrl+C to stop.\n');
  console.log('═'.repeat(60));

  // Initial check
  await monitorAndTrack();

  // Set up interval
  setInterval(async () => {
    console.log('\n' + '═'.repeat(60));
    await monitorAndTrack();
  }, CHECK_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping auto-trader...');
  saveTrackedSignals();
  console.log('✅ Tracked signals saved.');
  console.log('👋 Auto-trader stopped.\n');
  process.exit(0);
});

// Start the system
startAutoTrader().catch(error => {
  console.error('❌ Auto-trader error:', error);
  process.exit(1);
});
