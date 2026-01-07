# 🧪 Browser Test Guide - Visualization Limits

**Date:** January 6, 2026
**Feature:** Configurable pattern display limits on charts
**Status:** Ready for testing

---

## 🎯 What We're Testing

The visualization limits feature filters SMC patterns on charts based on:
1. **Count limit** - Show only latest N patterns (e.g., 3 FVGs, 2 OBs)
2. **Distance filter** - Show only patterns within X% of current price
3. **Recency filter** - Show only patterns within N candles from current

---

## ✅ Current Configuration

**From config.json (Aggressive Mode defaults):**
```
Max FVGs to show: 5
Max Order Blocks to show: 5
Max CHoCH lines to show: 3
Max BOS lines to show: 3
Max Candles Back: 100
Max Distance from Price: 15%
```

**Test Signal Available:**
- Symbol: ETCUSDT
- Timeframe: 15m
- Direction: bullish
- Entry State: ENTRY_READY
- Patterns: CHoCH + Rejection

---

## 🧪 Test Scenarios

### Test 1: Verify Default Filtering (Aggressive Mode)

**Steps:**
1. Open: http://localhost:3000
2. Click: **Signal Tracker** tab (top navigation)
3. Find signal: **ETCUSDT** (15m, BULLISH)
4. Click: **📊 Chart** button on that signal

**Expected Result:**
- Chart loads with candlesticks and patterns
- If HTF FVGs present: Shows max 5 FVG zones (not all)
- If HTF OBs present: Shows max 5 Order Block zones (not all)
- CHoCH lines: Max 3 displayed
- BOS lines: Max 3 displayed
- All patterns are within 100 candles from current
- All patterns are within 15% of current price

**Console Check:**
- Open browser DevTools (F12)
- Go to Console tab
- Look for: "=== PATTERN DETAILS DEBUG ===" output
- Should show filtered arrays

---

### Test 2: Change Limits to Minimal (Sniper Mode)

**Steps:**
1. Click: **Settings** tab (top navigation)
2. Scroll down to: **📊 Chart Visualization Limits** section
3. Change values:
   - Max FVG Zones: `1` (down from 5)
   - Max Order Block Zones: `1` (down from 5)
   - Max CHoCH Lines: `1` (down from 3)
   - Max BOS Lines: `1` (down from 3)
   - Max Candles Back: `25` (down from 100)
   - Max Distance from Price: `5%` (down from 15%)
4. Click: **Save Settings** button
5. Wait for success message

**Verify Settings Saved:**
```bash
curl -s http://localhost:3000/api/settings | python3 -m json.tool | grep -A 7 "visualizationLimits"
```
Should show:
```json
"visualizationLimits": {
    "maxFVGs": 1,
    "maxOrderBlocks": 1,
    "maxCHOCH": 1,
    "maxBOS": 1,
    "maxCandlesBack": 25,
    "maxDistancePercent": 5
}
```

**View Chart Again:**
1. Go back to: **Signal Tracker** tab
2. Click: **📊 Chart** on same signal
3. Refresh page if needed (Ctrl+R or Cmd+R)

**Expected Result:**
- **MUCH CLEANER** chart with minimal patterns
- Only 1 FVG zone visible (if any)
- Only 1 Order Block zone visible (if any)
- Only 1 CHoCH line visible (if any)
- Only 1 BOS line visible (if any)
- Patterns are very recent (within 25 candles)
- Patterns are very close to price (within 5%)

**Visual Comparison:**
```
Before (maxFVGs=5): ████ ████ ████ ████ ████ (5 FVG zones)
After (maxFVGs=1):  ████                      (1 FVG zone - nearest)
```

---

### Test 3: Change to Maximum Context (Swing Trader Mode)

**Steps:**
1. Go to: **Settings** tab
2. Change visualization limits to:
   - Max FVG Zones: `10`
   - Max Order Block Zones: `10`
   - Max CHoCH Lines: `5`
   - Max BOS Lines: `5`
   - Max Candles Back: `200`
   - Max Distance from Price: `30%`
3. Click: **Save Settings**

