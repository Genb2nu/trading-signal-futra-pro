import React, { useEffect, useRef } from 'react';

const TradingViewChart = ({ symbol, timeframe, patternDetails, entry, stopLoss, takeProfit }) => {
  const containerRef = useRef(null);

  const getTradingViewInterval = (tf) => {
    const map = {
      '1m': '1', '5m': '5', '15m': '15', '1h': '60',
      '4h': '240', '1d': 'D', '1w': 'W', '1M': 'M'
    };
    return map[tf] || 'D';
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (window.TradingView) {
        new window.TradingView.widget({
          container_id: containerRef.current.id,
          autosize: true,
          symbol: `BINANCE:${symbol}`,
          interval: getTradingViewInterval(timeframe),
          timezone: 'Etc/UTC',
          theme: 'light',
          style: '1',
          locale: 'en',
          toolbar_bg: '#f1f3f6',
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          disabled_features: ['use_localstorage_for_settings'],
          enabled_features: ['study_templates'],
          loading_screen: { backgroundColor: '#ffffff' }
        });
      }
    };

    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [symbol, timeframe]);

  return (
    <div>
      <div
        id={`tradingview_${symbol}_${Date.now()}`}
        ref={containerRef}
        style={{
          height: '500px',
          width: '100%',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden'
        }}
      />

      {/* Pattern level annotations */}
      <div style={{
        marginTop: '16px',
        background: '#f9fafb',
        padding: '12px',
        borderRadius: '6px',
        fontSize: '13px'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '8px' }}>Key Price Levels:</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
          <div>
            <span style={{ color: '#10b981', fontWeight: '600' }}>Entry: </span>
            <span style={{ fontFamily: 'monospace' }}>{entry}</span>
          </div>
          <div>
            <span style={{ color: '#ef4444', fontWeight: '600' }}>Stop Loss: </span>
            <span style={{ fontFamily: 'monospace' }}>{stopLoss}</span>
          </div>
          <div>
            <span style={{ color: '#3b82f6', fontWeight: '600' }}>Take Profit: </span>
            <span style={{ fontFamily: 'monospace' }}>{takeProfit}</span>
          </div>

          {patternDetails?.fvg && (
            <>
              <div>
                <span style={{ color: '#8b5cf6', fontWeight: '600' }}>FVG Top: </span>
                <span style={{ fontFamily: 'monospace' }}>{patternDetails.fvg.top.toFixed(8)}</span>
              </div>
              <div>
                <span style={{ color: '#8b5cf6', fontWeight: '600' }}>FVG Bottom: </span>
                <span style={{ fontFamily: 'monospace' }}>{patternDetails.fvg.bottom.toFixed(8)}</span>
              </div>
            </>
          )}

          {patternDetails?.orderBlock && (
            <>
              <div>
                <span style={{ color: '#ec4899', fontWeight: '600' }}>OB Top: </span>
                <span style={{ fontFamily: 'monospace' }}>{patternDetails.orderBlock.top.toFixed(8)}</span>
              </div>
              <div>
                <span style={{ color: '#ec4899', fontWeight: '600' }}>OB Bottom: </span>
                <span style={{ fontFamily: 'monospace' }}>{patternDetails.orderBlock.bottom.toFixed(8)}</span>
              </div>
            </>
          )}

          {patternDetails?.liquiditySweep && (
            <div>
              <span style={{ color: '#06b6d4', fontWeight: '600' }}>Sweep Level: </span>
              <span style={{ fontFamily: 'monospace' }}>{patternDetails.liquiditySweep.swingLevel.toFixed(8)}</span>
            </div>
          )}

          {patternDetails?.bms && (
            <div>
              <span style={{ color: '#f43f5e', fontWeight: '600' }}>BMS Level: </span>
              <span style={{ fontFamily: 'monospace' }}>{patternDetails.bms.breakLevel.toFixed(8)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TradingViewChart;
