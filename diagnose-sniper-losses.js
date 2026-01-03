/**
 * Diagnose SNIPER Mode Losses - Find Why 75% of Trades Failed
 */

import fs from 'fs';

const resultsFile = './backtest-results/latest-backtest.json';

console.log('\n═══════════════════════════════════════════════════');
console.log('  SNIPER MODE LOSS ANALYSIS');
console.log('  Why did 75% of trades fail?');
console.log('═══════════════════════════════════════════════════\n');

if (!fs.existsSync(resultsFile)) {
  console.log('❌ No backtest results found.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
const sniperResults = data.results?.sniper?.['1h'] || {};

// Collect all trades
const allTrades = [];
for (const [symbol, symbolData] of Object.entries(sniperResults)) {
  if (!symbolData.trades) continue;
  symbolData.trades.forEach(trade => {
    allTrades.push({ ...trade, symbol });
  });
}

console.log(`📊 Total SNIPER trades: ${allTrades.length}\n`);

// Separate winners and losers
const winners = allTrades.filter(t => t.pnlR > 0);
const losers = allTrades.filter(t => t.pnlR <= 0);

console.log(`✅ Winners: ${winners.length} (${(winners.length / allTrades.length * 100).toFixed(1)}%)`);
console.log(`❌ Losers: ${losers.length} (${(losers.length / allTrades.length * 100).toFixed(1)}%)\n`);

// Analyze losers
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('LOSING TRADES ANALYSIS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Group by result type
const losersByResult = {};
losers.forEach(trade => {
  const result = trade.result || 'UNKNOWN';
  if (!losersByResult[result]) losersByResult[result] = [];
  losersByResult[result].push(trade);
});

console.log('Loss Types:');
for (const [result, trades] of Object.entries(losersByResult)) {
  const avgLoss = trades.reduce((sum, t) => sum + t.pnlR, 0) / trades.length;
  console.log(`  ${result.padEnd(20)}: ${trades.length.toString().padStart(2)} trades, avg ${avgLoss.toFixed(2)}R`);
}

// Analyze by symbol
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('LOSSES BY SYMBOL');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const losersBySymbol = {};
losers.forEach(trade => {
  if (!losersBySymbol[trade.symbol]) losersBySymbol[trade.symbol] = [];
  losersBySymbol[trade.symbol].push(trade);
});

for (const [symbol, trades] of Object.entries(losersBySymbol).sort((a, b) => b[1].length - a[1].length)) {
  const avgLoss = trades.reduce((sum, t) => sum + t.pnlR, 0) / trades.length;
  const totalLoss = trades.reduce((sum, t) => sum + t.pnlR, 0);
  console.log(`${symbol.padEnd(12)}: ${trades.length} losses, avg ${avgLoss.toFixed(2)}R, total ${totalLoss.toFixed(2)}R`);

  // Show result types for this symbol
  const resultTypes = {};
  trades.forEach(t => {
    const result = t.result || 'UNKNOWN';
    resultTypes[result] = (resultTypes[result] || 0) + 1;
  });
  console.log(`  Result types: ${Object.entries(resultTypes).map(([r, c]) => `${r}(${c})`).join(', ')}`);
}

// Analyze MAE/MFE
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('MAE/MFE ANALYSIS (Did trades go positive first?)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const losersWithMFE = losers.filter(t => t.mfeR && t.mfeR > 0);
console.log(`Losers that went positive: ${losersWithMFE.length} / ${losers.length} (${(losersWithMFE.length / losers.length * 100).toFixed(1)}%)\n`);

if (losersWithMFE.length > 0) {
  const avgMFE = losersWithMFE.reduce((sum, t) => sum + t.mfeR, 0) / losersWithMFE.length;
  const maxMFE = Math.max(...losersWithMFE.map(t => t.mfeR));

  console.log(`Average MFE: +${avgMFE.toFixed(2)}R`);
  console.log(`Max MFE: +${maxMFE.toFixed(2)}R\n`);

  // How many reached breakeven trigger (0.8R)?
  const reachedBE = losersWithMFE.filter(t => t.mfeR >= 0.8);
  console.log(`Reached breakeven trigger (0.8R): ${reachedBE.length} / ${losersWithMFE.length}`);

  // How many reached partial profit (2.0R)?
  const reachedPartial = losersWithMFE.filter(t => t.mfeR >= 2.0);
  console.log(`Reached partial profit (2.0R): ${reachedPartial.length} / ${losersWithMFE.length}\n`);
}

// Analyze direction bias
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('DIRECTIONAL BIAS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const longLosers = losers.filter(t => t.type === 'BUY');
const shortLosers = losers.filter(t => t.type === 'SELL');

console.log(`LONG losses: ${longLosers.length} (${(longLosers.length / losers.length * 100).toFixed(1)}%)`);
console.log(`SHORT losses: ${shortLosers.length} (${(shortLosers.length / losers.length * 100).toFixed(1)}%)\n`);

const longWinners = winners.filter(t => t.type === 'BUY');
const shortWinners = winners.filter(t => t.type === 'SELL');

console.log(`LONG winners: ${longWinners.length}`);
console.log(`SHORT winners: ${shortWinners.length}\n`);

const longWR = longWinners.length / (longWinners.length + longLosers.length) * 100;
const shortWR = shortWinners.length / (shortWinners.length + shortLosers.length) * 100;

console.log(`LONG win rate: ${longWR.toFixed(1)}%`);
console.log(`SHORT win rate: ${shortWR.toFixed(1)}%`);

// Compare to Scalping mode on 1H
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('COMPARISON: SNIPER vs SCALPING MODE (1H)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const scalpingResults = data.results?.scalping?.['1h'] || {};

// Analyze scalping mode
const scalpingTrades = [];
for (const [symbol, symbolData] of Object.entries(scalpingResults)) {
  if (!symbolData.trades) continue;
  symbolData.trades.forEach(trade => {
    scalpingTrades.push({ ...trade, symbol });
  });
}

if (scalpingTrades.length > 0) {
  const scalpingWinners = scalpingTrades.filter(t => t.pnlR > 0);
  const scalpingLosers = scalpingTrades.filter(t => t.pnlR <= 0);
  const scalpingWR = (scalpingWinners.length / scalpingTrades.length * 100);

  console.log('Scalping Mode (1H):');
  console.log(`  Total trades: ${scalpingTrades.length}`);
  console.log(`  Win rate: ${scalpingWR.toFixed(1)}%`);
  console.log(`  Winners: ${scalpingWinners.length}`);
  console.log(`  Losers: ${scalpingLosers.length}\n`);

  console.log('SNIPER Mode (1H):');
  console.log(`  Total trades: ${allTrades.length}`);
  console.log(`  Win rate: ${(winners.length / allTrades.length * 100).toFixed(1)}%`);
  console.log(`  Winners: ${winners.length}`);
  console.log(`  Losers: ${losers.length}\n`);

  console.log('KEY DIFFERENCE:');
  console.log(`  Scalping generates ${scalpingTrades.length} trades vs SNIPER ${allTrades.length} trades`);
  console.log(`  Scalping WR: ${scalpingWR.toFixed(1)}% vs SNIPER WR: ${(winners.length / allTrades.length * 100).toFixed(1)}%`);
  console.log(`  SNIPER is TOO STRICT, filtering out good trades!\n`);
}

// Recommendations
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('RECOMMENDATIONS FOR ENHANCEMENT');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('1. SNIPER is over-filtering (only 20 trades vs Scalping 72 trades)');
console.log('   → Lower confluence requirement from 75 to 60-65');
console.log('   → Make rejection pattern preferred, not required\n');

console.log('2. Focus on top-performing symbols only');
console.log('   → DOGE, SOL, MATIC, ETH showed 70-83% WR in Scalping');
console.log('   → Remove underperformers (BNB, SOL had 0% WR in SNIPER)\n');

console.log('3. Analyze Scalping mode settings that work on 1H');
console.log('   → Use Scalping confluence thresholds');
console.log('   → Keep SNIPER trade management (BE, partial, trailing)\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
