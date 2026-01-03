/**
 * Comprehensive Backtest - All Modes & All Timeframes
 * Tests: conservative, moderate, aggressive, elite, sniper, ultra
 * Timeframes: 15m, 1h, 4h, 1d
 */

import { backtestSymbol, calculateMetrics } from './src/services/backtestEngine.js';
import { setStrategyMode } from './src/shared/strategyConfig.js';
import fs from 'fs/promises';
import path from 'path';

const MODES = ['conservative', 'moderate', 'aggressive', 'elite', 'sniper', 'ultra'];
const TIMEFRAMES = ['15m', '1h', '4h', '1d'];
const SYMBOLS = ['BTCUSDT', 'ETHUSDT'];

async function runComprehensiveBacktest() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   COMPREHENSIVE BACKTEST - ALL MODES & TIMEFRAMES            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const allResults = [];
  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: MODES.length * TIMEFRAMES.length * SYMBOLS.length,
    modesTest: MODES,
    timeframesTested: TIMEFRAMES,
    symbolsTested: SYMBOLS,
    results: {}
  };

  let testNumber = 0;
  const totalTests = MODES.length * TIMEFRAMES.length * SYMBOLS.length;

  // Run backtest for each combination
  for (const mode of MODES) {
    summary.results[mode] = {};

    for (const timeframe of TIMEFRAMES) {
      summary.results[mode][timeframe] = {};

      for (const symbol of SYMBOLS) {
        testNumber++;
        console.log(`\n[${ testNumber}/${totalTests}] Testing: ${mode.toUpperCase()} | ${timeframe} | ${symbol}`);
        console.log('─'.repeat(70));

        try {
          // Set strategy mode
          setStrategyMode(mode.toUpperCase());

          // Run backtest
          const result = await backtestSymbol(symbol, timeframe, 1000, 100);

          // Extract metrics
          const metrics = result.metrics || {};
          const totalTrades = result.trades?.length || 0;
          const wins = result.trades?.filter(t => t.result === 'TAKE_PROFIT' || t.pnlR > 0) || [];
          const losses = result.trades?.filter(t => t.result === 'STOP_LOSS' || (t.pnlR < 0 && t.result !== 'TAKE_PROFIT')) || [];
          const totalPnL = result.trades?.reduce((sum, t) => sum + t.pnlR, 0) || 0;
          const winRate = totalTrades > 0 ? ((wins.length / totalTrades) * 100).toFixed(1) : 0;

          //Store results
          summary.results[mode][timeframe][symbol] = {
            winRate: parseFloat(winRate),
            totalTrades,
            winners: wins.length,
            losers: losses.length,
            totalPnL,
            avgWin: metrics.avgWinR || 0,
            avgLoss: metrics.avgLossR || 0,
            profitFactor: metrics.profitFactor || 0,
            maxDrawdown: metrics.maxDrawdown || 0,
            sharpeRatio: metrics.sharpeRatio || 0
          };

          allResults.push({
            mode,
            timeframe,
            symbol,
            totalTrades,
            winRate: parseFloat(winRate),
            winners: wins.length,
            losers: losses.length,
            totalPnL,
            profitFactor: metrics.profitFactor || 0,
            ...metrics
          });

          console.log(`✅ Win Rate: ${winRate}% | Trades: ${totalTrades} | P&L: ${totalPnL.toFixed(2)}R`);
        } catch (error) {
          console.error(`❌ Error testing ${mode}-${timeframe}-${symbol}:`, error.message);
          summary.results[mode][timeframe][symbol] = { error: error.message };
        }
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

  console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    BACKTEST COMPLETE                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log(`📊 Total Tests: ${totalTests}`);
  console.log(`✅ Successful: ${allResults.length}`);
  console.log(`❌ Failed: ${totalTests - allResults.length}\n`);

  // Save results
  const resultsDir = './backtest-results';
  await fs.mkdir(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Save full results
  const fullResultsPath = path.join(resultsDir, `comprehensive-backtest-${timestamp}.json`);
  await fs.writeFile(fullResultsPath, JSON.stringify({
    summary,
    allResults,
    duration: `${duration} minutes`
  }, null, 2));

  // Save summary only
  const summaryPath = path.join(resultsDir, 'latest-summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  // Generate readable text report
  const reportPath = path.join(resultsDir, 'latest-backtest-report.txt');
  await generateTextReport(summary, allResults, duration, reportPath);

  console.log(`\n📁 Results saved:`);
  console.log(`   - Full Results: ${fullResultsPath}`);
  console.log(`   - Summary: ${summaryPath}`);
  console.log(`   - Report: ${reportPath}\n`);

  // Print best performers
  printBestPerformers(allResults);

  return { summary, allResults };
}

async function generateTextReport(summary, allResults, duration, filepath) {
  let report = '';

  report += '═══════════════════════════════════════════════════════════════\n';
  report += '         COMPREHENSIVE BACKTEST RESULTS REPORT\n';
  report += '═══════════════════════════════════════════════════════════════\n\n';
  report += `Generated: ${new Date().toLocaleString()}\n`;
  report += `Duration: ${duration} minutes\n`;
  report += `Total Tests: ${summary.totalTests}\n\n`;

  // Results by mode and timeframe
  for (const mode of MODES) {
    report += `\n${'═'.repeat(70)}\n`;
    report += `MODE: ${mode.toUpperCase()}\n`;
    report += `${'═'.repeat(70)}\n\n`;

    for (const timeframe of TIMEFRAMES) {
      report += `  ${timeframe} Timeframe:\n`;
      report += `  ${'─'.repeat(66)}\n`;

      for (const symbol of SYMBOLS) {
        const data = summary.results[mode]?.[timeframe]?.[symbol];
        if (data && !data.error) {
          let pf = data.profitFactor;
          if (typeof pf !== 'number' || !isFinite(pf)) {
            pf = 0;
          }
          report += `    ${symbol.padEnd(10)} | `;
          report += `Win Rate: ${String(data.winRate || 0).padStart(5)}% | `;
          report += `Trades: ${String(data.totalTrades || 0).padStart(3)} | `;
          report += `P&L: ${(data.totalPnL || 0) >= 0 ? '+' : ''}${(data.totalPnL || 0).toFixed(2).padStart(8)}R | `;
          report += `PF: ${pf.toFixed(2)}\n`;
        } else if (data?.error) {
          report += `    ${symbol.padEnd(10)} | ERROR: ${data.error}\n`;
        }
      }
      report += '\n';
    }
  }

  // Best Performers
  report += `\n${'═'.repeat(70)}\n`;
  report += 'TOP PERFORMERS\n';
  report += `${'═'.repeat(70)}\n\n`;

  const sorted = [...allResults]
    .filter(r => r.totalTrades >= 5)
    .sort((a, b) => b.totalPnL - a.totalPnL)
    .slice(0, 10);

  sorted.forEach((r, i) => {
    report += `${i + 1}. ${r.mode.toUpperCase().padEnd(12)} | ${r.timeframe.padEnd(4)} | ${r.symbol.padEnd(10)} | `;
    report += `WR: ${String(r.winRate).padStart(5)}% | `;
    report += `P&L: ${r.totalPnL >= 0 ? '+' : ''}${r.totalPnL.toFixed(2).padStart(8)}R | `;
    report += `Trades: ${r.totalTrades}\n`;
  });

  await fs.writeFile(filepath, report, 'utf-8');
}

function printBestPerformers(allResults) {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    TOP 10 PERFORMERS                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const sorted = [...allResults]
    .filter(r => r.totalTrades >= 5)
    .sort((a, b) => b.totalPnL - a.totalPnL)
    .slice(0, 10);

  sorted.forEach((r, i) => {
    let pf = r.profitFactor;
    if (typeof pf !== 'number' || !isFinite(pf)) {
      pf = 0;
    }
    console.log(`${String(i + 1).padStart(2)}. ${r.mode.toUpperCase().padEnd(12)} | ${r.timeframe.padEnd(4)} | ${r.symbol.padEnd(10)}`);
    console.log(`    Win Rate: ${r.winRate}% | P&L: ${r.totalPnL >= 0 ? '+' : ''}${r.totalPnL.toFixed(2)}R | Trades: ${r.totalTrades} | PF: ${pf.toFixed(2)}`);
  });

  console.log('');
}

// Run the backtest
runComprehensiveBacktest().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
