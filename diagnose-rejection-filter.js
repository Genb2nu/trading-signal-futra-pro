/**
 * Diagnostic script to understand why rejection pattern filter is blocking all trades
 */

import { getBinanceKlines } from './src/server/binanceService.js';
import { analyzeSMC } from './src/shared/smcDetectors.js';
import { setStrategyMode, getHTFTimeframe } from './src/shared/strategyConfig.js';

async function diagnoseRejectionFilter() {
  console.log('Diagnosing Rejection Pattern Filter Issues...\n');

  setStrategyMode('aggressive'); // Should generate most trades

  const symbol = 'BTCUSDT';
  const timeframe = '1h';
  const candleCount = 500;

  console.log(`Testing ${symbol} ${timeframe} with ${candleCount} candles\n`);

  // Fetch data
  const candles = await getBinanceKlines(symbol, timeframe, candleCount);
  const htfTimeframe = getHTFTimeframe(timeframe);
  const htfCandles = await getBinanceKlines(symbol, htfTimeframe, Math.floor(candleCount / 2));

  console.log(`Fetched ${candles.length} ${timeframe} candles and ${htfCandles.length} ${htfTimeframe} HTF candles\n`);

  // Run analysis
  const analysis = analyzeSMC(candles, htfCandles, timeframe);

  console.log('═══════════════════════════════════════════════════');
  console.log('ANALYSIS RESULTS:');
  console.log('═══════════════════════════════════════════════════\n');

  // Count patterns detected
  console.log('Pattern Detections:');
  console.log(`  Order Blocks (Bullish): ${analysis.orderBlocks?.bullish?.length || 0}`);
  console.log(`  Order Blocks (Bearish): ${analysis.orderBlocks?.bearish?.length || 0}`);
  console.log(`  FVGs (Bullish unfilled): ${analysis.fvgs?.unfilled?.bullish?.length || 0}`);
  console.log(`  FVGs (Bearish unfilled): ${analysis.fvgs?.unfilled?.bearish?.length || 0}`);
  console.log(`  Liquidity Sweeps: ${analysis.liquiditySweeps?.length || 0}`);
  console.log(`  BOS Events: ${analysis.bos?.bullish?.length + analysis.bos?.bearish?.length || 0}`);
  console.log('');

  // Signals generated
  console.log('Signals Generated:');
  console.log(`  Total Signals: ${analysis.signals?.length || 0}`);
  console.log('');

  if (analysis.signals && analysis.signals.length > 0) {
    console.log('Signal Details:');
    analysis.signals.forEach((signal, i) => {
      console.log(`\n  Signal ${i + 1}:`);
      console.log(`    Type: ${signal.type}`);
      console.log(`    Entry: ${signal.entry}`);
      console.log(`    Confluence: ${signal.confluenceScore}`);
      console.log(`    Entry Timing: ${signal.entryTiming?.status || 'N/A'}`);
      console.log(`    Rejection Pattern: ${signal.entryTiming?.rejectionPattern || 'NONE'}`);
      console.log(`    Patterns Present:`);
      console.log(`      FVG: ${signal.fvgStatus ? 'YES' : 'NO'}`);
      console.log(`      Liquidity Sweep: ${signal.liquidityAnalysis?.sweepDetected ? 'YES' : 'NO'}`);
      console.log(`      BOS: ${signal.structureAnalysis?.bosType ? 'YES' : 'NO'}`);
    });
  } else {
    console.log('❌ NO SIGNALS GENERATED');
    console.log('\nPossible Issues:');
    console.log('  1. Rejection pattern requirement too strict');
    console.log('  2. Confluence threshold too high');
    console.log('  3. Required confirmations not being met');
    console.log('  4. FVG requirement blocking signals');
  }

  console.log('\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('TESTING WITHOUT REJECTION REQUIREMENT:');
  console.log('═══════════════════════════════════════════════════\n');

  // Temporarily modify to test without rejection requirement
  console.log('This would require modifying requireRejectionPattern to false');
  console.log('The issue is likely that the rejection pattern detection');
  console.log('is too strict or not detecting valid rejection candles.');
}

diagnoseRejectionFilter().catch(console.error);
