/**
 * Fresh Backtest - Clean Verification Run
 * Tests Conservative mode on top 4 symbols + full comparison
 */

import { backtestSymbol } from './src/services/backtestEngine.js';
import { setStrategyMode, STRATEGY_MODES } from './src/shared/strategyConfig.js';
import fs from 'fs';
import path from 'path';

const TOP_SYMBOLS = ['AVAXUSDT', 'ADAUSDT', 'DOGEUSDT', 'BTCUSDT'];
const ALL_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT'];
const TIMEFRAME = '1h';
const CANDLE_COUNT = 1000;
const LOOKFORWARD = 150;

async function runFreshBacktest() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  FRESH BACKTEST - VERIFICATION RUN');
  console.log('  Conservative Mode: Top 4 vs All Symbols');
  console.log('═══════════════════════════════════════════════════\n');

  const startTime = new Date();
  const results = {};

  // ========================================
  // TEST 1: Conservative Mode - Top 4 Symbols
  // ========================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: CONSERVATIVE MODE - TOP 4 SYMBOLS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  setStrategyMode(STRATEGY_MODES.CONSERVATIVE);

  let top4Trades = [];
  let top4Results = {};

  for (const symbol of TOP_SYMBOLS) {
    try {
      console.log(`Testing ${symbol}...`);
      const result = await backtestSymbol(symbol, TIMEFRAME, CANDLE_COUNT, LOOKFORWARD);

      const trades = result.trades;
      const wins = trades.filter(t => t.pnlR > 0).length;
      const wr = trades.length > 0 ? (wins / trades.length * 100) : 0;
      const totalPnl = trades.reduce((sum, t) => sum + t.pnlR, 0);

      const grossProfit = trades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
      const grossLoss = Math.abs(trades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
      const pf = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);

      top4Results[symbol] = {
        trades: trades.length,
        wins,
        wr,
        pf,
        totalPnlR: totalPnl,
        avgR: trades.length > 0 ? (totalPnl / trades.length) : 0,
        tradeDetails: trades
      };

      top4Trades.push(...trades);

      const emoji = wr === 100 ? '🔥' : wr >= 80 ? '🎯' : wr >= 70 ? '✅' : '⚠️';
      console.log(`  ${emoji} ${trades.length} trades, ${wr.toFixed(1)}% WR, ${pf.toFixed(2)} PF, ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}R\n`);

    } catch (error) {
      console.error(`  ❌ Error: ${symbol} - ${error.message}\n`);
      top4Results[symbol] = { error: error.message, trades: 0, wins: 0, wr: 0, pf: 0, totalPnlR: 0, avgR: 0 };
    }
  }

  // Calculate top 4 overall
  const top4TotalWins = top4Trades.filter(t => t.pnlR > 0).length;
  const top4WR = top4Trades.length > 0 ? (top4TotalWins / top4Trades.length * 100) : 0;
  const top4TotalPnl = top4Trades.reduce((sum, t) => sum + t.pnlR, 0);
  const top4GrossProfit = top4Trades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
  const top4GrossLoss = Math.abs(top4Trades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
  const top4PF = top4GrossLoss > 0 ? (top4GrossProfit / top4GrossLoss) : (top4GrossProfit > 0 ? 999 : 0);

  console.log('─'.repeat(80));
  console.log(`TOP 4 OVERALL: ${top4Trades.length} trades, ${top4WR.toFixed(1)}% WR, ${top4PF.toFixed(2)} PF, ${top4TotalPnl >= 0 ? '+' : ''}${top4TotalPnl.toFixed(2)}R\n`);

  results.conservativeTop4 = {
    symbols: TOP_SYMBOLS,
    totalTrades: top4Trades.length,
    winRate: top4WR,
    profitFactor: top4PF,
    totalPnlR: top4TotalPnl,
    avgRPerTrade: top4Trades.length > 0 ? (top4TotalPnl / top4Trades.length) : 0,
    symbolBreakdown: top4Results
  };

  // ========================================
  // TEST 2: Conservative Mode - All 10 Symbols
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: CONSERVATIVE MODE - ALL 10 SYMBOLS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let allTrades = [];
  let allResults = {};

  for (const symbol of ALL_SYMBOLS) {
    try {
      console.log(`Testing ${symbol}...`);
      const result = await backtestSymbol(symbol, TIMEFRAME, CANDLE_COUNT, LOOKFORWARD);

      const trades = result.trades;
      const wins = trades.filter(t => t.pnlR > 0).length;
      const wr = trades.length > 0 ? (wins / trades.length * 100) : 0;
      const totalPnl = trades.reduce((sum, t) => sum + t.pnlR, 0);

      const grossProfit = trades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
      const grossLoss = Math.abs(trades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
      const pf = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);

      allResults[symbol] = {
        trades: trades.length,
        wins,
        wr,
        pf,
        totalPnlR: totalPnl,
        avgR: trades.length > 0 ? (totalPnl / trades.length) : 0
      };

      allTrades.push(...trades);

      const emoji = wr >= 80 ? '🎯' : wr >= 60 ? '✅' : wr >= 50 ? '⚠️' : '❌';
      console.log(`  ${emoji} ${trades.length} trades, ${wr.toFixed(1)}% WR, ${pf.toFixed(2)} PF, ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}R`);

    } catch (error) {
      console.error(`  ❌ Error: ${symbol} - ${error.message}`);
      allResults[symbol] = { error: error.message, trades: 0, wins: 0, wr: 0, pf: 0, totalPnlR: 0, avgR: 0 };
    }
  }

  // Calculate all 10 overall
  const allTotalWins = allTrades.filter(t => t.pnlR > 0).length;
  const allWR = allTrades.length > 0 ? (allTotalWins / allTrades.length * 100) : 0;
  const allTotalPnl = allTrades.reduce((sum, t) => sum + t.pnlR, 0);
  const allGrossProfit = allTrades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
  const allGrossLoss = Math.abs(allTrades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
  const allPF = allGrossLoss > 0 ? (allGrossProfit / allGrossLoss) : (allGrossProfit > 0 ? 999 : 0);

  console.log('\n─'.repeat(80));
  console.log(`ALL 10 OVERALL: ${allTrades.length} trades, ${allWR.toFixed(1)}% WR, ${allPF.toFixed(2)} PF, ${allTotalPnl >= 0 ? '+' : ''}${allTotalPnl.toFixed(2)}R\n`);

  results.conservativeAll = {
    symbols: ALL_SYMBOLS,
    totalTrades: allTrades.length,
    winRate: allWR,
    profitFactor: allPF,
    totalPnlR: allTotalPnl,
    avgRPerTrade: allTrades.length > 0 ? (allTotalPnl / allTrades.length) : 0,
    symbolBreakdown: allResults
  };

  // ========================================
  // TEST 3: SNIPER Mode - Top 4 Symbols
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: SNIPER MODE - TOP 4 SYMBOLS (Comparison)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  setStrategyMode(STRATEGY_MODES.SNIPER);

  let sniperTrades = [];
  let sniperResults = {};

  for (const symbol of TOP_SYMBOLS) {
    try {
      console.log(`Testing ${symbol}...`);
      const result = await backtestSymbol(symbol, TIMEFRAME, CANDLE_COUNT, LOOKFORWARD);

      const trades = result.trades;
      const wins = trades.filter(t => t.pnlR > 0).length;
      const wr = trades.length > 0 ? (wins / trades.length * 100) : 0;
      const totalPnl = trades.reduce((sum, t) => sum + t.pnlR, 0);

      const grossProfit = trades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
      const grossLoss = Math.abs(trades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
      const pf = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);

      sniperResults[symbol] = {
        trades: trades.length,
        wins,
        wr,
        pf,
        totalPnlR: totalPnl,
        avgR: trades.length > 0 ? (totalPnl / trades.length) : 0
      };

      sniperTrades.push(...trades);

      const emoji = wr >= 80 ? '🎯' : wr >= 60 ? '✅' : '⚠️';
      console.log(`  ${emoji} ${trades.length} trades, ${wr.toFixed(1)}% WR, ${pf.toFixed(2)} PF, ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}R`);

    } catch (error) {
      console.error(`  ❌ Error: ${symbol} - ${error.message}`);
      sniperResults[symbol] = { error: error.message, trades: 0, wins: 0, wr: 0, pf: 0, totalPnlR: 0, avgR: 0 };
    }
  }

  // Calculate SNIPER overall
  const sniperTotalWins = sniperTrades.filter(t => t.pnlR > 0).length;
  const sniperWR = sniperTrades.length > 0 ? (sniperTotalWins / sniperTrades.length * 100) : 0;
  const sniperTotalPnl = sniperTrades.reduce((sum, t) => sum + t.pnlR, 0);
  const sniperGrossProfit = sniperTrades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
  const sniperGrossLoss = Math.abs(sniperTrades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
  const sniperPF = sniperGrossLoss > 0 ? (sniperGrossProfit / sniperGrossLoss) : (sniperGrossProfit > 0 ? 999 : 0);

  console.log('\n─'.repeat(80));
  console.log(`SNIPER OVERALL: ${sniperTrades.length} trades, ${sniperWR.toFixed(1)}% WR, ${sniperPF.toFixed(2)} PF, ${sniperTotalPnl >= 0 ? '+' : ''}${sniperTotalPnl.toFixed(2)}R\n`);

  results.sniperTop4 = {
    symbols: TOP_SYMBOLS,
    totalTrades: sniperTrades.length,
    winRate: sniperWR,
    profitFactor: sniperPF,
    totalPnlR: sniperTotalPnl,
    avgRPerTrade: sniperTrades.length > 0 ? (sniperTotalPnl / sniperTrades.length) : 0,
    symbolBreakdown: sniperResults
  };

  // ========================================
  // FINAL SUMMARY
  // ========================================
  const endTime = new Date();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  FINAL SUMMARY');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Strategy Comparison (1H Timeframe):\n');
  console.log('─'.repeat(80));
  console.log('Strategy'.padEnd(30) + '| Trades | Win Rate | PF   | Total P&L');
  console.log('─'.repeat(80));

  const strategies = [
    { name: 'Conservative (Top 4)', data: results.conservativeTop4 },
    { name: 'Conservative (All 10)', data: results.conservativeAll },
    { name: 'SNIPER (Top 4)', data: results.sniperTop4 }
  ];

  strategies.forEach(({ name, data }) => {
    const emoji = data.winRate >= 90 ? '🔥' : data.winRate >= 70 ? '🎯' : data.winRate >= 60 ? '✅' : '⚠️';
    console.log(
      `${emoji} ${name.padEnd(27)}| ${data.totalTrades.toString().padStart(6)} | ${data.winRate.toFixed(1).padStart(7)}% | ${data.profitFactor.toFixed(2).padStart(4)} | ${data.totalPnlR >= 0 ? '+' : ''}${data.totalPnlR.toFixed(2).padStart(7)}R`
    );
  });

  console.log('─'.repeat(80));

  // Winner
  const winner = strategies.reduce((best, current) =>
    current.data.totalPnlR > best.data.totalPnlR ? current : best
  );

  console.log(`\n🏆 WINNER: ${winner.name}`);
  console.log(`   ${winner.data.winRate.toFixed(1)}% WR, ${winner.data.profitFactor.toFixed(2)} PF, ${winner.data.totalPnlR >= 0 ? '+' : ''}${winner.data.totalPnlR.toFixed(2)}R (${winner.data.totalTrades} trades)\n`);

  // Key insights
  console.log('═══════════════════════════════════════════════════');
  console.log('  KEY INSIGHTS');
  console.log('═══════════════════════════════════════════════════\n');

  const top4Improvement = top4WR - allWR;
  console.log(`1. Symbol Selection Impact: +${top4Improvement.toFixed(1)}% WR improvement`);
  console.log(`   (Top 4: ${top4WR.toFixed(1)}% vs All 10: ${allWR.toFixed(1)}%)\n`);

  const top4ProfitImprovement = top4TotalPnl - allTotalPnl;
  console.log(`2. Profit Impact: ${top4ProfitImprovement >= 0 ? '+' : ''}${top4ProfitImprovement.toFixed(2)}R more profit`);
  console.log(`   (Top 4: +${top4TotalPnl.toFixed(2)}R vs All 10: ${allTotalPnl >= 0 ? '+' : ''}${allTotalPnl.toFixed(2)}R)\n`);

  if (top4WR >= 80) {
    console.log('3. ✅ GOAL ACHIEVED: Top 4 symbols exceed 80% win rate target!\n');
  }

  // Save results
  const resultsDir = './backtest-results';
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const fullResults = {
    metadata: {
      timestamp: startTime.toISOString(),
      duration: `${duration}s`,
      description: 'Fresh backtest verification - Conservative vs SNIPER on top 4 symbols',
      version: 'Verification 1.0'
    },
    configuration: {
      timeframe: TIMEFRAME,
      candleCount: CANDLE_COUNT,
      lookforward: LOOKFORWARD,
      topSymbols: TOP_SYMBOLS,
      allSymbols: ALL_SYMBOLS
    },
    results: results
  };

  const resultsPath = path.join(resultsDir, 'verification-backtest.json');
  fs.writeFileSync(resultsPath, JSON.stringify(fullResults, null, 2));

  console.log('═══════════════════════════════════════════════════');
  console.log(`  Backtest completed in ${duration}s`);
  console.log(`  Results saved to: ${resultsPath}`);
  console.log('═══════════════════════════════════════════════════\n');
}

runFreshBacktest().catch(console.error);
