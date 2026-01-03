/**
 * Analyze why trades are losing - check entry quality and stop loss hits
 */

import { backtestSymbol } from './src/services/backtestEngine.js';
import { setStrategyMode } from './src/shared/strategyConfig.js';

async function diagnoseTradeFailures() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  DIAGNOSTIC: Trade Failure Analysis');
  console.log('═══════════════════════════════════════════════════\n');

  setStrategyMode('aggressive'); // Most trades

  const result = await backtestSymbol('BTCUSDT', '15m', 1000, 100);

  console.log(`Total Trades: ${result.trades.length}\n`);

  if (result.trades.length === 0) {
    console.log('No trades to analyze!');
    return;
  }

  // Analyze trade outcomes
  const outcomes = {};
  result.trades.forEach(t => {
    outcomes[t.result] = (outcomes[t.result] || 0) + 1;
  });

  console.log('Trade Outcomes:');
  Object.entries(outcomes).forEach(([outcome, count]) => {
    const pct = ((count / result.trades.length) * 100).toFixed(1);
    console.log(`  ${outcome}: ${count} (${pct}%)`);
  });

  // Analyze MAE (Maximum Adverse Excursion)
  const maes = result.trades.map(t => t.maxAdverseExcursion).filter(mae => mae !== undefined);
  const avgMAE = maes.length > 0 ? (maes.reduce((a, b) => a + b, 0) / maes.length).toFixed(2) : 0;
  const worstMAE = maes.length > 0 ? Math.min(...maes).toFixed(2) : 0;

  console.log(`\nMaximum Adverse Excursion (MAE):`);
  console.log(`  Average MAE: ${avgMAE}R`);
  console.log(`  Worst MAE: ${worstMAE}R`);

  if (parseFloat(avgMAE) < -0.8) {
    console.log('  ⚠️  Entries are immediately going against us! Stop loss too tight or bad entries.');
  }

  // Analyze MFE (Maximum Favorable Excursion)
  const mfes = result.trades.map(t => t.maxFavorableExcursion).filter(mfe => mfe !== undefined);
  const avgMFE = mfes.length > 0 ? (mfes.reduce((a, b) => a + b, 0) / mfes.length).toFixed(2) : 0;
  const bestMFE = mfes.length > 0 ? Math.max(...mfes).toFixed(2) : 0;

  console.log(`\nMaximum Favorable Excursion (MFE):`);
  console.log(`  Average MFE: ${avgMFE}R`);
  console.log(`  Best MFE: ${bestMFE}R`);

  // Analyze losers that went positive first
  const losers = result.trades.filter(t => t.result === 'STOP_LOSS' && t.pnlR < 0);
  const losersWithProfit = losers.filter(t => t.maxFavorableExcursion > 0.5);

  console.log(`\nLosers that reached +0.5R first:`);
  console.log(`  Count: ${losersWithProfit.length} of ${losers.length} losers`);
  console.log(`  Percentage: ${losers.length > 0 ? ((losersWithProfit.length / losers.length) * 100).toFixed(1) : 0}%`);

  if (losersWithProfit.length > 0) {
    console.log('  ⚠️  Trades are going profitable but reversing - need better exit management!');
  }

  // Check bars in trade
  const avgBarsInTrade = result.trades.length > 0
    ? (result.trades.reduce((sum, t) => sum + t.barsInTrade, 0) / result.trades.length).toFixed(1)
    : 0;

  console.log(`\nTrade Duration:`);
  console.log(`  Average bars in trade: ${avgBarsInTrade}`);

  // Sample losing trades
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log('Sample Losing Trades:');
  console.log(`═══════════════════════════════════════════════════\n`);

  const sampleLosers = losers.slice(0, 3);
  sampleLosers.forEach((trade, i) => {
    console.log(`Loss ${i + 1}:`);
    console.log(`  Entry: ${trade.entry.toFixed(2)}`);
    console.log(`  Stop: ${trade.stopLoss.toFixed(2)} | TP: ${trade.takeProfit.toFixed(2)}`);
    console.log(`  Type: ${trade.type}`);
    console.log(`  PnL: ${trade.pnlR.toFixed(2)}R`);
    console.log(`  MAE: ${trade.maxAdverseExcursion.toFixed(2)}R | MFE: ${trade.maxFavorableExcursion.toFixed(2)}R`);
    console.log(`  Bars: ${trade.barsInTrade}`);
    console.log(`  Confluence: ${trade.signal.confluenceScore}`);
    console.log('');
  });

  // Analyze by R:R ratio
  const avgRR = result.trades.length > 0
    ? (result.trades.reduce((sum, t) => sum + parseFloat(t.signal.riskReward), 0) / result.trades.length).toFixed(2)
    : 0;

  console.log(`Average R:R Ratio: ${avgRR}`);

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log('KEY FINDINGS:');
  console.log(`═══════════════════════════════════════════════════\n`);

  if (parseFloat(avgMAE) < -0.7) {
    console.log('❌ PROBLEM: Entries going immediately against us');
    console.log('   FIX: Entries are too early or at wrong price levels');
  }

  if (losersWithProfit.length > losers.length * 0.3) {
    console.log('❌ PROBLEM: Many losses went profitable first');
    console.log('   FIX: Trailing stop is working but trades reversing');
  }

  if (parseFloat(avgRR) < 1.5) {
    console.log('❌ PROBLEM: R:R ratio too low');
    console.log('   FIX: Take profits are too close or stops too wide');
  }

  const winRate = (outcomes['TAKE_PROFIT'] || 0) + (outcomes['TRAILING_STOP_WIN'] || 0) + (outcomes['BREAKEVEN'] || 0);
  const winRatePct = ((winRate / result.trades.length) * 100).toFixed(1);

  console.log(`\nCurrent Win Rate: ${winRatePct}%`);
  console.log(`Target Win Rate: 40-50%\n`);
}

diagnoseTradeFailures().catch(console.error);
