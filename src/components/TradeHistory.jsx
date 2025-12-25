import React from 'react';

/**
 * Trade History Component
 * Displays completed trades with performance metrics
 */
function TradeHistory({ trades, onExport }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>Trade History</h3>
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#6b7280',
          background: '#f9fafb',
          borderRadius: '8px'
        }}>
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>No completed trades yet</p>
          <p style={{ fontSize: '14px' }}>Trade history will appear here after positions are closed</p>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '-';

    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const getExitReasonBadge = (reason) => {
    const styles = {
      'TP_HIT': { bg: '#d1fae5', color: '#059669', label: 'TP HIT' },
      'SL_HIT': { bg: '#fee2e2', color: '#dc2626', label: 'SL HIT' },
      'INVALIDATED': { bg: '#fef3c7', color: '#d97706', label: 'INVALID' },
      'TIMEOUT': { bg: '#e0e7ff', color: '#4f46e5', label: 'TIMEOUT' },
      'MANUAL': { bg: '#f3f4f6', color: '#6b7280', label: 'MANUAL' }
    };

    const style = styles[reason] || styles['MANUAL'];

    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: '600',
        background: style.bg,
        color: style.color
      }}>
        {style.label}
      </span>
    );
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ color: '#1f2937', margin: 0 }}>
          Recent Trades ({trades.length})
        </h3>
        {onExport && (
          <button
            className="btn btn-secondary"
            onClick={onExport}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            Export to JSON
          </button>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', minWidth: '1000px' }}>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Direction</th>
              <th>Entry → Exit</th>
              <th>Exit Reason</th>
              <th>P&L</th>
              <th>R-Multiple</th>
              <th>Confluence</th>
              <th>Duration</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => {
              const isWin = trade.realizedPnL > 0;

              return (
                <tr
                  key={trade.id}
                  style={{
                    background: isWin ? '#d1fae5' : '#fee2e2'
                  }}
                >
                  {/* Symbol */}
                  <td style={{ fontWeight: '600' }}>
                    {trade.symbol}
                    <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>
                      {trade.timeframe}
                    </div>
                  </td>

                  {/* Direction */}
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: trade.direction === 'BUY' ? '#dbeafe' : '#fce7f3',
                      color: trade.direction === 'BUY' ? '#1e40af' : '#be123c'
                    }}>
                      {trade.direction}
                    </span>
                  </td>

                  {/* Entry → Exit */}
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    <div>{trade.entryPrice.toFixed(8)}</div>
                    <div style={{ color: '#6b7280' }}>↓</div>
                    <div>{trade.exitPrice.toFixed(8)}</div>
                  </td>

                  {/* Exit Reason */}
                  <td>
                    {getExitReasonBadge(trade.exitReason)}
                  </td>

                  {/* P&L */}
                  <td>
                    <div style={{
                      fontWeight: '600',
                      fontSize: '14px',
                      color: isWin ? '#059669' : '#dc2626'
                    }}>
                      {trade.realizedPnL >= 0 ? '+' : ''}${trade.realizedPnL.toFixed(2)}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: isWin ? '#059669' : '#dc2626'
                    }}>
                      {trade.realizedPnLPercent >= 0 ? '+' : ''}{trade.realizedPnLPercent.toFixed(2)}%
                    </div>
                  </td>

                  {/* R-Multiple */}
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: trade.rMultiple > 0 ? '#d1fae5' : '#fee2e2',
                      color: trade.rMultiple > 0 ? '#059669' : '#dc2626'
                    }}>
                      {trade.rMultiple >= 0 ? '+' : ''}{trade.rMultiple.toFixed(2)}R
                    </span>
                  </td>

                  {/* Confluence */}
                  <td>
                    <div style={{ fontSize: '13px', fontWeight: '500' }}>
                      {trade.confluence}/100
                    </div>
                    {trade.patterns && trade.patterns.length > 0 && (
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                        {trade.patterns.slice(0, 2).join(', ')}
                      </div>
                    )}
                  </td>

                  {/* Duration */}
                  <td style={{ fontSize: '13px', color: '#6b7280' }}>
                    {formatDuration(trade.duration)}
                  </td>

                  {/* Date */}
                  <td style={{ fontSize: '12px', color: '#6b7280' }}>
                    {formatDate(trade.exitTime)}
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
        <strong>Legend:</strong> Green rows = winning trades, Red rows = losing trades. R-Multiple shows actual profit vs risk.
      </div>
    </div>
  );
}

export default TradeHistory;
