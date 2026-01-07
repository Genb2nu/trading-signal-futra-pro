import axios from 'axios';
import { detectFairValueGaps, detectOrderBlocks } from './src/shared/smcDetectors.js';

/**
 * Diagnose SOLUSDT 1H FVG and OB detection
 * User reported FVGs at:
 * - 04 Jan 26 04:00 to 06:00
 * - 02 Jan 26 23:00 to 03 Jan 26 01:00
 *
 * User reported OB at:
 * - 03 Jan 26 15:00 to 16:00
 */

async function fetchKlines(symbol, interval, limit = 500) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await axios.get(url);

  return response.data.map(k => ({
    timestamp: k[0],
    time: new Date(k[0]).toISOString(),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  }));
}

function formatDate(timestamp) {
  const d = new Date(timestamp);
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

async function diagnoseSolana() {
  console.log('\n=== SOLUSDT 1H FVG and OB Diagnosis ===\n');

  // Fetch SOLUSDT 1h data
  const candles = await fetchKlines('SOLUSDT', '1h', 500);
  console.log(`Fetched ${candles.length} candles`);
  console.log(`Date range: ${formatDate(candles[0].timestamp)} to ${formatDate(candles[candles.length - 1].timestamp)}`);

  // User's expected FVG times
  const expectedFVG1 = {
    start: new Date('2026-01-04T04:00:00Z').getTime(),
    end: new Date('2026-01-04T06:00:00Z').getTime()
  };

  const expectedFVG2 = {
    start: new Date('2026-01-02T23:00:00Z').getTime(),
    end: new Date('2026-01-03T01:00:00Z').getTime()
  };

  const expectedOB = {
    start: new Date('2026-01-03T15:00:00Z').getTime(),
    end: new Date('2026-01-03T16:00:00Z').getTime()
  };

  // Detect FVGs
  console.log('\n--- Detecting FVGs ---');
  const fvgsArray = detectFairValueGaps(candles, { timeframe: '1h' });

  const bullishFVGs = fvgsArray.filter(f => f.type === 'bullish');
  const bearishFVGs = fvgsArray.filter(f => f.type === 'bearish');

  console.log(`\nTotal FVGs detected: ${bullishFVGs.length} bullish, ${bearishFVGs.length} bearish`);

  // Show all FVGs from Jan 2-4, 2026
  const jan2Start = new Date('2026-01-02T00:00:00Z').getTime();
  const jan5Start = new Date('2026-01-05T00:00:00Z').getTime();

  console.log('\n=== BULLISH FVGs (Jan 2-4, 2026) ===');
  const bullishFVGsInRange = bullishFVGs.filter(f => f.timestamp >= jan2Start && f.timestamp < jan5Start);
  bullishFVGsInRange.forEach((fvg, i) => {
    const isExpected1 = fvg.timestamp >= expectedFVG1.start && fvg.timestamp <= expectedFVG1.end;
    const isExpected2 = fvg.timestamp >= expectedFVG2.start && fvg.timestamp <= expectedFVG2.end;

    console.log(`\n${i + 1}. ${formatDate(fvg.timestamp)} ${isExpected1 || isExpected2 ? '⭐ EXPECTED' : ''}`);
    console.log(`   Gap: ${fvg.bottom.toFixed(6)} - ${fvg.top.toFixed(6)}`);
    console.log(`   Size: ${fvg.gap.toFixed(6)} (${((fvg.gap / fvg.bottom) * 100).toFixed(3)}%)`);

    // Show the 3 candles
    const candleIndex = candles.findIndex(c => c.timestamp === fvg.timestamp);
    if (candleIndex >= 2) {
      console.log(`   Candle [i-2]: H=${candles[candleIndex - 2].high.toFixed(6)} L=${candles[candleIndex - 2].low.toFixed(6)}`);
      console.log(`   Candle [i-1]: H=${candles[candleIndex - 1].high.toFixed(6)} L=${candles[candleIndex - 1].low.toFixed(6)}`);
      console.log(`   Candle [i]:   H=${candles[candleIndex].high.toFixed(6)} L=${candles[candleIndex].low.toFixed(6)}`);
    }
  });

  console.log('\n=== BEARISH FVGs (Jan 2-4, 2026) ===');
  const bearishFVGsInRange = bearishFVGs.filter(f => f.timestamp >= jan2Start && f.timestamp < jan5Start);
  bearishFVGsInRange.forEach((fvg, i) => {
    const isExpected1 = fvg.timestamp >= expectedFVG1.start && fvg.timestamp <= expectedFVG1.end;
    const isExpected2 = fvg.timestamp >= expectedFVG2.start && fvg.timestamp <= expectedFVG2.end;

    console.log(`\n${i + 1}. ${formatDate(fvg.timestamp)} ${isExpected1 || isExpected2 ? '⭐ EXPECTED' : ''}`);
    console.log(`   Gap: ${fvg.bottom.toFixed(6)} - ${fvg.top.toFixed(6)}`);
    console.log(`   Size: ${fvg.gap.toFixed(6)} (${((fvg.gap / fvg.top) * 100).toFixed(3)}%)`);

    // Show the 3 candles
    const candleIndex = candles.findIndex(c => c.timestamp === fvg.timestamp);
    if (candleIndex >= 2) {
      console.log(`   Candle [i-2]: H=${candles[candleIndex - 2].high.toFixed(6)} L=${candles[candleIndex - 2].low.toFixed(6)}`);
      console.log(`   Candle [i-1]: H=${candles[candleIndex - 1].high.toFixed(6)} L=${candles[candleIndex - 1].low.toFixed(6)}`);
      console.log(`   Candle [i]:   H=${candles[candleIndex].high.toFixed(6)} L=${candles[candleIndex].low.toFixed(6)}`);
    }
  });

  // Detect Order Blocks
  console.log('\n\n--- Detecting Order Blocks ---');
  const orderBlocks = detectOrderBlocks(candles, 0.005); // 0.5% impulse threshold for 1h

  console.log(`\nTotal OBs detected: ${orderBlocks.bullish.length} bullish, ${orderBlocks.bearish.length} bearish`);

  console.log('\n=== BULLISH ORDER BLOCKS (Jan 2-4, 2026) ===');
  const bullishOBsInRange = orderBlocks.bullish.filter(ob => ob.timestamp >= jan2Start && ob.timestamp < jan5Start);
  bullishOBsInRange.forEach((ob, i) => {
    const isExpected = ob.timestamp >= expectedOB.start && ob.timestamp <= expectedOB.end;

    console.log(`\n${i + 1}. ${formatDate(ob.timestamp)} ${isExpected ? '⭐ EXPECTED' : ''}`);
    console.log(`   Zone: ${ob.bottom.toFixed(6)} - ${ob.top.toFixed(6)}`);
    console.log(`   Type: ${ob.type}`);
    console.log(`   Impulse: ${(ob.impulseStrength * 100).toFixed(3)}%`);
    console.log(`   Fresh: ${ob.isFresh ? 'Yes' : 'No'}`);
  });

  console.log('\n=== BEARISH ORDER BLOCKS (Jan 2-4, 2026) ===');
  const bearishOBsInRange = orderBlocks.bearish.filter(ob => ob.timestamp >= jan2Start && ob.timestamp < jan5Start);
  bearishOBsInRange.forEach((ob, i) => {
    const isExpected = ob.timestamp >= expectedOB.start && ob.timestamp <= expectedOB.end;

    console.log(`\n${i + 1}. ${formatDate(ob.timestamp)} ${isExpected ? '⭐ EXPECTED' : ''}`);
    console.log(`   Zone: ${ob.bottom.toFixed(6)} - ${ob.top.toFixed(6)}`);
    console.log(`   Type: ${ob.type}`);
    console.log(`   Impulse: ${(ob.impulseStrength * 100).toFixed(3)}%`);
    console.log(`   Fresh: ${ob.isFresh ? 'Yes' : 'No'}`);
  });

  // Check specific candles user mentioned
  console.log('\n\n=== CHECKING USER-SPECIFIED CANDLES ===');

  // FVG 1: 04 Jan 26 04:00 to 06:00
  console.log('\n1. Expected FVG: 04 Jan 26 04:00 - 06:00');
  const fvg1Candles = candles.filter(c => c.timestamp >= expectedFVG1.start && c.timestamp <= expectedFVG1.end);
  fvg1Candles.forEach(c => {
    console.log(`   ${formatDate(c.timestamp)}: O=${c.open.toFixed(6)} H=${c.high.toFixed(6)} L=${c.low.toFixed(6)} C=${c.close.toFixed(6)}`);
  });

  // FVG 2: 02 Jan 26 23:00 to 03 Jan 26 01:00
  console.log('\n2. Expected FVG: 02 Jan 26 23:00 - 03 Jan 26 01:00');
  const fvg2Candles = candles.filter(c => c.timestamp >= expectedFVG2.start && c.timestamp <= expectedFVG2.end);
  fvg2Candles.forEach(c => {
    console.log(`   ${formatDate(c.timestamp)}: O=${c.open.toFixed(6)} H=${c.high.toFixed(6)} L=${c.low.toFixed(6)} C=${c.close.toFixed(6)}`);
  });

  // OB: 03 Jan 26 15:00 to 16:00
  console.log('\n3. Expected OB: 03 Jan 26 15:00 - 16:00');
  const obCandles = candles.filter(c => c.timestamp >= expectedOB.start && c.timestamp <= expectedOB.end);
  obCandles.forEach(c => {
    console.log(`   ${formatDate(c.timestamp)}: O=${c.open.toFixed(6)} H=${c.high.toFixed(6)} L=${c.low.toFixed(6)} C=${c.close.toFixed(6)}`);
  });

  console.log('\n=== Diagnosis Complete ===\n');
}

diagnoseSolana().catch(console.error);
