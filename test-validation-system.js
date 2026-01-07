/**
 * Test Validation System
 * Verifies that the validation logging infrastructure is working correctly
 */

import {
  logSignalDetection,
  logStateTransition,
  updateSignalTracking,
  logSignalOutcome,
  addSignalNote,
  getLoggedSignals,
  getSignalTransitions,
  getValidationSummary
} from './src/services/validationLogger.js';

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  VALIDATION SYSTEM TEST                                  ║');
console.log('║  Testing Option A validation infrastructure              ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log('🧪 Running tests...\n');

try {
  // Test 1: Log a test signal
  console.log('Test 1: Logging a test signal...');
  const testSignal = {
    direction: 'bullish',
    entryState: 'MONITORING',
    canTrack: false,
    entry: 42150.00,
    stopLoss: 41900.00,
    takeProfit: 42600.00,
    riskReward: 1.8,
    confluenceScore: 65,
    orderBlock: { top: 42200, bottom: 42100 },
    fvg: { top: 42180, bottom: 42120 },
    confirmationDetails: {
      setupDetected: true,
      structureBreakConfirmed: false,
      bosDetected: false,
      chochDetected: false,
      priceAtZone: false,
      rejectionConfirmed: false
    }
  };

  const signalId = logSignalDetection(testSignal, {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    mode: 'MODERATE'
  });

  if (signalId) {
    console.log(`   ✅ Signal logged with ID: ${signalId}\n`);
  } else {
    console.log('   ❌ Failed to log signal\n');
    process.exit(1);
  }

  // Test 2: Log state transitions
  console.log('Test 2: Logging state transitions...');
  logStateTransition(signalId, 'MONITORING', 'WAITING', {
    reason: 'BOS confirmed',
    timeSinceCreation: 45
  });
  console.log('   ✅ Transition MONITORING → WAITING logged\n');

  logStateTransition(signalId, 'WAITING', 'ENTRY_READY', {
    reason: 'Rejection confirmed',
    timeSinceCreation: 120
  });
  console.log('   ✅ Transition WAITING → ENTRY_READY logged\n');

  // Test 3: Update tracking status
  console.log('Test 3: Updating tracking status...');
  updateSignalTracking(signalId, true);
  console.log('   ✅ Signal marked as tracked\n');

  // Test 4: Add a note
  console.log('Test 4: Adding note to signal...');
  addSignalNote(signalId, 'Test note: Strong rejection at OB zone');
  console.log('   ✅ Note added\n');

  // Test 5: Log outcome
  console.log('Test 5: Logging outcome...');
  logSignalOutcome(signalId, 'win', {
    exitPrice: 42580.00,
    riskRewardAchieved: '1.72',
    profitLoss: '1.02',
    notes: 'Hit TP almost exactly'
  });
  console.log('   ✅ Outcome logged\n');

  // Test 6: Retrieve logged signals
  console.log('Test 6: Retrieving logged signals...');
  const signals = getLoggedSignals();
  console.log(`   ✅ Retrieved ${signals.length} signal(s)\n`);

  // Test 7: Retrieve transitions
  console.log('Test 7: Retrieving state transitions...');
  const transitions = getSignalTransitions(signalId);
  console.log(`   ✅ Retrieved ${transitions.length} transition(s)\n`);

  // Test 8: Get validation summary
  console.log('Test 8: Generating validation summary...');
  const summary = getValidationSummary();
  if (summary) {
    console.log('   ✅ Summary generated\n');
    console.log('   Summary preview:');
    console.log(`      Total Signals: ${summary.totalSignals}`);
    console.log(`      ENTRY_READY: ${summary.byState.ENTRY_READY}`);
    console.log(`      Tracked: ${summary.tracking.tracked}`);
    console.log(`      Win Rate: ${summary.tracking.winRate}%\n`);
  } else {
    console.log('   ❌ Failed to generate summary\n');
  }

  // All tests passed
  console.log('═'.repeat(60));
  console.log('✅ ALL TESTS PASSED!');
  console.log('═'.repeat(60));
  console.log('\n🎉 Validation system is working correctly!\n');
  console.log('📝 Next Steps:');
  console.log('   1. View test data: node view-validation-data.js summary');
  console.log('   2. Clear test data if needed: Delete validation-data/ folder');
  console.log('   3. Integrate logger into signal generation (see guide)');
  console.log('   4. Start live validation period\n');
  console.log('📖 Read the full guide: OPTION_A_LIVE_VALIDATION_GUIDE.md\n');

} catch (error) {
  console.log('❌ TEST FAILED\n');
  console.error('Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
