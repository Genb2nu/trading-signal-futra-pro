#!/usr/bin/env node
/**
 * Signal Tracker CLI
 * Command-line tool to manage signal tracking
 */

import {
  trackNewSignal,
  updateSignalOutcome,
  getStats,
  getSignals,
  getPerformanceReport,
  exportToCSV,
  resetTracking
} from './src/services/signalTracker.js';

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  try {
    switch (command) {
      case 'stats':
        await showStats();
        break;

      case 'report':
        await showReport();
        break;

      case 'list':
        await listSignals();
        break;

      case 'add':
        await addSignalManually();
        break;

      case 'close':
        await closeSignal();
        break;

      case 'export':
        await exportData();
        break;

      case 'reset':
        await resetData();
        break;

      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function showStats() {
  const stats = await getStats();

  console.log('\n' + '='.repeat(70));
  console.log('  SIGNAL TRACKING STATISTICS');
  console.log('='.repeat(70));

  console.log(`\n📊 OVERVIEW:`);
  console.log(`   Total Signals: ${stats.totalSignals}`);
  console.log(`   Active: ${stats.activeSignals} | Closed: ${stats.closedSignals}`);

  console.log(`\n🎯 PERFORMANCE:`);
  console.log(`   Win Rate: ${stats.winRate}% (${stats.wins}W / ${stats.losses}L)`);
  console.log(`   Profit Factor: ${stats.profitFactor}`);
  console.log(`   Expectancy: ${stats.expectancy}R per trade`);
  console.log(`   Net Profit: ${stats.netProfitR}R`);

  console.log(`\n📈 COMPARISON TO BASELINE:`);
  const baselineWR = 78.1;
  const baselinePF = 7.96;
  const baselineExp = 1.05;

  const wrDiff = stats.winRate - baselineWR;
  const pfDiff = stats.profitFactor - baselinePF;
  const expDiff = stats.expectancy - baselineExp;

  console.log(`   Win Rate: ${wrDiff >= 0 ? '+' : ''}${wrDiff.toFixed(1)}% ${wrDiff >= 5 ? '🟢' : wrDiff >= 0 ? '🟡' : '🔴'}`);
  console.log(`   Profit Factor: ${pfDiff >= 0 ? '+' : ''}${pfDiff.toFixed(2)} ${pfDiff >= 1 ? '🟢' : pfDiff >= 0 ? '🟡' : '🔴'}`);
  console.log(`   Expectancy: ${expDiff >= 0 ? '+' : ''}${expDiff.toFixed(2)}R ${expDiff >= 0.2 ? '🟢' : expDiff >= 0 ? '🟡' : '🔴'}`);

  if (stats.closedSignals < 30) {
    console.log(`\n⚠️  NOTE: Only ${stats.closedSignals} closed signals. Recommend 30+ for statistical significance.`);
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

async function showReport() {
  const report = await getPerformanceReport();

  console.log('\n' + '='.repeat(70));
  console.log('  PERFORMANCE REPORT');
  console.log('='.repeat(70));

  console.log(`\n📅 TRACKING PERIOD:`);
  console.log(`   Start: ${new Date(report.summary.startDate).toLocaleString()}`);
  console.log(`   Version: ${report.summary.version}`);

  console.log(`\n📊 CURRENT PERFORMANCE:`);
  console.log(`   Win Rate: ${report.performance.winRate}`);
  console.log(`   Profit Factor: ${report.performance.profitFactor}`);
  console.log(`   Expectancy: ${report.performance.expectancy}`);
  console.log(`   Net Profit: ${report.performance.netProfit}`);

  console.log(`\n📈 VS BASELINE (MODERATE 15m - Pre-MTF):`);
  console.log(`   Baseline Win Rate: ${report.comparison.baseline.winRate}`);
  console.log(`   Current Win Rate: ${report.comparison.current.winRate}`);
  console.log(`   Improvement: ${report.comparison.improvement.winRate}`);

  if (report.signals.activeSignals.length > 0) {
    console.log(`\n🔄 ACTIVE SIGNALS (${report.signals.activeSignals.length}):`);
    report.signals.activeSignals.forEach(s => {
      console.log(`   ${s.id}: ${s.symbol} @ $${s.entry} (Confluence: ${s.confluenceScore})`);
    });
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

async function listSignals() {
  const status = args[0] || 'ALL';
  const filter = status === 'ALL' ? {} : { status: status.toUpperCase() };

  const signals = await getSignals(filter);

  console.log(`\n📋 SIGNALS (${status}):`);
  console.log('='.repeat(70));

  if (signals.length === 0) {
    console.log('No signals found.');
  } else {
    signals.forEach(s => {
      console.log(`\n${s.id}:`);
      console.log(`  Symbol: ${s.symbol} | Type: ${s.type} | Status: ${s.status}`);
      console.log(`  Entry: $${s.entry} | SL: $${s.stopLoss} | TP: $${s.takeProfit}`);
      console.log(`  Confluence: ${s.confluenceScore} | Confidence: ${s.confidence}`);
      if (s.outcome) {
        console.log(`  Outcome: ${s.outcome} | P/L: ${s.pnlR}R`);
      }
    });
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

async function addSignalManually() {
  console.log('\n⚠️  Manual signal entry not yet implemented.');
  console.log('Signals are automatically tracked from the server.');
  console.log('Use the /api/signals endpoint to add signals programmatically.\n');
}

async function closeSignal() {
  const signalId = args[0];
  const result = args[1]; // WIN, LOSS, BREAKEVEN
  const pnlR = parseFloat(args[2]);

  if (!signalId || !result || isNaN(pnlR)) {
    console.log('\nUsage: node signal-tracker-cli.js close <signalId> <WIN|LOSS|BREAKEVEN> <pnlR>');
    console.log('Example: node signal-tracker-cli.js close BTCUSDT_1234567890 WIN 2.5\n');
    return;
  }

  await updateSignalOutcome(signalId, {
    result: result.toUpperCase(),
    pnlR: pnlR,
    notes: 'Manually closed via CLI'
  });

  console.log(`\n✅ Signal ${signalId} closed as ${result} with ${pnlR}R\n`);
}

async function exportData() {
  const csvPath = await exportToCSV();
  console.log(`\n✅ Data exported to: ${csvPath}\n`);
}

async function resetData() {
  const confirmation = args[0];

  if (confirmation !== 'CONFIRM') {
    console.log('\n⚠️  WARNING: This will delete ALL tracking data!');
    console.log('To confirm, run: node signal-tracker-cli.js reset CONFIRM\n');
    return;
  }

  await resetTracking();
  console.log('\n✅ Tracking data reset!\n');
}

function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                   SIGNAL TRACKER CLI - HELP                        ║
╚════════════════════════════════════════════════════════════════════╝

COMMANDS:

  stats              Show current tracking statistics
  report             Show detailed performance report
  list [status]      List signals (ALL, ACTIVE, CLOSED)
  close <id> <result> <pnl>  Close a signal manually
  export             Export tracking data to CSV
  reset CONFIRM      Reset all tracking data (requires CONFIRM)
  help               Show this help message

EXAMPLES:

  # View statistics
  node signal-tracker-cli.js stats

  # Show performance report
  node signal-tracker-cli.js report

  # List all active signals
  node signal-tracker-cli.js list ACTIVE

  # Close a signal
  node signal-tracker-cli.js close BTCUSDT_1234567890 WIN 2.5

  # Export to CSV
  node signal-tracker-cli.js export

TRACKING SYSTEM:

  - Signals are automatically tracked when generated
  - Update outcomes manually or via API
  - Track win rate, profit factor, expectancy
  - Compare to baseline (78.1% WR, 7.96 PF, +1.05R)
  - Measure MTF enhancement effectiveness

BASELINE (Pre-MTF):
  - Win Rate: 78.1%
  - Profit Factor: 7.96
  - Expectancy: +1.05R

TARGET (Post-MTF):
  - Win Rate: 85-88% (+7-10%)
  - Profit Factor: 9.0-11.0
  - Expectancy: +1.25-1.40R

`);
}

main();
