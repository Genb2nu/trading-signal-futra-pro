import axios from 'axios';

async function verifyExactCandles() {
  console.log('\n=== Verifying SOLUSDT 1H candles ===\n');

  // Fetch specific time range
  const startTime = new Date('2026-01-02T22:00:00Z').getTime();
  const endTime = new Date('2026-01-03T02:00:00Z').getTime();

  const url = `https://api.binance.com/api/v3/klines?symbol=SOLUSDT&interval=1h&startTime=${startTime}&endTime=${endTime}`;

  console.log('Fetching from Binance Spot API:');
  console.log(`Start: ${new Date(startTime).toISOString()}`);
  console.log(`End: ${new Date(endTime).toISOString()}`);
  console.log(`URL: ${url}\n`);

  const response = await axios.get(url);

  console.log('Candles received:\n');
  response.data.forEach(k => {
    const time = new Date(k[0]);
    const open = parseFloat(k[1]);
    const high = parseFloat(k[2]);
    const low = parseFloat(k[3]);
    const close = parseFloat(k[4]);

    console.log(`${time.toISOString().replace('T', ' ').slice(0, 16)}`);
    console.log(`  O=${open.toFixed(2)} H=${high.toFixed(2)} L=${low.toFixed(2)} C=${close.toFixed(2)}`);
  });

  console.log('\n=== User reported from Binance UI: ===');
  console.log('02 Jan 26 23:00: O=128.74 H=129.53 L=127.41 C=128.98');
  console.log('03 Jan 26 00:00: O=128.98 H=131.79 L=128.68 C=130.92');
  console.log('03 Jan 26 01:00: O=130.92 H=132.30 L=130.69 C=131.44');
}

verifyExactCandles().catch(console.error);
