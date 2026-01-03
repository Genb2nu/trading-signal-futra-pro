/**
 * Analyze SNIPER Mode Results by Symbol
 */

import fs from 'fs';

const resultsFile = './backtest-results/latest-backtest.json';

console.log('\n═══════════════════════════════════════════════════');
console.log('  SNIPER MODE DETAILED ANALYSIS');
console.log('  1H Timeframe with 2.5:1+ R:R Target');
console.log('═══════════════════════════════════════════════════\n');

if (!fs.existsSync(resultsFile)) {
  console.log('❌ No backtest results found.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));

// Get SNIPER mode results
const sniperResults = data.results?.sniper || {};

if (!sniperResults['1h']) {
  console.log('❌ No SNIPER mode 1h results found.');
  process.exit(1);
}

const results1h = sniperResults['1h'];

console.log('📊 SNIPER MODE PERFORMANCE BY SYMBOL (1H)\n');
console.log('─'.repeat(80));

const symbolStats = [];

for (const [symbol, symbolData] of Object.entries(results1h)) {
  if (!symbolData.trades || symbolData.trades.length === 0) continue;

  const trades = symbolData.trades;
  const wins = trades.filter(t => t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP_WIN').length;
  const losses = trades.filter(t => t.result === 'STOP_LOSS' || t.result === 'BREAKEVEN' || t.result === 'EXPIRED').length;
  const wr = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  // Calculate total PnL
  const totalPnlR = trades.reduce((sum, t) => sum + (t.pnlR || 0), 0);
  const avgPnlR = totalPnlR / trades.length;

  // Get profit factor
  const grossProfit = trades.filter(t => (t.pnlR || 0) > 0).reduce((sum, t) => sum + t.pnlR, 0);
  const grossLoss = Math.abs(trades.filter(t => (t.pnlR || 0) < 0).reduce((sum, t) => sum + t.pnlR, 0));
  const pf = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);

  symbolStats.push({
    symbol,
    trades: trades.length,
    wins,
    losses,
    wr,
    totalPnlR,
    avgPnlR,
    pf
  });
}

// Sort by total PnL
symbolStats.sort((a, b) => b.totalPnlR - a.totalPnlR);

console.log('Symbol'.padEnd(12) + '| Trades | Wins | Losses | Win Rate | Total PnL | Avg R | PF');
console.log('─'.repeat(80));

let totalTrades = 0;
let totalWins = 0;
let totalPnlR = 0;

symbolStats.forEach(stat => {
  const emoji = stat.wr >= 75 ? '🎯' : stat.wr >= 50 ? '✅' : stat.wr >= 30 ? '⚠️' : '❌';
  const profitEmoji = stat.totalPnlR > 0 ? '💰' : '💸';

  console.log(
    `${emoji} ${stat.symbol.padEnd(10)}| ${stat.trades.toString().padStart(6)} | ${stat.wins.toString().padStart(4)} | ${stat.losses.toString().padStart(6)} | ${stat.wr.toFixed(1).padStart(7)}% | ${profitEmoji} ${stat.totalPnlR >= 0 ? '+' : ''}${stat.totalPnlR.toFixed(2).padStart(6)}R | ${stat.avgPnlR >= 0 ? '+' : ''}${stat.avgPnlR.toFixed(2).padStart(5)}R | ${stat.pf.toFixed(2)}`
  );

  totalTrades += stat.trades;
  totalWins += stat.wins;
  totalPnlR += stat.totalPnlR;
});

console.log('─'.repeat(80));
const overallWR = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
const avgRPerTrade = totalTrades > 0 ? totalPnlR / totalTrades : 0;

console.log(
  `${'TOTAL'.padEnd(12)}| ${totalTrades.toString().padStart(6)} | ${totalWins.toString().padStart(4)} | ${(totalTrades - totalWins).toString().padStart(6)} | ${overallWR.toFixed(1).padStart(7)}% | ${totalPnlR >= 0 ? '💰 +' : '💸 '}${totalPnlR.toFixed(2).padStart(6)}R | ${avgRPerTrade >= 0 ? '+' : ''}${avgRPerTrade.toFixed(2).padStart(5)}R |`
);

console.log('\n═══════════════════════════════════════════════════');
console.log('  KEY INSIGHTS');
console.log('═══════════════════════════════════════════════════\n');

// Best performers
const profitable = symbolStats.filter(s => s.totalPnlR > 0);
const highWR = symbolStats.filter(s => s.wr >= 50);

if (profitable.length > 0) {
  console.log('✅ PROFITABLE SYMBOLS:\n');
  profitable.forEach(stat => {
    console.log(`   ${stat.symbol}: ${stat.wr.toFixed(1)}% WR, ${stat.pf.toFixed(2)} PF, +${stat.totalPnlR.toFixed(2)}R (${stat.trades} trades)`);
  });
}

if (highWR.length > 0) {
  console.log('\n🎯 HIGH WIN RATE SYMBOLS (50%+):\n');
  highWR.forEach(stat => {
    console.log(`   ${stat.symbol}: ${stat.wr.toFixed(1)}% WR, ${stat.trades} trades`);
  });
}

// Analyze R:R achieved
console.log('\n═══════════════════════════════════════════════════');
console.log('  RISK:REWARD ANALYSIS');
console.log('═══════════════════════════════════════════════════\n');

// Get all winning trades
const allWinners = [];
const allLosers = [];

for (const [symbol, symbolData] of Object.entries(results1h)) {
  if (!symbolData.trades) continue;
  symbolData.trades.forEach(trade => {
    if (trade.pnlR > 0) {
      allWinners.push({ ...trade, symbol });
    } else {
      allLosers.push({ ...trade, symbol });
    }
  });
}

if (allWinners.length > 0) {
  const avgWinR = allWinners.reduce((sum, t) => sum + t.pnlR, 0) / allWinners.length;
  const maxWinR = Math.max(...allWinners.map(t => t.pnlR));
  const minWinR = Math.min(...allWinners.map(t => t.pnlR));

  console.log(`Winners: ${allWinners.length} trades`);
  console.log(`  Average: +${avgWinR.toFixed(2)}R`);
  console.log(`  Min/Max: +${minWinR.toFixed(2)}R / +${maxWinR.toFixed(2)}R`);
}

if (allLosers.length > 0) {
  const avgLossR = allLosers.reduce((sum, t) => sum + t.pnlR, 0) / allLosers.length;
  const maxLossR = Math.min(...allLosers.map(t => t.pnlR));

  console.log(`\nLosers: ${allLosers.length} trades`);
  console.log(`  Average: ${avgLossR.toFixed(2)}R`);
  console.log(`  Max loss: ${maxLossR.toFixed(2)}R`);
}

if (allWinners.length > 0 && allLosers.length > 0) {
  const avgWinR = allWinners.reduce((sum, t) => sum + t.pnlR, 0) / allWinners.length;
  const avgLossR = Math.abs(allLosers.reduce((sum, t) => sum + t.pnlR, 0) / allLosers.length);
  const actualRR = avgWinR / avgLossR;

  console.log(`\n📊 Actual R:R Achieved: ${actualRR.toFixed(2)}:1`);
  console.log(`   (Target was 2.5:1)`);

  if (actualRR >= 2.5) {
    console.log('   ✅ Target achieved!');
  } else if (actualRR >= 2.0) {
    console.log('   ⚠️  Close to target (2:1+)');
  } else {
    console.log('   ❌ Below target');
  }
}

console.log('\n═══════════════════════════════════════════════════');
console.log('  RECOMMENDATIONS');
console.log('═══════════════════════════════════════════════════\n');

if (profitable.length > 0) {
  console.log('💡 Focus on these profitable symbols:');
  profitable.slice(0, 5).forEach((stat, i) => {
    console.log(`   ${i + 1}. ${stat.symbol} (${stat.wr.toFixed(1)}% WR, +${stat.totalPnlR.toFixed(2)}R)`);
  });
}

if (overallWR >= 50) {
  console.log(`\n✅ Overall win rate (${overallWR.toFixed(1)}%) meets target!`);
} else {
  console.log(`\n⚠️  Overall win rate (${overallWR.toFixed(1)}%) below 50%, but still profitable due to R:R`);
}

if (totalPnlR > 0) {
  console.log(`✅ Overall profitable: +${totalPnlR.toFixed(2)}R across ${totalTrades} trades`);
  const profitPerTrade = totalPnlR / totalTrades;
  console.log(`   Average: +${profitPerTrade.toFixed(2)}R per trade`);
}

console.log('\n═══════════════════════════════════════════════════\n');
