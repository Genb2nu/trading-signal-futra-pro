import { backtestSymbol, calculateMetrics, analyzeFailures } from './src/services/backtestEngine.js';

console.log('='.repeat(80));
console.log('COMPREHENSIVE PERFORMANCE ANALYSIS');
console.log('='.repeat(80));

const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];
const timeframes = ['15m', '1h', '4h'];

const allResults = [];

for (const symbol of symbols) {
  for (const timeframe of timeframes) {
    try {
      const result = await backtestSymbol(symbol, timeframe, 1000, 100);
      const metrics = calculateMetrics(result.trades);

      if (result.trades.length > 0) {
        allResults.push({
          symbol,
          timeframe,
          trades: result.trades,
          metrics
        });

        console.log(`\n${symbol} ${timeframe}:`);
        console.log(`  Trades: ${metrics.totalTrades}`);
        console.log(`  Win Rate: ${metrics.winRate}%`);
        console.log(`  Avg R: ${metrics.avgR}R`);
        console.log(`  Profit Factor: ${metrics.profitFactor}`);
        console.log(`  Expectancy: ${metrics.expectancy}R`);
      }
    } catch (error) {
      console.error(`Error with ${symbol} ${timeframe}:`, error.message);
    }
  }
}

// Aggregate analysis
console.log('\n' + '='.repeat(80));
console.log('AGGREGATE ANALYSIS');
console.log('='.repeat(80));

const allTrades = allResults.flatMap(r => r.trades);
const aggregateMetrics = calculateMetrics(allTrades);

console.log(`\nTotal Trades: ${aggregateMetrics.totalTrades}`);
console.log(`Overall Win Rate: ${aggregateMetrics.winRate}%`);
console.log(`Overall Avg R: ${aggregateMetrics.avgR}R`);
console.log(`Overall Profit Factor: ${aggregateMetrics.profitFactor}`);
console.log(`Overall Expectancy: ${aggregateMetrics.expectancy}R`);
console.log(`Max Drawdown: ${aggregateMetrics.maxDrawdown}R`);

// Analyze failures
console.log('\n' + '='.repeat(80));
console.log('FAILURE ANALYSIS');
console.log('='.repeat(80));

const failures = analyzeFailures(allTrades);

console.log('\nStop Loss Hits:');
console.log(`  Total: ${failures.stopLossCount}`);
console.log(`  Percentage: ${failures.stopLossRate}%`);

console.log('\nInvalidations:');
console.log(`  Total: ${failures.invalidationCount}`);
console.log(`  Percentage: ${failures.invalidationRate}%`);

console.log('\nExpired Trades:');
console.log(`  Total: ${failures.expiredCount}`);
console.log(`  Percentage: ${failures.expiredRate}%`);

// Identify problematic patterns
console.log('\n' + '='.repeat(80));
console.log('PROBLEMATIC PATTERNS');
console.log('='.repeat(80));

const losses = allTrades.filter(t => t.pnlR < 0);
const wins = allTrades.filter(t => t.pnlR > 0);

console.log(`\nLosing Trades: ${losses.length}`);
console.log(`Winning Trades: ${wins.length}`);

// Analyze losing trades
if (losses.length > 0) {
  const avgLossR = losses.reduce((sum, t) => sum + t.pnlR, 0) / losses.length;
  const avgLossMAE = losses.reduce((sum, t) => sum + (t.mae || 0), 0) / losses.length;

  console.log(`\nLosing Trade Statistics:`);
  console.log(`  Average Loss: ${avgLossR.toFixed(2)}R`);
  console.log(`  Average MAE: ${avgLossMAE.toFixed(2)}%`);

  // Check if losses had good MFE (should have been profitable)
  const missedWins = losses.filter(t => (t.mfe || 0) > 1.0);
  console.log(`  Missed Winners (MFE >1R): ${missedWins.length} (${(missedWins.length/losses.length*100).toFixed(1)}%)`);
}

// Analyze winning trades
if (wins.length > 0) {
  const avgWinR = wins.reduce((sum, t) => sum + t.pnlR, 0) / wins.length;
  const avgWinMAE = wins.reduce((sum, t) => sum + (t.mae || 0), 0) / wins.length;

  console.log(`\nWinning Trade Statistics:`);
  console.log(`  Average Win: ${avgWinR.toFixed(2)}R`);
  console.log(`  Average MAE: ${avgWinMAE.toFixed(2)}%`);
}

// Key insights
console.log('\n' + '='.repeat(80));
console.log('KEY INSIGHTS & RECOMMENDATIONS');
console.log('='.repeat(80));

if (aggregateMetrics.winRate < 50) {
  console.log('\n⚠️  LOW WIN RATE (<50%):');
  console.log('  - Consider stricter entry filters');
  console.log('  - Require stronger confluence');
  console.log('  - Add HTF alignment requirement');
}

if (aggregateMetrics.profitFactor < 1.5) {
  console.log('\n⚠️  LOW PROFIT FACTOR (<1.5):');
  console.log('  - Improve stop loss placement');
  console.log('  - Use wider ATR multipliers');
  console.log('  - Filter low R:R trades');
}

if (losses.length > 0) {
  const missedWinRate = losses.filter(t => (t.mfe || 0) > 1.0).length / losses.length;
  if (missedWinRate > 0.3) {
    console.log('\n⚠️  MANY MISSED WINNERS (>30% of losses had good MFE):');
    console.log('  - Implement trailing stop loss');
    console.log('  - Consider partial profit taking');
    console.log('  - Review break-even activation');
  }
}

if (aggregateMetrics.maxDrawdown > 5) {
  console.log('\n⚠️  HIGH MAX DRAWDOWN (>5R):');
  console.log('  - Reduce position sizing');
  console.log('  - Add correlation filters');
  console.log('  - Limit concurrent trades');
}

console.log('\n' + '='.repeat(80));
console.log('ANALYSIS COMPLETE');
console.log('='.repeat(80));
