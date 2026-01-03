/**
 * Diagnostic script to identify what's blocking signal generation
 */

import { getBinanceKlines } from './src/server/binanceService.js';
import { analyzeSMC, detectOrderBlocks, detectFairValueGaps, detectLiquiditySweeps, detectSwingPoints } from './src/shared/smcDetectors.js';
import { setStrategyMode, getHTFTimeframe } from './src/shared/strategyConfig.js';

async function diagnoseSignalBlocking() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  DIAGNOSTIC: Signal Generation Blocking Analysis');
  console.log('═══════════════════════════════════════════════════\n');

  const symbol = 'BTCUSDT';
  const timeframe = '1h';
  const candleCount = 500;

  // Test all modes
  const modes = ['aggressive', 'moderate', 'conservative'];

  for (const mode of modes) {
    console.log(`\n╔═══════════════════════════════════════════════════╗`);
    console.log(`║  ${mode.toUpperCase()} MODE`.padEnd(50) + '║');
    console.log(`╚═══════════════════════════════════════════════════╝\n`);

    setStrategyMode(mode);

    const candles = await getBinanceKlines(symbol, timeframe, candleCount);
    const htfTimeframe = getHTFTimeframe(timeframe);
    const htfCandles = await getBinanceKlines(symbol, htfTimeframe, Math.floor(candleCount / 2));

    console.log(`Data: ${candles.length} ${timeframe} candles, ${htfCandles.length} ${htfTimeframe} HTF candles\n`);

    // Test pattern detection separately
    console.log('Individual Pattern Detection:');
    console.log('─────────────────────────────────────────────────\n');

    const swingPoints = detectSwingPoints(candles, 5);
    console.log(`  Swing Points: ${swingPoints.swingHighs.length} highs, ${swingPoints.swingLows.length} lows`);

    const orderBlocks = detectOrderBlocks(candles, null, { timeframe });
    console.log(`  Order Blocks: ${orderBlocks.bullish?.length || 0} bullish, ${orderBlocks.bearish?.length || 0} bearish`);

    const fvgs = detectFairValueGaps(candles, { timeframe });
    console.log(`  FVGs: ${fvgs.bullish?.length || 0} bullish, ${fvgs.bearish?.length || 0} bearish`);

    const sweeps = detectLiquiditySweeps(candles, swingPoints, { timeframe });
    console.log(`  Liquidity Sweeps: ${sweeps.length} total`);

    // Full analysis
    console.log('\nFull SMC Analysis:');
    console.log('─────────────────────────────────────────────────\n');

    const analysis = analyzeSMC(candles, htfCandles, timeframe);

    console.log(`  Signals Generated: ${analysis.signals?.length || 0}`);

    if (analysis.signals && analysis.signals.length > 0) {
      console.log('\n  ✅ Signals are being generated!');
      console.log(`     First signal: ${analysis.signals[0].type} at ${analysis.signals[0].entry}`);
      console.log(`     Confluence: ${analysis.signals[0].confluenceScore}`);
    } else {
      console.log('\n  ❌ NO SIGNALS - Checking filters...\n');

      // Check what patterns exist
      const hasOB = (analysis.orderBlocks?.bullish?.length || 0) + (analysis.orderBlocks?.bearish?.length || 0) > 0;
      const hasFVG = (analysis.fvgs?.unfilled?.bullish?.length || 0) + (analysis.fvgs?.unfilled?.bearish?.length || 0) > 0;
      const hasSweep = (analysis.liquiditySweeps?.length || 0) > 0;
      const hasBOS = (analysis.bos?.bullish?.length || 0) + (analysis.bos?.bearish?.length || 0) > 0;

      console.log('  Pattern Availability:');
      console.log(`    Order Blocks: ${hasOB ? '✅' : '❌'} ${hasOB ? `(${(analysis.orderBlocks?.bullish?.length || 0) + (analysis.orderBlocks?.bearish?.length || 0)} total)` : ''}`);
      console.log(`    FVGs (unfilled): ${hasFVG ? '✅' : '❌'} ${hasFVG ? `(${(analysis.fvgs?.unfilled?.bullish?.length || 0) + (analysis.fvgs?.unfilled?.bearish?.length || 0)} total)` : ''}`);
      console.log(`    Liquidity Sweeps: ${hasSweep ? '✅' : '❌'} ${hasSweep ? `(${analysis.liquiditySweeps?.length} total)` : ''}`);
      console.log(`    BOS: ${hasBOS ? '✅' : '❌'} ${hasBOS ? `(${(analysis.bos?.bullish?.length || 0) + (analysis.bos?.bearish?.length || 0)} total)` : ''}`);

      console.log('\n  Likely Blocking Reasons:');
      if (!hasFVG) {
        console.log('    ⚠️  NO FVGs detected - minimum gap size may be too large');
      }
      if (!hasOB) {
        console.log('    ⚠️  NO Order Blocks detected - impulse threshold may be too high');
      }
      if (!hasBOS && mode === 'conservative') {
        console.log('    ⚠️  NO BOS detected - Conservative mode requires BOS');
      }
      if (mode === 'moderate' && !hasFVG) {
        console.log('    ⚠️  Moderate mode REQUIRES FVG - this is blocking all signals');
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Based on analysis:');
  console.log('  1. Lower FVG minimum gap sizes (currently too restrictive)');
  console.log('  2. Remove FVG as REQUIRED for Moderate mode');
  console.log('  3. Lower confluence thresholds');
  console.log('  4. Relax Conservative mode requirements further\n');
}

diagnoseSignalBlocking().catch(console.error);
