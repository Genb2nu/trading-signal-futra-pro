/**
 * Diagnostic: Analyze why SHORT trades have 25% WR vs 41% for LONG trades
 */

import fs from 'fs';

const latestResultsPath = './backtest-results/latest-backtest.json';

if (!fs.existsSync(latestResultsPath)) {
  console.error('No backtest results found!');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(latestResultsPath, 'utf8'));

console.log('═══════════════════════════════════════════════════');
console.log('  SHORT vs LONG TRADE ANALYSIS');
console.log('  Identifying why shorts underperform');
console.log('═══════════════════════════════════════════════════\n');

// Extract all trades
const allTrades = [];
for (const mode of Object.keys(data.results)) {
  for (const timeframe of Object.keys(data.results[mode])) {
    for (const symbol of Object.keys(data.results[mode][timeframe])) {
      const symbolData = data.results[mode][timeframe][symbol];
      if (symbolData.trades && symbolData.trades.length > 0) {
        symbolData.trades.forEach(trade => {
          allTrades.push({ ...trade, mode, timeframe, symbol });
        });
      }
    }
  }
}

const longTrades = allTrades.filter(t => t.direction === 'BUY');
const shortTrades = allTrades.filter(t => t.direction === 'SELL');

console.log(`📊 Total: ${allTrades.length} trades (${longTrades.length} longs, ${shortTrades.length} shorts)\n`);

// Analyze MAE (Maximum Adverse Excursion)
const longMAE = longTrades.map(t => t.maxAdverseExcursion || 0);
const shortMAE = shortTrades.map(t => t.maxAdverseExcursion || 0);

const avgLongMAE = longMAE.reduce((a, b) => a + b, 0) / longMAE.length;
const avgShortMAE = shortMAE.reduce((a, b) => a + b, 0) / shortMAE.length;

console.log('Entry Quality (MAE - Max Adverse Excursion):');
console.log('─────────────────────────────────────────────────');
console.log(`LONG Avg MAE:  ${avgLongMAE.toFixed(2)}R  ${avgLongMAE < -0.3 ? '✅ Good entries' : '❌ Poor entries'}`);
console.log(`SHORT Avg MAE: ${avgShortMAE.toFixed(2)}R ${avgShortMAE < -0.3 ? '✅ Good entries' : '❌ Poor entries'}`);

if (avgShortMAE < avgLongMAE - 0.1) {
  console.log('⚠️  SHORT entries are significantly worse (stopped out faster)');
  console.log('   → Problem: Stop loss too tight OR bearish OB detection wrong\n');
} else {
  console.log('✅ Entry quality similar between LONG and SHORT\n');
}

// Analyze MFE (Maximum Favorable Excursion)
const longMFE = longTrades.map(t => t.maxFavorableExcursion || 0);
const shortMFE = shortTrades.map(t => t.maxFavorableExcursion || 0);

const avgLongMFE = longMFE.reduce((a, b) => a + b, 0) / longMFE.length;
const avgShortMFE = shortMFE.reduce((a, b) => a + b, 0) / shortMFE.length;

console.log('Profit Potential (MFE - Max Favorable Excursion):');
console.log('─────────────────────────────────────────────────');
console.log(`LONG Avg MFE:  ${avgLongMFE.toFixed(2)}R  ${avgLongMFE > 0.8 ? '✅ Good profit potential' : '❌ Limited upside'}`);
console.log(`SHORT Avg MFE: ${avgShortMFE.toFixed(2)}R ${avgShortMFE > 0.8 ? '✅ Good profit potential' : '❌ Limited upside'}`);

if (avgShortMFE < avgLongMFE - 0.3) {
  console.log('⚠️  SHORT trades have less profit potential');
  console.log('   → Problem: Take profit too close OR market tends to reverse up\n');
} else {
  console.log('✅ Profit potential similar between LONG and SHORT\n');
}

// Analyze stop loss hits
const longSLHits = longTrades.filter(t => t.result === 'STOP_LOSS').length;
const shortSLHits = shortTrades.filter(t => t.result === 'STOP_LOSS').length;
const longSLRate = (longSLHits / longTrades.length * 100).toFixed(1);
const shortSLRate = (shortSLHits / shortTrades.length * 100).toFixed(1);

console.log('Stop Loss Hit Rate:');
console.log('─────────────────────────────────────────────────');
console.log(`LONG SL hits:  ${longSLHits}/${longTrades.length} (${longSLRate}%)`);
console.log(`SHORT SL hits: ${shortSLHits}/${shortTrades.length} (${shortSLRate}%)`);

