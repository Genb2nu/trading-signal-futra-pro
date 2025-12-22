/**
 * Signal Tracking Service
 * Core logic for tracking trading signals, managing localStorage persistence,
 * and detecting status transitions (TP/SL hit, pattern invalidation, missed entries)
 *
 * Features:
 * - localStorage persistence with debounced writes
 * - Automatic status detection (TP_HIT, SL_HIT, INVALIDATED, MISSED)
 * - Performance statistics calculation (win rate, avg P&L)
 * - Pattern invalidation detection (order block broken)
 * - Entry zone validation (missed opportunities)
 */

const STORAGE_KEY = 'trackedSignals';
const DEBOUNCE_DELAY = 1000; // Save to localStorage every 1 second max
const MAX_PRICE_HISTORY = 100; // Keep last 100 price points per signal
const CLEANUP_DAYS = 7; // Remove completed signals older than 7 days
const MISSED_THRESHOLD = 0.02; // 2% price movement away from entry = missed

class SignalTrackingService {
  constructor() {
    this.signals = [];
    this.statistics = this._defaultStats();
    this.saveTimer = null;
    this.load();
  }

  /**
   * Load tracked signals from localStorage
   */
  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.signals = parsed.signals || [];
        this.statistics = parsed.statistics || this._defaultStats();

