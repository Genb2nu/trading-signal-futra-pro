import axios from 'axios';

const BINANCE_API_URL = 'https://api3.binance.com/api';

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
 * Test connection to Binance API
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testConnection() {
  try {
    const url = `${BINANCE_API_URL}/v3/ping`;
    await axios.get(url);
    return true;
  } catch (error) {
    console.error('Binance API connection failed:', error.message);
    return false;
  }
}
