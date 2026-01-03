import React, { useRef, useState, useEffect } from 'react';
import Modal from './Modal';
import PatternChart from './PatternChart';
import { getHTFTimeframe } from '../shared/strategyConfig';
import html2canvas from 'html2canvas';

const SignalDetailsModal = ({ isOpen, onClose, signal }) => {
  const modalContentRef = useRef(null);
  const shareMenuRef = useRef(null);
  const [showShareMenu, setShowShareMenu] = useState(false);

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
        setShowShareMenu(false);
      }
    };

    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showShareMenu]);

  // Early return AFTER all hooks
  if (!signal) return null;

  const {
    symbol, timeframe, type, entry, stopLoss, takeProfit,
    confidence, patterns, patternDetails, confluenceReason, riskRewardBreakdown,
    // NEW ENHANCED FIELDS
    premiumDiscount, ote, structureAnalysis, liquidityAnalysis,
    fvgStatus, orderBlockDetails, volumeAnalysis, entryTiming,
    confluenceScore, riskManagement,
    // HTF FIELDS
    htfAlignment, htfTimeframe, htfData
  } = signal;

  // Generate canvas from modal content
  const generateCanvas = async () => {
    if (!modalContentRef.current) return null;

    try {
      const canvas = await html2canvas(modalContentRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true,
        windowWidth: modalContentRef.current.scrollWidth,
        windowHeight: modalContentRef.current.scrollHeight
      });
      return canvas;
    } catch (error) {
      console.error('Error generating canvas:', error);
      alert('Failed to generate image. Please try again.');
      return null;
    }
  };

  // Download as image
  const handleDownloadImage = async () => {
    const canvas = await generateCanvas();
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      link.download = `${symbol}_${type}_Signal_${timeframe}_${timestamp}.png`;
      link.href = url;
      link.click();

      URL.revokeObjectURL(url);
      setShowShareMenu(false);
    }, 'image/png');
  };

  // Share to Telegram
  const handleShareToTelegram = async () => {
    const shareText = `📊 *${symbol} ${type} Signal*\n\nTimeframe: ${timeframe}\nConfluence Score: ${confluenceScore}/145\nTier: ${confidence?.toUpperCase() || 'STANDARD'}\nEntry: ${entry}\nStop Loss: ${stopLoss}\nTake Profit: ${takeProfit}\nR:R: 1:${signal.riskReward || 2.0}`;
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(shareText)}`;
    window.open(telegramUrl, '_blank');
    setShowShareMenu(false);
  };

  // Share to WhatsApp
  const handleShareToWhatsApp = async () => {
    const shareText = `📊 *${symbol} ${type} Signal*\n\nTimeframe: ${timeframe}\nConfluence: ${confluenceScore}/145 (${confidence?.toUpperCase()})\nEntry: ${entry}\nStop Loss: ${stopLoss}\nTake Profit: ${takeProfit}\nR:R: 1:${signal.riskReward || 2.0}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank');
    setShowShareMenu(false);
  };

  // Share to Facebook Messenger
  const handleShareToMessenger = async () => {
    const shareText = `📊 ${symbol} ${type} Signal\n\nTimeframe: ${timeframe}\nConfluence: ${confluenceScore}/145 (${confidence?.toUpperCase()})\nEntry: ${entry}\nStop Loss: ${stopLoss}\nTake Profit: ${takeProfit}\nR:R: 1:${signal.riskReward || 2.0}`;
    // Facebook Messenger share dialog
    const messengerUrl = `fb-messenger://share/?link=${encodeURIComponent(window.location.href)}&app_id=`;
    // Fallback to Facebook dialog for web
    const fbUrl = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(window.location.href)}&redirect_uri=${encodeURIComponent(window.location.href)}`;

    // Try to open Messenger app first, fallback to web dialog
    window.open(fbUrl, '_blank');
    setShowShareMenu(false);
  };

  // Ensure patterns is always an array (handle both string and array cases)
  const patternsArray = Array.isArray(patterns)
    ? patterns
    : (typeof patterns === 'string' && patterns.length > 0)
    ? patterns.split(', ').map(p => p.trim())
    : [];

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
      <div ref={modalContentRef}>
        {/* Timeframe Info with HTF Badge */}
        <div style={{ marginBottom: '15px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            Timeframe: <strong>{timeframe}</strong>
          </span>
          {htfTimeframe && (
            <span style={{
              fontSize: '11px',
              padding: '3px 8px',
              background: '#dbeafe',
              color: '#1e40af',
              borderRadius: '4px',
              fontWeight: '600'
            }}>
              HTF: {htfTimeframe}
            </span>
          )}
        </div>
      </div>

      {/* Confluence Score Badge */}
      {confluenceScore !== undefined && (
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            padding: '12px 24px',
            borderRadius: '8px',
            background: confluenceScore >= 85 ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' :
                        confluenceScore >= 60 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
                        'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '18px',
            boxShadow: confluenceScore >= 85 ? '0 4px 12px rgba(251, 191, 36, 0.4)' :
                       confluenceScore >= 60 ? '0 4px 12px rgba(16, 185, 129, 0.3)' :
                       '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}>
            {confluenceScore >= 85 ? '⭐' : confluenceScore >= 60 ? '✓' : '−'} Confluence Score: {confluenceScore}/145
            <span style={{ marginLeft: '12px', fontSize: '14px', opacity: 0.9 }}>
              ({confidence?.toUpperCase() || 'STANDARD'} TIER)
            </span>
          </div>
        </div>
      )}

      {/* HTF Confluence Breakdown */}
      {confluenceScore !== undefined && (
        <div style={{ marginBottom: '20px', padding: '20px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h4 style={{ marginBottom: '15px', fontSize: '16px', fontWeight: '600', color: '#111827' }}>
            📊 Confluence Breakdown
          </h4>

          <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
            {/* Base Timeframe Components */}
            <div style={{ marginBottom: '15px' }}>
              <strong style={{ color: '#374151' }}>Base Timeframe ({timeframe}) Components:</strong>
              <div style={{ marginLeft: '20px', marginTop: '8px', color: '#6b7280' }}>
                {patternDetails?.fvg && <div>✓ Fair Value Gap: +25 pts</div>}
                {patternDetails?.liquiditySweep && <div>✓ Liquidity Sweep: +20 pts</div>}
                {patternDetails?.bos && <div>✓ Break of Structure: +20 pts</div>}
                {(premiumDiscount?.zone === 'premium' || premiumDiscount?.zone === 'discount') && <div>✓ Premium/Discount Zone: +20 pts</div>}
                {volumeAnalysis?.confirmation === 'strong' && <div>✓ Volume Confirmation (Strong): +15 pts</div>}
                {volumeAnalysis?.confirmation === 'moderate' && <div>✓ Volume Confirmation (Moderate): +10 pts</div>}
                {ote?.currentPriceInOTE && <div>✓ Optimal Trade Entry (OTE): +10 pts</div>}
                {orderBlockDetails?.type === 'breakerBlock' && <div>✓ Breaker Block: +10 pts</div>}
                {structureAnalysis?.bmsDetected && <div>✓ Market Structure Break (BMS): +10 pts</div>}
              </div>
            </div>

            {/* HTF Components */}
            {htfAlignment && (htfAlignment.hasHTFOB || htfAlignment.hasHTFFVG || htfAlignment.hasHTFZone || htfAlignment.hasHTFStructure) && (
              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: '#1e40af' }}>Higher Timeframe ({htfTimeframe || getHTFTimeframe(timeframe)}) Components:</strong>
                <div style={{ marginLeft: '20px', marginTop: '8px', color: '#3b82f6' }}>
                  {htfAlignment.hasHTFOB && <div>✓ HTF Order Block Alignment: +15 pts</div>}
                  {htfAlignment.hasHTFFVG && <div>✓ HTF FVG Targeting: +10 pts</div>}
                  {htfAlignment.hasHTFZone && <div>✓ HTF Zone Alignment: +10 pts</div>}
                  {htfAlignment.hasHTFStructure && <div>✓ HTF Structure Alignment: +10 pts</div>}
                </div>
              </div>
            )}

            {/* Total Score */}
            <div style={{
              marginTop: '15px',
              paddingTop: '15px',
              borderTop: '2px solid #e5e7eb',
              fontWeight: '700',
              fontSize: '14px',
              color: confluenceScore >= 100 ? '#1e40af' : '#374151'
            }}>
              Total Confluence: {confluenceScore}/145 points
              {confluenceScore >= 100 && (
                <span style={{ marginLeft: '10px', color: '#3b82f6', fontSize: '13px' }}>
                  ⭐ HTF ALIGNED
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Premium/Discount Zone Analysis */}
      {premiumDiscount && (
        <div className="pattern-section" style={{ borderLeftColor: premiumDiscount.zone === 'premium' ? '#ef4444' : '#10b981' }}>
          <h3>📊 Zone Analysis</h3>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Current Zone:</div>
            <div className="pattern-detail-value">
              <span style={{
                padding: '4px 12px',
                borderRadius: '4px',
                background: premiumDiscount.zone === 'premium' ? '#fee2e2' :
                           premiumDiscount.zone === 'discount' ? '#d1fae5' : '#e5e7eb',
                color: premiumDiscount.zone === 'premium' ? '#dc2626' :
                       premiumDiscount.zone === 'discount' ? '#059669' : '#6b7280',
                fontWeight: 'bold'
              }}>
                {premiumDiscount.zone.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Position in Range:</div>
            <div className="pattern-detail-value">{premiumDiscount.percentage?.toFixed(1)}%</div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Equilibrium:</div>
            <div className="pattern-detail-value">{premiumDiscount.equilibrium?.toFixed(2)}</div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            {premiumDiscount.zone === 'premium' ? '🔴 Price in premium zone - ideal for SHORT entries' :
             premiumDiscount.zone === 'discount' ? '🟢 Price in discount zone - ideal for LONG entries' :
             '⚪ Price near equilibrium - wait for clear direction'}
          </p>
        </div>
      )}

      {/* Entry Timing */}
      {entryTiming && (
        <div className="pattern-section" style={{ borderLeftColor: '#8b5cf6' }}>
          <h3>⏱️ Entry Timing</h3>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Status:</div>
            <div className="pattern-detail-value">
              {entryTiming.status === 'immediate' ? (
                <span style={{ color: '#10b981', fontWeight: 'bold' }}>⚡ IMMEDIATE - Price in OB</span>
              ) : (
                <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>⏳ PENDING - Wait for OB mitigation</span>
              )}
            </div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Price in Order Block:</div>
            <div className="pattern-detail-value">{entryTiming.inOB ? 'Yes ✅' : 'No ⏳'}</div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            {entryTiming.status === 'immediate'
              ? '✅ Price is currently within the Order Block - can execute entry now'
              : '⏳ Price approaching OB - set limit order at mitigation level'}
          </p>
        </div>
      )}

      {/* OTE Analysis */}
      {ote && ote.currentPriceInOTE && (
        <div className="pattern-section" style={{ borderLeftColor: '#fbbf24' }}>
          <h3>🎯 Optimal Trade Entry (OTE)</h3>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Within OTE Zone:</div>
            <div className="pattern-detail-value" style={{ color: '#10b981', fontWeight: 'bold' }}>
              ✅ YES (62%-79% Fibonacci)
            </div>
          </div>
          {ote.oteZone && (
            <>
              <div className="pattern-detail-row">
                <div className="pattern-detail-label">OTE High:</div>
                <div className="pattern-detail-value">{ote.oteZone.high?.toFixed(2)}</div>
              </div>
              <div className="pattern-detail-row">
                <div className="pattern-detail-label">Sweet Spot:</div>
                <div className="pattern-detail-value" style={{ color: '#fbbf24', fontWeight: 'bold' }}>
                  {ote.oteZone.mid?.toFixed(2)}
                </div>
              </div>
              <div className="pattern-detail-row">
                <div className="pattern-detail-label">OTE Low:</div>
                <div className="pattern-detail-value">{ote.oteZone.low?.toFixed(2)}</div>
              </div>
            </>
          )}
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            ⭐ Price within institutional entry zone (0.618-0.786 Fibonacci retracement).
            This is where smart money typically enters positions.
          </p>
        </div>
      )}

      {/* Market Structure Analysis */}
      {structureAnalysis && (
        <div className="pattern-section" style={{ borderLeftColor: '#06b6d4' }}>
          <h3>📈 Market Structure</h3>
          {structureAnalysis.chochDetected && (
            <div className="pattern-detail-row">
              <div className="pattern-detail-label">Change of Character:</div>
              <div className="pattern-detail-value" style={{ color: '#f59e0b' }}>⚠️ Detected</div>
            </div>
          )}
          {structureAnalysis.bosType && (
            <div className="pattern-detail-row">
              <div className="pattern-detail-label">Break of Structure:</div>
              <div className="pattern-detail-value" style={{ color: '#10b981' }}>
                ✅ {structureAnalysis.bosType}
              </div>
            </div>
          )}
          {structureAnalysis.bmsDetected && (
            <div className="pattern-detail-row">
              <div className="pattern-detail-label">BMS Type:</div>
              <div className="pattern-detail-value" style={{ color: '#ef4444', fontWeight: 'bold' }}>
                🔄 {structureAnalysis.bmsType?.toUpperCase() || 'REVERSAL'}
              </div>
            </div>
          )}
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            {structureAnalysis.bmsDetected
              ? '🔄 Break of Market Structure indicates potential trend reversal'
              : structureAnalysis.bosType
              ? '✅ Break of Structure confirms trend continuation'
              : structureAnalysis.chochDetected
              ? '⚠️ Change of Character shows early signs of weakness'
              : 'Market structure analysis in progress'}
          </p>
        </div>
      )}

      {/* Liquidity Analysis */}
      {liquidityAnalysis && (
        <div className="pattern-section" style={{ borderLeftColor: '#a855f7' }}>
          <h3>💧 Liquidity Analysis</h3>
          {liquidityAnalysis.sweepDetected && (
            <div className="pattern-detail-row">
              <div className="pattern-detail-label">Liquidity Sweep:</div>
              <div className="pattern-detail-value" style={{ color: '#10b981' }}>✅ Detected (Stop Hunt)</div>
            </div>
          )}
          {liquidityAnalysis.externalLiquidity && (
            <div className="pattern-detail-row">
              <div className="pattern-detail-label">Target Liquidity:</div>
              <div className="pattern-detail-value">
                {typeof liquidityAnalysis.externalLiquidity.price === 'number'
                  ? liquidityAnalysis.externalLiquidity.price.toFixed(2)
                  : 'Equal highs/lows'}
              </div>
            </div>
          )}
          {liquidityAnalysis.inducementDetected && (
            <div className="pattern-detail-row">
              <div className="pattern-detail-label">Inducement:</div>
              <div className="pattern-detail-value" style={{ color: '#f59e0b' }}>🎭 Retail Trap Detected</div>
            </div>
          )}
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            {liquidityAnalysis.sweepDetected
              ? '✅ Liquidity sweep completed - stops triggered, now expecting reversal'
              : liquidityAnalysis.inducementDetected
              ? '🎭 Inducement zone detected - retail traders trapped, smart money moving opposite'
              : 'Liquidity zones identified for optimal profit targeting'}
          </p>
        </div>
      )}

      {/* Volume Analysis */}
      {volumeAnalysis && (
        <div className="pattern-section" style={{ borderLeftColor: '#ec4899' }}>
          <h3>📊 Volume Confirmation</h3>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Confirmation Level:</div>
            <div className="pattern-detail-value">
              <span style={{
                padding: '4px 12px',
                borderRadius: '4px',
                background: volumeAnalysis.confirmation === 'strong' ? '#dcfce7' :
                           volumeAnalysis.confirmation === 'moderate' ? '#fef3c7' : '#fee2e2',
                color: volumeAnalysis.confirmation === 'strong' ? '#166534' :
                       volumeAnalysis.confirmation === 'moderate' ? '#854d0e' : '#991b1b',
                fontWeight: 'bold'
              }}>
                {volumeAnalysis.confirmation?.toUpperCase() || 'N/A'}
              </span>
            </div>
          </div>
          {volumeAnalysis.volumeRatio && (
            <div className="pattern-detail-row">
              <div className="pattern-detail-label">Volume Ratio:</div>
              <div className="pattern-detail-value">{volumeAnalysis.volumeRatio}x average</div>
            </div>
          )}
          {volumeAnalysis.climaxDetected && (
            <div className="pattern-detail-row">
              <div className="pattern-detail-label">Climax:</div>
              <div className="pattern-detail-value" style={{ color: '#ef4444' }}>
                ⚠️ Potential Exhaustion
              </div>
            </div>
          )}
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            {volumeAnalysis.confirmation === 'strong'
              ? '✅ Strong institutional volume confirms the move'
              : volumeAnalysis.confirmation === 'moderate'
              ? '⚠️ Moderate volume - proceed with caution'
              : '❌ Weak volume - lower probability setup'}
          </p>
        </div>
      )}

      {/* Enhanced Order Block Details */}
      {orderBlockDetails && (
        <div className="pattern-section" style={{ borderLeftColor: '#f97316' }}>
          <h3>{orderBlockDetails.type === 'breakerBlock' ? '⚡ Breaker Block' : '🏢 Order Block'}</h3>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Type:</div>
            <div className="pattern-detail-value">
              {orderBlockDetails.type === 'breakerBlock' ? (
                <span style={{ color: '#dc2626', fontWeight: 'bold' }}>
                  ⚡ Breaker (Polarity Change)
                </span>
              ) : (
                <span>Standard Order Block</span>
              )}
            </div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Top Price:</div>
            <div className="pattern-detail-value">
              {typeof orderBlockDetails.top === 'number'
                ? orderBlockDetails.top.toFixed(8)
                : orderBlockDetails.top || 'N/A'}
            </div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Bottom Price:</div>
            <div className="pattern-detail-value">
              {typeof orderBlockDetails.bottom === 'number'
                ? orderBlockDetails.bottom.toFixed(8)
                : orderBlockDetails.bottom || 'N/A'}
            </div>
          </div>
          {orderBlockDetails.strength !== undefined && (
            <div className="pattern-detail-row">
              <div className="pattern-detail-label">Impulse Strength:</div>
              <div className="pattern-detail-value">
                {typeof orderBlockDetails.strength === 'number'
                  ? `${orderBlockDetails.strength.toFixed(2)}%`
                  : orderBlockDetails.strength}
              </div>
            </div>
          )}
          {orderBlockDetails.polarityChange && (
            <div className="pattern-detail-row">
              <div className="pattern-detail-label">Polarity Change:</div>
              <div className="pattern-detail-value" style={{ color: '#dc2626' }}>
                ⚡ Support → Resistance (or vice versa)
              </div>
            </div>
          )}
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            {orderBlockDetails.type === 'breakerBlock'
              ? '⚡ Breaker Block: Failed OB that now acts as opposite polarity - higher priority!'
              : 'Order Block: Zone where institutions placed large orders - expect reaction'}
          </p>
        </div>
      )}

      {/* Enhanced FVG Status */}
      {fvgStatus && (
        <div className="pattern-section" style={{ borderLeftColor: '#8b5cf6' }}>
          <h3>📊 Fair Value Gap Status</h3>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Mitigation Status:</div>
            <div className="pattern-detail-value">
              <span style={{
                padding: '4px 12px',
                borderRadius: '4px',
                background: fvgStatus.mitigationStatus === 'unfilled' ? '#dcfce7' :
                           fvgStatus.mitigationStatus === 'touched' ? '#fef3c7' : '#fee2e2',
                color: fvgStatus.mitigationStatus === 'unfilled' ? '#166534' :
                       fvgStatus.mitigationStatus === 'touched' ? '#854d0e' : '#991b1b',
                fontWeight: 'bold'
              }}>
                {fvgStatus.mitigationStatus?.toUpperCase() || 'N/A'}
              </span>
            </div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Fill Percentage:</div>
            <div className="pattern-detail-value">{fvgStatus.fillPercentage || 0}%</div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Strength:</div>
            <div className="pattern-detail-value">{fvgStatus.strength || 'N/A'}</div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            {fvgStatus.mitigationStatus === 'unfilled'
              ? '✅ Unfilled FVG - strongest signal, gap not yet mitigated'
              : fvgStatus.mitigationStatus === 'touched'
              ? '⚠️ Touched but not filled - moderate strength'
              : 'Gap has been partially or fully mitigated'}
          </p>
        </div>
      )}

      {/* Risk Management Details */}
      {riskManagement && (
        <div className="pattern-section" style={{ borderLeftColor: '#14b8a6' }}>
          <h3>🛡️ Risk Management</h3>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Stop Loss Logic:</div>
            <div className="pattern-detail-value" style={{ fontSize: '13px' }}>
              {riskManagement.stopLossReasoning || 'Structure-based'}
            </div>
          </div>
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Take Profit Logic:</div>
            <div className="pattern-detail-value" style={{ fontSize: '13px' }}>
              {riskManagement.takeProfitReasoning || 'Fixed R:R'}
            </div>
          </div>
          {riskManagement.atrBuffer && (
            <div className="pattern-detail-row">
              <div className="pattern-detail-label">ATR Buffer:</div>
              <div className="pattern-detail-value">
                {typeof riskManagement.atrBuffer === 'number'
                  ? riskManagement.atrBuffer.toFixed(2)
                  : riskManagement.atrBuffer}
              </div>
            </div>
          )}
          <div className="pattern-detail-row">
            <div className="pattern-detail-label">Max Risk:</div>
            <div className="pattern-detail-value">{riskManagement.maxRiskPercent || 3}%</div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            🛡️ Stop loss placed with ATR buffer to avoid wicks. Take profit targets structure or liquidity.
          </p>
        </div>
      )}

      {/* Confluence Explanation */}
      <div className="pattern-section" style={{ borderLeftColor: type === 'BUY' ? '#10b981' : '#ef4444' }}>
        <h3>Why This Signal Was Triggered</h3>
        <p style={{ margin: 0, lineHeight: '1.6' }}>{reason}</p>
        {patternsArray && patternsArray.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <strong>Detected Patterns:</strong>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
              {patternsArray.map((pattern, idx) => (
                <span key={idx} style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  background: '#f3f4f6',
                  color: '#374151',
                  fontSize: '13px'
                }}>
                  {pattern}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart Analysis */}
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
          htfData={htfData}
          htfTimeframe={htfTimeframe}
          structureAnalysis={structureAnalysis}
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
            1:{rrBreakdown.ratio?.toFixed(2) || '2.00'}
          </div>
        </div>
        {rrBreakdown.reasoning && (
          <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            {rrBreakdown.reasoning}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={onClose}>
          Close
        </button>

        {/* Share Button with Dropdown Menu */}
        <div style={{ position: 'relative' }} ref={shareMenuRef}>
          <button
            className="btn"
            onClick={() => setShowShareMenu(!showShareMenu)}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{ fontSize: '16px' }}>📤</span>
            Share
            <span style={{ fontSize: '12px', marginLeft: '4px' }}>{showShareMenu ? '▲' : '▼'}</span>
          </button>

          {/* Dropdown Menu */}
          {showShareMenu && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: '8px',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
              border: '1px solid #e5e7eb',
              minWidth: '220px',
              zIndex: 1000,
              overflow: 'hidden'
            }}>
              {/* Download Image */}
              <button
                onClick={handleDownloadImage}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  background: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <span style={{ fontSize: '18px' }}>💾</span>
                <span style={{ fontWeight: '500' }}>Download Image</span>
              </button>

              {/* Divider */}
              <div style={{
                height: '1px',
                background: '#e5e7eb',
                margin: '4px 0'
              }}></div>

              {/* Share to Telegram */}
              <button
                onClick={handleShareToTelegram}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  background: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'background 0.15s ease',
                  borderTop: '1px solid #f3f4f6'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <span style={{ fontSize: '18px' }}>✈️</span>
                <span style={{ fontWeight: '500' }}>Share to Telegram</span>
              </button>

              {/* Share to WhatsApp */}
              <button
                onClick={handleShareToWhatsApp}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  background: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'background 0.15s ease',
                  borderTop: '1px solid #f3f4f6'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <span style={{ fontSize: '18px' }}>💬</span>
                <span style={{ fontWeight: '500' }}>Share to WhatsApp</span>
              </button>

              {/* Share to Facebook Messenger */}
              <button
                onClick={handleShareToMessenger}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  background: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'background 0.15s ease',
                  borderTop: '1px solid #f3f4f6'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <span style={{ fontSize: '18px' }}>💙</span>
                <span style={{ fontWeight: '500' }}>Share to Messenger</span>
              </button>
            </div>
          )}
        </div>

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
      </div>
    </Modal>
  );
};

export default SignalDetailsModal;
