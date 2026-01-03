/**
 * Mode & Timeframe Breakdown Component
 * Shows backtest results grouped by strategy mode and timeframe
 */

import { useState, useMemo } from 'react';

export default function ModeTimeframeBreakdown({ backtestData, onSelect, selectedModeTimeframe }) {
  const [expandedCombinations, setExpandedCombinations] = useState(new Set());

  // Process backtest data into mode/timeframe combinations
  const modeTimeframeData = useMemo(() => {
    if (!backtestData || !backtestData.results) {
      console.log('No backtest data or results');
      return [];
    }

    const combinations = [];

    Object.entries(backtestData.results).forEach(([mode, timeframes]) => {
      Object.entries(timeframes).forEach(([timeframe, symbols]) => {
        // Calculate overall metrics for this combination
        let totalTrades = 0;
        let totalWins = 0;
        let totalLosses = 0;
        let totalPnlR = 0;
        const allTrades = [];

        Object.entries(symbols).forEach(([symbol, symbolData]) => {
          if (symbolData.trades && Array.isArray(symbolData.trades)) {
            totalTrades += symbolData.trades.length;
            totalWins += symbolData.trades.filter(t => t.pnlR > 0).length;
            totalLosses += symbolData.trades.filter(t => t.pnlR <= 0).length;
            totalPnlR += symbolData.trades.reduce((sum, t) => sum + (t.pnlR || 0), 0);
            allTrades.push(...symbolData.trades);
          }
        });

        const winRate = totalTrades > 0 ? (totalWins / totalTrades * 100) : 0;
        const grossProfit = allTrades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
        const grossLoss = Math.abs(allTrades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);

        combinations.push({
          mode,
          timeframe,
          totalTrades,
          totalWins,
          totalLosses,
          winRate,
          profitFactor,
          totalPnlR,
          avgRPerTrade: totalTrades > 0 ? (totalPnlR / totalTrades) : 0,
          symbols: Object.entries(symbols).map(([symbol, data]) => ({
            symbol,
            trades: data.trades?.length || 0,
            wins: data.trades?.filter(t => t.pnlR > 0).length || 0,
            winRate: data.trades?.length > 0 ? (data.trades.filter(t => t.pnlR > 0).length / data.trades.length * 100) : 0,
            totalPnlR: data.trades?.reduce((sum, t) => sum + (t.pnlR || 0), 0) || 0
          })).sort((a, b) => b.totalPnlR - a.totalPnlR) // Sort by profitability
        });
      });
    });

    // Sort by total P&L (most profitable first)
    return combinations.sort((a, b) => b.totalPnlR - a.totalPnlR);
  }, [backtestData]);

  // Top 4 symbols to highlight
  const TOP_4_SYMBOLS = ['AVAXUSDT', 'ADAUSDT', 'DOGEUSDT', 'BTCUSDT'];

  // Calculate top 4 metrics for each combination
  const modeTimeframeDataWithTop4 = useMemo(() => {
    return modeTimeframeData.map(combo => {
      const top4Symbols = combo.symbols.filter(s => TOP_4_SYMBOLS.includes(s.symbol));
      const top4TotalTrades = top4Symbols.reduce((sum, s) => sum + s.trades, 0);
      const top4TotalWins = top4Symbols.reduce((sum, s) => sum + s.wins, 0);
      const top4TotalPnl = top4Symbols.reduce((sum, s) => sum + s.totalPnlR, 0);
      const top4WinRate = top4TotalTrades > 0 ? (top4TotalWins / top4TotalTrades * 100) : 0;

      return {
        ...combo,
        top4: {
          trades: top4TotalTrades,
          wins: top4TotalWins,
          winRate: top4WinRate,
          totalPnlR: top4TotalPnl,
          avgR: top4TotalTrades > 0 ? (top4TotalPnl / top4TotalTrades) : 0
        }
      };
    });
  }, [modeTimeframeData]);

  const toggleExpand = (mode, timeframe) => {
    const key = `${mode}-${timeframe}`;
    setExpandedCombinations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const isExpanded = (mode, timeframe) => {
    return expandedCombinations.has(`${mode}-${timeframe}`);
  };

  const getEmoji = (winRate, pnl) => {
    if (winRate >= 90 && pnl > 5) return '🔥';
    if (winRate >= 80 && pnl > 3) return '🎯';
    if (winRate >= 70 && pnl > 0) return '✅';
    if (winRate >= 60) return '⚠️';
    return '❌';
  };

  const getModeColor = (mode) => {
    const colors = {
      conservative: '#10b981',
      moderate: '#3b82f6',
      aggressive: '#f59e0b',
      scalping: '#8b5cf6',
      elite: '#ec4899',
      sniper: '#ef4444',
      ultra: '#06b6d4'
    };
    return colors[mode] || '#6b7280';
  };

  // Always show something to verify component is rendering
  if (!backtestData || !backtestData.results) {
    return (
      <div style={{ marginBottom: '32px', padding: '24px', backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: '#92400e' }}>
          ⚠️ Component Loaded - Waiting for Data
        </h3>
        <div style={{ fontSize: '0.875rem', color: '#78350f' }}>
          ModeTimeframeBreakdown component is rendering, but no backtest data available yet.
        </div>
      </div>
    );
  }

  if (modeTimeframeDataWithTop4.length === 0) {
    return (
      <div style={{ marginBottom: '32px', padding: '24px', backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: '#92400e' }}>
          ⚠️ Component Loaded - No Mode/Timeframe Data
        </h3>
        <div style={{ fontSize: '0.875rem', color: '#78350f' }}>
          Backtest data exists but no mode/timeframe combinations found. Check data structure.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '32px' }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', color: '#1f2937' }}>
        📊 Performance by Mode & Timeframe
      </h3>

      {/* Top Performers Alert */}
      {modeTimeframeDataWithTop4[0] && modeTimeframeDataWithTop4[0].totalPnlR > 5 && (
        <div
          style={{
            marginBottom: '16px',
            padding: '16px',
            backgroundColor: '#ecfdf5',
            border: '2px solid #10b981',
            borderRadius: '8px'
          }}
        >
          <div style={{ fontWeight: 600, color: '#065f46', marginBottom: '8px' }}>
            🏆 Best Performer
          </div>
          <div style={{ fontSize: '0.875rem', color: '#047857' }}>
            <strong>{modeTimeframeDataWithTop4[0].mode.toUpperCase()}</strong> mode on{' '}
            <strong>{modeTimeframeDataWithTop4[0].timeframe.toUpperCase()}</strong>:{' '}
            {modeTimeframeDataWithTop4[0].winRate.toFixed(1)}% WR,{' '}
            {modeTimeframeDataWithTop4[0].totalPnlR >= 0 ? '+' : ''}{modeTimeframeDataWithTop4[0].totalPnlR.toFixed(2)}R
            {modeTimeframeDataWithTop4[0].top4.winRate >= 80 && (
              <span style={{ marginLeft: '8px', fontWeight: 700 }}>
                | Top 4 Symbols: {modeTimeframeDataWithTop4[0].top4.winRate.toFixed(1)}% WR 🎯
              </span>
            )}
          </div>
        </div>
      )}

      {/* Mode/Timeframe Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Mode</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>TF</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Trades</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Win Rate</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>PF</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Total P&L</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Avg R</th>
              <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Top 4</th>
              <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {modeTimeframeDataWithTop4.map((combo, index) => {
              const isTop = index < 3;
              const expanded = isExpanded(combo.mode, combo.timeframe);

              return (
                <>
                  <tr
                    key={`${combo.mode}-${combo.timeframe}`}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      backgroundColor: selectedModeTimeframe?.mode === combo.mode && selectedModeTimeframe?.timeframe === combo.timeframe
                        ? '#dbeafe'
                        : isTop ? '#fef9f3' : 'white',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      const isSelected = selectedModeTimeframe?.mode === combo.mode && selectedModeTimeframe?.timeframe === combo.timeframe;
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = isTop ? '#fef3c7' : '#f9fafb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const isSelected = selectedModeTimeframe?.mode === combo.mode && selectedModeTimeframe?.timeframe === combo.timeframe;
                      e.currentTarget.style.backgroundColor = isSelected ? '#dbeafe' : (isTop ? '#fef9f3' : 'white');
                    }}
                  >
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: getModeColor(combo.mode)
                          }}
                        />
                        <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                          {combo.mode}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{combo.timeframe.toUpperCase()}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{combo.totalTrades}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                      {getEmoji(combo.winRate, combo.totalPnlR)} {combo.winRate.toFixed(1)}%
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{combo.profitFactor.toFixed(2)}</td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: combo.totalPnlR > 0 ? '#10b981' : '#ef4444'
                      }}
                    >
                      {combo.totalPnlR >= 0 ? '+' : ''}{combo.totalPnlR.toFixed(2)}R
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'right',
                        color: combo.avgRPerTrade > 0 ? '#10b981' : '#ef4444'
                      }}
                    >
                      {combo.avgRPerTrade >= 0 ? '+' : ''}{combo.avgRPerTrade.toFixed(2)}R
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {combo.top4.trades > 0 ? (
                        <div style={{ fontSize: '0.75rem' }}>
                          <div style={{ fontWeight: 600, color: combo.top4.winRate >= 80 ? '#10b981' : '#6b7280' }}>
                            {combo.top4.winRate.toFixed(0)}% WR
                          </div>
                          <div style={{ color: combo.top4.totalPnlR > 0 ? '#10b981' : '#ef4444' }}>
                            {combo.top4.totalPnlR >= 0 ? '+' : ''}{combo.top4.totalPnlR.toFixed(1)}R
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelect) {
                              onSelect(combo.mode, combo.timeframe);
                            }
                          }}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: selectedModeTimeframe?.mode === combo.mode && selectedModeTimeframe?.timeframe === combo.timeframe
                              ? '#3b82f6'
                              : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="Filter results to this mode/timeframe"
                        >
                          {selectedModeTimeframe?.mode === combo.mode && selectedModeTimeframe?.timeframe === combo.timeframe
                            ? '✓ Viewing'
                            : '👁 View'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(combo.mode, combo.timeframe);
                          }}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: expanded ? '#3b82f6' : '#e5e7eb',
                            color: expanded ? 'white' : '#374151',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="Show/hide symbol details"
                        >
                          {expanded ? '▼' : '▶'}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Symbol Details */}
                  {expanded && (
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <td colSpan="9" style={{ padding: '16px' }}>
                        <div style={{ marginLeft: '24px' }}>
                          <div style={{ fontWeight: 600, marginBottom: '12px', color: '#374151' }}>
                            Symbol Breakdown:
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                            {combo.symbols.filter(s => s.trades > 0).map(sym => {
                              const isTop4 = TOP_4_SYMBOLS.includes(sym.symbol);
                              return (
                                <div
                                  key={sym.symbol}
                                  style={{
                                    padding: '12px',
                                    backgroundColor: isTop4 ? '#fef3c7' : 'white',
                                    border: isTop4 ? '2px solid #fbbf24' : '1px solid #e5e7eb',
                                    borderRadius: '6px'
                                  }}
                                >
                                  <div style={{ fontWeight: 600, marginBottom: '4px', color: '#1f2937' }}>
                                    {isTop4 && '⭐ '}{sym.symbol}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                    {sym.trades} trades | {sym.winRate.toFixed(0)}% WR
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '0.875rem',
                                      fontWeight: 700,
                                      color: sym.totalPnlR > 0 ? '#10b981' : '#ef4444',
                                      marginTop: '4px'
                                    }}
                                  >
                                    {sym.totalPnlR >= 0 ? '+' : ''}{sym.totalPnlR.toFixed(2)}R
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', fontSize: '0.75rem', color: '#6b7280' }}>
        <div style={{ fontWeight: 600, marginBottom: '8px', color: '#374151' }}>Legend:</div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div>🔥 = 90%+ WR & +5R+</div>
          <div>🎯 = 80%+ WR & +3R+</div>
          <div>✅ = 70%+ WR & Profitable</div>
          <div>⭐ = Top 4 Symbols (AVAX, ADA, DOGE, BTC)</div>
          <div><strong>Top 4</strong> column shows performance on top 4 symbols only</div>
        </div>
      </div>
    </div>
  );
}
