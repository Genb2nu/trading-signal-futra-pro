/**
 * Backtest Metrics Cards Component
 * Displays key performance metrics in a grid of cards
 */

import { useMemo } from 'react';

/**
 * Single metric card component
 */
function MetricCard({ title, value, subtitle, color = 'blue', icon }) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    yellow: 'bg-yellow-50 border-yellow-200'
  };

  const textColorClasses = {
    green: 'text-green-700',
    red: 'text-red-700',
    blue: 'text-blue-700',
    purple: 'text-purple-700',
    yellow: 'text-yellow-700'
  };

  return (
    <div
      className={`${colorClasses[color]} border rounded-lg p-4`}
      style={{ minWidth: '140px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>
          {title}
        </span>
        {icon && <span style={{ fontSize: '1.25rem' }}>{icon}</span>}
      </div>
      <div className={textColorClasses[color]} style={{ fontSize: '1.875rem', fontWeight: 700, lineHeight: 1 }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

/**
 * Main metrics cards component
 */
export default function BacktestMetricsCards({ metrics, trades = [] }) {
  // Calculate derived metrics
  const derived = useMemo(() => {
    if (!metrics) {
      return {
        totalTrades: 0,
        winRate: 0,
        profitFactor: 0,
        avgProfit: 0,
        maxDrawdown: 0,
        wins: 0,
        losses: 0
      };
    }

    const totalTrades = metrics.totalTrades || trades.length || 0;
    const wins = metrics.winningTrades || metrics.wins || trades.filter(t => t.pnlR > 0).length;
    const losses = metrics.losingTrades || metrics.losses || trades.filter(t => t.pnlR < 0).length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    return {
      totalTrades,
      winRate,
      profitFactor: metrics.profitFactor || 0,
      avgProfit: metrics.avgProfit || 0,
      maxDrawdown: Math.abs(metrics.maxDrawdown || 0),
      wins,
      losses
    };
  }, [metrics, trades]);

  // Determine win rate color
  const winRateColor = derived.winRate >= 60 ? 'green' : derived.winRate >= 45 ? 'blue' : 'red';

  // Determine P&L color
  const pnlColor = derived.avgProfit > 0 ? 'green' : derived.avgProfit < 0 ? 'red' : 'blue';

  // Determine PF color
  const pfColor = derived.profitFactor >= 2 ? 'green' : derived.profitFactor >= 1 ? 'blue' : 'red';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}
    >
      <MetricCard
        title="Total Trades"
        value={derived.totalTrades}
        subtitle={`${derived.wins}W / ${derived.losses}L`}
        color="blue"
        icon="📊"
      />

      <MetricCard
        title="Win Rate"
        value={`${derived.winRate.toFixed(1)}%`}
        subtitle={`Target: 55%`}
        color={winRateColor}
        icon={derived.winRate >= 55 ? '✅' : '📈'}
      />

      <MetricCard
        title="Profit Factor"
        value={derived.profitFactor >= 999 ? '999+' : derived.profitFactor.toFixed(2)}
        subtitle={derived.profitFactor >= 2 ? 'Excellent' : derived.profitFactor >= 1 ? 'Good' : 'Poor'}
        color={pfColor}
        icon="💰"
      />

      <MetricCard
        title="Avg P&L"
        value={`${derived.avgProfit >= 0 ? '+' : ''}${derived.avgProfit.toFixed(2)}R`}
        subtitle="Per Trade"
        color={pnlColor}
        icon={derived.avgProfit > 0 ? '📈' : '📉'}
      />

      <MetricCard
        title="Max Drawdown"
        value={`${derived.maxDrawdown.toFixed(2)}%`}
        subtitle={derived.maxDrawdown < 5 ? 'Low Risk' : derived.maxDrawdown < 10 ? 'Moderate' : 'High'}
        color={derived.maxDrawdown < 5 ? 'green' : derived.maxDrawdown < 10 ? 'yellow' : 'red'}
        icon="⚠️"
      />
    </div>
  );
}
