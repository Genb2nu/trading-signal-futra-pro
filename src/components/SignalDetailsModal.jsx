import React from 'react';
import Modal from './Modal';
import PatternChart from './PatternChart';

const SignalDetailsModal = ({ isOpen, onClose, signal }) => {
  if (!signal) return null;

  const {
    symbol, timeframe, type, entry, stopLoss, takeProfit,
    confidence, patterns, patternDetails, confluenceReason, riskRewardBreakdown
  } = signal;

  // Graceful degradation for backward compatibility
  const reason = confluenceReason || 'Signal triggered based on detected pattern confluence.';
  const rrBreakdown = riskRewardBreakdown || {
    entry, stopLoss, takeProfit,
    ratio: signal.riskReward || 2.0
  };

  const getTradingViewInterval = (tf) => {
    const map = {
      '1m': '1', '5m': '5', '15m': '15', '1h': '60',
      '4h': '240', '1d': 'D', '1w': 'W', '1M': 'M'
    };
    return map[tf] || 'D';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${symbol} - ${type} Signal`}
      maxWidth="1100px"
    >
      {/* Confluence Explanation */}
      <div className="pattern-section" style={{ borderLeftColor: type === 'BUY' ? '#10b981' : '#ef4444' }}>
        <h3>Why This Signal Was Triggered</h3>
        <p style={{ margin: 0, lineHeight: '1.6' }}>{reason}</p>
      </div>

      {/* Pattern Chart with Visual Indicators */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>Chart Analysis with Pattern Visualization</h3>
        <PatternChart
          symbol={symbol}
          timeframe={timeframe}
          patternDetails={patternDetails}
          entry={entry}
          stopLoss={stopLoss}
          takeProfit={takeProfit}
          direction={type === 'BUY' ? 'bullish' : 'bearish'}
        />
      </div>

      {/* Risk/Reward Breakdown */}
      <div className="pattern-section" style={{ borderLeftColor: '#f59e0b' }}>
        <h3>Risk/Reward Analysis</h3>
        <div className="pattern-detail-row">
          <div className="pattern-detail-label">Entry Price:</div>
          <div className="pattern-detail-value">{entry}</div>
        </div>
        <div className="pattern-detail-row">
          <div className="pattern-detail-label">Stop Loss:</div>
          <div className="pattern-detail-value">
            {stopLoss} {rrBreakdown.stopLossDistance && `(${rrBreakdown.stopLossDistance})`}
          </div>
        </div>
        <div className="pattern-detail-row">
          <div className="pattern-detail-label">Take Profit:</div>
          <div className="pattern-detail-value">
            {takeProfit} {rrBreakdown.takeProfitDistance && `(${rrBreakdown.takeProfitDistance})`}
          </div>
        </div>
        <div className="pattern-detail-row">
          <div className="pattern-detail-label">Risk/Reward Ratio:</div>
          <div className="pattern-detail-value" style={{ color: '#10b981', fontWeight: 'bold' }}>
            1:{rrBreakdown.ratio}
          </div>
        </div>
        {rrBreakdown.reasoning && (
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            {rrBreakdown.reasoning}
          </p>
        )}
      </div>

      {/* Pattern Details - FVG */}
      {patternDetails?.fvg && (
        <div className="pattern-section" style={{ borderLeftColor: '#8b5cf6' }}>
          <h3>Fair Value Gap (FVG)</h3>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Type:</div>
            <div className="pattern-detail-value">{patternDetails.fvg.type}</div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Top Price:</div>
            <div className="pattern-detail-value">{patternDetails.fvg.top.toFixed(8)}</div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Bottom Price:</div>
            <div className="pattern-detail-value">{patternDetails.fvg.bottom.toFixed(8)}</div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Gap Size:</div>
            <div className="pattern-detail-value">{patternDetails.fvg.gap.toFixed(8)}</div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            A Fair Value Gap represents an imbalance where price moved too quickly,
            leaving a gap that often gets filled. This {patternDetails.fvg.type} FVG
            indicates strong momentum.
          </p>
        </div>
      )}

      {/* Pattern Details - Order Block */}
      {patternDetails?.orderBlock && (
        <div className="pattern-section" style={{ borderLeftColor: '#ec4899' }}>
          <h3>Order Block</h3>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Type:</div>
            <div className="pattern-detail-value">{patternDetails.orderBlock.type}</div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Top Price:</div>
            <div className="pattern-detail-value">{patternDetails.orderBlock.top.toFixed(8)}</div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Bottom Price:</div>
            <div className="pattern-detail-value">{patternDetails.orderBlock.bottom.toFixed(8)}</div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Strength:</div>
            <div className="pattern-detail-value">{patternDetails.orderBlock.strength.toFixed(2)}%</div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            Order Blocks represent areas where large institutional orders were placed.
            The strength of {patternDetails.orderBlock.strength.toFixed(2)}% indicates the impulse move after this block.
          </p>
        </div>
      )}

      {/* Pattern Details - Liquidity Sweep */}
      {patternDetails?.liquiditySweep && (
        <div className="pattern-section" style={{ borderLeftColor: '#06b6d4' }}>
          <h3>Liquidity Sweep</h3>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Direction:</div>
            <div className="pattern-detail-value">{patternDetails.liquiditySweep.direction}</div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Swing Level:</div>
            <div className="pattern-detail-value">{patternDetails.liquiditySweep.swingLevel.toFixed(8)}</div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            A liquidity sweep occurs when price briefly breaks a swing point to trigger
            stop losses, then reverses. This "stop hunt" often precedes strong moves.
          </p>
        </div>
      )}

      {/* Pattern Details - BMS */}
      {patternDetails?.bms && (
        <div className="pattern-section" style={{ borderLeftColor: '#f43f5e' }}>
          <h3>Break of Market Structure (BMS)</h3>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Type:</div>
            <div className="pattern-detail-value">{patternDetails.bms.type}</div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Break Level:</div>
            <div className="pattern-detail-value">{patternDetails.bms.breakLevel.toFixed(8)}</div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Previous Trend:</div>
            <div className="pattern-detail-value">{patternDetails.bms.previousTrend}</div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            Break of Market Structure confirms a trend change from {patternDetails.bms.previousTrend}.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            const interval = getTradingViewInterval(timeframe);
            const url = `https://www.tradingview.com/chart/?symbol=BINANCE:${symbol}&interval=${interval}`;
            window.open(url, '_blank');
          }}
        >
          Open in TradingView
        </button>
      </div>
    </Modal>
  );
};

export default SignalDetailsModal;
