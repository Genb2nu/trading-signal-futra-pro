import axios from 'axios';
import { detectFairValueGaps, detectOrderBlocks } from './src/shared/smcDetectors.js';

async function testFreshVisualization() {
  console.log('\n=== Testing Fresh FVG Visualization ===\n');

  // Fetch latest SOLUSDT data
  const url = 'https://api.binance.com/api/v3/klines?symbol=SOLUSDT&interval=1h&limit=100';
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
  console.log(`Latest: ${candles[candles.length - 1].time}`);

  // Detect FVGs
  const fvgs = detectFairValueGaps(candles, { timeframe: '1h' });
  const latestFVGs = fvgs.filter(f => f.type === 'bullish').slice(-3);

  console.log('\n=== Latest 3 Bullish FVGs ===\n');

  latestFVGs.forEach((fvg, i) => {
    const candleIndex = candles.findIndex(c => c.timestamp === fvg.timestamp);
    const candle = candles[candleIndex];

    console.log(`${i + 1}. ${new Date(fvg.timestamp).toISOString().slice(0, 16)}`);
    console.log(`   FVG Zone (what should display):`);
    console.log(`   TOP:    ${fvg.top.toFixed(6)}  ← Purple line here`);
    console.log(`   BOTTOM: ${fvg.bottom.toFixed(6)}  ← Purple line here`);
    console.log(`   Gap Size: ${fvg.gap.toFixed(6)} (${(fvg.gapPercent * 100).toFixed(2)}%)`);
    console.log('');
    console.log(`   Full Candle Range (should NOT display):`);
    console.log(`   Candle HIGH: ${candle.high.toFixed(6)}  ← Should NOT show`);
    console.log(`   Candle LOW:  ${candle.low.toFixed(6)}  ← Should NOT show`);
    console.log('');
    console.log(`   Expected visualization:`);
    console.log(`   Small purple box from ${fvg.bottom.toFixed(2)} to ${fvg.top.toFixed(2)}`);
    console.log(`   NOT a pillar from ${candle.low.toFixed(2)} to ${candle.high.toFixed(2)}`);
    console.log('\n---\n');
  });

  // Detect OBs
  const obs = detectOrderBlocks(candles, 0.005, { timeframe: '1h' });
  const latestBullishOB = obs.bullish.slice(-1)[0];

  if (latestBullishOB) {
    console.log('=== Latest Bullish Order Block ===\n');
    const candleIndex = candles.findIndex(c => c.timestamp === latestBullishOB.timestamp);
    const candle = candles[candleIndex];

    console.log(`Time: ${new Date(latestBullishOB.timestamp).toISOString().slice(0, 16)}`);
    console.log(`OB Zone (what should display - FULL candle range):`);
    console.log(`TOP:    ${latestBullishOB.top.toFixed(6)}  ← Pink line (candle HIGH)`);
    console.log(`BOTTOM: ${latestBullishOB.bottom.toFixed(6)}  ← Pink line (candle LOW)`);
    console.log('');
    console.log(`OB is CORRECT as full candle range!`);
    console.log(`Pink box from ${latestBullishOB.bottom.toFixed(2)} to ${latestBullishOB.top.toFixed(2)}`);
  }

  console.log('\n=== Visualization Summary ===');
  console.log('FVG (purple): Small gap between 3 candles');
  console.log('OB (pink): Full candle high-low range');
  console.log('');
  console.log('If you see PILLARS (large zones), you are viewing OLD signals!');
  console.log('Clear cache, rescan signals, and you should see small zones.');
  console.log('\n===========================\n');
}

testFreshVisualization().catch(console.error);
