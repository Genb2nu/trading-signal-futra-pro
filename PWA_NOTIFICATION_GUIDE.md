# PWA & Notification System Guide

**Last Updated**: 2025-12-24
**Features**: Progressive Web App + Real-Time Signal Tracking with Notifications

---

## 🚀 Progressive Web App (PWA) Features

### What is PWA?

Futra Pro is now a **Progressive Web App**, which means:
- ✅ **Install on desktop/mobile** - Works like a native app
- ✅ **Offline capability** - Core features work without internet
- ✅ **Fast loading** - Cached resources load instantly
- ✅ **Background notifications** - Get alerts even when app is closed
- ✅ **Full-screen mode** - Clean app experience without browser UI
- ✅ **Auto-updates** - Always get the latest version

---

## 📱 How to Install as an App

### On Desktop (Chrome/Edge):

1. Open **http://localhost:5173/** (or your deployed URL)
2. Look for the **install icon** in the address bar (⊕ or computer icon)
3. Click **"Install Futra Pro"**
4. App will open in its own window
5. Pin to taskbar for quick access

**Or manually**:
- Chrome: Menu → **More Tools** → **Create Shortcut** → Check "Open as window"
- Edge: Menu → **Apps** → **Install this site as an app**

### On Mobile (Android):

1. Open site in **Chrome**
2. Tap **Menu (⋮)** → **Add to Home Screen**
3. Name it "Futra Pro" and tap **Add**
4. Icon appears on home screen like a native app

### On Mobile (iOS/iPhone):

1. Open site in **Safari**
2. Tap **Share button** (square with arrow)
3. Scroll and tap **"Add to Home Screen"**
4. Name it "Futra Pro" and tap **Add**

---

## 🔔 Signal Tracking & Notifications

### How It Works

**Futra Pro can monitor signals in real-time and notify you when price approaches entry!**

#### Features:
- 📊 **Real-time price monitoring** (updates every 30 seconds)
- 🔔 **Browser notifications** when entry is near (within 0.5%)
- 🔊 **Sound alerts** when entry is ready
- ⏰ **24/7 tracking** (works even when browser/app is closed*)
- 📱 **Works on mobile** and desktop
- ⏱️ **Auto-expiry** after 24 hours

*Requires PWA install and browser support

---

## 🎯 How to Track a Signal

### Step-by-Step:

1. **Scan for Signals**
   - Go to "Signal Tracker" tab
   - Select timeframe (1h recommended)
   - Select symbols
   - Click "Start Scan"

2. **Track a Signal**
   - When signals appear, click **"Track"** button
   - Browser will ask for notification permission → Click **"Allow"**
   - Confirmation notification appears
   - Signal is now being monitored

3. **View Tracked Signals**
   - Go to **"Tracked Signals"** tab
   - See all monitored signals
   - Real-time price updates
   - Distance to entry shown

4. **Get Notified**
   - When price is within 0.5% of entry:
     - 🔔 Notification appears
     - 🔊 Sound plays
     - Shows: Symbol, Entry, Current Price, Stop, Target

5. **Take Action**
   - Click notification to open app
   - Review signal details
   - Execute trade manually on your exchange

---

## 🔧 Enable Notifications

### On Desktop (Chrome):

1. When you first track a signal → Click **"Allow"** in permission popup
2. **If you blocked it**:
   - Click **lock icon** in address bar
   - Find "Notifications"
   - Change to **"Allow"**
   - Refresh page

### On Mobile (Android Chrome):

1. Track a signal → Tap **"Allow"** when asked
2. **If blocked**:
   - Settings → Site Settings → Notifications
   - Find your site → Allow

### On Mobile (iOS Safari):

**Important**: iOS Safari has limited notification support
- Works only when app is **in foreground**
- For background notifications, use **Chrome on Android** or **Desktop**

---

## 📊 Tracked Signals Tab Features

### Real-Time Display

| Column | Description |
|--------|-------------|
| **Symbol** | Trading pair (e.g., BTCUSDT) |
| **Direction** | BULLISH or BEARISH |
| **Entry** | Target entry price |
| **Current Price** | Live price (updates every 10 sec) |
| **Distance** | % away from entry |
| **Status** | Entry status indicator |
| **Stop Loss** | SL price |
| **Take Profit** | TP target |
| **R:R** | Risk:Reward ratio |
| **Tracked Since** | When tracking started |
| **Actions** | Stop tracking button |

### Status Indicators

- 🎯 **ENTRY READY!** (Green) - Within 0.5%, ready to enter
- ⚡ **Approaching** (Orange) - Within 1.5%, getting close
- 📊 **X% away** (Gray) - Still far from entry

---

## ⚙️ Notification Settings

### Sound

- Plays automatically when entry is ready
- Browser default notification sound
- Volume controlled by system settings

### Notification Persistence

- **require_interaction: true** - Stays until you dismiss
- Important alerts won't auto-disappear
- Must manually close or click

### Notification Frequency

- Only notifies **once per signal** when entry is near
- Won't spam you with repeated notifications
- Tracks status to avoid duplicates

---

## 🚨 Troubleshooting

### Notifications Not Working?

**Check 1: Permission Granted?**
```
Chrome: chrome://settings/content/notifications
Edge: edge://settings/content/notifications
```
Make sure your site is in "Allow" list.

**Check 2: Service Worker Active?**
```
Chrome DevTools → Application → Service Workers
```
Should show "activated and running".

