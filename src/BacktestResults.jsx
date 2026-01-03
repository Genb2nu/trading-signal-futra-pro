/**
 * Backtest Results Tab
 * Main component for displaying comprehensive backtest results
 */

import { useState, useEffect, useMemo } from 'react';
import BacktestMetricsCards from './components/BacktestMetricsCards';
import BacktestTradeTable from './components/BacktestTradeTable';
import BacktestChart from './components/BacktestChart';
import { getLatestBacktest, getAllBacktestRuns, getBacktestRunById, extractAllTrades } from './services/backtestResultsService';

export default function BacktestResults() {
  const [backtestData, setBacktestData] = useState(null);
  const [availableRuns, setAvailableRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('latest');
  const [selectedMode, setSelectedMode] = useState('conservative');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [chartSymbol, setChartSymbol] = useState(null);

  // Load available runs on mount
  useEffect(() => {
    loadAvailableRuns();
  }, []);

  // Load selected backtest when run changes
  useEffect(() => {
    if (selectedRunId) {
      loadBacktestData(selectedRunId);
    }
  }, [selectedRunId]);

  const loadAvailableRuns = async () => {
    try {
      const runs = await getAllBacktestRuns();
      setAvailableRuns(runs.runs || []);
    } catch (err) {
      console.error('Failed to load available runs:', err);
    }
  };

  const loadBacktestData = async (runId) => {
    try {
      setLoading(true);
      setError(null);

      let data;
      if (runId === 'latest') {
        data = await getLatestBacktest();
      } else {
        data = await getBacktestRunById(runId);
      }

      setBacktestData(data);

      // Auto-select first symbol for chart
      if (data.results && data.results.length > 0) {
        const firstSymbolWithTrades = data.results.find(r => r.trades && r.trades.length > 0);
        if (firstSymbolWithTrades) {
          setChartSymbol(firstSymbolWithTrades.symbol);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to load backtest data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Extract available modes and timeframes from data
  const availableModes = useMemo(() => {
    if (!backtestData?.results || typeof backtestData.results !== 'object' || Array.isArray(backtestData.results)) {
      return [];
    }
    return Object.keys(backtestData.results);
  }, [backtestData]);

  const availableTimeframes = useMemo(() => {
    if (!backtestData?.results || typeof backtestData.results !== 'object' || Array.isArray(backtestData.results)) {
      return [];
    }
    const timeframesSet = new Set();
    Object.values(backtestData.results).forEach(modeData => {
      if (modeData && typeof modeData === 'object') {
        Object.keys(modeData).forEach(tf => timeframesSet.add(tf));
      }
    });
    return Array.from(timeframesSet);
  }, [backtestData]);

  // Extract all trades for table
  const allTrades = useMemo(() => {
    const trades = extractAllTrades(backtestData);

    // Filter by selected mode and timeframe only (show all symbols)
    return trades.filter(t => {
      const modeMatch = selectedMode === 'all' || t.mode === selectedMode;
      const timeframeMatch = selectedTimeframe === 'all' || t.timeframe === selectedTimeframe;
      return modeMatch && timeframeMatch;
    });
  }, [backtestData, selectedMode, selectedTimeframe]);

  // Calculate metrics from filtered trades
  const calculatedMetrics = useMemo(() => {
    if (!allTrades || allTrades.length === 0) {
      return {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        profitFactor: 0,
        totalPnlR: 0,
        avgRPerTrade: 0,
        maxDrawdown: 0
      };
    }

    const wins = allTrades.filter(t => t.pnlR > 0).length;
    const losses = allTrades.filter(t => t.pnlR <= 0).length;
    const winRate = (wins / allTrades.length) * 100;

    const grossProfit = allTrades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
    const grossLoss = Math.abs(allTrades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);

    const totalPnlR = allTrades.reduce((sum, t) => sum + (t.pnlR || 0), 0);
    const avgRPerTrade = totalPnlR / allTrades.length;

    // Calculate max drawdown
    let peak = 0;
    let maxDD = 0;
    let cumulative = 0;

    allTrades.forEach(trade => {
      cumulative += trade.pnlR || 0;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = peak - cumulative;
      if (drawdown > maxDD) {
        maxDD = drawdown;
      }
    });

    return {
      totalTrades: allTrades.length,
      wins,
      losses,
      winRate,
      profitFactor,
      totalPnlR,
      avgRPerTrade,
      maxDrawdown: maxDD
    };
  }, [allTrades]);

  // Get trades for selected symbol
  const symbolTrades = useMemo(() => {
    if (!chartSymbol || !allTrades) return [];
    return allTrades.filter(t => t.symbol === chartSymbol);
  }, [chartSymbol, allTrades]);

  // Handle trade row click
  const handleTradeClick = (trade) => {
    setSelectedTrade(trade);
    setChartSymbol(trade.symbol);
    // Scroll to chart
    document.getElementById('backtest-chart')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle refresh
  const handleRefresh = () => {
    setSelectedTrade(null);
    setSelectedMode('conservative');
    setSelectedTimeframe('1h');
    setFilterTopSymbols(true);
    loadAvailableRuns();
    loadBacktestData(selectedRunId);
  };

  // Format date
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '48px'
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📊</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#333' }}>
          Loading backtest results...
        </div>
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '8px' }}>
          Please wait while we fetch the latest backtest data
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          padding: '48px',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>
          Failed to load backtest results
        </div>
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '24px' }}>
          {error}
        </div>
        {error.includes('No backtest results found') && (
          <div
            style={{
              padding: '16px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              maxWidth: '600px',
              margin: '0 auto',
              textAlign: 'left'
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>To generate backtest results:</div>
            <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
              1. Run: <code style={{ backgroundColor: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                node test-inducement-backtest.js
              </code>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#1e40af', marginTop: '4px' }}>
              2. Wait for the backtest to complete
            </div>
            <div style={{ fontSize: '0.875rem', color: '#1e40af', marginTop: '4px' }}>
              3. Refresh this page to view results
            </div>
          </div>
        )}
        <button
          onClick={handleRefresh}
          style={{
            marginTop: '24px',
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // No data state
  if (!backtestData) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '16px' }}>📊</div>
        <div style={{ color: '#6b7280' }}>No backtest data available</div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '2px solid #e5e7eb'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0, marginBottom: '12px', color: '#1f2937' }}>
            📊 Backtest Results
          </h2>
          {/* Run Selector */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, marginRight: '8px', color: '#1f2937' }}>
              Select Backtest:
            </label>
            <select
              value={selectedRunId}
              onChange={(e) => {
                setSelectedRunId(e.target.value);
                setSelectedTrade(null);
                setSelectedMode('all');
                setSelectedTimeframe('all');
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
                fontWeight: 500,
                backgroundColor: 'white',
                minWidth: '250px'
              }}
            >
              <option value="latest">Latest Backtest</option>
              {availableRuns.map(run => {
                // Handle both new format (with summary) and old format (with direct properties)
                if (run.summary) {
                  // New format: show summary of all modes
                  const totalTrades = Object.values(run.summary).reduce((sum, mode) => sum + (mode.totalTrades || 0), 0);
                  const avgWinRate = Object.values(run.summary).reduce((sum, mode, idx, arr) =>
                    sum + (mode.winRate || 0) / arr.length, 0
                  );
                  return (
                    <option key={run.id} value={run.id}>
                      All Modes ({totalTrades} trades, {avgWinRate.toFixed(1)}% avg WR) - {new Date(run.timestamp).toLocaleDateString()}
                    </option>
                  );
                } else {
                  // Old format: show mode and timeframe
                  return (
                    <option key={run.id} value={run.id}>
                      {run.mode} - {run.timeframe} ({run.totalTrades} trades, {(run.winRate || 0).toFixed(1)}%)
                    </option>
                  );
                }
              })}
            </select>
          </div>

          {/* Mode & Timeframe Filters */}
          {availableModes.length > 0 && (
            <div style={{ marginBottom: '8px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, marginRight: '8px', color: '#1f2937' }}>
                  Mode:
                </label>
                <select
                  value={selectedMode}
                  onChange={(e) => {
                    setSelectedMode(e.target.value);
                    setSelectedTrade(null);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    backgroundColor: 'white',
                    minWidth: '150px'
                  }}
                >
                  <option value="all">All Modes</option>
                  {availableModes.map(mode => (
                    <option key={mode} value={mode} style={{ textTransform: 'capitalize' }}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, marginRight: '8px', color: '#1f2937' }}>
                  Timeframe:
                </label>
                <select
                  value={selectedTimeframe}
                  onChange={(e) => {
                    setSelectedTimeframe(e.target.value);
                    setSelectedTrade(null);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    backgroundColor: 'white',
                    minWidth: '120px'
                  }}
                >
                  <option value="all">All Timeframes</option>
                  {availableTimeframes.map(tf => (
                    <option key={tf} value={tf}>
                      {tf.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

            </div>
          )}
          <div style={{ fontSize: '0.875rem', color: '#1f2937' }}>
            {selectedMode !== 'all' && (
              <>
                Mode: <span style={{ fontWeight: 600, color: '#3b82f6', textTransform: 'capitalize' }}>{selectedMode}</span>
                {' | '}
              </>
            )}
            {selectedTimeframe !== 'all' && (
              <>
                Timeframe: <span style={{ fontWeight: 600, color: '#3b82f6' }}>{selectedTimeframe.toUpperCase()}</span>
                {' | '}
              </>
            )}
            {selectedMode === 'all' && selectedTimeframe === 'all' && (
              <>
                Showing: <span style={{ fontWeight: 600, color: '#3b82f6' }}>All Modes & Timeframes</span>
                {' | '}
              </>
            )}
            Trades: <span style={{ fontWeight: 600, color: '#3b82f6' }}>{allTrades.length}</span>
            {' | '}
            Run: <span style={{ color: '#6b7280' }}>{formatDate(backtestData.metadata?.timestamp || backtestData.timestamp)}</span>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          style={{
            padding: '10px 20px',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Metrics Cards */}
      <BacktestMetricsCards
        metrics={calculatedMetrics}
        trades={allTrades}
      />

      {/* Symbol Selector for Chart */}
      {backtestData.symbols && backtestData.symbols.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, marginRight: '8px' }}>
            Chart Symbol:
          </label>
          <select
            value={chartSymbol || ''}
            onChange={(e) => {
              setChartSymbol(e.target.value);
              setSelectedTrade(null);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            {backtestData.symbols.map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
          {selectedTrade && (
            <button
              onClick={() => setSelectedTrade(null)}
              style={{
                marginLeft: '12px',
                padding: '8px 12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                color: '#dc2626'
              }}
            >
              Clear Selection
            </button>
          )}
        </div>
      )}

      {/* Chart */}
      <div id="backtest-chart">
        {chartSymbol && (
          <BacktestChart
            symbol={chartSymbol}
            timeframe={backtestData.timeframe || (symbolTrades.length > 0 ? symbolTrades[0].timeframe : '1h')}
            trades={symbolTrades}
            selectedTrade={selectedTrade}
          />
        )}
      </div>

      {/* Trade Table */}
      <BacktestTradeTable
        trades={allTrades}
        onTradeClick={handleTradeClick}
      />

      {/* Summary Footer */}
      <div
        style={{
          marginTop: '32px',
          padding: '16px',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          fontSize: '0.875rem',
          color: '#6b7280',
          textAlign: 'center'
        }}
      >
        Backtest ID: {backtestData.id} | Generated: {formatDate(backtestData.timestamp)}
      </div>
    </div>
  );
}
