/**
 * Comprehensive Backtest for Inducement Enhancement
 * Tests all timeframes and compares win rates
 * Uses 3000 candles per symbol for more reliable results
 */

import { backtestSymbol } from './src/services/backtestEngine.js';
import { setStrategyMode } from './src/shared/strategyConfig.js';
import fs from 'fs';

// Test symbols (representative sample)
const TEST_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'];

// All timeframes to test
const TIMEFRAMES = ['15m', '1h', '4h'];

// Strategy modes to test (all 6 modes)
const MODES = ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE', 'ELITE', 'SNIPER', 'ULTRA'];

/**
 * Save backtest results to JSON files
 */
function saveBacktestResults(mode, timeframe, results, combinedMetrics) {
  const timestamp = new Date().toISOString();
  const runId = `${timestamp.split('T')[0]}_${mode.toLowerCase()}_${timeframe}`;

  const backtestData = {
    id: runId,
    timestamp,
    mode,
    timeframe,
    symbols: TEST_SYMBOLS,
    results,
    combinedMetrics
  };

  // Save as latest
  fs.writeFileSync(
    './backtest-results/latest-backtest.json',
    JSON.stringify(backtestData, null, 2)
  );

  // Save to runs directory
  fs.writeFileSync(
    `./backtest-results/runs/${runId}.json`,
    JSON.stringify(backtestData, null, 2)
  );

  // Update index
  updateBacktestIndex(backtestData);

  console.log(`  💾 Saved backtest results to: runs/${runId}.json`);
}

/**
 * Update the backtest index file with metadata
 */
function updateBacktestIndex(backtestData) {
  const indexFile = './backtest-results/index.json';
  let index = { runs: [] };

  if (fs.existsSync(indexFile)) {
    index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  }

  index.runs.unshift({
    id: backtestData.id,
    timestamp: backtestData.timestamp,
    mode: backtestData.mode,
    timeframe: backtestData.timeframe,
    totalTrades: backtestData.combinedMetrics.totalTrades,
    winRate: backtestData.combinedMetrics.winRate,
    profitFactor: backtestData.combinedMetrics.profitFactor,
    file: `runs/${backtestData.id}.json`
  });

  // Keep last 50 runs
  index.runs = index.runs.slice(0, 50);
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
}

async function runComprehensiveBacktest() {
  console.log('🚀 Starting Comprehensive Inducement Backtest\n');
  console.log('='  .repeat(80));
  console.log('Testing Strategy: Enhanced Inducement Detection (5 types)');
  console.log('Test Symbols:', TEST_SYMBOLS.join(', '));
  console.log('Timeframes:', TIMEFRAMES.join(', '));
  console.log('Strategy Modes:', MODES.join(', '));
  console.log('='  .repeat(80));
  console.log('');

  const results = {};

  for (const mode of MODES) {
    console.log(`\n📊 TESTING ${mode} MODE`);
    console.log('-'.repeat(80));

    // Set the mode in config
    setStrategyMode(mode);

    results[mode] = {};

    for (const timeframe of TIMEFRAMES) {
      console.log(`\n⏰ Timeframe: ${timeframe}`);

      const timeframeResults = [];

      for (const symbol of TEST_SYMBOLS) {
        process.stdout.write(`  Testing ${symbol}... `);

        try {
          const result = await backtestSymbol(
            symbol,
            timeframe,
            3000,  // Extended historical data (3x more than before)
            100    // 100 candles lookforward
          );

          timeframeResults.push(result);

          const metrics = result.metrics || {};
          const totalTrades = metrics.totalTrades || result.trades?.length || 0;
          const winRate = totalTrades > 0
            ? ((metrics.wins || 0) / totalTrades * 100).toFixed(1)
            : '0.0';

          console.log(`✓ (${totalTrades} trades, ${winRate}% win rate)`);

        } catch (error) {
          console.log(`✗ Error: ${error.message}`);
        }
      }

      // Aggregate results for this timeframe
      const aggregate = aggregateResults(timeframeResults);
      results[mode][timeframe] = aggregate;

      console.log(`\n  📈 ${timeframe} Summary:`);
      console.log(`     Total Trades: ${aggregate.totalTrades}`);
      console.log(`     Win Rate: ${aggregate.winRate.toFixed(2)}%`);
      console.log(`     Avg Profit: ${aggregate.avgProfit.toFixed(2)}R`);
      console.log(`     Profit Factor: ${aggregate.profitFactor.toFixed(2)}`);
      console.log(`     Max Drawdown: ${aggregate.maxDrawdown.toFixed(2)}%`);

      // Save backtest results to file
      saveBacktestResults(mode, timeframe, timeframeResults, aggregate);
    }
  }

  // Print final summary
  printFinalSummary(results);
}

