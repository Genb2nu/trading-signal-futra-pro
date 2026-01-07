/**
 * View Tracked Signals - Quick Status Dashboard
 * Shows all auto-tracked signals and their current status
 */

import { getLoggedSignals } from './src/services/validationLogger.js';
import axios from 'axios';

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  TRACKED SIGNALS DASHBOARD                               ║');
console.log('║  View all auto-tracked trades and their progress         ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

async function getCurrentPrice(symbol) {
  try {
    const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    return parseFloat(response.data.price);
  } catch (error) {
    return null;
  }
}

function calculateProgress(entry, currentPrice, stopLoss, takeProfit, direction) {
  if (!currentPrice) return null;

  if (direction === 'bullish') {
    const risk = entry - stopLoss;
    const reward = takeProfit - entry;
    const currentGain = currentPrice - entry;
    const percentToTP = (currentGain / reward) * 100;
    const rMultiple = currentGain / risk;

    return {
      currentPrice,
      pnl: ((currentPrice - entry) / entry) * 100,
      rMultiple: rMultiple.toFixed(2),
      percentToTP: percentToTP.toFixed(1),
      status: currentPrice >= takeProfit ? 'HIT TP ✅' :
              currentPrice <= stopLoss ? 'HIT SL ❌' :
              currentGain > 0 ? 'IN PROFIT 🟢' : 'IN LOSS 🔴'
    };
  } else {
    const risk = stopLoss - entry;
    const reward = entry - takeProfit;
    const currentGain = entry - currentPrice;
    const percentToTP = (currentGain / reward) * 100;
    const rMultiple = currentGain / risk;

    return {
      currentPrice,
      pnl: ((entry - currentPrice) / entry) * 100,
      rMultiple: rMultiple.toFixed(2),
      percentToTP: percentToTP.toFixed(1),
      status: currentPrice <= takeProfit ? 'HIT TP ✅' :
              currentPrice >= stopLoss ? 'HIT SL ❌' :
              currentGain > 0 ? 'IN PROFIT 🟢' : 'IN LOSS 🔴'
    };
  }
}

async function viewTrackedSignals() {
  const trackedSignals = getLoggedSignals({ tracked: true });

  if (trackedSignals.length === 0) {
    console.log('ℹ️  No tracked signals yet.\n');
    console.log('💡 Run the auto-trader to start tracking signals:');
    console.log('   node auto-paper-trader.js\n');
    return;
  }

  console.log(`📊 Total Tracked Signals: ${trackedSignals.length}\n`);

  // Separate by outcome
  const openTrades = trackedSignals.filter(s => !s.outcome);
  const closedTrades = trackedSignals.filter(s => s.outcome);

  // Show open trades
  if (openTrades.length > 0) {
    console.log('═'.repeat(60));
    console.log(`🔓 OPEN TRADES (${openTrades.length})`);
    console.log('═'.repeat(60) + '\n');

    for (const trade of openTrades) {
      const sig = trade.signal;
      console.log(`📍 ${trade.symbol} ${sig.direction.toUpperCase()} [${trade.timeframe}]`);
      console.log(`   Tracked: ${new Date(trade.trackedAt).toLocaleString()}`);
      console.log(`   Entry: $${sig.entry.toFixed(4)} | SL: $${sig.stopLoss.toFixed(4)} | TP: $${sig.takeProfit.toFixed(4)}`);
      console.log(`   R:R: ${sig.riskReward.toFixed(2)} | Confluence: ${sig.confluenceScore}`);

      // Get current price and calculate progress
      console.log(`\n   🔄 Fetching current price...`);
      const currentPrice = await getCurrentPrice(trade.symbol);

      if (currentPrice) {
        const progress = calculateProgress(
          sig.entry,
          currentPrice,
          sig.stopLoss,
          sig.takeProfit,
          sig.direction
        );

        console.log(`   💰 Current: $${currentPrice.toFixed(4)}`);
        console.log(`   📈 P/L: ${progress.pnl > 0 ? '+' : ''}${progress.pnl.toFixed(2)}%`);
        console.log(`   📊 R Multiple: ${progress.rMultiple}R`);
        console.log(`   🎯 To TP: ${progress.percentToTP}%`);
        console.log(`   ⚡ Status: ${progress.status}`);

        // Suggestion
        if (progress.status.includes('HIT TP')) {
          console.log(`\n   ✅ TRADE WINNER! Record outcome:`);
          console.log(`      node record-trade-outcome.js`);
        } else if (progress.status.includes('HIT SL')) {
          console.log(`\n   ❌ STOP LOSS HIT! Record outcome:`);
          console.log(`      node record-trade-outcome.js`);
        }
      } else {
        console.log(`   ⚠️  Could not fetch current price`);
      }

      console.log('');
      await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit
    }
  }

  // Show closed trades
  if (closedTrades.length > 0) {
    console.log('═'.repeat(60));
    console.log(`🔒 CLOSED TRADES (${closedTrades.length})`);
    console.log('═'.repeat(60) + '\n');

    let wins = 0;
    let losses = 0;
    let breakeven = 0;

    for (const trade of closedTrades) {
      const sig = trade.signal;
      const outcome = trade.outcome;

      const emoji = outcome.result === 'win' ? '🎯' :
                    outcome.result === 'loss' ? '❌' : '⚖️';

      console.log(`${emoji} ${trade.symbol} ${sig.direction.toUpperCase()} [${trade.timeframe}]`);
      console.log(`   Entry: $${sig.entry.toFixed(4)} → Exit: $${outcome.exitPrice}`);
      console.log(`   Result: ${outcome.result.toUpperCase()} | R:R: ${outcome.riskRewardAchieved} | P/L: ${outcome.profitLoss}%`);
      console.log(`   Closed: ${new Date(outcome.timestamp).toLocaleString()}`);
      if (outcome.notes) {
        console.log(`   Notes: ${outcome.notes}`);
      }
      console.log('');

      if (outcome.result === 'win') wins++;
      else if (outcome.result === 'loss') losses++;
      else breakeven++;
    }

    // Show statistics
    console.log('═'.repeat(60));
    console.log('📊 CLOSED TRADES STATISTICS');
    console.log('═'.repeat(60));
    console.log(`   Total: ${closedTrades.length}`);
    console.log(`   Wins: ${wins} (${((wins/closedTrades.length)*100).toFixed(1)}%)`);
    console.log(`   Losses: ${losses} (${((losses/closedTrades.length)*100).toFixed(1)}%)`);
    console.log(`   Breakeven: ${breakeven} (${((breakeven/closedTrades.length)*100).toFixed(1)}%)`);
    console.log(`   Win Rate: ${((wins/closedTrades.length)*100).toFixed(1)}%`);
    console.log('');
  }

  console.log('═'.repeat(60));
  console.log('📝 QUICK ACTIONS');
  console.log('═'.repeat(60));
  console.log('   View all validation data: node view-validation-data.js summary');
  console.log('   Record trade outcome: node record-trade-outcome.js');
  console.log('   Start auto-trader: node auto-paper-trader.js');
  console.log('   View outcomes analysis: node view-validation-data.js outcomes');
  console.log('');
}

viewTrackedSignals().catch(error => {
  console.error('❌ Error:', error.message);
});
