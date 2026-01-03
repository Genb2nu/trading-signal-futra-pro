/**
 * Debug signal generation logic
 */

import { getBinanceKlines } from './src/services/binanceClient.js';
import { analyzeSMC } from './src/shared/smcDetectors.js';
import { getHTFTimeframe, getCurrentConfig, setStrategyMode } from './src/shared/strategyConfig.js';

async function debugSignalLogic() {
  console.log('🔍 Debugging Signal Generation Logic\n');

  const symbol = 'BTCUSDT';
  const timeframe = '1h';
  const candleCount = 500;

  try {
    // Test AGGRESSIVE mode (should be easiest to generate signals)
    setStrategyMode('AGGRESSIVE');

    console.log(`Fetching data for ${symbol} ${timeframe}...`);
    const candles = await getBinanceKlines(symbol, timeframe, candleCount);
    const htfTimeframe = getHTFTimeframe(timeframe);
    const htfCandles = await getBinanceKlines(symbol, htfTimeframe, 150);

    console.log('Running SMC analysis...\n');
    const analysis = analyzeSMC(candles, htfCandles, timeframe);

    const config = getCurrentConfig();
    console.log('📋 Strategy Config:');
    console.log(`   Mode: AGGRESSIVE`);
    console.log(`   Minimum Confluence: ${config.minimumConfluence}`);
    console.log(`   Required Confirmations: [${config.requiredConfirmations.join(', ')}]`);
    console.log(`   Require BOS Confirmation: ${config.requireBOSConfirmation}`);
    console.log(`   Allow Neutral Zone: ${config.allowNeutralZone}`);

    console.log('\n📊 Analysis Results:');
    console.log(`   Bullish Order Blocks: ${analysis.orderBlocks?.bullish?.length || 0}`);
    console.log(`   Bearish Order Blocks: ${analysis.orderBlocks?.bearish?.length || 0}`);
    console.log(`   Bullish FVGs: ${analysis.fvgs?.bullish?.length || 0}`);
    console.log(`   Bearish FVGs: ${analysis.fvgs?.bearish?.length || 0}`);
    console.log(`   Bullish BOS: ${analysis.bos?.bullish?.length || 0}`);
    console.log(`   Bearish BOS: ${analysis.bos?.bearish?.length || 0}`);
    console.log(`   Liquidity Sweeps (bullish): ${analysis.liquiditySweeps?.filter(s => s.direction === 'bullish').length || 0}`);
    console.log(`   Liquidity Sweeps (bearish): ${analysis.liquiditySweeps?.filter(s => s.direction === 'bearish').length || 0}`);

    // Check zone
    const latestCandle = candles[candles.length - 1];
    console.log('\n🎯 Latest Price Analysis:');
    console.log(`   Latest Close: ${latestCandle.close}`);

    if (analysis.premiumDiscount) {
      console.log(`   Zone: ${analysis.premiumDiscount.zone || 'unknown'}`);
      console.log(`   Premium: ${analysis.premiumDiscount.premium ? analysis.premiumDiscount.premium.toFixed(2) : 'N/A'}`);
      console.log(`   Discount: ${analysis.premiumDiscount.discount ? analysis.premiumDiscount.discount.toFixed(2) : 'N/A'}`);
      console.log(`   Distance: ${analysis.premiumDiscount.distance ? analysis.premiumDiscount.distance.toFixed(2) + '%' : 'N/A'}`);
    }

    // Check zone validity for signals
    const validZoneForBullish = config.minimumConfluence <= 25
      ? true
      : config.allowNeutralZone
        ? (analysis.premiumDiscount?.zone === 'discount' || analysis.premiumDiscount?.zone === 'neutral')
        : analysis.premiumDiscount?.zone === 'discount';

    const validZoneForBearish = config.minimumConfluence <= 25
      ? true
      : config.allowNeutralZone
        ? (analysis.premiumDiscount?.zone === 'premium' || analysis.premiumDiscount?.zone === 'neutral')
        : analysis.premiumDiscount?.zone === 'premium';

    console.log('\n✅ Zone Validation:');
    console.log(`   Valid for Bullish: ${validZoneForBullish}`);
    console.log(`   Valid for Bearish: ${validZoneForBearish}`);

    // Check recent order blocks
    const recentBullishOB = analysis.orderBlocks.bullish?.filter(ob => ob.index >= candles.length - 20) || [];
    const recentBearishOB = analysis.orderBlocks.bearish?.filter(ob => ob.index >= candles.length - 20) || [];

    console.log('\n📦 Recent Order Blocks (last 20 candles):');
    console.log(`   Bullish: ${recentBullishOB.length}`);
    console.log(`   Bearish: ${recentBearishOB.length}`);

    // Check confirmations for bullish signal
    if (validZoneForBullish && recentBullishOB.length > 0) {
      console.log('\n🔵 BULLISH Signal Check:');
      const hasLiquiditySweep = analysis.liquiditySweeps?.filter(s => s.direction === 'bullish' && s.index >= candles.length - 15).length > 0;
      const hasBOS = analysis.bos?.bullish?.length > 0;
      const hasFVG = analysis.fvgs?.bullish?.length > 0;
      const hasValidZone = validZoneForBullish;

      console.log(`   Has Liquidity Sweep: ${hasLiquiditySweep}`);
      console.log(`   Has BOS: ${hasBOS}`);
      console.log(`   Has FVG: ${hasFVG}`);
      console.log(`   Has Valid Zone: ${hasValidZone}`);

      // Check if required confirmations pass
      const requiredPassed = config.requiredConfirmations.every(conf => {
        if (conf === 'bos') return hasBOS;
        if (conf === 'fvg') return hasFVG;
        if (conf === 'validZone') return hasValidZone;
        return false;
      });

      console.log(`   Required Confirmations Passed: ${requiredPassed} (required: [${config.requiredConfirmations.join(', ')}])`);

      if (!requiredPassed) {
        console.log('   ❌ BLOCKED: Required confirmations not met');
      } else {
        console.log('   ✅ Confirmations passed!');
        // Now check if BOS confirmation is required
        console.log(`   Require BOS Confirmation: ${config.requireBOSConfirmation}`);
        if (config.requireBOSConfirmation && !hasBOS) {
          console.log('   ❌ BLOCKED: BOS confirmation required but not found');
        } else {
          console.log('   ✅ Should generate signal! (but it didn\'t...)');
        }
      }
    } else {
      console.log('\n🔵 BULLISH Signal Check:');
      console.log(`   ❌ BLOCKED: ${!validZoneForBullish ? 'Invalid zone' : 'No recent order blocks'}`);
    }

    // Check confirmations for bearish signal
    if (validZoneForBearish && recentBearishOB.length > 0) {
      console.log('\n🔴 BEARISH Signal Check:');
      const hasLiquiditySweep = analysis.liquiditySweeps?.filter(s => s.direction === 'bearish' && s.index >= candles.length - 15).length > 0;
      const hasBOS = analysis.bos?.bearish?.length > 0;
      const hasFVG = analysis.fvgs?.bearish?.length > 0;
      const hasValidZone = validZoneForBearish;

      console.log(`   Has Liquidity Sweep: ${hasLiquiditySweep}`);
      console.log(`   Has BOS: ${hasBOS}`);
      console.log(`   Has FVG: ${hasFVG}`);
      console.log(`   Has Valid Zone: ${hasValidZone}`);

      const requiredPassed = config.requiredConfirmations.every(conf => {
        if (conf === 'bos') return hasBOS;
        if (conf === 'fvg') return hasFVG;
        if (conf === 'validZone') return hasValidZone;
        return false;
      });

      console.log(`   Required Confirmations Passed: ${requiredPassed} (required: [${config.requiredConfirmations.join(', ')}])`);

      if (!requiredPassed) {
        console.log('   ❌ BLOCKED: Required confirmations not met');
      } else {
        console.log('   ✅ Confirmations passed!');
        console.log(`   Require BOS Confirmation: ${config.requireBOSConfirmation}`);
        if (config.requireBOSConfirmation && !hasBOS) {
          console.log('   ❌ BLOCKED: BOS confirmation required but not found');
        } else {
          console.log('   ✅ Should generate signal! (but it didn\'t...)');
        }
      }
    } else {
      console.log('\n🔴 BEARISH Signal Check:');
      console.log(`   ❌ BLOCKED: ${!validZoneForBearish ? 'Invalid zone' : 'No recent order blocks'}`);
    }

    console.log(`\n🎯 ACTUAL SIGNALS GENERATED: ${analysis.signals?.length || 0}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

debugSignalLogic();
