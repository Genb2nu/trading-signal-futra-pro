/**
 * Test Option 1 Fix: Verify improved OB/FVG detection
 *
 * Expected improvements:
 * - FVG lookback: 5 → 15 candles (3x)
 * - OB lookback: 10 → 20 candles (2x)
 * - Accept patterns BEFORE and AFTER BOS/CHoCH
 * - Target: 40-60% detection rate
 */

import { scanMultipleSymbols, formatSignalsForDisplay } from './lib/smcAnalyzer.js';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Testing Option 1: Increased OB/FVG Lookback Range       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('📊 Changes:');
console.log('   - FVG lookback: 5 → 15 candles (3x increase)');
console.log('   - OB lookback: 10 → 20 candles (2x increase)');
console.log('   - Accept patterns BEFORE and AFTER BOS/CHoCH');
console.log('   - Expected detection rate: 40-60%\n');

// Test with a small sample of symbols
const testSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'];
const timeframe = '15m';

console.log(`🔄 Scanning ${testSymbols.length} symbols on ${timeframe}...\n`);

try {
  const results = await scanMultipleSymbols(testSymbols, timeframe);
  const signals = formatSignalsForDisplay(results);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                    TEST RESULTS                           ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Count signals with OBs and FVGs
  let withOB = 0;
  let withFVG = 0;
  let withBoth = 0;
  let withEither = 0;

  signals.forEach(signal => {
    const hasOB = signal.patterns?.hasOrderBlock === true;
    const hasFVG = signal.patterns?.hasFVG === true;

    if (hasOB) withOB++;
    if (hasFVG) withFVG++;
    if (hasOB && hasFVG) withBoth++;
    if (hasOB || hasFVG) withEither++;
  });

  const totalSignals = signals.length;
  const obRate = totalSignals > 0 ? ((withOB / totalSignals) * 100).toFixed(1) : 0;
  const fvgRate = totalSignals > 0 ? ((withFVG / totalSignals) * 100).toFixed(1) : 0;
  const eitherRate = totalSignals > 0 ? ((withEither / totalSignals) * 100).toFixed(1) : 0;

  console.log(`📈 Total Signals Generated: ${totalSignals}`);
  console.log(`\n🔷 Order Block Detection:`);
  console.log(`   - Signals with OBs: ${withOB}/${totalSignals} (${obRate}%)`);
  console.log(`   - Target: 40-60%`);
  console.log(`   - Status: ${obRate >= 40 ? '✅ PASS' : obRate > 0 ? '⚠️  IMPROVED (but below target)' : '❌ FAIL'}`);

  console.log(`\n🔶 Fair Value Gap Detection:`);
  console.log(`   - Signals with FVGs: ${withFVG}/${totalSignals} (${fvgRate}%)`);
  console.log(`   - Target: 40-60%`);
  console.log(`   - Status: ${fvgRate >= 40 ? '✅ PASS' : fvgRate > 0 ? '⚠️  IMPROVED (but below target)' : '❌ FAIL'}`);

  console.log(`\n📊 Combined Detection:`);
  console.log(`   - Signals with OB or FVG: ${withEither}/${totalSignals} (${eitherRate}%)`);
  console.log(`   - Signals with BOTH: ${withBoth}/${totalSignals}`);

  console.log(`\n═══════════════════════════════════════════════════════════`);

  // Compare to previous (0% detection)
  console.log(`\n📉 Comparison to Previous (0% Detection):`);
  console.log(`   - OB Detection: 0% → ${obRate}% (${obRate > 0 ? '✅ IMPROVED' : '❌ NO CHANGE'})`);
  console.log(`   - FVG Detection: 0% → ${fvgRate}% (${fvgRate > 0 ? '✅ IMPROVED' : '❌ NO CHANGE'})`);
  console.log(`   - Combined: 0% → ${eitherRate}% (${eitherRate > 0 ? '✅ IMPROVED' : '❌ NO CHANGE'})`);

  // Show sample signals with patterns
  console.log(`\n📋 Sample Signals with OB/FVG:\n`);
  const samplesWithPatterns = signals.filter(s => s.patterns?.hasOrderBlock || s.patterns?.hasFVG).slice(0, 3);

  if (samplesWithPatterns.length > 0) {
    samplesWithPatterns.forEach((signal, i) => {
      console.log(`${i + 1}. ${signal.symbol} (${signal.direction.toUpperCase()})`);
      console.log(`   - OB: ${signal.patterns?.hasOrderBlock ? '✅' : '❌'}`);
      console.log(`   - FVG: ${signal.patterns?.hasFVG ? '✅' : '❌'}`);
      console.log(`   - BOS: ${signal.patterns?.hasBOS ? '✅' : '❌'}`);
      console.log(`   - CHoCH: ${signal.patterns?.hasCHOCH ? '✅' : '❌'}`);
      console.log(`   - Entry: ${signal.entry.toFixed(6)}`);
      console.log(`   - Confluence: ${signal.confluenceScore}`);
      console.log('');
    });
  } else {
    console.log('   ⚠️  No signals with OB/FVG detected in this sample');
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  // Overall verdict
  if (eitherRate >= 40) {
    console.log('✅ TEST PASSED: Detection rate meets target (40-60%)');
    console.log('   Ready to deploy to production!\n');
  } else if (eitherRate > 0) {
    console.log('⚠️  TEST PARTIAL: Detection improved but below target');
    console.log('   Consider further adjustments or proceed with caution.\n');
  } else {
    console.log('❌ TEST FAILED: No improvement in detection rate');
    console.log('   Need to investigate further.\n');
  }

  process.exit(0);

} catch (error) {
  console.error('\n❌ Test failed with error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
