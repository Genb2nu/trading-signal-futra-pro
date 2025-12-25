import React from 'react';

/**
 * Trading Dashboard Component
 * Displays real-time account metrics and performance statistics
 */
function TradingDashboard({ account, positions, stats }) {
  if (!account || !stats) {
    return (
      <div className="card">
        <div className="loading">
          <div className="spinner"></div>
          <p style={{ marginTop: '20px', color: '#6b7280' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const floatingPnL = positions?.floatingPnL || 0;
  const openPositions = positions?.openPositions || 0;
  const pendingOrders = positions?.pendingOrders || 0;

  return (
    <div className="card">
      <h3 style={{ marginBottom: '20px', color: '#1f2937' }}>Paper Trading Dashboard</h3>

      {/* Main Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '20px'
      }}>
        {/* Balance */}
        <div style={{
          padding: '15px',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Balance</div>
          <div style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
            ${account.balance.toFixed(2)}
          </div>
        </div>

        {/* Equity */}
        <div style={{
          padding: '15px',
          background: account.equity > account.balance ? '#d1fae5' : account.equity < account.balance ? '#fee2e2' : '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Equity</div>
          <div style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
            ${account.equity.toFixed(2)}
          </div>
        </div>

        {/* Floating P&L */}
        <div style={{
          padding: '15px',
          background: floatingPnL > 0 ? '#d1fae5' : floatingPnL < 0 ? '#fee2e2' : '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Floating P&L</div>
          <div style={{
            fontSize: '24px',
            fontWeight: '600',
            color: floatingPnL > 0 ? '#059669' : floatingPnL < 0 ? '#dc2626' : '#6b7280'
          }}>
            {floatingPnL >= 0 ? '+' : ''}${floatingPnL.toFixed(2)}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
            {floatingPnL >= 0 ? '+' : ''}{((floatingPnL / account.balance) * 100).toFixed(2)}%
          </div>
        </div>

        {/* Open Positions */}
        <div style={{
          padding: '15px',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Positions</div>
          <div style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
            {openPositions} / {account.maxConcurrentTrades}
          </div>
          {pendingOrders > 0 && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              {pendingOrders} pending
            </div>
          )}
        </div>
      </div>

      {/* Performance Statistics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '15px'
      }}>
        {/* Total Trades */}
        <div style={{
          padding: '12px',
          background: 'white',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Total Trades</div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
            {stats.totalTrades}
          </div>
        </div>

        {/* Win Rate */}
        <div style={{
          padding: '12px',
          background: stats.winRate >= 60 ? '#d1fae5' : stats.winRate >= 50 ? '#fef3c7' : '#fee2e2',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Win Rate</div>
          <div style={{
            fontSize: '20px',
            fontWeight: '600',
            color: stats.winRate >= 60 ? '#059669' : stats.winRate >= 50 ? '#d97706' : '#dc2626'
          }}>
            {stats.winRate.toFixed(1)}%
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
            {stats.wins}W / {stats.losses}L
          </div>
        </div>

        {/* Total P&L */}
        <div style={{
          padding: '12px',
          background: account.totalPnL > 0 ? '#d1fae5' : account.totalPnL < 0 ? '#fee2e2' : 'white',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Total P&L</div>
          <div style={{
            fontSize: '20px',
            fontWeight: '600',
            color: account.totalPnL > 0 ? '#059669' : account.totalPnL < 0 ? '#dc2626' : '#6b7280'
          }}>
            {account.totalPnL >= 0 ? '+' : ''}${account.totalPnL.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
            {account.totalPnLPercent >= 0 ? '+' : ''}{account.totalPnLPercent.toFixed(2)}%
          </div>
        </div>

        {/* Profit Factor */}
        <div style={{
          padding: '12px',
          background: stats.profitFactor >= 2 ? '#d1fae5' : stats.profitFactor >= 1 ? '#fef3c7' : '#fee2e2',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Profit Factor</div>
          <div style={{
            fontSize: '20px',
            fontWeight: '600',
            color: stats.profitFactor >= 2 ? '#059669' : stats.profitFactor >= 1 ? '#d97706' : '#dc2626'
          }}>
            {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
          </div>
        </div>

        {/* Expectancy */}
        <div style={{
          padding: '12px',
          background: stats.expectancy > 0 ? '#d1fae5' : '#fee2e2',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Expectancy</div>
          <div style={{
            fontSize: '20px',
            fontWeight: '600',
            color: stats.expectancy > 0 ? '#059669' : '#dc2626'
          }}>
            {stats.expectancy >= 0 ? '+' : ''}${stats.expectancy.toFixed(2)}
          </div>
        </div>

        {/* Max Drawdown */}
        <div style={{
          padding: '12px',
          background: account.maxDrawdownPercent > 10 ? '#fee2e2' : '#f9fafb',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Max Drawdown</div>
          <div style={{
            fontSize: '20px',
            fontWeight: '600',
            color: account.maxDrawdownPercent > 10 ? '#dc2626' : '#6b7280'
          }}>
            -{account.maxDrawdownPercent.toFixed(2)}%
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
            ${account.maxDrawdown.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TradingDashboard;
