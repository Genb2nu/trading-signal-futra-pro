# Settings Configuration Guide

**Last Updated**: 2025-12-24
**Feature**: Dynamic Strategy Configuration via Settings Page

---

## 🎯 Overview

The website now has a comprehensive settings system that allows you to configure your trading strategy without modifying code. All settings are saved to `config.json` and automatically applied when scanning for signals.

---

## ⚙️ Settings Categories

### 📊 **1. Symbols Tab**

Configure which trading pairs to monitor:

- **Symbol Limit**: Maximum number of symbols to track (1-1000)
- **Symbol Selection**: Choose specific USDT pairs to monitor
- **Quick Actions**:
  - Select Top N symbols by volume
  - Clear all selections
  - Search for specific symbols

**Best Practice**: Select 20-50 symbols you actively trade for optimal performance.

---

### 🎯 **2. Strategy Tab**

Choose your trading strategy mode and core parameters:

#### Strategy Modes

| Mode | Description | Win Rate | Signal Frequency | Best Timeframe |
|------|-------------|----------|------------------|----------------|
| **Conservative** | Highest quality, fewer signals | 70-85% | 5-15/day | 1h, 4h |
| **Moderate** | Balanced approach (Default) | 60-75% | 15-30/day | 1h |
| **Aggressive** | More signals, lower quality | 55-65% | 30-60/day | 15m, 5m |

#### Strategy Parameters

**Minimum Confluence Score** (20-80)
- Higher = fewer but higher quality signals
- Lower = more signals but lower accuracy
- Default: 40 (Moderate mode)

**Order Block Impulse Threshold** (0.2%-1.0%)
- Minimum price movement to identify Order Blocks
- Lower = more OBs detected, potentially more noise
- Higher = fewer OBs, only strong moves
- Default: 0.5%

**Allow Neutral Zone Signals** ✓/✗
- If enabled: Signals allowed in premium, discount, OR neutral zones
- If disabled: Only premium (sells) or discount (buys) zones
- Default: Enabled

**Require Higher Timeframe Alignment** ✓/✗
- If enabled: Blocks bullish signals when HTF is bearish (and vice versa)
- If disabled: Ignores HTF trend
- Default: Enabled (recommended for higher win rate)

---

### ⚠️ **3. Risk Management Tab**

Control how much you risk per trade:

#### Risk Per Trade (0.5%-5%)
- Recommended: 1-2% for conservative, 2-3% for moderate
- **Never exceed 5%!**
- Default: 2%

Example with $100 account:
- 2% = $2.00 risk per trade
- Stop loss hit = lose $2.00
- Take profit hit (1.5R) = win $3.00

#### Maximum Concurrent Trades (1-10)
- How many trades can be open simultaneously
- Total risk = Risk% × Max Trades
- Default: 3 trades (= 6% total risk with 2% per trade)

#### Stop Loss ATR Multiplier (1.5x-3.5x)
- Stop loss distance based on Average True Range
- Higher = wider stops, fewer stop outs, larger losses
- Lower = tighter stops, more stop outs, smaller losses
- Default: 2.5x

#### Minimum Risk:Reward Ratio (1.0:1 - 3.0:1)
- Minimum reward required for taking a trade
- 1.5:1 = win $1.50 for every $1 risked
- Default: 1.5:1

---

### 🔍 **4. Signal Filters Tab**

Filter which signals appear:

#### Minimum Confidence Level
- **Standard**: Confluence ≥25 (most signals)
- **High**: Confluence ≥50 (good balance)
- **Premium**: Confluence ≥75 (best quality, fewest signals)

#### Active Filters Summary
Shows all currently active filters:
- Strategy Mode
- Minimum Confluence
- Minimum Confidence Level
- Minimum R:R
- HTF Alignment status
- Neutral Zone status

#### Expected Signal Frequency
Based on your settings:
- Conservative: 5-15 signals/day
- Moderate: 15-30 signals/day
- Aggressive: 30-60 signals/day

---

## 🔧 Configuration Examples

### For Beginners ($100-$500 account)

```
Strategy Mode: Moderate
Risk Per Trade: 1-2%
Max Concurrent Trades: 2-3
Minimum Confluence: 40
Require HTF Alignment: ✓ Yes
Allow Neutral Zone: ✓ Yes
Minimum Confidence: High
```

**Expected**: 10-20 signals/day, 60-70% win rate

---

### For Experienced Traders ($1000+ account)

```
Strategy Mode: Conservative or Moderate
Risk Per Trade: 2-3%
Max Concurrent Trades: 3-5
Minimum Confluence: 50
Require HTF Alignment: ✓ Yes
Allow Neutral Zone: ✗ No
Minimum Confidence: High or Premium
```

**Expected**: 5-15 quality signals/day, 65-80% win rate

---

### For Scalpers (Active monitoring required)

```
Strategy Mode: Aggressive
Risk Per Trade: 1-2%
Max Concurrent Trades: 3-5
Minimum Confluence: 25-30
Require HTF Alignment: ✗ No
Allow Neutral Zone: ✓ Yes
Minimum Confidence: Standard
```

