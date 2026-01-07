# Automatic Paper Trading System - User Guide

**Date:** January 5, 2026
**Status:** ✅ READY TO USE

---

## 🎯 What This Does

The **Automatic Paper Trading System** continuously monitors the market and **automatically tracks signals** when they reach ENTRY_READY state.

**You don't need to manually click "Track" anymore!**

Just run the auto-trader in the background, and it will:
1. ✅ Scan symbols every minute
2. ✅ Detect ENTRY_READY signals
3. ✅ Automatically track them for you
4. ✅ Log everything to validation system

**Then you simply:**
- Check tracked signals anytime: `node view-tracked-signals.js`
- See live P/L, current price, status
- Record outcomes when trades complete

---

## 🚀 How to Use

### Step 1: Start the Auto-Trader

```bash
# Start in background (keeps running)
node auto-paper-trader.js
```

**What it does:**
- Scans 15 symbols across 3 timeframes (15m, 1h, 4h)
- Checks every 60 seconds for ENTRY_READY signals
- Auto-tracks any new ENTRY_READY signals
- Logs everything

**Output:**
```
╔══════════════════════════════════════════════════════════╗
║  AUTOMATIC PAPER TRADING SYSTEM                          ║
║  Auto-tracks signals when they reach ENTRY_READY         ║
╚══════════════════════════════════════════════════════════╝

⚙️  Configuration:
   Symbols: BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT, ...
   Timeframes: 15m, 1h, 4h
   Check interval: 60 seconds

🚀 Auto-trader started! Press Ctrl+C to stop.

🔍 Checking for ENTRY_READY signals...
   No ENTRY_READY signals found yet.

📈 Total auto-tracked signals: 0
⏰ Next check in 60 seconds...
```

**When it finds a signal:**
```
✅ AUTO-TRACKED: DOTUSDT BULLISH [15m]
   Entry: $2.1650
   SL: $2.1400 | TP: $2.2100
   R:R: 2.10 | Confluence: 90

📊 1 new signal(s) auto-tracked!
💡 View tracked signals: node view-tracked-signals.js
```

### Step 2: View Tracked Signals

**In another terminal (or stop auto-trader with Ctrl+C):**

```bash
node view-tracked-signals.js
```

**Output:**
```
╔══════════════════════════════════════════════════════════╗
║  TRACKED SIGNALS DASHBOARD                               ║
║  View all auto-tracked trades and their progress         ║
╚══════════════════════════════════════════════════════════╝

📊 Total Tracked Signals: 3

════════════════════════════════════════════════════════════
🔓 OPEN TRADES (3)
════════════════════════════════════════════════════════════

📍 DOTUSDT BULLISH [15m]
   Tracked: 1/5/2026, 11:30:00 PM
   Entry: $2.1650 | SL: $2.1400 | TP: $2.2100
   R:R: 2.10 | Confluence: 90

   🔄 Fetching current price...
   💰 Current: $2.1820
   📈 P/L: +0.79%
   📊 R Multiple: +0.68R
   🎯 To TP: 37.8%
   ⚡ Status: IN PROFIT 🟢

📍 LTCUSDT BULLISH [15m]
   Tracked: 1/5/2026, 11:32:00 PM
   Entry: $82.58 | SL: $81.90 | TP: $84.20
   R:R: 2.38 | Confluence: 145

   💰 Current: $84.50
   📈 P/L: +2.33%
   📊 R Multiple: +2.82R
   🎯 To TP: 118.5%
   ⚡ Status: HIT TP ✅

   ✅ TRADE WINNER! Record outcome:
      node record-trade-outcome.js
```

### Step 3: Record Outcomes

When trades hit TP or SL:

```bash
node record-trade-outcome.js
```

Follow the prompts to record win/loss/breakeven.

---

## ⚙️ Configuration

### Edit Symbols to Track

**File:** `auto-paper-trader.js`

**Line 12-16:**
```javascript
const SCAN_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT',
  'LINKUSDT', 'ATOMUSDT', 'NEARUSDT', 'UNIUSDT', 'LTCUSDT'
];
```

Add or remove symbols as needed.

### Edit Timeframes

**Line 17:**
```javascript
const SCAN_TIMEFRAMES = ['15m', '1h', '4h'];
```

Add/remove: `'5m'`, `'15m'`, `'1h'`, `'4h'`, `'1d'`

### Edit Check Interval

**Line 11:**
```javascript
const CHECK_INTERVAL = 60000; // Check every 1 minute (60000ms)
```

Change to:
- `30000` = 30 seconds (faster, more API calls)
- `120000` = 2 minutes (slower, fewer API calls)
- `300000` = 5 minutes (minimal API usage)

---

## 📊 Workflow Examples

### Example 1: Hands-Off Monitoring

**Morning:**
```bash
# Start auto-trader
node auto-paper-trader.js

# Leave it running all day
```

