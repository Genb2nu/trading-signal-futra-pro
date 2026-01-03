/**
 * Debug backtest for ADAUSDT only
 */

import { backtestSymbol } from './src/services/backtestEngine.js';
import { setStrategyMode } from './src/shared/strategyConfig.js';

async function runTest() {
  console.log('Testing ADAUSDT backtest...');
  console.log('');

  setStrategyMode('aggressive');

  const result = await backtestSymbol('ADAUSDT', '4h', 600, 50);

  console.log('Total trades:', result.trades.length);
  console.log('');

  if (result.trades.length > 0) {
    // Show last 3 trades
    const lastTrades = result.trades.slice(-3);

    lastTrades.forEach((trade, i) => {
      console.log(`Trade ${result.trades.length - 2 + i}:`);
      console.log('  Signal Time:', trade.signalTime);
      console.log('  Entry:', trade.signal.entry);
      console.log('  Stop Loss:', trade.signal.stopLoss);
      console.log('  Take Profit:', trade.signal.takeProfit);
      console.log('  Type:', trade.signal.type);
      console.log('  Result:', trade.result);
      console.log('');
    });
  }
}

runTest().catch(console.error);
