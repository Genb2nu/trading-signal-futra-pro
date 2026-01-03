/**
 * Comprehensive Backtest - Test all modes and timeframes
 * Tests the improved SMC strategy after Phase 1-3 changes
 */

import { backtestSymbol } from './src/services/backtestEngine.js';
import { setStrategyMode, STRATEGY_MODES } from './src/shared/strategyConfig.js';
import fs from 'fs';
import path from 'path';

// Test configuration
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']; // Representative symbols
const TIMEFRAMES = ['15m', '1h', '4h'];
const MODES = ['conservative', 'moderate', 'aggressive', 'scalping'];
const CANDLE_COUNT = 1000;
const LOOKFORWARD = 100;

async function runComprehensiveBacktest() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  COMPREHENSIVE SMC STRATEGY BACKTEST');
  console.log('  After Phase 1-3 Improvements');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('Test Configuration:');
  console.log(`  Symbols: ${SYMBOLS.join(', ')}`);
  console.log(`  Timeframes: ${TIMEFRAMES.join(', ')}`);
  console.log(`  Modes: ${MODES.join(', ')}`);
  console.log(`  Candles: ${CANDLE_COUNT}, Lookforward: ${LOOKFORWARD}`);
  console.log('');
  console.log('Changes Implemented:');
  console.log('  ✅ Phase 1: Pattern detection improvements');
  console.log('     - Removed Zone Inducement (7.1% WR)');
  console.log('     - Added rejection pattern confirmation');
  console.log('     - Timeframe-adaptive Order Block detection');
  console.log('     - Relaxed Liquidity Sweep (2 of 3 conditions)');
  console.log('     - Minimum FVG gap sizes by timeframe');
  console.log('');
  console.log('  ✅ Phase 2: Configuration optimization');
  console.log('     - Updated all mode configurations');
  console.log('     - Fixed confluence scoring weights');
  console.log('     - Prioritized best patterns (Liquidity Sweep: 30)');
  console.log('');
  console.log('  ✅ Phase 3: Market context improvements');
  console.log('     - Relaxed HTF filter (allow weak opposite)');
  console.log('     - Improved market structure (ranging detection)');
  console.log('     - Added trailing stop & partial profit');
  console.log('');
  console.log('  ✅ NEW: Market Regime Filter (ADX-based)');
  console.log('     - Detects trending vs choppy/ranging markets');
  console.log('     - Filters tight ranges in conservative mode');
  console.log('     - Adjusts confluence based on regime (+10/-15)');
  console.log('     - Expected: Improved WR by avoiding bad conditions');
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  const allResults = [];
  let totalTests = MODES.length * TIMEFRAMES.length * SYMBOLS.length;
  let completedTests = 0;

  for (const mode of MODES) {
    console.log('');
    console.log(`╔═══════════════════════════════════════════════════╗`);
    console.log(`║  ${mode.toUpperCase()} MODE`.padEnd(50) + '║');
    console.log(`╚═══════════════════════════════════════════════════╝`);
    console.log('');

    setStrategyMode(mode);

    for (const timeframe of TIMEFRAMES) {
      // Skip 4h for scalping mode (not suitable)
      if (mode === 'scalping' && timeframe === '4h') {
        totalTests--;
        continue;
      }

      console.log(`  📊 ${timeframe} Timeframe:`);
      console.log(`  ${'─'.repeat(50)}`);

      const timeframeResults = [];

      for (const symbol of SYMBOLS) {
        try {
          const result = await backtestSymbol(symbol, timeframe, CANDLE_COUNT, LOOKFORWARD);

          const wins = result.trades.filter(t =>
            t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP_WIN' || t.result === 'BREAKEVEN'
          ).length;
          const losses = result.trades.filter(t => t.result === 'STOP_LOSS').length;
          const totalTrades = result.trades.length;
          const winRate = totalTrades > 0 ? (wins / totalTrades * 100).toFixed(1) : '0.0';

          // Calculate profit factor
          const grossProfit = result.trades
            .filter(t => t.pnlR > 0)
            .reduce((sum, t) => sum + t.pnlR, 0);
          const grossLoss = Math.abs(result.trades
            .filter(t => t.pnlR < 0)
            .reduce((sum, t) => sum + t.pnlR, 0));
          const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : 'N/A';

          // Calculate average R
          const avgR = totalTrades > 0
            ? (result.trades.reduce((sum, t) => sum + t.pnlR, 0) / totalTrades).toFixed(2)
            : '0.00';

          timeframeResults.push({
            symbol,
            totalTrades,
            wins,
            losses,
            winRate: parseFloat(winRate),
            profitFactor: profitFactor !== 'N/A' ? parseFloat(profitFactor) : 0,
            avgR: parseFloat(avgR)
          });

          const status = profitFactor >= 1.5 ? '✅' : profitFactor >= 1.0 ? '⚠️' : '❌';
          console.log(`    ${status} ${symbol.padEnd(10)} | Trades: ${totalTrades.toString().padStart(3)} | WR: ${winRate.padStart(5)}% | PF: ${profitFactor.toString().padStart(4)} | Avg: ${avgR}R`);

          completedTests++;
          process.stdout.write(`\r  Progress: ${completedTests}/${totalTests} tests complete`);
        } catch (error) {
          console.error(`    ❌ ${symbol} - Error: ${error.message}`);
          completedTests++;
        }
      }

      // Calculate aggregated stats for timeframe
      const totalTradesInTF = timeframeResults.reduce((sum, r) => sum + r.totalTrades, 0);
      const totalWinsInTF = timeframeResults.reduce((sum, r) => sum + r.wins, 0);
      const avgWinRate = timeframeResults.length > 0
        ? (timeframeResults.reduce((sum, r) => sum + r.winRate, 0) / timeframeResults.length).toFixed(1)
        : '0.0';
      const avgPF = timeframeResults.filter(r => r.profitFactor > 0).length > 0
        ? (timeframeResults.filter(r => r.profitFactor > 0).reduce((sum, r) => sum + r.profitFactor, 0) /
           timeframeResults.filter(r => r.profitFactor > 0).length).toFixed(2)
        : '0.00';

      console.log('');
      console.log(`    📈 ${timeframe} Summary: ${totalTradesInTF} total trades | ${avgWinRate}% avg WR | ${avgPF} avg PF`);
      console.log('');

      allResults.push({
        mode,
        timeframe,
        results: timeframeResults,
        summary: {
          totalTrades: totalTradesInTF,
          totalWins: totalWinsInTF,
          avgWinRate: parseFloat(avgWinRate),
          avgProfitFactor: parseFloat(avgPF)
        }
      });
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  SUMMARY BY MODE');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  // Aggregate by mode
  for (const mode of MODES) {
    const modeResults = allResults.filter(r => r.mode === mode);
    const totalTrades = modeResults.reduce((sum, r) => sum + r.summary.totalTrades, 0);
    const avgWinRate = modeResults.length > 0
      ? (modeResults.reduce((sum, r) => sum + r.summary.avgWinRate, 0) / modeResults.length).toFixed(1)
      : '0.0';
    const avgPF = modeResults.filter(r => r.summary.avgProfitFactor > 0).length > 0
      ? (modeResults.filter(r => r.summary.avgProfitFactor > 0)
          .reduce((sum, r) => sum + r.summary.avgProfitFactor, 0) /
         modeResults.filter(r => r.summary.avgProfitFactor > 0).length).toFixed(2)
      : '0.00';

    const status = parseFloat(avgPF) >= 1.5 ? '✅ PROFITABLE' :
                   parseFloat(avgPF) >= 1.0 ? '⚠️  BREAKEVEN' :
                   '❌ UNPROFITABLE';

    console.log(`${mode.toUpperCase().padEnd(15)} | ${status.padEnd(20)} | ${totalTrades} trades | ${avgWinRate}% WR | ${avgPF} PF`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  KEY IMPROVEMENTS VS BASELINE');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('Expected Improvements:');
  console.log('  • Conservative: 0 trades → 15-25 trades (60%+ WR)');
  console.log('  • Moderate 15m: 26% WR → 48-52% WR');
  console.log('  • Moderate 1h: Maintain 49% WR → 52-58% WR');
  console.log('  • Moderate 4h: 45% WR → 50-55% WR');
  console.log('  • Aggressive 15m: 36% WR → 45-50% WR');
  console.log('  • Aggressive 1h: Maintain 53% WR');
  console.log('  • Aggressive 4h: 33% WR → 46-51% WR');
  console.log('');

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = './backtest-results';
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultsFile = path.join(resultsDir, `comprehensive-backtest-${timestamp}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    configuration: {
      symbols: SYMBOLS,
      timeframes: TIMEFRAMES,
      modes: MODES,
      candleCount: CANDLE_COUNT,
      lookforward: LOOKFORWARD
    },
    improvements: [
      'Removed Zone Inducement pattern (7.1% WR)',
      'Added rejection pattern confirmation',
      'Timeframe-adaptive Order Block detection',
      'Relaxed Liquidity Sweep detection',
      'Minimum FVG gap sizes',
      'Updated mode configurations',
      'Fixed confluence weights',
      'Relaxed HTF filter',
      'Improved market structure detection',
      'Added trailing stop & partial profit',
      'Market Regime Filter (ADX-based) - filters choppy/ranging markets'
    ],
    results: allResults
  }, null, 2));

  console.log(`Results saved to: ${resultsFile}`);
  console.log('');
  console.log('✅ Comprehensive backtest complete!');
}

runComprehensiveBacktest().catch(console.error);
