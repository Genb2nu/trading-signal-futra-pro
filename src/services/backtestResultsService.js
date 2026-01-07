/**
 * Backtest Results Service
 * Handles fetching and caching of backtest data from the API
 */

// Use relative URLs in production, localhost in development
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.MODE === 'production' ? '' : 'http://localhost:3000');

/**
 * Fetch the latest backtest results
 * @returns {Promise<Object>} Latest backtest data
 */
export async function getLatestBacktest() {
  try {
    const response = await fetch(`${API_URL}/api/backtest-results?endpoint=latest`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('No backtest results found. Run a backtest to generate results.');
      }
      throw new Error(`Failed to fetch backtest results: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching latest backtest:', error);
    throw error;
  }
}

/**
 * Fetch all available backtest runs
 * @returns {Promise<Object>} Index of all backtest runs
 */
export async function getAllBacktestRuns() {
  try {
    const response = await fetch(`${API_URL}/api/backtest-results?endpoint=runs`);

    if (!response.ok) {
      throw new Error(`Failed to fetch backtest runs: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching backtest runs:', error);
    throw error;
  }
}

/**
 * Fetch a specific backtest run by ID
 * @param {string} id - Backtest run ID
 * @returns {Promise<Object>} Backtest data for the specified run
 */
export async function getBacktestRunById(id) {
  try {
    const response = await fetch(`${API_URL}/api/backtest-results?endpoint=run&id=${id}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Backtest run not found: ${id}`);
      }
      throw new Error(`Failed to fetch backtest run: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching backtest run:', error);
    throw error;
  }
}

/**
 * Check backtest directory status
 * @returns {Promise<Object>} Status information
 */
export async function getBacktestStatus() {
  try {
    const response = await fetch(`${API_URL}/api/backtest-results?endpoint=status`);

    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking backtest status:', error);
    throw error;
  }
}

/**
 * Extract all trades from backtest results
 * @param {Object} backtestData - Full backtest data object
 * @returns {Array} Flattened array of all trades with symbol information
 */
export function extractAllTrades(backtestData) {
  if (!backtestData) {
    return [];
  }

  // PRIORITY 1: Check if trades array exists at root level (individual run format)
  if (backtestData.trades && Array.isArray(backtestData.trades)) {
    return backtestData.trades;
  }

  // PRIORITY 2: Check if results exists
  if (!backtestData.results) {
    return [];
  }

  const allTrades = [];

  // Handle comprehensive format: results[mode][timeframe][symbol]
  if (typeof backtestData.results === 'object' && !Array.isArray(backtestData.results)) {
    // Check if it's comprehensive format (has mode keys like 'conservative', 'moderate')
    const firstKey = Object.keys(backtestData.results)[0];
    const firstValue = backtestData.results[firstKey];

    // If first value is an object with timeframe keys (like '15m', '1h')
    if (firstValue && typeof firstValue === 'object' && !Array.isArray(firstValue) && firstValue.trades === undefined) {
      // Comprehensive format: { conservative: { '15m': { BTCUSDT: {...}, ... }, ... }, ... }
      Object.entries(backtestData.results).forEach(([mode, timeframes]) => {
        Object.entries(timeframes).forEach(([timeframe, symbols]) => {
          Object.entries(symbols).forEach(([symbol, symbolData]) => {
            if (symbolData.trades && Array.isArray(symbolData.trades)) {
              symbolData.trades.forEach(trade => {
                allTrades.push({
                  ...trade,
                  symbol,
                  mode,
                  timeframe
                });
              });
            }
          });
        });
      });
    } else {
      // Individual run format: results = { BTCUSDT: {...}, ETHUSDT: {...} }
      Object.entries(backtestData.results).forEach(([symbol, symbolData]) => {
        if (symbolData.trades && Array.isArray(symbolData.trades)) {
          symbolData.trades.forEach(trade => {
            allTrades.push({
              ...trade,
              symbol,
              mode: backtestData.mode,
              timeframe: backtestData.timeframe
            });
          });
        }
      });
    }
  } else if (Array.isArray(backtestData.results)) {
    // Old format: array of results
    backtestData.results.forEach(result => {
      if (result.trades && result.trades.length > 0) {
        result.trades.forEach(trade => {
          allTrades.push({
            ...trade,
            symbol: result.symbol
          });
        });
      }
    });
  }

  return allTrades;
}

/**
 * Filter trades by criteria
 * @param {Array} trades - Array of trades
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered trades
 */
export function filterTrades(trades, filters = {}) {
  let filtered = [...trades];

  // Filter by result type
  if (filters.result && filters.result !== 'all') {
    filtered = filtered.filter(trade => {
      if (filters.result === 'win') {
        return trade.pnlR > 0;
      } else if (filters.result === 'loss') {
        return trade.pnlR < 0;
      }
      return true;
    });
  }

  // Filter by symbol
  if (filters.symbol && filters.symbol !== 'all') {
    filtered = filtered.filter(trade => trade.symbol === filters.symbol);
  }

  // Filter by minimum confluence
  if (filters.minConfluence) {
    filtered = filtered.filter(trade => {
      return trade.signal?.confluenceScore >= filters.minConfluence;
    });
  }

  // Filter by trade type
  if (filters.type && filters.type !== 'all') {
    filtered = filtered.filter(trade => trade.signal?.type === filters.type);
  }

  return filtered;
}

/**
 * Sort trades by specified field
 * @param {Array} trades - Array of trades
 * @param {string} sortBy - Field to sort by
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} Sorted trades
 */
export function sortTrades(trades, sortBy = 'signalTime', order = 'desc') {
  const sorted = [...trades];

  sorted.sort((a, b) => {
    let aValue, bValue;

    switch (sortBy) {
      case 'pnl':
        aValue = a.pnlR || 0;
        bValue = b.pnlR || 0;
        break;
      case 'confluence':
        aValue = a.signal?.confluenceScore || 0;
        bValue = b.signal?.confluenceScore || 0;
        break;
      case 'symbol':
        aValue = a.symbol || '';
        bValue = b.symbol || '';
        break;
      case 'signalTime':
      default:
        aValue = new Date(a.signalTime).getTime();
        bValue = new Date(b.signalTime).getTime();
        break;
    }

    if (order === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  return sorted;
}

/**
 * Paginate trades array
 * @param {Array} trades - Array of trades
 * @param {number} page - Page number (1-indexed)
 * @param {number} pageSize - Number of items per page
 * @returns {Object} Paginated result with trades and metadata
 */
export function paginateTrades(trades, page = 1, pageSize = 50) {
  const totalItems = trades.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    trades: trades.slice(startIndex, endIndex),
    pagination: {
      currentPage: page,
      pageSize,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}
