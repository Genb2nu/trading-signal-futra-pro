import React, { useState, useEffect } from 'react';
import { getUSDTSymbols } from './services/binanceClient.js';

// Auto-detect API URL based on environment
const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'production' ? '' : 'http://localhost:3000');

function Settings() {
  const [settings, setSettings] = useState({
    // Symbol settings
    symbols: [],
    limit: 50,
    defaultTimeframes: [],

    // Strategy settings
    strategyMode: 'moderate', // conservative, moderate, aggressive

    // Risk management
    riskPerTrade: 2, // percentage
    maxConcurrentTrades: 3,
    stopLossATRMultiplier: 2.5,

    // Signal filtering
    minimumConfluence: 40,
    minimumRiskReward: 2.0,
    minimumConfidenceLevel: 'standard', // standard, high, premium

    // Advanced settings
    requireHTFAlignment: true,
    allowNeutralZone: true,
    obImpulseThreshold: 0.005 // 0.5%
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
      const response = await fetch(`${API_URL}/api/settings`);
      const data = await response.json();
      setSettings(prev => ({ ...prev, ...data }));
      setLoading(false);
    } catch (err) {
      console.error('Error loading settings:', err);
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
      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully! Restart scanner for changes to take effect.' });
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleStrategyModeChange = (mode) => {
    // Update related settings based on strategy mode
    const presets = {
      conservative: {
        strategyMode: 'conservative',
        minimumConfluence: 65,
        minimumRiskReward: 2.0,
        stopLossATRMultiplier: 2.5,
        obImpulseThreshold: 0.007,
        allowNeutralZone: false,
        requireHTFAlignment: true
      },
      moderate: {
        strategyMode: 'moderate',
        minimumConfluence: 40,
        minimumRiskReward: 2.0,
        stopLossATRMultiplier: 2.5,
        obImpulseThreshold: 0.005,
        allowNeutralZone: true,
        requireHTFAlignment: true
      },
      aggressive: {
        strategyMode: 'aggressive',
        minimumConfluence: 25,
        minimumRiskReward: 1.5,
        stopLossATRMultiplier: 2.0,
        obImpulseThreshold: 0.003,
        allowNeutralZone: true,
        requireHTFAlignment: false
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
                {['conservative', 'moderate', 'aggressive'].map(mode => (
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
                      </strong>
                    </div>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginLeft: '26px' }}>
                      {mode === 'conservative' && '70-85% win rate, fewer signals, highest quality (1h/4h)'}
                      {mode === 'moderate' && '60-75% win rate, balanced approach (1h recommended)'}
                      {mode === 'aggressive' && '55-65% win rate, more signals, faster timeframes (15m/5m)'}
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
                {settings.strategyMode === 'conservative' && 'Conservative: 5-15 signals/day across 50 symbols (1h/4h timeframes)'}
                {settings.strategyMode === 'moderate' && 'Moderate: 15-30 signals/day across 50 symbols (1h recommended)'}
                {settings.strategyMode === 'aggressive' && 'Aggressive: 30-60 signals/day across 50 symbols (15m/5m timeframes)'}
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
