import React, { useState, useEffect } from 'react';
import { trackingService } from './services/signalTrackingService';
import { wsManager } from './services/binanceWebSocket';

function TrackedSignals() {
  const [signals, setSignals] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [filter, setFilter] = useState('ALL'); // ALL, IN_PROGRESS, TP_HIT, SL_HIT, INVALIDATED, MISSED
  const [subscriptions, setSubscriptions] = useState(new Map());

  // Load signals on mount
  useEffect(() => {
    loadSignals();

    // Listen for localStorage changes (multi-tab support)
    const handleStorageChange = (e) => {
      if (e.key === 'trackedSignals') {
        loadSignals();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      // Unsubscribe from all WebSockets
      subscriptions.forEach((unsub) => unsub());
    };
  }, []);

  // Subscribe to WebSocket updates for active signals
  useEffect(() => {
    const activeSignals = signals.filter(s => s.status === 'IN_PROGRESS');
    const activeSymbols = new Set(activeSignals.map(s => s.symbol));

    // Subscribe to new symbols
    activeSignals.forEach(signal => {
      if (!subscriptions.has(signal.symbol)) {
        const unsub = wsManager.subscribe(signal.symbol, (update) => {
          handlePriceUpdate(signal.id, update.price);
        });
        setSubscriptions(prev => new Map(prev).set(signal.symbol, unsub));
      }
    });

    // Unsubscribe from removed symbols
    subscriptions.forEach((unsub, symbol) => {
      if (!activeSymbols.has(symbol)) {
        unsub();
        setSubscriptions(prev => {
          const newMap = new Map(prev);
          newMap.delete(symbol);
          return newMap;
        });
      }
    });
  }, [signals]);

  const loadSignals = () => {
    const allSignals = trackingService.getAllSignals();
    setSignals(allSignals);
    setStatistics(trackingService.getStatistics());
  };

  const handlePriceUpdate = (signalId, currentPrice) => {
    trackingService.updateSignalPrice(signalId, currentPrice);
    loadSignals(); // Refresh UI
  };

  const handleUntrack = (id) => {
    if (confirm('Remove this signal from tracking?')) {
      trackingService.untrackSignal(id);
      loadSignals();
    }
  };

  const handleCleanup = () => {
    if (confirm('Remove all completed signals older than 7 days?')) {
      const removed = trackingService.cleanup();
      loadSignals();
      alert(`Removed ${removed} old signals`);
    }
  };

  const filteredSignals = filter === 'ALL'
    ? signals
    : signals.filter(s => s.status === filter);

  return (
    <div>
      {/* Statistics Card */}
      <div className="card">
        <h2>Performance Statistics</h2>
        {statistics && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px',
            marginTop: '16px'
          }}>
            <StatBox label="Total Tracked" value={statistics.totalTracked} />
            <StatBox
              label="Win Rate"
              value={`${statistics.winRate.toFixed(1)}%`}
              color={statistics.winRate >= 50 ? 'green' : 'red'}
            />
            <StatBox
              label="Avg P&L"
              value={`${statistics.avgProfitLoss >= 0 ? '+' : ''}${statistics.avgProfitLoss.toFixed(2)}%`}
              color={statistics.avgProfitLoss >= 0 ? 'green' : 'red'}
            />
            <StatBox label="Wins" value={statistics.wins} color="green" />
            <StatBox label="Losses" value={statistics.losses} color="red" />
            <StatBox label="Invalidated" value={statistics.invalidated} />
            <StatBox label="Missed" value={statistics.missed} />
          </div>
        )}
      </div>

      {/* Filter & Actions */}
      <div className="card">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <FilterButton label="All" value="ALL" current={filter} onClick={setFilter} />
            <FilterButton label="In Progress" value="IN_PROGRESS" current={filter} onClick={setFilter} />
            <FilterButton label="TP Hit" value="TP_HIT" current={filter} onClick={setFilter} />
            <FilterButton label="SL Hit" value="SL_HIT" current={filter} onClick={setFilter} />
            <FilterButton label="Invalidated" value="INVALIDATED" current={filter} onClick={setFilter} />
            <FilterButton label="Missed" value="MISSED" current={filter} onClick={setFilter} />
          </div>
          <button className="btn btn-secondary" onClick={handleCleanup}>
            Cleanup Old Signals
          </button>
        </div>
      </div>

      {/* Signals Table */}
      <div className="card">
        <h3>Tracked Signals ({filteredSignals.length})</h3>
        {filteredSignals.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#6b7280',
            fontSize: '14px'
          }}>
            {filter === 'ALL' ? (
              <>
                No signals to display. Start tracking signals from the <strong>Signal Tracker</strong> tab.
              </>
            ) : (
              <>
                No signals with status: <strong>{filter}</strong>
              </>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Timeframe</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Entry</th>
                  <th>Current Price</th>
                  <th>Stop Loss</th>
                  <th>Take Profit</th>
                  <th>P&L</th>
                  <th>Failure Reason</th>
                  <th>Tracked Since</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSignals.map(signal => (
                  <SignalRow
                    key={signal.id}
                    signal={signal}
                    onUntrack={handleUntrack}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components

function StatBox({ label, value, color }) {
  const colorMap = {
    green: '#10b981',
    red: '#ef4444',
    default: '#667eea'
  };

  return (
    <div style={{
      padding: '16px',
      background: '#f9fafb',
      borderRadius: '8px',
      textAlign: 'center',
      borderLeft: `4px solid ${colorMap[color] || colorMap.default}`
    }}>
      <div style={{
        fontSize: '12px',
        color: '#6b7280',
        marginBottom: '4px',
        fontWeight: '500'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#1f2937'
      }}>
        {value}
      </div>
    </div>
  );
}

function FilterButton({ label, value, current, onClick }) {
  const isActive = current === value;
  return (
    <button
      className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
      onClick={() => onClick(value)}
      style={{
        fontSize: '12px',
        padding: '6px 12px'
      }}
    >
      {label}
    </button>
  );
}

const SignalRow = React.memo(({ signal, onUntrack }) => {
  const getStatusBadge = (status) => {
    const statusConfig = {
      'IN_PROGRESS': { class: 'badge-warning', text: 'IN PROGRESS', icon: '⏳' },
      'TP_HIT': { class: 'badge-success', text: 'TP HIT', icon: '✓' },
      'SL_HIT': { class: 'badge-danger', text: 'SL HIT', icon: '✗' },
      'INVALIDATED': { class: 'badge-secondary', text: 'INVALIDATED', icon: '⚠' },
      'MISSED': { class: 'badge-warning', text: 'MISSED', icon: '⊘' }
    };

    const config = statusConfig[status] || { class: '', text: status, icon: '' };
    return (
      <span className={`badge ${config.class}`}>
        {config.icon} {config.text}
      </span>
    );
  };

  const getPLDisplay = (signal) => {
    // For active signals, show unrealized P&L
    if (signal.status === 'IN_PROGRESS' && signal.currentPrice) {
      let unrealizedPL;
      const entry = parseFloat(signal.entry);
      const currentPrice = parseFloat(signal.currentPrice);

      if (signal.type === 'BUY') {
        unrealizedPL = ((currentPrice - entry) / entry) * 100;
      } else {
        unrealizedPL = ((entry - currentPrice) / entry) * 100;
      }

      const color = unrealizedPL >= 0 ? '#10b981' : '#ef4444';
      const arrow = unrealizedPL >= 0 ? '↑' : '↓';

      return (
        <span style={{ color, fontWeight: 'bold' }}>
          {unrealizedPL >= 0 ? '+' : ''}{unrealizedPL.toFixed(2)}% {arrow}
        </span>
      );
    }

    // For completed signals, show realized P&L
    if (signal.profitLoss !== null) {
      const color = signal.profitLoss >= 0 ? '#10b981' : '#ef4444';
      return (
        <span style={{ color, fontWeight: 'bold' }}>
          {signal.profitLoss >= 0 ? '+' : ''}{signal.profitLoss.toFixed(2)}%
        </span>
      );
    }

    return <span style={{ color: '#6b7280' }}>-</span>;
  };

  const getCurrentPriceDisplay = (signal) => {
    if (signal.status === 'IN_PROGRESS' && signal.currentPrice) {
      return parseFloat(signal.currentPrice).toFixed(8);
    }
    if (signal.exitPrice) {
      return parseFloat(signal.exitPrice).toFixed(8);
    }
    return '-';
  };

  return (
    <tr>
      <td style={{ fontWeight: '600' }}>{signal.symbol}</td>
      <td>{signal.timeframe}</td>
      <td>
        <span className={`badge ${signal.type === 'BUY' ? 'badge-success' : 'badge-danger'}`}>
          {signal.type}
        </span>
      </td>
      <td>{getStatusBadge(signal.status)}</td>
      <td>{signal.entry}</td>
      <td>{getCurrentPriceDisplay(signal)}</td>
      <td>{signal.stopLoss}</td>
      <td>{signal.takeProfit}</td>
      <td>{getPLDisplay(signal)}</td>
      <td style={{
        fontSize: '12px',
        maxWidth: '250px',
        whiteSpace: 'normal',
        color: '#6b7280'
      }}>
        {signal.failureReason || '-'}
      </td>
      <td style={{ fontSize: '12px' }}>
        {new Date(signal.trackedAt).toLocaleString()}
      </td>
      <td>
        <button
          className="btn btn-danger"
          style={{
            fontSize: '11px',
            padding: '4px 8px'
          }}
          onClick={() => onUntrack(signal.id)}
        >
          Remove
        </button>
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  // Only re-render if signal data changed
  return prevProps.signal.lastUpdate === nextProps.signal.lastUpdate &&
         prevProps.signal.status === nextProps.signal.status;
});

export default TrackedSignals;
