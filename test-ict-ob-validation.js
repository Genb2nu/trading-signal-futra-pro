import axios from 'axios';
import { analyzeSMC } from './src/shared/smcDetectors.js';

async function testICTOBValidation() {
  console.log('\n=== Testing ICT Order Block Validation ===\n');

  const url = 'https://api.binance.com/api/v3/klines?symbol=SOLUSDT&interval=1h&limit=500';
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

  console.log(`Fetched ${candles.length} candles`);
  console.log(`Date range: ${candles[0].time.slice(0, 16)} to ${candles[candles.length - 1].time.slice(0, 16)}\n`);

  // Run full SMC analysis (includes OBs, FVGs, BOS detection)
  const analysis = analyzeSMC(candles);

  const obs = analysis.orderBlocks;
  const fvgs = analysis.fvgs;
  const bos = analysis.bos;

  const bullishFVGCount = (fvgs.unfilled?.bullish?.length || 0) +
                          (fvgs.touched?.bullish?.length || 0) +
                          (fvgs.partial?.bullish?.length || 0);

  console.log('=== Raw Detection Results ===');
  console.log(`Total Bullish OBs detected: ${obs.bullish.length}`);
  console.log(`Total Bullish FVGs detected: ${bullishFVGCount}`);
  console.log(`Total Bullish BOS detected: ${bos.bullish.length}\n`);

  // Analyze ICT validation
  console.log('=== ICT Validation Analysis ===\n');

  const bullishOBs = obs.bullish;
  const ictValidOBs = bullishOBs.filter(ob => ob.ictValidation?.isValidICT);
  const partialValidOBs = bullishOBs.filter(ob =>
    ob.ictValidation && !ob.ictValidation.isValidICT && ob.ictValidation.qualityScore >= 50
  );

  console.log(`✅ Fully ICT-Validated OBs: ${ictValidOBs.length}/${bullishOBs.length}`);
  console.log(`⚠️  Partially Valid OBs (quality ≥50): ${partialValidOBs.length}`);
  console.log(`❌ Low Quality OBs: ${bullishOBs.length - ictValidOBs.length - partialValidOBs.length}\n`);

  // Show breakdown by criteria
  let cleanCandles = 0;
  let cleanStructure = 0;
  let volumeConfirmed = 0;
  let hasBOS = 0;
  let hasFVG = 0;

  bullishOBs.forEach(ob => {
    if (ob.ictValidation) {
      if (ob.ictValidation.isCleanCandle) cleanCandles++;
      if (ob.ictValidation.isCleanStructure) cleanStructure++;
      if (ob.ictValidation.hasVolumeConfirmation) volumeConfirmed++;
      if (ob.ictValidation.hasBOSNearby) hasBOS++;
      if (ob.ictValidation.hasFVGNearby) hasFVG++;
    }
  });

  console.log('=== ICT Criteria Breakdown ===');
  console.log(`Clean Candles (body ≥40% range): ${cleanCandles}/${bullishOBs.length} (${((cleanCandles/bullishOBs.length)*100).toFixed(1)}%)`);
  console.log(`Clean Structure (not choppy): ${cleanStructure}/${bullishOBs.length} (${((cleanStructure/bullishOBs.length)*100).toFixed(1)}%)`);
  console.log(`Volume Confirmed (≥80% avg): ${volumeConfirmed}/${bullishOBs.length} (${((volumeConfirmed/bullishOBs.length)*100).toFixed(1)}%)`);
  console.log(`BOS Nearby (within 10 candles): ${hasBOS}/${bullishOBs.length} (${((hasBOS/bullishOBs.length)*100).toFixed(1)}%)`);
  console.log(`FVG Association (nearby): ${hasFVG}/${bullishOBs.length} (${((hasFVG/bullishOBs.length)*100).toFixed(1)}%)\n`);

  if (ictValidOBs.length > 0) {
    console.log('=== Top 3 ICT-Validated Order Blocks ===\n');

    // Sort by quality score
    const topOBs = ictValidOBs
      .sort((a, b) => b.ictValidation.enhancedQualityScore - a.ictValidation.enhancedQualityScore)
      .slice(0, 3);

    topOBs.forEach((ob, i) => {
      console.log(`${i + 1}. ${new Date(ob.timestamp).toISOString().slice(0, 16)}`);
      console.log(`   Zone: ${ob.bottom.toFixed(2)} - ${ob.top.toFixed(2)}`);
      console.log(`   Impulse: ${(ob.impulseStrength * 100).toFixed(2)}%`);
      console.log(`   ICT Quality Score: ${ob.ictValidation.enhancedQualityScore}/100`);
      console.log(`   Volume Strength: ${ob.ictValidation.volumeStrength}x average`);
      console.log(`   ✅ Clean Candle: ${ob.ictValidation.isCleanCandle ? 'Yes' : 'No'}`);
      console.log(`   ✅ Clean Structure: ${ob.ictValidation.isCleanStructure ? 'Yes' : 'No'}`);
      console.log(`   ✅ Volume Confirmed: ${ob.ictValidation.hasVolumeConfirmation ? 'Yes' : 'No'}`);
      console.log(`   ✅ BOS Nearby: ${ob.ictValidation.hasBOSNearby ? 'Yes' : 'No'}`);
      console.log(`   ✅ FVG Association: ${ob.ictValidation.hasFVGNearby ? 'Yes' : 'No'}`);
      console.log(`   Touches: ${ob.touches || 0}, Broken: ${ob.isBroken ? 'Yes' : 'No'}`);
      console.log('');
    });
  } else {
    console.log('❌ NO FULLY ICT-VALIDATED OBs FOUND\n');
    console.log('Most common missing criteria:');

    const missingBOS = bullishOBs.filter(ob => !ob.ictValidation?.hasBOSNearby).length;
    const missingFVG = bullishOBs.filter(ob => !ob.ictValidation?.hasFVGNearby).length;
    const missingVolume = bullishOBs.filter(ob => !ob.ictValidation?.hasVolumeConfirmation).length;

    console.log(`  - Missing BOS: ${missingBOS}/${bullishOBs.length}`);
    console.log(`  - Missing FVG association: ${missingFVG}/${bullishOBs.length}`);
    console.log(`  - Missing volume confirmation: ${missingVolume}/${bullishOBs.length}\n`);
  }

  console.log('=== Summary ===');
  console.log(`This is STRICT ICT methodology compliance.`);
  console.log(`Only ${ictValidOBs.length} out of ${bullishOBs.length} OBs meet ALL official criteria.`);
  console.log(`This ensures only the highest quality institutional setups are traded.\n`);
}

testICTOBValidation().catch(console.error);
