/**
 * Interactive Tracking System Demo
 * Shows how to track signals in real-time
 */

import {
  trackNewSignal,
  updateSignalOutcome,
  getStats,
  getPerformanceReport
} from './src/services/signalTracker.js';

console.log('\n' + '='.repeat(80));
console.log('  SIGNAL TRACKING SYSTEM - INTERACTIVE DEMO');
console.log('='.repeat(80));

async function runDemo() {
  console.log('\n📚 This demo simulates tracking 5 signals with different outcomes.');
  console.log('In real use, signals are tracked automatically when generated.\n');

  await sleep(2000);

  // ============= DEMO SIGNAL 1: WIN =============
  console.log('\n' + '─'.repeat(80));
  console.log('📊 SIGNAL #1: Tracking a new BUY signal for BTCUSDT');
  console.log('─'.repeat(80));

  const signal1 = {
    symbol: 'BTCUSDT',
    type: 'BUY',
    direction: 'bullish',
    entry: 87300,
    stopLoss: 84476,
    takeProfit: 92947,
    riskReward: 2.0,
    confidence: 'premium',
    confluenceScore: 110,
    patterns: ['FVG', 'Order Block', 'HTF OB Alignment'],
    timestamp: new Date().toISOString()
  };

  console.log(`\n✍️  Signal Details:`);
  console.log(`   Symbol: ${signal1.symbol}`);
  console.log(`   Entry: $${signal1.entry}`);
  console.log(`   Stop Loss: $${signal1.stopLoss}`);
  console.log(`   Take Profit: $${signal1.takeProfit}`);
  console.log(`   Risk/Reward: ${signal1.riskReward}R`);
  console.log(`   Confluence: ${signal1.confluenceScore} points (HTF aligned! ⭐)`);

  const id1 = await trackNewSignal(signal1);
  console.log(`\n✅ Signal tracked with ID: ${id1}`);

  await sleep(2000);

  console.log('\n⏳ Waiting for trade to complete...');
  await sleep(2000);

  console.log('\n🎯 Trade Update: Price hit TAKE PROFIT!');
  await updateSignalOutcome(id1, {
    result: 'WIN',
    pnlR: 2.0,
    notes: 'Clean TP hit, exactly as planned'
  });

  console.log('✅ Outcome recorded: +2.0R profit');

  await sleep(3000);

  // ============= DEMO SIGNAL 2: WIN =============
  console.log('\n' + '─'.repeat(80));
  console.log('📊 SIGNAL #2: Tracking a SELL signal for ETHUSDT');
  console.log('─'.repeat(80));

  const signal2 = {
    symbol: 'ETHUSDT',
    type: 'SELL',
    direction: 'bearish',
    entry: 3250,
    stopLoss: 3340,
    takeProfit: 3070,
    riskReward: 2.0,
    confidence: 'high',
    confluenceScore: 95,
    patterns: ['FVG', 'Liquidity Sweep', 'BOS'],
    timestamp: new Date().toISOString()
  };

  console.log(`\n✍️  Signal Details:`);
  console.log(`   Symbol: ${signal2.symbol}`);
  console.log(`   Entry: $${signal2.entry}`);
  console.log(`   Confluence: ${signal2.confluenceScore} points`);

  const id2 = await trackNewSignal(signal2);
  await sleep(2000);

  console.log('\n🎯 Trade Update: Price hit TAKE PROFIT!');
  await updateSignalOutcome(id2, {
    result: 'WIN',
    pnlR: 2.0,
    notes: 'Strong bearish momentum, TP easily reached'
  });

  console.log('✅ Outcome recorded: +2.0R profit');

  await sleep(3000);

  // ============= DEMO SIGNAL 3: LOSS =============
  console.log('\n' + '─'.repeat(80));
  console.log('📊 SIGNAL #3: Tracking a BUY signal for BNBUSDT');
  console.log('─'.repeat(80));

  const signal3 = {
    symbol: 'BNBUSDT',
    type: 'BUY',
    direction: 'bullish',
    entry: 612,
    stopLoss: 600,
    takeProfit: 636,
    riskReward: 2.0,
    confidence: 'standard',
    confluenceScore: 75,
    patterns: ['Order Block', 'Valid Zone'],
    timestamp: new Date().toISOString()
  };

  console.log(`\n✍️  Signal Details:`);
  console.log(`   Symbol: ${signal3.symbol}`);
  console.log(`   Entry: $${signal3.entry}`);
  console.log(`   Confluence: ${signal3.confluenceScore} points (No HTF alignment)`);

  const id3 = await trackNewSignal(signal3);
  await sleep(2000);

  console.log('\n❌ Trade Update: Price hit STOP LOSS');
  await updateSignalOutcome(id3, {
    result: 'LOSS',
    pnlR: -1.0,
    notes: 'Market moved against us, SL hit'
  });

  console.log('✅ Outcome recorded: -1.0R loss');

  await sleep(3000);

  // ============= DEMO SIGNAL 4: WIN =============
  console.log('\n' + '─'.repeat(80));
  console.log('📊 SIGNAL #4: Tracking a BUY signal for SOLUSDT');
  console.log('─'.repeat(80));

  const signal4 = {
    symbol: 'SOLUSDT',
    type: 'BUY',
    direction: 'bullish',
    entry: 198,
    stopLoss: 192,
    takeProfit: 210,
    riskReward: 2.0,
    confidence: 'premium',
    confluenceScore: 125,
    patterns: ['FVG', 'Order Block', 'HTF OB', 'HTF FVG', 'HTF Zone'],
    timestamp: new Date().toISOString()
  };

  console.log(`\n✍️  Signal Details:`);
  console.log(`   Symbol: ${signal4.symbol}`);
  console.log(`   Entry: $${signal4.entry}`);
  console.log(`   Confluence: ${signal4.confluenceScore} points (MAXIMUM HTF confluence! 🌟)`);

  const id4 = await trackNewSignal(signal4);
  await sleep(2000);

  console.log('\n🎯 Trade Update: Price hit TAKE PROFIT!');
  await updateSignalOutcome(id4, {
    result: 'WIN',
    pnlR: 2.0,
    notes: 'Perfect HTF alignment, strong winner'
  });

  console.log('✅ Outcome recorded: +2.0R profit');

  await sleep(3000);

  // ============= DEMO SIGNAL 5: WIN =============
  console.log('\n' + '─'.repeat(80));
  console.log('📊 SIGNAL #5: Tracking a SELL signal for ADAUSDT');
  console.log('─'.repeat(80));

  const signal5 = {
    symbol: 'ADAUSDT',
    type: 'SELL',
    direction: 'bearish',
    entry: 0.95,
    stopLoss: 0.975,
    takeProfit: 0.90,
    riskReward: 2.0,
    confidence: 'premium',
    confluenceScore: 115,
    patterns: ['FVG', 'Breaker Block', 'HTF Structure'],
    timestamp: new Date().toISOString()
  };

  console.log(`\n✍️  Signal Details:`);
  console.log(`   Symbol: ${signal5.symbol}`);
  console.log(`   Entry: $${signal5.entry}`);
  console.log(`   Confluence: ${signal5.confluenceScore} points (HTF aligned! ⭐)`);

  const id5 = await trackNewSignal(signal5);
  await sleep(2000);

  console.log('\n🎯 Trade Update: Price hit TAKE PROFIT!');
  await updateSignalOutcome(id5, {
    result: 'WIN',
    pnlR: 2.0,
    notes: 'HTF structure alignment confirmed, clean winner'
  });

  console.log('✅ Outcome recorded: +2.0R profit');

  await sleep(3000);

  // ============= SHOW FINAL STATS =============
  console.log('\n' + '='.repeat(80));
  console.log('  DEMO COMPLETE - FINAL STATISTICS');
  console.log('='.repeat(80));

  const stats = await getStats();

  console.log(`\n📊 PERFORMANCE SUMMARY:`);
  console.log(`   Total Signals: ${stats.totalSignals}`);
  console.log(`   Closed: ${stats.closedSignals} | Active: ${stats.activeSignals}`);
  console.log(`   Winners: ${stats.wins} | Losers: ${stats.losses}`);
  console.log(`   Win Rate: ${stats.winRate}% 🎯`);
  console.log(`   Profit Factor: ${stats.profitFactor}`);
  console.log(`   Expectancy: ${stats.expectancy}R per trade`);
  console.log(`   Net Profit: ${stats.netProfitR}R`);

  console.log(`\n📈 COMPARISON TO BASELINE:`);
  const baselineWR = 78.1;
  const wrDiff = stats.winRate - baselineWR;
  console.log(`   Baseline Win Rate: ${baselineWR}%`);
  console.log(`   Current Win Rate: ${stats.winRate}%`);
  console.log(`   Improvement: ${wrDiff >= 0 ? '+' : ''}${wrDiff.toFixed(1)}% ${wrDiff >= 5 ? '🟢 EXCELLENT!' : wrDiff >= 0 ? '🟡 GOOD' : '🔴'}`);

  console.log(`\n💡 KEY INSIGHTS:`);
  console.log(`   - ${stats.wins} of ${stats.closedSignals} trades were winners (${stats.winRate}%)`);
  console.log(`   - Average profit per trade: ${stats.expectancy}R`);
  console.log(`   - Total profit: ${stats.netProfitR}R from ${stats.closedSignals} trades`);

  // Analyze HTF correlation
  console.log(`\n🔍 HTF ALIGNMENT ANALYSIS:`);
  console.log(`   Signal #1 (BTCUSDT): 110 pts → WIN ✅`);
  console.log(`   Signal #2 (ETHUSDT): 95 pts → WIN ✅`);
  console.log(`   Signal #3 (BNBUSDT): 75 pts → LOSS ❌`);
  console.log(`   Signal #4 (SOLUSDT): 125 pts → WIN ✅ (MAXIMUM HTF!)`);
  console.log(`   Signal #5 (ADAUSDT): 115 pts → WIN ✅`);
  console.log(`\n   Notice: Higher confluence scores = Better outcomes!`);
  console.log(`   Signals with HTF alignment (>100): 3 of 5 = 100% win rate!`);
  console.log(`   Signal without HTF (<100): 1 of 2 = 0% win rate`);

  console.log('\n' + '='.repeat(80));
  console.log('  HOW TO USE IN REAL TRADING');
  console.log('='.repeat(80));

  console.log(`\n1️⃣  VIEW STATISTICS:`);
  console.log(`   node signal-tracker-cli.js stats`);

  console.log(`\n2️⃣  CLOSE A SIGNAL (when your trade completes):`);
  console.log(`   node signal-tracker-cli.js close SIGNALID WIN 2.0`);
  console.log(`   node signal-tracker-cli.js close SIGNALID LOSS -1.0`);

  console.log(`\n3️⃣  VIEW PERFORMANCE REPORT:`);
  console.log(`   node signal-tracker-cli.js report`);

  console.log(`\n4️⃣  LIST ALL SIGNALS:`);
  console.log(`   node signal-tracker-cli.js list ACTIVE`);
  console.log(`   node signal-tracker-cli.js list CLOSED`);

  console.log(`\n5️⃣  EXPORT TO CSV:`);
  console.log(`   node signal-tracker-cli.js export`);

  console.log('\n' + '='.repeat(80));
  console.log('  NEXT STEPS');
  console.log('='.repeat(80));

  console.log(`\n✅ Demo data has been added to your tracking system.`);
  console.log(`✅ You can now run: node signal-tracker-cli.js stats`);
  console.log(`\n🎯 To reset and start fresh:`);
  console.log(`   node signal-tracker-cli.js reset CONFIRM`);
  console.log(`\n🚀 To start tracking real signals:`);
  console.log(`   1. Visit http://localhost:5173/`);
  console.log(`   2. Wait for signals to generate`);
  console.log(`   3. Note the signal IDs`);
  console.log(`   4. Track outcomes as trades close`);

  console.log('\n' + '='.repeat(80) + '\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runDemo().catch(error => {
  console.error('Demo error:', error);
  process.exit(1);
});
