/**
 * Binance WebSocket Service
 * Manages real-time price streams for multiple symbols using WebSocket connections
 *
 * Features:
 * - Single WebSocket connection per unique symbol (connection pooling)
 * - Subscribe/unsubscribe pattern for multiple listeners
 * - Automatic reconnection with exponential backoff
 * - Efficient resource management (auto-cleanup when no subscribers)
 */

const BINANCE_WS_ENDPOINTS = [
  'wss://stream.binance.com:9443/ws',
  'wss://stream.binance.us:9443/ws'
];

class BinanceWebSocketManager {
  constructor() {
    this.connections = new Map(); // symbol -> WebSocket
    this.subscribers = new Map(); // symbol -> Set<callback>
    this.reconnectAttempts = new Map(); // symbol -> number
    this.maxReconnectAttempts = 5;
    this.reconnectTimers = new Map(); // symbol -> timeoutId
  }

  /**
   * Subscribe to real-time price updates for a symbol
   * @param {string} symbol - Trading pair (e.g., "BTCUSDT")
   * @param {function} callback - Called with price updates: { symbol, price, timestamp }
   * @returns {function} Unsubscribe function
   */
  subscribe(symbol, callback) {
    const lowerSymbol = symbol.toLowerCase();

    // Add callback to subscribers
    if (!this.subscribers.has(lowerSymbol)) {
      this.subscribers.set(lowerSymbol, new Set());
    }
    this.subscribers.get(lowerSymbol).add(callback);

    // Create WebSocket connection if it doesn't exist
    if (!this.connections.has(lowerSymbol)) {
      this._connect(lowerSymbol);
    }

    // Return unsubscribe function
    return () => this.unsubscribe(lowerSymbol, callback);
  }

  /**
   * Connect to Binance WebSocket for a symbol
   * Uses ticker stream: wss://stream.binance.com:9443/ws/{symbol}@ticker
   * @param {string} symbol - Trading pair in lowercase
   * @private
   */
  _connect(symbol) {
    try {
      const endpoint = `${BINANCE_WS_ENDPOINTS[0]}/${symbol}@ticker`;
      const ws = new WebSocket(endpoint);

      ws.onopen = () => {
        console.log(`[WebSocket] Connected to ${symbol}`);
        this.reconnectAttempts.set(symbol, 0); // Reset reconnect counter
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Binance ticker format: { s: 'BTCUSDT', c: '42000.50', E: 1703123456789 }
          const update = {
            symbol: data.s,
            price: parseFloat(data.c), // Current price
            timestamp: data.E // Event time
          };

          // Call all subscribers for this symbol
          const callbacks = this.subscribers.get(symbol);
          if (callbacks) {
            callbacks.forEach(callback => {
              try {
                callback(update);
              } catch (error) {
                console.error(`[WebSocket] Error in callback for ${symbol}:`, error);
              }
            });
          }
        } catch (error) {
          console.error(`[WebSocket] Error parsing message for ${symbol}:`, error);
        }
      };

      ws.onerror = (error) => {
        console.error(`[WebSocket] Error for ${symbol}:`, error);
      };

      ws.onclose = (event) => {
        console.log(`[WebSocket] Closed for ${symbol}:`, event.code, event.reason);

        // Remove connection from map
        this.connections.delete(symbol);

        // Attempt to reconnect if there are still subscribers
        if (this.subscribers.has(symbol) && this.subscribers.get(symbol).size > 0) {
          this._reconnect(symbol);
        }
      };

      this.connections.set(symbol, ws);
    } catch (error) {
      console.error(`[WebSocket] Failed to create connection for ${symbol}:`, error);
      this._reconnect(symbol);
    }
  }

  /**
   * Reconnect with exponential backoff
   * Delays: 1s, 2s, 4s, 8s, 16s
   * @param {string} symbol - Trading pair
   * @private
   */
  _reconnect(symbol) {
    const attempts = this.reconnectAttempts.get(symbol) || 0;

    if (attempts >= this.maxReconnectAttempts) {
      console.error(`[WebSocket] Max reconnection attempts reached for ${symbol}`);
      return;
    }

    // Clear any existing reconnect timer
    if (this.reconnectTimers.has(symbol)) {
      clearTimeout(this.reconnectTimers.get(symbol));
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, attempts), 16000);

    console.log(`[WebSocket] Reconnecting ${symbol} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);

    const timer = setTimeout(() => {
      this.reconnectAttempts.set(symbol, attempts + 1);
      this._connect(symbol);
      this.reconnectTimers.delete(symbol);
    }, delay);

    this.reconnectTimers.set(symbol, timer);
  }

  /**
   * Unsubscribe from symbol updates
   * @param {string} symbol - Trading pair
   * @param {function} callback - Callback to remove
   */
  unsubscribe(symbol, callback) {
    const callbacks = this.subscribers.get(symbol);
    if (callbacks) {
      callbacks.delete(callback);

      // If no more subscribers, close the WebSocket
      if (callbacks.size === 0) {
        this.subscribers.delete(symbol);
        this._closeConnection(symbol);
      }
    }
  }

  /**
   * Close WebSocket connection for a symbol
   * @param {string} symbol - Trading pair
   * @private
   */
  _closeConnection(symbol) {
    const ws = this.connections.get(symbol);
    if (ws) {
      console.log(`[WebSocket] Closing connection for ${symbol} (no subscribers)`);
      ws.close();
      this.connections.delete(symbol);
    }

    // Clear reconnect timer if exists
    if (this.reconnectTimers.has(symbol)) {
      clearTimeout(this.reconnectTimers.get(symbol));
      this.reconnectTimers.delete(symbol);
    }

    // Reset reconnect attempts
    this.reconnectAttempts.delete(symbol);
  }

  /**
   * Cleanup all connections
   * Call this on app unmount or when destroying the manager
   */
  destroy() {
    console.log('[WebSocket] Destroying all connections');

    // Close all WebSocket connections
    this.connections.forEach((ws, symbol) => {
      ws.close();
    });

    // Clear all timers
    this.reconnectTimers.forEach((timer) => {
      clearTimeout(timer);
    });

    // Clear all maps
    this.connections.clear();
    this.subscribers.clear();
    this.reconnectAttempts.clear();
    this.reconnectTimers.clear();
  }

  /**
   * Get connection status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      activeConnections: this.connections.size,
      trackedSymbols: Array.from(this.subscribers.keys()),
      totalSubscribers: Array.from(this.subscribers.values())
        .reduce((sum, set) => sum + set.size, 0)
    };
  }
}

// Export singleton instance
export const wsManager = new BinanceWebSocketManager();
export default wsManager;