function aggregateResults(results) {
  const totals = {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalWinR: 0,
    totalLossR: 0,
    maxDrawdown: 0
  };

  results.forEach(r => {
    if (!r || !r.metrics) return;
    const m = r.metrics;
    totals.totalTrades += m.totalTrades || 0;
    totals.winningTrades += m.wins || 0;
    totals.losingTrades += m.losses || 0;
    totals.totalWinR += (m.wins || 0) * (m.avgWinR || 0);
    totals.totalLossR += (m.losses || 0) * Math.abs(m.avgLossR || 0);
    totals.maxDrawdown = Math.max(totals.maxDrawdown, Math.abs(m.maxDrawdown || 0));
  });

  const winRate = totals.totalTrades > 0
    ? (totals.winningTrades / totals.totalTrades) * 100
    : 0;

  const avgProfit = totals.totalTrades > 0
    ? (totals.totalWinR - totals.totalLossR) / totals.totalTrades
    : 0;

  const profitFactor = totals.totalLossR > 0
    ? totals.totalWinR / totals.totalLossR
    : totals.totalWinR > 0 ? 999 : 0;

  return {
    totalTrades: totals.totalTrades,
    winningTrades: totals.winningTrades,
    losingTrades: totals.losingTrades,
    winRate,
    avgProfit,
    profitFactor,
    maxDrawdown: totals.maxDrawdown
  };
}

function printFinalSummary(results) {
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('📊 FINAL BACKTEST SUMMARY - INDUCEMENT ENHANCEMENT');
  console.log('='.repeat(80));

  // Create a comparison table
  console.log('\n📈 WIN RATE COMPARISON BY MODE AND TIMEFRAME:\n');
  console.log('Mode         | 15m      | 1h       | 4h       | Average');
  console.log('-'.repeat(65));

  const modeAverages = {};

  for (const mode of MODES) {
    const tfResults = [];
    let row = `${mode.padEnd(12)} |`;

    for (const tf of TIMEFRAMES) {
      const wr = results[mode][tf]?.winRate || 0;
      tfResults.push(wr);
      row += ` ${wr.toFixed(1)}%`.padEnd(9) + '|';
    }

    const avgWR = tfResults.reduce((a, b) => a + b, 0) / tfResults.length;
    modeAverages[mode] = avgWR;
    row += ` ${avgWR.toFixed(1)}%`;

    console.log(row);
  }

  console.log('\n📊 PROFIT FACTOR BY MODE AND TIMEFRAME:\n');
  console.log('Mode         | 15m      | 1h       | 4h       | Average');
  console.log('-'.repeat(65));

  for (const mode of MODES) {
    const pfResults = [];
    let row = `${mode.padEnd(12)} |`;

    for (const tf of TIMEFRAMES) {
      const pf = results[mode][tf]?.profitFactor || 0;
      pfResults.push(pf);
      row += ` ${pf.toFixed(2)}`.padEnd(9) + '|';
    }

    const avgPF = pfResults.reduce((a, b) => a + b, 0) / pfResults.length;
    row += ` ${avgPF.toFixed(2)}`;

    console.log(row);
  }

  console.log('\n📊 TOTAL TRADES BY MODE AND TIMEFRAME:\n');
  console.log('Mode         | 15m      | 1h       | 4h       | Total');
  console.log('-'.repeat(65));

  for (const mode of MODES) {
    const trades = [];
    let row = `${mode.padEnd(12)} |`;

    for (const tf of TIMEFRAMES) {
      const t = results[mode][tf]?.totalTrades || 0;
      trades.push(t);
      row += ` ${t}`.padEnd(9) + '|';
    }

    const total = trades.reduce((a, b) => a + b, 0);
    row += ` ${total}`;

    console.log(row);
  }

  console.log('\n\n✅ KEY FINDINGS:\n');

  // Find best performing mode
  const bestMode = Object.keys(modeAverages).reduce((a, b) =>
    modeAverages[a] > modeAverages[b] ? a : b
  );

  console.log(`🏆 Best Performing Mode: ${bestMode} (${modeAverages[bestMode].toFixed(1)}% avg win rate)`);

  // Check if win rates meet targets
  console.log('\n📋 TARGET VALIDATION:');
  for (const mode of MODES) {
    const target = mode === 'CONSERVATIVE' ? 65 : mode === 'MODERATE' ? 55 : 45;
    const actual = modeAverages[mode];
    const status = actual >= target ? '✅' : '❌';
    console.log(`   ${status} ${mode}: ${actual.toFixed(1)}% (target: ${target}%)`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Backtest Complete!');
  console.log('='.repeat(80));
}

// Run the backtest
runComprehensiveBacktest().catch(error => {
  console.error('❌ Backtest failed:', error);
  process.exit(1);
});
