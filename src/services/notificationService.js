/**
 * Notification Service for Signal Alerts
 * Handles browser notifications and tracking of in-progress signals
 */

class NotificationService {
  constructor() {
    this.permission = 'default';
    this.trackedSignals = new Map(); // Store signals being tracked
    this.completedSignals = []; // Store completed signals for statistics
    this.checkInterval = null;
    this.loadCompletedSignals();
  }

  /**
   * Load completed signals from localStorage
   */
  loadCompletedSignals() {
    try {
      const stored = localStorage.getItem('completedSignals');
      if (stored) {
        this.completedSignals = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading completed signals:', error);
      this.completedSignals = [];
    }
  }

  /**
   * Save completed signals to localStorage
   */
  saveCompletedSignals() {
    try {
      localStorage.setItem('completedSignals', JSON.stringify(this.completedSignals));
    } catch (error) {
      console.error('Error saving completed signals:', error);
    }
  }

  /**
   * Initialize notification service
   */
  async init() {
    if ('Notification' in window) {
      this.permission = Notification.permission;

      if (this.permission === 'default') {
        // Will prompt on first signal track
        console.log('Notifications not yet permitted. Will request on first signal.');
      } else if (this.permission === 'granted') {
        console.log('Notifications already permitted');
      }
    } else {
      console.warn('Notifications not supported in this browser');
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    }
    return this.permission === 'granted';
  }

  /**
   * Show a notification
   */
  showNotification(title, options = {}) {
    if (this.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    const defaultOptions = {
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      ...options
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Use service worker for notifications (works in background)
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, defaultOptions);
      });
    } else {
      // Fallback to regular notification
      new Notification(title, defaultOptions);
    }
  }

  /**
   * Track a signal for entry notification
   * Monitors price and notifies when it's close to entry
   */
  async trackSignal(signal) {
    // Request permission if not granted
    if (this.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) {
        console.warn('Cannot track signal - notification permission denied');
        return false;
      }
    }

    const signalId = `${signal.symbol}_${signal.timeframe}_${signal.entry}`;

    this.trackedSignals.set(signalId, {
      ...signal,
      trackedAt: Date.now(),
      notified: false
    });

    console.log(`📊 Now tracking ${signal.symbol} ${signal.direction} @ ${signal.entry}`);

    // Start checking prices if not already running
    if (!this.checkInterval) {
      this.startPriceChecking();
    }

    // Show confirmation notification
    this.showNotification('Signal Tracked', {
      body: `Tracking ${signal.symbol} ${signal.direction.toUpperCase()} @ ${signal.entry}\nWill notify when entry is near.`,
      tag: `track-${signalId}`
    });

    return true;
  }

  /**
   * Stop tracking a signal
   */
  stopTracking(signalId) {
    if (this.trackedSignals.has(signalId)) {
      const signal = this.trackedSignals.get(signalId);
      console.log(`🛑 Stopped tracking ${signal.symbol}`);
      this.trackedSignals.delete(signalId);

      // Stop checking if no more signals
      if (this.trackedSignals.size === 0 && this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    }
  }

  /**
   * Start checking prices for tracked signals
   */
  startPriceChecking() {
    // Check every 30 seconds
    this.checkInterval = setInterval(async () => {
      await this.checkAllSignals();
    }, 30000); // 30 seconds

    // Also check immediately
    this.checkAllSignals();
  }

  /**
   * Check all tracked signals against current prices
   */
  async checkAllSignals() {
    if (this.trackedSignals.size === 0) return;

    console.log(`🔍 Checking ${this.trackedSignals.size} tracked signals...`);

    for (const [signalId, signal] of this.trackedSignals.entries()) {
      try {
        // Fetch current price from Binance
        const currentPrice = await this.getCurrentPrice(signal.symbol);

        if (!currentPrice) continue;

        // Update current price in signal
        signal.currentPrice = currentPrice;

        // Calculate distance to entry
        const entryPrice = parseFloat(signal.entry);
        const stopLoss = parseFloat(signal.stopLoss);
        const takeProfit = parseFloat(signal.takeProfit);
        const distancePercent = Math.abs((currentPrice - entryPrice) / entryPrice) * 100;

        console.log(`${signal.symbol}: Current ${currentPrice}, Entry ${entryPrice}, Distance ${distancePercent.toFixed(2)}%`);

        // Check if TP or SL hit (assuming entry was reached)
        if (signal.notified) {
          // For bullish signals
          if (signal.direction === 'bullish') {
            if (currentPrice >= takeProfit) {
              this.completeSignal(signalId, signal, 'TP_HIT', currentPrice);
              continue;
            } else if (currentPrice <= stopLoss) {
              this.completeSignal(signalId, signal, 'SL_HIT', currentPrice);
              continue;
            }
          }
          // For bearish signals
          else if (signal.direction === 'bearish') {
            if (currentPrice <= takeProfit) {
              this.completeSignal(signalId, signal, 'TP_HIT', currentPrice);
              continue;
            } else if (currentPrice >= stopLoss) {
              this.completeSignal(signalId, signal, 'SL_HIT', currentPrice);
              continue;
            }
          }
        }

        // Notify if price is within 0.5% of entry (ready to enter)
        if (distancePercent <= 0.5 && !signal.notified) {
          this.notifyEntryReady(signal, currentPrice);
          signal.notified = true;
          signal.enteredAt = Date.now();
        }

        // Notify if price hit entry exactly
        if (signal.direction === 'bullish' && currentPrice <= entryPrice && !signal.notified) {
          this.notifyEntryReady(signal, currentPrice);
          signal.notified = true;
          signal.enteredAt = Date.now();
        } else if (signal.direction === 'bearish' && currentPrice >= entryPrice && !signal.notified) {
          this.notifyEntryReady(signal, currentPrice);
          signal.notified = true;
          signal.enteredAt = Date.now();
        }

        // Auto-remove if signal is too old (24 hours)
        const ageHours = (Date.now() - signal.trackedAt) / (1000 * 60 * 60);
        if (ageHours > 24) {
          console.log(`⏰ Signal expired: ${signal.symbol} (${ageHours.toFixed(1)}h old)`);
          this.completeSignal(signalId, signal, 'EXPIRED', currentPrice);
        }
      } catch (error) {
        console.error(`Error checking ${signal.symbol}:`, error.message);
      }
    }
  }

  /**
   * Complete a signal and move to completed list
   */
  completeSignal(signalId, signal, outcome, exitPrice) {
    // Calculate P&L
    const entryPrice = parseFloat(signal.entry);
    const stopLoss = parseFloat(signal.stopLoss);
    const takeProfit = parseFloat(signal.takeProfit);

    let profitLoss = 0;

    if (outcome === 'TP_HIT') {
      // Calculate profit based on direction
      if (signal.direction === 'bullish') {
        profitLoss = ((takeProfit - entryPrice) / entryPrice) * 100;
      } else {
        profitLoss = ((entryPrice - takeProfit) / entryPrice) * 100;
      }
    } else if (outcome === 'SL_HIT') {
      // Calculate loss based on direction
      if (signal.direction === 'bullish') {
        profitLoss = ((stopLoss - entryPrice) / entryPrice) * 100;
      } else {
        profitLoss = ((entryPrice - stopLoss) / entryPrice) * 100;
      }
    }

    // Create completed signal record
    const completedSignal = {
      ...signal,
      outcome,
      exitPrice,
      profitLoss: profitLoss.toFixed(2),
      completedAt: Date.now()
    };

    // Add to completed signals (keep last 100)
    this.completedSignals.unshift(completedSignal);
    if (this.completedSignals.length > 100) {
      this.completedSignals = this.completedSignals.slice(0, 100);
    }

    // Save to localStorage
    this.saveCompletedSignals();

    // Remove from tracked
    this.trackedSignals.delete(signalId);

    // Show notification for outcome
    if (outcome === 'TP_HIT') {
      this.showNotification(`🎉 TP HIT: ${signal.symbol}`, {
        body: `${signal.direction.toUpperCase()} signal hit take profit!\nProfit: +${profitLoss.toFixed(2)}%`,
        tag: `tp-${signalId}`
      });
    } else if (outcome === 'SL_HIT') {
      this.showNotification(`⚠️ SL HIT: ${signal.symbol}`, {
        body: `${signal.direction.toUpperCase()} signal hit stop loss\nLoss: ${profitLoss.toFixed(2)}%`,
        tag: `sl-${signalId}`
      });
    }

    console.log(`✅ Signal completed: ${signal.symbol} - ${outcome} (P&L: ${profitLoss.toFixed(2)}%)`);

    // Stop checking if no more signals
    if (this.trackedSignals.size === 0 && this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Fetch current price from Binance
   */
  async getCurrentPrice(symbol) {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      const data = await response.json();
      return parseFloat(data.price);
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Notify that entry is ready
   */
  notifyEntryReady(signal, currentPrice) {
    const title = `🎯 ENTRY READY: ${signal.symbol}`;
    const body = `${signal.direction.toUpperCase()} Signal\n` +
                 `Entry: ${signal.entry}\n` +
                 `Current: ${currentPrice.toFixed(8)}\n` +
                 `Stop: ${signal.stopLoss}\n` +
                 `Target: ${signal.takeProfit}\n` +
                 `R:R: ${signal.riskReward}`;

    this.showNotification(title, {
      body,
      tag: `entry-${signal.symbol}`,
      requireInteraction: true,
      actions: [
        { action: 'view', title: 'View Chart' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });

    // Also play sound if possible
    this.playNotificationSound();

    console.log(`🔔 ENTRY NOTIFICATION SENT: ${signal.symbol} @ ${currentPrice}`);
  }

  /**
   * Notify about new signals discovered during scan
   * NEW FEATURE: Alert user immediately when signals are found
   */
  async notifyNewSignalsFound(newSignals) {
    // Request permission if not granted
    if (this.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) {
        console.warn('Cannot notify - notification permission denied');
        return;
      }
    }

    if (newSignals.length === 0) return;

    // Play sound first for immediate attention
    this.playNotificationSound();

    // Show notification for each new signal (max 3 to avoid spam)
    const signalsToNotify = newSignals.slice(0, 3);

    for (const signal of signalsToNotify) {
      const title = `🚨 NEW SIGNAL: ${signal.symbol}`;
      const body = `${signal.direction?.toUpperCase() || 'LONG'} Signal Found!\n` +
                   `Timeframe: ${signal.timeframe}\n` +
                   `Entry: ${signal.entry}\n` +
                   `Confidence: ${signal.confidence?.toUpperCase() || 'STANDARD'}\n` +
                   `Confluence: ${signal.confluenceScore || 0}\n` +
                   `R:R: ${signal.riskReward || 'N/A'}`;

      this.showNotification(title, {
        body,
        tag: `new-signal-${signal.symbol}-${Date.now()}`,
        requireInteraction: true,
        data: { signal }
      });
    }

    // If more than 3 signals, show summary notification
    if (newSignals.length > 3) {
      const title = `🎯 ${newSignals.length} NEW SIGNALS FOUND!`;
      const symbolsList = newSignals.map(s => s.symbol).join(', ');
      const body = `Check the Signal Tracker for all signals:\n${symbolsList}`;

      this.showNotification(title, {
        body,
        tag: `new-signals-summary-${Date.now()}`,
        requireInteraction: true
      });
    }

    console.log(`🔔 NEW SIGNAL NOTIFICATIONS SENT: ${newSignals.length} signals`);
  }

  /**
   * Play notification sound
   */
  playNotificationSound() {
    try {
      // Create a simple beep sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      // Audio not supported or permission denied
      console.log('Could not play notification sound');
    }
  }

  /**
   * Get all tracked signals (active only)
   */
  getTrackedSignals() {
    return Array.from(this.trackedSignals.values());
  }

  /**
   * Get all signals (active + completed)
   */
  getAllSignals() {
    const active = Array.from(this.trackedSignals.values()).map(signal => ({
      ...signal,
      status: 'IN_PROGRESS'
    }));
    const completed = this.completedSignals.map(signal => ({
      ...signal,
      status: signal.outcome
    }));
    return [...active, ...completed];
  }

  /**
   * Get completed signals only
   */
  getCompletedSignals() {
    return this.completedSignals;
  }

  /**
   * Get statistics for all tracked signals
   */
  getStatistics() {
    const completed = this.completedSignals.filter(s => s.outcome === 'TP_HIT' || s.outcome === 'SL_HIT');

    if (completed.length === 0) {
      return {
        totalTracked: this.trackedSignals.size + this.completedSignals.length,
        activeSignals: this.trackedSignals.size,
        completedSignals: this.completedSignals.length,
        wins: 0,
        losses: 0,
        expired: this.completedSignals.filter(s => s.outcome === 'EXPIRED').length,
        winRate: 0,
        avgProfitLoss: 0,
        totalProfitLoss: 0,
        bestTrade: 0,
        worstTrade: 0
      };
    }

    const wins = completed.filter(s => s.outcome === 'TP_HIT').length;
    const losses = completed.filter(s => s.outcome === 'SL_HIT').length;
    const winRate = (wins / completed.length) * 100;

    const totalPL = completed.reduce((sum, s) => sum + parseFloat(s.profitLoss), 0);
    const avgPL = totalPL / completed.length;

    const plValues = completed.map(s => parseFloat(s.profitLoss));
    const bestTrade = Math.max(...plValues);
    const worstTrade = Math.min(...plValues);

    return {
      totalTracked: this.trackedSignals.size + this.completedSignals.length,
      activeSignals: this.trackedSignals.size,
      completedSignals: this.completedSignals.length,
      wins,
      losses,
      expired: this.completedSignals.filter(s => s.outcome === 'EXPIRED').length,
      winRate,
      avgProfitLoss: avgPL,
      totalProfitLoss: totalPL,
      bestTrade,
      worstTrade
    };
  }

  /**
   * Clear all completed signals
   */
  clearCompleted() {
    this.completedSignals = [];
    this.saveCompletedSignals();
  }

  /**
   * Check if a signal is being tracked
   */
  isTracking(signalId) {
    return this.trackedSignals.has(signalId);
  }
}

// Export singleton instance
const notificationService = new NotificationService();
export default notificationService;
