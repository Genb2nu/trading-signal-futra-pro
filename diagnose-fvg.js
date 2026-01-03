/**
 * Diagnostic script to test FVG detection specifically
 */

import { getBinanceKlines } from './src/services/binanceClient.js';
import { detectFairValueGaps } from './src/shared/smcDetectors.js';
import { getCurrentConfig } from './src/shared/strategyConfig.js';

async function diagnoseFVG() {
  console.log('🔍 Diagnosing FVG Detection\n');

  const symbol = 'BTCUSDT';
  const timeframe = '1h';
  const candleCount = 500;

  try {
    console.log(`Fetching ${candleCount} candles for ${symbol} ${timeframe}...`);
    const candles = await getBinanceKlines(symbol, timeframe, candleCount);
    console.log(`✓ Fetched ${candles.length} candles\n`);

    console.log('Testing FVG detection...');
    const config = getCurrentConfig();

    console.log('Config:', JSON.stringify(config, null, 2).substring(0, 500));

    const fvgsFlat = detectFairValueGaps(candles, config);

    console.log('\n📊 FVG Detection Results:');
    console.log(`   FVG Type: ${typeof fvgsFlat}`);
    console.log(`   Is Array: ${Array.isArray(fvgsFlat)}`);
    console.log(`   Length: ${fvgsFlat?.length || 0}`);

    if (fvgsFlat && fvgsFlat.length > 0) {
      console.log('\n✅ FVGs detected!');
      console.log(`   Total FVGs: ${fvgsFlat.length}`);
      console.log(`   Bullish: ${fvgsFlat.filter(f => f.type === 'bullish').length}`);
      console.log(`   Bearish: ${fvgsFlat.filter(f => f.type === 'bearish').length}`);
      console.log('\nFirst FVG:');
      console.log(JSON.stringify(fvgsFlat[0], null, 2));
    } else {
      console.log('\n❌ No FVGs detected!');

      // Manual check for FVGs
      console.log('\n🔬 Manual FVG Check (last 50 candles):');
      const recent = candles.slice(-50);
      let manualFVGs = 0;

      for (let i = 2; i < recent.length; i++) {
        const c1 = recent[i - 2];
        const c2 = recent[i - 1];
        const c3 = recent[i];

        // Bullish FVG: c1.high < c3.low
        if (c1.high < c3.low) {
          manualFVGs++;
          console.log(`   Bullish FVG found at index ${i - 2}: gap from ${c1.high} to ${c3.low}`);
        }

        // Bearish FVG: c1.low > c3.high
        if (c1.low > c3.high) {
          manualFVGs++;
          console.log(`   Bearish FVG found at index ${i - 2}: gap from ${c3.high} to ${c1.low}`);
        }
      }

      console.log(`\n   Manual FVG count: ${manualFVGs}`);

      if (manualFVGs > 0) {
        console.log('\n⚠️ FVGs exist in data but detectFairValueGaps() is not finding them!');
      } else {
        console.log('\n   No FVGs in recent data (market is efficient)');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

diagnoseFVG();
