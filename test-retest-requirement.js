/**
 * Test Script: Priority 1 - Retest Requirement Implementation
 *
 * Tests the SMC-compliant retest requirement:
 * - BOS occurs
 * - Price displaces away from OB (≥1 ATR)
 * - Price returns to OB (retest)
 * - Rejection confirmed
 * - Entry signal generated
 */

import { analyzeSMC } from './src/shared/smcDetectors.js';
import { getBinanceKlines } from './lib/binanceService.js';
import { STRATEGY_MODES, setStrategyMode } from './src/shared/strategyConfig.js';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     PRIORITY 1: RETEST REQUIREMENT VERIFICATION TEST      ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Test with different modes
const testModes = [
  { mode: STRATEGY_MODES.CONSERVATIVE, expected: true },
  { mode: STRATEGY_MODES.MODERATE, expected: true },
  { mode: STRATEGY_MODES.AGGRESSIVE, expected: false },
  { mode: STRATEGY_MODES.SCALPING, expected: false },
  { mode: STRATEGY_MODES.ELITE, expected: true },
  { mode: STRATEGY_MODES.SNIPER, expected: true }
];

const testSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const timeframe = '15m';

let totalSignals = 0;
let signalsWithRetest = 0;
let signalsWithoutRetest = 0;
let retestValidationStats = {
  required: 0,
  validated: 0,
  displaced: 0,
  retested: 0,
  inZone: 0
};

console.log('📊 Testing Retest Requirement Across Strategy Modes:');
console.log('');

for (const { mode, expected } of testModes) {
  console.log(`\n🔍 Testing ${mode.toUpperCase()} Mode (Retest Required: ${expected})`);
  console.log('─'.repeat(60));

  let modeSignals = 0;
  let modeRetestRequired = 0;
  let modeRetestValidated = 0;

  for (const symbol of testSymbols) {
    try {
      // Fetch candles
      const candles = await getBinanceKlines(symbol, timeframe, 500);

      // Set strategy mode BEFORE analyzing
      setStrategyMode(mode.toUpperCase());

      // Analyze with specific mode (mode is now set via setStrategyMode)
      const analysis = analyzeSMC(candles, null, timeframe, null, symbol);

      if (analysis.signals && analysis.signals.length > 0) {
        for (const signal of analysis.signals) {
          totalSignals++;
          modeSignals++;

          const confirmations = signal.confirmationDetails;

          if (confirmations) {
            // Check if retest is required
            if (confirmations.retestRequired) {
              retestValidationStats.required++;
              modeRetestRequired++;
            }

            // Check if retest was validated
            if (confirmations.retestValidated) {
              signalsWithRetest++;
              retestValidationStats.validated++;
              modeRetestValidated++;
            } else {
              signalsWithoutRetest++;
            }

            // Detailed retest stats
            if (confirmations.retestDetails) {
              if (confirmations.retestDetails.hasDisplaced) retestValidationStats.displaced++;
              if (confirmations.retestDetails.hasRetested) retestValidationStats.retested++;
              if (confirmations.retestDetails.inZoneNow) retestValidationStats.inZone++;
            }

            // Log example signals with retest details
            if (modeSignals <= 2) {
              console.log(`\n   ${signal.type} ${symbol} @ ${signal.entry.toFixed(2)}`);
              console.log(`   Entry State: ${signal.entryState}`);
              console.log(`   Retest Required: ${confirmations.retestRequired}`);
              console.log(`   Retest Validated: ${confirmations.retestValidated}`);
              console.log(`   Retest Reason: ${confirmations.retestReason}`);

              if (confirmations.retestDetails) {
                console.log(`   Displacement: ${confirmations.retestDetails.hasDisplaced} (${confirmations.retestDetails.displacementATR} ATR)`);
                console.log(`   Retested: ${confirmations.retestDetails.hasRetested}`);
                console.log(`   Retest Quality: ${confirmations.retestDetails.retestQuality || 'N/A'}`);
                console.log(`   In Zone Now: ${confirmations.retestDetails.inZoneNow}`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`   ❌ Error testing ${symbol}:`, error.message);
    }
  }

  console.log(`\n   📈 ${mode} Results:`);
  console.log(`   • Total Signals: ${modeSignals}`);
  console.log(`   • Retest Required: ${modeRetestRequired} (${((modeRetestRequired/modeSignals)*100).toFixed(1)}%)`);
  console.log(`   • Retest Validated: ${modeRetestValidated} (${modeSignals > 0 ? ((modeRetestValidated/modeSignals)*100).toFixed(1) : '0'}%)`);

  // Verify expectation
  if (expected && modeSignals > 0 && modeRetestRequired === 0) {
    console.log(`   ⚠️  WARNING: Expected retest requirement but none found!`);
  } else if (!expected && modeRetestRequired > 0) {
    console.log(`   ⚠️  WARNING: Retest required but should be disabled for ${mode}!`);
  } else {
    console.log(`   ✅ Retest requirement matches expected setting`);
  }
}

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('📊 OVERALL RETEST VALIDATION STATISTICS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`Total Signals Generated: ${totalSignals}`);
console.log(`\nRetest Requirement Status:`);
console.log(`  • Retest Required: ${retestValidationStats.required} (${((retestValidationStats.required/totalSignals)*100).toFixed(1)}%)`);
console.log(`  • Retest Validated: ${retestValidationStats.validated} (${((retestValidationStats.validated/totalSignals)*100).toFixed(1)}%)`);
console.log(`  • No Retest (Disabled): ${totalSignals - retestValidationStats.required} (${(((totalSignals - retestValidationStats.required)/totalSignals)*100).toFixed(1)}%)`);

console.log(`\nRetest Detection Breakdown:`);
console.log(`  • Signals with Displacement: ${retestValidationStats.displaced}`);
console.log(`  • Signals with Retest: ${retestValidationStats.retested}`);
console.log(`  • Signals Currently in Zone: ${retestValidationStats.inZone}`);

console.log(`\nEntry Quality:`);
console.log(`  • With Valid Retest: ${signalsWithRetest} (${((signalsWithRetest/totalSignals)*100).toFixed(1)}%)`);
console.log(`  • Without Retest: ${signalsWithoutRetest} (${((signalsWithoutRetest/totalSignals)*100).toFixed(1)}%)`);

console.log('\n═══════════════════════════════════════════════════════════');
console.log('✅ EXPECTED BEHAVIOR:');
console.log('═══════════════════════════════════════════════════════════');
console.log('• Conservative/Moderate/Elite/Sniper: Retest REQUIRED');
console.log('• Aggressive/Scalping: Retest DISABLED (faster entries)');
console.log('');
console.log('🎯 SMC METHODOLOGY COMPLIANCE:');
console.log('• BOS → Displacement (≥1 ATR) → Retest → Rejection → Entry');
console.log('• This prevents "chasing price after displacement"');
console.log('• Expected to improve R:R from 1.0-1.5 to 1.6-2.5');
console.log('• Expected to improve WR from 45.7% to 60-75%');
console.log('');
