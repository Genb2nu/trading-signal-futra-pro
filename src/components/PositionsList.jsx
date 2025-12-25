import React from 'react';

/**
 * Positions List Component
 * Displays active positions (PENDING + OPEN) with real-time P&L
 */
function PositionsList({ positions, onManualClose }) {
  if (!positions || positions.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>Active Positions</h3>
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#6b7280',
          background: '#f9fafb',
          borderRadius: '8px'
        }}>
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>No active positions</p>
          <p style={{ fontSize: '14px' }}>Positions will appear here when signals are detected and orders are placed</p>
        </div>
      </div>
    );
  }

  const getTradingViewInterval = (timeframe) => {
    const intervals = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '1h': '60',
      '4h': '240',
      '1d': 'D',
      '1w': 'W',
      '1M': 'M'
    };
    return intervals[timeframe] || '60';
  };

  const openTradingView = (symbol, timeframe) => {
    const interval = getTradingViewInterval(timeframe);
    const url = `https://www.tradingview.com/chart/?symbol=BINANCE:${symbol}&interval=${interval}`;
    window.open(url, '_blank');
  };

  const formatDuration = (timestamp) => {
    if (!timestamp) return '-';

    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <div className="card">
      <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>
        Active Positions ({positions.length})
      </h3>

      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', minWidth: '1000px' }}>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Direction</th>
              <th>Status</th>
              <th>Entry</th>
              <th>Current</th>
              <th>P&L</th>
              <th>Stop Loss</th>
              <th>Take Profit</th>
              <th>Size</th>
              <th>Duration</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const isPending = position.status === 'PENDING';
              const pnl = position.floatingPnL || 0;
              const pnlPercent = position.floatingPnLPercent || 0;

              // Row background color
              let rowBg = 'white';
              if (isPending) rowBg = '#f9fafb';
              else if (pnl > 0) rowBg = '#d1fae5';
              else if (pnl < 0) rowBg = '#fee2e2';

              return (
                <tr
                  key={position.id}
                  style={{
                    background: rowBg,
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    // Could open details modal here
                  }}
                >
                  {/* Symbol */}
                  <td>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openTradingView(position.symbol, position.timeframe);
                      }}
                      style={{
                        color: '#667eea',
                        textDecoration: 'none',
                        fontWeight: '600',
                        borderBottom: '1px dashed #667eea'
                      }}
                    >
                      {position.symbol}
                    </a>
                  </td>

                  {/* Direction */}
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: position.direction === 'BUY' ? '#d1fae5' : '#fee2e2',
                      color: position.direction === 'BUY' ? '#059669' : '#dc2626'
                    }}>
                      {position.direction}
                    </span>
                  </td>

                  {/* Status */}
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: isPending ? '#fef3c7' : '#dbeafe',
                      color: isPending ? '#d97706' : '#1e40af'
                    }}>
                      {position.status}
                    </span>
                  </td>

                  {/* Entry */}
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                    {position.entryPrice.toFixed(8)}
                  </td>

                  {/* Current Price */}
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                    {position.currentPrice ? position.currentPrice.toFixed(8) : '-'}
                  </td>

                  {/* P&L */}
                  <td>
                    {isPending ? (
                      <span style={{ color: '#6b7280' }}>-</span>
                    ) : (
                      <div>
                        <div style={{
                          fontWeight: '600',
                          color: pnl > 0 ? '#059669' : pnl < 0 ? '#dc2626' : '#6b7280'
                        }}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: pnl > 0 ? '#059669' : pnl < 0 ? '#dc2626' : '#6b7280'
                        }}>
                          {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Stop Loss */}
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                    {position.stopLoss.toFixed(8)}
                  </td>

                  {/* Take Profit */}
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                    {position.takeProfit.toFixed(8)}
                  </td>

                  {/* Size */}
                  <td>
                    <div style={{ fontSize: '13px' }}>
                      {position.positionSize.toFixed(8)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      ${position.positionValue.toFixed(2)}
                    </div>
                  </td>

                  {/* Duration */}
                  <td style={{ fontSize: '13px', color: '#6b7280' }}>
                    {formatDuration(isPending ? position.orderPlacedAt : position.entryTime)}
                  </td>

                  {/* Actions */}
                  <td>
                    {!isPending && onManualClose && (
                      <button
                        className="btn btn-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          onManualClose(position.id);
                        }}
                        style={{
                          fontSize: '12px',
                          padding: '4px 8px'
                        }}
                      >
                        Close
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Info */}
      <div style={{
        marginTop: '15px',
        padding: '12px',
        background: '#f9fafb',
        borderRadius: '6px',
        fontSize: '13px',
        color: '#6b7280'
      }}>
        <strong>Tip:</strong> Click symbol to view chart on TradingView. Click "Close" to manually exit a position.
      </div>
    </div>
  );
}

export default PositionsList;
