import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

const PatternChart = ({ symbol, timeframe, patternDetails, entry, stopLoss, takeProfit, direction }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ohlcData, setOhlcData] = useState(null);

  // Convert timeframe to Binance API interval
  const getInterval = (tf) => {
    const map = {
      '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h',
      '4h': '4h', '1d': '1d', '1w': '1w', '1M': '1M'
    };
    return map[tf] || '1d';
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Debug: Log pattern details
        console.log('=== PATTERN DETAILS DEBUG ===');
        console.log('Full patternDetails object:', patternDetails);
        console.log('FVG present?', patternDetails?.fvg ? 'YES' : 'NO');
        console.log('Order Block present?', patternDetails?.orderBlock ? 'YES' : 'NO');
        console.log('Liquidity Sweep present?', patternDetails?.liquiditySweep ? 'YES' : 'NO');
        console.log('BMS present?', patternDetails?.bms ? 'YES' : 'NO');
        console.log('============================');

        // Fetch candlestick data from our server API (avoids CORS issues)
        const interval = getInterval(timeframe);
        const limit = 200; // Get last 200 candles
        const response = await fetch(
          `/api/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch chart data');
        }

        const data = await response.json();

        // Convert Binance data to lightweight-charts format
        const candlestickData = data.map((candle) => ({
          time: candle[0] / 1000, // Convert to seconds
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4])
        }));

        // Get latest candle OHLC data
        const latestCandle = candlestickData[candlestickData.length - 1];
        const priceChange = latestCandle.close - latestCandle.open;
        const priceChangePercent = (priceChange / latestCandle.open) * 100;

        setOhlcData({
          open: latestCandle.open,
          high: latestCandle.high,
          low: latestCandle.low,
          close: latestCandle.close,
          change: priceChange,
          changePercent: priceChangePercent
        });

        // Create chart with v4 API
        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: 500,
          layout: {
            backgroundColor: '#ffffff',
            textColor: '#333',
          },
          grid: {
            vertLines: { color: '#f0f0f0' },
            horzLines: { color: '#f0f0f0' },
          },
          crosshair: {
            mode: 0, // Normal
          },
          rightPriceScale: {
            borderColor: '#d1d5db',
          },
          timeScale: {
            borderColor: '#d1d5db',
            timeVisible: true,
            secondsVisible: false,
          },
        });

        chartRef.current = chart;

        // Add candlestick series
        const candlestickSeries = chart.addCandlestickSeries({
          upColor: '#10b981',
          downColor: '#ef4444',
          borderUpColor: '#10b981',
          borderDownColor: '#ef4444',
          wickUpColor: '#10b981',
          wickDownColor: '#ef4444',
        });

        candlestickSeries.setData(candlestickData);

        // Add volume series
        const volumeData = data.map((candle) => ({
          time: candle[0] / 1000,
          value: parseFloat(candle[5]), // Volume is at index 5
          color: parseFloat(candle[4]) >= parseFloat(candle[1]) ? '#10b98180' : '#ef444480' // Green if close >= open, red otherwise
        }));

        const volumeSeries = chart.addHistogramSeries({
          color: '#26a69a',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: 'volume',
        });

        volumeSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.8, // Volume takes bottom 20% of chart
            bottom: 0,
          },
        });

        volumeSeries.setData(volumeData);

        // Get the latest timestamp for pattern markers
        const latestTime = candlestickData[candlestickData.length - 1].time;

        // Draw Entry, Stop Loss, Take Profit lines
        const entryLine = {
          price: parseFloat(entry),
          color: '#667eea',
          lineWidth: 2,
          lineStyle: 0, // Solid
          axisLabelVisible: true,
          title: 'Entry',
        };

        const stopLossLine = {
          price: parseFloat(stopLoss),
          color: '#ef4444',
          lineWidth: 2,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: 'Stop Loss',
        };

        const takeProfitLine = {
          price: parseFloat(takeProfit),
          color: '#10b981',
          lineWidth: 2,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: 'Take Profit',
        };

        candlestickSeries.createPriceLine(entryLine);
        candlestickSeries.createPriceLine(stopLossLine);
        candlestickSeries.createPriceLine(takeProfitLine);

        // Draw FVG zone
        if (patternDetails?.fvg) {
          const fvgSeries = chart.addLineSeries({
            color: 'transparent',
            lineWidth: 0,
            priceLineVisible: false,
            lastValueVisible: false,
          });

          // Create a rectangle for FVG using polygon
          const fvgTop = patternDetails.fvg.top;
          const fvgBottom = patternDetails.fvg.bottom;

          // Add price lines to show FVG zone
          const fvgTopLine = {
            price: fvgTop,
            color: '#8b5cf6',
            lineWidth: 1,
            lineStyle: 1, // Dotted
            axisLabelVisible: false,
            title: 'FVG Top',
          };

          const fvgBottomLine = {
            price: fvgBottom,
            color: '#8b5cf6',
            lineWidth: 1,
            lineStyle: 1, // Dotted
            axisLabelVisible: false,
            title: 'FVG Bottom',
          };

          candlestickSeries.createPriceLine(fvgTopLine);
          candlestickSeries.createPriceLine(fvgBottomLine);
        }

        // Draw Order Block zone
        if (patternDetails?.orderBlock) {
          const obTop = patternDetails.orderBlock.top;
          const obBottom = patternDetails.orderBlock.bottom;

          const obTopLine = {
            price: obTop,
            color: '#ec4899',
            lineWidth: 1,
            lineStyle: 1, // Dotted
            axisLabelVisible: false,
            title: 'OB Top',
          };

          const obBottomLine = {
            price: obBottom,
            color: '#ec4899',
            lineWidth: 1,
            lineStyle: 1, // Dotted
            axisLabelVisible: false,
            title: 'OB Bottom',
          };

          candlestickSeries.createPriceLine(obTopLine);
          candlestickSeries.createPriceLine(obBottomLine);
        }

        // Draw Liquidity Sweep level
        if (patternDetails?.liquiditySweep) {
          const sweepLevel = patternDetails.liquiditySweep.swingLevel;

          const sweepLine = {
            price: sweepLevel,
            color: '#06b6d4',
            lineWidth: 2,
            lineStyle: 1, // Dotted
            axisLabelVisible: true,
            title: 'Liquidity Sweep',
          };

          candlestickSeries.createPriceLine(sweepLine);
        }

        // Draw BMS break level
        if (patternDetails?.bms) {
          const bmsLevel = patternDetails.bms.breakLevel;

          const bmsLine = {
            price: bmsLevel,
            color: '#f43f5e',
            lineWidth: 2,
            lineStyle: 3, // Large Dashed
            axisLabelVisible: true,
            title: 'BMS Level',
          };

          candlestickSeries.createPriceLine(bmsLine);
        }

        // Fit content
        chart.timeScale().fitContent();

        setLoading(false);

        // Handle resize
        const handleResize = () => {
          if (chartContainerRef.current && chartRef.current) {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
            });
          }
        };

        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
          if (chartRef.current) {
            chartRef.current.remove();
          }
        };
      } catch (err) {
        console.error('Chart error:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, timeframe, patternDetails, entry, stopLoss, takeProfit]);

  // Get full symbol name
  const getSymbolName = (sym) => {
    const symbolMap = {
      'BTCUSDT': 'Bitcoin / TetherUS',
      'ETHUSDT': 'Ethereum / TetherUS',
      'BNBUSDT': 'Binance Coin / TetherUS',
      'ADAUSDT': 'Cardano / TetherUS',
      'XRPUSDT': 'Ripple / TetherUS',
      'SOLUSDT': 'Solana / TetherUS',
      'DOTUSDT': 'Polkadot / TetherUS',
      'DOGEUSDT': 'Dogecoin / TetherUS',
      'MATICUSDT': 'Polygon / TetherUS',
      'SHIBUSDT': 'Shiba Inu / TetherUS',
      'AVAXUSDT': 'Avalanche / TetherUS',
      'LINKUSDT': 'Chainlink / TetherUS',
    };
    return symbolMap[sym] || sym;
  };

  return (
    <div>
      {/* Chart Header with OHLC */}
      {ohlcData && (
        <div style={{
          background: '#f9fafb',
          padding: '12px 16px',
          borderRadius: '8px 8px 0 0',
          border: '1px solid #e5e7eb',
          borderBottom: 'none',
          fontFamily: 'monospace',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#1f2937' }}>
              {getSymbolName(symbol)} - {timeframe} - Binance
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ color: '#6b7280' }}>O</span>
              <span style={{ fontWeight: '600' }}>{ohlcData.open.toFixed(2)}</span>
              <span style={{ color: '#6b7280' }}>H</span>
              <span style={{ fontWeight: '600' }}>{ohlcData.high.toFixed(2)}</span>
              <span style={{ color: '#6b7280' }}>L</span>
              <span style={{ fontWeight: '600' }}>{ohlcData.low.toFixed(2)}</span>
              <span style={{ color: '#6b7280' }}>C</span>
              <span style={{ fontWeight: '600' }}>{ohlcData.close.toFixed(2)}</span>
              <span style={{
                color: ohlcData.change >= 0 ? '#10b981' : '#ef4444',
                fontWeight: '600'
              }}>
                {ohlcData.change >= 0 ? '+' : ''}{ohlcData.change.toFixed(2)} ({ohlcData.changePercent >= 0 ? '+' : ''}{ohlcData.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      )}

      <div
        ref={chartContainerRef}
        style={{
          width: '100%',
          height: '500px',
          border: '1px solid #e5e7eb',
          borderRadius: ohlcData ? '0 0 8px 8px' : '8px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '10px', color: '#6b7280' }}>Loading chart...</p>
          </div>
        )}
        {error && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#ef4444'
          }}>
            <p>Error loading chart: {error}</p>
          </div>
        )}
      </div>

      {/* Pattern Detection Status */}
      <div style={{
        marginTop: '16px',
        background: '#fff3cd',
        border: '1px solid #ffc107',
        padding: '12px',
        borderRadius: '6px',
        fontSize: '13px'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '8px' }}>Pattern Detection Status:</div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontWeight: '600' }}>FVG: </span>
            <span style={{ color: patternDetails?.fvg ? '#10b981' : '#ef4444' }}>
              {patternDetails?.fvg ? '✓ Detected' : '✗ Not Detected'}
            </span>
          </div>
          <div>
            <span style={{ fontWeight: '600' }}>Order Block: </span>
            <span style={{ color: patternDetails?.orderBlock ? '#10b981' : '#ef4444' }}>
              {patternDetails?.orderBlock ? '✓ Detected' : '✗ Not Detected'}
            </span>
          </div>
          <div>
            <span style={{ fontWeight: '600' }}>Liquidity Sweep: </span>
            <span style={{ color: patternDetails?.liquiditySweep ? '#10b981' : '#ef4444' }}>
              {patternDetails?.liquiditySweep ? '✓ Detected' : '✗ Not Detected'}
            </span>
          </div>
          <div>
            <span style={{ fontWeight: '600' }}>BMS: </span>
            <span style={{ color: patternDetails?.bms ? '#10b981' : '#ef4444' }}>
              {patternDetails?.bms ? '✓ Detected' : '✗ Not Detected'}
            </span>
          </div>
        </div>
      </div>

      {/* Pattern level legend */}
      <div style={{
        marginTop: '16px',
        background: '#f9fafb',
        padding: '12px',
        borderRadius: '6px',
        fontSize: '13px'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '8px' }}>Chart Legend (Detected Patterns Only):</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
          <div>
            <span style={{ color: '#667eea', fontWeight: '600' }}>━━━ Entry: </span>
            <span style={{ fontFamily: 'monospace' }}>{entry}</span>
          </div>
          <div>
            <span style={{ color: '#ef4444', fontWeight: '600' }}>- - - Stop Loss: </span>
            <span style={{ fontFamily: 'monospace' }}>{stopLoss}</span>
          </div>
          <div>
            <span style={{ color: '#10b981', fontWeight: '600' }}>- - - Take Profit: </span>
            <span style={{ fontFamily: 'monospace' }}>{takeProfit}</span>
          </div>

          {patternDetails?.fvg && (
            <div>
              <span style={{ color: '#8b5cf6', fontWeight: '600' }}>··· FVG Zone: </span>
              <span style={{ fontFamily: 'monospace' }}>
                {patternDetails.fvg.bottom.toFixed(8)} - {patternDetails.fvg.top.toFixed(8)}
              </span>
            </div>
          )}

          {patternDetails?.orderBlock && (
            <div>
              <span style={{ color: '#ec4899', fontWeight: '600' }}>··· Order Block: </span>
              <span style={{ fontFamily: 'monospace' }}>
                {patternDetails.orderBlock.bottom.toFixed(8)} - {patternDetails.orderBlock.top.toFixed(8)}
              </span>
            </div>
          )}

          {patternDetails?.liquiditySweep && (
            <div>
              <span style={{ color: '#06b6d4', fontWeight: '600' }}>··· Liquidity Sweep: </span>
              <span style={{ fontFamily: 'monospace' }}>{patternDetails.liquiditySweep.swingLevel.toFixed(8)}</span>
            </div>
          )}

          {patternDetails?.bms && (
            <div>
              <span style={{ color: '#f43f5e', fontWeight: '600' }}>━ ━ BMS Level: </span>
              <span style={{ fontFamily: 'monospace' }}>{patternDetails.bms.breakLevel.toFixed(8)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatternChart;
