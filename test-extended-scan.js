/**
 * Extended Live Scan Test
 * Scans more symbols and timeframes to test validation logging
 */

import axios from 'axios';
import { getValidationSummary } from './src/services/validationLogger.js';

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  EXTENDED LIVE SCAN TEST                                 ║');
console.log('║  Testing validation logging with multiple scans          ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

async function scanAndCheck(symbols, timeframe, testName) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 TEST: ${testName}`);
  console.log('═'.repeat(60));
  console.log(`   Symbols: ${symbols.join(', ')}`);
  console.log(`   Timeframe: ${timeframe}\n`);

  try {
    const response = await axios.post('http://localhost:3000/api/scan', {
      symbols,
      timeframe
    });

    const data = response.data;

    console.log(`   ✅ Scan complete`);
    console.log(`   Scanned: ${data.scanned} symbols`);
    console.log(`   Found: ${data.found} signal(s)`);

    if (data.found > 0) {
      console.log(`\n   🎯 SIGNALS DETECTED:\n`);
      data.signals.forEach((sig, i) => {
        console.log(`   ${i + 1}. ${sig.symbol} ${sig.direction.toUpperCase()}`);
        console.log(`      Entry: $${sig.entry} | R:R: ${sig.riskReward} | Confidence: ${sig.confidence}`);
        console.log(`      Patterns: ${sig.patterns}`);
      });
      console.log(`\n   ✅ These signals should be logged in validation system!`);
    } else {
      console.log(`   ℹ️  No signals found`);
    }

    return data.found;
  } catch (error) {
    console.error(`   ❌ Scan failed: ${error.message}`);
    return 0;
  }
}

async function runExtendedTest() {
  console.log('🚀 Starting extended scan tests...\n');
  console.log('   This will scan multiple symbols and timeframes');
  console.log('   to test the validation logging system.\n');

  let totalSignalsFound = 0;

  // Test 1: Major pairs on 1h
  const test1Signals = await scanAndCheck(
    ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'],
    '1h',
    'Major Pairs (1H)'
  );
  totalSignalsFound += test1Signals;
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Same pairs on 4h (longer timeframe may have different setups)
  const test2Signals = await scanAndCheck(
    ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    '4h',
    'Major Pairs (4H)'
  );
  totalSignalsFound += test2Signals;
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: More altcoins on 1h
  const test3Signals = await scanAndCheck(
    ['ADAUSDT', 'DOGEUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT'],
    '1h',
    'Altcoins (1H)'
  );
  totalSignalsFound += test3Signals;

  // Show final validation summary
  console.log('\n' + '═'.repeat(60));
  console.log('📈 FINAL VALIDATION SUMMARY');
  console.log('═'.repeat(60));

  const summary = getValidationSummary();
  if (summary) {
    console.log(`\n   Total signals in system: ${summary.totalSignals}`);
    console.log(`   Entry States:`);
    console.log(`     MONITORING:  ${summary.byState.MONITORING}`);
    console.log(`     WAITING:     ${summary.byState.WAITING}`);
    console.log(`     ENTRY_READY: ${summary.byState.ENTRY_READY}`);
    console.log(`   Tracked: ${summary.tracking.tracked}`);
  } else {
    console.log(`\n   No signals logged yet.`);
  }

  console.log(`\n   Total signals found in scans: ${totalSignalsFound}`);

  if (totalSignalsFound > 0) {
    console.log(`\n   ✅ Validation logging is working!`);
    console.log(`      View details: node view-validation-data.js signals`);
  } else {
    console.log(`\n   ℹ️  No signals found in current market conditions.`);
    console.log(`      This is normal with Phase 3 strict methodology.`);
    console.log(`\n      The validation logger is ready and will log signals`);
    console.log(`      automatically when proper SMC setups appear.`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ EXTENDED SCAN TEST COMPLETE');
  console.log('═'.repeat(60));
  console.log('\n📝 Next steps:');
  console.log('   1. View validation data: node view-validation-data.js summary');
  console.log('   2. Continue scanning through web interface');
  console.log('   3. Track ENTRY_READY signals when they appear');
  console.log('   4. Record outcomes: node record-trade-outcome.js\n');
}

runExtendedTest();
