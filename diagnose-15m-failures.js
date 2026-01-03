/**
 * Diagnose Why 15m Trades Are Failing
 * Deep dive into trade outcomes to find the root cause
 */

import fs from 'fs';

const resultsFile = './backtest-results/latest-backtest.json';

console.log('\n═══════════════════════════════════════════════════');
console.log('  15M FAILURE ANALYSIS');
console.log('  Root Cause Investigation');
console.log('═══════════════════════════════════════════════════\n');

if (!fs.existsSync(resultsFile)) {
  console.log('❌ No backtest results found.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));

// Collect all 15m trades
const all15mTrades = [];
for (const [mode, modeData] of Object.entries(data.results)) {
  if (modeData['15m']) {
    for (const [symbol, symbolData] of Object.entries(modeData['15m'])) {
      if (symbolData.trades && Array.isArray(symbolData.trades)) {
        symbolData.trades.forEach(trade => {
          all15mTrades.push({ ...trade, symbol, mode });
        });
      }
    }
  }
}

console.log(`Total 15m Trades: ${all15mTrades.length}\n`);

// Exit reason breakdown
const exitReasons = {};
all15mTrades.forEach(trade => {
  const reason = trade.result || 'UNKNOWN';
  exitReasons[reason] = (exitReasons[reason] || 0) + 1;
});

console.log('═══════════════════════════════════════════════════');
console.log('  EXIT REASONS');
console.log('═══════════════════════════════════════════════════\n');

Object.entries(exitReasons)
  .sort((a, b) => b[1] - a[1])
  .forEach(([reason, count]) => {
    const pct = (count / all15mTrades.length) * 100;
    const emoji = reason === 'TAKE_PROFIT' || reason === 'TRAILING_STOP' ? '✅' : '❌';
    console.log(`${emoji} ${reason.padEnd(20)} | ${count.toString().padStart(3)} trades (${pct.toFixed(1)}%)`);
  });

// Analyze MAE/MFE
console.log('\n═══════════════════════════════════════════════════');
console.log('  MAXIMUM ADVERSE/FAVORABLE EXCURSION');
console.log('═══════════════════════════════════════════════════\n');

const tradesWithMAE = all15mTrades.filter(t => t.maxAdverseExcursion !== undefined);
const tradesWithMFE = all15mTrades.filter(t => t.maxFavorableExcursion !== undefined);

if (tradesWithMAE.length > 0) {
  const avgMAE = tradesWithMAE.reduce((sum, t) => sum + t.maxAdverseExcursion, 0) / tradesWithMAE.length;
  const avgMFE = tradesWithMFE.reduce((sum, t) => sum + t.maxFavorableExcursion, 0) / tradesWithMFE.length;

  console.log(`Average MAE (worst drawdown): ${avgMAE.toFixed(3)}R`);
  console.log(`Average MFE (best profit):    ${avgMFE.toFixed(3)}R\n`);

  // Trades that went positive before stopping out
  const wentPositive = all15mTrades.filter(t =>
    (t.result === 'STOP_LOSS' || t.result === 'TIMEOUT') &&
    t.maxFavorableExcursion > 0.5
  );

  console.log(`⚠️  Trades that reached 0.5R+ profit but still lost: ${wentPositive.length} (${((wentPositive.length/all15mTrades.length)*100).toFixed(1)}%)`);

  if (wentPositive.length > 0) {
    const avgMFEofLosers = wentPositive.reduce((sum, t) => sum + t.maxFavorableExcursion, 0) / wentPositive.length;
    console.log(`    Average MFE of these trades: ${avgMFEofLosers.toFixed(2)}R`);
    console.log(`    → These trades reached profit but reversed!\n`);
  }
}

// Analyze by risk/reward ratio
console.log('═══════════════════════════════════════════════════');
console.log('  RISK:REWARD RATIO ANALYSIS');
console.log('═══════════════════════════════════════════════════\n');

const rrBuckets = {
  '1.0-1.5': { wins: 0, losses: 0, trades: [] },
  '1.5-2.0': { wins: 0, losses: 0, trades: [] },
  '2.0-2.5': { wins: 0, losses: 0, trades: [] },
  '2.5+': { wins: 0, losses: 0, trades: [] }
};

all15mTrades.forEach(trade => {
  const rr = trade.signal?.riskReward || 0;
  const isWin = trade.result === 'TAKE_PROFIT' || trade.result === 'TRAILING_STOP';

  let bucket;
  if (rr < 1.5) bucket = '1.0-1.5';
  else if (rr < 2.0) bucket = '1.5-2.0';
  else if (rr < 2.5) bucket = '2.0-2.5';
  else bucket = '2.5+';

  if (rrBuckets[bucket]) {
    if (isWin) rrBuckets[bucket].wins++;
    else rrBuckets[bucket].losses++;
    rrBuckets[bucket].trades.push(trade);
  }
});

Object.entries(rrBuckets).forEach(([bucket, stats]) => {
  const total = stats.wins + stats.losses;
  if (total > 0) {
    const wr = (stats.wins / total) * 100;
    console.log(`R:R ${bucket.padEnd(10)} | ${total.toString().padStart(3)} trades | ${wr.toFixed(1)}% WR`);
  }
});

// Check if stops are too tight
console.log('\n═══════════════════════════════════════════════════');
console.log('  STOP LOSS DISTANCE ANALYSIS');
console.log('═══════════════════════════════════════════════════\n');

const stopDistances = all15mTrades
  .filter(t => t.signal?.riskRewardBreakdown?.stopLossDistance)
  .map(t => parseFloat(t.signal.riskRewardBreakdown.stopLossDistance));

if (stopDistances.length > 0) {
  const avgStopDist = stopDistances.reduce((a, b) => a + b, 0) / stopDistances.length;
  const minStopDist = Math.min(...stopDistances);
  const maxStopDist = Math.max(...stopDistances);

  console.log(`Average stop loss distance: ${avgStopDist.toFixed(2)}%`);
  console.log(`Min/Max: ${minStopDist.toFixed(2)}% / ${maxStopDist.toFixed(2)}%\n`);

  // Categorize by stop distance
  const stopBuckets = {
    'Tight (0-1%)': all15mTrades.filter(t => {
      const dist = parseFloat(t.signal?.riskRewardBreakdown?.stopLossDistance || 0);
      return dist < 1;
    }),
    'Normal (1-2%)': all15mTrades.filter(t => {
      const dist = parseFloat(t.signal?.riskRewardBreakdown?.stopLossDistance || 0);
      return dist >= 1 && dist < 2;
    }),
    'Wide (2%+)': all15mTrades.filter(t => {
      const dist = parseFloat(t.signal?.riskRewardBreakdown?.stopLossDistance || 0);
      return dist >= 2;
    })
  };

  Object.entries(stopBuckets).forEach(([bucket, trades]) => {
    if (trades.length > 0) {
      const wins = trades.filter(t => t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP').length;
      const wr = (wins / trades.length) * 100;
      console.log(`${bucket.padEnd(20)} | ${trades.length.toString().padStart(3)} trades | ${wr.toFixed(1)}% WR`);
    }
  });
}

// Sample winning trades
console.log('\n═══════════════════════════════════════════════════');
console.log('  SAMPLE WINNING TRADES (What Worked)');
console.log('═══════════════════════════════════════════════════\n');

const winners = all15mTrades.filter(t => t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP');
winners.slice(0, 3).forEach((trade, i) => {
  console.log(`Winner #${i + 1}:`);
  console.log(`  Symbol: ${trade.symbol}`);
  console.log(`  Direction: ${trade.direction || trade.type}`);
  console.log(`  Patterns: ${trade.signal?.patterns?.join(', ') || 'N/A'}`);
  console.log(`  Confluence: ${trade.signal?.confluenceScore || 'N/A'}`);
  console.log(`  R:R: ${trade.signal?.riskReward || 'N/A'}`);
  console.log(`  HTF Consensus: ${trade.mtfConsensus || trade.signal?.mtfConsensus || 'N/A'}`);
  console.log(`  PnL: ${trade.pnlR?.toFixed(2) || 'N/A'}R`);
  console.log(`  MFE: ${trade.maxFavorableExcursion?.toFixed(2) || 'N/A'}R`);
  console.log(`  MAE: ${trade.maxAdverseExcursion?.toFixed(2) || 'N/A'}R\n`);
});

// Recommendations
console.log('═══════════════════════════════════════════════════');
console.log('  ROOT CAUSE & RECOMMENDATIONS');
console.log('═══════════════════════════════════════════════════\n');

const slRate = (exitReasons['STOP_LOSS'] || 0) / all15mTrades.length * 100;
const tpRate = (exitReasons['TAKE_PROFIT'] || 0) / all15mTrades.length * 100;

if (slRate > 50) {
  console.log('❌ PRIMARY ISSUE: Stop Loss Hit Rate Too High');
  console.log(`   ${slRate.toFixed(1)}% of trades hit stop loss`);
  console.log('   → Stops may be too tight for 15m volatility');
  console.log('   → Consider: 1.5x wider stops or different placement\n');
}

if (tradesWithMAE.length > 0) {
  const avgMAE = tradesWithMAE.reduce((sum, t) => sum + t.maxAdverseExcursion, 0) / tradesWithMAE.length;
  if (avgMAE < -0.5) {
    console.log('❌ SECONDARY ISSUE: Poor Entry Timing');
    console.log(`   Average MAE: ${avgMAE.toFixed(2)}R (going against us immediately)`);
    console.log('   → Entries happening too early (before confirmation)');
    console.log('   → Consider: Wait for rejection patterns or breakout confirmation\n');
  }
}

const wentPositiveLosses = all15mTrades.filter(t =>
  (t.result === 'STOP_LOSS' || t.result === 'TIMEOUT') &&
  t.maxFavorableExcursion > 0.5
).length;

if (wentPositiveLosses > all15mTrades.length * 0.1) {
  console.log('⚠️  OPPORTUNITY: Many Trades Reached Profit Then Reversed');
  console.log(`   ${wentPositiveLosses} trades (${((wentPositiveLosses/all15mTrades.length)*100).toFixed(1)}%) went positive but still lost`);
  console.log('   → Consider: Partial profit taking at 0.5R');
  console.log('   → Consider: Move stop to breakeven after 0.5R profit');
  console.log('   → Consider: Trailing stops\n');
}

console.log('💡 RECOMMENDATIONS FOR ELITE MODE:');
console.log('   1. Widen stop losses by 1.5x for 15m volatility');
console.log('   2. Require rejection pattern confirmation before entry');
console.log('   3. Implement breakeven stop at 0.5R profit');
console.log('   4. Use partial profit taking at 1R');
console.log('   5. Only trade during strong HTF trend (not neutral)');
console.log('   6. Require multiple pattern confluence (3+ patterns)');

console.log('\n═══════════════════════════════════════════════════\n');
