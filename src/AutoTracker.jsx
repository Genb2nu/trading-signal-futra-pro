import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Auto-detect API URL
const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'production' ? '' : 'http://localhost:3000');

function AutoTracker() {
  const [trackedSignals, setTrackedSignals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoTracking, setAutoTracking] = useState(false);
  const [lastAutoTrack, setLastAutoTrack] = useState(null);

  // Continuous scanner state
  const [scannerStatus, setScannerStatus] = useState(null);
  const [scannerLoading, setScannerLoading] = useState(false);

  // Record outcome modal state
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [outcomeForm, setOutcomeForm] = useState({
    result: 'win',
    exitPrice: '',
    notes: ''
  });

  // Auto-refresh interval
  const [refreshInterval, setRefreshInterval] = useState(null);

  useEffect(() => {
    loadData();
    loadScannerStatus();

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      loadData();
      loadScannerStatus();
    }, 10000);

    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  /**
   * Load tracked signals and stats
   */
  const loadData = async () => {
    try {
      const [signalsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/auto-tracker/tracked-signals`),
        axios.get(`${API_URL}/api/auto-tracker/stats`)
      ]);

      if (signalsRes.data.success) {
        setTrackedSignals(signalsRes.data.signals);
      }

      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  /**
   * Load scanner status
   */
  const loadScannerStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/scanner/status`);
      if (response.data.success) {
        setScannerStatus(response.data.status);
      }
    } catch (error) {
      console.error('Error loading scanner status:', error);
    }
  };

  /**
   * Start continuous scanner
   */
  const handleStartScanner = async () => {
    try {
      setScannerLoading(true);

      // Get symbols from config
      const configRes = await axios.get(`${API_URL}/api/symbols`);
      const symbols = configRes.data.symbols || [];

      if (symbols.length === 0) {
        alert('❌ No symbols configured in settings');
        return;
      }

      const response = await axios.post(`${API_URL}/api/scanner/start`, {
        symbols,
        timeframes: ['15m', '1h', '4h'],
        scanFrequency: 5 * 60 * 1000 // 5 minutes
      });

      if (response.data.success) {
        alert(`✅ Continuous scanner started!\n\nScanning ${symbols.length} symbols every 5 minutes.\nSignals will be auto-tracked when they reach ENTRY_READY.`);
        await loadScannerStatus();
      }
    } catch (error) {
      console.error('Error starting scanner:', error);
      alert('❌ Error starting scanner');
    } finally {
      setScannerLoading(false);
    }
  };

  /**
   * Stop continuous scanner
   */
  const handleStopScanner = async () => {
    try {
      setScannerLoading(true);
      const response = await axios.post(`${API_URL}/api/scanner/stop`);

      if (response.data.success) {
        alert(`✅ Scanner stopped.\n\nTotal scans: ${response.data.stats.totalScans}\nSignals detected: ${response.data.stats.signalsDetected}\nSignals tracked: ${response.data.stats.signalsTracked}`);
        await loadScannerStatus();
      }
    } catch (error) {
      console.error('Error stopping scanner:', error);
      alert('❌ Error stopping scanner');
    } finally {
      setScannerLoading(false);
    }
  };

  /**
   * Export validation data
   */
  const handleExportData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/scanner/export-data`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `validation-data-${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      alert('✅ Data exported successfully!');
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('❌ Error exporting data');
    }
  };

  /**
   * Auto-track all ENTRY_READY signals
   */
  const handleAutoTrack = async () => {
    try {
      setAutoTracking(true);
      const response = await axios.post(`${API_URL}/api/auto-tracker/auto-track`);

      if (response.data.success) {
        setLastAutoTrack({
          time: new Date().toLocaleTimeString(),
          count: response.data.trackedCount
        });

        // Reload data
        await loadData();

        if (response.data.trackedCount > 0) {
          alert(`✅ Auto-tracked ${response.data.trackedCount} signal(s)!`);
        } else {
          alert('ℹ️ No new ENTRY_READY signals to track.');
        }
      }
    } catch (error) {
      console.error('Error auto-tracking:', error);
      alert('❌ Error auto-tracking signals');
    } finally {
      setAutoTracking(false);
    }
  };

  /**
   * Open record outcome modal
   */
  const openOutcomeModal = (signal) => {
    setSelectedSignal(signal);
    setOutcomeForm({
      result: signal.progress?.status?.includes('HIT TP') ? 'win' :
              signal.progress?.status?.includes('HIT SL') ? 'loss' : 'win',
      exitPrice: signal.currentPrice || signal.signal.entry,
      notes: ''
    });
    setShowOutcomeModal(true);
  };

  /**
   * Submit outcome
   */
  const handleSubmitOutcome = async () => {
    if (!selectedSignal || !outcomeForm.exitPrice) {
      alert('Please enter exit price');
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/api/auto-tracker/record-outcome/${selectedSignal.id}`,
        outcomeForm
      );

      if (response.data.success) {
        alert(`✅ Outcome recorded: ${outcomeForm.result.toUpperCase()}\nP/L: ${response.data.outcome.profitLoss}%\nR:R: ${response.data.outcome.riskRewardAchieved}R`);
        setShowOutcomeModal(false);
        setSelectedSignal(null);
        await loadData();
      }
    } catch (error) {
      console.error('Error recording outcome:', error);
      alert('❌ Error recording outcome');
    }
  };

  /**
   * Get status badge
   */
  const getStatusBadge = (progress) => {
    if (!progress) return <span className="badge badge-secondary">Unknown</span>;

    if (progress.status === 'HIT TP') {
      return <span className="badge badge-success">✅ Hit TP</span>;
    } else if (progress.status === 'HIT SL') {
      return <span className="badge badge-danger">❌ Hit SL</span>;
    } else if (progress.status === 'IN PROFIT') {
      return <span className="badge badge-success">🟢 In Profit</span>;
    } else {
      return <span className="badge badge-warning">🔴 In Loss</span>;
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">
          <div className="spinner"></div>
          <p style={{ marginTop: '20px', color: '#6b7280' }}>Loading auto-tracker...</p>
        </div>
      </div>
    );
  }

  const openTrades = trackedSignals.filter(s => !s.outcome);
  const closedTrades = trackedSignals.filter(s => s.outcome);

  return (
    <div>
      {/* Continuous Scanner Controls */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', marginBottom: '20px' }}>
        <h2 style={{ marginBottom: '10px', color: 'white' }}>🤖 Continuous Auto-Scanner</h2>
        <p style={{ marginBottom: '20px', lineHeight: '1.6', opacity: 0.95 }}>
          Runs 24/7 automatically scanning symbols and tracking ENTRY_READY signals. Collects data for learning and optimization.
        </p>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '15px' }}>
          {!scannerStatus?.isRunning ? (
            <button
              className="btn"
              onClick={handleStartScanner}
              disabled={scannerLoading}
              style={{
                fontSize: '15px',
                padding: '10px 24px',
                background: '#10b981',
                color: 'white',
                border: 'none'
              }}
            >
              {scannerLoading ? '⏳ Starting...' : '▶ Start Continuous Scanner'}
            </button>
          ) : (
            <button
              className="btn"
              onClick={handleStopScanner}
              disabled={scannerLoading}
              style={{
                fontSize: '15px',
                padding: '10px 24px',
                background: '#ef4444',
                color: 'white',
                border: 'none'
              }}
            >
              {scannerLoading ? '⏳ Stopping...' : '⏸ Stop Scanner'}
            </button>
          )}

          <button
            className="btn"
            onClick={handleExportData}
            style={{
              fontSize: '14px',
              padding: '10px 20px',
              background: 'white',
              color: '#667eea',
              border: 'none'
            }}
          >
            📥 Export Data
          </button>
        </div>

        {scannerStatus && (
          <div style={{
            padding: '15px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', fontSize: '13px' }}>
              <div>
                <div style={{ opacity: 0.8, marginBottom: '4px' }}>Status</div>
                <div style={{ fontWeight: '700', fontSize: '15px' }}>
                  {scannerStatus.isRunning ? '🟢 RUNNING' : '⚫ STOPPED'}
                </div>
              </div>
              {scannerStatus.stats.totalScans > 0 && (
                <>
                  <div>
                    <div style={{ opacity: 0.8, marginBottom: '4px' }}>Total Scans</div>
                    <div style={{ fontWeight: '700', fontSize: '15px' }}>{scannerStatus.stats.totalScans}</div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.8, marginBottom: '4px' }}>Signals Found</div>
                    <div style={{ fontWeight: '700', fontSize: '15px' }}>{scannerStatus.stats.signalsDetected}</div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.8, marginBottom: '4px' }}>Auto-Tracked</div>
                    <div style={{ fontWeight: '700', fontSize: '15px' }}>{scannerStatus.stats.signalsTracked}</div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.8, marginBottom: '4px' }}>Last Scan</div>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>
                      {scannerStatus.stats.lastScanTime
                        ? new Date(scannerStatus.stats.lastScanTime).toLocaleTimeString()
                        : 'N/A'}
                    </div>
                  </div>
                </>
              )}
            </div>
            {scannerStatus.isRunning && scannerStatus.config && (
              <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.9 }}>
                Scanning {scannerStatus.config.symbols.length} symbols on {scannerStatus.config.timeframes.join(', ')} every {scannerStatus.config.scanFrequency / 60000} minutes
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Auto-Track Button */}
      <div className="card">
        <h2 style={{ marginBottom: '10px' }}>Manual Tracking</h2>
        <p style={{ color: '#6b7280', marginBottom: '20px', lineHeight: '1.6' }}>
          Manually track <strong>ENTRY_READY</strong> signals if the continuous scanner is stopped.
        </p>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={handleAutoTrack}
            disabled={autoTracking}
            style={{ fontSize: '15px', padding: '10px 24px' }}
          >
            {autoTracking ? '⏳ Auto-Tracking...' : '🎯 Auto-Track ENTRY_READY Signals'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={loadData}
            style={{ fontSize: '14px', padding: '10px 20px' }}
          >
            🔄 Refresh
          </button>

          {lastAutoTrack && (
            <div style={{
              padding: '8px 12px',
              background: '#d1fae5',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#065f46'
            }}>
              Last auto-track: {lastAutoTrack.time} ({lastAutoTrack.count} signal{lastAutoTrack.count !== 1 ? 's' : ''})
            </div>
          )}
        </div>

        <div style={{
          marginTop: '15px',
          padding: '12px',
          background: '#f3f4f6',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#374151'
        }}>
          <strong>💡 How it works:</strong> Click "Auto-Track" to automatically track all signals that have reached ENTRY_READY state. The system prevents duplicate tracking. Signals refresh every 10 seconds.
        </div>
      </div>

      {/* Validation Statistics */}
      {stats && (
        <div className="card">
          <h3 style={{ marginBottom: '15px' }}>Validation Statistics</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div style={{ padding: '15px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #3b82f6' }}>
              <div style={{ fontSize: '13px', color: '#1e40af', marginBottom: '5px' }}>Total Signals</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e40af' }}>{stats.totalSignals}</div>
            </div>

            <div style={{ padding: '15px', background: '#d1fae5', borderRadius: '8px', border: '1px solid #10b981' }}>
              <div style={{ fontSize: '13px', color: '#065f46', marginBottom: '5px' }}>Tracked</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#065f46' }}>{stats.tracking.tracked}</div>
            </div>

            <div style={{ padding: '15px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #f59e0b' }}>
              <div style={{ fontSize: '13px', color: '#92400e', marginBottom: '5px' }}>Win Rate</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#92400e' }}>
                {stats.tracking.trackedWithOutcome > 0 ? `${stats.tracking.winRate}%` : 'N/A'}
              </div>
              <div style={{ fontSize: '11px', color: '#92400e', marginTop: '3px' }}>
                {stats.tracking.wins}W / {stats.tracking.losses}L
              </div>
            </div>

            <div style={{ padding: '15px', background: '#fce7f3', borderRadius: '8px', border: '1px solid #ec4899' }}>
              <div style={{ fontSize: '13px', color: '#831843', marginBottom: '5px' }}>ENTRY_READY</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#831843' }}>
                {stats.byState?.ENTRY_READY || 0}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '15px', fontSize: '12px', color: '#6b7280' }}>
            <strong>By State:</strong> MONITORING: {stats.byState?.MONITORING || 0} | WAITING: {stats.byState?.WAITING || 0} | ENTRY_READY: {stats.byState?.ENTRY_READY || 0}
          </div>
        </div>
      )}

      {/* Open Trades */}
      {openTrades.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '15px' }}>Open Trades ({openTrades.length})</h3>

          {openTrades.map((signal, idx) => (
            <div
              key={signal.id}
              style={{
                padding: '15px',
                background: idx % 2 === 0 ? '#f9fafb' : 'white',
                borderRadius: '8px',
                marginBottom: '10px',
                border: '1px solid #e5e7eb'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                    {signal.symbol} <span style={{
                      color: signal.signal.direction === 'bullish' ? '#10b981' : '#ef4444',
                      textTransform: 'uppercase'
                    }}>
                      {signal.signal.direction}
                    </span> [{signal.timeframe}]
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Tracked: {new Date(signal.timestamp).toLocaleString()}
                  </div>
                </div>
                <div>
                  {getStatusBadge(signal.progress)}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '10px',
                marginBottom: '12px',
                fontSize: '13px'
              }}>
                <div>
                  <div style={{ color: '#9ca3af', fontSize: '11px' }}>Entry</div>
                  <div style={{ fontWeight: '600' }}>${signal.signal.entry.toFixed(4)}</div>
                </div>
                <div>
                  <div style={{ color: '#9ca3af', fontSize: '11px' }}>Current</div>
                  <div style={{ fontWeight: '600', color: signal.progress?.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                    ${signal.currentPrice?.toFixed(4) || 'Loading...'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#9ca3af', fontSize: '11px' }}>P/L</div>
                  <div style={{ fontWeight: '600', color: signal.progress?.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                    {signal.progress ? `${signal.progress.pnl >= 0 ? '+' : ''}${signal.progress.pnl.toFixed(2)}%` : 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#9ca3af', fontSize: '11px' }}>R Multiple</div>
                  <div style={{ fontWeight: '600' }}>{signal.progress?.rMultiple || 'N/A'}R</div>
                </div>
                <div>
                  <div style={{ color: '#9ca3af', fontSize: '11px' }}>To TP</div>
                  <div style={{ fontWeight: '600' }}>{signal.progress?.percentToTP || 'N/A'}%</div>
                </div>
                <div>
                  <div style={{ color: '#9ca3af', fontSize: '11px' }}>R:R</div>
                  <div style={{ fontWeight: '600' }}>{signal.signal.riskReward.toFixed(2)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => openOutcomeModal(signal)}
                  style={{ fontSize: '13px', padding: '6px 12px' }}
                >
                  Record Outcome
                </button>
                {signal.progress?.status === 'HIT TP' && (
                  <span style={{ fontSize: '12px', color: '#059669', padding: '6px 12px', fontWeight: '600' }}>
                    ✅ Ready to record WIN
                  </span>
                )}
                {signal.progress?.status === 'HIT SL' && (
                  <span style={{ fontSize: '12px', color: '#dc2626', padding: '6px 12px', fontWeight: '600' }}>
                    ❌ Ready to record LOSS
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Closed Trades */}
      {closedTrades.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '15px' }}>Closed Trades ({closedTrades.length})</h3>

          {closedTrades.map((signal, idx) => (
            <div
              key={signal.id}
              style={{
                padding: '12px',
                background: idx % 2 === 0 ? '#f9fafb' : 'white',
                borderRadius: '6px',
                marginBottom: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: '600' }}>{signal.symbol}</span>{' '}
                  <span style={{
                    color: signal.signal.direction === 'bullish' ? '#10b981' : '#ef4444',
                    textTransform: 'uppercase'
                  }}>
                    {signal.signal.direction}
                  </span>{' '}
                  [{signal.timeframe}]
                </div>
                <div>
                  {signal.outcome.result === 'win' && <span className="badge badge-success">🎯 WIN</span>}
                  {signal.outcome.result === 'loss' && <span className="badge badge-danger">❌ LOSS</span>}
                  {signal.outcome.result === 'breakeven' && <span className="badge badge-secondary">⚖️ BE</span>}
                </div>
              </div>
              <div style={{ marginTop: '6px', color: '#6b7280' }}>
                Entry: ${signal.signal.entry.toFixed(4)} → Exit: ${signal.outcome.exitPrice} |
                P/L: <span style={{ color: signal.outcome.profitLoss >= 0 ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                  {signal.outcome.profitLoss >= 0 ? '+' : ''}{signal.outcome.profitLoss}%
                </span> |
                R:R: {signal.outcome.riskRewardAchieved}
              </div>
              {signal.outcome.notes && (
                <div style={{ marginTop: '4px', fontSize: '12px', fontStyle: 'italic', color: '#9ca3af' }}>
                  Note: {signal.outcome.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No Signals */}
      {trackedSignals.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>📊</div>
          <h3 style={{ marginBottom: '10px' }}>No Tracked Signals Yet</h3>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>
            Click "Auto-Track ENTRY_READY Signals" to start tracking signals automatically.
          </p>
        </div>
      )}

      {/* Record Outcome Modal */}
      {showOutcomeModal && selectedSignal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: '20px' }}>Record Trade Outcome</h3>

            <div style={{ marginBottom: '15px', padding: '12px', background: '#f3f4f6', borderRadius: '6px' }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                {selectedSignal.symbol} {selectedSignal.signal.direction.toUpperCase()} [{selectedSignal.timeframe}]
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                Entry: ${selectedSignal.signal.entry.toFixed(4)} | SL: ${selectedSignal.signal.stopLoss.toFixed(4)} | TP: ${selectedSignal.signal.takeProfit.toFixed(4)}
              </div>
              {selectedSignal.currentPrice && (
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                  Current: ${selectedSignal.currentPrice.toFixed(4)} ({selectedSignal.progress?.pnl >= 0 ? '+' : ''}{selectedSignal.progress?.pnl.toFixed(2)}%)
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Outcome *</label>
              <select
                className="form-input"
                value={outcomeForm.result}
                onChange={(e) => setOutcomeForm({ ...outcomeForm, result: e.target.value })}
              >
                <option value="win">Win (Hit TP or closed in profit)</option>
                <option value="loss">Loss (Hit SL or closed at loss)</option>
                <option value="breakeven">Breakeven (No gain/loss)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Exit Price *</label>
              <input
                type="number"
                className="form-input"
                step="any"
                value={outcomeForm.exitPrice}
                onChange={(e) => setOutcomeForm({ ...outcomeForm, exitPrice: e.target.value })}
                placeholder="Enter exit price"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea
                className="form-input"
                rows="3"
                value={outcomeForm.notes}
                onChange={(e) => setOutcomeForm({ ...outcomeForm, notes: e.target.value })}
                placeholder="Any notes about this trade?"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                className="btn btn-primary"
                onClick={handleSubmitOutcome}
                style={{ flex: 1 }}
              >
                Record Outcome
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowOutcomeModal(false);
                  setSelectedSignal(null);
                }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AutoTracker;
