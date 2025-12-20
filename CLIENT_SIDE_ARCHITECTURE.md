# Client-Side Architecture Documentation

## Overview
This app now uses a **client-side architecture** to bypass Binance API geo-restrictions on Vercel's servers.

## Problem Solved
- **Issue**: Vercel servers receive HTTP 451 (geo-restricted) from Binance API
- **Root Cause**: Binance blocks data center IPs (hosting providers like Vercel)
- **Solution**: Make Binance API calls from user's browser instead of server

## Architecture

### Before (Server-Side - Blocked ❌)
```
User Browser → Vercel Server → Binance API (HTTP 451 ❌)
```

### After (Client-Side - Works ✅)
```
User Browser → Binance API directly ✅
User Browser → Vercel Server (settings only) ✅
```

## File Structure

### Client-Side Services (New)
- **`src/services/binanceClient.js`**
  - `getBinanceKlines()` - Fetch candlestick data
  - `getUSDTSymbols()` - Get trading pairs
  - `getExchangeInfo()` - Get exchange info
  - `testConnection()` - Test Binance connectivity
  - All calls run in browser using native `fetch()`

- **`src/services/smcAnalyzerClient.js`**
  - `scanSymbol()` - Analyze single symbol
  - `scanMultipleSymbols()` - Batch scanning with progress
  - `formatSignalsForDisplay()` - Format results
  - All analysis runs in browser

### Updated Components
- **`src/SignalTracker.jsx`**
  - ✅ Now uses `scanMultipleSymbols()` from client
  - ❌ Removed server-side `/api/scan` call

- **`src/Settings.jsx`**
  - ✅ Now uses `getUSDTSymbols()` from client
  - ❌ Removed server-side `/api/symbols/all` call

- **`src/components/PatternChart.jsx`**
  - ✅ Now uses `getBinanceKlines()` from client
  - ❌ Removed server-side `/api/klines` call

### Server Endpoints (Backend)
The following endpoints are still available but mostly unused:

#### Active Endpoints:
- `GET /api/health` - Health check (shows geo-restricted status)
- `GET /api/symbols` - Get saved symbols from config ✅ (used)
- `GET /api/settings` - Get user settings ✅ (used)
- `POST /api/settings` - Save user settings ✅ (used)

#### Deprecated Endpoints (No Longer Called):
- `GET /api/symbols/all` - ❌ Replaced by client-side `getUSDTSymbols()`
- `POST /api/scan` - ❌ Replaced by client-side `scanMultipleSymbols()`
- `GET /api/klines` - ❌ Replaced by client-side `getBinanceKlines()`

## Benefits

### 1. No Geo-Restrictions
- Calls originate from user's location (Asia)
- No server IP blocking issues
- Works for all users who can access Binance

### 2. Performance
- Faster - no server round-trip for data fetching
- Reduced Vercel serverless function usage
- Better scalability - each user handles their own requests

### 3. Cost
- Less backend processing
- Fewer serverless function invocations
- Lower Vercel bills

### 4. Reliability
- No dependency on Vercel's server location
- Works anywhere users can access Binance
- More resilient to API changes

## Trade-offs

### Considerations
1. **Client-side processing** - Uses user's browser CPU
   - Impact: Minimal (JavaScript is fast)

2. **Network dependent** - Requires user's Binance access
   - Impact: Only affects users in restricted regions

3. **Rate limiting** - Each user has their own rate limit
   - Impact: None (1200 req/min is plenty for individual users)

4. **Browser compatibility** - Requires modern browser with fetch API
   - Impact: None (all modern browsers support it)

## Data Flow

### Scanning Symbols
```
1. User selects symbols and timeframe
2. Browser calls scanMultipleSymbols()
3. For each symbol:
   a. Browser → Binance API (get klines)
   b. Browser processes SMC analysis
   c. Browser stores results
4. Display signals to user
```

### Loading Symbols
```
1. User opens Settings
2. Browser → getUSDTSymbols()
3. Browser → Binance API (get exchange info)
4. Browser filters USDT pairs
5. Display to user
```

### Saving Settings
```
1. User modifies settings
2. Browser → Vercel API (POST /api/settings)
3. Vercel saves to config.json
4. Confirmation to user
```

## Deployment Notes

### Vercel Environment
- Backend serves static files (frontend)
- Backend provides settings storage only
- No Binance API calls from backend
- Health endpoint will show "geo-restricted" (expected)

### What Works
✅ Symbol scanning
✅ Chart visualization
✅ Settings management
✅ All frontend features

### What Shows Warning
⚠️ `/api/health` returns "geo-restricted" (expected, doesn't affect functionality)

## Testing

### Verify Client-Side Operations
1. Open browser DevTools → Network tab
2. Scan symbols
3. Verify requests go to:
   - ✅ `api.binance.com` (from browser)
   - ✅ `your-app.vercel.app/api/settings` (from browser to Vercel)
   - ❌ NOT `your-app.vercel.app/api/scan` (old server endpoint)

### Check for Errors
```javascript
// Open browser console, should see:
Scanning: 100% (10/10) - BTCUSDT
Found 5 signals

// Should NOT see:
Failed to fetch /api/klines
Cannot GET /api/scan
```

## Future Improvements

### Possible Enhancements
1. Add service worker for offline caching
2. Implement WebWorker for heavy SMC calculations
3. Add browser-based rate limit handling
4. Implement client-side caching (localStorage)

### Alternative Architectures
If client-side doesn't work for some users:
1. Deploy backend to a VPS in Asia
2. Use a proxy service (e.g., CloudFlare Workers)
3. Use Binance.US API for US users
4. Implement hybrid mode (try client, fallback to server)

## Migration Checklist

When deploying this version:
- [x] Update frontend to use client-side services
- [x] Remove server-side Binance API calls from components
- [x] Test locally that scanning works
- [x] Deploy to Vercel
- [x] Verify in browser that Binance calls succeed
- [x] Confirm settings save/load works
- [ ] Monitor for any errors in production

## Support

If users report issues:
1. Check browser console for errors
2. Verify user can access api.binance.com directly
3. Check for CORS errors (shouldn't happen with Binance)
4. Confirm browser supports fetch API
5. Test in incognito mode (clear cache/cookies)

---

**Last Updated**: 2025-12-20
**Architecture Version**: 2.0 (Client-Side)