if (parseFloat(shortSLRate) > parseFloat(longSLRate) + 10) {
  console.log('⚠️  SHORT trades hit stop loss much more frequently');
  console.log('   → Problem: Stop loss placement OR bearish OB quality\n');
} else {
  console.log('✅ Stop loss hit rate similar\n');
}

// Analyze by result type
console.log('Result Distribution:');
console.log('─────────────────────────────────────────────────');

const longResults = {
  TAKE_PROFIT: longTrades.filter(t => t.result === 'TAKE_PROFIT').length,
  STOP_LOSS: longTrades.filter(t => t.result === 'STOP_LOSS').length,
  EXPIRED: longTrades.filter(t => t.result === 'EXPIRED').length,
  TRAILING_STOP_WIN: longTrades.filter(t => t.result === 'TRAILING_STOP_WIN').length,
  BREAKEVEN: longTrades.filter(t => t.result === 'BREAKEVEN').length,
  INVALIDATED: longTrades.filter(t => t.result === 'INVALIDATED').length
};

const shortResults = {
  TAKE_PROFIT: shortTrades.filter(t => t.result === 'TAKE_PROFIT').length,
  STOP_LOSS: shortTrades.filter(t => t.result === 'STOP_LOSS').length,
  EXPIRED: shortTrades.filter(t => t.result === 'EXPIRED').length,
  TRAILING_STOP_WIN: shortTrades.filter(t => t.result === 'TRAILING_STOP_WIN').length,
  BREAKEVEN: shortTrades.filter(t => t.result === 'BREAKEVEN').length,
  INVALIDATED: shortTrades.filter(t => t.result === 'INVALIDATED').length
};

console.log('LONG trades:');
Object.entries(longResults).forEach(([result, count]) => {
  if (count > 0) {
    const pct = (count / longTrades.length * 100).toFixed(1);
    console.log(`  ${result}: ${count} (${pct}%)`);
  }
});

console.log('\nSHORT trades:');
Object.entries(shortResults).forEach(([result, count]) => {
  if (count > 0) {
    const pct = (count / shortTrades.length * 100).toFixed(1);
    console.log(`  ${result}: ${count} (${pct}%)`);
  }
});

// Sample losing SHORT trades
console.log('\n\n═══════════════════════════════════════════════════');
console.log('  SAMPLE LOSING SHORT TRADES');
console.log('═══════════════════════════════════════════════════\n');

const losingShorts = shortTrades.filter(t => t.pnlR < 0).slice(0, 5);

losingShorts.forEach((trade, i) => {
  console.log(`\nLosing SHORT #${i + 1}:`);
  console.log(`  Symbol: ${trade.symbol}`);
  console.log(`  Entry: ${trade.entry}`);
  console.log(`  Stop: ${trade.stopLoss}`);
  console.log(`  TP: ${trade.takeProfit}`);
  console.log(`  Result: ${trade.result}`);
  console.log(`  PnL: ${trade.pnlR}R`);
  console.log(`  MAE: ${trade.maxAdverseExcursion}R (how much it went against us)`);
  console.log(`  MFE: ${trade.maxFavorableExcursion}R (how much profit potential)`);

  if (trade.maxAdverseExcursion < -0.5) {
    console.log('  ⚠️  Entry too early (hit SL quickly)');
  }
  if (trade.maxFavorableExcursion > 0.5 && trade.pnlR < 0) {
    console.log('  ⚠️  Had profit but reversed (need better exit)');
  }
});

console.log('\n\n═══════════════════════════════════════════════════');
console.log('  KEY FINDINGS');
console.log('═══════════════════════════════════════════════════\n');

const findings = [];

if (avgShortMAE < avgLongMAE - 0.1) {
  findings.push('1. SHORT entries are worse quality (higher MAE)');
  findings.push('   → Fix: Review bearish OB detection / stop loss placement');
}

if (avgShortMFE < avgLongMFE - 0.3) {
  findings.push('2. SHORT trades have less profit potential (lower MFE)');
  findings.push('   → Fix: Adjust take profit targets for shorts');
}

if (parseFloat(shortSLRate) > parseFloat(longSLRate) + 10) {
  findings.push('3. SHORT trades hit stop loss much more often');
  findings.push('   → Fix: Widen stop loss OR improve entry timing');
}

if (findings.length === 0) {
  console.log('✅ No obvious mechanical issues found');
  console.log('   → Problem may be market bias (uptrend period in backtest data)');
} else {
  findings.forEach(f => console.log(f));
}

console.log('\n');
