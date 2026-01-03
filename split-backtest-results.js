/**
 * Split comprehensive backtest into separate mode/timeframe runs
 */

import fs from 'fs';
import path from 'path';

const resultsDir = './backtest-results';
const runsDir = path.join(resultsDir, 'runs');

// Read the comprehensive backtest
const comprehensiveFile = path.join(resultsDir, 'latest-backtest.json');
const comprehensiveData = JSON.parse(fs.readFileSync(comprehensiveFile, 'utf8'));

const index = { runs: [] };
const baseTimestamp = new Date(comprehensiveData.metadata.timestamp);

// Process each mode
Object.entries(comprehensiveData.results).forEach(([mode, timeframes]) => {
  // Process each timeframe within the mode
  Object.entries(timeframes).forEach(([timeframe, symbols]) => {
    // Skip if scalping mode and 4h timeframe
    if (mode === 'scalping' && timeframe === '4h') {
      return;
    }

    // Aggregate data across all symbols for this mode/timeframe
    let allTrades = [];
    let totalWins = 0;
    let totalLosses = 0;
    let totalExpired = 0;
    let totalBreakeven = 0;

    Object.entries(symbols).forEach(([symbol, symbolData]) => {
      if (symbolData.trades && Array.isArray(symbolData.trades)) {
        symbolData.trades.forEach(trade => {
          allTrades.push({
            ...trade,
            symbol,
            mode,
            timeframe
          });

          // Count wins/losses
          if (trade.result === 'TAKE_PROFIT' || trade.result === 'TRAILING_STOP_WIN') {
            totalWins++;
          } else if (trade.result === 'STOP_LOSS') {
            totalLosses++;
          } else if (trade.result === 'BREAKEVEN') {
            totalBreakeven++;
          } else if (trade.result === 'EXPIRED') {
            totalExpired++;
          }
        });
      }
    });

    const totalTrades = allTrades.length;
    const winRate = totalTrades > 0 ? (totalWins / totalTrades * 100) : 0;

    // Calculate profit factor
    const grossProfit = allTrades
      .filter(t => t.pnlR > 0)
      .reduce((sum, t) => sum + t.pnlR, 0);
    const grossLoss = Math.abs(allTrades
      .filter(t => t.pnlR < 0)
      .reduce((sum, t) => sum + t.pnlR, 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);

    // Calculate total PnL
    const totalPnlR = allTrades.reduce((sum, t) => sum + t.pnlR, 0);
    const avgR = totalTrades > 0 ? totalPnlR / totalTrades : 0;

    // Create individual run data
    const runId = `${mode}-${timeframe}-${baseTimestamp.toISOString().split('T')[0]}`;
    const runData = {
      metadata: {
        runId,
        timestamp: baseTimestamp.toISOString(),
        mode: mode.toUpperCase(),
        timeframe,
        description: `${mode.charAt(0).toUpperCase() + mode.slice(1)} mode on ${timeframe} timeframe`,
        baseRun: comprehensiveData.metadata.runId
      },
      configuration: {
        symbols: comprehensiveData.configuration.symbols,
        candleCount: comprehensiveData.configuration.candleCount,
        lookforward: comprehensiveData.configuration.lookforward
      },
      results: symbols, // Keep the per-symbol breakdown
      combinedMetrics: {
        totalTrades,
        wins: totalWins,
        losses: totalLosses,
        breakeven: totalBreakeven,
        expired: totalExpired,
        winRate: parseFloat(winRate.toFixed(2)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
        totalPnlR: parseFloat(totalPnlR.toFixed(2)),
        avgR: parseFloat(avgR.toFixed(2)),
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        grossLoss: parseFloat(grossLoss.toFixed(2))
      },
      mode: mode.toUpperCase(),
      timeframe,
      symbols: Object.keys(symbols),
      trades: allTrades
    };

    // Save individual run file
    const runFile = path.join(runsDir, `${runId}.json`);
    fs.writeFileSync(runFile, JSON.stringify(runData, null, 2));

    // Add to index
    index.runs.push({
      id: runId,
      timestamp: baseTimestamp.toISOString(),
      mode: mode.toUpperCase(),
      timeframe,
      totalTrades,
      winRate: parseFloat(winRate.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      totalPnlR: parseFloat(totalPnlR.toFixed(2)),
      avgR: parseFloat(avgR.toFixed(2)),
      file: `runs/${runId}.json`
    });

    console.log(`✅ Created ${mode.toUpperCase()} ${timeframe}: ${totalTrades} trades, ${winRate.toFixed(1)}% WR, ${profitFactor.toFixed(2)} PF`);
  });
});

// Sort by timestamp (newest first)
index.runs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

// Save index
const indexPath = path.join(resultsDir, 'index.json');
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

console.log('\n✅ Split complete!');
console.log(`📁 Created ${index.runs.length} separate backtest runs`);
console.log(`📄 Updated index.json`);
