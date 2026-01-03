/**
 * Compare All Modes on 1H - Find What Works Best
 */

import fs from 'fs';

const resultsFile = './backtest-results/latest-backtest.json';

console.log('\n═══════════════════════════════════════════════════');
console.log('  1H TIMEFRAME - MODE COMPARISON');
console.log('  Finding the best configuration');
console.log('═══════════════════════════════════════════════════\n');

if (!fs.existsSync(resultsFile)) {
  console.log('❌ No backtest results found.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));

const modes = ['conservative', 'moderate', 'aggressive', 'scalping', 'sniper'];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('OVERALL MODE PERFORMANCE (1H)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const modeStats = [];

for (const mode of modes) {
  const results = data.results?.[mode]?.['1h'];
  if (!results) continue;

  let totalTrades = 0;
  let totalWins = 0;
  let totalPnlR = 0;
  const allTrades = [];

  for (const [symbol, symbolData] of Object.entries(results)) {
    if (!symbolData.trades) continue;
    totalTrades += symbolData.totalTrades || symbolData.trades.length;
    totalWins += symbolData.wins || symbolData.trades.filter(t => t.pnlR > 0).length;
    totalPnlR += symbolData.totalPnlR || symbolData.trades.reduce((sum, t) => sum + t.pnlR, 0);
    allTrades.push(...symbolData.trades);
  }

  const winRate = totalTrades > 0 ? (totalWins / totalTrades * 100) : 0;
  const grossProfit = allTrades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
  const grossLoss = Math.abs(allTrades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
  const pf = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);

  modeStats.push({
    mode,
    totalTrades,
    totalWins,
    winRate,
    totalPnlR,
    pf
  });

  const emoji = totalPnlR > 0 ? '✅' : '❌';
  console.log(`${emoji} ${mode.toUpperCase().padEnd(15)}: ${totalTrades.toString().padStart(3)} trades, ${winRate.toFixed(1).padStart(5)}% WR, ${pf.toFixed(2).padStart(4)} PF, ${totalPnlR >= 0 ? '+' : ''}${totalPnlR.toFixed(2).padStart(7)}R`);
}

// Find best symbols for each mode
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TOP PERFORMING SYMBOLS BY MODE (1H)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

for (const mode of modes) {
  const results = data.results?.[mode]?.['1h'];
  if (!results) continue;

  console.log(`${mode.toUpperCase()} Mode:`);

  const symbolStats = [];

  for (const [symbol, symbolData] of Object.entries(results)) {
    if (!symbolData.trades || symbolData.trades.length === 0) continue;

    const trades = symbolData.trades;
    const wins = trades.filter(t => t.pnlR > 0).length;
    const wr = (wins / trades.length) * 100;
    const totalPnlR = trades.reduce((sum, t) => sum + t.pnlR, 0);

    symbolStats.push({ symbol, trades: trades.length, wins, wr, totalPnlR });
  }

  // Sort by win rate
  symbolStats.sort((a, b) => b.wr - a.wr);

  // Show top 5
  symbolStats.slice(0, 5).forEach((stat, i) => {
    const emoji = stat.wr >= 70 ? '🎯' : stat.wr >= 60 ? '✅' : stat.wr >= 50 ? '⚠️' : '❌';
    console.log(`  ${i + 1}. ${emoji} ${stat.symbol.padEnd(12)}: ${stat.wr.toFixed(1).padStart(5)}% WR (${stat.wins}/${stat.trades}), ${stat.totalPnlR >= 0 ? '+' : ''}${stat.totalPnlR.toFixed(2)}R`);
  });

  console.log('');
}

// Analyze what makes winners win
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CROSS-MODE SYMBOL PERFORMANCE (1H)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT'];

for (const symbol of symbols) {
  console.log(`${symbol}:`);

  const symbolPerf = [];

  for (const mode of modes) {
    const results = data.results?.[mode]?.['1h']?.[symbol];
    if (!results || !results.trades || results.trades.length === 0) continue;

    const trades = results.trades;
    const wins = trades.filter(t => t.pnlR > 0).length;
    const wr = (wins / trades.length) * 100;
    const totalPnlR = trades.reduce((sum, t) => sum + t.pnlR, 0);

    symbolPerf.push({ mode, trades: trades.length, wr, totalPnlR });
  }

  // Sort by WR
  symbolPerf.sort((a, b) => b.wr - a.wr);

  symbolPerf.forEach(perf => {
    const emoji = perf.wr >= 70 ? '🎯' : perf.wr >= 50 ? '✅' : '⚠️';
    console.log(`  ${emoji} ${perf.mode.padEnd(12)}: ${perf.wr.toFixed(1).padStart(5)}% WR (${perf.trades.toString().padStart(2)} trades), ${perf.totalPnlR >= 0 ? '+' : ''}${perf.totalPnlR.toFixed(2)}R`);
  });

  console.log('');
}

// Recommendations
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('KEY INSIGHTS & RECOMMENDATIONS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Find best mode
const bestMode = modeStats.sort((a, b) => b.totalPnlR - a.totalPnlR)[0];
console.log(`1. Best overall mode: ${bestMode.mode.toUpperCase()} (${bestMode.winRate.toFixed(1)}% WR, +${bestMode.totalPnlR.toFixed(2)}R)`);

// Find best mode by WR
const bestWRMode = modeStats.sort((a, b) => b.winRate - a.winRate)[0];
console.log(`2. Highest win rate mode: ${bestWRMode.mode.toUpperCase()} (${bestWRMode.winRate.toFixed(1)}% WR, ${bestWRMode.totalTrades} trades)`);

// Find symbols that work well across modes
console.log('\n3. Consistent performers (good across multiple modes):');
const consistentSymbols = [];

for (const symbol of symbols) {
  let goodModes = 0;
  let totalWR = 0;
  let modeCount = 0;

  for (const mode of modes) {
    const results = data.results?.[mode]?.['1h']?.[symbol];
    if (!results || !results.trades || results.trades.length === 0) continue;

    const wins = results.trades.filter(t => t.pnlR > 0).length;
    const wr = (wins / results.trades.length) * 100;

    if (wr >= 50) goodModes++;
    totalWR += wr;
    modeCount++;
  }

  if (modeCount > 0) {
    const avgWR = totalWR / modeCount;
    consistentSymbols.push({ symbol, goodModes, avgWR, modeCount });
  }
}

consistentSymbols.sort((a, b) => b.avgWR - a.avgWR);

consistentSymbols.slice(0, 5).forEach((stat, i) => {
  console.log(`   ${i + 1}. ${stat.symbol}: Avg ${stat.avgWR.toFixed(1)}% WR across ${stat.modeCount} modes (${stat.goodModes} with 50%+ WR)`);
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
