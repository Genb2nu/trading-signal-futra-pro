/**
 * Test Conservative Mode Backtest
 * Tests the enhanced SMC 3-state entry system with strict requirements
 */

import { backtestSymbol } from './src/services/backtestEngine.js';
import { setStrategyMode } from './src/shared/strategyConfig.js';

async function runConservativeBacktest() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  CONSERVATIVE MODE BACKTEST');
  console.log('  Enhanced SMC Methodology with 3-State Entry System');
  console.log('═══════════════════════════════════════════════════\n');

  // Set to conservative mode
  setStrategyMode('conservative');
  console.log('✅ Strategy Mode: CONSERVATIVE');
  console.log('   • Minimum Confluence: 55');
  console.log('   • BOS/CHoCH: REQUIRED');
  console.log('   • Rejection Pattern: REQUIRED');
  console.log('   • HTF Alignment: REQUIRED');
  console.log('   • Premium/Discount: SMC Standard (30/70)');
  console.log('   • Risk/Reward: Minimum 2.2:1\n');

  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  const timeframe = '1h';
  const candleCount = 1000; // ~40 days of 1h data
  const lookforward = 100; // Look ahead for outcomes

  console.log('Test Configuration:');
  console.log(`  Symbols: ${symbols.join(', ')}`);
  console.log(`  Timeframe: ${timeframe}`);
  console.log(`  Candles: ${candleCount} (~40 days)`);
  console.log(`  Lookforward: ${lookforward} candles\n`);

  console.log('═══════════════════════════════════════════════════\n');

  const results = [];

  for (const symbol of symbols) {
    console.log(`\n📊 Testing ${symbol}...`);
    console.log('─'.repeat(60));

    try {
      const result = await backtestSymbol(symbol, timeframe, candleCount, lookforward);

      if (!result || !result.signals) {
        console.log(`   ⚠️  No data available for ${symbol}`);
        continue;
      }

      const trades = result.signals.length;
      const wins = result.signals.filter(s => s.outcome === 'WIN').length;
      const losses = result.signals.filter(s => s.outcome === 'LOSS').length;
      const expired = result.signals.filter(s => s.outcome === 'EXPIRED').length;
      const winRate = trades > 0 ? ((wins / trades) * 100).toFixed(1) : '0.0';

      // Calculate P&L
      let totalPnL = 0;
      result.signals.forEach(signal => {
        if (signal.outcome === 'WIN') {
          totalPnL += signal.riskReward || 2.0; // Use signal's R:R
        } else if (signal.outcome === 'LOSS') {
          totalPnL -= 1; // Risk 1R per trade
        }
      });

      console.log(`   Total Signals: ${trades}`);
      console.log(`   Wins: ${wins} | Losses: ${losses} | Expired: ${expired}`);
      console.log(`   Win Rate: ${winRate}%`);
      console.log(`   Total P&L: ${totalPnL > 0 ? '+' : ''}${totalPnL.toFixed(2)}R`);
      console.log(`   Avg R:R: ${result.signals.length > 0 ? (result.signals.reduce((sum, s) => sum + (s.riskReward || 2.0), 0) / result.signals.length).toFixed(2) : 'N/A'}`);

      results.push({
        symbol,
        trades,
        wins,
        losses,
        expired,
        winRate: parseFloat(winRate),
        totalPnL,
        signals: result.signals
      });

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log(' CONSERVATIVE MODE BACKTEST SUMMARY');
  console.log('═'.repeat(60));

  const totalTrades = results.reduce((sum, r) => sum + r.trades, 0);
  const totalWins = results.reduce((sum, r) => sum + r.wins, 0);
  const totalLosses = results.reduce((sum, r) => sum + r.losses, 0);
  const totalExpired = results.reduce((sum, r) => sum + r.expired, 0);
  const totalPnL = results.reduce((sum, r) => sum + r.totalPnL, 0);
  const overallWinRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : '0.0';

  console.log(`\nTotal Trades: ${totalTrades}`);
  console.log(`Total Wins: ${totalWins}`);
  console.log(`Total Losses: ${totalLosses}`);
  console.log(`Total Expired: ${totalExpired}`);
  console.log(`Overall Win Rate: ${overallWinRate}%`);
  console.log(`Total P&L: ${totalPnL > 0 ? '+' : ''}${totalPnL.toFixed(2)}R`);

  console.log('\nPer Symbol Results:');
  console.log('─'.repeat(60));
  results.forEach(r => {
    console.log(`${r.symbol.padEnd(12)} | Trades: ${String(r.trades).padStart(3)} | WR: ${String(r.winRate).padStart(5)}% | P&L: ${(r.totalPnL > 0 ? '+' : '') + r.totalPnL.toFixed(2)}R`);
  });

  console.log('\n' + '═'.repeat(60));
  console.log(' ANALYSIS');
  console.log('═'.repeat(60));

  console.log('\n✅ Conservative Mode Performance:');
  if (overallWinRate >= 60) {
    console.log('   🎯 EXCELLENT - Win rate above 60% target');
  } else if (overallWinRate >= 50) {
    console.log('   ✓ GOOD - Win rate above 50%, acceptable for conservative');
  } else {
    console.log('   ⚠️  NEEDS IMPROVEMENT - Win rate below 50%');
  }

  if (totalPnL > 0) {
    console.log(`   💰 PROFITABLE - Net gain of ${totalPnL.toFixed(2)}R`);
  } else {
    console.log(`   ⚠️  UNPROFITABLE - Net loss of ${Math.abs(totalPnL).toFixed(2)}R`);
  }

  console.log('\n📊 SMC 3-State Entry System:');
  console.log('   • All signals required full confirmation (ENTRY_READY state)');
  console.log('   • BOS/CHoCH structure breaks enforced');
  console.log('   • Rejection patterns required before entry');
  console.log('   • HTF trend alignment checked');
  console.log('   • Premium/Discount zones validated (30/70 SMC standard)');

  console.log('\n🎓 Expectations vs Reality:');
  console.log(`   Expected: 60-70% win rate (conservative, high quality)`);
  console.log(`   Actual: ${overallWinRate}% win rate`);
  console.log(`   Trade Frequency: ${(totalTrades / symbols.length).toFixed(0)} trades per symbol (40 days)`);
  console.log(`   Quality: ${totalExpired > 0 ? `${((totalExpired/totalTrades)*100).toFixed(1)}% expired (strict criteria)` : 'All signals triggered'}`);

  console.log('\n✅ Test complete!\n');
}

runConservativeBacktest().catch(console.error);
