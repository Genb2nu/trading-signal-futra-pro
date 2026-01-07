import axios from 'axios';
import { detectOrderBlocks } from './src/shared/smcDetectors.js';

async function diagnoseOBDetection() {
  console.log('\n=== Diagnosing Order Block Detection ===\n');

  // Fetch SOLUSDT 1h data
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

  // Test with different impulse thresholds
  const thresholds = [0.001, 0.003, 0.005, 0.008, 0.01];

  console.log('=== Testing Order Block Detection with Different Impulse Thresholds ===\n');

  for (const threshold of thresholds) {
    const obs = detectOrderBlocks(candles, threshold, { timeframe: '1h' });

    console.log(`Threshold ${(threshold * 100).toFixed(2)}%:`);
    console.log(`  Bullish OBs: ${obs.bullish.length}`);
    console.log(`  Bearish OBs: ${obs.bearish.length}`);

    if (obs.bullish.length > 0) {
      const latest = obs.bullish[obs.bullish.length - 1];
      console.log(`  Latest Bullish OB: ${new Date(latest.timestamp).toISOString().slice(0, 16)}`);
      console.log(`    Zone: ${latest.bottom.toFixed(2)} - ${latest.top.toFixed(2)}`);
      console.log(`    Impulse: ${(latest.impulseStrength * 100).toFixed(2)}%`);
    }

    if (obs.bearish.length > 0) {
      const latest = obs.bearish[obs.bearish.length - 1];
      console.log(`  Latest Bearish OB: ${new Date(latest.timestamp).toISOString().slice(0, 16)}`);
      console.log(`    Zone: ${latest.bottom.toFixed(2)} - ${latest.top.toFixed(2)}`);
      console.log(`    Impulse: ${(latest.impulseStrength * 100).toFixed(2)}%`);
    }

    console.log('');
  }

  console.log('\n=== Current Settings Issue ===');
  console.log('The current impulse threshold is 0.5% (from settings)');
  console.log('This is TOO STRICT for 1h timeframe!');
  console.log('');
  console.log('Recommended impulse thresholds by timeframe:');
  console.log('  15m: 0.8% (very aggressive moves)');
  console.log('  1h:  0.3-0.5% (strong moves) ← You\'re using 0.5%');
  console.log('  4h:  0.2-0.3% (moderate moves)');
  console.log('');
  console.log('If lowering to 0.3% finds more OBs, that\'s the fix!\n');

  // Test with 0.003 (0.3%) to see if we get more OBs
  const obs_relaxed = detectOrderBlocks(candles, 0.003, { timeframe: '1h' });
  console.log('=== With 0.3% Threshold (Recommended for 1h) ===');
  console.log(`Bullish OBs: ${obs_relaxed.bullish.length}`);
  console.log(`Bearish OBs: ${obs_relaxed.bearish.length}\n`);

  if (obs_relaxed.bullish.length > 0) {
    console.log('Latest 3 Bullish OBs:\n');
    obs_relaxed.bullish.slice(-3).forEach((ob, i) => {
      console.log(`${i + 1}. ${new Date(ob.timestamp).toISOString().slice(0, 16)}`);
      console.log(`   Zone: ${ob.bottom.toFixed(2)} - ${ob.top.toFixed(2)}`);
      console.log(`   Impulse: ${(ob.impulseStrength * 100).toFixed(2)}%`);
      console.log(`   Fresh: ${ob.isFresh ? 'YES' : 'NO'}`);
      console.log('');
    });
  }
}

diagnoseOBDetection().catch(console.error);
