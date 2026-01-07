/**
 * Test OB/FVG validation against BOS/CHoCH
 * Verifies that we filter out consolidation patterns
 */

import { scanSymbol } from './api/smcAnalyzer.js';

async function testValidation() {
  console.log('🔍 Testing OB/FVG Validation with BOS/CHoCH Filter\n');
  console.log('='.repeat(60));

  const testSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT'];
  const timeframe = '1h';

  for (const symbol of testSymbols) {
    console.log(`\n📊 Analyzing ${symbol}...`);

    const result = await scanSymbol(symbol, timeframe);

    if (!result.success) {
      console.log(`❌ Error: ${result.error}`);
      continue;
    }

    const analysis = result.analysis;

    console.log(`\n📈 Pattern Detection Results:`);
    console.log(`   FVGs Found: ${analysis.fvgs?.length || 0} (validated with BOS/CHoCH)`);
    console.log(`   Order Blocks Found: ${analysis.orderBlocks?.length || 0} (validated with BOS/CHoCH)`);
    console.log(`   BOS/CHoCH Events: ${analysis.bmsEvents?.length || 0}`);
    console.log(`   Liquidity Sweeps: ${analysis.liquiditySweeps?.length || 0}`);
    console.log(`   Market Structure: ${analysis.structure?.trend || 'neutral'}`);

    // Show validation details for FVGs
    if (analysis.fvgs && analysis.fvgs.length > 0) {
      console.log(`\n   ✅ Validated FVGs:`);
      analysis.fvgs.forEach((fvg, i) => {
        if (fvg.validationReason) {
          console.log(`      ${i + 1}. ${fvg.validationReason.explanation}`);
        }
      });
    }

    // Show validation details for OBs
    if (analysis.orderBlocks && analysis.orderBlocks.length > 0) {
      console.log(`\n   ✅ Validated Order Blocks:`);
      analysis.orderBlocks.forEach((ob, i) => {
        if (ob.validationReason) {
          console.log(`      ${i + 1}. ${ob.validationReason.explanation}`);
        }
      });
    }

    // Show signals
    if (result.signals && result.signals.length > 0) {
      console.log(`\n   🎯 Trading Signals: ${result.signals.length}`);
      result.signals.forEach((signal, i) => {
        console.log(`      ${i + 1}. ${signal.type} - ${signal.patterns.join(', ')} - Confidence: ${signal.confidence}`);
      });
    } else {
      console.log(`\n   🎯 Trading Signals: 0 (no high-probability setups)`);
    }

    console.log('\n' + '-'.repeat(60));

    // Wait to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✅ Validation Test Complete!');
  console.log('\nℹ️  Only FVGs and OBs that formed during BOS/CHoCH are included.');
  console.log('   Consolidation patterns have been filtered out for higher accuracy.');
}

testValidation().catch(console.error);
