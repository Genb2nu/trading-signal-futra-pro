import { analyzeSMC } from './src/shared/smcDetectors.js';
import { getBinanceKlines } from './src/server/binanceService.js';

console.log('🔍 Testing ChoCH and BOS detection...\n');

// Test with multiple symbols to find signals with structure events
const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT'];
const timeframes = ['1h', '4h'];

let foundCount = 0;

for (const symbol of symbols) {
  for (const timeframe of timeframes) {
    try {
      const candles = await getBinanceKlines(symbol, timeframe, 500);
      const analysis = analyzeSMC(candles, null, timeframe, null, symbol);

      if (analysis.signals && analysis.signals.length > 0) {
        for (const signal of analysis.signals) {
          const hasChoCH = signal.structureAnalysis?.chochEvents?.length > 0;
          const hasBOS = signal.structureAnalysis?.bosEvents?.length > 0;

          if (hasChoCH || hasBOS) {
            console.log(`✅ ${symbol} ${timeframe} - ${signal.type} Signal`);
            console.log(`   Entry: ${signal.entry}`);
            console.log(`   Confidence: ${signal.confidence}`);
            console.log(`   ChoCH: ${hasChoCH ? signal.structureAnalysis.chochEvents.length + ' events' : 'None'}`);
            console.log(`   BOS: ${hasBOS ? signal.structureAnalysis.bosEvents.length + ' events' : 'None'}`);

            if (hasChoCH) {
              console.log('   ChoCH Levels:', signal.structureAnalysis.chochEvents.map(e =>
                `${e.brokenLevel.toFixed(8)} (${e.direction})`
              ).join(', '));
              console.log('   ChoCH Timestamps:', signal.structureAnalysis.chochEvents.map(e => e.timestamp));
            }
            if (hasBOS) {
              console.log('   BOS Levels:', signal.structureAnalysis.bosEvents.map(e =>
                `${e.brokenLevel.toFixed(8)} (${e.direction})`
              ).join(', '));
              console.log('   BOS Timestamps:', signal.structureAnalysis.bosEvents.map(e => e.timestamp));
            }
            console.log('');
            foundCount++;
            break; // Only show first signal per timeframe
          }
        }
      }
    } catch (err) {
      console.error(`Error testing ${symbol} ${timeframe}:`, err.message);
    }
  }
}

console.log(`\n📊 Found ${foundCount} signals with ChoCH or BOS events`);

// Test chart data format
console.log('\n🎨 Testing Chart Data Format...');
try {
  const candles = await getBinanceKlines('BTCUSDT', '1h', 500);
  const analysis = analyzeSMC(candles, null, '1h', null, 'BTCUSDT');

  if (analysis.signals && analysis.signals.length > 0) {
    const signal = analysis.signals[0];
    console.log('\nSample Signal Structure:');
    console.log('- Has structureAnalysis:', !!signal.structureAnalysis);
    console.log('- structureAnalysis.chochEvents type:', Array.isArray(signal.structureAnalysis?.chochEvents) ? 'Array' : typeof signal.structureAnalysis?.chochEvents);
    console.log('- structureAnalysis.bosEvents type:', Array.isArray(signal.structureAnalysis?.bosEvents) ? 'Array' : typeof signal.structureAnalysis?.bosEvents);

    if (signal.structureAnalysis?.chochEvents?.[0]) {
      console.log('\nSample ChoCH Event Structure:');
      console.log(JSON.stringify(signal.structureAnalysis.chochEvents[0], null, 2));
    }

    if (signal.structureAnalysis?.bosEvents?.[0]) {
      console.log('\nSample BOS Event Structure:');
      console.log(JSON.stringify(signal.structureAnalysis.bosEvents[0], null, 2));
    }
  }
} catch (err) {
  console.error('Error testing chart format:', err.message);
}

console.log('\n✅ Test complete!');
