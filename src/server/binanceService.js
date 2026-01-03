import axios from 'axios';

// Try different Binance API endpoints (some may be geo-restricted)
const BINANCE_API_ENDPOINTS = [
  'https://api.binance.com/api',      // Primary endpoint
  'https://api1.binance.com/api',     // Alternative 1
  'https://api2.binance.com/api',     // Alternative 2
  'https://api3.binance.com/api',     // Alternative 3
  'https://data.binance.com/api'      // Data endpoint
];

const BINANCE_API_URL = BINANCE_API_ENDPOINTS[0]; // Use primary by default

/**
 * Fetches kline (candlestick) data from Binance
 * @param {string} symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @param {string} interval - Timeframe (1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M)
 * @param {number} limit - Number of candles to fetch (default: 500, max: 1000)
 * @returns {Promise<Array>} Array of kline objects
 */
export async function getBinanceKlines(symbol, interval, limit = 500) {
  try {
    const url = `${BINANCE_API_URL}/v3/klines`;
    const params = {
      symbol: symbol,
      interval: interval,
      limit: Math.min(limit, 1000)
    };

    const response = await axios.get(url, { params });

    // Transform Binance kline format to usable format
    return response.data.map(candle => ({
      openTime: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
      closeTime: candle[6],
      timestamp: new Date(candle[0]).toISOString()
    }));
  } catch (error) {
    console.error(`Error fetching klines for ${symbol}:`, error.message);
    throw new Error(`Failed to fetch klines for ${symbol}: ${error.message}`);
  }
}

/**
 * Fetches extended kline data from Binance (more than 1000 candles)
 * Makes multiple API calls and merges results
 * @param {string} symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @param {string} interval - Timeframe (1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M)
 * @param {number} totalCandles - Total number of candles to fetch (e.g., 2000, 3000)
 * @returns {Promise<Array>} Array of kline objects
 */
export async function getBinanceKlinesExtended(symbol, interval, totalCandles) {
  try {
    const allCandles = [];
    const batchSize = 1000; // Max per API call
    const batches = Math.ceil(totalCandles / batchSize);

    // Get timeframe in milliseconds
    const intervalMs = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000
    }[interval];

    if (!intervalMs) {
      throw new Error(`Invalid interval: ${interval}`);
    }

    // Fetch in reverse chronological order (newest first)
    let endTime = Date.now();

    for (let i = 0; i < batches; i++) {
      const limit = Math.min(batchSize, totalCandles - allCandles.length);

      const url = `${BINANCE_API_URL}/v3/klines`;
      const params = {
        symbol,
        interval,
        limit,
        endTime
      };

      const response = await axios.get(url, { params });
      const batch = response.data.map(candle => ({
        openTime: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: candle[6],
        timestamp: new Date(candle[0]).toISOString()
      }));

      // Add to beginning (we're going backwards in time)
      allCandles.unshift(...batch);

      // Update endTime to fetch earlier data in next iteration
      if (batch.length > 0) {
        endTime = batch[0].openTime - 1;
      }

      // Small delay to avoid rate limiting
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Stop if we got less than requested (reached earliest available data)
      if (batch.length < limit) {
        break;
      }
    }

    return allCandles.slice(-totalCandles); // Return only the requested amount
  } catch (error) {
    console.error(`Error fetching extended klines for ${symbol}:`, error.message);
    throw new Error(`Failed to fetch extended klines for ${symbol}: ${error.message}`);
  }
}

/**
 * Fetches all available trading pairs from Binance
 * @returns {Promise<Object>} Exchange info with all symbols
 */
export async function getExchangeInfo() {
  try {
    const url = `${BINANCE_API_URL}/v3/exchangeInfo`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching exchange info:', error.message);
    throw new Error(`Failed to fetch exchange info: ${error.message}`);
  }
}

/**
 * Get all USDT trading pairs that are currently trading
 * @returns {Promise<Array>} Array of USDT trading pair symbols
 */
export async function getUSDTSymbols() {
  try {
    const exchangeInfo = await getExchangeInfo();
    const usdtPairs = exchangeInfo.symbols
      .filter(symbol =>
        symbol.quoteAsset === 'USDT' &&
        symbol.status === 'TRADING' &&
        symbol.isSpotTradingAllowed === true
      )
      .map(symbol => symbol.symbol)
      .sort();

    return usdtPairs;
  } catch (error) {
    console.error('Error fetching USDT symbols:', error.message);
    throw new Error(`Failed to fetch USDT symbols: ${error.message}`);
  }
}

/**
 * Test connection to Binance API with fallback endpoints
 * @returns {Promise<Object>} Connection status with details
 */
export async function testConnection() {
  const results = [];

  // Try each endpoint until one works
  for (const endpoint of BINANCE_API_ENDPOINTS) {
    try {
      const url = `${endpoint}/v3/ping`;

      if (typeof fetch !== 'undefined') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);

        results.push({
          endpoint,
          status: response.status,
          ok: response.ok,
          statusText: response.statusText
        });

        if (response.ok) {
          console.log('Binance API ping successful:', endpoint, response.status);
          return true; // Found a working endpoint!
        }
      }
    } catch (error) {
      results.push({
        endpoint,
        error: error.message,
        code: error.code
      });
      console.log(`Failed to connect to ${endpoint}:`, error.message);
    }
  }

  // All endpoints failed
  console.error('All Binance API endpoints failed:', results);
  return false;
}
