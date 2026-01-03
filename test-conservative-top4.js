/**
 * Test Conservative Mode on Top 4 Symbols
 * Validate the 100% WR claims
 */

import { backtestSymbol } from './src/services/backtestEngine.js';
import { setStrategyMode } from './src/shared/strategyConfig.js';

const MODE = 'conservative';
const TIMEFRAME = '1h';
const TOP_SYMBOLS = ['AVAXUSDT', 'ADAUSDT', 'DOGEUSDT', 'BTCUSDT'];
const CANDLE_COUNT = 1000;
const LOOKFORWARD = 150;

async function testConservativeTop4() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  CONSERVATIVE MODE - TOP 4 SYMBOLS');
  console.log('  Validating 100% WR Performance');
  console.log('═══════════════════════════════════════════════════\n');

  setStrategyMode(MODE);

  const results = {};
  let totalTrades = 0;
  let totalWins = 0;
  let totalPnlR = 0;
  const allTrades = [];

  for (const symbol of TOP_SYMBOLS) {
    try {
      console.log(`📊 Testing ${symbol}...`);

      const result = await backtestSymbol(symbol, TIMEFRAME, CANDLE_COUNT, LOOKFORWARD);

      const trades = result.trades;
      const wins = trades.filter(t => t.pnlR > 0).length;
      const wr = trades.length > 0 ? (wins / trades.length * 100) : 0;

      const grossProfit = trades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
      const grossLoss = Math.abs(trades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
      const pf = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);

      const totalPnl = trades.reduce((sum, t) => sum + t.pnlR, 0);

      results[symbol] = {
        trades: trades.length,
        wins,
        wr,
        pf,
        totalPnlR: totalPnl,
        avgR: trades.length > 0 ? (totalPnl / trades.length) : 0,
        tradeList: trades
      };

      totalTrades += trades.length;
      totalWins += wins;
      totalPnlR += totalPnl;
      allTrades.push(...trades);

      const emoji = wr === 100 ? '🔥' : wr >= 80 ? '🎯' : wr >= 70 ? '✅' : wr >= 60 ? '⚠️' : '❌';
      console.log(`  ${emoji} ${trades.length} trades, ${wr.toFixed(1)}% WR, ${pf.toFixed(2)} PF, ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}R\n`);

    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
      results[symbol] = { error: error.message, trades: 0, wins: 0, wr: 0, pf: 0, totalPnlR: 0, avgR: 0 };
    }
  }

  const overallWR = totalTrades > 0 ? (totalWins / totalTrades * 100) : 0;
  const grossProfit = allTrades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
  const grossLoss = Math.abs(allTrades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
  const overallPF = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);

  console.log('═══════════════════════════════════════════════════');
  console.log('  OVERALL RESULTS');
  console.log('═══════════════════════════════════════════════════\n');

  console.log(`Total Trades: ${totalTrades}`);
  console.log(`Overall Win Rate: ${overallWR.toFixed(1)}%`);
  console.log(`Profit Factor: ${overallPF.toFixed(2)}`);
  console.log(`Total P&L: ${totalPnlR >= 0 ? '+' : ''}${totalPnlR.toFixed(2)}R`);
  console.log(`Avg per Trade: ${totalTrades > 0 ? (totalPnlR / totalTrades).toFixed(2) : 0}R\n`);

  // Detailed breakdown
  console.log('═══════════════════════════════════════════════════');
  console.log('  SYMBOL BREAKDOWN');
  console.log('═══════════════════════════════════════════════════\n');

  for (const symbol of TOP_SYMBOLS) {
    const stat = results[symbol];
    if (stat.error) {
      console.log(`❌ ${symbol}: Error - ${stat.error}\n`);
      continue;
    }

    const emoji = stat.wr === 100 ? '🔥' : stat.wr >= 80 ? '🎯' : stat.wr >= 70 ? '✅' : '⚠️';
    console.log(`${emoji} ${symbol}:`);
    console.log(`   Trades: ${stat.trades}`);
    console.log(`   Win Rate: ${stat.wr.toFixed(1)}%`);
    console.log(`   Profit Factor: ${stat.pf.toFixed(2)}`);
    console.log(`   Total P&L: ${stat.totalPnlR >= 0 ? '+' : ''}${stat.totalPnlR.toFixed(2)}R`);
    console.log(`   Avg R/Trade: ${stat.avgR.toFixed(2)}R`);

    // Show individual trades
    if (stat.tradeList && stat.tradeList.length > 0) {
      console.log(`   Trades:`);
      stat.tradeList.forEach((trade, i) => {
        const result = trade.pnlR > 0 ? '✅' : '❌';
        console.log(`      ${i+1}. ${result} ${trade.pnlR >= 0 ? '+' : ''}${trade.pnlR.toFixed(2)}R (${trade.result})`);
      });
    }
    console.log('');
  }

  // Analysis
  console.log('═══════════════════════════════════════════════════');
  console.log('  ANALYSIS');
  console.log('═══════════════════════════════════════════════════\n');

  if (overallWR >= 80) {
    console.log('🔥 EXCELLENT! Achieved 80%+ win rate target!');
  } else if (overallWR >= 70) {
    console.log('🎯 GREAT! Achieved 70%+ win rate!');
  } else if (overallWR >= 60) {
    console.log('✅ GOOD! Achieved 60%+ win rate!');
  } else {
    console.log('⚠️  Below target, but Conservative mode baseline is 60.9%');
  }

  console.log(`\nProfit Factor: ${overallPF.toFixed(2)} ${overallPF >= 3 ? '(Excellent!)' : overallPF >= 2 ? '(Good!)' : '(Needs improvement)'}`);
  console.log(`Total Profit: ${totalPnlR >= 0 ? '+' : ''}${totalPnlR.toFixed(2)}R\n`);

  const avgTradesPerSymbol = totalTrades / TOP_SYMBOLS.length;
  console.log('Trade Frequency:');
  console.log(`  ${avgTradesPerSymbol.toFixed(1)} trades per symbol (1000 candles)`);
  console.log(`  ~${(avgTradesPerSymbol / 42).toFixed(1)} trades per week per symbol (1000 candles ≈ 42 weeks)`);
  console.log(`  With 4 symbols: ~${(totalTrades / 42).toFixed(1)} trades per week total\n`);

  console.log('═══════════════════════════════════════════════════');
  console.log('  RECOMMENDATION');
  console.log('═══════════════════════════════════════════════════\n');

  if (overallWR >= 70 && totalPnlR > 5) {
    console.log('✅ DEPLOY Conservative mode on these 4 symbols!');
    console.log('   Strategy is proven and ready for live trading.');
    console.log(`   Expected: ${overallWR.toFixed(1)}% WR with ${overallPF.toFixed(2)} PF`);
  } else if (overallWR >= 60) {
    console.log('⚠️  Conservative mode is profitable but below 70% WR goal.');
    console.log('   Consider: Add SNIPER trade management for higher R:R');
  } else {
    console.log('❌ Results do not meet expectations.');
    console.log('   Investigate: Check if backtest data is different from previous runs');
  }

  console.log('\n═══════════════════════════════════════════════════\n');
}

testConservativeTop4().catch(console.error);
