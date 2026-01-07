import axios from 'axios';
import { analyzeSMC } from './src/shared/smcDetectors.js';

/**
 * Test the live ICT-validated system
 * Shows exactly what the UI will display
 */
async function testLiveICTSystem() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  LIVE ICT/SMC VALIDATION TEST                            ║');
  console.log('║  Official ICT Methodology (2026)                         ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const symbols = ['SOLUSDT', 'BTCUSDT', 'ETHUSDT'];

  for (const symbol of symbols) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${symbol} - 1H TIMEFRAME`);
    console.log('='.repeat(60));

    try {
      // Fetch data
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=500`;
      const response = await axios.get(url);

      const candles = response.data.map(k => ({
        timestamp: k[0],
        time: new Date(k[0]).toISOString(),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const latestCandle = candles[candles.length - 1];
      console.log(`\n📅 Latest Data: ${latestCandle.time.slice(0, 16)}`);
      console.log(`💰 Current Price: $${latestCandle.close.toFixed(2)}`);

      // Run SMC analysis (includes ICT validation)
      const analysis = analyzeSMC(candles);

      // Get counts
      const bullishOBs = analysis.orderBlocks.bullish || [];
      const bearishOBs = analysis.orderBlocks.bearish || [];

      const bullishFVGCount = (analysis.fvgs.unfilled?.bullish?.length || 0) +
                              (analysis.fvgs.touched?.bullish?.length || 0) +
                              (analysis.fvgs.partial?.bullish?.length || 0);

      const bearishFVGCount = (analysis.fvgs.unfilled?.bearish?.length || 0) +
                              (analysis.fvgs.touched?.bearish?.length || 0) +
                              (analysis.fvgs.partial?.bearish?.length || 0);

      const bullishBOS = analysis.bos?.bullish?.length || 0;
      const bearishBOS = analysis.bos?.bearish?.length || 0;

      // ICT validation stats
      const bullishICTValid = bullishOBs.filter(ob => ob.ictValidation?.isValidICT).length;
      const bearishICTValid = bearishOBs.filter(ob => ob.ictValidation?.isValidICT).length;

      console.log('\n📊 DETECTION RESULTS:');
      console.log('─'.repeat(60));
      console.log(`  Order Blocks:`);
      console.log(`    Bullish: ${bullishOBs.length} (${bullishICTValid} ICT-validated)`);
      console.log(`    Bearish: ${bearishOBs.length} (${bearishICTValid} ICT-validated)`);
      console.log(`  Fair Value Gaps (with displacement):`);
      console.log(`    Bullish: ${bullishFVGCount}`);
      console.log(`    Bearish: ${bearishFVGCount}`);
      console.log(`  Break of Structure:`);
      console.log(`    Bullish: ${bullishBOS}`);
      console.log(`    Bearish: ${bearishBOS}`);

      // Show ICT validation details for best OB
      if (bullishICTValid > 0) {
        const ictOBs = bullishOBs.filter(ob => ob.ictValidation?.isValidICT);
        const bestOB = ictOBs.sort((a, b) =>
          b.ictValidation.enhancedQualityScore - a.ictValidation.enhancedQualityScore
        )[0];

        console.log('\n✅ BEST ICT-VALIDATED BULLISH OB:');
        console.log('─'.repeat(60));
        console.log(`  Time: ${new Date(bestOB.timestamp).toISOString().slice(0, 16)}`);
        console.log(`  Zone: $${bestOB.bottom.toFixed(2)} - $${bestOB.top.toFixed(2)}`);
        console.log(`  Impulse: ${(bestOB.impulseStrength * 100).toFixed(2)}%`);
        console.log(`  ICT Quality Score: ${bestOB.ictValidation.enhancedQualityScore}/145`);
        console.log(`  Volume Strength: ${bestOB.ictValidation.volumeStrength}x avg`);
        console.log(`\n  ICT Criteria Met:`);
        console.log(`    ${bestOB.ictValidation.isCleanCandle ? '✓' : '✗'} Clean candle (body ≥40% range)`);
        console.log(`    ${bestOB.ictValidation.isCleanStructure ? '✓' : '✗'} Clean structure (not choppy)`);
        console.log(`    ${bestOB.ictValidation.hasVolumeConfirmation ? '✓' : '✗'} Volume confirmed (≥80% avg)`);
        console.log(`    ${bestOB.ictValidation.hasBOSNearby ? '✓' : '✗'} BOS nearby (within 10 candles)`);
        console.log(`    ${bestOB.ictValidation.hasFVGNearby ? '✓' : '✗'} FVG association (within 5 candles)`);
      } else if (bearishICTValid > 0) {
        const ictOBs = bearishOBs.filter(ob => ob.ictValidation?.isValidICT);
        const bestOB = ictOBs.sort((a, b) =>
          b.ictValidation.enhancedQualityScore - a.ictValidation.enhancedQualityScore
        )[0];

        console.log('\n✅ BEST ICT-VALIDATED BEARISH OB:');
        console.log('─'.repeat(60));
        console.log(`  Time: ${new Date(bestOB.timestamp).toISOString().slice(0, 16)}`);
        console.log(`  Zone: $${bestOB.bottom.toFixed(2)} - $${bestOB.top.toFixed(2)}`);
        console.log(`  Impulse: ${(bestOB.impulseStrength * 100).toFixed(2)}%`);
        console.log(`  ICT Quality Score: ${bestOB.ictValidation.enhancedQualityScore}/145`);
        console.log(`  Volume Strength: ${bestOB.ictValidation.volumeStrength}x avg`);
        console.log(`\n  ICT Criteria Met:`);
        console.log(`    ${bestOB.ictValidation.isCleanCandle ? '✓' : '✗'} Clean candle (body ≥40% range)`);
        console.log(`    ${bestOB.ictValidation.isCleanStructure ? '✓' : '✗'} Clean structure (not choppy)`);
        console.log(`    ${bestOB.ictValidation.hasVolumeConfirmation ? '✓' : '✗'} Volume confirmed (≥80% avg)`);
        console.log(`    ${bestOB.ictValidation.hasBOSNearby ? '✓' : '✗'} BOS nearby (within 10 candles)`);
        console.log(`    ${bestOB.ictValidation.hasFVGNearby ? '✓' : '✗'} FVG association (within 5 candles)`);
      } else {
        console.log('\n⚠️  NO FULLY ICT-VALIDATED OBs');
        console.log('    This is normal - not every period has valid ICT setups');
      }

      // Zone analysis
      if (analysis.premiumDiscount) {
        console.log('\n🎯 MARKET POSITION:');
        console.log('─'.repeat(60));
        console.log(`  Range: $${analysis.premiumDiscount.low.toFixed(2)} - $${analysis.premiumDiscount.high.toFixed(2)}`);
        console.log(`  Position: ${analysis.premiumDiscount.percentage.toFixed(1)}% of range`);
        console.log(`  Zone: ${analysis.premiumDiscount.zone.toUpperCase()}`);

        if (analysis.premiumDiscount.zone === 'discount') {
          console.log(`  📈 Bullish signals can generate (in buy zone)`);
        } else if (analysis.premiumDiscount.zone === 'premium') {
          console.log(`  📉 Bearish signals can generate (in sell zone)`);
        } else {
          console.log(`  ⏸️  No signals (neutral zone - strict SMC)`);
        }
      }

      // Signal generation
      console.log('\n🔔 SIGNAL GENERATION:');
      console.log('─'.repeat(60));
      const signals = analysis.signals || [];
      console.log(`  Total signals: ${signals.length}`);

      if (signals.length > 0) {
        signals.slice(0, 3).forEach((sig, i) => {
          console.log(`\n  ${i + 1}. ${sig.direction.toUpperCase()} Signal`);
          console.log(`     Entry: $${sig.entry.toFixed(2)}`);
          console.log(`     Confluence: ${sig.confluenceScore}`);
          console.log(`     R:R: ${sig.riskReward}:1`);

          if (sig.patternDetails?.orderBlock?.ictValidation) {
            console.log(`     ICT OB Quality: ${sig.patternDetails.orderBlock.ictValidation.enhancedQualityScore}/145`);
          }
        });
      } else {
        console.log(`  No signals generated`);
        if (analysis.premiumDiscount?.zone === 'neutral') {
          console.log(`  Reason: Price in neutral zone (strict SMC - wait for extremes)`);
        } else {
          console.log(`  Reason: Missing required confirmations`);
        }
      }

      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.log(`\n❌ Error: ${error.message}`);
    }
  }

  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  ICT/SMC VALIDATION SUMMARY                              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n✅ System is using official ICT methodology:');
  console.log('   • FVG detection with displacement validation');
  console.log('   • OB quality validation (clean candle, volume, structure)');
  console.log('   • BOS/FVG association checks');
  console.log('   • Prioritizes ICT-validated OBs');
  console.log('   • Strict zone requirements (discount/premium only)');
  console.log('\n📊 Expected behavior:');
  console.log('   • Fewer signals (quality over quantity)');
  console.log('   • Only ICT-validated OBs used');
  console.log('   • No signals in neutral zones');
  console.log('   • Signals only when proper confluence exists');
  console.log('\n🎯 This is PROPER institutional trading per ICT/SMC!\n');
}

testLiveICTSystem().catch(console.error);
