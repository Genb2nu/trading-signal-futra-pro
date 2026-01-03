import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { getBinanceKlines } from '../services/binanceClient.js';

const PatternChart = ({ symbol, timeframe, patternDetails, entry, stopLoss, takeProfit, direction, htfData, htfTimeframe, structureAnalysis }) => {
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

        // Fetch candlestick data directly from Binance (client-side)
        const interval = getInterval(timeframe);
        const limit = 1000; // Get last 1000 candles for full context

        const klineData = await getBinanceKlines(symbol, interval, limit);

        // Convert to lightweight-charts format
        const candlestickData = klineData.map((candle) => ({
          time: candle.openTime / 1000, // Convert to seconds
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close
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
        const volumeData = klineData.map((candle) => ({
          time: candle.openTime / 1000,
          value: candle.volume,
          color: candle.close >= candle.open ? '#10b98180' : '#ef444480' // Green if close >= open, red otherwise
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

        // Draw FVG zone as filled rectangle
        if (patternDetails?.fvg) {
          const fvgTop = patternDetails.fvg.top;
          const fvgBottom = patternDetails.fvg.bottom;
          const fvgTimestamp = patternDetails.fvg.timestamp
            ? new Date(patternDetails.fvg.timestamp).getTime() / 1000
            : null;

          // Create filled area series for FVG zone
          const fvgAreaSeries = chart.addLineSeries({
            color: '#8b5cf6',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });

          // Only draw zone from FVG formation time onwards
          const fvgTopData = candlestickData
            .filter(candle => !fvgTimestamp || candle.time >= fvgTimestamp)
            .map(candle => ({
              time: candle.time,
              value: fvgTop
            }));

          fvgAreaSeries.setData(fvgTopData);

          // Create baseline at bottom price to fill the zone
          fvgAreaSeries.applyOptions({
            lineWidth: 0,
            color: 'transparent',
            priceFormat: {
              type: 'price',
              precision: 8,
              minMove: 0.00000001,
            },
          });

          fvgAreaSeries.createPriceLine({
            price: fvgTop,
            color: '#8b5cf6',
            lineWidth: 1,
            lineStyle: 1, // Dotted
            axisLabelVisible: false,
            title: 'FVG Top',
          });

          fvgAreaSeries.createPriceLine({
            price: fvgBottom,
            color: '#8b5cf6',
            lineWidth: 1,
            lineStyle: 1, // Dotted
            axisLabelVisible: false,
            title: 'FVG Bottom',
          });

          // Add shaded area using histogram series
          const fvgShade = chart.addHistogramSeries({
            color: 'rgba(139, 92, 246, 0.15)', // Purple with transparency
            priceFormat: {
              type: 'price',
            },
            priceScaleId: '',
            lastValueVisible: false,
          });

          // Create histogram data for the zone (only from FVG formation time)
          const fvgZoneData = candlestickData
            .filter(candle => !fvgTimestamp || candle.time >= fvgTimestamp)
            .map(candle => ({
              time: candle.time,
              value: fvgTop,
              color: 'rgba(139, 92, 246, 0.15)'
            }));

          fvgShade.setData(fvgZoneData);

          // Set baseline to create filled area
          fvgShade.applyOptions({
            baseValue: {
              type: 'price',
              price: fvgBottom
            }
          });
        }

        // Draw HTF FVG zones as filled rectangles (if present)
        if (htfData?.fvgs) {
          // Draw HTF Bullish FVGs (for bullish signals)
          if (direction === 'bullish' && htfData.fvgs.bullish && htfData.fvgs.bullish.length > 0) {
            htfData.fvgs.bullish.slice(0, 3).forEach((fvg, index) => {
              // Add shaded area for HTF FVG
              const htfFvgShade = chart.addHistogramSeries({
                color: 'rgba(34, 197, 94, 0.12)', // Light green with transparency
                priceFormat: { type: 'price' },
                priceScaleId: '',
                lastValueVisible: false,
              });

              const htfFvgTimestamp = fvg.timestamp
                ? new Date(fvg.timestamp).getTime() / 1000
                : null;

              const htfFvgZoneData = candlestickData
                .filter(candle => !htfFvgTimestamp || candle.time >= htfFvgTimestamp)
                .map(candle => ({
                  time: candle.time,
                  value: fvg.top,
                  color: 'rgba(34, 197, 94, 0.12)'
                }));

              htfFvgShade.setData(htfFvgZoneData);
              htfFvgShade.applyOptions({
                baseValue: { type: 'price', price: fvg.bottom }
              });

              // Add border lines
              candlestickSeries.createPriceLine({
                price: fvg.top,
                color: 'rgba(34, 197, 94, 0.6)',
                lineWidth: 1,
                lineStyle: 3, // Dashed
                axisLabelVisible: false,
                title: index === 0 ? 'HTF FVG' : '',
              });

              candlestickSeries.createPriceLine({
                price: fvg.bottom,
                color: 'rgba(34, 197, 94, 0.6)',
                lineWidth: 1,
                lineStyle: 3, // Dashed
                axisLabelVisible: false,
                title: '',
              });
            });
          }

          // Draw HTF Bearish FVGs (for bearish signals)
          if (direction === 'bearish' && htfData.fvgs.bearish && htfData.fvgs.bearish.length > 0) {
            htfData.fvgs.bearish.slice(0, 3).forEach((fvg, index) => {
              // Add shaded area for HTF FVG
              const htfFvgShade = chart.addHistogramSeries({
                color: 'rgba(239, 68, 68, 0.12)', // Light red with transparency
                priceFormat: { type: 'price' },
                priceScaleId: '',
                lastValueVisible: false,
              });

              const htfFvgTimestamp = fvg.timestamp
                ? new Date(fvg.timestamp).getTime() / 1000
                : null;

              const htfFvgZoneData = candlestickData
                .filter(candle => !htfFvgTimestamp || candle.time >= htfFvgTimestamp)
                .map(candle => ({
                  time: candle.time,
                  value: fvg.top,
                  color: 'rgba(239, 68, 68, 0.12)'
                }));

              htfFvgShade.setData(htfFvgZoneData);
              htfFvgShade.applyOptions({
                baseValue: { type: 'price', price: fvg.bottom }
              });

              // Add border lines
              candlestickSeries.createPriceLine({
                price: fvg.top,
                color: 'rgba(239, 68, 68, 0.6)',
                lineWidth: 1,
                lineStyle: 3, // Dashed
                axisLabelVisible: false,
                title: index === 0 ? 'HTF FVG' : '',
              });

              candlestickSeries.createPriceLine({
                price: fvg.bottom,
                color: 'rgba(239, 68, 68, 0.6)',
                lineWidth: 1,
                lineStyle: 3, // Dashed
                axisLabelVisible: false,
                title: '',
              });
            });
          }
        }

        // Draw Order Block zone as filled rectangle
        if (patternDetails?.orderBlock) {
          const obTop = patternDetails.orderBlock.top;
          const obBottom = patternDetails.orderBlock.bottom;
          const obTimestamp = patternDetails.orderBlock.timestamp
            ? new Date(patternDetails.orderBlock.timestamp).getTime() / 1000
            : null;

          // Add shaded area for Order Block
          const obShade = chart.addHistogramSeries({
            color: 'rgba(236, 72, 153, 0.15)', // Pink with transparency
            priceFormat: { type: 'price' },
            priceScaleId: '',
            lastValueVisible: false,
          });

          // Only draw zone from Order Block formation time onwards
          const obZoneData = candlestickData
            .filter(candle => !obTimestamp || candle.time >= obTimestamp)
            .map(candle => ({
              time: candle.time,
              value: obTop,
              color: 'rgba(236, 72, 153, 0.15)'
            }));

          obShade.setData(obZoneData);
          obShade.applyOptions({
            baseValue: { type: 'price', price: obBottom }
          });

          // Add border lines
          candlestickSeries.createPriceLine({
            price: obTop,
            color: '#ec4899',
            lineWidth: 1,
            lineStyle: 1, // Dotted
            axisLabelVisible: false,
            title: 'OB Top',
          });

          candlestickSeries.createPriceLine({
            price: obBottom,
            color: '#ec4899',
            lineWidth: 1,
            lineStyle: 1, // Dotted
            axisLabelVisible: false,
            title: 'OB Bottom',
          });
        }

        // Draw HTF Order Block zones as filled rectangles (if present)
        if (htfData?.orderBlocks) {
          // Draw HTF Bullish Order Blocks (for bullish signals)
          if (direction === 'bullish' && htfData.orderBlocks.bullish && htfData.orderBlocks.bullish.length > 0) {
            htfData.orderBlocks.bullish.slice(0, 3).forEach((ob, index) => {
              // Add shaded area for HTF Order Block
              const htfOBShade = chart.addHistogramSeries({
                color: 'rgba(34, 197, 94, 0.1)', // Light green with transparency
                priceFormat: { type: 'price' },
                priceScaleId: '',
                lastValueVisible: false,
              });

              const htfOBTimestamp = ob.timestamp
                ? new Date(ob.timestamp).getTime() / 1000
                : null;

              const htfOBZoneData = candlestickData
                .filter(candle => !htfOBTimestamp || candle.time >= htfOBTimestamp)
                .map(candle => ({
                  time: candle.time,
                  value: ob.top,
                  color: 'rgba(34, 197, 94, 0.1)'
                }));

              htfOBShade.setData(htfOBZoneData);
              htfOBShade.applyOptions({
                baseValue: { type: 'price', price: ob.bottom }
              });

              // Add border lines
              candlestickSeries.createPriceLine({
                price: ob.top,
                color: 'rgba(34, 197, 94, 0.7)',
                lineWidth: 2,
                lineStyle: 3, // Dashed
                axisLabelVisible: index === 0,
                title: 'HTF OB',
              });

              candlestickSeries.createPriceLine({
                price: ob.bottom,
                color: 'rgba(34, 197, 94, 0.7)',
                lineWidth: 2,
                lineStyle: 3, // Dashed
                axisLabelVisible: false,
                title: '',
              });
            });
          }

          // Draw HTF Bearish Order Blocks (for bearish signals)
          if (direction === 'bearish' && htfData.orderBlocks.bearish && htfData.orderBlocks.bearish.length > 0) {
            htfData.orderBlocks.bearish.slice(0, 3).forEach((ob, index) => {
              // Add shaded area for HTF Order Block
              const htfOBShade = chart.addHistogramSeries({
                color: 'rgba(239, 68, 68, 0.1)', // Light red with transparency
                priceFormat: { type: 'price' },
                priceScaleId: '',
                lastValueVisible: false,
              });

              const htfOBTimestamp = ob.timestamp
                ? new Date(ob.timestamp).getTime() / 1000
                : null;

              const htfOBZoneData = candlestickData
                .filter(candle => !htfOBTimestamp || candle.time >= htfOBTimestamp)
                .map(candle => ({
                  time: candle.time,
                  value: ob.top,
                  color: 'rgba(239, 68, 68, 0.1)'
                }));

              htfOBShade.setData(htfOBZoneData);
              htfOBShade.applyOptions({
                baseValue: { type: 'price', price: ob.bottom }
              });

              // Add border lines
              candlestickSeries.createPriceLine({
                price: ob.top,
                color: 'rgba(239, 68, 68, 0.7)',
                lineWidth: 2,
                lineStyle: 3, // Dashed
                axisLabelVisible: index === 0,
                title: 'HTF OB',
              });

              candlestickSeries.createPriceLine({
                price: ob.bottom,
                color: 'rgba(239, 68, 68, 0.7)',
                lineWidth: 2,
                lineStyle: 3, // Dashed
                axisLabelVisible: false,
                title: '',
              });
            });
          }
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

        // Draw ChoCH (Change of Character) levels
        if (structureAnalysis?.chochEvents && structureAnalysis.chochEvents.length > 0) {
          structureAnalysis.chochEvents.forEach((choch, index) => {
            const chochLine = {
              price: choch.brokenLevel,
              color: '#f59e0b', // Amber for ChoCH
              lineWidth: 2,
              lineStyle: 1, // Dotted
              axisLabelVisible: index === 0, // Only show label for first ChoCH
              title: index === 0 ? 'ChoCH' : '',
            };

            candlestickSeries.createPriceLine(chochLine);

            // Add marker at the break point
            if (choch.breakCandle && choch.timestamp) {
              const markerTime = new Date(choch.timestamp).getTime() / 1000;
              const markerSeries = chart.addLineSeries({
                color: 'transparent',
                lineWidth: 0,
                priceLineVisible: false,
                lastValueVisible: false,
              });

              markerSeries.setMarkers([{
                time: markerTime,
                position: direction === 'bullish' ? 'belowBar' : 'aboveBar',
                color: '#f59e0b',
                shape: 'circle',
                text: 'ChoCH',
                size: 1
              }]);
            }
          });
        }

        // Draw BOS (Break of Structure) levels
        if (structureAnalysis?.bosEvents && structureAnalysis.bosEvents.length > 0) {
          structureAnalysis.bosEvents.forEach((bos, index) => {
            const bosLine = {
              price: bos.brokenLevel,
              color: '#10b981', // Green for BOS (continuation)
              lineWidth: 2,
              lineStyle: 3, // Dashed
              axisLabelVisible: index === 0, // Only show label for first BOS
              title: index === 0 ? 'BOS' : '',
            };

            candlestickSeries.createPriceLine(bosLine);

            // Add marker at the break point
            if (bos.breakCandle && bos.timestamp) {
              const markerTime = new Date(bos.timestamp).getTime() / 1000;
              const markerSeries = chart.addLineSeries({
                color: 'transparent',
                lineWidth: 0,
                priceLineVisible: false,
                lastValueVisible: false,
              });

              markerSeries.setMarkers([{
                time: markerTime,
                position: direction === 'bullish' ? 'belowBar' : 'aboveBar',
                color: '#10b981',
                shape: 'square',
                text: 'BOS',
                size: 1
              }]);
            }
          });
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
  }, [symbol, timeframe, patternDetails, entry, stopLoss, takeProfit, direction, htfData, htfTimeframe]);

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
          <div>
            <span style={{ fontWeight: '600' }}>ChoCH: </span>
            <span style={{ color: structureAnalysis?.chochEvents?.length > 0 ? '#10b981' : '#ef4444' }}>
              {structureAnalysis?.chochEvents?.length > 0 ? `✓ Detected (${structureAnalysis.chochEvents.length})` : '✗ Not Detected'}
            </span>
          </div>
          <div>
            <span style={{ fontWeight: '600' }}>BOS: </span>
            <span style={{ color: structureAnalysis?.bosEvents?.length > 0 ? '#10b981' : '#ef4444' }}>
              {structureAnalysis?.bosEvents?.length > 0 ? `✓ Detected (${structureAnalysis.bosEvents.length})` : '✗ Not Detected'}
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
              <span style={{ color: '#8b5cf6', fontWeight: '600' }}>█ FVG Zone: </span>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
                {patternDetails.fvg.bottom.toFixed(8)} - {patternDetails.fvg.top.toFixed(8)}
              </span>
            </div>
          )}

          {patternDetails?.orderBlock && (
            <div>
              <span style={{ color: '#ec4899', fontWeight: '600' }}>█ Order Block: </span>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
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

          {structureAnalysis?.chochEvents && structureAnalysis.chochEvents.length > 0 && (
            <div>
              <span style={{ color: '#f59e0b', fontWeight: '600' }}>··· ChoCH Levels: </span>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
                {structureAnalysis.chochEvents.map(e => e.brokenLevel.toFixed(8)).join(', ')}
              </span>
            </div>
          )}

          {structureAnalysis?.bosEvents && structureAnalysis.bosEvents.length > 0 && (
            <div>
              <span style={{ color: '#10b981', fontWeight: '600' }}>━ ━ BOS Levels: </span>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
                {structureAnalysis.bosEvents.map(e => e.brokenLevel.toFixed(8)).join(', ')}
              </span>
            </div>
          )}

          {patternDetails?.bms && (
            <div>
              <span style={{ color: '#f43f5e', fontWeight: '600' }}>━ ━ BMS Level: </span>
              <span style={{ fontFamily: 'monospace' }}>{patternDetails.bms.breakLevel.toFixed(8)}</span>
            </div>
          )}
        </div>

        {/* HTF Patterns Section */}
        {htfData && (htfData.orderBlocks || htfData.fvgs) && (
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '2px solid #e5e7eb'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: '#1e40af' }}>
              Higher Timeframe ({htfTimeframe}) Patterns:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              {/* HTF Order Blocks */}
              {direction === 'bullish' && htfData.orderBlocks?.bullish && htfData.orderBlocks.bullish.length > 0 && (
                <div>
                  <span style={{ color: 'rgba(34, 197, 94, 0.8)', fontWeight: '600' }}>█ HTF Order Blocks: </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
                    {htfData.orderBlocks.bullish.length} zones
                  </span>
                </div>
              )}
              {direction === 'bearish' && htfData.orderBlocks?.bearish && htfData.orderBlocks.bearish.length > 0 && (
                <div>
                  <span style={{ color: 'rgba(239, 68, 68, 0.8)', fontWeight: '600' }}>█ HTF Order Blocks: </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
                    {htfData.orderBlocks.bearish.length} zones
                  </span>
                </div>
              )}

              {/* HTF FVGs */}
              {direction === 'bullish' && htfData.fvgs?.bullish && htfData.fvgs.bullish.length > 0 && (
                <div>
                  <span style={{ color: 'rgba(34, 197, 94, 0.8)', fontWeight: '600' }}>█ HTF FVG Zones: </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
                    {htfData.fvgs.bullish.length} zones
                  </span>
                </div>
              )}
              {direction === 'bearish' && htfData.fvgs?.bearish && htfData.fvgs.bearish.length > 0 && (
                <div>
                  <span style={{ color: 'rgba(239, 68, 68, 0.8)', fontWeight: '600' }}>█ HTF FVG Zones: </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
                    {htfData.fvgs.bearish.length} zones
                  </span>
                </div>
              )}

              {/* HTF Legend Note */}
              <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                Note: HTF patterns shown as shaded zones (█) with dashed borders for visual distinction
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatternChart;
