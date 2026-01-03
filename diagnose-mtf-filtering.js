/**
 * Diagnose Multi-Timeframe Filtering
 * Verify that 15m trades respect 1h+4h trend consensus
 */

import fs from 'fs';

const resultsFile = './backtest-results/latest-backtest.json';

console.log('\n═══════════════════════════════════════════════════');
console.log('  MULTI-TIMEFRAME FILTERING DIAGNOSTIC');
console.log('═══════════════════════════════════════════════════\n');

// Read latest backtest results
if (!fs.existsSync(resultsFile)) {
  console.log('❌ No backtest results found. Run backtest first.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));

// Check if results exist
if (!data.results) {
  console.log('❌ No results found in backtest file.');
  process.exit(1);
}

// Analyze each mode
for (const [mode, modeData] of Object.entries(data.results)) {
  console.log(`\n📊 ${mode.toUpperCase()} MODE`);
  console.log('─'.repeat(70));

  // Analyze each timeframe
  for (const [tf, tfData] of Object.entries(modeData)) {
    // Collect all trades from all symbols
    const trades = [];
    for (const [symbol, symbolData] of Object.entries(tfData)) {
      if (symbolData.trades && Array.isArray(symbolData.trades)) {
        trades.push(...symbolData.trades.map(t => ({ ...t, symbol })));
      }
    }

    if (trades.length === 0) continue;

    console.log(`\n  ${tf} Timeframe (${trades.length} trades):`);

    // Count directions
    const longs = trades.filter(t => t.direction === 'BUY').length;
    const shorts = trades.filter(t => t.direction === 'SELL').length;
    const longPct = ((longs / trades.length) * 100).toFixed(1);
    const shortPct = ((shorts / trades.length) * 100).toFixed(1);

    console.log(`    Direction: ${longs} longs (${longPct}%) | ${shorts} shorts (${shortPct}%)`);

    // For 15m, analyze HTF consensus
    if (tf === '15m') {
      const consensusCounts = {
        bullish: 0,
        bearish: 0,
        neutral: 0,
        unknown: 0
      };

      // Count HTF consensus (check signal first, then trade level)
      for (const trade of trades) {
        const consensus = trade.signal?.mtfConsensus || trade.mtfConsensus || trade.signal?.htfTrend || trade.htfTrend || 'unknown';
        if (consensus === 'bullish') consensusCounts.bullish++;
        else if (consensus === 'bearish') consensusCounts.bearish++;
        else if (consensus === 'neutral') consensusCounts.neutral++;
        else consensusCounts.unknown++;
      }

      console.log(`\n    HTF Consensus Distribution:`);
      console.log(`      Bullish: ${consensusCounts.bullish} (${((consensusCounts.bullish/trades.length)*100).toFixed(1)}%)`);
      console.log(`      Bearish: ${consensusCounts.bearish} (${((consensusCounts.bearish/trades.length)*100).toFixed(1)}%)`);
      console.log(`      Neutral: ${consensusCounts.neutral} (${((consensusCounts.neutral/trades.length)*100).toFixed(1)}%)`);
      console.log(`      Unknown: ${consensusCounts.unknown} (${((consensusCounts.unknown/trades.length)*100).toFixed(1)}%)`);

      // Check for counter-trend trades (violations)
      const violations = [];
      for (const trade of trades) {
        const consensus = trade.signal?.mtfConsensus || trade.mtfConsensus || trade.signal?.htfTrend || trade.htfTrend;
        const direction = trade.direction || trade.type;
        if (consensus === 'bullish' && (direction === 'SELL' || direction === 'SHORT')) {
          violations.push({
            symbol: trade.symbol,
            timestamp: trade.signal?.timestamp || trade.timestamp,
            issue: 'SHORT in bullish consensus',
            consensus,
            direction
          });
        } else if (consensus === 'bearish' && (direction === 'BUY' || direction === 'LONG')) {
          violations.push({
            symbol: trade.symbol,
            timestamp: trade.signal?.timestamp || trade.timestamp,
            issue: 'LONG in bearish consensus',
            consensus,
            direction
          });
        }
      }

      if (violations.length > 0) {
        console.log(`\n    ⚠️  Found ${violations.length} counter-trend violations:`);
        violations.slice(0, 5).forEach((v, i) => {
          console.log(`      ${i+1}. ${v.symbol} ${v.timestamp}: ${v.issue}`);
        });
        if (violations.length > 5) {
          console.log(`      ... and ${violations.length - 5} more`);
        }
      } else {
        console.log(`\n    ✅ No counter-trend violations found!`);
      }

      // Analyze win rate by direction
      const longTrades = trades.filter(t => (t.direction || t.type) === 'BUY');
      const shortTrades = trades.filter(t => (t.direction || t.type) === 'SELL');

      if (longTrades.length > 0) {
        const longWins = longTrades.filter(t => t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP').length;
        const longWR = ((longWins / longTrades.length) * 100).toFixed(1);
        console.log(`\n    LONG trades: ${longTrades.length} (${longWR}% WR)`);
      }

      if (shortTrades.length > 0) {
        const shortWins = shortTrades.filter(t => t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP').length;
        const shortWR = ((shortWins / shortTrades.length) * 100).toFixed(1);
        console.log(`    SHORT trades: ${shortTrades.length} (${shortWR}% WR)`);
      }
    }
  }
}

console.log('\n═══════════════════════════════════════════════════\n');
