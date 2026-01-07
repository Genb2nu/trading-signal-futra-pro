/**
 * Live Trading Validation Data Viewer
 * CLI tool to view and analyze validation data collected during Option A
 */

import {
  getLoggedSignals,
  getSignalTransitions,
  getDailyMetrics,
  getValidationSummary
} from './src/services/validationLogger.js';

const args = process.argv.slice(2);
const command = args[0] || 'summary';

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  LIVE TRADING VALIDATION DATA VIEWER                     ║');
console.log('║  Option A: Monitoring System Performance                 ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

switch (command) {
  case 'summary':
    showSummary();
    break;

  case 'signals':
    showSignals(args[1], args[2]);
    break;

  case 'ready':
    showReadySignals();
    break;

  case 'tracked':
    showTrackedSignals();
    break;

  case 'outcomes':
    showOutcomes();
    break;

  case 'transitions':
    showTransitions(args[1]);
    break;

  case 'metrics':
    showDailyMetrics(args[1], args[2]);
    break;

  case 'help':
    showHelp();
    break;

  default:
    console.log(`❌ Unknown command: ${command}`);
    showHelp();
}

/**
 * Show validation summary statistics
 */
function showSummary() {
  const summary = getValidationSummary();

  if (!summary) {
    console.log('❌ No validation data available yet.\n');
    return;
  }

  console.log('📊 VALIDATION SUMMARY');
  console.log('═'.repeat(60));

  // Data collection period
  if (summary.dataCollectionPeriod.start) {
    const start = new Date(summary.dataCollectionPeriod.start).toLocaleString();
    const end = new Date(summary.dataCollectionPeriod.end).toLocaleString();
    console.log(`\n📅 Data Collection Period:`);
    console.log(`   Start: ${start}`);
    console.log(`   End:   ${end}`);
  }

  // Signal counts
  console.log(`\n🔔 Total Signals Detected: ${summary.totalSignals}`);
  console.log('\n📊 Signals by Entry State:');
  console.log(`   MONITORING:  ${summary.byState.MONITORING.toString().padStart(3)} (waiting for BOS/CHoCH)`);
  console.log(`   WAITING:     ${summary.byState.WAITING.toString().padStart(3)} (waiting for rejection)`);
  console.log(`   ENTRY_READY: ${summary.byState.ENTRY_READY.toString().padStart(3)} (all confirmations met)`);

  // Signal distribution
  console.log(`\n📈 Signal Direction:`);
  console.log(`   Bullish: ${summary.byDirection.bullish}`);
  console.log(`   Bearish: ${summary.byDirection.bearish}`);

  console.log(`\n🎯 Signals by Mode:`);
  Object.entries(summary.byMode).forEach(([mode, count]) => {
    console.log(`   ${mode}: ${count}`);
  });

  // Tracking statistics
  console.log(`\n✅ Tracking Statistics:`);
  console.log(`   Signals Tracked: ${summary.tracking.tracked} (${((summary.tracking.tracked / summary.totalSignals) * 100).toFixed(1)}%)`);
  console.log(`   With Outcomes:   ${summary.tracking.trackedWithOutcome}`);

  if (summary.tracking.trackedWithOutcome > 0) {
    console.log(`\n🎯 Win/Loss Record:`);
    console.log(`   Wins:      ${summary.tracking.wins} (${((summary.tracking.wins / summary.tracking.trackedWithOutcome) * 100).toFixed(1)}%)`);
    console.log(`   Losses:    ${summary.tracking.losses} (${((summary.tracking.losses / summary.tracking.trackedWithOutcome) * 100).toFixed(1)}%)`);
    console.log(`   Breakeven: ${summary.tracking.breakeven} (${((summary.tracking.breakeven / summary.tracking.trackedWithOutcome) * 100).toFixed(1)}%)`);
    console.log(`   Win Rate:  ${summary.tracking.winRate}%`);

    const expectedWinRate = 60;
    const diff = parseFloat(summary.tracking.winRate) - expectedWinRate;
    console.log(`\n   Expected Win Rate: ${expectedWinRate}% (ICT methodology)`);
    console.log(`   Difference: ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%`);

    if (diff >= 0) {
      console.log(`   ✅ System meeting or exceeding expected performance!`);
    } else {
      console.log(`   ⚠️  Below expected - needs more data or optimization`);
    }
  }

  // Timing statistics
  if (summary.timing.avgTimeToReady > 0) {
    console.log(`\n⏱️  Timing Statistics:`);
    console.log(`   Avg Time to ENTRY_READY: ${summary.timing.avgTimeToReady} minutes`);
    console.log(`   Total State Transitions: ${summary.timing.totalTransitions}`);
  }

  // Pattern effectiveness
  console.log(`\n🔍 Pattern Detection:`);
  console.log(`   Order Blocks:     ${summary.patterns.orderBlock}`);
  console.log(`   Fair Value Gaps:  ${summary.patterns.fvg}`);
  console.log(`   BOS:              ${summary.patterns.bos}`);
  console.log(`   CHoCH:            ${summary.patterns.choch}`);
  console.log(`   Liquidity Sweeps: ${summary.patterns.liquiditySweep}`);
  console.log(`   Rejection:        ${summary.patterns.rejection}`);

  console.log('\n' + '═'.repeat(60));
  console.log('Run "node view-validation-data.js help" for more options\n');
}

/**
 * Show all signals with optional filters
 */
function showSignals(symbol, mode) {
  const filters = {};
  if (symbol) filters.symbol = symbol;
  if (mode) filters.mode = mode;

  const signals = getLoggedSignals(filters);

  console.log(`📋 SIGNALS LOG ${symbol ? `(${symbol})` : ''} ${mode ? `[${mode} mode]` : ''}`);
  console.log('═'.repeat(100));

  if (signals.length === 0) {
    console.log('\nNo signals found with current filters.\n');
    return;
  }

  signals.forEach((sig, i) => {
    const time = new Date(sig.timestamp).toLocaleString();
    const state = sig.signal.entryState.padEnd(12);
    const dir = sig.signal.direction.toUpperCase().padEnd(8);
    const rr = sig.signal.riskReward?.toFixed(2) || 'N/A';
    const conf = sig.signal.confluenceScore.toString().padStart(3);

    console.log(`\n${i + 1}. [${time}] ${sig.symbol} ${dir} ${state}`);
    console.log(`   Entry: $${sig.signal.entry.toFixed(4)} | R:R: ${rr} | Confluence: ${conf}`);
    console.log(`   Patterns: OB:${sig.signal.patterns.hasOrderBlock ? '✓' : '✗'} FVG:${sig.signal.patterns.hasFVG ? '✓' : '✗'} BOS:${sig.signal.patterns.hasBOS ? '✓' : '✗'} CHoCH:${sig.signal.patterns.hasCHOCH ? '✓' : '✗'} Liq:${sig.signal.patterns.hasLiquiditySweep ? '✓' : '✗'} Rej:${sig.signal.patterns.hasRejection ? '✓' : '✗'}`);

    if (sig.tracked) {
      console.log(`   ✅ TRACKED at ${new Date(sig.trackedAt).toLocaleString()}`);
      if (sig.outcome) {
        const outcome = sig.outcome.result.toUpperCase();
        const emoji = outcome === 'WIN' ? '🎯' : outcome === 'LOSS' ? '❌' : '⚖️';
        console.log(`   ${emoji} OUTCOME: ${outcome} | Exit: $${sig.outcome.exitPrice} | R:R: ${sig.outcome.riskRewardAchieved}`);
      }
    }

    if (sig.notes.length > 0) {
      console.log(`   📝 Notes:`);
      sig.notes.forEach(note => {
        console.log(`      - ${note.text}`);
      });
    }
  });

  console.log('\n' + '═'.repeat(100) + '\n');
}

/**
 * Show only ENTRY_READY signals
 */
function showReadySignals() {
  const signals = getLoggedSignals({ entryState: 'ENTRY_READY' });

  console.log('🟢 ENTRY_READY SIGNALS (Fully Confirmed Setups)');
  console.log('═'.repeat(80));

  if (signals.length === 0) {
    console.log('\nNo ENTRY_READY signals yet. System is waiting for full SMC confirmation.\n');
    return;
  }

  signals.forEach((sig, i) => {
    const time = new Date(sig.timestamp).toLocaleString();
    console.log(`\n${i + 1}. ${sig.symbol} ${sig.signal.direction.toUpperCase()} [${sig.mode} mode]`);
    console.log(`   Time: ${time}`);
    console.log(`   Entry: $${sig.signal.entry.toFixed(4)} | SL: $${sig.signal.stopLoss.toFixed(4)} | TP: $${sig.signal.takeProfit.toFixed(4)}`);
    console.log(`   R:R: ${sig.signal.riskReward.toFixed(2)} | Confluence: ${sig.signal.confluenceScore}`);
    console.log(`   Confirmations: BOS:${sig.signal.patterns.hasBOS ? '✓' : '✗'} CHoCH:${sig.signal.patterns.hasCHOCH ? '✓' : '✗'} Rejection:${sig.signal.patterns.hasRejection ? '✓' : '✗'}`);
    console.log(`   Tracked: ${sig.tracked ? '✅ YES' : '⏳ NOT YET'}`);
  });

  console.log('\n' + '═'.repeat(80) + '\n');
}

/**
 * Show tracked signals
 */
function showTrackedSignals() {
  const signals = getLoggedSignals({ tracked: true });

  console.log('✅ TRACKED SIGNALS');
  console.log('═'.repeat(80));

  if (signals.length === 0) {
    console.log('\nNo signals tracked yet.\n');
    return;
  }

  signals.forEach((sig, i) => {
    const time = new Date(sig.timestamp).toLocaleString();
    const trackedTime = new Date(sig.trackedAt).toLocaleString();

    console.log(`\n${i + 1}. ${sig.symbol} ${sig.signal.direction.toUpperCase()}`);
    console.log(`   Detected: ${time}`);
    console.log(`   Tracked:  ${trackedTime}`);
    console.log(`   Entry: $${sig.signal.entry.toFixed(4)} | R:R: ${sig.signal.riskReward.toFixed(2)}`);

    if (sig.outcome) {
      const outcome = sig.outcome.result.toUpperCase();
      const emoji = outcome === 'WIN' ? '🎯' : outcome === 'LOSS' ? '❌' : '⚖️';
      console.log(`   ${emoji} OUTCOME: ${outcome}`);
      console.log(`   Exit Price: $${sig.outcome.exitPrice}`);
      console.log(`   R:R Achieved: ${sig.outcome.riskRewardAchieved}`);
      if (sig.outcome.profitLoss !== undefined) {
        console.log(`   P/L: ${sig.outcome.profitLoss > 0 ? '+' : ''}${sig.outcome.profitLoss.toFixed(2)}%`);
      }
      if (sig.outcome.notes) {
        console.log(`   Notes: ${sig.outcome.notes}`);
      }
    } else {
      console.log(`   ⏳ OPEN - waiting for outcome`);
    }
  });

  console.log('\n' + '═'.repeat(80) + '\n');
}

/**
 * Show win/loss outcomes analysis
 */
function showOutcomes() {
  const trackedSignals = getLoggedSignals({ tracked: true });
  const withOutcome = trackedSignals.filter(s => s.outcome !== null);

  console.log('🎯 OUTCOMES ANALYSIS');
  console.log('═'.repeat(80));

  if (withOutcome.length === 0) {
    console.log('\nNo completed trades with outcomes yet.\n');
    return;
  }

  const wins = withOutcome.filter(s => s.outcome.result === 'win');
  const losses = withOutcome.filter(s => s.outcome.result === 'loss');
  const breakeven = withOutcome.filter(s => s.outcome.result === 'breakeven');

  console.log(`\n📊 Overall Statistics:`);
  console.log(`   Total Completed: ${withOutcome.length}`);
  console.log(`   Wins:      ${wins.length} (${((wins.length / withOutcome.length) * 100).toFixed(1)}%)`);
  console.log(`   Losses:    ${losses.length} (${((losses.length / withOutcome.length) * 100).toFixed(1)}%)`);
  console.log(`   Breakeven: ${breakeven.length} (${((breakeven.length / withOutcome.length) * 100).toFixed(1)}%)`);

  // Breakdown by mode
  const modes = [...new Set(withOutcome.map(s => s.mode))];
  console.log(`\n📈 Win Rate by Mode:`);
  modes.forEach(mode => {
    const modeSignals = withOutcome.filter(s => s.mode === mode);
    const modeWins = modeSignals.filter(s => s.outcome.result === 'win');
    const winRate = (modeWins.length / modeSignals.length) * 100;
    console.log(`   ${mode}: ${winRate.toFixed(1)}% (${modeWins.length}/${modeSignals.length})`);
  });

  // Breakdown by pattern
  console.log(`\n🔍 Win Rate by Pattern:`);
  console.log(`   With BOS:       ${calcWinRate(withOutcome.filter(s => s.signal.patterns.hasBOS))}%`);
  console.log(`   With CHoCH:     ${calcWinRate(withOutcome.filter(s => s.signal.patterns.hasCHOCH))}%`);
  console.log(`   With FVG:       ${calcWinRate(withOutcome.filter(s => s.signal.patterns.hasFVG))}%`);
  console.log(`   With Liquidity: ${calcWinRate(withOutcome.filter(s => s.signal.patterns.hasLiquiditySweep))}%`);
  console.log(`   With Rejection: ${calcWinRate(withOutcome.filter(s => s.signal.patterns.hasRejection))}%`);

  // Average R:R achieved
  const avgRR = withOutcome.reduce((sum, s) => sum + parseFloat(s.outcome.riskRewardAchieved || 0), 0) / withOutcome.length;
  console.log(`\n💰 Average R:R Achieved: ${avgRR.toFixed(2)}`);

  console.log('\n' + '═'.repeat(80) + '\n');
}

/**
 * Show state transitions for a signal
 */
function showTransitions(signalId) {
  if (!signalId) {
    console.log('❌ Please provide signal ID: node view-validation-data.js transitions <signal-id>\n');
    return;
  }

  const transitions = getSignalTransitions(signalId);

  console.log(`🔄 STATE TRANSITIONS FOR ${signalId}`);
  console.log('═'.repeat(80));

  if (transitions.length === 0) {
    console.log('\nNo transitions found for this signal.\n');
    return;
  }

  transitions.forEach((trans, i) => {
    const time = new Date(trans.timestamp).toLocaleString();
    console.log(`\n${i + 1}. ${time}`);
    console.log(`   ${trans.fromState} → ${trans.toState}`);
    if (trans.timeSinceCreation) {
      console.log(`   Time since creation: ${trans.timeSinceCreation} minutes`);
    }
    if (trans.context && Object.keys(trans.context).length > 0) {
      console.log(`   Context: ${JSON.stringify(trans.context, null, 2)}`);
    }
  });

  console.log('\n' + '═'.repeat(80) + '\n');
}

/**
 * Show daily metrics
 */
function showDailyMetrics(startDate, endDate) {
  const metrics = getDailyMetrics(startDate, endDate);

  console.log('📅 DAILY METRICS');
  console.log('═'.repeat(80));

  if (metrics.length === 0) {
    console.log('\nNo daily metrics logged yet.\n');
    return;
  }

  metrics.forEach(m => {
    console.log(`\n${m.date}:`);
    console.log(JSON.stringify(m, null, 2));
  });

  console.log('\n' + '═'.repeat(80) + '\n');
}

/**
 * Show help
 */
function showHelp() {
  console.log('📖 VALIDATION DATA VIEWER - COMMANDS\n');
  console.log('Usage: node view-validation-data.js <command> [options]\n');
  console.log('Commands:');
  console.log('  summary              Show validation summary statistics (default)');
  console.log('  signals [symbol] [mode]  Show all signals (optionally filtered)');
  console.log('  ready                Show only ENTRY_READY signals');
  console.log('  tracked              Show tracked signals');
  console.log('  outcomes             Show win/loss analysis');
  console.log('  transitions <id>     Show state transitions for a signal');
  console.log('  metrics [start] [end]   Show daily metrics (optional date range)');
  console.log('  help                 Show this help message\n');
  console.log('Examples:');
  console.log('  node view-validation-data.js summary');
  console.log('  node view-validation-data.js signals BTCUSDT');
  console.log('  node view-validation-data.js signals SOLUSDT MODERATE');
  console.log('  node view-validation-data.js ready');
  console.log('  node view-validation-data.js outcomes\n');
}

/**
 * Helper: Calculate win rate
 */
function calcWinRate(signals) {
  if (signals.length === 0) return 'N/A';
  const wins = signals.filter(s => s.outcome?.result === 'win').length;
  return ((wins / signals.length) * 100).toFixed(1);
}
