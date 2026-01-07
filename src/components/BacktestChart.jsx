/**
 * Backtest Chart Component
 * Displays candlestick chart with trade entry/exit markers and pattern zones
 */

import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { getBinanceKlines, getBinanceKlinesWithTime } from '../services/binanceClient.js';

const BacktestChart = ({
  symbol,
  timeframe,
  trades = [],
  selectedTrade = null
}) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Convert timeframe to Binance API interval
  const getInterval = (tf) => {
    const map = {
      '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h',
      '4h': '4h', '1d': '1d', '1w': '1w', '1M': '1M'
    };
    return map[tf] || '1h';
  };

  useEffect(() => {
    if (!symbol || !timeframe) {
      console.log('BacktestChart: Missing symbol or timeframe, skipping');
      return;
    }

    if (!chartContainerRef.current) {
      console.warn('BacktestChart: Container ref not ready yet, will retry');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('BacktestChart: Fetching data for', symbol, timeframe);

        // Fetch candlestick data
        const interval = getInterval(timeframe);
        let klineData;

        // If a trade is selected, fetch historical data around that trade's time
        if (selectedTrade) {
          const tradeTime = new Date(selectedTrade.signalTime).getTime();

          // Fetch 250 candles before and 250 after the trade (total 500)
          const timeIncrement = {
            '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000,
            '4h': 14400000, '1d': 86400000
          }[timeframe] || 3600000;

          const startTime = tradeTime - (250 * timeIncrement);
          const endTime = tradeTime + (250 * timeIncrement);

          console.log('BacktestChart: Fetching historical data around trade time:', new Date(tradeTime).toISOString());

          klineData = await getBinanceKlinesWithTime(symbol, interval, startTime, endTime);
        } else {
          // No trade selected, fetch recent data
          klineData = await getBinanceKlines(symbol, interval, 500);
        }

        console.log('BacktestChart: Received', klineData.length, 'candles for', symbol);

        if (!klineData || klineData.length === 0) {
          throw new Error('No candle data received from Binance');
        }

        console.log('BacktestChart: Price range:',
          Math.min(...klineData.map(k => k.low)).toFixed(2),
          '-',
          Math.max(...klineData.map(k => k.high)).toFixed(2)
        );

        // Convert to lightweight-charts format
        const rawData = klineData.map((candle) => ({
          time: candle.openTime / 1000,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close
        }));

        // Sort by time ascending - CRITICAL for lightweight-charts
        rawData.sort((a, b) => a.time - b.time);

        // Remove duplicate timestamps (keep first occurrence)
        const seenTimes = new Set();
        const candlestickData = rawData.filter(candle => {
          if (seenTimes.has(candle.time)) {
            console.warn('BacktestChart: Duplicate timestamp removed:', candle.time, new Date(candle.time * 1000).toISOString());
            return false;
          }
          seenTimes.add(candle.time);
          return true;
        });

        console.log('BacktestChart: Data sorted, first time:',
          new Date(candlestickData[0].time * 1000).toISOString(),
          'last time:',
          new Date(candlestickData[candlestickData.length - 1].time * 1000).toISOString()
        );

        // Validate data is properly sorted
        for (let i = 1; i < candlestickData.length; i++) {
          if (candlestickData[i].time <= candlestickData[i - 1].time) {
            console.error('BacktestChart: Data NOT properly sorted at index', i,
              'current:', candlestickData[i].time, new Date(candlestickData[i].time * 1000).toISOString(),
              'previous:', candlestickData[i - 1].time, new Date(candlestickData[i - 1].time * 1000).toISOString()
            );
          }
        }

        // Remove old chart if it exists
        if (chartRef.current) {
          console.log('BacktestChart: Removing old chart');
          chartRef.current.remove();
          chartRef.current = null;
        }

        // Double-check container exists before creating chart
        if (!chartContainerRef.current) {
          console.error('BacktestChart: Container ref is null, cannot create chart');
          setError('Chart container not ready');
          setLoading(false);
          return;
        }

        // Create chart
        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth || 800,
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
            mode: 0,
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

        // Add trade markers - if a trade is selected, only show that one
        const markers = trades
          .filter(trade => {
            if (trade.symbol !== symbol) return false;

            // If a trade is selected, only show that trade's marker
            if (selectedTrade) {
              return trade.signalTime === selectedTrade.signalTime &&
                     trade.symbol === selectedTrade.symbol;
            }

            // Otherwise show all trades for this symbol
            return true;
          })
          .map(trade => {
            const isWin = trade.pnlR > 0;
            const isBuy = trade.signal?.type === 'BUY';
            const tradeType = trade.signal?.type === 'BUY' ? 'LONG' : trade.signal?.type === 'SELL' ? 'SHORT' : 'N/A';
            const pnl = trade.pnlR >= 0 ? '+' : '';

            return {
              time: Math.floor(new Date(trade.signalTime).getTime() / 1000),
              position: isBuy ? 'belowBar' : 'aboveBar',
              color: isBuy ? '#10b981' : '#ef4444', // Green for LONG, Red for SHORT
              shape: isBuy ? 'arrowUp' : 'arrowDown',
              text: `${tradeType} ${pnl}${trade.pnlR.toFixed(1)}R`
            };
          });

        // Add BOS/CHoCH structure markers if trade is selected
        if (selectedTrade && selectedTrade.symbol === symbol) {
          const structureAnalysis = selectedTrade.signal?.patternDetails?.structureAnalysis;

          // Add BOS markers
          if (structureAnalysis?.bosEvents) {
            structureAnalysis.bosEvents.forEach(bos => {
              if (bos.breakCandle?.openTime) {
                markers.push({
                  time: Math.floor(bos.breakCandle.openTime / 1000),
                  position: bos.direction === 'bullish' ? 'belowBar' : 'aboveBar',
                  color: bos.direction === 'bullish' ? '#10b981' : '#ef4444',
                  shape: 'circle',
                  text: `BOS ${bos.direction === 'bullish' ? '▲' : '▼'}`
                });
              }
            });
          }

          // Add CHoCH markers
          if (structureAnalysis?.chochEvents) {
            structureAnalysis.chochEvents.forEach(choch => {
              if (choch.breakCandle?.openTime) {
                markers.push({
                  time: Math.floor(choch.breakCandle.openTime / 1000),
                  position: choch.direction === 'bullish' ? 'belowBar' : 'aboveBar',
                  color: '#fbbf24', // Gold for CHoCH
                  shape: 'circle',
                  text: `CHoCH ${choch.direction === 'bullish' ? '▲' : '▼'}`
                });
              }
            });
          }
        }

        candlestickSeries.setMarkers(markers);

        // If a trade is selected, show its TP/SL lines and pattern zones
        if (selectedTrade && selectedTrade.symbol === symbol) {
          // Entry line
          if (selectedTrade.entry) {
            candlestickSeries.createPriceLine({
              price: parseFloat(selectedTrade.entry),
              color: '#667eea',
              lineWidth: 2,
              lineStyle: 0, // Solid
              axisLabelVisible: true,
              title: 'Entry',
            });
          }

          // Stop Loss line
          if (selectedTrade.stopLoss) {
            candlestickSeries.createPriceLine({
              price: parseFloat(selectedTrade.stopLoss),
              color: '#ef4444',
              lineWidth: 2,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              title: 'Stop Loss',
            });
          }

          // Take Profit line
          if (selectedTrade.takeProfit) {
            candlestickSeries.createPriceLine({
              price: parseFloat(selectedTrade.takeProfit),
              color: '#10b981',
              lineWidth: 2,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              title: 'Take Profit',
            });
          }

          // Exit line
          if (selectedTrade.exitPrice) {
            candlestickSeries.createPriceLine({
              price: parseFloat(selectedTrade.exitPrice),
              color: selectedTrade.pnlR > 0 ? '#10b981' : '#ef4444',
              lineWidth: 1,
              lineStyle: 1, // Dotted
              axisLabelVisible: true,
              title: 'Exit',
            });
          }

          // Add TradingView-style position projection lines
          if (selectedTrade.entry && selectedTrade.takeProfit && selectedTrade.stopLoss) {
            const isBuy = selectedTrade.signal?.type === 'BUY';
            const entryTime = Math.floor(new Date(selectedTrade.signalTime).getTime() / 1000);

            // Calculate projection end time (extend forward by ~10 candles)
            const timeIncrement = {
              '1m': 60, '5m': 300, '15m': 900, '1h': 3600,
              '4h': 14400, '1d': 86400
            }[timeframe] || 3600;
            const projectionEndTime = entryTime + (timeIncrement * 10);

            // Take Profit projection line
            const tpProjectionSeries = chart.addLineSeries({
              color: isBuy ? 'rgba(16, 185, 129, 0.5)' : 'rgba(16, 185, 129, 0.3)', // Green for TP
              lineWidth: 2,
              lineStyle: 2, // Dashed
              lastValueVisible: false,
              priceLineVisible: false,
            });
            tpProjectionSeries.setData([
              { time: entryTime, value: parseFloat(selectedTrade.entry) },
              { time: projectionEndTime, value: parseFloat(selectedTrade.takeProfit) }
            ]);

            // Stop Loss projection line
            const slProjectionSeries = chart.addLineSeries({
              color: isBuy ? 'rgba(239, 68, 68, 0.5)' : 'rgba(239, 68, 68, 0.3)', // Red for SL
              lineWidth: 2,
              lineStyle: 2, // Dashed
              lastValueVisible: false,
              priceLineVisible: false,
            });
            slProjectionSeries.setData([
              { time: entryTime, value: parseFloat(selectedTrade.entry) },
              { time: projectionEndTime, value: parseFloat(selectedTrade.stopLoss) }
            ]);
          }

          // Draw TradingView-style structure lines (limited duration)
          const structureAnalysis = selectedTrade.signal?.patternDetails?.structureAnalysis;
          const timeIncrement = {
            '1m': 60, '5m': 300, '15m': 900, '1h': 3600,
            '4h': 14400, '1d': 86400
          }[timeframe] || 3600;

          // Helper function to get end time by counting actual candles (not time-based)
          const getEndTimeAfterCandles = (startTime, candleCount) => {
            const startIndex = candlestickData.findIndex(c => c.time >= startTime);
            if (startIndex === -1) return startTime;
            const endIndex = Math.min(startIndex + candleCount, candlestickData.length - 1);
            return candlestickData[endIndex].time;
          };

          // Draw BOS (Break of Structure) level lines - limited duration (20 candles)
          if (structureAnalysis?.bosEvents && structureAnalysis.bosEvents.length > 0) {
            structureAnalysis.bosEvents.forEach(bos => {
              if (bos.breakCandle?.openTime) {
                const bosTime = Math.floor(bos.breakCandle.openTime / 1000);
                const endTime = getEndTimeAfterCandles(bosTime, 20); // 20 actual candles

                // Draw as line series for limited duration
                const bosLine = chart.addLineSeries({
                  color: bos.direction === 'bullish' ? '#10b981' : '#ef4444',
                  lineWidth: 2,
                  lineStyle: 2, // Dashed
                  lastValueVisible: false,
                  priceLineVisible: false,
                });
                bosLine.setData([
                  { time: bosTime, value: parseFloat(bos.brokenLevel) },
                  { time: endTime, value: parseFloat(bos.brokenLevel) }
                ]);
              }
            });
          }

          // Draw CHoCH (Change of Character) level lines - limited duration (20 candles)
          if (structureAnalysis?.chochEvents && structureAnalysis.chochEvents.length > 0) {
            structureAnalysis.chochEvents.forEach(choch => {
              if (choch.breakCandle?.openTime) {
                const chochTime = Math.floor(choch.breakCandle.openTime / 1000);
                const endTime = getEndTimeAfterCandles(chochTime, 20); // 20 actual candles

                // Draw as line series for limited duration
                const chochLine = chart.addLineSeries({
                  color: '#fbbf24', // Gold for CHoCH
                  lineWidth: 2,
                  lineStyle: 2, // Dashed
                  lastValueVisible: false,
                  priceLineVisible: false,
                });
                chochLine.setData([
                  { time: chochTime, value: parseFloat(choch.brokenLevel) },
                  { time: endTime, value: parseFloat(choch.brokenLevel) }
                ]);
              }
            });
          }

          // Draw FVG zone if present (TradingView style - limited duration, 25 candles)
          if (selectedTrade.signal?.patternDetails?.fvg) {
            const fvg = selectedTrade.signal.patternDetails.fvg;

            if (fvg.timestamp && fvg.top && fvg.bottom) {
              const fvgTime = Math.floor(new Date(fvg.timestamp).getTime() / 1000);
              const fvgEndTime = getEndTimeAfterCandles(fvgTime, 25); // 25 actual candles

              // Draw FVG top boundary line (limited duration)
              const fvgTopLine = chart.addLineSeries({
                color: '#8b5cf6',
                lineWidth: 1,
                lineStyle: 2, // Dashed
                lastValueVisible: false,
                priceLineVisible: false,
              });
              fvgTopLine.setData([
                { time: fvgTime, value: parseFloat(fvg.top) },
                { time: fvgEndTime, value: parseFloat(fvg.top) }
              ]);

              // Draw FVG bottom boundary line (limited duration)
              const fvgBottomLine = chart.addLineSeries({
                color: '#8b5cf6',
                lineWidth: 1,
                lineStyle: 2, // Dashed
                lastValueVisible: false,
                priceLineVisible: false,
              });
              fvgBottomLine.setData([
                { time: fvgTime, value: parseFloat(fvg.bottom) },
                { time: fvgEndTime, value: parseFloat(fvg.bottom) }
              ]);

              // Add shaded FVG zone (limited duration)
              const fvgShade = chart.addHistogramSeries({
                color: 'rgba(139, 92, 246, 0.2)',
                priceFormat: { type: 'price' },
                priceScaleId: '',
                lastValueVisible: false,
              });

              // Get exactly 25 candles for the zone (index-based, not time-based)
              const fvgStartIndex = candlestickData.findIndex(c => c.time >= fvgTime);
              const fvgZoneData = fvgStartIndex >= 0
                ? candlestickData.slice(fvgStartIndex, fvgStartIndex + 25).map(candle => ({
                    time: candle.time,
                    value: parseFloat(fvg.top),
                    color: 'rgba(139, 92, 246, 0.2)'
                  }))
                : [];

              fvgShade.setData(fvgZoneData);
              fvgShade.applyOptions({
                baseValue: { type: 'price', price: parseFloat(fvg.bottom) }
              });
            }
          }

          // Draw Order Block zone if present (TradingView style - limited duration, 25 candles)
          if (selectedTrade.signal?.patternDetails?.orderBlock) {
            const ob = selectedTrade.signal.patternDetails.orderBlock;

            if (ob.timestamp && ob.top && ob.bottom) {
              const obTime = Math.floor(new Date(ob.timestamp).getTime() / 1000);
              const obEndTime = getEndTimeAfterCandles(obTime, 25); // 25 actual candles

              // Draw OB top boundary line (limited duration)
              const obTopLine = chart.addLineSeries({
                color: '#ec4899',
                lineWidth: 1,
                lineStyle: 2, // Dashed
                lastValueVisible: false,
                priceLineVisible: false,
              });
              obTopLine.setData([
                { time: obTime, value: parseFloat(ob.top) },
                { time: obEndTime, value: parseFloat(ob.top) }
              ]);

              // Draw OB bottom boundary line (limited duration)
              const obBottomLine = chart.addLineSeries({
                color: '#ec4899',
                lineWidth: 1,
                lineStyle: 2, // Dashed
                lastValueVisible: false,
                priceLineVisible: false,
              });
              obBottomLine.setData([
                { time: obTime, value: parseFloat(ob.bottom) },
                { time: obEndTime, value: parseFloat(ob.bottom) }
              ]);

              // Add shaded OB zone (limited duration)
              const obShade = chart.addHistogramSeries({
                color: 'rgba(236, 72, 153, 0.2)',
                priceFormat: { type: 'price' },
                priceScaleId: '',
                lastValueVisible: false,
              });

              // Get exactly 25 candles for the zone (index-based, not time-based)
              const obStartIndex = candlestickData.findIndex(c => c.time >= obTime);
              const obZoneData = obStartIndex >= 0
                ? candlestickData.slice(obStartIndex, obStartIndex + 25).map(candle => ({
                    time: candle.time,
                    value: parseFloat(ob.top),
                    color: 'rgba(236, 72, 153, 0.2)'
                  }))
                : [];

              obShade.setData(obZoneData);
              obShade.applyOptions({
                baseValue: { type: 'price', price: parseFloat(ob.bottom) }
              });
            }
          }

          // Draw liquidity sweep line if present
          if (selectedTrade.signal?.patternDetails?.liquiditySweep) {
            const sweep = selectedTrade.signal.patternDetails.liquiditySweep;

            if (sweep.level) {
              candlestickSeries.createPriceLine({
                price: parseFloat(sweep.level),
                color: '#06b6d4',
                lineWidth: 2,
                lineStyle: 3, // Large dashed
                axisLabelVisible: true,
                title: 'Liquidity Sweep',
              });
            }
          }
        }

        // Fit content to chart
        chart.timeScale().fitContent();

        console.log('BacktestChart: Chart created successfully with', markers.length, 'trade markers');
        setLoading(false);
      } catch (err) {
        console.error('BacktestChart: Error loading chart:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();

    // Cleanup
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, timeframe, trades, selectedTrade]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth || 800,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (error) {
    return (
      <div
        style={{
          padding: '48px',
          textAlign: 'center',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          marginTop: '24px'
        }}
      >
        <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⚠️</div>
        <div style={{ color: '#dc2626', fontWeight: 500 }}>Error loading chart</div>
        <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '4px' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {symbol}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Timeframe: {timeframe} | Trades: {trades.filter(t => t.symbol === symbol).length}
            </div>
          </div>
          {selectedTrade && selectedTrade.symbol === symbol && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: selectedTrade.pnlR > 0 ? '#d1fae5' : '#fee2e2',
                borderRadius: '6px'
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Selected Trade</div>
              <div
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: selectedTrade.pnlR > 0 ? '#10b981' : '#ef4444'
                }}
              >
                {selectedTrade.pnlR >= 0 ? '+' : ''}{selectedTrade.pnlR.toFixed(2)}R
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        ref={chartContainerRef}
        style={{
          position: 'relative',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
          width: '100%',
          height: '500px'
        }}
      >
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              zIndex: 10,
              height: '500px'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📊</div>
              <div style={{ color: '#6b7280' }}>Loading chart...</div>
            </div>
          </div>
        )}
      </div>

      {selectedTrade && selectedTrade.symbol === symbol && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '6px'
          }}
        >
          <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>
            Trade Patterns:
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {selectedTrade.signal?.patterns?.join(', ') || 'No patterns recorded'}
          </div>
        </div>
      )}
    </div>
  );
};

export default BacktestChart;
