import axios from 'axios';

async function diagnoseSignalGeneration() {
  console.log('\n=== Diagnosing Signal Generation ===\n');

  try {
    // Test the actual API endpoint that the UI uses
    const response = await axios.get('http://localhost:3000/api/signals/SOLUSDT/1h');

    const signals = response.data;

    console.log(`Total signals generated: ${signals.length}\n`);

    if (signals.length === 0) {
      console.log('❌ NO SIGNALS GENERATED');
      console.log('This means FVGs are being detected but filtered out by:');
      console.log('  - Confluence score requirements');
      console.log('  - Missing other confirmations (OB, BOS, etc.)');
      console.log('  - Premium/Discount zone filters');
      console.log('  - FVG mitigation status\n');
      return;
    }

    // Show all signals
    console.log('=== All Signals Generated ===\n');
    signals.forEach((signal, i) => {
      console.log(`${i + 1}. ${signal.type.toUpperCase()} Signal`);
      console.log(`   Time: ${new Date(signal.timestamp).toISOString().slice(0, 16)}`);
      console.log(`   Entry: ${signal.entry}`);
      console.log(`   Confluence: ${signal.confluenceScore}`);

      // Check FVG details
      if (signal.fvg) {
        console.log(`   ✅ FVG: ${signal.fvg.bottom.toFixed(2)} - ${signal.fvg.top.toFixed(2)}`);
        console.log(`      Gap: ${signal.fvg.gap.toFixed(2)} (${(signal.fvg.gapPercent * 100).toFixed(2)}%)`);
        if (signal.fvg.displacement) {
          console.log(`      💪 Displacement: ${(signal.fvg.displacement * 100).toFixed(2)}%`);
        }
        console.log(`      Mitigated: ${signal.fvg.mitigated ? 'YES' : 'NO'}`);
      } else {
        console.log(`   ❌ No FVG in this signal`);
      }

      // Check OB
      if (signal.orderBlock) {
        console.log(`   ✅ OB: ${signal.orderBlock.bottom.toFixed(2)} - ${signal.orderBlock.top.toFixed(2)}`);
      } else {
        console.log(`   ❌ No OB in this signal`);
      }

      // Check structure
      console.log(`   BOS: ${signal.bos?.length || 0}, CHoCH: ${signal.choch?.length || 0}`);
      console.log(`   Zone: ${signal.premiumDiscount?.zone || 'N/A'}`);
      console.log('');
    });

    // Check for patterns
    const withFVG = signals.filter(s => s.fvg);
    const withOB = signals.filter(s => s.orderBlock);
    const withBOS = signals.filter(s => s.bos && s.bos.length > 0);

    console.log('\n=== Signal Breakdown ===');
    console.log(`Signals with FVG: ${withFVG.length}/${signals.length}`);
    console.log(`Signals with OB: ${withOB.length}/${signals.length}`);
    console.log(`Signals with BOS: ${withBOS.length}/${signals.length}`);

  } catch (error) {
    console.error('❌ Error fetching signals:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }

  // Also check raw FVG detection to compare
  console.log('\n=== Comparing with Raw FVG Detection ===\n');

  const klineResponse = await axios.get('https://api.binance.com/api/v3/klines?symbol=SOLUSDT&interval=1h&limit=100');
  const candles = klineResponse.data.map(k => ({
    timestamp: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  }));

  // Import and test raw detection
  const { detectFairValueGaps } = await import('./src/shared/smcDetectors.js');
  const fvgs = detectFairValueGaps(candles, { timeframe: '1h' });

  console.log(`Raw FVG Detection: ${fvgs.filter(f => f.type === 'bullish').length} bullish, ${fvgs.filter(f => f.type === 'bearish').length} bearish`);
  console.log(`Latest FVG: ${new Date(fvgs[fvgs.length - 1]?.timestamp).toISOString().slice(0, 16)}\n`);

  console.log('If raw detection shows FVGs but signals don\'t, they\'re being filtered by:');
  console.log('  1. Minimum confluence score requirements');
  console.log('  2. Missing Order Block at the same location');
  console.log('  3. Premium/Discount zone requirements');
  console.log('  4. FVG mitigation status (already filled)');
}

diagnoseSignalGeneration().catch(console.error);
