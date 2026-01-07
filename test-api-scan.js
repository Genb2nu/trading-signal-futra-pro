/**
 * Test Live API Scan
 * Makes a real API call to the server to test validation logging
 */

import axios from 'axios';

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  LIVE API SCAN TEST                                      ║');
console.log('║  Testing validation logging via API endpoint             ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

async function testApiScan() {
  try {
    console.log('🔍 Sending scan request to server...\n');
    console.log('   Endpoint: http://localhost:3000/api/scan');
    console.log('   Symbols: BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, ADAUSDT');
    console.log('   Timeframe: 1h\n');

    const response = await axios.post('http://localhost:3000/api/scan', {
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'],
      timeframe: '1h'
    });

    const data = response.data;

    console.log('═'.repeat(60));
    console.log('📊 SCAN RESPONSE');
    console.log('═'.repeat(60));
    console.log(`   Success: ${data.success ? '✅ YES' : '❌ NO'}`);
    console.log(`   Symbols scanned: ${data.scanned}`);
    console.log(`   Signals found: ${data.found}`);
    console.log(`   Timestamp: ${data.timestamp}\n`);

    if (data.signals && data.signals.length > 0) {
      console.log('🎯 SIGNALS DETECTED:\n');
      data.signals.forEach((sig, i) => {
        console.log(`   ${i + 1}. ${sig.symbol} ${sig.direction.toUpperCase()} [${sig.timeframe}]`);
        console.log(`      Entry: $${sig.entry}`);
        console.log(`      Stop Loss: $${sig.stopLoss}`);
        console.log(`      Take Profit: $${sig.takeProfit}`);
        console.log(`      R:R: ${sig.riskReward}`);
        console.log(`      Confidence: ${sig.confidence}`);
        console.log(`      Patterns: ${sig.patterns}\n`);
      });

      console.log('✅ Signals should now be logged in validation system!\n');
    } else {
      console.log('ℹ️  No signals found with current market conditions.\n');
      console.log('💡 This is normal with Phase 3 strict SMC methodology.\n');
      console.log('   The system is waiting for proper setups with:');
      console.log('   - ICT-validated Order Blocks');
      console.log('   - BOS/CHoCH structure breaks');
      console.log('   - Price return to OB zones');
      console.log('   - Rejection pattern confirmations\n');
    }

    console.log('═'.repeat(60));
    console.log('📋 CHECK VALIDATION LOGS');
    console.log('═'.repeat(60));
    console.log('   Run: node view-validation-data.js summary\n');

  } catch (error) {
    console.error('❌ API Request Failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    } else if (error.request) {
      console.error('   No response from server. Is it running?');
    }
  }
}

testApiScan();
