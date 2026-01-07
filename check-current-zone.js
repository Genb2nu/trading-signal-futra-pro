import axios from 'axios';
import { detectSwingPoints, calculatePremiumDiscount } from './src/shared/smcDetectors.js';

async function checkCurrentZone() {
  console.log('\n=== Checking Current Price Zone ===\n');

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

  const latestCandle = candles[candles.length - 1];
  const swingPoints = detectSwingPoints(candles, 2);
  const zoneAnalysis = calculatePremiumDiscount(candles, swingPoints, latestCandle.close);

  console.log(`Latest Candle: ${latestCandle.time.slice(0, 16)}`);
  console.log(`Current Price: ${latestCandle.close.toFixed(2)}`);
  console.log('');
  console.log('=== Premium/Discount Analysis ===');
  console.log(`Range High: ${zoneAnalysis.high.toFixed(2)}`);
  console.log(`Range Low:  ${zoneAnalysis.low.toFixed(2)}`);
  console.log(`Price Position: ${zoneAnalysis.percentage.toFixed(2)}% of range`);
  console.log(`Current Zone: ${zoneAnalysis.zone.toUpperCase()}`);
  console.log('');

  if (zoneAnalysis.zone === 'discount') {
    console.log('✅ BULLISH signals can be generated (in discount zone)');
  } else if (zoneAnalysis.zone === 'premium') {
    console.log('✅ BEARISH signals can be generated (in premium zone)');
  } else {
    console.log('❌ NO signals can be generated (in neutral zone)');
    console.log('   allowNeutralZone = false in Moderate mode');
  }

  console.log('');
  console.log('=== Zone Thresholds (Moderate Mode) ===');
  console.log('Discount zone: ≤30% of range (buy setup area)');
  console.log('Premium zone:  ≥70% of range (sell setup area)');
  console.log('Neutral zone:  30-70% (no trading zone in Moderate mode)');
  console.log('');
  console.log('This is why you might only see old signals:');
  console.log('- Latest FVGs exist but price moved out of discount/premium zone');
  console.log('- Old signals from when price WAS in valid zones are still displayed');
}

checkCurrentZone().catch(console.error);