        console.log(`[TrackingService] Loaded ${this.signals.length} signals from localStorage`);
      }
    } catch (error) {
      console.error('[TrackingService] Error loading from localStorage:', error);
      this.signals = [];
      this.statistics = this._defaultStats();
    }
  }

  /**
   * Save to localStorage (debounced to avoid excessive writes)
   */
  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        const data = {
          version: "1.0",
          signals: this.signals,
          statistics: this.statistics,
          lastUpdate: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.error('[TrackingService] Error saving to localStorage:', error);

        // Handle quota exceeded error
        if (error.name === 'QuotaExceededError') {
          console.warn('[TrackingService] localStorage quota exceeded, cleaning up old signals');
          this.cleanup();
          // Try saving again
          this.save();
        }
      }
    }, DEBOUNCE_DELAY);
  }

  /**
   * Track a new signal
   * @param {Object} signal - Signal from SignalTracker
   * @returns {string} Unique signal ID
   */
  trackSignal(signal) {
    if (!signal || !signal.symbol || !signal.entry || !signal.stopLoss || !signal.takeProfit) {
      throw new Error('Invalid signal: missing required fields');
    }

    const id = `${signal.symbol}_${Date.now()}`;

    const trackedSignal = {
      ...signal, // Preserve all original signal fields
      id,
      trackedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      currentPrice: parseFloat(signal.entry),
      priceAtEntry: parseFloat(signal.entry),
      exitPrice: null,
      exitTime: null,
      profitLoss: null,
      failureReason: null,
      lastUpdate: new Date().toISOString(),
      priceHistory: [{
        price: parseFloat(signal.entry),
        timestamp: new Date().toISOString()
      }]
    };

    this.signals.unshift(trackedSignal); // Add to beginning of array
    this.statistics.totalTracked++;
    this.save();

    console.log(`[TrackingService] Tracking signal ${id} - ${signal.type} ${signal.symbol} @ ${signal.entry}`);

    return id;
  }

  /**
   * Update signal with new price from WebSocket
   * @param {string} id - Signal ID
   * @param {number} currentPrice - Current price from WebSocket
   */
  updateSignalPrice(id, currentPrice) {
    const signal = this.signals.find(s => s.id === id);
    if (!signal) {
      console.warn(`[TrackingService] Signal ${id} not found`);
      return;
    }

    // Skip if signal is no longer active
    if (signal.status !== 'IN_PROGRESS') {
      return;
    }

    // Update current price
    signal.currentPrice = currentPrice;
    signal.lastUpdate = new Date().toISOString();

    // Add to price history
    signal.priceHistory.push({
      price: currentPrice,
      timestamp: new Date().toISOString()
    });

    // Keep history reasonable (last 100 prices)
    if (signal.priceHistory.length > MAX_PRICE_HISTORY) {
      signal.priceHistory = signal.priceHistory.slice(-MAX_PRICE_HISTORY);
    }

    // Check status transitions
    this._checkStatusTransition(signal, currentPrice);

    this.save();
  }

  /**
   * Status transition logic - CRITICAL FUNCTION
   * Determines if signal should transition to TP_HIT, SL_HIT, INVALIDATED, or MISSED
   * @param {Object} signal - Signal object
   * @param {number} currentPrice - Current price
   * @private
   */
  _checkStatusTransition(signal, currentPrice) {
    const isBuy = signal.type === 'BUY';
    const entry = parseFloat(signal.entry);
    const stopLoss = parseFloat(signal.stopLoss);
    const takeProfit = parseFloat(signal.takeProfit);

    // 1. CHECK TP HIT
    if (isBuy && currentPrice >= takeProfit) {
      this._markAsComplete(signal, 'TP_HIT', currentPrice);
      return;
    }
    if (!isBuy && currentPrice <= takeProfit) {
      this._markAsComplete(signal, 'TP_HIT', currentPrice);
      return;
    }

    // 2. CHECK SL HIT
    if (isBuy && currentPrice <= stopLoss) {
      this._markAsComplete(signal, 'SL_HIT', currentPrice);
      return;
    }
    if (!isBuy && currentPrice >= stopLoss) {
      this._markAsComplete(signal, 'SL_HIT', currentPrice);
      return;
    }

    // 3. CHECK PATTERN INVALIDATION (Order Block broken)
    if (this._isPatternInvalidated(signal, currentPrice)) {
      this._markAsInvalidated(signal, currentPrice);
      return;
    }

    // 4. CHECK MISSED ENTRY (Price moved away from entry zone)
    if (this._isEntryMissed(signal, currentPrice)) {
      this._markAsMissed(signal, currentPrice);
      return;
    }
  }

  /**
   * Pattern invalidation detection
   * Checks if order block has been broken (price moved through OB in wrong direction)
   * @param {Object} signal - Signal object
   * @param {number} currentPrice - Current price
   * @returns {boolean} True if pattern is invalidated
   * @private
   */
  _isPatternInvalidated(signal, currentPrice) {
    // Requires orderBlockDetails to detect invalidation
    if (!signal.orderBlockDetails || !signal.orderBlockDetails.bottom || !signal.orderBlockDetails.top) {
      return false;
    }

    const isBuy = signal.type === 'BUY';
    const ob = signal.orderBlockDetails;
    const obBottom = parseFloat(ob.bottom);
    const obTop = parseFloat(ob.top);

    // For BUY signals: invalidated if price breaks BELOW the order block bottom
    // (Support level broken)
    if (isBuy && currentPrice < obBottom) {
      signal.failureReason = `Order Block broken - price dropped below OB bottom (${obBottom.toFixed(8)})`;
      return true;
    }

    // For SELL signals: invalidated if price breaks ABOVE the order block top
    // (Resistance level broken)
    if (!isBuy && currentPrice > obTop) {
      signal.failureReason = `Order Block broken - price rallied above OB top (${obTop.toFixed(8)})`;
      return true;
    }

    return false;
  }

  /**
   * Missed entry detection
   * Checks if price moved too far away from entry zone without filling
   * @param {Object} signal - Signal object
   * @param {number} currentPrice - Current price
   * @returns {boolean} True if entry was missed
   * @private
   */
  _isEntryMissed(signal, currentPrice) {
    const isBuy = signal.type === 'BUY';
    const entry = parseFloat(signal.entry);

    // For BUY signals: missed if price moved UP more than threshold without hitting entry
    if (isBuy) {
      const priceIncrease = (currentPrice - entry) / entry;
      if (priceIncrease > MISSED_THRESHOLD) {
        const percentMoved = (priceIncrease * 100).toFixed(2);
        signal.failureReason = `Price moved ${percentMoved}% above entry without fill. Opportunity missed.`;
        return true;
      }
    }

    // For SELL signals: missed if price moved DOWN more than threshold without hitting entry
    if (!isBuy) {
      const priceDecrease = (entry - currentPrice) / entry;
      if (priceDecrease > MISSED_THRESHOLD) {
        const percentMoved = (priceDecrease * 100).toFixed(2);
        signal.failureReason = `Price moved ${percentMoved}% below entry without fill. Opportunity missed.`;
        return true;
      }
    }

    return false;
  }

  /**
   * Mark signal as complete (TP or SL hit)
   * @param {Object} signal - Signal object
   * @param {string} status - 'TP_HIT' or 'SL_HIT'
   * @param {number} exitPrice - Price at exit
   * @private
   */
  _markAsComplete(signal, status, exitPrice) {
    signal.status = status;
    signal.exitPrice = exitPrice;
    signal.exitTime = new Date().toISOString();

    // Calculate realized P&L
    const entry = parseFloat(signal.entry);
    const isWin = status === 'TP_HIT';

    if (signal.type === 'BUY') {
      signal.profitLoss = ((exitPrice - entry) / entry) * 100;
    } else {
      signal.profitLoss = ((entry - exitPrice) / entry) * 100;
    }

    // Update statistics
    if (isWin) {
      this.statistics.wins++;
    } else {
      this.statistics.losses++;
    }
    this._updateStatistics();

    console.log(`[TrackingService] Signal ${signal.id} ${status} at ${exitPrice} (P&L: ${signal.profitLoss.toFixed(2)}%)`);
  }

  /**
   * Mark signal as invalidated (pattern broken)
   * @param {Object} signal - Signal object
   * @param {number} currentPrice - Current price
   * @private
   */
  _markAsInvalidated(signal, currentPrice) {
    signal.status = 'INVALIDATED';
    signal.exitPrice = currentPrice;
    signal.exitTime = new Date().toISOString();
    this.statistics.invalidated++;
    this._updateStatistics();

    console.log(`[TrackingService] Signal ${signal.id} INVALIDATED: ${signal.failureReason}`);
  }

  /**
   * Mark signal as missed (entry not filled)
   * @param {Object} signal - Signal object
   * @param {number} currentPrice - Current price
   * @private
   */
  _markAsMissed(signal, currentPrice) {
    signal.status = 'MISSED';
    signal.exitPrice = currentPrice;
    signal.exitTime = new Date().toISOString();
    this.statistics.missed++;
    this._updateStatistics();

    console.log(`[TrackingService] Signal ${signal.id} MISSED: ${signal.failureReason}`);
  }

  /**
   * Update statistics (win rate, avg P&L)
   * @private
   */
  _updateStatistics() {
    const completed = this.statistics.wins + this.statistics.losses;
    this.statistics.winRate = completed > 0
      ? (this.statistics.wins / completed) * 100
      : 0;

    // Calculate avg P&L for completed trades only (TP_HIT or SL_HIT)
    const completedSignals = this.signals.filter(s =>
      (s.status === 'TP_HIT' || s.status === 'SL_HIT') && s.profitLoss !== null
    );

    if (completedSignals.length > 0) {
      const totalPL = completedSignals.reduce((sum, s) => sum + s.profitLoss, 0);
      this.statistics.avgProfitLoss = totalPL / completedSignals.length;
    } else {
      this.statistics.avgProfitLoss = 0;
    }
  }

  /**
   * Remove a tracked signal
   * @param {string} id - Signal ID
   */
  untrackSignal(id) {
    const signal = this.signals.find(s => s.id === id);
    if (signal) {
      // Note: Don't decrement statistics, they represent historical data
      this.signals = this.signals.filter(s => s.id !== id);
      this.save();
      console.log(`[TrackingService] Untracked signal ${id}`);
    }
  }

  /**
   * Get all tracked signals
   * @returns {Array} Array of all tracked signals
   */
  getAllSignals() {
    return this.signals;
  }

  /**
   * Get active (IN_PROGRESS) signals
   * @returns {Array} Array of active signals
   */
  getActiveSignals() {
    return this.signals.filter(s => s.status === 'IN_PROGRESS');
  }

  /**
   * Get signals by status
   * @param {string} status - Status to filter by
   * @returns {Array} Array of signals with given status
   */
  getSignalsByStatus(status) {
    return this.signals.filter(s => s.status === status);
  }

  /**
   * Clear old completed signals (older than CLEANUP_DAYS)
   * Keeps IN_PROGRESS signals regardless of age
   */
  cleanup() {
    const cutoffDate = Date.now() - (CLEANUP_DAYS * 24 * 60 * 60 * 1000);

    const initialCount = this.signals.length;
    this.signals = this.signals.filter(s => {
      // Keep all IN_PROGRESS signals
      if (s.status === 'IN_PROGRESS') {
        return true;
      }

      // Keep completed signals if they're recent
      if (s.exitTime) {
        const exitDate = new Date(s.exitTime).getTime();
        return exitDate > cutoffDate;
      }

      // Keep if no exit time (shouldn't happen, but be safe)
      return true;
    });

    const removed = initialCount - this.signals.length;
    if (removed > 0) {
      console.log(`[TrackingService] Cleaned up ${removed} old signals`);
      this.save();
    }

    return removed;
  }

  /**
   * Clear all tracked signals (for testing/reset)
   */
  clearAll() {
    this.signals = [];
    this.statistics = this._defaultStats();
    this.save();
    console.log('[TrackingService] Cleared all tracked signals');
  }

  /**
   * Default statistics object
   * @returns {Object} Default stats
   * @private
   */
  _defaultStats() {
    return {
      totalTracked: 0,
      wins: 0,
      losses: 0,
      invalidated: 0,
      missed: 0,
      winRate: 0,
      avgProfitLoss: 0
    };
  }

  /**
   * Get current statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    return { ...this.statistics };
  }
}

// Export singleton instance
export const trackingService = new SignalTrackingService();
export default trackingService;
