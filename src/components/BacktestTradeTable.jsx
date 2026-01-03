/**
 * Backtest Trade Table Component
 * Displays filterable, sortable table of backtest trades with pagination
 */

import { useState, useMemo } from 'react';
import { filterTrades, sortTrades, paginateTrades } from '../services/backtestResultsService';

/**
 * Format timestamp to readable date/time
 */
function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get pattern names from signal
 */
function getPatternNames(signal) {
  if (!signal || !signal.patterns) return [];
  return signal.patterns.slice(0, 3); // Show max 3 patterns
}

/**
 * Trade row component
 */
function TradeRow({ trade, onClick }) {
  const isWin = trade.pnlR > 0;
  const resultColor = isWin ? '#10b981' : '#ef4444';
  const patterns = getPatternNames(trade.signal);

  return (
    <tr
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderBottom: '1px solid #e5e7eb'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
        {trade.symbol}
      </td>
      <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#6b7280' }}>
        {formatDateTime(trade.signalTime)}
      </td>
      <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#6b7280' }}>
        {trade.exitTime ? formatDateTime(trade.exitTime) : 'N/A'}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <span
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: trade.signal?.type === 'BUY' ? '#dbeafe' : '#fee2e2',
            color: trade.signal?.type === 'BUY' ? '#1e40af' : '#991b1b'
          }}
        >
          {trade.signal?.type === 'BUY' ? 'LONG' : trade.signal?.type === 'SELL' ? 'SHORT' : 'N/A'}
        </span>
      </td>
      <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
        ${trade.entry?.toFixed(2) || 'N/A'}
      </td>
      <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
        ${trade.exitPrice?.toFixed(2) || 'N/A'}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <span
          style={{
            fontWeight: 600,
            color: resultColor
          }}
        >
          {trade.result || 'N/A'}
        </span>
      </td>
      <td style={{ padding: '12px 16px', fontWeight: 700, color: resultColor }}>
        {isWin ? '+' : ''}{trade.pnlR?.toFixed(2) || '0.00'}R
      </td>
      <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#6b7280' }}>
        {trade.signal?.confluenceScore || 0}
      </td>
      <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#6b7280' }}>
        {patterns.length > 0 ? patterns.join(', ') : 'None'}
        {patterns.length >= 3 && '...'}
      </td>
    </tr>
  );
}

/**
 * Main trade table component
 */
export default function BacktestTradeTable({ trades = [], onTradeClick }) {
  const [filters, setFilters] = useState({
    result: 'all',
    symbol: 'all',
    type: 'all',
    minConfluence: 0
  });
  const [sortBy, setSortBy] = useState('signalTime');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Get unique symbols for filter
  const symbols = useMemo(() => {
    const unique = [...new Set(trades.map(t => t.symbol))];
    return unique.sort();
  }, [trades]);

  // Apply filters, sorting, and pagination
  const processedData = useMemo(() => {
    let processed = filterTrades(trades, filters);
    processed = sortTrades(processed, sortBy, sortOrder);
    return paginateTrades(processed, currentPage, pageSize);
  }, [trades, filters, sortBy, sortOrder, currentPage]);

  // Reset to page 1 when filters change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // Handle sort column click
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 500, marginRight: '8px' }}>
            Result:
          </label>
          <select
            value={filters.result}
            onChange={(e) => handleFilterChange('result', e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All</option>
            <option value="win">Wins Only</option>
            <option value="loss">Losses Only</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 500, marginRight: '8px' }}>
            Symbol:
          </label>
          <select
            value={filters.symbol}
            onChange={(e) => handleFilterChange('symbol', e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All Symbols</option>
            {symbols.map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 500, marginRight: '8px' }}>
            Type:
          </label>
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All Types</option>
            <option value="BUY">Long Only</option>
            <option value="SELL">Short Only</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: '#6b7280' }}>
          Showing {processedData.trades.length} of {processedData.pagination.totalItems} trades
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
          <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
            <tr>
              <th
                onClick={() => handleSort('symbol')}
                style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Symbol {sortBy === 'symbol' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => handleSort('signalTime')}
                style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Entry Time {sortBy === 'signalTime' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}>
                Exit Time
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}>
                Type
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}>
                Entry Price
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}>
                Exit Price
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}>
                Result
              </th>
              <th
                onClick={() => handleSort('pnl')}
                style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
              >
                P&L {sortBy === 'pnl' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => handleSort('confluence')}
                style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Confluence {sortBy === 'confluence' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}>
                Patterns
              </th>
            </tr>
          </thead>
          <tbody>
            {processedData.trades.length > 0 ? (
              processedData.trades.map((trade, index) => (
                <TradeRow
                  key={`${trade.symbol}-${trade.signalTime}-${index}`}
                  trade={trade}
                  onClick={() => onTradeClick && onTradeClick(trade)}
                />
              ))
            ) : (
              <tr>
                <td colSpan="10" style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                  No trades found matching the current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {processedData.pagination.totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            marginTop: '16px'
          }}
        >
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={!processedData.pagination.hasPrev}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: processedData.pagination.hasPrev ? 'white' : '#f3f4f6',
              cursor: processedData.pagination.hasPrev ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            Previous
          </button>

          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Page {currentPage} of {processedData.pagination.totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(processedData.pagination.totalPages, prev + 1))}
            disabled={!processedData.pagination.hasNext}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: processedData.pagination.hasNext ? 'white' : '#f3f4f6',
              cursor: processedData.pagination.hasNext ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
