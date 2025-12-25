/**
 * Trade Logger for Paper Trading
 * Persists completed trades and calculates performance statistics
 */

class TradeLogger {
  constructor() {
    this.trades = [];
    this.maxTrades = 500; // Keep last 500 trades
    this.storageKey = 'paperTradingHistory';
    this.load();
  }

  /**
   * Load trades from localStorage
   */
  load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.trades = JSON.parse(data);
        console.log(`[TradeLogger] Loaded ${this.trades.length} trades`);
      }
    } catch (error) {
      console.error('[TradeLogger] Error loading trades:', error);
      this.trades = [];
    }
  }

  /**
   * Save trades to localStorage
   */
  save() {
    try {
      // Keep only last maxTrades
      if (this.trades.length > this.maxTrades) {
        this.trades = this.trades.slice(-this.maxTrades);
      }
      localStorage.setItem(this.storageKey, JSON.stringify(this.trades));
    } catch (error) {
      console.error('[TradeLogger] Error saving trades:', error);

      // Handle quota exceeded
      if (error.name === 'QuotaExceededError') {
        console.warn('[TradeLogger] localStorage quota exceeded, keeping only last 250 trades');
        this.trades = this.trades.slice(-250);
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(this.trades));
        } catch (retryError) {
          console.error('[TradeLogger] Failed to save even after cleanup:', retryError);
        }
      }
    }
  }

  /**
   * Log a completed trade
   * @param {Object} position - Completed position object
   */
  logTrade(position) {
    const trade = {
      id: position.id,
      symbol: position.symbol,
      direction: position.direction,
      timeframe: position.timeframe || '1h',

      // Entry details
      entryPrice: position.entryPrice,
      entryTime: position.entryTime,
      positionSize: position.positionSize,
      positionValue: position.positionValue,

      // Exit details
      exitPrice: position.exitPrice,
      exitTime: position.exitTime,
      exitReason: position.exitReason,

      // Performance
      realizedPnL: position.realizedPnL,
      realizedPnLPercent: position.realizedPnLPercent,
      rMultiple: position.rMultiple,

      // Risk metrics
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      riskRewardRatio: position.signal?.riskReward || 0,
      riskAmount: position.riskAmount,

      mae: position.maxAdverseExcursion || 0,
      mfe: position.maxFavorableExcursion || 0,

      // Signal quality
      patterns: position.patterns || [],
      confluence: position.confluence || 0,
      confidence: position.signal?.confidence || 'standard',

      // Duration
      duration: this.calculateDuration(position.entryTime, position.exitTime),
      barsInTrade: position.barsInTrade || 0,

      // Metadata
      timestamp: new Date().toISOString(),
      tradeNumber: this.trades.length + 1
    };

    this.trades.push(trade);
    this.save();

    console.log(`[TradeLogger] Trade #${trade.tradeNumber} logged: ${trade.symbol} ${trade.direction} ${trade.realizedPnL >= 0 ? '+' : ''}${trade.realizedPnL.toFixed(2)} USDT (${trade.exitReason})`);

    return trade;
  }

  /**
   * Calculate trade duration in minutes
   * @param {string} entryTime - Entry timestamp
   * @param {string} exitTime - Exit timestamp
   * @returns {number} Duration in minutes
   */
  calculateDuration(entryTime, exitTime) {
    if (!entryTime || !exitTime) return 0;

    const entry = new Date(entryTime).getTime();
    const exit = new Date(exitTime).getTime();
    return Math.round((exit - entry) / (1000 * 60));
  }

  /**
   * Get trade history
   * @param {number} limit - Maximum number of trades to return
   * @returns {Array} Array of trades (most recent first)
   */
  getTradeHistory(limit = 50) {
    return this.trades.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Calculate comprehensive performance statistics
   * @returns {Object} Statistics object
   */
  calculateStats() {
    if (this.trades.length === 0) {
      return this._emptyStats();
    }

    const wins = this.trades.filter(t => t.realizedPnL > 0);
    const losses = this.trades.filter(t => t.realizedPnL < 0);

    const totalWinAmount = wins.reduce((sum, t) => sum + t.realizedPnL, 0);
    const totalLossAmount = Math.abs(losses.reduce((sum, t) => sum + t.realizedPnL, 0));

    const avgWin = wins.length > 0 ? totalWinAmount / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLossAmount / losses.length : 0;

    const winRate = (wins.length / this.trades.length) * 100;
    const totalPnL = this.trades.reduce((sum, t) => sum + t.realizedPnL, 0);
    const avgPnL = totalPnL / this.trades.length;

    const profitFactor = totalLossAmount !== 0
      ? totalWinAmount / totalLossAmount
      : (totalWinAmount > 0 ? Infinity : 0);

    // Expectancy = (Win% × AvgWin) - (Loss% × AvgLoss)
    const expectancy = (winRate / 100 * avgWin) - ((100 - winRate) / 100 * avgLoss);

    // Best and worst trades
    const bestTrade = Math.max(...this.trades.map(t => t.realizedPnL));
    const worstTrade = Math.min(...this.trades.map(t => t.realizedPnL));

    // Average duration
    const avgDuration = this.trades.reduce((sum, t) => sum + (t.duration || 0), 0) / this.trades.length;

    // Average R-multiple
    const avgR = this.trades.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / this.trades.length;
    const avgWinR = wins.length > 0
      ? wins.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / wins.length
      : 0;
    const avgLossR = losses.length > 0
      ? losses.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / losses.length
      : 0;

    // Outcome breakdown
    const outcomes = {
      takeProfit: this.trades.filter(t => t.exitReason === 'TP_HIT').length,
      stopLoss: this.trades.filter(t => t.exitReason === 'SL_HIT').length,
      invalidated: this.trades.filter(t => t.exitReason === 'INVALIDATED').length,
      timeout: this.trades.filter(t => t.exitReason === 'TIMEOUT').length,
      manual: this.trades.filter(t => t.exitReason === 'MANUAL').length
    };

    // Win/loss streaks
    const streaks = this.calculateStreaks();

    // Average MAE and MFE
    const avgMAE = this.trades.reduce((sum, t) => sum + Math.abs(t.mae || 0), 0) / this.trades.length;
    const avgMFE = this.trades.reduce((sum, t) => sum + (t.mfe || 0), 0) / this.trades.length;

    return {
      totalTrades: this.trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      avgWin,
      avgLoss,
      avgPnL,
      totalPnL,
      profitFactor,
      expectancy,
      bestTrade,
      worstTrade,
      avgDuration,
      avgR,
      avgWinR,
      avgLossR,
      avgMAE,
      avgMFE,
      outcomes,
      currentStreak: streaks.current,
      longestWinStreak: streaks.longestWin,
      longestLossStreak: streaks.longestLoss
    };
  }

  /**
   * Calculate win/loss streaks
   * @returns {Object} Streak object
   */
  calculateStreaks() {
    if (this.trades.length === 0) {
      return { current: 0, longestWin: 0, longestLoss: 0 };
    }

    let currentStreak = 0;
    let longestWin = 0;
    let longestLoss = 0;

    for (let i = 0; i < this.trades.length; i++) {
      const isWin = this.trades[i].realizedPnL > 0;

      if (i === 0) {
        currentStreak = isWin ? 1 : -1;
      } else {
        const prevWin = this.trades[i - 1].realizedPnL > 0;
        if (isWin === prevWin) {
          currentStreak = isWin ? currentStreak + 1 : currentStreak - 1;
        } else {
          currentStreak = isWin ? 1 : -1;
        }
      }

      if (currentStreak > 0) {
        longestWin = Math.max(longestWin, currentStreak);
      } else {
        longestLoss = Math.max(longestLoss, Math.abs(currentStreak));
      }
    }

    return {
      current: currentStreak,
      longestWin,
      longestLoss
    };
  }

  /**
   * Export trades to JSON file
   */
  exportToJSON() {
    const data = {
      trades: this.trades,
      statistics: this.calculateStats(),
      exportDate: new Date().toISOString(),
      totalTrades: this.trades.length
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `paper-trading-history-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[TradeLogger] Trade history exported');
  }

  /**
   * Clear all trades
   */
  clearAll() {
    this.trades = [];
    this.save();
    console.log('[TradeLogger] All trades cleared');
  }

  /**
   * Get trades by symbol
   * @param {string} symbol - Trading pair symbol
   * @returns {Array} Array of trades for symbol
   */
  getTradesBySymbol(symbol) {
    return this.trades.filter(t => t.symbol === symbol);
  }

  /**
   * Get trades by exit reason
   * @param {string} reason - Exit reason (TP_HIT, SL_HIT, etc.)
   * @returns {Array} Array of trades with that exit reason
   */
  getTradesByExitReason(reason) {
    return this.trades.filter(t => t.exitReason === reason);
  }

  /**
   * Return empty stats object
   * @returns {Object} Empty statistics
   */
  _emptyStats() {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      avgPnL: 0,
      totalPnL: 0,
      profitFactor: 0,
      expectancy: 0,
      bestTrade: 0,
      worstTrade: 0,
      avgDuration: 0,
      avgR: 0,
      avgWinR: 0,
      avgLossR: 0,
      avgMAE: 0,
      avgMFE: 0,
      outcomes: {
        takeProfit: 0,
        stopLoss: 0,
        invalidated: 0,
        timeout: 0,
        manual: 0
      },
      currentStreak: 0,
      longestWinStreak: 0,
      longestLossStreak: 0
    };
  }
}

export default TradeLogger;
