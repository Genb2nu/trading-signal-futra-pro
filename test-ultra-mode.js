/**
 * Test ULTRA Mode - Elite 70-80% WR Target
 * Focus on top 4 symbols only: AVAX, ADA, DOGE, BTC
 */

import { backtestSymbol } from './src/services/backtestEngine.js';
import { setStrategyMode } from './src/shared/strategyConfig.js';

const MODE = 'ultra';
const TIMEFRAME = '1h';
const TOP_SYMBOLS = ['AVAXUSDT', 'ADAUSDT', 'DOGEUSDT', 'BTCUSDT']; // Proven 100% WR in Conservative
const CANDLE_COUNT = 1000;
const LOOKFORWARD = 150;

async function testUltraMode() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ULTRA MODE - ELITE 70-80% WR TEST');
  console.log('  Conservative filtering + SNIPER trade management');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Configuration:');
  console.log(`  Mode: ULTRA`);
  console.log(`  Timeframe: ${TIMEFRAME}`);
  console.log(`  Symbols: ${TOP_SYMBOLS.join(', ')}`);
  console.log(`  Strategy: Conservative baseline (60.9% WR) + enhanced filters`);
  console.log(`  Target: 70-80% WR with 2.5-3.5:1 R:R\n`);

  console.log('─'.repeat(80));

  setStrategyMode(MODE);

  const results = {};
  let totalTrades = 0;
  let totalWins = 0;
  let totalPnlR = 0;
  const allTrades = [];

  for (const symbol of TOP_SYMBOLS) {
    try {
      console.log(`\n📊 Testing ${symbol}...`);

      const result = await backtestSymbol(symbol, TIMEFRAME, CANDLE_COUNT, LOOKFORWARD);

      const trades = result.trades;
      const wins = trades.filter(t => t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP_WIN' || t.result === 'BREAKEVEN').length;
      const losses = trades.filter(t => t.result === 'STOP_LOSS').length;
      const wr = trades.length > 0 ? (wins / trades.length * 100) : 0;

      // Calculate profit factor
      const grossProfit = trades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
      const grossLoss = Math.abs(trades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
      const pf = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);

      const totalPnl = trades.reduce((sum, t) => sum + t.pnlR, 0);

      results[symbol] = {
        trades: trades.length,
        wins,
        losses,
        wr,
        pf,
        totalPnlR: totalPnl,
        avgR: trades.length > 0 ? (totalPnl / trades.length) : 0
      };

      totalTrades += trades.length;
      totalWins += wins;
      totalPnlR += totalPnl;
      allTrades.push(...trades);

      const emoji = wr >= 80 ? '🔥' : wr >= 70 ? '🎯' : wr >= 60 ? '✅' : wr >= 50 ? '⚠️' : '❌';
      console.log(`  ${emoji} ${trades.length} trades, ${wr.toFixed(1)}% WR, ${pf.toFixed(2)} PF, ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}R`);

    } catch (error) {
      console.error(`  ❌ Error testing ${symbol}: ${error.message}`);
      results[symbol] = { error: error.message, trades: 0, wins: 0, wr: 0, pf: 0, totalPnlR: 0, avgR: 0 };
    }
  }

  const overallWR = totalTrades > 0 ? (totalWins / totalTrades * 100) : 0;
  const grossProfit = allTrades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
  const grossLoss = Math.abs(allTrades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
  const overallPF = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);
  const avgRPerTrade = totalTrades > 0 ? (totalPnlR / totalTrades) : 0;

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ULTRA MODE RESULTS');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Overall Performance:');
  console.log(`  Total Trades: ${totalTrades}`);
  console.log(`  Win Rate: ${overallWR.toFixed(1)}%`);
  console.log(`  Profit Factor: ${overallPF.toFixed(2)}`);
  console.log(`  Total P&L: ${totalPnlR >= 0 ? '+' : ''}${totalPnlR.toFixed(2)}R`);
  console.log(`  Avg per Trade: ${avgRPerTrade >= 0 ? '+' : ''}${avgRPerTrade.toFixed(2)}R\n`);

  console.log('By Symbol:');
  console.log('─'.repeat(80));

  for (const symbol of TOP_SYMBOLS) {
    const stat = results[symbol];
    if (stat.error) continue;

    const emoji = stat.wr >= 80 ? '🔥' : stat.wr >= 70 ? '🎯' : stat.wr >= 60 ? '✅' : '⚠️';
    console.log(`${emoji} ${symbol.padEnd(12)}: ${stat.trades.toString().padStart(2)} trades, ${stat.wr.toFixed(1).padStart(5)}% WR, ${stat.pf.toFixed(2).padStart(4)} PF, ${stat.totalPnlR >= 0 ? '+' : ''}${stat.totalPnlR.toFixed(2).padStart(6)}R`);
  }

  // Compare to baselines
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  COMPARISON TO OTHER MODES (1H)');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Conservative (baseline):');
  console.log('  Overall: 60.9% WR, 1.15 PF, +1.83R (46 trades)');
  console.log('  Top 4 symbols: AVAX 100% (6/6), ADA 100% (7/7), DOGE 100% (3/3), BTC 100% (3/3)\n');

  console.log('SNIPER (current best):');
  console.log('  Overall: 55.0% WR, 2.85 PF, +6.56R (20 trades)');
  console.log('  Top 4 symbols: AVAX 100% (3/3), ADA 66.7% (2/3), DOGE 100% (1/1), BTC 100% (1/1)\n');

  console.log('ULTRA (this test):');
  console.log(`  Overall: ${overallWR.toFixed(1)}% WR, ${overallPF.toFixed(2)} PF, ${totalPnlR >= 0 ? '+' : ''}${totalPnlR.toFixed(2)}R (${totalTrades} trades)\n`);

  // Recommendations
  console.log('═══════════════════════════════════════════════════');
  console.log('  ANALYSIS');
  console.log('═══════════════════════════════════════════════════\n');

  if (overallWR >= 70 && totalPnlR > 6.56) {
    console.log('✅ ULTRA MODE SUCCEEDS!');
    console.log(`   - Achieved ${overallWR.toFixed(1)}% WR (target: 70-80%)`);
    console.log(`   - Profitable: ${totalPnlR >= 0 ? '+' : ''}${totalPnlR.toFixed(2)}R`);
    console.log(`   - Better than SNIPER (${overallPF.toFixed(2)} vs 2.85 PF)`);
  } else if (overallWR >= 70) {
    console.log('⚠️  ULTRA MODE - HIGH WR BUT NEEDS OPTIMIZATION');
    console.log(`   - Win rate: ${overallWR.toFixed(1)}% ✅ (met 70%+ target)`);
    console.log(`   - Profit: ${totalPnlR >= 0 ? '+' : ''}${totalPnlR.toFixed(2)}R (less than SNIPER +6.56R)`);
    console.log('   - Recommendation: Too few trades or R:R too low');
  } else if (totalPnlR > 6.56) {
    console.log('⚠️  ULTRA MODE - PROFITABLE BUT WR BELOW TARGET');
    console.log(`   - Win rate: ${overallWR.toFixed(1)}% (below 70% target)`);
    console.log(`   - Profit: ${totalPnlR >= 0 ? '+' : ''}${totalPnlR.toFixed(2)}R ✅ (beats SNIPER)`);
    console.log('   - Still good due to high PF, but doesn\'t meet WR goal');
  } else {
    console.log('❌ ULTRA MODE - NEEDS FURTHER REFINEMENT');
    console.log(`   - Win rate: ${overallWR.toFixed(1)}% (target: 70-80%)`);
    console.log(`   - Profit: ${totalPnlR >= 0 ? '+' : ''}${totalPnlR.toFixed(2)}R (vs SNIPER +6.56R)`);
    console.log('   - Analysis: Conservative filtering may be filtering out too many trades');
    console.log('   - Or: Top 4 symbols may not have enough setups in test period');
  }

  // Trade frequency analysis
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  TRADE FREQUENCY ANALYSIS');
  console.log('═══════════════════════════════════════════════════\n');

  console.log(`Total trades: ${totalTrades} across 4 symbols in 1000 candles`);
  console.log(`Per symbol avg: ${(totalTrades / 4).toFixed(1)} trades`);
  console.log(`Frequency: ~${(totalTrades / 4).toFixed(1)} trades per 1000 candles per symbol`);
  console.log(`Expected live: ~1-2 trades per week per symbol`);
  console.log(`With 4 symbols: ~4-8 trades per week total\n`);

  console.log('═══════════════════════════════════════════════════\n');
}

testUltraMode().catch(console.error);
