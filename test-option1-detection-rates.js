/**
 * Test Option 1 Detection Rates on Shared SMC Detectors
 * This tests the 3-state system (what generates your validation data)
 */

import { analyzeSMC } from './src/shared/smcDetectors.js';
import { getBinanceKlines } from './lib/binanceService.js';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Testing Option 1: Detection Rates (3-State System)      ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('📊 Testing on shared/smcDetectors.js (generates validation data)');
console.log('   - FVG lookback: 15 candles');
console.log('   - OB lookback: 20 candles');
console.log('   - Accept: BEFORE and AFTER BOS/CHoCH');
console.log('   - Target: 40-60% detection rate\n');

// Test symbols (mix of volatile and stable)
const testSymbols = [
  'BTCUSDT',  // High volume
  'ETHUSDT',  // High volume
  'BNBUSDT',  // Medium volume
  'SOLUSDT',  // High volatility
  'ADAUSDT',  // Medium volatility
  'DOGEUSDT', // High volatility
  'XRPUSDT',  // Medium volume
  'MATICUSDT' // Medium volatility
];

const timeframe = '15m';
let totalSignals = 0;
let signalsWithOB = 0;
let signalsWithFVG = 0;
let signalsWithBoth = 0;
let signalsWithEither = 0;

console.log(`🔄 Scanning ${testSymbols.length} symbols on ${timeframe}...\n`);

try {
  for (const symbol of testSymbols) {
    console.log(`\n📊 Analyzing ${symbol}...`);

    const candles = await getBinanceKlines(symbol, timeframe, 500);
    const analysis = analyzeSMC(candles, null, timeframe, null, symbol);

    if (analysis.signals && analysis.signals.length > 0) {
      console.log(`   Found ${analysis.signals.length} signals`);

      analysis.signals.forEach(signal => {
        totalSignals++;

        const hasOB = !!signal.orderBlock;
        const hasFVG = !!signal.fvg;

        if (hasOB) {
          signalsWithOB++;
          console.log(`   ✅ Signal has OB (${signal.orderBlock.type})`);
        }
        if (hasFVG) {
          signalsWithFVG++;
          console.log(`   ✅ Signal has FVG (${signal.fvg.type})`);
        }
        if (hasOB && hasFVG) signalsWithBoth++;
        if (hasOB || hasFVG) signalsWithEither++;
      });
    } else {
      console.log(`   No signals generated`);
    }
  }

  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('                    DETECTION RESULTS                      ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const obRate = totalSignals > 0 ? ((signalsWithOB / totalSignals) * 100).toFixed(1) : 0;
  const fvgRate = totalSignals > 0 ? ((signalsWithFVG / totalSignals) * 100).toFixed(1) : 0;
  const eitherRate = totalSignals > 0 ? ((signalsWithEither / totalSignals) * 100).toFixed(1) : 0;
  const bothRate = totalSignals > 0 ? ((signalsWithBoth / totalSignals) * 100).toFixed(1) : 0;

  console.log(`📈 Total Signals: ${totalSignals}`);
  console.log(``);

  console.log(`🔷 Order Block Detection:`);
  console.log(`   Signals with OBs: ${signalsWithOB}/${totalSignals} (${obRate}%)`);
  console.log(`   Target: 40-60%`);
  if (obRate >= 40 && obRate <= 60) {
    console.log(`   Status: ✅ PASS (within target range)`);
  } else if (obRate > 60) {
    console.log(`   Status: ✅ EXCELLENT (exceeds target)`);
  } else if (obRate >= 20) {
    console.log(`   Status: ⚠️  IMPROVED (below target but progress made)`);
  } else if (obRate > 0) {
    console.log(`   Status: ⚠️  MINIMAL (needs more tuning)`);
  } else {
    console.log(`   Status: ❌ FAIL (no improvement)`);
  }

  console.log(``);
  console.log(`🔶 Fair Value Gap Detection:`);
  console.log(`   Signals with FVGs: ${signalsWithFVG}/${totalSignals} (${fvgRate}%)`);
  console.log(`   Target: 40-60%`);
  if (fvgRate >= 40 && fvgRate <= 60) {
    console.log(`   Status: ✅ PASS (within target range)`);
  } else if (fvgRate > 60) {
    console.log(`   Status: ✅ EXCELLENT (exceeds target)`);
  } else if (fvgRate >= 20) {
    console.log(`   Status: ⚠️  IMPROVED (below target but progress made)`);
  } else if (fvgRate > 0) {
    console.log(`   Status: ⚠️  MINIMAL (needs more tuning)`);
  } else {
    console.log(`   Status: ❌ FAIL (no improvement)`);
  }

  console.log(``);
  console.log(`📊 Combined Detection:`);
  console.log(`   With OB or FVG: ${signalsWithEither}/${totalSignals} (${eitherRate}%)`);
  console.log(`   With BOTH: ${signalsWithBoth}/${totalSignals} (${bothRate}%)`);
  console.log(`   Target: >50% combined`);
  if (eitherRate >= 50) {
    console.log(`   Status: ✅ PASS`);
  } else if (eitherRate >= 30) {
    console.log(`   Status: ⚠️  IMPROVED`);
  } else {
    console.log(`   Status: ❌ FAIL`);
  }

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`\n📉 Comparison to Previous (0% Detection):\n`);

  console.log(`   OB Detection:`);
  console.log(`   - Before: 0%`);
  console.log(`   - After:  ${obRate}%`);
  console.log(`   - Change: ${obRate > 0 ? '✅ IMPROVED by +' + obRate + '%' : '❌ NO CHANGE'}`);

  console.log(``);
  console.log(`   FVG Detection:`);
  console.log(`   - Before: 0%`);
  console.log(`   - After:  ${fvgRate}%`);
  console.log(`   - Change: ${fvgRate > 0 ? '✅ IMPROVED by +' + fvgRate + '%' : '❌ NO CHANGE'}`);

  console.log(``);
  console.log(`   Combined (OB or FVG):`);
  console.log(`   - Before: 0%`);
  console.log(`   - After:  ${eitherRate}%`);
  console.log(`   - Change: ${eitherRate > 0 ? '✅ IMPROVED by +' + eitherRate + '%' : '❌ NO CHANGE'}`);

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`\n🎯 FINAL VERDICT:\n`);

  if (eitherRate >= 50 && (obRate >= 40 || fvgRate >= 40)) {
    console.log('   ✅ OPTION 1 SUCCESSFUL!');
    console.log('   - Detection rates meet or exceed targets');
    console.log('   - Ready for production deployment');
    console.log('   - Expected win rate: 55-60% (based on backtest)\n');
  } else if (eitherRate >= 30) {
    console.log('   ⚠️  OPTION 1 PARTIAL SUCCESS');
    console.log('   - Detection rates improved but below targets');
    console.log('   - Consider Option 2-4 for further optimization');
    console.log('   - May still see improved win rates\n');
  } else if (eitherRate > 0) {
    console.log('   ⚠️  OPTION 1 MINIMAL IMPROVEMENT');
    console.log('   - Some detection but needs more work');
    console.log('   - Recommend increasing lookback further');
    console.log('   - Or consider alternative confirmation patterns\n');
  } else {
    console.log('   ❌ OPTION 1 NOT EFFECTIVE');
    console.log('   - No improvement in detection rates');
    console.log('   - May need to check if validation function is being called');
    console.log('   - Or consider different approach (Options 2-4)\n');
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(eitherRate >= 50 ? 0 : 1);

} catch (error) {
  console.error('\n❌ Test failed with error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
