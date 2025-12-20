import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function Settings() {
  const [settings, setSettings] = useState({
    symbols: [],
    limit: 50,
    defaultTimeframes: []
  });
  const [allSymbols, setAllSymbols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadSettings();
    loadAllSymbols();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/settings`);
      const data = await response.json();
      setSettings(data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading settings:', err);
      setMessage({ type: 'error', text: 'Failed to load settings' });
      setLoading(false);
    }
  };

  const loadAllSymbols = async () => {
    try {
      const response = await fetch(`${API_URL}/api/symbols/all`);
      const data = await response.json();
      setAllSymbols(data.symbols || []);
    } catch (err) {
      console.error('Error loading all symbols:', err);
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
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
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

  const handleLimitChange = (e) => {
    const newLimit = parseInt(e.target.value) || 50;
    setSettings(prev => ({
      ...prev,
      limit: newLimit
    }));
  };

  const handleSymbolToggle = (symbol) => {
    setSettings(prev => {
      const symbols = prev.symbols.includes(symbol)
        ? prev.symbols.filter(s => s !== symbol)
        : [...prev.symbols, symbol];

      return { ...prev, symbols };
    });
  };

  const handleSelectTop = () => {
    const topSymbols = allSymbols.slice(0, settings.limit);
    setSettings(prev => ({ ...prev, symbols: topSymbols }));
  };

  const handleClearAll = () => {
    setSettings(prev => ({ ...prev, symbols: [] }));
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

  return (
    <div>
      <div className="card">
        <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Settings</h2>

        {message && (
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
            color: message.type === 'success' ? '#065f46' : '#991b1b',
            borderRadius: '6px',
            fontSize: '14px'
          }}>
            {message.text}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Symbol Limit</label>
          <input
            type="number"
            className="form-input"
            value={settings.limit}
            onChange={handleLimitChange}
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
              onClick={handleSelectTop}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              Select Top {settings.limit}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleClearAll}
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
                    onChange={() => handleSymbolToggle(symbol)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>{symbol}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '30px' }}>
          <button
            className="btn btn-success"
            onClick={handleSave}
            disabled={saving}
            style={{ fontSize: '16px', padding: '12px 24px' }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>Information</h3>
        <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.8' }}>
          <p><strong>Total Available Symbols:</strong> {allSymbols.length} USDT pairs</p>
          <p><strong>Currently Selected:</strong> {settings.symbols.length} symbols</p>
          <p><strong>Limit:</strong> {settings.limit} symbols maximum</p>
          <p style={{ marginTop: '15px', padding: '10px', background: '#fef3c7', borderRadius: '4px', color: '#92400e' }}>
            <strong>Note:</strong> Scanning many symbols may take longer. For optimal performance, select only the symbols you actively trade.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
