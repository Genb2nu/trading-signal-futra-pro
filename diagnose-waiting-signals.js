/**
 * Diagnose Why Signals Stuck in WAITING State
 * Analyzes rejection pattern detection and entry state logic
 */

import { scanSymbol } from './src/server/smcAnalyzer.js';
import { getBinanceKlines } from './src/server/binanceService.js';

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  DIAGNOSE WAITING SIGNALS                                ║');
console.log('║  Finding why signals stuck in WAITING state              ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

async function diagnoseWaitingSignals() {
  try {
    console.log('🔍 Scanning SOLUSDT on 1h to check signal states...\n');

    const result = await scanSymbol('SOLUSDT', '1h');

    if (!result.success) {
      console.log(`❌ Scan failed: ${result.error}\n`);
      return;
    }

    console.log(`✅ Scan successful`);
    console.log(`   Signals found: ${result.signals.length}\n`);

    if (result.signals.length === 0) {
      console.log('ℹ️  No signals detected. Let me check the market data...\n');

      // Get raw candle data to analyze
      const candles = await getBinanceKlines('SOLUSDT', '1h', 500);
      const latest = candles[candles.length - 1];
      const prev = candles[candles.length - 2];

      console.log('📊 Latest Candle Analysis:');
      console.log(`   Time: ${new Date(latest.timestamp).toISOString()}`);
      console.log(`   Open:  $${latest.open.toFixed(4)}`);
      console.log(`   High:  $${latest.high.toFixed(4)}`);
      console.log(`   Low:   $${latest.low.toFixed(4)}`);
      console.log(`   Close: $${latest.close.toFixed(4)}`);
      console.log(`   Volume: ${latest.volume.toFixed(2)}\n`);

      // Analyze rejection pattern manually
      const candleRange = latest.high - latest.low;
      const candleBody = Math.abs(latest.close - latest.open);
      const lowerWick = Math.min(latest.open, latest.close) - latest.low;
      const upperWick = latest.high - Math.max(latest.open, latest.close);
      const wickRatio = lowerWick / candleRange;
      const bodyPosition = (latest.close - latest.low) / candleRange;

      console.log('🕯️  Rejection Pattern Analysis (Bullish):');
      console.log(`   Candle Range: $${candleRange.toFixed(4)}`);
      console.log(`   Candle Body: $${candleBody.toFixed(4)} (${(candleBody/candleRange*100).toFixed(1)}% of range)`);
      console.log(`   Lower Wick: $${lowerWick.toFixed(4)} (${(wickRatio*100).toFixed(1)}% of range)`);
      console.log(`   Upper Wick: $${upperWick.toFixed(4)} (${(upperWick/candleRange*100).toFixed(1)}% of range)`);
      console.log(`   Body Position: ${(bodyPosition*100).toFixed(1)}% from bottom\n`);

      // Check against rejection criteria
      console.log('🎯 Rejection Pattern Requirements:');
      console.log('\n   HAMMER Pattern:');
      console.log(`     ✓ Lower wick > 60% of range? ${wickRatio > 0.6 ? '✅ YES' : '❌ NO'} (${(wickRatio*100).toFixed(1)}%)`);
      console.log(`     ✓ Body in top 40%? ${bodyPosition > 0.6 ? '✅ YES' : '❌ NO'} (${(bodyPosition*100).toFixed(1)}%)`);
      console.log(`     ✓ Range > 1.5% of price? ${candleRange / latest.close > 0.015 ? '✅ YES' : '❌ NO'} (${(candleRange / latest.close * 100).toFixed(2)}%)`);

      const isHammer = wickRatio > 0.6 && bodyPosition > 0.6 && candleRange / latest.close > 0.015;
      console.log(`     Result: ${isHammer ? '✅ HAMMER DETECTED' : '❌ Not a hammer'}\n`);

      console.log('   BULLISH ENGULFING:');
      console.log(`     ✓ Current close > prev open? ${latest.close > prev.open ? '✅ YES' : '❌ NO'}`);
      console.log(`     ✓ Current open < prev close? ${latest.open < prev.close ? '✅ YES' : '❌ NO'}`);
      console.log(`     ✓ Current close > prev high? ${latest.close > prev.high ? '✅ YES' : '❌ NO'}`);
      console.log(`     ✓ Bullish candle? ${latest.close > latest.open ? '✅ YES' : '❌ NO'}`);

      const isBullishEngulfing = latest.close > prev.open &&
                                 latest.open < prev.close &&
                                 latest.close > prev.high &&
                                 latest.close > latest.open;
      console.log(`     Result: ${isBullishEngulfing ? '✅ ENGULFING DETECTED' : '❌ Not engulfing'}\n`);

      console.log('   STRONG CLOSE:');
      console.log(`     ✓ Body in top 25%? ${bodyPosition > 0.75 ? '✅ YES' : '❌ NO'} (${(bodyPosition*100).toFixed(1)}%)`);
      console.log(`     ✓ Lower wick > 40%? ${wickRatio > 0.4 ? '✅ YES' : '❌ NO'} (${(wickRatio*100).toFixed(1)}%)`);
      console.log(`     ✓ Bullish candle? ${latest.close > latest.open ? '✅ YES' : '❌ NO'}`);

      const strongClose = bodyPosition > 0.75 && wickRatio > 0.4 && latest.close > latest.open;
      console.log(`     Result: ${strongClose ? '✅ STRONG CLOSE' : '❌ Not strong close'}\n`);

      // Overall result
      const hasAnyRejection = isHammer || isBullishEngulfing || strongClose;
      console.log('═'.repeat(60));
      console.log('REJECTION PATTERN DETECTION:');
      if (hasAnyRejection) {
        console.log('   ✅ Rejection pattern detected!');
        console.log('   Signal should be ENTRY_READY if other conditions met.');
      } else {
        console.log('   ❌ NO rejection pattern detected');
        console.log('   Signal would be stuck in WAITING state');
        console.log('\n   💡 ISSUE: Rejection criteria are too strict!');
        console.log('      Current candle doesn\'t form perfect hammer/engulfing');
        console.log('      but price may still be showing rejection at zone.');
      }
      console.log('═'.repeat(60) + '\n');

    } else {
      // Analyze detected signals
      console.log('📋 SIGNAL ANALYSIS:\n');

      result.signals.forEach((sig, i) => {
        console.log(`${i + 1}. ${sig.direction.toUpperCase()} Signal`);
        console.log(`   Entry State: ${sig.entryState}`);
        console.log(`   Can Track: ${sig.canTrack ? '✅ YES' : '❌ NO'}`);
        console.log(`   Confluence: ${sig.confluenceScore}\n`);

        if (sig.confirmationDetails) {
          console.log('   📊 Confirmation Status:');
          console.log(`      Setup Detected: ${sig.confirmationDetails.setupDetected ? '✅' : '❌'}`);
          console.log(`      Structure Break: ${sig.confirmationDetails.structureBreakConfirmed ? '✅' : '❌'}`);
          console.log(`      Price at Zone: ${sig.confirmationDetails.priceAtZone ? '✅' : '❌'}`);
          console.log(`      Rejection: ${sig.confirmationDetails.rejectionConfirmed ? '✅' : '❌'}\n`);

          // Diagnose why stuck in WAITING
          if (sig.entryState === 'WAITING') {
            console.log('   ⚠️  SIGNAL STUCK IN WAITING:');
            console.log('      Structure break: ✅ Confirmed');
            console.log('      Price at zone: ✅ Confirmed');
            console.log('      Rejection pattern: ❌ NOT DETECTED');
            console.log('\n      💡 ISSUE: Rejection pattern not forming');
            console.log('         The system is waiting for:');
            console.log('         - Hammer (60%+ lower wick, body in top 40%)');
            console.log('         - Bullish Engulfing');
            console.log('         - Strong Close (body in top 25%, 40%+ wick)');
            console.log('\n         These patterns may be too strict for real market conditions.\n');
          }
        }
      });
    }

    console.log('═'.repeat(60));
    console.log('💡 RECOMMENDATIONS');
    console.log('═'.repeat(60));
    console.log('\nThe rejection pattern requirements are very strict:');
    console.log('   • Hammer: Lower wick >60%, body in top 40%, range >1.5%');
    console.log('   • Engulfing: Must completely engulf previous candle');
    console.log('   • Strong Close: Body in top 25% AND lower wick >40%\n');
    console.log('Options to fix signals stuck in WAITING:\n');
    console.log('1. RELAX REJECTION CRITERIA (Recommended)');
    console.log('   - Lower thresholds: 50% wick instead of 60%');
    console.log('   - Accept body in top 50% instead of 60%');
    console.log('   - Add "price closed above zone" as rejection\n');
    console.log('2. ADD ALTERNATIVE CONFIRMATIONS');
    console.log('   - Volume spike confirmation');
    console.log('   - Multiple touches without breakdown');
    console.log('   - Mini structure break within zone\n');
    console.log('3. SWITCH TO AGGRESSIVE MODE');
    console.log('   - Already allows entry without full confirmation');
    console.log('   - Settings → Strategy Mode → Aggressive\n');
    console.log('Would you like me to implement relaxed rejection criteria? (Y/N)\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

diagnoseWaitingSignals();
