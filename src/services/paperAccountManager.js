/**
 * Paper Account Manager
 * Tracks virtual account balance and equity for paper trading
 */

class PaperAccountManager {
  constructor() {
    this.account = null;
    this.storageKey = 'paperTradingAccount';
    this.load();
  }

  /**
   * Load account from localStorage
   */
  load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.account = JSON.parse(data);
        console.log(`[AccountManager] Loaded account: ${this.account.balance} USDT`);
      } else {
        this.account = this._createDefaultAccount();
        this.save();
        console.log('[AccountManager] Created new account with 10,000 USDT');
      }
    } catch (error) {
      console.error('[AccountManager] Error loading account:', error);
      this.account = this._createDefaultAccount();
    }
  }

  /**
   * Save account to localStorage
   */
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.account));
    } catch (error) {
      console.error('[AccountManager] Error saving account:', error);
    }
  }

  /**
   * Create default account
   * @param {number} initialBalance - Starting balance (default: 100)
   * @returns {Object} Default account object
   */
  _createDefaultAccount(initialBalance = 100) {
    return {
      balance: initialBalance,
      initialBalance: initialBalance,
      equity: initialBalance,
      peakBalance: initialBalance,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      totalPnL: 0,
      totalPnLPercent: 0,

      // Risk settings (loaded from config)
      riskPerTrade: 2,
      maxConcurrentTrades: 3,

      createdAt: new Date().toISOString(),
      lastReset: new Date().toISOString(),
      lastTrade: null
    };
  }

  /**
   * Get account object (copy to prevent mutations)
   * @returns {Object} Account object
   */
  getAccount() {
    return { ...this.account };
  }

  /**
   * Get risk management configuration
   * Loads from localStorage settings if available
   * @returns {Object} Config object
   */
  getConfig() {
    try {
      const settings = localStorage.getItem('smcSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        return {
          riskPerTrade: parsed.riskPerTrade || 2,
          maxConcurrentTrades: parsed.maxConcurrentTrades || 3,
          stopLossATRMultiplier: parsed.stopLossATRMultiplier || 2.5
        };
      }
    } catch (error) {
      console.error('[AccountManager] Error loading config:', error);
    }

    // Default fallback
    return {
      riskPerTrade: 2,
      maxConcurrentTrades: 3,
      stopLossATRMultiplier: 2.5
    };
  }

  /**
   * Record completed trade and update balance
   * @param {number} pnl - Profit/loss in USDT
   */
  recordTrade(pnl) {
    this.account.balance += pnl;
    this.account.totalPnL += pnl;
    this.account.totalPnLPercent = ((this.account.balance - this.account.initialBalance) / this.account.initialBalance) * 100;
    this.account.lastTrade = new Date().toISOString();

    // Update peak balance
    if (this.account.balance > this.account.peakBalance) {
      this.account.peakBalance = this.account.balance;
    }

    // Update max drawdown
    const drawdown = this.account.peakBalance - this.account.balance;
    const drawdownPercent = (drawdown / this.account.peakBalance) * 100;

    if (drawdown > this.account.maxDrawdown) {
      this.account.maxDrawdown = drawdown;
      this.account.maxDrawdownPercent = drawdownPercent;
    }

    this.save();

    console.log(`[AccountManager] Trade recorded: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT | Balance: ${this.account.balance.toFixed(2)} USDT`);
  }

  /**
   * Update equity (balance + floating P&L)
   * Does not save to avoid excessive writes
   * @param {number} floatingPnL - Current unrealized P&L
   */
  updateEquity(floatingPnL) {
    this.account.equity = this.account.balance + floatingPnL;
  }

  /**
   * Reset account to initial balance
   * @param {number} initialBalance - New starting balance (default: 100)
   */
  resetAccount(initialBalance = 100) {
    this.account = this._createDefaultAccount(initialBalance);
    this.save();
    console.log(`[AccountManager] Account reset to ${initialBalance} USDT`);
  }

  /**
   * Get available balance (for position sizing)
   * @returns {number} Available balance in USDT
   */
  getAvailableBalance() {
    return this.account.balance;
  }

  /**
   * Check if can open new position
   * @param {number} positionValue - Position value in USDT
   * @param {number} currentOpenPositions - Number of currently open positions
   * @returns {Object} { canOpen: boolean, reason: string }
   */
  canOpenPosition(positionValue, currentOpenPositions) {
    const config = this.getConfig();

    // Check max concurrent trades
    if (currentOpenPositions >= config.maxConcurrentTrades) {
      return {
        canOpen: false,
        reason: `Max concurrent trades reached (${config.maxConcurrentTrades})`
      };
    }

    // Check if position value exceeds 50% of balance
    if (positionValue > this.account.balance * 0.5) {
      return {
        canOpen: false,
        reason: `Position value (${positionValue.toFixed(2)}) exceeds 50% of balance (${(this.account.balance * 0.5).toFixed(2)})`
      };
    }

    // Check if have any balance left
    if (this.account.balance <= 0) {
      return {
        canOpen: false,
        reason: 'Insufficient balance'
      };
    }

    return { canOpen: true, reason: '' };
  }

  /**
   * Get account summary for display
   * @returns {Object} Summary object
   */
  getSummary() {
    return {
      balance: this.account.balance,
      equity: this.account.equity,
      totalPnL: this.account.totalPnL,
      totalPnLPercent: this.account.totalPnLPercent,
      maxDrawdown: this.account.maxDrawdown,
      maxDrawdownPercent: this.account.maxDrawdownPercent,
      peakBalance: this.account.peakBalance,
      riskPerTrade: this.getConfig().riskPerTrade,
      maxConcurrentTrades: this.getConfig().maxConcurrentTrades
    };
  }
}

export default PaperAccountManager;
