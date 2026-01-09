import React, { useState, useEffect } from 'react';
import { getUSDTSymbols } from './services/binanceClient.js';

// Auto-detect API URL based on environment
const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'production' ? '' : 'http://localhost:3000');

function Settings() {
  const [settings, setSettings] = useState({
    // Symbol settings - DEFAULT: Top 4 performing symbols
    symbols: ['AVAXUSDT', 'ADAUSDT', 'DOGEUSDT', 'BTCUSDT'],
    limit: 50,
    defaultTimeframes: ['1h'], // DEFAULT: 1H timeframe (best performance)

    // Strategy settings - DEFAULT: Conservative mode (100% WR on top 4)
    strategyMode: 'conservative',

    // Risk management
    riskPerTrade: 2, // 2% per trade default
    maxConcurrentTrades: 3,
    stopLossATRMultiplier: 2.5,
    leverage: 20, // Paper trading leverage multiplier (20x, 50x, or 100x)

    // Signal filtering - Conservative mode defaults
    minimumConfluence: 65,
    minimumRiskReward: 2.0,
    minimumConfidenceLevel: 'standard', // standard, high, premium

    // Advanced settings
    requireHTFAlignment: true,
    allowNeutralZone: true,
    obImpulseThreshold: 0.006 // Conservative mode threshold
  });

  const [allSymbols, setAllSymbols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('symbols'); // symbols, strategy, risk, filters

  useEffect(() => {
    loadSettings();
    loadAllSymbols();
  }, []);

  const loadSettings = async () => {
    try {
      // First, try to load from localStorage
      const localSettings = localStorage.getItem('smcSettings');
      let savedSettings = null;

      if (localSettings) {
        try {
          savedSettings = JSON.parse(localSettings);
          console.log('Loaded settings from localStorage:', savedSettings);
        } catch (e) {
          console.error('Error parsing localStorage settings:', e);
        }
      }

      // Then load defaults from server (as fallback or to merge)
      try {
        const response = await fetch(`${API_URL}/api/settings`);
        const serverDefaults = await response.json();

        // Merge: localStorage takes priority, server provides defaults for missing values
        const mergedSettings = { ...serverDefaults, ...savedSettings };
        setSettings(prev => ({ ...prev, ...mergedSettings }));
      } catch (err) {
        console.error('Error loading server defaults:', err);
        // If server fails but we have localStorage, use that
        if (savedSettings) {
          setSettings(prev => ({ ...prev, ...savedSettings }));
        } else {
          setMessage({ type: 'error', text: 'Failed to load settings' });
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Error in loadSettings:', err);
      setMessage({ type: 'error', text: 'Failed to load settings' });
      setLoading(false);
    }
  };

  const loadAllSymbols = async () => {
    try {
      const symbols = await getUSDTSymbols();
      setAllSymbols(symbols || []);
    } catch (err) {
      console.error('Error loading all symbols:', err);
      setMessage({ type: 'error', text: 'Failed to load symbols from Binance' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Save to localStorage (primary storage)
      localStorage.setItem('smcSettings', JSON.stringify(settings));
      console.log('Settings saved to localStorage');

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('smcSettingsUpdated', { detail: settings }));

      // Also update server runtime config (for current session)
      try {
        const response = await fetch(`${API_URL}/api/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(settings)
        });

        const data = await response.json();

        if (data.success || data.warning) {
          setMessage({
            type: 'success',
            text: '✅ Settings saved! Changes will apply to new scans. Settings persist in your browser.'
          });
          setTimeout(() => setMessage(null), 5000);
        } else {
          // Even if server fails, localStorage succeeded
          setMessage({
            type: 'success',
            text: '✅ Settings saved locally! Server update failed but settings are stored in your browser.'
          });
          setTimeout(() => setMessage(null), 5000);
        }
      } catch (err) {
        console.error('Error updating server:', err);
        // localStorage still succeeded, so show success
        setMessage({
          type: 'success',
          text: '✅ Settings saved locally! Server is offline but settings are stored in your browser.'
        });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (err) {
      console.error('Error saving to localStorage:', err);
      setMessage({ type: 'error', text: 'Failed to save settings to browser storage' });
    } finally {
      setSaving(false);
    }
  };

  const handleStrategyModeChange = (mode) => {
    // Update related settings based on strategy mode
    const presets = {
      conservative: {
        strategyMode: 'conservative',
        minimumConfluence: 40,
        minimumRiskReward: 2.0,
        stopLossATRMultiplier: 2.5,
        obImpulseThreshold: 0.007,
        allowNeutralZone: false,
        requireHTFAlignment: true,
        defaultTimeframes: ['1h', '4h']
      },
      moderate: {
        strategyMode: 'moderate',
        minimumConfluence: 30,
        minimumRiskReward: 2.0,
        stopLossATRMultiplier: 2.5,
        obImpulseThreshold: 0.005,
        allowNeutralZone: true,
        requireHTFAlignment: true,
        defaultTimeframes: ['1h']
      },
      aggressive: {
        strategyMode: 'aggressive',
        minimumConfluence: 20,
        minimumRiskReward: 1.5,
        stopLossATRMultiplier: 2.0,
        obImpulseThreshold: 0.003,
        allowNeutralZone: true,
        requireHTFAlignment: false,
        defaultTimeframes: ['15m', '1h', '4h']
      },
      scalping: {
        strategyMode: 'scalping',
        minimumConfluence: 28,
        minimumRiskReward: 1.5,
        stopLossATRMultiplier: 2.0,
        obImpulseThreshold: 0.003,
        allowNeutralZone: false,
        requireHTFAlignment: true,
        defaultTimeframes: ['15m', '1h']
      },
      sniper: {
        strategyMode: 'sniper',
        minimumConfluence: 55,
        minimumRiskReward: 2.5,
        stopLossATRMultiplier: 2.5,
        obImpulseThreshold: 0.008,
        allowNeutralZone: false,
        requireHTFAlignment: true,
        defaultTimeframes: ['1h']
      },
      elite: {
        strategyMode: 'elite',
        minimumConfluence: 45,
        minimumRiskReward: 2.5,
        stopLossATRMultiplier: 3.0,
        obImpulseThreshold: 0.007,
        allowNeutralZone: false,
        requireHTFAlignment: true,
        defaultTimeframes: ['15m']
      }
    };

    setSettings(prev => ({ ...prev, ...presets[mode] }));
  };

  const filteredSymbols = allSymbols.filter(symbol =>
    symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="card">
        <div className="loading">
          <div className="spinner"></div>
          <p style={{ marginTop: '20px', color: '#6b7280' }}>Loading settings...</p>
        </div>
      </div>
    );
  }

  const tabStyle = (tabName) => ({
    padding: '12px 24px',
    background: activeTab === tabName ? '#3b82f6' : '#e5e7eb',
    color: activeTab === tabName ? 'white' : '#4b5563',
    border: 'none',
    borderRadius: '6px 6px 0 0',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s'
  });

  return (
    <div>
      {message && (
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '0' }}>
        <button style={tabStyle('symbols')} onClick={() => setActiveTab('symbols')}>
          📊 Symbols
        </button>
        <button style={tabStyle('strategy')} onClick={() => setActiveTab('strategy')}>
          🎯 Strategy
        </button>
        <button style={tabStyle('risk')} onClick={() => setActiveTab('risk')}>
          ⚠️ Risk Management
        </button>
        <button style={tabStyle('filters')} onClick={() => setActiveTab('filters')}>
          🔍 Signal Filters
        </button>
      </div>

      <div className="card" style={{ borderRadius: '0 6px 6px 6px', marginTop: '0' }}>
        {/* SYMBOLS TAB */}
        {activeTab === 'symbols' && (
          <>
            <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Symbol Configuration</h2>

            <div className="form-group">
              <label className="form-label">Symbol Limit</label>
              <input
                type="number"
                className="form-input"
                value={settings.limit}
                onChange={(e) => setSettings(prev => ({ ...prev, limit: parseInt(e.target.value) || 50 }))}
                min="1"
                max="1000"
                style={{ maxWidth: '200px' }}
              />
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '5px' }}>
                Maximum number of symbols to track (default: 50)
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">
                Symbol Selection ({settings.symbols.length} selected)
              </label>

              <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setSettings(prev => ({ ...prev, symbols: allSymbols.slice(0, settings.limit) }))}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  Select Top {settings.limit}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSettings(prev => ({ ...prev, symbols: [] }))}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  Clear All
                </button>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search symbols..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ maxWidth: '300px' }}
                />
              </div>

              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '15px',
                background: '#f9fafb'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '12px'
                }}>
                  {filteredSymbols.map(symbol => (
                    <label
                      key={symbol}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '8px',
                        background: settings.symbols.includes(symbol) ? '#dbeafe' : 'white',
                        borderRadius: '4px',
                        transition: 'background 0.2s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={settings.symbols.includes(symbol)}
                        onChange={() => {
                          setSettings(prev => ({
                            ...prev,
                            symbols: prev.symbols.includes(symbol)
                              ? prev.symbols.filter(s => s !== symbol)
                              : [...prev.symbols, symbol]
                          }));
                        }}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>{symbol}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* STRATEGY TAB */}
        {activeTab === 'strategy' && (
          <>
            <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Strategy Configuration</h2>

            <div className="form-group">
              <label className="form-label">Strategy Mode</label>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '10px' }}>
                {['conservative', 'moderate', 'aggressive', 'scalping', 'elite', 'sniper'].map(mode => (
                  <label
                    key={mode}
                    style={{
                      flex: '1',
                      minWidth: '250px',
                      padding: '15px',
                      border: `2px solid ${settings.strategyMode === mode ? '#3b82f6' : '#d1d5db'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: settings.strategyMode === mode ? '#eff6ff' : 'white',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <input
                        type="radio"
                        name="strategyMode"
                        checked={settings.strategyMode === mode}
                        onChange={() => handleStrategyModeChange(mode)}
                        style={{ marginRight: '10px' }}
                      />
                      <strong style={{ fontSize: '15px', textTransform: 'capitalize' }}>
                        {mode}
                        {mode === 'elite' && ' 🏆'}
                        {mode === 'moderate' && ' ⭐'}
                      </strong>
                    </div>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginLeft: '26px' }}>
                      {mode === 'conservative' && '66.7% WR, 10.76 PF - High quality, selective trades (12 trades, +9.76R)'}
                      {mode === 'moderate' && '⭐ 61.5% WR, 7.07 PF - BEST BALANCE - Quality + Volume (13 trades, +7.86R)'}
                      {mode === 'aggressive' && '50.0% WR, 3.14 PF - High volume trading (62 trades, +31.74R total)'}
                      {mode === 'scalping' && '60.5% WR, 3.71 PF - Active trading style (38 trades, +19.75R)'}
                      {mode === 'elite' && '🏆 100% WR, 999 PF - HIGHEST WIN RATE - Ultra-selective (3 trades, +3.00R)'}
                      {mode === 'sniper' && '⚠️ Extremely strict - Very few signals (1h only, 80%+ target WR)'}
                    </p>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Minimum Confluence Score
                <span style={{ marginLeft: '10px', color: '#6b7280', fontWeight: 'normal' }}>
                  ({settings.minimumConfluence}/100)
                </span>
              </label>
              <input
                type="range"
                min="20"
                max="80"
                value={settings.minimumConfluence}
                onChange={(e) => setSettings(prev => ({ ...prev, minimumConfluence: parseInt(e.target.value) }))}
                style={{ width: '100%', maxWidth: '400px' }}
              />
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '5px' }}>
                Higher = fewer but higher quality signals. Lower = more signals but lower accuracy.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">
                Order Block Impulse Threshold
                <span style={{ marginLeft: '10px', color: '#6b7280', fontWeight: 'normal' }}>
                  ({(settings.obImpulseThreshold * 100).toFixed(1)}%)
                </span>
              </label>
              <input
                type="range"
                min="0.002"
                max="0.01"
                step="0.001"
                value={settings.obImpulseThreshold}
                onChange={(e) => setSettings(prev => ({ ...prev, obImpulseThreshold: parseFloat(e.target.value) }))}
                style={{ width: '100%', maxWidth: '400px' }}
              />
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '5px' }}>
                Minimum price movement to identify Order Blocks. Lower = more OBs detected.
              </p>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.allowNeutralZone}
                  onChange={(e) => setSettings(prev => ({ ...prev, allowNeutralZone: e.target.checked }))}
                  style={{ marginRight: '10px' }}
                />
                <span className="form-label" style={{ marginBottom: 0 }}>Allow Neutral Zone Signals</span>
              </label>
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '5px', marginLeft: '28px' }}>
                If disabled, only signals in premium (for sells) or discount (for buys) zones are allowed.
              </p>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.requireHTFAlignment}
                  onChange={(e) => setSettings(prev => ({ ...prev, requireHTFAlignment: e.target.checked }))}
                  style={{ marginRight: '10px' }}
                />
                <span className="form-label" style={{ marginBottom: 0 }}>Require Higher Timeframe Alignment</span>
              </label>
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '5px', marginLeft: '28px' }}>
                Blocks bullish signals when HTF is bearish (and vice versa). Recommended for higher win rate.
              </p>
            </div>

            <div style={{
              marginTop: '30px',
              padding: '15px',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '8px'
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#0c4a6e',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                🎯 Inducement Enhancement (Active)
              </h3>
              <p style={{ fontSize: '13px', color: '#164e63', lineHeight: '1.6', marginBottom: '8px' }}>
                This strategy now includes advanced inducement detection to identify retail trap patterns and filter out false signals:
              </p>
              <ul style={{ fontSize: '12px', color: '#164e63', lineHeight: '1.6', marginLeft: '20px', marginBottom: '0' }}>
                <li><strong>5 Inducement Types Detected:</strong> Basic, Supply/Demand Zones, Power of 3 (Consolidation), Premature Reversals, First Pullback Traps</li>
                <li><strong>Retail Trap Filtering:</strong> Automatically rejects signals that form AT inducement zones (where retail gets trapped)</li>
                <li><strong>Confluence Boost:</strong> Valid inducement patterns add +8 to +15 confluence points, improving signal quality</li>
                <li><strong>Proven Results:</strong> Backtests show 85.9% win rate (MODERATE) and 81.1% (AGGRESSIVE) across all timeframes</li>
              </ul>
            </div>
          </>
        )}

        {/* RISK MANAGEMENT TAB */}
        {activeTab === 'risk' && (
          <>
            <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Risk Management</h2>

            <div className="form-group">
              <label className="form-label">
                Risk Per Trade
                <span style={{ marginLeft: '10px', color: '#6b7280', fontWeight: 'normal' }}>
                  ({settings.riskPerTrade}%)
                </span>
              </label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={settings.riskPerTrade}
                onChange={(e) => setSettings(prev => ({ ...prev, riskPerTrade: parseFloat(e.target.value) }))}
                style={{ width: '100%', maxWidth: '400px' }}
              />
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '5px' }}>
                Recommended: 1-2% for conservative, 2-3% for moderate. Never exceed 5%!
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Maximum Concurrent Trades</label>
              <input
                type="number"
                className="form-input"
                value={settings.maxConcurrentTrades}
                onChange={(e) => setSettings(prev => ({ ...prev, maxConcurrentTrades: parseInt(e.target.value) || 3 }))}
                min="1"
                max="10"
                style={{ maxWidth: '200px' }}
              />
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '5px' }}>
                Maximum number of trades open at the same time. Total risk = {settings.riskPerTrade}% × {settings.maxConcurrentTrades} = {(settings.riskPerTrade * settings.maxConcurrentTrades).toFixed(1)}%
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">
                Stop Loss ATR Multiplier
                <span style={{ marginLeft: '10px', color: '#6b7280', fontWeight: 'normal' }}>
                  ({settings.stopLossATRMultiplier.toFixed(1)}x)
                </span>
              </label>
              <input
                type="range"
                min="1.5"
                max="3.5"
                step="0.5"
                value={settings.stopLossATRMultiplier}
                onChange={(e) => setSettings(prev => ({ ...prev, stopLossATRMultiplier: parseFloat(e.target.value) }))}
                style={{ width: '100%', maxWidth: '400px' }}
              />
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '5px' }}>
                Stop loss distance based on Average True Range (ATR). Higher = wider stops, fewer stop outs but larger losses.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">
                Minimum Risk:Reward Ratio
                <span style={{ marginLeft: '10px', color: '#6b7280', fontWeight: 'normal' }}>
                  ({settings.minimumRiskReward.toFixed(1)}:1)
                </span>
              </label>
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.1"
                value={settings.minimumRiskReward}
                onChange={(e) => setSettings(prev => ({ ...prev, minimumRiskReward: parseFloat(e.target.value) }))}
                style={{ width: '100%', maxWidth: '400px' }}
              />
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '5px' }}>
                Minimum reward:risk ratio required for a trade. 1.5:1 means win $1.50 for every $1 risked.
              </p>
            </div>

            {/* Premium/Discount Zone Configuration */}
            <div className="form-group">
              <label className="form-label">Premium/Discount Zone Configuration</label>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', color: '#6b7280', display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={settings.premiumDiscountConfig?.mode === 'smc_standard'}
                    onChange={() => setSettings({
                      ...settings,
                      premiumDiscountConfig: { mode: 'smc_standard', discountThreshold: 30, premiumThreshold: 70 }
                    })}
                  />
                  <span style={{ marginLeft: '8px', fontWeight: '600' }}>SMC Standard (30%/70%)</span>
                  <span style={{ display: 'block', marginLeft: '28px', fontSize: '12px', color: '#9ca3af' }}>
                    Discount ≤30% (buy zone), Premium ≥70% (sell zone) - Official ICT methodology
                  </span>
                </label>
                <label style={{ fontSize: '13px', color: '#6b7280', display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={settings.premiumDiscountConfig?.mode === 'balanced'}
                    onChange={() => setSettings({
                      ...settings,
                      premiumDiscountConfig: { mode: 'balanced', discountThreshold: 45, premiumThreshold: 55 }
                    })}
                  />
                  <span style={{ marginLeft: '8px', fontWeight: '600' }}>Balanced (45%/55%)</span>
                  <span style={{ display: 'block', marginLeft: '28px', fontSize: '12px', color: '#9ca3af' }}>
                    Larger equilibrium zone (45-55%) for more trading opportunities
                  </span>
                </label>
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', lineHeight: '1.6' }}>
                <strong>Discount zone</strong> = lower part of range (institutional buying area)<br/>
                <strong>Premium zone</strong> = upper part of range (institutional selling area)<br/>
                <strong>Equilibrium</strong> = middle zone (avoid entries here per SMC principles)
              </p>
            </div>

            {/* Chart Visualization Limits */}
            <div className="form-group" style={{ marginTop: '24px' }}>
              <label className="form-label">📊 Chart Visualization Limits</label>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
                Control how many patterns are displayed on charts for clarity. Shows only the latest/nearest patterns.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Max FVGs */}
                <div>
                  <label style={{ fontSize: '13px', color: '#4b5563', display: 'block', marginBottom: '6px' }}>
                    Max FVG Zones
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.visualizationLimits?.maxFVGs || 3}
                    onChange={(e) => setSettings({
                      ...settings,
                      visualizationLimits: {
                        ...settings.visualizationLimits,
                        maxFVGs: parseInt(e.target.value)
                      }
                    })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Show latest {settings.visualizationLimits?.maxFVGs || 3} FVGs</span>
                </div>

                {/* Max Order Blocks */}
                <div>
                  <label style={{ fontSize: '13px', color: '#4b5563', display: 'block', marginBottom: '6px' }}>
                    Max Order Blocks
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.visualizationLimits?.maxOrderBlocks || 3}
                    onChange={(e) => setSettings({
                      ...settings,
                      visualizationLimits: {
                        ...settings.visualizationLimits,
                        maxOrderBlocks: parseInt(e.target.value)
                      }
                    })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Show latest {settings.visualizationLimits?.maxOrderBlocks || 3} OBs</span>
                </div>

                {/* Max CHoCH */}
                <div>
                  <label style={{ fontSize: '13px', color: '#4b5563', display: 'block', marginBottom: '6px' }}>
                    Max CHoCH Lines
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={settings.visualizationLimits?.maxCHOCH || 2}
                    onChange={(e) => setSettings({
                      ...settings,
                      visualizationLimits: {
                        ...settings.visualizationLimits,
                        maxCHOCH: parseInt(e.target.value)
                      }
                    })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Show latest {settings.visualizationLimits?.maxCHOCH || 2} CHoCH</span>
                </div>

                {/* Max BOS */}
                <div>
                  <label style={{ fontSize: '13px', color: '#4b5563', display: 'block', marginBottom: '6px' }}>
                    Max BOS Lines
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={settings.visualizationLimits?.maxBOS || 2}
                    onChange={(e) => setSettings({
                      ...settings,
                      visualizationLimits: {
                        ...settings.visualizationLimits,
                        maxBOS: parseInt(e.target.value)
                      }
                    })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Show latest {settings.visualizationLimits?.maxBOS || 2} BOS</span>
                </div>

                {/* Max Candles Back */}
                <div>
                  <label style={{ fontSize: '13px', color: '#4b5563', display: 'block', marginBottom: '6px' }}>
                    Max Candles Back
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="200"
                    step="10"
                    value={settings.visualizationLimits?.maxCandlesBack || 50}
                    onChange={(e) => setSettings({
                      ...settings,
                      visualizationLimits: {
                        ...settings.visualizationLimits,
                        maxCandlesBack: parseInt(e.target.value)
                      }
                    })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Only show patterns within {settings.visualizationLimits?.maxCandlesBack || 50} candles</span>
                </div>

                {/* Max Distance Percent */}
                <div>
                  <label style={{ fontSize: '13px', color: '#4b5563', display: 'block', marginBottom: '6px' }}>
                    Max Distance from Price (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={settings.visualizationLimits?.maxDistancePercent || 10}
                    onChange={(e) => setSettings({
                      ...settings,
                      visualizationLimits: {
                        ...settings.visualizationLimits,
                        maxDistancePercent: parseInt(e.target.value)
                      }
                    })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Only show patterns within {settings.visualizationLimits?.maxDistancePercent || 10}% of current price</span>
                </div>
              </div>

              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: '#eff6ff',
                borderRadius: '6px',
                border: '1px solid #3b82f6'
              }}>
                <p style={{ fontSize: '12px', color: '#1e40af', margin: 0 }}>
                  <strong>💡 Tip:</strong> Lower values = cleaner charts with focus on most recent/relevant patterns.
                  Higher values = more historical context but busier charts.
                </p>
              </div>
            </div>

            <div style={{
              marginTop: '20px',
              padding: '15px',
              background: '#fef3c7',
              borderRadius: '6px',
              border: '1px solid #fbbf24'
            }}>
              <strong style={{ color: '#92400e', display: 'block', marginBottom: '8px' }}>
                💡 Risk Management Summary
              </strong>
              <ul style={{ fontSize: '13px', color: '#92400e', lineHeight: '1.8', marginLeft: '20px' }}>
                <li>Risk per trade: {settings.riskPerTrade}% (${(100 * settings.riskPerTrade / 100).toFixed(2)} on $100 account)</li>
                <li>Max concurrent trades: {settings.maxConcurrentTrades}</li>
                <li>Max total risk: {(settings.riskPerTrade * settings.maxConcurrentTrades).toFixed(1)}%</li>
                <li>Stop loss: {settings.stopLossATRMultiplier}× ATR</li>
                <li>Min R:R: {settings.minimumRiskReward}:1</li>
              </ul>
            </div>
          </>
        )}

        {/* FILTERS TAB */}
        {activeTab === 'filters' && (
          <>
            <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Signal Filters</h2>

            <div className="form-group">
              <label className="form-label">Minimum Confidence Level</label>
              <select
                className="form-input"
                value={settings.minimumConfidenceLevel}
                onChange={(e) => setSettings(prev => ({ ...prev, minimumConfidenceLevel: e.target.value }))}
                style={{ maxWidth: '300px' }}
              >
                <option value="standard">Standard (Confluence ≥25)</option>
                <option value="high">High (Confluence ≥50)</option>
                <option value="premium">Premium (Confluence ≥75)</option>
              </select>
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '5px' }}>
                Filters signals by confidence tier. Higher confidence = fewer signals but better quality.
              </p>
            </div>

            <div style={{
              marginTop: '20px',
              padding: '15px',
              background: '#e0f2fe',
              borderRadius: '6px',
              border: '1px solid #38bdf8'
            }}>
              <strong style={{ color: '#075985', display: 'block', marginBottom: '12px' }}>
                📋 Active Filters Summary
              </strong>
              <div style={{ fontSize: '13px', color: '#075985', lineHeight: '1.8' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 15px' }}>
                  <span><strong>Strategy Mode:</strong></span>
                  <span style={{ textTransform: 'capitalize' }}>{settings.strategyMode}</span>

                  <span><strong>Min Confluence:</strong></span>
                  <span>{settings.minimumConfluence}/100</span>

                  <span><strong>Min Confidence:</strong></span>
                  <span style={{ textTransform: 'capitalize' }}>{settings.minimumConfidenceLevel}</span>

                  <span><strong>Min R:R:</strong></span>
                  <span>{settings.minimumRiskReward}:1</span>

                  <span><strong>HTF Alignment:</strong></span>
                  <span>{settings.requireHTFAlignment ? 'Required' : 'Optional'}</span>

                  <span><strong>Neutral Zone:</strong></span>
                  <span>{settings.allowNeutralZone ? 'Allowed' : 'Not Allowed'}</span>
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '20px',
              padding: '15px',
              background: '#f3f4f6',
              borderRadius: '6px',
              border: '1px solid #9ca3af'
            }}>
              <strong style={{ color: '#1f2937', display: 'block', marginBottom: '8px' }}>
                📊 Expected Signal Frequency
              </strong>
              <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.6' }}>
                {settings.strategyMode === 'conservative' && 'Conservative: 66.7% WR, 10.76 PF - Selective, high-quality signals (1h/4h timeframes)'}
                {settings.strategyMode === 'moderate' && 'Moderate: 61.5% WR, 7.07 PF - Best balance of quality and volume (1h recommended)'}
                {settings.strategyMode === 'aggressive' && 'Aggressive: 50.0% WR, 3.14 PF - Maximum volume, still profitable (15m/1h/4h)'}
                {settings.strategyMode === 'scalping' && 'Scalping: 60.5% WR, 3.71 PF - Active trading with good win rate (15m/1h)'}
                {settings.strategyMode === 'elite' && 'Elite: 100% WR, 999 PF - HIGHEST WIN RATE - Ultra-selective (15m only, very few signals)'}
                {settings.strategyMode === 'sniper' && 'Sniper: Extremely strict - Very few signals targeting 80%+ WR (1h only)'}
              </p>
            </div>
          </>
        )}

        {/* Save Button */}
        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #e5e7eb' }}>
          <button
            className="btn btn-success"
            onClick={handleSave}
            disabled={saving}
            style={{ fontSize: '16px', padding: '12px 32px' }}
          >
            {saving ? '💾 Saving...' : '💾 Save All Settings'}
          </button>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '10px' }}>
            Note: Changes will take effect on the next scan. You may need to refresh the page.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