**Evening:**
```bash
# Stop auto-trader (Ctrl+C)

# Check what was tracked
node view-tracked-signals.js

# Record outcomes for completed trades
node record-trade-outcome.js

# View overall stats
node view-validation-data.js outcomes
```

### Example 2: Active Monitoring

**Terminal 1:**
```bash
# Run auto-trader continuously
node auto-paper-trader.js
```

**Terminal 2:**
```bash
# Check tracked signals every hour
node view-tracked-signals.js

# When trades complete, record outcomes
node record-trade-outcome.js
```

### Example 3: Scheduled Checks

**Option A: Manual periodic checks**
```bash
# Every few hours, run:
node auto-paper-trader.js
# Let it run for 5 minutes
# Ctrl+C to stop

node view-tracked-signals.js
```

**Option B: Use cron/task scheduler**
```bash
# Run auto-trader for 10 minutes every hour
# (Set up with cron or Windows Task Scheduler)
```

---

## 🎯 Benefits

### Before (Manual):
- ❌ Had to constantly check for ENTRY_READY signals
- ❌ Had to manually click "Track" button
- ❌ Could miss signals while away from computer
- ❌ Time-consuming to monitor

### After (Auto-Trader):
- ✅ **Set it and forget it** - runs automatically
- ✅ **Never miss signals** - checks continuously
- ✅ **Just check progress** - `view-tracked-signals.js` shows everything
- ✅ **Focus on outcomes** - only interact when recording results

---

## 📈 What Gets Tracked

### Automatically Tracked:
- Signal symbol, direction, timeframe
- Entry price, Stop Loss, Take Profit
- Risk:Reward ratio
- Confluence score
- Entry timestamp
- All SMC pattern details

### You Record Manually:
- Trade outcome (win/loss/breakeven)
- Exit price
- Notes about what happened

---

## 📁 Files Created

```
auto-paper-trader.js          # Main auto-tracking script
view-tracked-signals.js       # Dashboard to view progress
auto-tracked-signals.json     # Stores tracked signal IDs
```

---

## 🔍 Monitoring & Logs

### Check Auto-Trader Status

While running, you'll see:
```
🔍 Checking for ENTRY_READY signals...
🎯 Found 2 ENTRY_READY signal(s)!

✅ AUTO-TRACKED: BNBUSDT BULLISH [15m]
   Entry: $901.88
   SL: $895.00 | TP: $915.00
   R:R: 1.89 | Confluence: 67

📊 2 new signal(s) auto-tracked!
```

### Check Tracked Signals Anytime

```bash
node view-tracked-signals.js
```

Shows:
- Open trades with live P/L
- Current price fetched from Binance
- R Multiple progress
- % to Take Profit
- Status (In Profit, In Loss, Hit TP, Hit SL)
- Closed trades statistics

---

## ⚠️ Important Notes

### This is Paper Trading
- ✅ No real money involved
- ✅ Pure tracking and validation
- ✅ Building confidence and data
- ❌ Don't use for live trading without testing

### API Rate Limits
- Binance has rate limits
- Default: 60 second intervals (safe)
- If scanning many symbols: increase interval
- Current: 15 symbols × 3 timeframes = 45 API calls/minute

### Data Storage
- All tracked signals saved to `validation-data/`
- Auto-tracked IDs saved to `auto-tracked-signals.json`
- Won't duplicate tracking (checks before adding)

---

## 🚀 Quick Start Commands

```bash
# START AUTO-TRADER (runs continuously)
node auto-paper-trader.js

# VIEW TRACKED SIGNALS (check progress)
node view-tracked-signals.js

# RECORD OUTCOME (when trade completes)
node record-trade-outcome.js

# VIEW STATISTICS
node view-validation-data.js summary
node view-validation-data.js outcomes

# STOP AUTO-TRADER
# Press Ctrl+C in the terminal running it
```

---

## 💡 Tips

1. **Run in background** - Use `tmux` or `screen` on Linux, or just minimize terminal
2. **Check daily** - Run `view-tracked-signals.js` once or twice per day
3. **Record promptly** - When trades complete, record outcome same day
4. **Monitor win rate** - Use `view-validation-data.js outcomes` weekly
5. **Adjust symbols** - Add/remove based on what's active in your strategy

---

## 🎯 Expected Results

### After 1 Week:
- 5-15 signals auto-tracked (depends on market)
- 3-10 completed trades
- Initial win rate data

### After 2 Weeks (Validation Complete):
- 10-30 signals auto-tracked
- 8-20 completed trades
- Enough data for Option E optimization
- Win rate approaching 60-80% (ICT expected)

---

## ✅ You're Ready!

**The auto-trader does the monitoring.**
**You just check progress and record outcomes.**

**Start it now:**
```bash
node auto-paper-trader.js
```

**Check it later:**
```bash
node view-tracked-signals.js
```

**That's it! Simple, automated, effective.** 🚀

