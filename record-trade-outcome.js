/**
 * Trade Outcome Recorder
 * CLI tool to manually record outcomes for tracked signals during validation
 */

import readline from 'readline';
import {
  getLoggedSignals,
  logSignalOutcome,
  addSignalNote
} from './src/services/validationLogger.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function recordOutcome() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  TRADE OUTCOME RECORDER                                  ║');
  console.log('║  Record win/loss for tracked signals                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // Get all tracked signals without outcomes
    const trackedSignals = getLoggedSignals({ tracked: true });
    const openSignals = trackedSignals.filter(s => s.outcome === null);

    if (openSignals.length === 0) {
      console.log('✅ No open tracked signals. All have outcomes recorded!\n');
      rl.close();
      return;
    }

    console.log(`📊 Found ${openSignals.length} open tracked signal(s):\n`);

    openSignals.forEach((sig, i) => {
      const time = new Date(sig.timestamp).toLocaleString();
      console.log(`${i + 1}. ${sig.symbol} ${sig.signal.direction.toUpperCase()} [${sig.mode}]`);
      console.log(`   Detected: ${time}`);
      console.log(`   Entry: $${sig.signal.entry.toFixed(4)} | SL: $${sig.signal.stopLoss.toFixed(4)} | TP: $${sig.signal.takeProfit.toFixed(4)}`);
      console.log(`   R:R: ${sig.signal.riskReward.toFixed(2)} | Confluence: ${sig.signal.confluenceScore}`);
      console.log(`   ID: ${sig.id}\n`);
    });

    const choice = await question('Select signal number to record outcome (or "q" to quit): ');

    if (choice.toLowerCase() === 'q') {
      console.log('\nExiting...\n');
      rl.close();
      return;
    }

    const index = parseInt(choice) - 1;

    if (isNaN(index) || index < 0 || index >= openSignals.length) {
      console.log('\n❌ Invalid selection.\n');
      rl.close();
      return;
    }

    const signal = openSignals[index];

    console.log(`\n📝 Recording outcome for: ${signal.symbol} ${signal.signal.direction.toUpperCase()}`);
    console.log(`   Entry: $${signal.signal.entry.toFixed(4)}`);
    console.log(`   SL: $${signal.signal.stopLoss.toFixed(4)}`);
    console.log(`   TP: $${signal.signal.takeProfit.toFixed(4)}`);
    console.log(`   Expected R:R: ${signal.signal.riskReward.toFixed(2)}\n`);

    // Get outcome
    const outcome = await question('Outcome (1=Win, 2=Loss, 3=Breakeven): ');

    let outcomeType;
    switch (outcome) {
      case '1':
        outcomeType = 'win';
        break;
      case '2':
        outcomeType = 'loss';
        break;
      case '3':
        outcomeType = 'breakeven';
        break;
      default:
        console.log('\n❌ Invalid outcome. Exiting.\n');
        rl.close();
        return;
    }

    // Get exit price
    const exitPriceStr = await question('Exit price: $');
    const exitPrice = parseFloat(exitPriceStr);

    if (isNaN(exitPrice) || exitPrice <= 0) {
      console.log('\n❌ Invalid exit price. Exiting.\n');
      rl.close();
      return;
    }

    // Calculate R:R achieved
    const entry = signal.signal.entry;
    const sl = signal.signal.stopLoss;
    const direction = signal.signal.direction;

    let riskRewardAchieved = 0;
    let profitLoss = 0;

    if (direction === 'bullish') {
      const risk = entry - sl;
      const reward = exitPrice - entry;
      riskRewardAchieved = risk !== 0 ? reward / risk : 0;
      profitLoss = ((exitPrice - entry) / entry) * 100;
    } else {
      const risk = sl - entry;
      const reward = entry - exitPrice;
      riskRewardAchieved = risk !== 0 ? reward / risk : 0;
      profitLoss = ((entry - exitPrice) / entry) * 100;
    }

    // Get optional notes
    const notes = await question('Notes (optional, press Enter to skip): ');

    // Record the outcome
    logSignalOutcome(signal.id, outcomeType, {
      exitPrice,
      riskRewardAchieved: riskRewardAchieved.toFixed(2),
      profitLoss: profitLoss.toFixed(2),
      notes: notes || ''
    });

    console.log('\n✅ Outcome recorded successfully!\n');
    console.log('📊 Summary:');
    console.log(`   Outcome: ${outcomeType.toUpperCase()}`);
    console.log(`   Entry: $${entry.toFixed(4)}`);
    console.log(`   Exit:  $${exitPrice.toFixed(4)}`);
    console.log(`   R:R Achieved: ${riskRewardAchieved.toFixed(2)}`);
    console.log(`   P/L: ${profitLoss > 0 ? '+' : ''}${profitLoss.toFixed(2)}%\n`);

    // Ask if user wants to record another
    const another = await question('Record another outcome? (y/n): ');

    if (another.toLowerCase() === 'y') {
      rl.close();
      // Restart the script
      recordOutcome();
    } else {
      console.log('\n👋 Done! View all outcomes with: node view-validation-data.js outcomes\n');
      rl.close();
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    rl.close();
  }
}

// Run the script
recordOutcome();
