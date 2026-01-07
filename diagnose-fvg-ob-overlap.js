import axios from 'axios';
import { detectFairValueGaps, detectOrderBlocks } from './src/shared/smcDetectors.js';

async function diagnoseFVGOBOverlap() {
  console.log('\n=== Diagnosing FVG + OB Overlap ===\n');

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

  const fvgs = detectFairValueGaps(candles, { timeframe: '1h' });
  const obs = detectOrderBlocks(candles, 0.005, { timeframe: '1h' });

  const bullishFVGs = fvgs.filter(f => f.type === 'bullish');
  const bullishOBs = obs.bullish;

  console.log(`Bullish FVGs: ${bullishFVGs.length}`);
  console.log(`Bullish OBs: ${bullishOBs.length}\n`);

  // Check for overlaps
  console.log('=== Checking for FVG + OB Overlaps ===\n');

  let overlapCount = 0;

  bullishFVGs.forEach(fvg => {
    const fvgTime = new Date(fvg.timestamp).toISOString().slice(0, 16);

    // Check if any OB overlaps with this FVG (price zones intersect)
    const overlappingOBs = bullishOBs.filter(ob => {
      // Check if zones overlap
      const priceOverlap = !(fvg.top < ob.bottom || fvg.bottom > ob.top);

      // Check if timestamps are within 10 candles (10 hours for 1h timeframe)
      const timeDiff = Math.abs(fvg.timestamp - ob.timestamp);
      const candleDiff = timeDiff / (60 * 60 * 1000); // Convert to hours
      const closeInTime = candleDiff <= 10;

      return priceOverlap && closeInTime;
    });

    if (overlappingOBs.length > 0) {
      overlapCount++;
      console.log(`✅ FVG at ${fvgTime} has ${overlappingOBs.length} overlapping OB(s)`);
      console.log(`   FVG Zone: ${fvg.bottom.toFixed(2)} - ${fvg.top.toFixed(2)}`);
      console.log(`   Displacement: ${(fvg.displacement * 100).toFixed(2)}%`);

      overlappingOBs.forEach((ob, i) => {
        const obTime = new Date(ob.timestamp).toISOString().slice(0, 16);
        const timeDiff = Math.abs(fvg.timestamp - ob.timestamp) / (60 * 60 * 1000);
        console.log(`   OB ${i + 1} at ${obTime} (${timeDiff.toFixed(0)}h apart)`);
        console.log(`     OB Zone: ${ob.bottom.toFixed(2)} - ${ob.top.toFixed(2)}`);
        console.log(`     Impulse: ${(ob.impulseStrength * 100).toFixed(2)}%`);
        console.log(`     Fresh: ${ob.isFresh ? 'Yes' : 'No'}, Touches: ${ob.touches || 0}`);
      });
      console.log('');
    }
  });

  console.log(`\n=== Summary ===`);
  console.log(`Total FVGs with overlapping OBs: ${overlapCount}/${bullishFVGs.length}`);

  if (overlapCount === 0) {
    console.log('\n❌ NO OVERLAPS FOUND!');
    console.log('This explains why no signals are generated.');
    console.log('FVGs and OBs are occurring at different times/price levels.\n');

    console.log('Sample FVG locations:');
    bullishFVGs.slice(-3).forEach(fvg => {
      console.log(`  ${new Date(fvg.timestamp).toISOString().slice(0, 16)}: ${fvg.bottom.toFixed(2)} - ${fvg.top.toFixed(2)}`);
    });

    console.log('\nSample OB locations:');
    bullishOBs.slice(-3).forEach(ob => {
      console.log(`  ${new Date(ob.timestamp).toISOString().slice(0, 16)}: ${ob.bottom.toFixed(2)} - ${ob.top.toFixed(2)}`);
    });

    console.log('\nThis is NORMAL! SMC signals require BOTH patterns to align.');
    console.log('When market conditions create both FVG + OB at same level, that\'s a high-probability setup.');
  } else {
    console.log('\n✅ OVERLAPS FOUND!');
    console.log('These should create signals. If not, check confluence scoring logic.');
  }
}

diagnoseFVGOBOverlap().catch(console.error);
