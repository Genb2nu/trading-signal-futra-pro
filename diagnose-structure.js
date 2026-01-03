/**
 * Diagnostic script to understand market structure detection
 */

import { getBinanceKlines } from './src/services/binanceClient.js';
import { detectSwingPoints } from './src/shared/smcDetectors.js';
import { analyzeMarketStructure } from './src/shared/smcDetectors.js';

async function diagnoseStructure() {
  console.log('🔍 Diagnosing Market Structure Detection\n');

  const symbol = 'BTCUSDT';
  const timeframe = '1h';
  const candleCount = 500;

  try {
    console.log(`Fetching ${candleCount} candles for ${symbol} ${timeframe}...`);
    const candles = await getBinanceKlines(symbol, timeframe, candleCount);
    console.log(`✓ Fetched ${candles.length} candles\n`);

    console.log('Detecting swing points...');
    const swingPoints = detectSwingPoints(candles, 2);
    console.log(`✓ Detected ${swingPoints.length} swing points\n`);

    console.log('Analyzing market structure...');
    const structure = analyzeMarketStructure(swingPoints);

    console.log('\n📊 Structure Object:');
    console.log(JSON.stringify(structure, null, 2));

    console.log('\n📈 Structure Summary:');
    console.log(`   Trend: ${structure.trend || 'UNDEFINED'}`);
    console.log(`   Last Swing High: ${structure.lastSwingHigh ? structure.lastSwingHigh.price : 'NONE'}`);
    console.log(`   Last Swing Low: ${structure.lastSwingLow ? structure.lastSwingLow.price : 'NONE'}`);
    console.log(`   Higher Highs: ${structure.higherHighs?.length || 0}`);
    console.log(`   Higher Lows: ${structure.higherLows?.length || 0}`);
    console.log(`   Lower Highs: ${structure.lowerHighs?.length || 0}`);
    console.log(`   Lower Lows: ${structure.lowerLows?.length || 0}`);

    // Check recent 20 candles
    const recentCandles = candles.slice(-20);
    console.log('\n🕐 Recent 20 Candles Range:');
    console.log(`   Highest Close: ${Math.max(...recentCandles.map(c => c.close))}`);
    console.log(`   Lowest Close: ${Math.min(...recentCandles.map(c => c.close))}`);

    if (structure.lastSwingHigh) {
      const breakAbove = recentCandles.find(c => c.close > structure.lastSwingHigh.price);
      console.log(`   Break above swing high (${structure.lastSwingHigh.price}): ${breakAbove ? 'YES' : 'NO'}`);
    }

    if (structure.lastSwingLow) {
      const breakBelow = recentCandles.find(c => c.close < structure.lastSwingLow.price);
      console.log(`   Break below swing low (${structure.lastSwingLow.price}): ${breakBelow ? 'YES' : 'NO'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

diagnoseStructure();
