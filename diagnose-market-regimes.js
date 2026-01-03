/**
 * Market Regime Diagnostic - Analyze regime distribution
 * Shows what market regimes were detected during backtest period
 */

import { getBinanceKlines } from './src/services/binanceClient.js';
import { detectMarketRegime } from './src/shared/marketRegime.js';

console.log('═══════════════════════════════════════════════════');
console.log('  MARKET REGIME ANALYSIS');
console.log('═══════════════════════════════════════════════════');
console.log('');

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
const TIMEFRAMES = ['15m', '1h', '4h'];
const CANDLE_COUNT = 1000;

async function analyzeMarketRegimes() {
  for (const symbol of SYMBOLS) {
    console.log(`\n${'═'.repeat(55)}`);
    console.log(`  ${symbol}`);
    console.log(`${'═'.repeat(55)}\n`);

    for (const timeframe of TIMEFRAMES) {
      try {
        // Fetch candles
        const candles = await getBinanceKlines(symbol, timeframe, CANDLE_COUNT);

        if (!candles || candles.length < 50) {
          console.log(`  ⚠️  ${timeframe}: Insufficient data`);
          continue;
        }

        // Analyze regime every 100 candles to see how it changes
        const regimeSnapshots = [];
        const samplePoints = [200, 400, 600, 800, 1000]; // Sample at different points

        for (const point of samplePoints) {
          if (point <= candles.length) {
            const subset = candles.slice(0, point);
            const regime = detectMarketRegime(subset);
            regimeSnapshots.push({
              candles: point,
              ...regime
            });
          }
        }

        // Overall regime (full dataset)
        const overallRegime = detectMarketRegime(candles);

        console.log(`  📊 ${timeframe} Timeframe:`);
        console.log(`  ${'─'.repeat(53)}`);
        console.log(`  Current Regime: ${overallRegime.regime}`);
        console.log(`  ADX: ${overallRegime.adx} (>25 = strong trend, <20 = weak/range)`);
        console.log(`  BB Width: ${overallRegime.bbWidthPercent}% (>3% = high volatility, <1.5% = tight range)`);
        console.log(`  Recommendation: ${overallRegime.recommendation.action}`);
        console.log(`  Message: ${overallRegime.recommendation.message}`);

        // Regime distribution
        const regimeCounts = {
          'STRONG_TREND': 0,
          'WEAK_TREND': 0,
          'CHOPPY': 0,
          'TIGHT_RANGE': 0
        };

        regimeSnapshots.forEach(snap => {
          if (regimeCounts[snap.regime] !== undefined) {
            regimeCounts[snap.regime]++;
          }
        });

        const total = samplePoints.length;
        console.log(`\n  Regime Distribution (${total} samples):`);
        console.log(`    Strong Trend: ${regimeCounts['STRONG_TREND']} (${(regimeCounts['STRONG_TREND']/total*100).toFixed(0)}%)`);
        console.log(`    Weak Trend:   ${regimeCounts['WEAK_TREND']} (${(regimeCounts['WEAK_TREND']/total*100).toFixed(0)}%)`);
        console.log(`    Choppy:       ${regimeCounts['CHOPPY']} (${(regimeCounts['CHOPPY']/total*100).toFixed(0)}%)`);
        console.log(`    Tight Range:  ${regimeCounts['TIGHT_RANGE']} (${(regimeCounts['TIGHT_RANGE']/total*100).toFixed(0)}%)`);

        // Show regime evolution
        console.log(`\n  Regime Evolution:`);
        regimeSnapshots.forEach(snap => {
          const icon = snap.regime === 'STRONG_TREND' ? '📈' :
                      snap.regime === 'WEAK_TREND' ? '📊' :
                      snap.regime === 'CHOPPY' ? '⚡' : '📉';
          console.log(`    ${icon} Candle ${snap.candles}: ${snap.regime.padEnd(14)} (ADX: ${snap.adx.toString().padStart(5)}, BB: ${snap.bbWidthPercent.toFixed(2).padStart(5)}%)`);
        });

        console.log('');

      } catch (error) {
        console.error(`  ❌ ${timeframe}: ${error.message}`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  KEY INSIGHTS');
  console.log('═══════════════════════════════════════════════════\n');
  console.log('Regime Filter Impact:');
  console.log('  • STRONG_TREND: Signals allowed, confluence +10 bonus');
  console.log('  • WEAK_TREND: Signals allowed, confluence +5 bonus');
  console.log('  • CHOPPY: Signals allowed but confluence -10 penalty');
  console.log('  • TIGHT_RANGE: Signals blocked in conservative mode, -15 penalty\n');
  console.log('If most samples show CHOPPY or TIGHT_RANGE:');
  console.log('  → Explains why few signals were generated');
  console.log('  → Filter is working correctly (avoiding bad conditions)');
  console.log('  → Try longer backtest period to capture trending phases\n');
}

analyzeMarketRegimes().catch(console.error);
