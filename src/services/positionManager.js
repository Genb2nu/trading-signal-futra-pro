/**
 * Position Manager for Paper Trading
 * Manages position lifecycle, storage, and queries
 */

class PositionManager {
  constructor() {
    this.positions = [];
    this.storageKey = 'paperTradingPositions';
    this.load();
  }

  /**
   * Load positions from localStorage
   */
  load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.positions = JSON.parse(data);
        console.log(`[PositionManager] Loaded ${this.positions.length} positions`);
      }
    } catch (error) {
      console.error('[PositionManager] Error loading positions:', error);
      this.positions = [];
    }
  }

  /**
   * Save positions to localStorage
   */
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.positions));
    } catch (error) {
      console.error('[PositionManager] Error saving positions:', error);

      // Handle quota exceeded - try to cleanup old positions
      if (error.name === 'QuotaExceededError') {
        console.warn('[PositionManager] localStorage quota exceeded, cleaning up...');
        this.cleanup();
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(this.positions));
        } catch (retryError) {
          console.error('[PositionManager] Failed to save even after cleanup:', retryError);
        }
      }
    }
  }

  /**
   * Add new position
   * @param {Object} position - Position object
   * @returns {string} Position ID
   */
  addPosition(position) {
    this.positions.push(position);
    this.save();
    console.log(`[PositionManager] Added position: ${position.id} (${position.direction} ${position.symbol})`);
    return position.id;
  }

  /**
   * Update existing position
   * @param {Object} position - Updated position object
   */
  updatePosition(position) {
    const index = this.positions.findIndex(p => p.id === position.id);
    if (index !== -1) {
      this.positions[index] = position;
      this.save();
    } else {
      console.warn(`[PositionManager] Position not found for update: ${position.id}`);
    }
  }

  /**
   * Close position (remove from active positions)
   * @param {string} positionId - Position ID to close
   */
  closePosition(positionId) {
    const index = this.positions.findIndex(p => p.id === positionId);
    if (index !== -1) {
      const position = this.positions[index];
      console.log(`[PositionManager] Closed position: ${position.id} (${position.direction} ${position.symbol})`);
      this.positions.splice(index, 1);
      this.save();
    } else {
      console.warn(`[PositionManager] Position not found for closing: ${positionId}`);
    }
  }

  /**
   * Get all active positions (PENDING + OPEN)
   * @returns {Array} Array of positions
   */
  getAllPositions() {
    return this.positions.filter(p => p.status !== 'CLOSED');
  }

  /**
   * Get open positions only
   * @returns {Array} Array of OPEN positions
   */
  getOpenPositions() {
    return this.positions.filter(p => p.status === 'OPEN');
  }

  /**
   * Get pending orders only
   * @returns {Array} Array of PENDING positions
   */
  getPendingOrders() {
    return this.positions.filter(p => p.status === 'PENDING');
  }

  /**
   * Check if position exists for symbol
   * @param {string} symbol - Trading pair symbol
   * @returns {boolean} True if position exists
   */
  hasPosition(symbol) {
    return this.positions.some(p => p.symbol === symbol && p.status !== 'CLOSED');
  }

  /**
   * Get position by ID
   * @param {string} positionId - Position ID
   * @returns {Object|null} Position object or null
   */
  getPosition(positionId) {
    return this.positions.find(p => p.id === positionId) || null;
  }

  /**
   * Calculate total floating P&L from all open positions
   * @returns {number} Total floating P&L in USDT
   */
  getFloatingPnL() {
    return this.positions
      .filter(p => p.status === 'OPEN')
      .reduce((sum, p) => sum + (p.floatingPnL || 0), 0);
  }

  /**
   * Get total exposure (sum of all position values)
   * @returns {number} Total exposure in USDT
   */
  getTotalExposure() {
    return this.positions
      .filter(p => p.status === 'OPEN')
      .reduce((sum, p) => sum + (p.positionValue || 0), 0);
  }

  /**
   * Get count by status
   * @returns {Object} Count object { pending, open, total }
   */
  getStatusCounts() {
    return {
      pending: this.getPendingOrders().length,
      open: this.getOpenPositions().length,
      total: this.getAllPositions().length
    };
  }

  /**
   * Cleanup old closed positions (if any leaked into storage)
   */
  cleanup() {
    const before = this.positions.length;
    this.positions = this.positions.filter(p => p.status !== 'CLOSED');
    const after = this.positions.length;

    if (before !== after) {
      console.log(`[PositionManager] Cleaned up ${before - after} closed positions`);
      this.save();
    }
  }

  /**
   * Clear all positions (for testing/reset)
   */
  clearAll() {
    this.positions = [];
    this.save();
    console.log('[PositionManager] All positions cleared');
  }

  /**
   * Get positions by symbol
   * @param {string} symbol - Trading pair symbol
   * @returns {Array} Array of positions for symbol
   */
  getPositionsBySymbol(symbol) {
    return this.positions.filter(p => p.symbol === symbol && p.status !== 'CLOSED');
  }

  /**
   * Get summary statistics
   * @returns {Object} Summary object
   */
  getSummary() {
    const counts = this.getStatusCounts();
    const floatingPnL = this.getFloatingPnL();
    const exposure = this.getTotalExposure();

    return {
      totalPositions: counts.total,
      pendingOrders: counts.pending,
      openPositions: counts.open,
      floatingPnL: floatingPnL,
      totalExposure: exposure
    };
  }
}

export default PositionManager;