**Check 3: Browser Supports Notifications?**
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari (Desktop): ⚠️ Limited support
- Safari (iOS): ❌ Foreground only

**Check 4: Do Not Disturb Mode?**
- Turn off "Do Not Disturb" / "Focus Mode"
- Check system notification settings
- Test with another website's notifications

### PWA Not Installing?

**Check 1: Served over HTTPS?**
- Localhost: ✅ Works (exception for development)
- HTTP: ❌ Needs HTTPS
- HTTPS: ✅ Works

**Check 2: Manifest Valid?**
```
Chrome DevTools → Application → Manifest
```
Should show "Futra Pro" with icons.

**Check 3: Service Worker Registered?**
```
Chrome DevTools → Application → Service Workers
```
Should show "sw.js" registered.

### Tracked Signals Not Updating?

**Check 1: Browser Active?**
- Some browsers pause timers when tab is inactive
- Keep tab active or use PWA installed version

**Check 2: Internet Connection?**
- Needs connection to fetch prices from Binance
- Check if other data is loading

**Check 3: Binance API Accessible?**
- Some regions block Binance
- VPN might be needed

---

## 💡 Pro Tips

### For Best Results:

1. **Install as PWA**
   - Better performance
   - Background notifications work better
   - Cleaner interface

2. **Keep One Tab/Window Open**
   - Ensures price monitoring continues
   - Or rely on service worker for background

3. **Test Notifications First**
   - Track a signal close to entry
   - Verify you receive notification
   - Adjust volume if needed

4. **Don't Track Too Many**
   - Keep it under 10 signals
   - More signals = more API calls
   - Focus on quality setups

5. **Mobile: Use Chrome**
   - Better PWA support than Safari
   - Background notifications work
   - Full feature set

---

## 🔒 Privacy & Data

### What's Stored?

- **Tracked signals** - Stored locally in browser memory
- **Settings** - Saved in browser localStorage
- **Service worker cache** - Static app files only

### What's Sent?

- **To Binance API**: Symbol names (to fetch prices)
- **To Your Server**: Scan requests (symbols, timeframe)
- **Nowhere else**: No data sent to third parties

### Data Persistence

- Tracked signals lost on browser close (in-memory only)
- To persist, track again after reopening
- Future: Local storage persistence planned

---

## 📊 How Tracking Works (Technical)

### Real-Time Monitoring

1. **You track a signal** → Added to in-memory Map
2. **Every 30 seconds**:
   - Fetch current price from Binance API
   - Calculate distance to entry
   - Check if within notification threshold (0.5%)
3. **If threshold met**:
   - Show notification
   - Play sound
   - Mark as "notified" (prevent spam)
4. **After 24 hours**:
   - Auto-remove signal
   - Assumes signal expired

### Notification Delivery

```
[Service Worker] → [Push API] → [OS Notification Center] → [You]
```

- Uses browser's **Push API**
- Handled by **Service Worker** (runs in background)
- Delivered via **OS notification system**

---

## ⚡ Performance Impact

### CPU/Memory Usage

| Feature | Impact | Notes |
|---------|--------|-------|
| PWA Install | None | Just cached files |
| Service Worker | Minimal | ~1-5 MB RAM |
| Tracking 1 signal | Low | API call every 30s |
| Tracking 10 signals | Medium | 10 API calls every 30s |
| Notifications | None | OS handles it |

### Battery Impact (Mobile)

- **Minimal** when app in background
- Service worker is efficient
- API calls are throttled (30s interval)
- No continuous connections (websockets)

---

## 🎉 Benefits of PWA + Notifications

### Before (Regular Website):
- ❌ Must keep browser open
- ❌ Must manually refresh to check price
- ❌ Easy to miss entry opportunities
- ❌ Requires constant monitoring

### After (PWA with Notifications):
- ✅ Automatic price monitoring
- ✅ Get alerted when entry is ready
- ✅ Works in background
- ✅ Never miss a setup
- ✅ Can do other things while waiting

---

## 📱 Example Workflow

### Scenario: Trading 1h Signals

**9:00 AM - Morning**
1. Open Futra Pro (PWA)
2. Scan for 1h signals on BTC, ETH, BNB
3. Find 3 signals
4. Track all 3 signals
5. Close app, go about your day

**12:30 PM - Afternoon**
- 🔔 Notification: "ENTRY READY: BTCUSDT"
- Price within 0.5% of entry
- Open app, verify signal
- Execute trade on exchange

**3:45 PM**
- 🔔 Notification: "ENTRY READY: ETHUSDT"
- Check signal, enter trade

**7:00 PM - Evening**
- Open app to check third signal (BNBUSDT)
- Still 2% away from entry
- Keep tracking

**Next Day**
- BNBUSDT never reached entry
- Auto-expired after 24h
- No loss, just didn't trigger

**Result**: Caught 2/3 setups without constant monitoring!

---

## ✅ Quick Start Checklist

- [ ] Install Futra Pro as PWA
- [ ] Enable notifications when prompted
- [ ] Test by tracking a signal close to entry
- [ ] Verify notification appears
- [ ] Adjust notification settings if needed
- [ ] Start tracking real signals
- [ ] Trade when notified!

---

## 🆘 Support

### Still Having Issues?

1. **Check browser console** (F12) for errors
2. **Try different browser** (Chrome recommended)
3. **Clear cache and reload**
4. **Reinstall PWA**
5. **Check GitHub issues** for known problems

---

**Enjoy hassle-free signal tracking with Futra Pro!** 🚀

Never miss an entry again! 🎯
