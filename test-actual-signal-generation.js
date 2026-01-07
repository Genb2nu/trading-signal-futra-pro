import axios from 'axios';
import { analyzeSMC } from './src/shared/smcDetectors.js';

async function testActualSignalGeneration() {
  console.log('\n=== Testing Actual Signal Generation (What UI Shows) ===\n');

  // Fetch SOLUSDT 1h data (same as UI does)
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

  // Run SMC analysis (EXACTLY what the UI does)
  const analysis = analyzeSMC(candles);

  console.log(`=== SMC Analysis Results ===`);
  console.log(`Total signals generated: ${analysis.signals?.length || 0}\n`);

  if (!analysis.signals || analysis.signals.length === 0) {
    console.log('❌ NO SIGNALS GENERATED!\n');
    console.log('This means even though FVGs are detected, they don\'t meet OTHER requirements:');
    console.log('  - Minimum confluence score (usually 40 for Moderate mode)');
    console.log('  - Require Order Block at the same location as FVG');
    console.log('  - Premium/Discount zone requirements');
    console.log('  - BOS/CHoCH structure requirements\n');

    // Check raw detections
    const { detectFairValueGaps, detectOrderBlocks } = await import('./src/shared/smcDetectors.js');
    const fvgs = detectFairValueGaps(candles, { timeframe: '1h' });
    const obs = detectOrderBlocks(candles, 0.005, { timeframe: '1h' });

    console.log(`Raw FVG detection: ${fvgs.filter(f => f.type === 'bullish').length} bullish, ${fvgs.filter(f => f.type === 'bearish').length} bearish`);
    console.log(`Raw OB detection: ${obs.bullish.length} bullish, ${obs.bearish.length} bearish\n`);

    console.log('FVGs are being detected, but NOT turned into signals!');
    console.log('This is usually because they lack other confluence factors.\n');
    return;
  }

  // Show all signals sorted by timestamp (newest first)
  const sortedSignals = analysis.signals.sort((a, b) => b.timestamp - a.timestamp);

  console.log(`=== All ${sortedSignals.length} Signals (Newest First) ===\n`);

  sortedSignals.forEach((signal, i) => {
    console.log(`${i + 1}. ${signal.direction.toUpperCase()} Signal`);
    console.log(`   Time: ${new Date(signal.timestamp).toISOString().slice(0, 16)}`);
    console.log(`   Entry: ${signal.entry.toFixed(2)}`);
    console.log(`   Confluence: ${signal.confluenceScore}`);

    // Check FVG
    if (signal.patternDetails?.fvg) {
      const fvg = signal.patternDetails.fvg;
      console.log(`   ✅ FVG: ${fvg.bottom.toFixed(2)} - ${fvg.top.toFixed(2)}`);
      console.log(`      Gap Size: ${fvg.gap.toFixed(4)} (${(fvg.gapPercent * 100).toFixed(2)}%)`);
      if (fvg.displacement) {
        console.log(`      💪 Displacement: ${(fvg.displacement * 100).toFixed(2)}%`);
      }
      console.log(`      Mitigated: ${fvg.mitigated ? 'YES' : 'NO'}`);
    } else {
      console.log(`   ❌ No FVG`);
    }

    // Check OB
    if (signal.patternDetails?.orderBlock) {
      const ob = signal.patternDetails.orderBlock;
      console.log(`   ✅ OB: ${ob.bottom.toFixed(2)} - ${ob.top.toFixed(2)}`);
      console.log(`      Type: ${ob.type}`);
    } else {
      console.log(`   ❌ No OB`);
    }

    // Check structure
    const bos = signal.patternDetails?.bos || [];
    const choch = signal.patternDetails?.choch || [];
    console.log(`   Structure: ${bos.length} BOS, ${choch.length} CHoCH`);
    console.log(`   Zone: ${signal.premiumDiscount?.zone || 'N/A'}`);
    console.log('');
  });

  // Show which FVGs are in the signals
  const signalsWithFVG = sortedSignals.filter(s => s.patternDetails?.fvg);
  console.log(`\n=== FVG Signal Summary ===`);
  console.log(`Signals with FVG: ${signalsWithFVG.length}/${sortedSignals.length}`);

  if (signalsWithFVG.length > 0) {
    console.log(`\nLatest FVG in signals:`);
    const latestFVGSignal = signalsWithFVG[0];
    console.log(`  Time: ${new Date(latestFVGSignal.timestamp).toISOString().slice(0, 16)}`);
    console.log(`  Direction: ${latestFVGSignal.direction.toUpperCase()}`);
    console.log(`  FVG Zone: ${latestFVGSignal.patternDetails.fvg.bottom.toFixed(2)} - ${latestFVGSignal.patternDetails.fvg.top.toFixed(2)}`);
    console.log(`  Displacement: ${(latestFVGSignal.patternDetails.fvg.displacement * 100).toFixed(2)}%`);
  }

  console.log('\n=== What You Should See in UI ===');
  console.log(`Total signals: ${sortedSignals.length}`);
  console.log(`Signals with FVG: ${signalsWithFVG.length}`);
  console.log(`Latest signal time: ${new Date(sortedSignals[0].timestamp).toISOString().slice(0, 16)}`);
  console.log('\nIf you only see 1 FVG, check:');
  console.log('  1. Are you filtering by R:R ratio in the UI?');
  console.log('  2. Is the table sorted correctly (newest first)?');
  console.log('  3. Did you scroll down to see all signals?\n');
}

testActualSignalGeneration().catch(console.error);
