import React, { useState, useEffect } from 'react';
import notificationService from './services/notificationService';
import SignalDetailsModal from './components/SignalDetailsModal';

function TrackedSignals() {
  const [signals, setSignals] = useState([]);
  const [prices, setPrices] = useState({});
  const [statistics, setStatistics] = useState(null);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load signals on mount and set up refresh interval
  useEffect(() => {
    loadSignals();

    // Refresh every 10 seconds to show current prices
    const interval = setInterval(() => {
      loadSignals();
      updatePrices();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadSignals = () => {
    const trackedSignals = notificationService.getTrackedSignals();
    const stats = notificationService.getStatistics();
    setSignals(trackedSignals);
    setStatistics(stats);
  };

  const updatePrices = async () => {
    const trackedSignals = notificationService.getTrackedSignals();

    for (const signal of trackedSignals) {
      try {
        const currentPrice = await notificationService.getCurrentPrice(signal.symbol);
        if (currentPrice) {
          setPrices(prev => ({
            ...prev,
            [signal.symbol]: currentPrice
          }));
        }
      } catch (error) {
        console.error(`Error fetching price for ${signal.symbol}:`, error);
      }
    }
  };

  const handleStopTracking = (signal) => {
    const signalId = `${signal.symbol}_${signal.timeframe}_${signal.entry}`;
    if (confirm(`Stop tracking ${signal.symbol} ${signal.direction}?`)) {
      notificationService.stopTracking(signalId);
      loadSignals();
    }
  };

  const getDistanceToEntry = (signal) => {
    const currentPrice = prices[signal.symbol];
    if (!currentPrice) return null;

    const entryPrice = parseFloat(signal.entry);
    const stopLoss = parseFloat(signal.stopLoss);
    const takeProfit = parseFloat(signal.takeProfit);

    // Check if entry was already hit (signal has been notified/entered)
    const entryHit = signal.notified || signal.enteredAt;

    if (entryHit) {
      // Entry already hit - calculate P&L
      let pnlPercent;

      if (signal.direction === 'bullish') {
        pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      } else {
        pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
      }

      return {
        percent: Math.abs((currentPrice - entryPrice) / entryPrice) * 100,
        isReady: false,
        isApproaching: false,
        entryHit: true,
        pnlPercent: pnlPercent,
        inProfit: pnlPercent > 0.1,
        inLoss: pnlPercent < -0.1,
        atBreakeven: Math.abs(pnlPercent) <= 0.1
      };
    } else {
      // Entry not yet hit - show distance to entry
      const distancePercent = Math.abs((currentPrice - entryPrice) / entryPrice) * 100;

      return {
        percent: distancePercent,
        isReady: distancePercent <= 0.5,
        isApproaching: distancePercent <= 1.5,
        entryHit: false
      };
    }
  };

  const getStatusBadge = (signal, distance) => {
    if (!distance) {
      return <span className="badge badge-secondary">Loading...</span>;
    }

    // If entry was hit, show P&L status
    if (distance.entryHit) {
      if (distance.inProfit) {
        return (
          <span className="badge badge-success" title={`In profit: +${distance.pnlPercent.toFixed(2)}%`}>
            💰 IN PROFIT +{distance.pnlPercent.toFixed(2)}%
          </span>
        );
      } else if (distance.inLoss) {
        return (
          <span className="badge badge-danger" title={`In loss: ${distance.pnlPercent.toFixed(2)}%`}>
            📉 IN LOSS {distance.pnlPercent.toFixed(2)}%
          </span>
        );
      } else {
        return (
          <span className="badge badge-warning" title="At breakeven">
            ⚖️ AT ENTRY
          </span>
        );
      }
    }

    // Entry not yet hit - show distance
    if (distance.isReady) {
      return <span className="badge badge-success">🎯 ENTRY READY!</span>;
    } else if (distance.isApproaching) {
      return <span className="badge badge-warning">⚡ Approaching</span>;
    } else {
      return <span className="badge badge-secondary">📊 {distance.percent.toFixed(2)}% away</span>;
    }
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
      {/* Statistics Summary */}
      {statistics && (statistics.completedSignals > 0 || statistics.activeSignals > 0) && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1f2937', fontSize: '20px' }}>
            📊 Performance Summary
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px'
          }}>
            {/* Total Tracked */}
            <div style={{
              padding: '16px',
              background: '#f0f9ff',
              borderRadius: '8px',
              borderLeft: '4px solid #3b82f6'
            }}>
              <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: '600', marginBottom: '4px' }}>
                Total Tracked
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
                {statistics.totalTracked}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                {statistics.activeSignals} active • {statistics.completedSignals} completed
              </div>
            </div>

            {/* Win Rate */}
            <div style={{
              padding: '16px',
              background: statistics.winRate >= 50 ? '#f0fdf4' : '#fef2f2',
              borderRadius: '8px',
              borderLeft: `4px solid ${statistics.winRate >= 50 ? '#10b981' : '#ef4444'}`
            }}>
              <div style={{ fontSize: '12px', color: statistics.winRate >= 50 ? '#065f46' : '#991b1b', fontWeight: '600', marginBottom: '4px' }}>
                Win Rate
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
                {statistics.winRate.toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                {statistics.wins}W / {statistics.losses}L
              </div>
            </div>

            {/* Total P&L */}
            <div style={{
              padding: '16px',
              background: statistics.totalProfitLoss >= 0 ? '#f0fdf4' : '#fef2f2',
              borderRadius: '8px',
              borderLeft: `4px solid ${statistics.totalProfitLoss >= 0 ? '#10b981' : '#ef4444'}`
            }}>
              <div style={{ fontSize: '12px', color: statistics.totalProfitLoss >= 0 ? '#065f46' : '#991b1b', fontWeight: '600', marginBottom: '4px' }}>
                Total P&L
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: statistics.totalProfitLoss >= 0 ? '#10b981' : '#ef4444' }}>
                {statistics.totalProfitLoss >= 0 ? '+' : ''}{statistics.totalProfitLoss.toFixed(2)}%
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                Avg: {statistics.avgProfitLoss >= 0 ? '+' : ''}{statistics.avgProfitLoss.toFixed(2)}%
              </div>
            </div>

            {/* Best Trade */}
            <div style={{
              padding: '16px',
              background: '#f0fdf4',
              borderRadius: '8px',
              borderLeft: '4px solid #10b981'
            }}>
              <div style={{ fontSize: '12px', color: '#065f46', fontWeight: '600', marginBottom: '4px' }}>
                Best Trade
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>
                +{statistics.bestTrade.toFixed(2)}%
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                Highest profit
              </div>
            </div>

            {/* Worst Trade */}
            <div style={{
              padding: '16px',
              background: '#fef2f2',
              borderRadius: '8px',
              borderLeft: '4px solid #ef4444'
            }}>
              <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: '600', marginBottom: '4px' }}>
                Worst Trade
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>
                {statistics.worstTrade.toFixed(2)}%
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                Largest loss
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="card">
        <h2 style={{ marginBottom: '10px', color: '#1f2937' }}>
          Active Signals ({signals.length})
        </h2>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
          Real-time monitoring of your tracked signals. You'll receive notifications when price approaches entry.
        </p>
      </div>

      {/* Signals Table */}
      <div className="card">
        {signals.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <h3 style={{ marginBottom: '8px', color: '#374151' }}>No Tracked Signals</h3>
            <p style={{ fontSize: '14px', marginBottom: '0' }}>
              Go to <strong>Signal Tracker</strong> tab and click <strong>Track</strong> on any signal to start monitoring.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Direction</th>
                  <th>Entry</th>
                  <th>Current Price</th>
                  <th>Distance / P&L</th>
                  <th>Status</th>
                  <th>Stop Loss</th>
                  <th>Take Profit</th>
                  <th>R:R</th>
                  <th>Tracked Since</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal, index) => {
                  const distance = getDistanceToEntry(signal);
                  const currentPrice = prices[signal.symbol];

                  return (
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
                      <td>
                        <span className={`badge ${signal.direction === 'bullish' ? 'badge-success' : 'badge-danger'}`}>
                          {signal.direction.toUpperCase()}
                        </span>
                      </td>
                      <td>{signal.entry}</td>
                      <td>
                        {currentPrice ? (
                          <span style={{ fontFamily: 'monospace' }}>
                            {currentPrice.toFixed(8)}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>Loading...</span>
                        )}
                      </td>
                      <td>
                        {distance ? (
                          distance.entryHit ? (
                            // Entry hit - show P&L
                            <span style={{
                              fontWeight: '600',
                              color: distance.inProfit ? '#10b981' : distance.inLoss ? '#ef4444' : '#f59e0b'
                            }}>
                              {distance.pnlPercent >= 0 ? '+' : ''}{distance.pnlPercent.toFixed(2)}%
                            </span>
                          ) : (
                            // Entry not hit - show distance
                            <span style={{
                              fontWeight: '600',
                              color: distance.isReady ? '#10b981' : distance.isApproaching ? '#f59e0b' : '#6b7280'
                            }}>
                              {distance.percent.toFixed(2)}%
                            </span>
                          )
                        ) : (
                          <span style={{ color: '#9ca3af' }}>-</span>
                        )}
                      </td>
                      <td>{getStatusBadge(signal, distance)}</td>
                      <td>{signal.stopLoss}</td>
                      <td>{signal.takeProfit}</td>
                      <td>{signal.riskReward}</td>
                      <td style={{ fontSize: '12px', color: '#6b7280' }}>
                        {new Date(signal.trackedAt).toLocaleString()}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-danger"
                          style={{
                            fontSize: '11px',
                            padding: '4px 8px'
                          }}
                          onClick={() => handleStopTracking(signal)}
                        >
                          Stop
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Card */}
      {signals.length > 0 && (
        <div className="card" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
          <div style={{ fontSize: '14px', color: '#166534' }}>
            <strong>ℹ️ How it works:</strong>
            <ul style={{ marginTop: '8px', marginBottom: '0', paddingLeft: '20px' }}>
              <li>Prices update automatically every 10 seconds</li>
              <li>You'll get a notification when price is within 0.5% of entry</li>
              <li><strong>Before entry:</strong> Distance column shows % away from entry</li>
              <li><strong>After entry:</strong> Distance column shows current P&L %</li>
              <li>Status changes to show profit/loss once entry is hit</li>
              <li>Signals auto-expire after 24 hours or when TP/SL is hit</li>
              <li>Click <strong>symbol</strong> to view on TradingView</li>
              <li>Click <strong>row</strong> to see full signal details</li>
              <li>Click <strong>Stop</strong> to remove a signal from tracking</li>
            </ul>
          </div>
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

export default TrackedSignals;
