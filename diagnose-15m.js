/**
 * Diagnose why 15m generates so few signals
 */

import { backtestSymbol } from './src/services/backtestEngine.js';
import { setStrategyMode } from './src/shared/strategyConfig.js';

async function diagnose15m() {
  console.log('🔍 Diagnosing 15m Signal Generation\n');

  // Test with MODERATE mode on BTCUSDT 15m
  setStrategyMode('MODERATE');

  console.log('Testing BTCUSDT on 15m with MODERATE mode...\n');

  const result = await backtestSymbol('BTCUSDT', '15m', 3000, 100);

  console.log('Results:');
  console.log(`- Total Trades: ${result.trades?.length || 0}`);
  console.log(`- Candles Analyzed: ${result.candleCount || 0}`);
  console.log('');

  if (result.trades && result.trades.length > 0) {
    console.log('Sample Trade Details:');
    console.log(JSON.stringify(result.trades[0].signal, null, 2));
  } else {
    console.log('❌ No trades generated!');
    console.log('');
    console.log('Possible reasons:');
    console.log('1. strictHTFAlignment: true - requires HTF trend alignment');
    console.log('2. minimumConfluence too high for 15m volatility');
    console.log('3. requireRejectionPattern: true - rejection candles rare on 15m');
    console.log('4. allowNeutralZone: false - too restrictive for choppy 15m');
    console.log('5. Order block impulse threshold too high for 15m moves');
  }
}

diagnose15m().catch(console.error);
