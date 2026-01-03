/**
 * Analyze Winning Patterns
 * Study what makes trades successful to design ELITE mode
 */

import fs from 'fs';

const resultsFile = './backtest-results/latest-backtest.json';

console.log('\n═══════════════════════════════════════════════════');
console.log('  PROFESSIONAL TRADER ANALYSIS');
console.log('  Identifying High Win Rate Patterns');
console.log('═══════════════════════════════════════════════════\n');

if (!fs.existsSync(resultsFile)) {
  console.log('❌ No backtest results found. Run backtest first.');
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
          all15mTrades.push({
            ...trade,
            symbol,
            mode: mode.toUpperCase()
          });
        });
      }
    }
  }
}

console.log(`📊 Total 15m Trades: ${all15mTrades.length}\n`);

// Separate winners and losers
const winners = all15mTrades.filter(t => t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP');
const losers = all15mTrades.filter(t => t.result === 'STOP_LOSS' || t.result === 'TIMEOUT');

console.log(`✅ Winners: ${winners.length} (${((winners.length/all15mTrades.length)*100).toFixed(1)}%)`);
console.log(`❌ Losers: ${losers.length} (${((losers.length/all15mTrades.length)*100).toFixed(1)}%)\n`);

// Analyze patterns in winners
console.log('═══════════════════════════════════════════════════');
console.log('  WINNING PATTERN ANALYSIS');
console.log('═══════════════════════════════════════════════════\n');

// Pattern frequency in winners vs losers
const winnerPatterns = {};
const loserPatterns = {};

winners.forEach(trade => {
  const patterns = trade.signal?.patterns || [];
  patterns.forEach(pattern => {
    winnerPatterns[pattern] = (winnerPatterns[pattern] || 0) + 1;
  });
});

losers.forEach(trade => {
  const patterns = trade.signal?.patterns || [];
  patterns.forEach(pattern => {
    loserPatterns[pattern] = (loserPatterns[pattern] || 0) + 1;
  });
});

// Calculate win rate for each pattern
const patternWinRates = {};
const allPatterns = new Set([...Object.keys(winnerPatterns), ...Object.keys(loserPatterns)]);

allPatterns.forEach(pattern => {
  const wins = winnerPatterns[pattern] || 0;
  const losses = loserPatterns[pattern] || 0;
  const total = wins + losses;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  patternWinRates[pattern] = { wins, losses, total, winRate };
});

// Sort by win rate
const sortedPatterns = Object.entries(patternWinRates)
  .sort((a, b) => b[1].winRate - a[1].winRate);

console.log('Pattern Win Rates:\n');
sortedPatterns.forEach(([pattern, stats]) => {
  const emoji = stats.winRate >= 50 ? '✅' : '❌';
  console.log(`${emoji} ${pattern.padEnd(30)} | ${stats.total.toString().padStart(3)} trades | ${stats.winRate.toFixed(1)}% WR`);
});

// Analyze confluence scores
console.log('\n═══════════════════════════════════════════════════');
console.log('  CONFLUENCE SCORE ANALYSIS');
console.log('═══════════════════════════════════════════════════\n');

const winnerConfluence = winners.map(t => t.signal?.confluenceScore || 0).filter(s => s > 0);
const loserConfluence = losers.map(t => t.signal?.confluenceScore || 0).filter(s => s > 0);

if (winnerConfluence.length > 0) {
  const avgWinConfluence = winnerConfluence.reduce((a, b) => a + b, 0) / winnerConfluence.length;
  const avgLoseConfluence = loserConfluence.reduce((a, b) => a + b, 0) / loserConfluence.length;
  const minWinConfluence = Math.min(...winnerConfluence);
  const maxWinConfluence = Math.max(...winnerConfluence);

  console.log(`Winners Average Confluence: ${avgWinConfluence.toFixed(1)}`);
  console.log(`Losers Average Confluence:  ${avgLoseConfluence.toFixed(1)}`);
  console.log(`Winners Min/Max: ${minWinConfluence} / ${maxWinConfluence}\n`);

  // Confluence score buckets
  const confluenceBuckets = {
    '0-40': { wins: 0, losses: 0 },
    '40-60': { wins: 0, losses: 0 },
    '60-80': { wins: 0, losses: 0 },
    '80-100': { wins: 0, losses: 0 },
    '100+': { wins: 0, losses: 0 }
  };

  winners.forEach(trade => {
    const score = trade.signal?.confluenceScore || 0;
    if (score < 40) confluenceBuckets['0-40'].wins++;
    else if (score < 60) confluenceBuckets['40-60'].wins++;
    else if (score < 80) confluenceBuckets['60-80'].wins++;
    else if (score < 100) confluenceBuckets['80-100'].wins++;
    else confluenceBuckets['100+'].wins++;
  });

  losers.forEach(trade => {
    const score = trade.signal?.confluenceScore || 0;
    if (score < 40) confluenceBuckets['0-40'].losses++;
    else if (score < 60) confluenceBuckets['40-60'].losses++;
    else if (score < 80) confluenceBuckets['60-80'].losses++;
    else if (score < 100) confluenceBuckets['80-100'].losses++;
    else confluenceBuckets['100+'].losses++;
  });

  console.log('Win Rate by Confluence Score:\n');
  Object.entries(confluenceBuckets).forEach(([bucket, stats]) => {
    const total = stats.wins + stats.losses;
    if (total > 0) {
      const wr = (stats.wins / total) * 100;
      const emoji = wr >= 50 ? '✅' : '❌';
      console.log(`${emoji} ${bucket.padEnd(10)} | ${total.toString().padStart(3)} trades | ${wr.toFixed(1)}% WR`);
    }
  });
}

// Analyze by symbol
console.log('\n═══════════════════════════════════════════════════');
console.log('  SYMBOL PERFORMANCE (15m)');
console.log('═══════════════════════════════════════════════════\n');

const symbolStats = {};
all15mTrades.forEach(trade => {
  if (!symbolStats[trade.symbol]) {
    symbolStats[trade.symbol] = { wins: 0, losses: 0 };
  }
  if (trade.result === 'TAKE_PROFIT' || trade.result === 'TRAILING_STOP') {
    symbolStats[trade.symbol].wins++;
  } else {
    symbolStats[trade.symbol].losses++;
  }
});

Object.entries(symbolStats)
  .sort((a, b) => {
    const aWR = a[1].wins / (a[1].wins + a[1].losses);
    const bWR = b[1].wins / (b[1].wins + b[1].losses);
    return bWR - aWR;
  })
  .forEach(([symbol, stats]) => {
    const total = stats.wins + stats.losses;
    const wr = (stats.wins / total) * 100;
    const emoji = wr >= 50 ? '✅' : wr >= 30 ? '⚠️' : '❌';
    console.log(`${emoji} ${symbol.padEnd(10)} | ${total.toString().padStart(3)} trades | ${wr.toFixed(1)}% WR | ${stats.wins}W ${stats.losses}L`);
  });

// Analyze by direction
console.log('\n═══════════════════════════════════════════════════');
console.log('  DIRECTION PERFORMANCE');
console.log('═══════════════════════════════════════════════════\n');

const longTrades = all15mTrades.filter(t => t.direction === 'BUY' || t.type === 'BUY');
const shortTrades = all15mTrades.filter(t => t.direction === 'SELL' || t.type === 'SELL');

const longWins = longTrades.filter(t => t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP').length;
const shortWins = shortTrades.filter(t => t.result === 'TAKE_PROFIT' || t.result === 'TRAILING_STOP').length;

const longWR = longTrades.length > 0 ? (longWins / longTrades.length) * 100 : 0;
const shortWR = shortTrades.length > 0 ? (shortWins / shortTrades.length) * 100 : 0;

console.log(`📈 LONG trades:  ${longTrades.length} total | ${longWR.toFixed(1)}% WR`);
console.log(`📉 SHORT trades: ${shortTrades.length} total | ${shortWR.toFixed(1)}% WR\n`);

// Analyze HTF consensus impact
console.log('═══════════════════════════════════════════════════');
console.log('  HTF TREND ALIGNMENT IMPACT');
console.log('═══════════════════════════════════════════════════\n');

const consensusStats = {
  'bullish': { wins: 0, losses: 0 },
  'bearish': { wins: 0, losses: 0 },
  'neutral': { wins: 0, losses: 0 }
};

all15mTrades.forEach(trade => {
  const consensus = trade.mtfConsensus || trade.signal?.mtfConsensus || 'neutral';
  const isWin = trade.result === 'TAKE_PROFIT' || trade.result === 'TRAILING_STOP';

  if (consensusStats[consensus]) {
    if (isWin) consensusStats[consensus].wins++;
    else consensusStats[consensus].losses++;
  }
});

Object.entries(consensusStats).forEach(([consensus, stats]) => {
  const total = stats.wins + stats.losses;
  if (total > 0) {
    const wr = (stats.wins / total) * 100;
    const emoji = wr >= 50 ? '✅' : '❌';
    console.log(`${emoji} ${consensus.padEnd(10)} | ${total.toString().padStart(3)} trades | ${wr.toFixed(1)}% WR`);
  }
});

// Recommendations for ELITE mode
console.log('\n═══════════════════════════════════════════════════');
console.log('  ELITE MODE RECOMMENDATIONS');
console.log('═══════════════════════════════════════════════════\n');

const bestPatterns = sortedPatterns.filter(p => p[1].winRate >= 50 && p[1].total >= 3);
if (bestPatterns.length > 0) {
  console.log('✅ REQUIRE these patterns (50%+ WR):');
  bestPatterns.forEach(([pattern, stats]) => {
    console.log(`   - ${pattern} (${stats.winRate.toFixed(1)}% WR, ${stats.total} trades)`);
  });
}

console.log('\n💡 Additional Requirements:');
console.log(`   - Minimum confluence score: 70+ (winners avg: ${winnerConfluence.length > 0 ? (winnerConfluence.reduce((a,b) => a+b, 0) / winnerConfluence.length).toFixed(1) : 'N/A'})`);

const bestSymbol = Object.entries(symbolStats)
  .sort((a, b) => {
    const aWR = a[1].wins / (a[1].wins + a[1].losses);
    const bWR = b[1].wins / (b[1].wins + b[1].losses);
    return bWR - aWR;
  })[0];

if (bestSymbol) {
  const symbolWR = (bestSymbol[1].wins / (bestSymbol[1].wins + bestSymbol[1].losses)) * 100;
  console.log(`   - Best symbol: ${bestSymbol[0]} (${symbolWR.toFixed(1)}% WR)`);
}

const bestDirection = longWR > shortWR ? 'LONG' : 'SHORT';
const bestDirectionWR = Math.max(longWR, shortWR);
console.log(`   - Best direction: ${bestDirection} (${bestDirectionWR.toFixed(1)}% WR)`);

const bestConsensus = Object.entries(consensusStats)
  .sort((a, b) => {
    const aTotal = a[1].wins + a[1].losses;
    const bTotal = b[1].wins + b[1].losses;
    if (aTotal === 0) return 1;
    if (bTotal === 0) return -1;
    const aWR = a[1].wins / aTotal;
    const bWR = b[1].wins / bTotal;
    return bWR - aWR;
  })[0];

if (bestConsensus) {
  const total = bestConsensus[1].wins + bestConsensus[1].losses;
  if (total > 0) {
    const wr = (bestConsensus[1].wins / total) * 100;
    console.log(`   - Best HTF consensus: ${bestConsensus[0]} (${wr.toFixed(1)}% WR)`);
  }
}

console.log('\n═══════════════════════════════════════════════════\n');
