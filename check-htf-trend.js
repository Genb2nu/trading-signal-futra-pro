/**
 * Check HTF trend for various symbols
 */

import { getBinanceKlines } from './src/services/binanceClient.js';
import { detectHigherTimeframeTrend } from './src/shared/smcDetectors.js';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./config.json', 'utf-8'));

console.log('🔍 Checking HTF Trends (1h for 15m trading)\n');

async function checkTrends() {
  const testSymbols = config.symbols.slice(0, 15);

  for (const symbol of testSymbols) {
    try {
      const htfCandles = await getBinanceKlines(symbol, '1h', 500);
      const trend = detectHigherTimeframeTrend(htfCandles);

      const emoji = trend === 'bullish' ? '📈' : trend === 'bearish' ? '📉' : '➖';
      console.log(`${emoji} ${symbol.padEnd(12)} - HTF Trend: ${trend.toUpperCase()}`);
    } catch (error) {
      console.log(`❌ ${symbol.padEnd(12)} - Error`);
    }
  }

  console.log('\n💡 Note: Bullish 15m signals require HTF bullish or neutral');
  console.log('         Bearish 15m signals require HTF bearish or neutral');
  console.log('         If HTF is opposite, signals are blocked by MTF filter');
}

checkTrends().catch(console.error);