**View Chart Again:**
1. Go back to: **Signal Tracker** tab
2. Click: **📊 Chart** on signal
3. Refresh page if needed

**Expected Result:**
- **BUSIER** chart with more patterns
- Up to 10 FVG zones visible (if available)
- Up to 10 Order Block zones visible (if available)
- Up to 5 CHoCH lines visible
- Up to 5 BOS lines visible
- Patterns look back further (200 candles)
- Patterns can be further from price (30%)

---

### Test 4: Verify Distance Filtering

**Test the maxDistancePercent parameter:**

**Steps:**
1. Settings: Set `maxDistancePercent` to `5%` (very strict)
2. Save and view chart
3. Note which patterns appear
4. Change to `maxDistancePercent` to `20%` (lenient)
5. Save and view chart again

**Expected Difference:**
- At 5%: Only patterns very close to current price
- At 20%: Patterns can be further away, more zones visible

**How to Verify:**
- Look at price labels on chart
- Current price: ~$13.30 (for ETCUSDT example)
- At 5%: Only patterns between $12.64 - $13.96 (5% range)
- At 20%: Patterns between $10.64 - $15.96 (20% range)

---

### Test 5: Verify Recency Filtering

**Test the maxCandlesBack parameter:**

**Steps:**
1. Settings: Set `maxCandlesBack` to `20` (very recent only)
2. Save and view chart
3. Count pattern markers (FVG labels, OB labels, CHoCH/BOS circles)
4. Change to `maxCandlesBack` to `100` (look back further)
5. Save and view chart again

**Expected Difference:**
- At 20 candles: Only patterns from last ~5 hours (on 15m timeframe)
- At 100 candles: Patterns from last ~25 hours (on 15m timeframe)
- More patterns visible with higher maxCandlesBack

---

## 🔍 Verification Checklist

**Settings UI:**
- [ ] Can access Settings tab
- [ ] Can see "📊 Chart Visualization Limits" section
- [ ] All 6 input fields are editable
- [ ] Values update in real-time as you type
- [ ] Save Settings button works
- [ ] Success message appears after save

**Chart Filtering:**
- [ ] Chart loads successfully
- [ ] Patterns are limited by count (not showing all)
- [ ] Only recent patterns appear (based on maxCandlesBack)
- [ ] Only nearby patterns appear (based on maxDistancePercent)
- [ ] Changing settings and refreshing updates the chart
- [ ] Lower limits = cleaner chart
- [ ] Higher limits = more context

**Console Output:**
- [ ] No errors in browser console (F12)
- [ ] PatternChart component logs "=== PATTERN DETAILS DEBUG ==="
- [ ] Can see filtered pattern counts

---

## 📊 Visual Examples

### Example 1: Aggressive Mode (Default)
```
Current Price: $100
maxDistancePercent: 15%
maxFVGs: 5

All FVGs in Data:
1. FVG @ $50  (50% away)  ❌ Filtered out (too far)
2. FVG @ $75  (25% away)  ❌ Filtered out (too far)
3. FVG @ $88  (12% away)  ✅ SHOWN (within 15%)
4. FVG @ $95  (5% away)   ✅ SHOWN (within 15%)
5. FVG @ $98  (2% away)   ✅ SHOWN (within 15%)
6. FVG @ $99  (1% away)   ✅ SHOWN (within 15%)
7. FVG @ $102 (2% away)   ✅ SHOWN (within 15%)

Chart displays: 5 FVG zones (limited by maxFVGs)
```

### Example 2: Sniper Mode (Minimal)
```
Current Price: $100
maxDistancePercent: 5%
maxFVGs: 1

All FVGs in Data:
1. FVG @ $88  (12% away)  ❌ Filtered out (too far)
2. FVG @ $95  (5% away)   ❌ Filtered out (not nearest)
3. FVG @ $98  (2% away)   ❌ Filtered out (not nearest)
4. FVG @ $99  (1% away)   ✅ SHOWN (nearest within 5%)

Chart displays: 1 FVG zone (the nearest one)
```

---

## 🐛 Troubleshooting

