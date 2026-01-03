/**
 * Diagnostic script to test if signal generation is working
 */

import { getBinanceKlines } from './src/services/binanceClient.js';
import { analyzeSMC } from './src/shared/smcDetectors.js';
import { getHTFTimeframe, setStrategyMode } from './src/shared/strategyConfig.js';

async function diagnoseSignals() {
  console.log('🔍 Diagnosing Signal Generation\n');

  const symbol = 'BTCUSDT';
  const timeframe = '1h';
  const candleCount = 500;

  try {
    console.log(`Fetching ${candleCount} candles for ${symbol} ${timeframe}...`);
    const candles = await getBinanceKlines(symbol, timeframe, candleCount);
    console.log(`✓ Fetched ${candles.length} candles\n`);

    // Get HTF data
    const htfTimeframe = getHTFTimeframe(timeframe);
    const htfCandles = await getBinanceKlines(symbol, htfTimeframe, 150);
    console.log(`✓ Fetched ${htfCandles.length} HTF candles (${htfTimeframe})\n`);

    console.log('Running SMC analysis...');
    const analysis = analyzeSMC(candles, htfCandles, timeframe);

    console.log('\n📊 Analysis Results:');
    console.log('   Analysis keys:', Object.keys(analysis).join(', '));
    console.log(`   Candles analyzed: ${candles.length}`);
    console.log(`   Order Blocks (bullish): ${analysis.orderBlocks?.bullish?.length || 0}`);
    console.log(`   Order Blocks (bearish): ${analysis.orderBlocks?.bearish?.length || 0}`);
    console.log(`   FVGs (bullish): ${analysis.fvgs?.bullish?.length || 0}`);
    console.log(`   FVGs (bearish): ${analysis.fvgs?.bearish?.length || 0}`);
    console.log(`   FVGs Type: ${typeof analysis.fvgs}, IsArray: ${Array.isArray(analysis.fvgs)}`);
    console.log(`   Liquidity Sweeps: ${analysis.liquiditySweeps?.length || 0}`);
    console.log(`   BOS Events (bullish): ${analysis.bos?.bullish?.length || 0}`);
    console.log(`   BOS Events (bearish): ${analysis.bos?.bearish?.length || 0}`);
    console.log(`   BMS Events (bullish): ${analysis.bms?.bullish?.length || 0}`);
    console.log(`   BMS Events (bearish): ${analysis.bms?.bearish?.length || 0}`);
    console.log(`   Inducement (bullish): ${analysis.inducement?.bullish?.length || 0}`);
    console.log(`   Inducement (bearish): ${analysis.inducement?.bearish?.length || 0}`);
    console.log(`   Market Structure Trend: ${analysis.structure?.trend || 'unknown'}`);
    console.log(`\n   🎯 SIGNALS GENERATED: ${analysis.signals?.length || 0}\n`);

    if (analysis.signals && analysis.signals.length > 0) {
      console.log('✅ Signals are being generated!');
      console.log('\nFirst signal:');
      const signal = analysis.signals[0];
      console.log(JSON.stringify(signal, null, 2));
    } else {
      console.log('❌ No signals generated');
      console.log('\nPossible reasons:');
      console.log('   - No valid setups found in the data');
      console.log('   - Confluence threshold too high');
      console.log('   - Required confirmations not met');
      console.log('   - Filters rejecting all setups');
    }

    // Test with different modes
    console.log('\n\n🧪 Testing with AGGRESSIVE mode...');
    setStrategyMode('AGGRESSIVE');
    const aggAnalysis = analyzeSMC(candles, htfCandles, timeframe);
    console.log(`   Signals (AGGRESSIVE): ${aggAnalysis.signals?.length || 0}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

diagnoseSignals();
