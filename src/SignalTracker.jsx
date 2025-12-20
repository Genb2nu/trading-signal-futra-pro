import React, { useState, useEffect } from 'react';
import SignalDetailsModal from './components/SignalDetailsModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function SignalTracker() {
  const [symbols, setSymbols] = useState([]);
  const [selectedSymbols, setSelectedSymbols] = useState([]);
  const [timeframe, setTimeframe] = useState('1h');
  const [strategy, setStrategy] = useState('SMC');
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanStats, setScanStats] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [nextScanTime, setNextScanTime] = useState(null);
  const [scanIntervalId, setScanIntervalId] = useState(null);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];
  const strategies = ['SMC']; // Extensible for future strategies

  // Load symbols on mount
  useEffect(() => {
    loadSymbols();
  }, []);

  const loadSymbols = async () => {
    try {
      const response = await fetch(`${API_URL}/api/symbols`);
      const data = await response.json();
      setSymbols(data.symbols || []);
      setSelectedSymbols(data.symbols?.slice(0, 10) || []); // Default first 10
    } catch (err) {
      console.error('Error loading symbols:', err);
      setError('Failed to load symbols');
    }
  };

  const handleSymbolChange = (symbol) => {
    setSelectedSymbols(prev => {
      if (prev.includes(symbol)) {
        return prev.filter(s => s !== symbol);
      } else {
        return [...prev, symbol];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedSymbols.length === symbols.length) {
      setSelectedSymbols([]);
    } else {
      setSelectedSymbols([...symbols]);
    }
  };

  // Calculate delay in milliseconds based on timeframe
  const getScanDelay = (timeframe) => {
    const delays = {
      '1m': 60 * 1000,      // 1 minute
      '5m': 5 * 60 * 1000,  // 5 minutes
      '15m': 15 * 60 * 1000, // 15 minutes
      '1h': 30 * 60 * 1000,  // 30 minutes
      '4h': 2 * 60 * 60 * 1000, // 2 hours
      '1d': 4 * 60 * 60 * 1000, // 4 hours
      '1w': 12 * 60 * 60 * 1000, // 12 hours
      '1M': 24 * 60 * 60 * 1000  // 24 hours
    };
    return delays[timeframe] || 60 * 1000; // Default 1 minute
  };

  // Perform a single scan
  const performScan = async () => {
    if (selectedSymbols.length === 0) {
      setError('Please select at least one symbol');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbols: selectedSymbols,
          timeframe,
          strategy
        })
      });

      const data = await response.json();

      if (data.success) {
        // Replace existing signals for same symbols with new signals
        const newSignals = data.signals || [];

        setSignals(prev => {
          // Add scanTime to each new signal
          const signalsWithTime = newSignals.map(s => ({
            ...s,
            scanTime: new Date().toISOString()
          }));

          // Get symbols from new signals
          const newSymbols = new Set(signalsWithTime.map(s => s.symbol));

          // Remove old signals for symbols that appear in new results
          const filteredPrev = prev.filter(s => !newSymbols.has(s.symbol));

          // Add new signals to the top
          return [...signalsWithTime, ...filteredPrev];
        });

        // Calculate total after state update
        const newSymbolSet = new Set(newSignals.map(s => s.symbol));
        const oldSignalsCount = signals.filter(s => !newSymbolSet.has(s.symbol)).length;
        const totalSignals = newSignals.length + oldSignalsCount;

        setScanStats({
          scanned: data.scanned,
          found: data.found,
          timestamp: data.timestamp,
          totalSignals: totalSignals
        });

        return true;
      } else {
        setError(data.error || 'Scan failed');
        return false;
      }
    } catch (err) {
      console.error('Error scanning:', err);
      setError('Failed to scan symbols. Make sure the backend is running.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Start continuous scanning
  const handleScan = async () => {
    if (isScanning) return; // Prevent multiple clicks

    setIsScanning(true);
    setError(null);

    // Run first scan immediately
    await performScan();

    // Setup continuous scanning
    const delay = getScanDelay(timeframe);
    const intervalId = setInterval(async () => {
      setNextScanTime(new Date(Date.now() + delay).toLocaleTimeString());
      await performScan();
    }, delay);

    setScanIntervalId(intervalId);
    setNextScanTime(new Date(Date.now() + delay).toLocaleTimeString());
  };

  // Stop continuous scanning
  const handleStop = () => {
    if (scanIntervalId) {
      clearInterval(scanIntervalId);
      setScanIntervalId(null);
    }
    setIsScanning(false);
    setNextScanTime(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalId) {
        clearInterval(scanIntervalId);
      }
    };
  }, [scanIntervalId]);

  const handleClear = () => {
    handleStop(); // Stop scanning if active
    setSignals([]);
    setScanStats(null);
    setError(null);
  };

  // Convert timeframe to TradingView interval format
  const getTradingViewInterval = (timeframe) => {
    const intervalMap = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '1h': '60',
      '4h': '240',
      '1d': 'D',
      '1w': 'W',
      '1M': 'M'
    };
    return intervalMap[timeframe] || 'D';
  };

  // Open TradingView chart for a symbol
  const openTradingView = (symbol, timeframe) => {
    const interval = getTradingViewInterval(timeframe);
    const url = `https://www.tradingview.com/chart/?symbol=BINANCE:${symbol}&interval=${interval}`;
    window.open(url, '_blank');
  };

  // Modal handlers
  const handleRowClick = (signal) => {
    setSelectedSignal(signal);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedSignal(null), 200); // Delay for exit animation
  };

  return (
    <div>
      <div className="card">
        <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Scan Configuration</h2>

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Timeframe</label>
            <select
              className="form-select"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              {timeframes.map(tf => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Strategy</label>
            <select
              className="form-select"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              {strategies.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Actions</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {!isScanning ? (
                <button
                  className="btn btn-primary"
                  onClick={handleScan}
                  disabled={loading}
                >
                  {loading ? 'Scanning...' : 'Start Continuous Scan'}
                </button>
              ) : (
                <button
                  className="btn btn-danger"
                  onClick={handleStop}
                >
                  Stop Scanning
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={handleClear}
                disabled={loading}
              >
                Clear Results
              </button>
            </div>
            {isScanning && nextScanTime && (
              <div style={{
                marginTop: '10px',
                fontSize: '13px',
                color: '#059669',
                fontWeight: '600'
              }}>
                🔄 Auto-scanning every {getScanDelay(timeframe) / 60000} minutes • Next scan at {nextScanTime}
              </div>
            )}
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '20px' }}>
          <label className="form-label">
            Select Symbols ({selectedSymbols.length} of {symbols.length} selected)
          </label>
          <div style={{ marginBottom: '10px' }}>
            <button
              className="btn btn-secondary"
              onClick={handleSelectAll}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              {selectedSymbols.length === symbols.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            padding: '10px',
            background: '#f9fafb'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
              {symbols.map(symbol => (
                <label key={symbol} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedSymbols.includes(symbol)}
                    onChange={() => handleSymbolChange(symbol)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={{ fontSize: '13px' }}>{symbol}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: '20px',
            padding: '12px',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: '6px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}
      </div>

      {loading && (
        <div className="card">
          <div className="loading">
            <div className="spinner"></div>
            <p style={{ marginTop: '20px', color: '#6b7280' }}>
              Scanning {selectedSymbols.length} symbols on {timeframe} timeframe...
            </p>
          </div>
        </div>
      )}

      {scanStats && !loading && (
        <div className="card">
          <div style={{
            padding: '12px',
            background: isScanning ? '#d1fae5' : '#dbeafe',
            borderRadius: '6px',
            marginBottom: '20px'
          }}>
            <strong>{isScanning ? 'Last Scan:' : 'Scan Complete:'}</strong> Scanned {scanStats.scanned} symbols, found {scanStats.found} signals
            {signals.length > 0 && (
              <span style={{ marginLeft: '10px' }}>
                • <strong>Unique Signals:</strong> {signals.length} (duplicates replaced)
              </span>
            )}
          </div>

          {signals.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Timeframe</th>
                    <th>Type</th>
                    <th>Entry</th>
                    <th>Stop Loss</th>
                    <th>Take Profit</th>
                    <th>R:R</th>
                    <th>Confidence</th>
                    <th>Patterns</th>
                    <th>Detected At</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((signal, index) => (
                    <tr
                      key={index}
                      onClick={() => handleRowClick(signal)}
                      style={{ cursor: 'pointer' }}
                      className="signal-row"
                    >
                      <td style={{ fontWeight: '600' }}>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openTradingView(signal.symbol, signal.timeframe);
                          }}
                          style={{
                            color: '#667eea',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            borderBottom: '1px dashed #667eea'
                          }}
                          onMouseOver={(e) => e.target.style.color = '#5568d3'}
                          onMouseOut={(e) => e.target.style.color = '#667eea'}
                          title="Click to view on TradingView"
                        >
                          {signal.symbol}
                        </a>
                      </td>
                      <td>{signal.timeframe}</td>
                      <td>
                        <span className={`badge ${signal.type === 'BUY' ? 'badge-success' : 'badge-danger'}`}>
                          {signal.type}
                        </span>
                      </td>
                      <td>{signal.entry}</td>
                      <td>{signal.stopLoss}</td>
                      <td>{signal.takeProfit}</td>
                      <td>{signal.riskReward}</td>
                      <td>
                        <span className={`badge ${signal.confidence === 'high' ? 'badge-success' : 'badge-warning'}`}>
                          {signal.confidence}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px' }}>{signal.patterns}</td>
                      <td style={{ fontSize: '12px' }}>
                        {signal.scanTime ? new Date(signal.scanTime).toLocaleString() : new Date(signal.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              No signals found for the selected symbols and timeframe.
            </div>
          )}
        </div>
      )}

      {/* Signal Details Modal */}
      <SignalDetailsModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        signal={selectedSignal}
      />
    </div>
  );
}

export default SignalTracker;
