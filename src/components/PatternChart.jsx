import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { getBinanceKlines } from '../services/binanceClient.js';

const PatternChart = ({ symbol, timeframe, patternDetails, entry, stopLoss, takeProfit, direction, htfData, htfTimeframe, structureAnalysis }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ohlcData, setOhlcData] = useState(null);
  const [visualizationLimits, setVisualizationLimits] = useState(null);

  // Convert timeframe to Binance API interval
  const getInterval = (tf) => {
    const map = {
      '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h',
      '4h': '4h', '1d': '1d', '1w': '1w', '1M': '1M'
    };
    return map[tf] || '1d';
  };

  // Fetch visualization limits from settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/settings');
        const data = await response.json();

        // Extract visualization limits or use defaults
        const limits = data.visualizationLimits || {
          maxFVGs: 3,
          maxOrderBlocks: 3,
          maxCHOCH: 2,
          maxBOS: 2,
          maxCandlesBack: 50,
          maxDistancePercent: 10
        };

        setVisualizationLimits(limits);
      } catch (err) {
        console.error('Error fetching visualization limits:', err);
        // Use defaults if fetch fails
        setVisualizationLimits({
          maxFVGs: 3,
          maxOrderBlocks: 3,
          maxCHOCH: 2,
          maxBOS: 2,
          maxCandlesBack: 50,
          maxDistancePercent: 10
        });
      }
    };

    fetchSettings();
  }, []);

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

        // Helper function to get end time by counting actual candles (not time-based)
        const getEndTimeAfterCandles = (startTime, candleCount) => {
          const startIndex = candlestickData.findIndex(c => c.time >= startTime);
          if (startIndex === -1) return startTime;
          const endIndex = Math.min(startIndex + candleCount, candlestickData.length - 1);
          return candlestickData[endIndex].time;
        };

        // Get the latest timestamp for pattern markers
        const latestTime = candlestickData[candlestickData.length - 1].time;
        const latestPrice = latestCandle.close;
        const latestCandleIndex = candlestickData.length - 1;

        /**
         * Filter patterns based on visualization limits
         * @param {Array} patterns - Array of patterns to filter
         * @param {number} maxCount - Maximum number of patterns to show
         * @returns {Array} Filtered patterns
         */
        const filterPatterns = (patterns, maxCount) => {
          if (!patterns || patterns.length === 0 || !visualizationLimits) {
            return patterns || [];
          }

          // Filter by distance from current price
          const filteredByDistance = patterns.filter(pattern => {
            // Calculate midpoint of pattern zone
            const patternMidpoint = (pattern.top + pattern.bottom) / 2;
            const distancePercent = Math.abs((patternMidpoint - latestPrice) / latestPrice * 100);

            return distancePercent <= visualizationLimits.maxDistancePercent;
          });

          // Filter by recency (candles back from current)
          const filteredByRecency = filteredByDistance.filter(pattern => {
            if (!pattern.timestamp) return true; // Keep patterns without timestamp

            const patternTime = new Date(pattern.timestamp).getTime() / 1000;
            const patternIndex = candlestickData.findIndex(c => c.time >= patternTime);

            if (patternIndex === -1) return true; // Keep if can't find index

            const candlesBack = latestCandleIndex - patternIndex;
            return candlesBack <= visualizationLimits.maxCandlesBack;
          });

          // Sort by recency (most recent first) and take only maxCount
          const sorted = filteredByRecency.sort((a, b) => {
            const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return bTime - aTime; // Most recent first
          });

          return sorted.slice(0, maxCount);
        };

        /**
         * Filter structure events (CHoCH, BOS) based on visualization limits
         * @param {Array} events - Array of structure events to filter
         * @param {number} maxCount - Maximum number of events to show
         * @returns {Array} Filtered events
         */
        const filterStructureEvents = (events, maxCount) => {
          if (!events || events.length === 0 || !visualizationLimits) {
            return events || [];
          }

          // Filter by distance from current price
          const filteredByDistance = events.filter(event => {
            const distancePercent = Math.abs((event.brokenLevel - latestPrice) / latestPrice * 100);
            return distancePercent <= visualizationLimits.maxDistancePercent;
          });

          // Filter by recency (candles back from current)
          const filteredByRecency = filteredByDistance.filter(event => {
            if (!event.timestamp) return true; // Keep events without timestamp

            const eventTime = new Date(event.timestamp).getTime() / 1000;
            const eventIndex = candlestickData.findIndex(c => c.time >= eventTime);

            if (eventIndex === -1) return true; // Keep if can't find index

            const candlesBack = latestCandleIndex - eventIndex;
            return candlesBack <= visualizationLimits.maxCandlesBack;
          });

          // Sort by recency (most recent first) and take only maxCount
          const sorted = filteredByRecency.sort((a, b) => {
            const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return bTime - aTime; // Most recent first
          });

          return sorted.slice(0, maxCount);
        };

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

        // Draw FVG zone as filled rectangle (time-limited to 25 candles)
        if (patternDetails?.fvg) {
          const fvgTop = patternDetails.fvg.top;
          const fvgBottom = patternDetails.fvg.bottom;
          const fvgTimestamp = patternDetails.fvg.timestamp
            ? new Date(patternDetails.fvg.timestamp).getTime() / 1000
            : null;

          if (fvgTimestamp) {
            const fvgEndTime = getEndTimeAfterCandles(fvgTimestamp, 25); // 25 actual candles

            // Draw FVG top boundary line (limited duration)
            const fvgTopLine = chart.addLineSeries({
              color: '#8b5cf6',
              lineWidth: 1,
              lineStyle: 2, // Dashed
              lastValueVisible: false,
              priceLineVisible: false,
            });
            fvgTopLine.setData([
              { time: fvgTimestamp, value: parseFloat(fvgTop) },
              { time: fvgEndTime, value: parseFloat(fvgTop) }
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
              { time: fvgTimestamp, value: parseFloat(fvgBottom) },
              { time: fvgEndTime, value: parseFloat(fvgBottom) }
            ]);

            // Simply use price range with the boundary lines (the shaded histogram doesn't render well)
            // The dashed boundary lines above and below will clearly mark the FVG zone

            // Add FVG label at midpoint
            const fvgMidpoint = (parseFloat(fvgTop) + parseFloat(fvgBottom)) / 2;
            const labelTime = fvgTimestamp + ((fvgEndTime - fvgTimestamp) / 2);

            const fvgLabel = chart.addLineSeries({
              color: 'transparent',
              lineWidth: 0,
              priceLineVisible: false,
              lastValueVisible: false,
            });

            fvgLabel.setMarkers([{
              time: labelTime,
              position: 'inBar',
              color: '#8b5cf6',
              shape: 'circle',
              text: 'FVG',
              size: 0.5
            }]);
          }
        }

        // Draw HTF FVG zones as filled rectangles (if present)
        if (htfData?.fvgs) {
          // Draw HTF Bullish FVGs (for bullish signals)
          if (direction === 'bullish' && htfData.fvgs.bullish && htfData.fvgs.bullish.length > 0) {
            const filteredBullishFVGs = filterPatterns(
              htfData.fvgs.bullish,
              visualizationLimits?.maxFVGs || 3
            );
            filteredBullishFVGs.forEach((fvg, index) => {
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
            const filteredBearishFVGs = filterPatterns(
              htfData.fvgs.bearish,
              visualizationLimits?.maxFVGs || 3
            );
            filteredBearishFVGs.forEach((fvg, index) => {
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

        // Draw Order Block zone as filled rectangle (time-limited to 25 candles)
        if (patternDetails?.orderBlock) {
          const obTop = patternDetails.orderBlock.top;
          const obBottom = patternDetails.orderBlock.bottom;
          const obTimestamp = patternDetails.orderBlock.timestamp
            ? new Date(patternDetails.orderBlock.timestamp).getTime() / 1000
            : null;

          if (obTimestamp) {
            const obEndTime = getEndTimeAfterCandles(obTimestamp, 25); // 25 actual candles

            // Draw OB top boundary line (limited duration)
            const obTopLine = chart.addLineSeries({
              color: '#ec4899',
              lineWidth: 1,
              lineStyle: 2, // Dashed
              lastValueVisible: false,
              priceLineVisible: false,
            });
            obTopLine.setData([
              { time: obTimestamp, value: parseFloat(obTop) },
              { time: obEndTime, value: parseFloat(obTop) }
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
              { time: obTimestamp, value: parseFloat(obBottom) },
              { time: obEndTime, value: parseFloat(obBottom) }
            ]);

            // Simply use price range with the boundary lines (the shaded histogram doesn't render well)
            // The dashed boundary lines above and below will clearly mark the OB zone

            // Add OB label at midpoint
            const obMidpoint = (parseFloat(obTop) + parseFloat(obBottom)) / 2;
            const obLabelTime = obTimestamp + ((obEndTime - obTimestamp) / 2);

            const obLabel = chart.addLineSeries({
              color: 'transparent',
              lineWidth: 0,
              priceLineVisible: false,
              lastValueVisible: false,
            });

            obLabel.setMarkers([{
              time: obLabelTime,
              position: 'inBar',
              color: '#ec4899',
              shape: 'circle',
              text: 'OB',
              size: 0.5
            }]);
          }
        }

        // Draw HTF Order Block zones as filled rectangles (if present)
        if (htfData?.orderBlocks) {
          // Draw HTF Bullish Order Blocks (for bullish signals)
          if (direction === 'bullish' && htfData.orderBlocks.bullish && htfData.orderBlocks.bullish.length > 0) {
            const filteredBullishOBs = filterPatterns(
              htfData.orderBlocks.bullish,
              visualizationLimits?.maxOrderBlocks || 3
            );
            filteredBullishOBs.forEach((ob, index) => {
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
            const filteredBearishOBs = filterPatterns(
              htfData.orderBlocks.bearish,
              visualizationLimits?.maxOrderBlocks || 3
            );
            filteredBearishOBs.forEach((ob, index) => {
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

        // Draw ChoCH (Change of Character) levels - time-limited (20 candles)
        if (structureAnalysis?.chochEvents && structureAnalysis.chochEvents.length > 0) {
          const filteredChochEvents = filterStructureEvents(
            structureAnalysis.chochEvents,
            visualizationLimits?.maxCHOCH || 2
          );
          filteredChochEvents.forEach((choch, index) => {
            // Add marker at the break point
            if (choch.breakCandle && choch.timestamp) {
              const chochTime = new Date(choch.timestamp).getTime() / 1000;
              const chochEndTime = getEndTimeAfterCandles(chochTime, 20); // 20 actual candles

              // Draw as time-limited line series
              const chochLine = chart.addLineSeries({
                color: '#fbbf24', // Gold for CHoCH
                lineWidth: 2,
                lineStyle: 2, // Dashed
                lastValueVisible: false,
                priceLineVisible: false,
              });
              chochLine.setData([
                { time: chochTime, value: parseFloat(choch.brokenLevel) },
                { time: chochEndTime, value: parseFloat(choch.brokenLevel) }
              ]);

              // Add circle marker
              const markerSeries = chart.addLineSeries({
                color: 'transparent',
                lineWidth: 0,
                priceLineVisible: false,
                lastValueVisible: false,
              });

              markerSeries.setMarkers([{
                time: chochTime,
                position: choch.direction === 'bullish' ? 'belowBar' : 'aboveBar',
                color: '#fbbf24',
                shape: 'circle',
                text: `CHoCH ${choch.direction === 'bullish' ? '▲' : '▼'}`,
                size: 1
              }]);
            }
          });
        }

        // Draw BOS (Break of Structure) levels - time-limited (20 candles)
        if (structureAnalysis?.bosEvents && structureAnalysis.bosEvents.length > 0) {
          const filteredBosEvents = filterStructureEvents(
            structureAnalysis.bosEvents,
            visualizationLimits?.maxBOS || 2
          );
          filteredBosEvents.forEach((bos, index) => {
            // Add marker at the break point
            if (bos.breakCandle && bos.timestamp) {
              const bosTime = new Date(bos.timestamp).getTime() / 1000;
              const bosEndTime = getEndTimeAfterCandles(bosTime, 20); // 20 actual candles

              // Draw as time-limited line series
              const bosLine = chart.addLineSeries({
                color: bos.direction === 'bullish' ? '#10b981' : '#ef4444',
                lineWidth: 2,
                lineStyle: 2, // Dashed
                lastValueVisible: false,
                priceLineVisible: false,
              });
              bosLine.setData([
                { time: bosTime, value: parseFloat(bos.brokenLevel) },
                { time: bosEndTime, value: parseFloat(bos.brokenLevel) }
              ]);

              // Add circle marker
              const markerSeries = chart.addLineSeries({
                color: 'transparent',
                lineWidth: 0,
                priceLineVisible: false,
                lastValueVisible: false,
              });

              markerSeries.setMarkers([{
                time: bosTime,
                position: bos.direction === 'bullish' ? 'belowBar' : 'aboveBar',
                color: bos.direction === 'bullish' ? '#10b981' : '#ef4444',
                shape: 'circle',
                text: `BOS ${bos.direction === 'bullish' ? '▲' : '▼'}`,
                size: 1
              }]);
            }
          });
        }

        // Draw Trading Sessions (Asia, London, New York)
        const drawTradingSessions = () => {
          /**
           * Trading Session Times (UTC+8):
           * - Asia (Tokyo): 08:00 - 17:00 (00:00 - 09:00 UTC)
           * - London: 16:00 - 01:00 (08:00 - 17:00 UTC)
           * - New York: 21:00 - 06:00 (13:00 - 22:00 UTC)
           */

          // Get today's date at midnight UTC
          const now = new Date();
          const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
          const todayMidnight = todayUTC.getTime() / 1000; // Unix timestamp in seconds

          // Define session times (in seconds from midnight UTC)
          const sessions = [
            {
              name: 'Asia',
              start: todayMidnight + (0 * 3600), // 00:00 UTC
              end: todayMidnight + (9 * 3600),   // 09:00 UTC
              color: 'rgba(59, 130, 246, 0.08)', // Blue
              borderColor: 'rgba(59, 130, 246, 0.3)'
            },
            {
              name: 'London',
              start: todayMidnight + (8 * 3600),  // 08:00 UTC
              end: todayMidnight + (17 * 3600),   // 17:00 UTC
              color: 'rgba(16, 185, 129, 0.08)', // Green
              borderColor: 'rgba(16, 185, 129, 0.3)'
            },
            {
              name: 'New York',
              start: todayMidnight + (13 * 3600), // 13:00 UTC
              end: todayMidnight + (22 * 3600),   // 22:00 UTC
              color: 'rgba(239, 68, 68, 0.08)', // Red (distinct from blue Asia and green London)
              borderColor: 'rgba(239, 68, 68, 0.3)'
            }
          ];

          // Filter candles to only include today's data
          const todayCandles = candlestickData.filter(candle => candle.time >= todayMidnight);

          if (todayCandles.length === 0) {
            console.log('No candles from today to highlight sessions');
            return;
          }

          // Get GLOBAL price range from ALL candles (not just visible ones)
          const allPrices = candlestickData.map(c => [c.high, c.low]).flat();
          const dataMaxPrice = Math.max(...allPrices);
          const dataMinPrice = Math.min(...allPrices);

          // Use extreme values to ensure session backgrounds ALWAYS fill the chart
          // This works even when the user zooms in/out
          const priceRange = dataMaxPrice - dataMinPrice;
          const maxPrice = dataMaxPrice * 1000; // Extremely high price (way above any zoom range)
          const minPrice = 0; // Zero - always below any visible price

          // Draw each session
          sessions.forEach(session => {
            // Check if this session has occurred yet or is ongoing
            const currentTime = Date.now() / 1000;
            if (currentTime < session.start) {
              // Session hasn't started yet
              return;
            }

            // Find candles within this session
            const sessionCandles = candlestickData.filter(
              candle => candle.time >= session.start && candle.time <= session.end
            );

            if (sessionCandles.length === 0) {
              return;
            }

            // Draw session background using baseline series for continuous fill (no gaps)
            // Using extremely high value (maxPrice) ensures it fills to the top of any zoom level
            // Using 0 as baseValue ensures it fills from the very bottom
            const sessionSeries = chart.addBaselineSeries({
              baseValue: { type: 'price', price: minPrice }, // Always at bottom (0)
              topLineColor: 'transparent',
              topFillColor1: session.color,
              topFillColor2: session.color,
              bottomLineColor: 'transparent',
              bottomFillColor1: 'transparent',
              bottomFillColor2: 'transparent',
              lineWidth: 0,
              priceFormat: { type: 'price' },
              priceScaleId: '', // No price scale (overlay)
              lastValueVisible: false,
              priceLineVisible: false,
            });

            // Create continuous data points for the session background
            // Each point uses maxPrice (extremely high) to fill from bottom to top
            const sessionData = sessionCandles.map(candle => ({
              time: candle.time,
              value: maxPrice // Extremely high value ensures fill to top
            }));

            sessionSeries.setData(sessionData);

            // Add session label marker
            const sessionLabelTime = session.start + ((session.end - session.start) / 2);

            const sessionLabel = chart.addLineSeries({
              color: 'transparent',
              lineWidth: 0,
              priceLineVisible: false,
              lastValueVisible: false,
            });

            sessionLabel.setMarkers([{
              time: sessionLabelTime,
              position: 'inBar',
              color: session.borderColor.replace('0.3', '0.7'),
              shape: 'circle',
              text: session.name,
              size: 0.3
            }]);

            // Calculate session high and low
            const sessionHighs = sessionCandles.map(c => c.high);
            const sessionLows = sessionCandles.map(c => c.low);
            const sessionHigh = Math.max(...sessionHighs);
            const sessionLow = Math.min(...sessionLows);

            // Draw session HIGH line
            const sessionHighLine = {
              price: sessionHigh,
              color: session.borderColor.replace('0.3', '0.8'),
              lineWidth: 2,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              title: `${session.name} High`,
            };
            candlestickSeries.createPriceLine(sessionHighLine);

            // Draw session LOW line
            const sessionLowLine = {
              price: sessionLow,
              color: session.borderColor.replace('0.3', '0.8'),
              lineWidth: 2,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              title: `${session.name} Low`,
            };
            candlestickSeries.createPriceLine(sessionLowLine);

            // Add HIGH/LOW markers at the session end
            const markerTime = Math.min(session.end, currentTime);

            const highLowMarkers = chart.addLineSeries({
              color: 'transparent',
              lineWidth: 0,
              priceLineVisible: false,
              lastValueVisible: false,
            });

            highLowMarkers.setMarkers([
              {
                time: markerTime,
                position: 'aboveBar',
                color: session.borderColor.replace('0.3', '0.9'),
                shape: 'arrowDown',
                text: `${session.name} H: ${sessionHigh.toFixed(2)}`,
                size: 0.5
              },
              {
                time: markerTime,
                position: 'belowBar',
                color: session.borderColor.replace('0.3', '0.9'),
                shape: 'arrowUp',
                text: `${session.name} L: ${sessionLow.toFixed(2)}`,
                size: 0.5
              }
            ]);
          });
        };

        // Draw trading sessions
        drawTradingSessions();

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
              <span style={{ color: '#8b5cf6', fontWeight: '600' }}>█ FVG (Fair Value Gap): </span>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
                {patternDetails.fvg.bottom.toFixed(8)} - {patternDetails.fvg.top.toFixed(8)}
              </span>
              <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>
                (Unfilled gap between 3 candles - price imbalance)
              </span>
            </div>
          )}

          {patternDetails?.orderBlock && (
            <div>
              <span style={{ color: '#ec4899', fontWeight: '600' }}>█ Order Block: </span>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
                {patternDetails.orderBlock.bottom.toFixed(8)} - {patternDetails.orderBlock.top.toFixed(8)}
              </span>
              <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>
                (Last {patternDetails.orderBlock.type === 'bullish' ? 'bearish' : 'bullish'} candle before institutional impulse)
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

        {/* Trading Sessions Section */}
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '2px solid #e5e7eb'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px', color: '#6366f1' }}>
            🌍 Trading Sessions (Current Day - UTC):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            <div>
              <span style={{
                background: 'rgba(59, 130, 246, 0.15)',
                padding: '2px 8px',
                borderRadius: '4px',
                color: '#2563eb',
                fontWeight: '600',
                fontSize: '12px'
              }}>
                █ Asia Session
              </span>
              <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '8px' }}>
                00:00 - 09:00 UTC
              </span>
            </div>
            <div>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                padding: '2px 8px',
                borderRadius: '4px',
                color: '#059669',
                fontWeight: '600',
                fontSize: '12px'
              }}>
                █ London Session
              </span>
              <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '8px' }}>
                08:00 - 17:00 UTC
              </span>
            </div>
            <div>
              <span style={{
                background: 'rgba(245, 158, 11, 0.15)',
                padding: '2px 8px',
                borderRadius: '4px',
                color: '#d97706',
                fontWeight: '600',
                fontSize: '12px'
              }}>
                █ New York Session
              </span>
              <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '8px' }}>
                13:00 - 22:00 UTC
              </span>
            </div>
            <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: '#6b7280', fontStyle: 'italic', marginTop: '8px' }}>
              <strong>Session Features:</strong>
              <br/>• Colored backgrounds mark session times
              <br/>• <strong>Dashed horizontal lines</strong> show session high and low prices
              <br/>• High/Low markers (▼ ▲) display at session end with exact values
              <br/>• Sessions overlap during London-NY hours (13:00-17:00 UTC) = highest liquidity period
            </div>
            <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)', padding: '8px', borderRadius: '4px', marginTop: '8px' }}>
              <strong>💡 Trading Tip:</strong> Session highs and lows act as key support/resistance levels. Breakouts above session highs or below session lows often signal strong momentum.
            </div>
          </div>
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