**Issue: Chart shows all patterns (no filtering)**
- **Cause:** visualizationLimits not loaded from settings
- **Fix:** Check config.json has visualizationLimits object
- **Verify:** `curl http://localhost:3000/api/settings | grep visualizationLimits`

**Issue: Settings changes don't affect chart**
- **Cause:** Need to refresh page after changing settings
- **Fix:** After saving settings, refresh the page (Ctrl+R)
- **Reason:** PatternChart loads settings on mount

**Issue: No patterns showing at all**
- **Cause:** Limits too strict (e.g., maxDistancePercent=1%, maxCandlesBack=5)
- **Fix:** Increase limits to see patterns
- **Verify:** Try maxDistancePercent=20%, maxCandlesBack=100

**Issue: All patterns showing (same as before feature)**
- **Cause:** visualizationLimits is null or undefined
- **Fix:** Add visualizationLimits to config.json
- **Fallback:** Code uses defaults if null

---

## 🎯 Success Criteria

**Feature is working correctly if:**

✅ **Settings UI:**
- Can change all 6 visualization limit values
- Save button persists changes to config.json
- Values are retrievable via `/api/settings`

✅ **Chart Filtering:**
- Chart shows fewer patterns with lower limits
- Chart shows more patterns with higher limits
- Distance filter works (only patterns near price)
- Recency filter works (only patterns from recent candles)
- Count limit works (max N patterns displayed)

✅ **User Experience:**
- Sniper mode (maxFVGs=1): Ultra-clean chart, 1 zone only
- Aggressive mode (maxFVGs=5): Balanced context
- Custom mode (maxFVGs=10): Maximum context

---

## 🚀 Quick Test Commands

**1. Check current limits:**
```bash
curl -s http://localhost:3000/api/settings | python3 -m json.tool | grep -A 7 "visualizationLimits"
```

**2. Get signal for testing:**
```bash
python3 test-viz-limits.py
```

**3. Update limits via API (alternative to UI):**
```bash
curl -X POST http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "visualizationLimits": {
      "maxFVGs": 2,
      "maxOrderBlocks": 2,
      "maxCHOCH": 1,
      "maxBOS": 1,
      "maxCandlesBack": 30,
      "maxDistancePercent": 8
    }
  }'
```

**4. Check server logs:**
```bash
tail -20 server.log
```

---

## 📝 Test Results Template

**Copy this and fill in your results:**

```
VISUALIZATION LIMITS TEST RESULTS
Date: _________________
Tester: _____________

Test 1: Default Filtering (Aggressive Mode)
- Chart loads: [ ] Pass [ ] Fail
- Patterns filtered: [ ] Pass [ ] Fail
- Notes: _________________________________

Test 2: Minimal Limits (Sniper Mode)
- Settings save: [ ] Pass [ ] Fail
- Chart updates: [ ] Pass [ ] Fail
- Only 1 pattern visible: [ ] Pass [ ] Fail
- Notes: _________________________________

Test 3: Maximum Context
- Settings save: [ ] Pass [ ] Fail
- More patterns visible: [ ] Pass [ ] Fail
- Notes: _________________________________

Test 4: Distance Filtering
- 5% shows fewer patterns: [ ] Pass [ ] Fail
- 20% shows more patterns: [ ] Pass [ ] Fail
- Notes: _________________________________

Test 5: Recency Filtering
- 20 candles shows fewer: [ ] Pass [ ] Fail
- 100 candles shows more: [ ] Pass [ ] Fail
- Notes: _________________________________

Overall Result: [ ] PASS [ ] FAIL
```

---

## 🎉 Expected Final Result

**After testing, you should be able to:**

1. ✅ Configure how many patterns display on charts
2. ✅ Control distance threshold (only show patterns near price)
3. ✅ Control recency threshold (only show recent patterns)
4. ✅ Switch between clean (Sniper) and detailed (Aggressive) views
5. ✅ See immediate effect when changing limits
6. ✅ Have cleaner, more focused charts for trading decisions

---

**Ready to test! Open http://localhost:3000 and follow the test scenarios above.** 🚀
