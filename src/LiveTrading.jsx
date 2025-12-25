import React, { useState, useEffect } from 'react';
import LiveTradingEngine from './services/liveTradingEngine';
import TradingDashboard from './components/TradingDashboard';
import PositionsList from './components/PositionsList';
import TradeHistory from './components/TradeHistory';

// Auto-detect API URL
const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'production' ? '' : 'http://localhost:3000');

function LiveTrading() {
  // Create engine instance (singleton)
  const [engine] = useState(() => new LiveTradingEngine());

  const [isRunning, setIsRunning] = useState(false);
  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);

  const [config, setConfig] = useState({
    symbols: [],
    timeframe: '1h',
    scanFrequency: 30 * 60 * 1000 // 30 minutes
  });

  const [loading, setLoading] = useState(true);

  // Load configuration and data on mount
  useEffect(() => {
    loadConfig();
    loadAccountData();
    setLoading(false);

    // Listen for trading events
    const handlePositionUpdate = () => {
      loadAccountData();
    };

    window.addEventListener('paperTrading:positionOpened', handlePositionUpdate);
    window.addEventListener('paperTrading:positionClosed', handlePositionUpdate);
    window.addEventListener('paperTrading:orderPlaced', handlePositionUpdate);

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      loadAccountData();
    }, 5000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('paperTrading:positionOpened', handlePositionUpdate);
      window.removeEventListener('paperTrading:positionClosed', handlePositionUpdate);
      window.removeEventListener('paperTrading:orderPlaced', handlePositionUpdate);
    };
  }, []);

  /**
   * Load symbols configuration from server
   */
  const loadConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/api/symbols`);
      const data = await response.json();
      setConfig(prev => ({
        ...prev,
        symbols: data.symbols || []
      }));
    } catch (err) {
      console.error('Error loading config:', err);
    }
  };

  /**
   * Load account data, positions, and statistics
   */
  const loadAccountData = () => {
    const acc = engine.accountManager.getAccount();
    const pos = engine.positionManager.getAllPositions();
    const tradeHistory = engine.tradeLogger.getTradeHistory(20);
    const statistics = engine.tradeLogger.calculateStats();

    setAccount(acc);
    setPositions(pos);
    setTrades(tradeHistory);
    setStats(statistics);
  };

  /**
   * Start paper trading
   */
  const handleStart = async () => {
    if (config.symbols.length === 0) {
      alert('No symbols configured. Please check settings.');
      return;
    }

    await engine.start(config);
    setIsRunning(true);
  };

  /**
   * Stop paper trading
   */
  const handleStop = () => {
    engine.stop();
    setIsRunning(false);
  };

  /**
   * Reset account and clear all data
   */
  const handleResetAccount = () => {
    const confirmed = confirm(
      'Reset paper trading account to $100?\n\n' +
      'This will:\n' +
      '- Close all open positions\n' +
      '- Clear trade history\n' +
      '- Reset account balance\n\n' +
      'Are you sure?'
    );

    if (confirmed) {
      // Stop trading if running
      if (isRunning) {
        handleStop();
      }

      // Reset everything
      engine.accountManager.resetAccount(100);
      engine.positionManager.clearAll();
      engine.tradeLogger.clearAll();

      // Reload data
      loadAccountData();

      alert('Account reset complete!');
    }
  };

  /**
   * Export trade history to JSON
   */
  const handleExportTrades = () => {
    engine.tradeLogger.exportToJSON();
  };

  /**
   * Manually close a position
   */
  const handleManualClose = (positionId) => {
    const position = engine.positionManager.getPosition(positionId);

    if (!position) {
      alert('Position not found');
      return;
    }

    const confirmed = confirm(
      `Manually close position?\n\n` +
      `${position.direction} ${position.symbol}\n` +
      `Entry: ${position.entryPrice}\n` +
      `Current: ${position.currentPrice}\n` +
      `P&L: ${position.floatingPnL >= 0 ? '+' : ''}${position.floatingPnL?.toFixed(2) || 0} USDT\n\n` +
      `This will close the position at current market price.`
    );

    if (confirmed) {
      engine.closePosition(position, position.currentPrice, 'MANUAL');
    }
  };

  /**
   * Update scan frequency (timeframe change)
   */
  const handleTimeframeChange = (newTimeframe) => {
    const scanFrequencies = {
      '1m': 1 * 60 * 1000,    // 1 minute
      '5m': 5 * 60 * 1000,    // 5 minutes
      '15m': 15 * 60 * 1000,  // 15 minutes
      '1h': 30 * 60 * 1000,   // 30 minutes
      '4h': 2 * 60 * 60 * 1000,  // 2 hours
      '1d': 4 * 60 * 60 * 1000,  // 4 hours
      '1w': 12 * 60 * 60 * 1000  // 12 hours
    };

    setConfig(prev => ({
      ...prev,
      timeframe: newTimeframe,
      scanFrequency: scanFrequencies[newTimeframe] || (30 * 60 * 1000)
    }));

    // If running, need to restart with new settings
    if (isRunning) {
      alert('Timeframe changed. Please stop and restart trading for changes to take effect.');
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">
          <div className="spinner"></div>
          <p style={{ marginTop: '20px', color: '#6b7280' }}>Loading paper trading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header & Controls */}
      <div className="card">
        <h2 style={{ marginBottom: '10px' }}>Paper Trading</h2>
        <p style={{ color: '#6b7280', marginBottom: '20px', lineHeight: '1.6' }}>
          Fully automated paper trading using <strong>REAL</strong> market prices and <strong>FAKE</strong> money.
          Trades execute automatically when signals are detected. Use this to test and improve your strategy.
        </p>

        {/* Configuration */}
        <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
              Timeframe
            </label>
            <select
              className="form-input"
              value={config.timeframe}
              onChange={(e) => handleTimeframeChange(e.target.value)}
              style={{ minWidth: '120px' }}
              disabled={isRunning}
            >
              <option value="1m">1 Minute</option>
              <option value="5m">5 Minutes</option>
              <option value="15m">15 Minutes</option>
              <option value="1h">1 Hour</option>
              <option value="4h">4 Hours</option>
              <option value="1d">1 Day</option>
              <option value="1w">1 Week</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
              Symbols
            </label>
            <div style={{ fontSize: '14px', fontWeight: '500', padding: '8px 0' }}>
              {config.symbols.length} symbols
            </div>
          </div>

          <div>
            <label style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
              Scan Frequency
            </label>
            <div style={{ fontSize: '14px', fontWeight: '500', padding: '8px 0' }}>
              Every {config.scanFrequency / 60000} minutes
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {!isRunning ? (
            <button
              className="btn btn-success"
              onClick={handleStart}
              disabled={config.symbols.length === 0}
              style={{ fontSize: '15px', padding: '10px 24px' }}
            >
              ▶ Start Paper Trading
            </button>
          ) : (
            <button
              className="btn btn-danger"
              onClick={handleStop}
              style={{ fontSize: '15px', padding: '10px 24px' }}
            >
              ⏸ Stop Paper Trading
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={handleResetAccount}
            style={{ fontSize: '14px', padding: '10px 20px' }}
          >
            Reset Account
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleExportTrades}
            disabled={!trades || trades.length === 0}
            style={{ fontSize: '14px', padding: '10px 20px' }}
          >
            Export Trades
          </button>
        </div>

        {/* Status */}
        {isRunning && (
          <div style={{
            marginTop: '15px',
            padding: '12px',
            background: '#d1fae5',
            borderRadius: '6px',
            border: '1px solid #059669'
          }}>
            <strong style={{ color: '#059669' }}>Status:</strong>{' '}
            <span style={{ color: '#065f46' }}>
              Paper trading is ACTIVE. Scanning {config.symbols.length} symbols every {config.scanFrequency / 60000} minutes on {config.timeframe} timeframe.
            </span>
          </div>
        )}
      </div>

      {/* Dashboard */}
      <TradingDashboard
        account={account}
        positions={{
          floatingPnL: engine.positionManager.getFloatingPnL(),
          openPositions: engine.positionManager.getOpenPositions().length,
          pendingOrders: engine.positionManager.getPendingOrders().length
        }}
        stats={stats}
      />

      {/* Active Positions */}
      <PositionsList
        positions={positions}
        onManualClose={handleManualClose}
      />

      {/* Trade History */}
      <TradeHistory
        trades={trades}
        onExport={handleExportTrades}
      />
    </div>
  );
}

export default LiveTrading;
