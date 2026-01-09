/**
 * Run comprehensive backtest and save results for the Backtest Results tab
 */

import { backtestSymbol } from './src/services/backtestEngine.js';
import { setStrategyMode, STRATEGY_MODES } from './src/shared/strategyConfig.js';
import fs from 'fs';
import path from 'path';

// Test configuration
// PRIORITY 4: Symbol filtering - Keep only top 4 performers
// SOL (83.3% WR), ETH (73.5% WR), ADA (59.3% WR), BTC (53.3% WR)
// Removed: DOGE (23.8%), DOT (28.9%), AVAX (31.4%), MATIC (33.3%), BNB (35.3%), XRP (41.7%)
const SYMBOLS = ['SOLUSDT', 'ETHUSDT', 'ADAUSDT', 'BTCUSDT'];
const TIMEFRAMES = ['15m', '1h', '4h'];
const MODES = ['conservative', 'moderate', 'aggressive', 'scalping', 'elite', 'sniper', 'ultra'];
const CANDLE_COUNT = 1000; // Binance API limit
const LOOKFORWARD = 150; // Increased from 100 to reduce expirations

async function runBacktestAndSave() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  RUNNING COMPREHENSIVE BACKTEST');
  console.log('  Results will be saved to Backtest Results tab');
  console.log('═══════════════════════════════════════════════════\n');

  const startTime = new Date();
  const runId = `backtest-${startTime.toISOString().replace(/[:.]/g, '-')}`;

  const allModeResults = {};
  let totalTests = MODES.length * TIMEFRAMES.length * SYMBOLS.length;
  let completedTests = 0;

  // Run backtests for all modes
  for (const mode of MODES) {
    console.log(`\n📊 Testing ${mode.toUpperCase()} mode...`);
    setStrategyMode(mode);

    const modeResults = {};

    for (const timeframe of TIMEFRAMES) {
      // Skip 4h for scalping mode
      if (mode === 'scalping' && timeframe === '4h') {
        totalTests--;
        continue;
      }

      // ELITE mode only tests 15m (focused optimization)
      if (mode === 'elite' && timeframe !== '15m') {
        totalTests--;
        continue;
      }

      // SNIPER mode only tests 1h (optimal timeframe for 80%+ WR)
      if (mode === 'sniper' && timeframe !== '1h') {
        totalTests--;
        continue;
      }

      // ULTRA mode only tests 1h (proven optimal timeframe)
      if (mode === 'ultra' && timeframe !== '1h') {
        totalTests--;
        continue;
      }

      const timeframeResults = {};

      for (const symbol of SYMBOLS) {
        try {
          const result = await backtestSymbol(symbol, timeframe, CANDLE_COUNT, LOOKFORWARD);

          const wins = result.trades.filter(t =>
            t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP_WIN' || t.result === 'BREAKEVEN'
          ).length;
          const losses = result.trades.filter(t => t.result === 'STOP_LOSS').length;
          const totalTrades = result.trades.length;
          const winRate = totalTrades > 0 ? (wins / totalTrades * 100) : 0;

          // Calculate profit factor
          const grossProfit = result.trades
            .filter(t => t.pnlR > 0)
            .reduce((sum, t) => sum + t.pnlR, 0);
          const grossLoss = Math.abs(result.trades
            .filter(t => t.pnlR < 0)
            .reduce((sum, t) => sum + t.pnlR, 0));
          const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);

          // Calculate average R
          const avgR = totalTrades > 0
            ? (result.trades.reduce((sum, t) => sum + t.pnlR, 0) / totalTrades)
            : 0;

          // Calculate total PnL in R
          const totalPnlR = result.trades.reduce((sum, t) => sum + t.pnlR, 0);

          timeframeResults[symbol] = {
            totalTrades,
            wins,
            losses,
            winRate: parseFloat(winRate.toFixed(2)),
            profitFactor: parseFloat(profitFactor.toFixed(2)),
            avgR: parseFloat(avgR.toFixed(2)),
            totalPnlR: parseFloat(totalPnlR.toFixed(2)),
            trades: result.trades // Include all trade details
          };

          completedTests++;
          const progress = ((completedTests / totalTests) * 100).toFixed(1);
          console.log(`  [${progress}%] ${symbol} ${timeframe}: ${totalTrades} trades, ${winRate.toFixed(1)}% WR, ${profitFactor.toFixed(2)} PF`);

        } catch (error) {
          console.error(`  ❌ Error: ${symbol} ${timeframe} - ${error.message}`);
          timeframeResults[symbol] = {
            error: error.message,
            totalTrades: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            profitFactor: 0,
            avgR: 0,
            totalPnlR: 0,
            trades: []
          };
          completedTests++;
        }
      }

      modeResults[timeframe] = timeframeResults;
    }

    allModeResults[mode] = modeResults;
  }

  const endTime = new Date();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  // Prepare final results object
  const backtestResults = {
    metadata: {
      runId,
      timestamp: startTime.toISOString(),
      duration: `${duration}s`,
      description: 'Comprehensive backtest with tuned SMC strategy',
      version: '2.0 - Tuned',
      improvements: [
        'Fixed FVG detection (lowered gap sizes)',
        'Improved entry pricing (OB middle)',
        'Relaxed confluence thresholds',
        'Fixed trailing stop classification',
        'Removed hard requirements',
        'Added trade management (breakeven, partial profits, trailing)',
        'Relaxed HTF trend filter',
        'Improved market structure detection'
      ]
    },
    configuration: {
      symbols: SYMBOLS,
      timeframes: TIMEFRAMES,
      modes: MODES,
      candleCount: CANDLE_COUNT,
      lookforward: LOOKFORWARD
    },
    results: allModeResults
  };

  // Calculate summary statistics
  const summary = {};
  for (const mode of MODES) {
    const modeData = allModeResults[mode];
    let totalTrades = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let totalPnlR = 0;
    let allTrades = [];

    for (const timeframe of Object.keys(modeData)) {
      for (const symbol of Object.keys(modeData[timeframe])) {
        const symbolData = modeData[timeframe][symbol];
        totalTrades += symbolData.totalTrades;
        totalWins += symbolData.wins;
        totalLosses += symbolData.losses;
        totalPnlR += symbolData.totalPnlR;
        allTrades = allTrades.concat(symbolData.trades || []);
      }
    }

    const winRate = totalTrades > 0 ? (totalWins / totalTrades * 100) : 0;
    const grossProfit = allTrades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
    const grossLoss = Math.abs(allTrades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);

    summary[mode] = {
      totalTrades,
      wins: totalWins,
      losses: totalLosses,
      winRate: parseFloat(winRate.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      totalPnlR: parseFloat(totalPnlR.toFixed(2)),
      avgRPerTrade: totalTrades > 0 ? parseFloat((totalPnlR / totalTrades).toFixed(2)) : 0
    };
  }

  backtestResults.summary = summary;

  // Save results
  const resultsDir = './backtest-results';
  const runsDir = path.join(resultsDir, 'runs');

  // Ensure directories exist
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  if (!fs.existsSync(runsDir)) {
    fs.mkdirSync(runsDir, { recursive: true });
  }

  // Save as latest-backtest.json (for UI)
  const latestPath = path.join(resultsDir, 'latest-backtest.json');
  fs.writeFileSync(latestPath, JSON.stringify(backtestResults, null, 2));

  // Save timestamped run
  const runPath = path.join(runsDir, `${runId}.json`);
  fs.writeFileSync(runPath, JSON.stringify(backtestResults, null, 2));

  // Update index
  let index = { runs: [] };
  const indexPath = path.join(resultsDir, 'index.json');
  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  }

  index.runs.unshift({
    id: runId,
    timestamp: startTime.toISOString(),
    duration: `${duration}s`,
    description: 'Comprehensive backtest with tuned SMC strategy',
    summary: summary
  });

  // Keep only last 20 runs in index
  index.runs = index.runs.slice(0, 20);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  BACKTEST COMPLETE!');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Summary by Mode:');
  console.log('─────────────────────────────────────────────────\n');

  for (const mode of MODES) {
    const s = summary[mode];
    const status = s.profitFactor >= 1.5 ? '✅ PROFITABLE' :
                   s.profitFactor >= 1.0 ? '⚠️  BREAKEVEN' :
                   '❌ UNPROFITABLE';

    console.log(`${mode.toUpperCase().padEnd(15)} | ${status.padEnd(20)} | ${s.totalTrades} trades | ${s.winRate.toFixed(1)}% WR | ${s.profitFactor.toFixed(2)} PF | ${s.totalPnlR.toFixed(2)}R total`);
  }

  console.log('\n✅ Results saved to:');
  console.log(`   - ${latestPath}`);
  console.log(`   - ${runPath}`);
  console.log(`   - ${indexPath}\n`);

  console.log('📊 View results in the Backtest Results tab of your app!\n');
}

runBacktestAndSave().catch(console.error);
