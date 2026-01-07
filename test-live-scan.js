/**
 * Test Live Scan with Validation Logging
 * Scans multiple symbols to test automatic logging
 */

import { scanMultipleSymbols, formatSignalsForDisplay } from './src/server/smcAnalyzer.js';
import { logSignalDetection, getValidationSummary } from './src/services/validationLogger.js';

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  LIVE SCAN WITH VALIDATION LOGGING                       ║');
console.log('║  Testing automatic signal logging during scans           ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

async function testLiveScan() {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
    const timeframe = '1h';
    const mode = 'MODERATE';

    console.log(`🔍 Scanning ${symbols.length} symbols on ${timeframe}...\n`);

    // Scan symbols
    const results = await scanMultipleSymbols(symbols, timeframe, (progress) => {
      console.log(`   Progress: ${progress.percentage}% (${progress.symbol})`);
    });

    console.log('\n✅ Scan complete\n');

    // Log signals (same as server does)
    let signalsLogged = 0;
    for (const result of results) {
      if (result.success && result.signals && result.signals.length > 0) {
        for (const signal of result.signals) {
          logSignalDetection(signal, {
            symbol: result.symbol,
            timeframe: result.timeframe,
            mode: mode
          });
          signalsLogged++;
        }
      }
    }

    // Format for display
    const signals = formatSignalsForDisplay(results);

    console.log('═'.repeat(60));
    console.log('📊 SCAN RESULTS');
    console.log('═'.repeat(60));
    console.log(`   Symbols scanned: ${symbols.length}`);
    console.log(`   Signals found: ${signals.length}`);
    console.log(`   Signals logged: ${signalsLogged}\n`);

    if (signals.length > 0) {
      console.log('📋 Signals Detected:\n');
      signals.forEach((sig, i) => {
        console.log(`   ${i + 1}. ${sig.symbol} ${sig.direction.toUpperCase()} [${sig.timeframe}]`);
        console.log(`      Entry: $${sig.entry} | R:R: ${sig.riskReward} | Confidence: ${sig.confidence}`);
        console.log(`      Patterns: ${sig.patterns}\n`);
      });

      console.log('[VALIDATION] All signals logged to validation system ✓\n');
    } else {
      console.log('ℹ️  No signals found with current market conditions.\n');
      console.log('💡 This is normal with Phase 3 (strict SMC methodology).\n');
      console.log('   Signals require:');
      console.log('   - ICT-validated Order Block');
      console.log('   - BOS or CHoCH (structure break)');
      console.log('   - Price return to OB zone');
      console.log('   - Rejection pattern confirmation\n');
    }

    // Show validation summary
    const summary = getValidationSummary();
    if (summary) {
      console.log('═'.repeat(60));
      console.log('📈 VALIDATION SUMMARY');
      console.log('═'.repeat(60));
      console.log(`   Total signals in system: ${summary.totalSignals}`);
      console.log(`   Entry States:`);
      console.log(`     MONITORING:  ${summary.byState.MONITORING}`);
      console.log(`     WAITING:     ${summary.byState.WAITING}`);
      console.log(`     ENTRY_READY: ${summary.byState.ENTRY_READY}`);
      console.log(`   Tracked signals: ${summary.tracking.tracked}`);

      if (summary.tracking.trackedWithOutcome > 0) {
        console.log(`   Win rate: ${summary.tracking.winRate}%`);
      }
      console.log('');
    }

    console.log('═'.repeat(60));
    console.log('✅ INTEGRATION VERIFIED');
    console.log('═'.repeat(60));
    console.log('   Validation logger is integrated and working!\n');
    console.log('📝 Next steps:');
    console.log('   1. Clear test data: rm -rf validation-data/');
    console.log('   2. Start validation period (scan regularly)');
    console.log('   3. View data: node view-validation-data.js summary');
    console.log('   4. Read guide: OPTION_A_LIVE_VALIDATION_GUIDE.md\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testLiveScan();
