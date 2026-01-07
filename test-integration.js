/**
 * Test Validation Logger Integration
 * Verifies that signals are automatically logged during real scans
 */

import { scanSymbol } from './src/server/smcAnalyzer.js';
import { logSignalDetection } from './src/services/validationLogger.js';
import { getValidationSummary, getLoggedSignals } from './src/services/validationLogger.js';

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  VALIDATION LOGGER INTEGRATION TEST                      ║');
console.log('║  Testing live signal detection and logging               ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

async function testIntegration() {
  try {
    console.log('📊 Scanning BTCUSDT on 1h timeframe...\n');

    // Get signals count before scan
    const beforeSignals = getLoggedSignals();
    const beforeCount = beforeSignals.length;

    // Scan a single symbol
    const result = await scanSymbol('BTCUSDT', '1h');

    if (!result.success) {
      console.log(`❌ Scan failed: ${result.error}\n`);
      return;
    }

    console.log(`✅ Scan successful`);
    console.log(`   Symbol: ${result.symbol}`);
    console.log(`   Timeframe: ${result.timeframe}`);
    console.log(`   Signals found: ${result.signals.length}\n`);

    // Log each signal (simulating what the server does)
    if (result.signals.length > 0) {
      console.log('📝 Logging signals to validation system...\n');

      for (const signal of result.signals) {
        logSignalDetection(signal, {
          symbol: result.symbol,
          timeframe: result.timeframe,
          mode: 'MODERATE'
        });

        console.log(`   ✓ Logged ${signal.direction.toUpperCase()} signal`);
        console.log(`     Entry State: ${signal.entryState}`);
        console.log(`     Confluence: ${signal.confluenceScore}`);
        console.log(`     Can Track: ${signal.canTrack ? 'YES' : 'NO'}\n`);
      }
    } else {
      console.log('ℹ️  No signals found on current scan\n');
    }

    // Get signals count after scan
    const afterSignals = getLoggedSignals();
    const afterCount = afterSignals.length;
    const newSignals = afterCount - beforeCount;

    console.log('═'.repeat(60));
    console.log('📊 VALIDATION SYSTEM STATUS');
    console.log('═'.repeat(60));
    console.log(`   Signals before scan: ${beforeCount}`);
    console.log(`   Signals after scan:  ${afterCount}`);
    console.log(`   New signals logged:  ${newSignals}\n`);

    if (newSignals > 0) {
      console.log('✅ Integration working! Signals are being logged automatically.\n');

      // Show summary
      const summary = getValidationSummary();
      if (summary) {
        console.log('📈 Quick Summary:');
        console.log(`   Total signals: ${summary.totalSignals}`);
        console.log(`   MONITORING: ${summary.byState.MONITORING}`);
        console.log(`   WAITING: ${summary.byState.WAITING}`);
        console.log(`   ENTRY_READY: ${summary.byState.ENTRY_READY}\n`);
      }
    } else if (result.signals.length > 0) {
      console.log('⚠️  Signals were found but not logged. Check integration.\n');
    } else {
      console.log('ℹ️  No signals to log. Try scanning other symbols or timeframes.\n');
    }

    console.log('═'.repeat(60));
    console.log('View full data: node view-validation-data.js summary');
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testIntegration();
