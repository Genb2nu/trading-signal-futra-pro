/**
 * Comprehensive Scan - Find Any Signals
 * Scans many symbols and timeframes to find active setups
 */

import axios from 'axios';
import { getValidationSummary } from './src/services/validationLogger.js';

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  COMPREHENSIVE SIGNAL SCAN                               ║');
console.log('║  Finding signals across multiple symbols & timeframes    ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const topSymbols = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT',
  'LINKUSDT', 'ATOMUSDT', 'NEARUSDT', 'UNIUSDT', 'LTCUSDT',
  'ETCUSDT', 'FILUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT'
];

const timeframes = ['15m', '1h', '4h'];

async function scanBatch(symbols, timeframe) {
  try {
    const response = await axios.post('http://localhost:3000/api/scan', {
      symbols,
      timeframe
    });
    return response.data;
  } catch (error) {
    console.error(`   ❌ Scan failed: ${error.message}`);
    return { success: false, signals: [] };
  }
}

async function comprehensiveScan() {
  console.log(`🔍 Scanning ${topSymbols.length} symbols across ${timeframes.length} timeframes...\n`);

  let totalScanned = 0;
  let totalSignals = 0;
  const allSignals = [];

  for (const timeframe of timeframes) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`⏰ TIMEFRAME: ${timeframe.toUpperCase()}`);
    console.log('═'.repeat(60));

    // Scan in batches of 5 to avoid overwhelming
    for (let i = 0; i < topSymbols.length; i += 5) {
      const batch = topSymbols.slice(i, i + 5);
      process.stdout.write(`   Scanning ${batch.join(', ')}... `);

      const result = await scanBatch(batch, timeframe);
      totalScanned += batch.length;

      if (result.success && result.signals && result.signals.length > 0) {
        console.log(`✅ ${result.signals.length} signal(s) found!`);
        totalSignals += result.signals.length;
        allSignals.push(...result.signals.map(s => ({ ...s, timeframe })));
      } else {
        console.log('0 signals');
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 SCAN COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Symbols scanned: ${totalScanned}`);
  console.log(`   Signals found: ${totalSignals}\n`);

  if (allSignals.length > 0) {
    console.log('🎯 SIGNALS DETECTED:\n');

    // Group by entry state
    const byState = {
      ENTRY_READY: allSignals.filter(s => s.entryState === 'ENTRY_READY' || s.canTrack),
      WAITING: allSignals.filter(s => s.entryState === 'WAITING'),
      MONITORING: allSignals.filter(s => s.entryState === 'MONITORING' || (!s.entryState && !s.canTrack))
    };

    if (byState.ENTRY_READY.length > 0) {
      console.log(`🟢 ENTRY_READY (${byState.ENTRY_READY.length}):`);
      byState.ENTRY_READY.forEach((sig, i) => {
        console.log(`   ${i + 1}. ${sig.symbol} ${sig.direction?.toUpperCase() || 'N/A'} [${sig.timeframe}]`);
        console.log(`      Entry: $${sig.entry} | R:R: ${sig.riskReward} | Confidence: ${sig.confidence}`);
        console.log(`      ✅ CAN TRACK - Track button should be enabled!\n`);
      });
    }

    if (byState.WAITING.length > 0) {
      console.log(`🟡 WAITING (${byState.WAITING.length}):`);
      byState.WAITING.forEach((sig, i) => {
        console.log(`   ${i + 1}. ${sig.symbol} ${sig.direction?.toUpperCase() || 'N/A'} [${sig.timeframe}]`);
        console.log(`      Waiting for rejection confirmation at OB zone\n`);
      });
    }

    if (byState.MONITORING.length > 0) {
      console.log(`🔵 MONITORING (${byState.MONITORING.length}):`);
      byState.MONITORING.forEach((sig, i) => {
        console.log(`   ${i + 1}. ${sig.symbol} ${sig.direction?.toUpperCase() || 'N/A'} [${sig.timeframe}]`);
        console.log(`      Waiting for BOS/CHoCH structure break\n`);
      });
    }

    console.log('✅ All signals have been logged to validation system!\n');
  } else {
    console.log('ℹ️  No signals found across all scans.\n');
    console.log('📌 This means current market conditions do NOT have setups that meet:');
    console.log('   • ICT-validated Order Blocks (clean candle, volume, structure)');
    console.log('   • BOS or CHoCH (structure break)');
    console.log('   • Price return to OB zone');
    console.log('   • Rejection pattern (with relaxed criteria)\n');
    console.log('💡 This is actually GOOD - it shows the system is strict!');
    console.log('   When signals DO appear, they will be high-quality setups.\n');
  }

  // Show validation summary
  const summary = getValidationSummary();
  if (summary && summary.totalSignals > 0) {
    console.log('═'.repeat(60));
    console.log('📈 VALIDATION SYSTEM SUMMARY');
    console.log('═'.repeat(60));
    console.log(`   Total signals logged: ${summary.totalSignals}`);
    console.log(`   ENTRY_READY: ${summary.byState.ENTRY_READY}`);
    console.log(`   WAITING: ${summary.byState.WAITING}`);
    console.log(`   MONITORING: ${summary.byState.MONITORING}`);
    console.log(`   Tracked: ${summary.tracking.tracked}`);
    if (summary.tracking.winRate && summary.tracking.trackedWithOutcome > 0) {
      console.log(`   Win Rate: ${summary.tracking.winRate}%`);
    }
    console.log('');
  }

  console.log('═'.repeat(60));
  console.log('📝 WHAT TO DO NEXT');
  console.log('═'.repeat(60));

  if (totalSignals > 0) {
    console.log('   1. Open web interface: http://localhost:3000');
    console.log('   2. Check signals tab for ENTRY_READY signals');
    console.log('   3. Track signals when Track button is enabled');
    console.log('   4. Monitor tracked trades');
  } else {
    console.log('   📊 OPTION 1: Keep scanning periodically');
    console.log('      Market conditions change - check every few hours');
    console.log('');
    console.log('   ⚙️  OPTION 2: Switch to Aggressive mode');
    console.log('      Settings → Strategy Mode → Aggressive');
    console.log('      Less strict = more signals (but lower quality)');
    console.log('');
    console.log('   🔍 OPTION 3: Check if OBs are being detected');
    console.log('      Run: node diagnose-waiting-signals.js');
    console.log('      See if Order Blocks are forming but not signaling');
  }

  console.log('\n' + '═'.repeat(60) + '\n');
}

comprehensiveScan();
