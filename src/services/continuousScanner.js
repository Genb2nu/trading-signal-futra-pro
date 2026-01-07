/**
 * Continuous Background Scanner
 * Automatically scans symbols, detects signals, and tracks ENTRY_READY signals
 *
 * Purpose: Collect validation data 24/7 for learning and optimization
 */

import axios from 'axios';
import { getLoggedSignals, updateSignalTracking, addSignalNote } from './validationLogger.js';
import { isAutoTracked, addAutoTracked } from './database.js';

class ContinuousScanner {
  constructor() {
    this.isRunning = false;
    this.scanInterval = null;
    this.config = {
      symbols: [],
      timeframes: ['15m', '1h', '4h'],
      scanFrequency: 5 * 60 * 1000, // 5 minutes default
      autoTrack: true // Automatically track ENTRY_READY signals
    };
    this.stats = {
      startTime: null,
      totalScans: 0,
      signalsDetected: 0,
      signalsTracked: 0,
      lastScanTime: null,
      lastScanResult: null
    };
  }

  /**
   * Configure the scanner
   */
  configure(config) {
    this.config = { ...this.config, ...config };
    console.log('[SCANNER] Configuration updated:', this.config);
  }

  /**
   * Start continuous scanning
   */
  async start(symbols, timeframes = ['15m', '1h', '4h'], scanFrequency = 5 * 60 * 1000) {
    if (this.isRunning) {
      console.log('[SCANNER] Already running');
      return { success: false, message: 'Scanner already running' };
    }

    this.config.symbols = symbols;
    this.config.timeframes = timeframes;
    this.config.scanFrequency = scanFrequency;

    this.isRunning = true;
    this.stats.startTime = new Date().toISOString();
    this.stats.totalScans = 0;
    this.stats.signalsDetected = 0;
    this.stats.signalsTracked = 0;

    console.log('[SCANNER] Starting continuous scanner...');
    console.log(`[SCANNER] Symbols: ${symbols.length}`);
    console.log(`[SCANNER] Timeframes: ${timeframes.join(', ')}`);
    console.log(`[SCANNER] Frequency: Every ${scanFrequency / 60000} minutes`);

    // Initial scan
    await this.runScan();

    // Set up interval
    this.scanInterval = setInterval(async () => {
      await this.runScan();
    }, scanFrequency);

    return {
      success: true,
      message: 'Scanner started',
      config: this.config,
      stats: this.stats
    };
  }

  /**
   * Stop continuous scanning
   */
  stop() {
    if (!this.isRunning) {
      console.log('[SCANNER] Not running');
      return { success: false, message: 'Scanner not running' };
    }

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    this.isRunning = false;
    console.log('[SCANNER] Stopped');

    return {
      success: true,
      message: 'Scanner stopped',
      stats: this.stats
    };
  }

  /**
   * Run a single scan cycle
   */
  async runScan() {
    const scanStart = Date.now();
    console.log(`\n[SCANNER] Starting scan cycle at ${new Date().toLocaleString()}`);

    let totalSignalsFound = 0;
    let totalTracked = 0;

    try {
      for (const timeframe of this.config.timeframes) {
        console.log(`[SCANNER] Scanning ${timeframe} for ${this.config.symbols.length} symbols...`);

        // Scan via API
        const response = await axios.post('http://localhost:3000/api/scan', {
          symbols: this.config.symbols,
          timeframe
        });

        if (response.data.success && response.data.signals) {
          const signals = response.data.signals;
          console.log(`[SCANNER] ${timeframe}: Found ${signals.length} signal(s)`);
          totalSignalsFound += signals.length;

          // Auto-track ENTRY_READY signals if enabled
          if (this.config.autoTrack) {
            const tracked = await this.autoTrackReadySignals(timeframe);
            totalTracked += tracked;
          }
        }

        // Small delay between timeframes to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.stats.totalScans++;
      this.stats.signalsDetected += totalSignalsFound;
      this.stats.signalsTracked += totalTracked;
      this.stats.lastScanTime = new Date().toISOString();
      this.stats.lastScanResult = {
        signalsFound: totalSignalsFound,
        signalsTracked: totalTracked,
        duration: Date.now() - scanStart
      };

      console.log(`[SCANNER] Scan complete: ${totalSignalsFound} signals found, ${totalTracked} auto-tracked`);
      console.log(`[SCANNER] Total: ${this.stats.totalScans} scans, ${this.stats.signalsDetected} signals, ${this.stats.signalsTracked} tracked`);
      console.log(`[SCANNER] Next scan in ${this.config.scanFrequency / 60000} minutes\n`);

    } catch (error) {
      console.error('[SCANNER] Error during scan:', error.message);
      this.stats.lastScanResult = {
        error: error.message,
        duration: Date.now() - scanStart
      };
    }
  }

  /**
   * Auto-track ENTRY_READY signals
   */
  async autoTrackReadySignals(timeframe) {
    try {
      // Get all ENTRY_READY signals
      const readySignals = getLoggedSignals({ entryState: 'ENTRY_READY' });

      let trackedCount = 0;

      for (const signal of readySignals) {
        const signalKey = `${signal.symbol}_${signal.signal.direction}_${signal.timeframe}`;

        // Check if already tracked
        if (!isAutoTracked(signalKey) && !signal.tracked) {
          // Track it
          updateSignalTracking(signal.id, true);
          addAutoTracked(signalKey, signal.id);
          addSignalNote(signal.id, `Auto-tracked by continuous scanner at ${new Date().toLocaleString()}`);

          console.log(`[SCANNER] ✅ AUTO-TRACKED: ${signal.symbol} ${signal.signal.direction.toUpperCase()} [${signal.timeframe}]`);
          trackedCount++;
        }
      }

      return trackedCount;
    } catch (error) {
      console.error('[SCANNER] Error auto-tracking:', error.message);
      return 0;
    }
  }

  /**
   * Get scanner status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      stats: this.stats,
      uptime: this.stats.startTime
        ? Date.now() - new Date(this.stats.startTime).getTime()
        : 0
    };
  }
}

// Singleton instance
const scanner = new ContinuousScanner();

export default scanner;
