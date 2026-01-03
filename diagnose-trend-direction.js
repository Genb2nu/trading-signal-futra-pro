/**
 * Diagnostic: Analyze if counter-trend trades are winners or losers
 */

import fs from 'fs';
import path from 'path';

const latestResultsPath = './backtest-results/latest-backtest.json';

if (!fs.existsSync(latestResultsPath)) {
  console.error('No backtest results found!');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(latestResultsPath, 'utf8'));

console.log('═══════════════════════════════════════════════════');
console.log('  TREND DIRECTION ANALYSIS');
console.log('  Analyzing if counter-trend trades were winners or losers');
console.log('═══════════════════════════════════════════════════\n');

// Extract all trades from the nested structure
const allTrades = [];

for (const mode of Object.keys(data.results)) {
  for (const timeframe of Object.keys(data.results[mode])) {
    for (const symbol of Object.keys(data.results[mode][timeframe])) {
      const symbolData = data.results[mode][timeframe][symbol];
      if (symbolData.trades && symbolData.trades.length > 0) {
        symbolData.trades.forEach(trade => {
          allTrades.push({
            ...trade,
            mode,
            timeframe,
            symbol
          });
        });
      }
    }
  }
}

console.log(`📊 Total trades analyzed: ${allTrades.length}\n`);

// Analyze trend alignment
const trendAligned = allTrades.filter(t => {
  if (!t.htfTrend) return false;
  if (t.direction === 'BUY' && t.htfTrend === 'bullish') return true;
  if (t.direction === 'SELL' && t.htfTrend === 'bearish') return true;
  return false;
});

const counterTrend = allTrades.filter(t => {
  if (!t.htfTrend) return false;
  if (t.direction === 'BUY' && t.htfTrend === 'bearish') return true;
  if (t.direction === 'SELL' && t.htfTrend === 'bullish') return true;
  return false;
});

const neutralTrend = allTrades.filter(t => {
  return !t.htfTrend || t.htfTrend === 'neutral';
});

console.log('Trend Alignment Breakdown:');
console.log('─────────────────────────────────────────────────');
console.log(`With-Trend Trades:     ${trendAligned.length} (${(trendAligned.length / allTrades.length * 100).toFixed(1)}%)`);
console.log(`Counter-Trend Trades:  ${counterTrend.length} (${(counterTrend.length / allTrades.length * 100).toFixed(1)}%)`);
console.log(`Neutral Trend Trades:  ${neutralTrend.length} (${(neutralTrend.length / allTrades.length * 100).toFixed(1)}%)\n`);

// Analyze performance by trend alignment
function analyzeGroup(trades, label) {
  if (trades.length === 0) {
    console.log(`${label}: No trades`);
    return;
  }

  const wins = trades.filter(t =>
    t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP_WIN' || t.result === 'BREAKEVEN'
  ).length;
  const losses = trades.filter(t => t.result === 'STOP_LOSS').length;
  const winRate = (wins / trades.length * 100).toFixed(1);

  const totalPnlR = trades.reduce((sum, t) => sum + t.pnlR, 0);
  const avgR = (totalPnlR / trades.length).toFixed(2);

  const grossProfit = trades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
  const grossLoss = Math.abs(trades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? '999.00' : '0.00');

  const status = parseFloat(profitFactor) >= 1.5 ? '✅' :
                 parseFloat(profitFactor) >= 1.0 ? '⚠️' : '❌';

  console.log(`${label}:`);
  console.log(`  Trades: ${trades.length} | WR: ${winRate}% | PF: ${profitFactor} ${status} | Avg R: ${avgR}R | Total: ${totalPnlR.toFixed(2)}R`);
}

console.log('Performance by Trend Alignment:');
console.log('─────────────────────────────────────────────────');
analyzeGroup(trendAligned, 'WITH-TREND      ');
analyzeGroup(counterTrend, 'COUNTER-TREND   ');
analyzeGroup(neutralTrend, 'NEUTRAL TREND   ');

console.log('\n');
console.log('Key Insights:');
console.log('─────────────────────────────────────────────────');

if (counterTrend.length === 0) {
  console.log('✅ No counter-trend trades (strict trend-following working!)');
} else {
  console.log(`❌ Found ${counterTrend.length} counter-trend trades (trend filter NOT working!)`);
}

// Check if counter-trend trades were winners or losers
if (counterTrend.length > 0) {
  const counterTrendWins = counterTrend.filter(t =>
    t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP_WIN' || t.result === 'BREAKEVEN'
  );
  const counterTrendWR = (counterTrendWins.length / counterTrend.length * 100).toFixed(1);
  const counterTrendPnl = counterTrend.reduce((sum, t) => sum + t.pnlR, 0).toFixed(2);

  if (parseFloat(counterTrendWR) > 50) {
    console.log(`⚠️  Counter-trend trades have ${counterTrendWR}% WR (PROFITABLE!)`);
    console.log('   → Blocking them would HURT performance (reversals are profitable)');
  } else {
    console.log(`✅ Counter-trend trades have ${counterTrendWR}% WR (UNPROFITABLE!)`);
    console.log('   → Blocking them would HELP performance');
  }
}

// Analyze by direction
const buyTrades = allTrades.filter(t => t.direction === 'BUY');
const sellTrades = allTrades.filter(t => t.direction === 'SELL');

console.log('\n');
console.log('Performance by Direction:');
console.log('─────────────────────────────────────────────────');
analyzeGroup(buyTrades, 'BUY (Long)  ');
analyzeGroup(sellTrades, 'SELL (Short)');

const buyWR = buyTrades.length > 0 ? (buyTrades.filter(t => t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP_WIN' || t.result === 'BREAKEVEN').length / buyTrades.length * 100).toFixed(1) : 0;
const sellWR = sellTrades.length > 0 ? (sellTrades.filter(t => t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP_WIN' || t.result === 'BREAKEVEN').length / sellTrades.length * 100).toFixed(1) : 0;

const bias = Math.abs(buyTrades.length - sellTrades.length);
if (bias > allTrades.length * 0.3) {
  console.log(`\n⚠️  Directional bias detected: ${buyTrades.length} longs vs ${sellTrades.length} shorts`);
} else {
  console.log(`\n✅ No significant directional bias (${buyTrades.length} longs vs ${sellTrades.length} shorts)`);
}

console.log('\n');
