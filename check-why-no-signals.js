import axios from 'axios';
import { analyzeSMC } from './src/shared/smcDetectors.js';

async function checkWhyNoSignals() {
  console.log('\n=== Why Are No Signals Generated? ===\n');

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

  const analysis = analyzeSMC(candles);

  console.log('=== Analysis Results ===');
  const bullishFVGs = analysis.fvgs?.unfilled?.bullish?.length || 0 +
                      analysis.fvgs?.touched?.bullish?.length || 0 +
                      analysis.fvgs?.partial?.bullish?.length || 0;
  console.log(`Bullish FVGs: ${bullishFVGs}`);
  console.log(`Bullish OBs: ${analysis.orderBlocks?.bullish?.length || 0}`);
  console.log(`Bullish BOS: ${analysis.bos?.bullish?.length || 0}`);
  console.log(`Bullish Sweeps: ${analysis.liquiditySweeps?.filter(s => s.direction === 'bullish').length || 0}`);
  console.log('');

  console.log('=== Current Market Position ===');
  console.log(`Current Price: ${candles[candles.length - 1].close.toFixed(2)}`);

  console.log('');
  console.log('=== Signals Generated ===');
  console.log(`Total: ${analysis.signals?.length || 0}`);

  if (analysis.signals && analysis.signals.length > 0) {
    analysis.signals.forEach((sig, i) => {
      console.log(`\n${i + 1}. ${sig.direction.toUpperCase()} - Confluence: ${sig.confluenceScore}`);
      console.log(`   Entry: ${sig.entry.toFixed(2)}`);
      console.log(`   Has FVG: ${sig.patternDetails?.fvg ? 'Yes' : 'No'}`);
      console.log(`   Has OB: ${sig.patternDetails?.orderBlock ? 'Yes' : 'No'}`);
    });
  } else {
    console.log('\n❌ NO SIGNALS GENERATED');
    console.log('\nMost likely reasons:');
    console.log('1. Price is in NEUTRAL zone (30-70% of range)');
    console.log('2. No fresh OBs in current zone direction');
    console.log('3. Confluence score below minimum (40 for Moderate)');
    console.log('4. Risk:Reward ratio below minimum');
  }
}

checkWhyNoSignals().catch(console.error);
