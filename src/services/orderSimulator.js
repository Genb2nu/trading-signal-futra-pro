/**
 * Order Simulator for Paper Trading
 * Simulates realistic limit order fills and timeouts
 */

class OrderSimulator {
  constructor() {
    this.slippageEnabled = false; // Disabled for accuracy in paper trading
    this.maxSlippagePercent = 0.05; // 0.05% max slippage if enabled
    this.orderTimeoutMinutes = 30; // Cancel order after 30min if price moves away
  }

  /**
   * Check if limit order should fill based on current price
   * @param {Object} position - Position with entry price and direction
   * @param {number} currentPrice - Current market price
   * @returns {boolean} True if order should fill
   */
  checkLimitOrderFill(position, currentPrice) {
    if (!position || !currentPrice) return false;

    const isBuy = position.direction === 'BUY';
    const entryPrice = position.entryPrice;

    // BUY limit: fills when price drops to or below entry
    if (isBuy && currentPrice <= entryPrice) {
      return true;
    }

    // SELL limit: fills when price rises to or above entry
    if (!isBuy && currentPrice >= entryPrice) {
      return true;
    }

    return false;
  }

  /**
   * Apply realistic slippage to fill price (optional)
   * @param {number} entryPrice - Limit order price
   * @param {string} direction - 'BUY' or 'SELL'
   * @returns {number} Fill price with slippage
   */
  applySlippage(entryPrice, direction) {
    if (!this.slippageEnabled) return entryPrice;

    // Random slippage between 0 and maxSlippagePercent
    const slippage = Math.random() * this.maxSlippagePercent;

    // BUY: slippage makes price slightly higher (worse fill)
    // SELL: slippage makes price slightly lower (worse fill)
    const slippageFactor = direction === 'BUY'
      ? (1 + slippage / 100)
      : (1 - slippage / 100);

    return entryPrice * slippageFactor;
  }

  /**
   * Check if order should timeout/cancel
   * @param {Object} position - Position with order placed time
   * @param {number} currentPrice - Current market price
   * @returns {boolean} True if order should be cancelled
   */
  checkOrderTimeout(position, currentPrice) {
    if (!position || !currentPrice) return false;

    const orderAge = Date.now() - new Date(position.orderPlacedAt).getTime();
    const orderAgeMinutes = orderAge / (1000 * 60);

    // Don't timeout if order is recent
    if (orderAgeMinutes < this.orderTimeoutMinutes) {
      return false;
    }

    // Cancel if price moved >2% away from entry without filling
    const isBuy = position.direction === 'BUY';
    const entryPrice = position.entryPrice;

    // For BUY: cancel if price is >2% above entry (moved away)
    if (isBuy && currentPrice > entryPrice * 1.02) {
      return true;
    }

    // For SELL: cancel if price is >2% below entry (moved away)
    if (!isBuy && currentPrice < entryPrice * 0.98) {
      return true;
    }

    return false;
  }

  /**
   * Get timeout reason message
   * @param {Object} position - Position that timed out
   * @param {number} currentPrice - Current market price
   * @returns {string} Timeout reason
   */
  getTimeoutReason(position, currentPrice) {
    const isBuy = position.direction === 'BUY';
    const entryPrice = position.entryPrice;
    const priceChangePercent = ((currentPrice - entryPrice) / entryPrice) * 100;

    return `Order timeout: Price moved ${Math.abs(priceChangePercent).toFixed(2)}% away from entry (${isBuy ? 'above' : 'below'} ${entryPrice})`;
  }

  /**
   * Enable/disable slippage simulation
   * @param {boolean} enabled - Whether to enable slippage
   */
  setSlippageEnabled(enabled) {
    this.slippageEnabled = enabled;
  }

  /**
   * Set maximum slippage percentage
   * @param {number} percent - Max slippage as percentage (e.g., 0.05 for 0.05%)
   */
  setMaxSlippage(percent) {
    this.maxSlippagePercent = percent;
  }

  /**
   * Set order timeout duration in minutes
   * @param {number} minutes - Timeout in minutes
   */
  setOrderTimeout(minutes) {
    this.orderTimeoutMinutes = minutes;
  }
}

export default OrderSimulator;