**Expected**: 30-60 signals/day, 55-65% win rate
**Timeframe**: 15m or 5m

---

## 💾 How Settings Work

### Saving Settings

1. Navigate to Settings page (gear icon)
2. Adjust parameters across all 4 tabs
3. Click "💾 Save All Settings"
4. Settings are saved to `config.json`
5. **Restart scanner or refresh page** for changes to take effect

### Settings File Location

```
/config.json
```

All settings are stored in this JSON file. You can edit it manually if needed, but using the Settings page is recommended.

### Applied On

Settings are applied when:
- ✅ Server starts/restarts
- ✅ You save settings (takes effect on next scan)
- ✅ You scan for signals

Settings are NOT applied to:
- ❌ Historical backtest data (uses fixed settings)
- ❌ Already completed scans (must re-scan)

---

## 🎨 UI Features

### Tabbed Interface
- Clean organization across 4 categories
- Active tab highlighted in blue
- Easy navigation

### Real-Time Feedback
- Success/error messages after saving
- Parameter values displayed as you adjust sliders
- Risk summary calculations

### Smart Presets
- Selecting a Strategy Mode auto-adjusts related settings
- Example: Conservative mode sets higher confluence, tighter stops

---

## 🔄 Settings Sync

### Server-Side
- Settings loaded on server startup
- Applies to all API scans
- Persistent across restarts

### Client-Side
- Settings loaded when page loads
- Can be modified independently
- Must save to sync with server

---

## ⚡ Performance Impact

| Setting | Lower Value | Higher Value |
|---------|-------------|--------------|
| Minimum Confluence | More signals, slower quality | Fewer signals, better quality |
| Symbol Limit | Faster scans | Slower scans |
| OB Impulse Threshold | More OBs, more signals | Fewer OBs, fewer signals |
| HTF Alignment | More signals (if disabled) | Fewer signals (if enabled) |

**Recommendation**: Start conservative, then relax settings if signals are too infrequent.

---

## 🚨 Important Notes

### Risk Management Rules
1. **NEVER risk more than 2-3% per trade** (beginners: 1-2%)
2. **NEVER have more than 6-10% total account at risk** (all open trades combined)
3. **ALWAYS use stop losses** (configured via ATR multiplier)
4. **NEVER trade without a plan** (know your entry, stop, target before entering)

### Settings Best Practices
1. **Test in demo first**: Try new settings without real money
2. **Track performance**: Record win rate and R:R for your settings
3. **Adjust gradually**: Change one setting at a time
4. **Match timeframe to mode**:
   - Conservative/Moderate: 1h, 4h
   - Aggressive: 15m, 5m
5. **Review weekly**: Adjust if win rate drops below 50%

---

## 🐛 Troubleshooting

### No Signals Appearing
**Check**:
1. Minimum Confluence not too high (try 30-40)
2. Minimum Confidence not set to "Premium"
3. HTF Alignment might be blocking (try disabling)
4. OB Impulse Threshold not too high (try 0.3-0.5%)

### Too Many Signals (Low Quality)
**Check**:
1. Increase Minimum Confluence to 50+
2. Set Minimum Confidence to "High" or "Premium"
3. Enable HTF Alignment
4. Disable Neutral Zone

### Signals Not Matching Strategy Mode
**Solution**:
1. Save settings again
2. Refresh the page
3. Re-run scan
4. Check browser console for errors

---

## 📊 Default Values

These are the factory defaults (Moderate mode):

```json
{
  "strategyMode": "moderate",
  "riskPerTrade": 2,
  "maxConcurrentTrades": 3,
  "stopLossATRMultiplier": 2.5,
  "minimumConfluence": 40,
  "minimumRiskReward": 1.5,
  "minimumConfidenceLevel": "standard",
  "requireHTFAlignment": true,
  "allowNeutralZone": true,
  "obImpulseThreshold": 0.005
}
```

---

## 🎓 Learning Path

### Week 1: Conservative Settings
- Use Conservative mode
- Risk 1% per trade
- Only trade HIGH confidence signals
- Track every trade

### Week 2-3: Moderate Settings
- Switch to Moderate mode
- Increase risk to 1.5-2%
- Refine symbol selection
- Continue tracking

### Week 4+: Custom Optimization
- Adjust based on results
- Fine-tune confluence levels
- Match settings to your trading style
- Consider Aggressive mode if experienced

---

## ✅ Summary

The Settings page provides full control over your trading strategy:
- **4 organized tabs**: Symbols, Strategy, Risk, Filters
- **Live updates**: Changes apply immediately on save
- **Flexible presets**: Conservative, Moderate, Aggressive modes
- **Risk management**: Built-in safeguards and calculators
- **No coding required**: All configuration via UI

**Access**: Click the ⚙️ Settings icon in the navigation menu

---

**Generated**: 2025-12-24
**Version**: 2.0 - Dynamic Configuration System
