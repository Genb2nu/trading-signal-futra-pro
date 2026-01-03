# Backtest Index Cleaned

**Date**: January 3, 2026
**Action**: Removed old backtest runs, kept only latest 15 results

---

## Cleanup Summary

### Before:
- **Total Runs**: 50 (many outdated/deleted files)
- **Issue**: index.json referenced files that no longer existed

### After:
- **Total Runs**: 15 (current 5m/15m/1h backtest)
- **Files**: All 15 JSON files exist and match index
- **Status**: ✅ Clean and synchronized

---

## Current Backtest Results (Latest 15 Runs)

| # | Mode | Timeframe | Trades | Win Rate | Profit Factor | Status |
|---|------|-----------|--------|----------|---------------|--------|
| 1 | SNIPER | 1h | 5 | 60.0% | 0.66 | ⚠️ Losing |
| 2 | SNIPER | 15m | 2 | 100% | 999 | ✅ Perfect |
| 3 | SNIPER | 5m | 0 | 0% | 0 | ❌ No signals |
| 4 | ELITE | 1h | 7 | 71.4% | 1.82 | ✅ Good |
| 5 | ELITE | 15m | 3 | 100% | 999 | ✅ Perfect |
| 6 | ELITE | 5m | 0 | 0% | 0 | ❌ No signals |
| 7 | AGGRESSIVE | 1h | 14 | 85.7% | 8.91 | ✅ Excellent |
| 8 | AGGRESSIVE | 15m | 10 | 90.0% | 6.26 | ✅ Excellent |
| 9 | AGGRESSIVE | 5m | 0 | 0% | 0 | ❌ No signals |
| 10 | MODERATE | 1h | 16 | 87.5% | 11.05 | ✅ Outstanding |
| 11 | MODERATE | 15m | 9 | 88.9% | 6.08 | ✅ Excellent |
| 12 | MODERATE | 5m | 0 | 0% | 0 | ❌ No signals |
| 13 | CONSERVATIVE | 1h | 16 | 75.0% | 4.58 | ✅ Good |
| 14 | CONSERVATIVE | 15m | 8 | 87.5% | 4.98 | ✅ Excellent |
| 15 | CONSERVATIVE | 5m | 0 | 0% | 0 | ❌ No signals |

---

## API Endpoints (Verified Working)

### Status
```
GET http://localhost:3000/api/backtest-results/status
```
**Response**:
```json
{
  "available": true,
  "hasIndex": true,
  "totalRuns": 15,
  "directory": "/mnt/c/Claude Code/Trading Signal/Futra Pro/backtest-results"
}
```

### All Runs
```
GET http://localhost:3000/api/backtest-results/runs
```
**Returns**: Index with all 15 runs

### Latest Backtest
```
GET http://localhost:3000/api/backtest-results/latest
```
**Returns**: Most recent backtest (SNIPER 1h)

### Specific Run
```
GET http://localhost:3000/api/backtest-results/runs/2026-01-03_moderate_1h
```
**Returns**: Full backtest data for MODERATE 1h

---

## Files Structure

```
backtest-results/
├── index.json                                  (15 entries)
├── latest-backtest.json                        (SNIPER 1h)
└── runs/
    ├── 2026-01-03_conservative_5m.json        (0 trades)
    ├── 2026-01-03_conservative_15m.json       (8 trades, 87.5% WR)
    ├── 2026-01-03_conservative_1h.json        (16 trades, 75.0% WR)
    ├── 2026-01-03_moderate_5m.json            (0 trades)
    ├── 2026-01-03_moderate_15m.json           (9 trades, 88.9% WR)
    ├── 2026-01-03_moderate_1h.json            (16 trades, 87.5% WR)
    ├── 2026-01-03_aggressive_5m.json          (0 trades)
    ├── 2026-01-03_aggressive_15m.json         (10 trades, 90.0% WR)
    ├── 2026-01-03_aggressive_1h.json          (14 trades, 85.7% WR)
    ├── 2026-01-03_elite_5m.json               (0 trades)
    ├── 2026-01-03_elite_15m.json              (3 trades, 100% WR)
    ├── 2026-01-03_elite_1h.json               (7 trades, 71.4% WR)
    ├── 2026-01-03_sniper_5m.json              (0 trades)
    ├── 2026-01-03_sniper_15m.json             (2 trades, 100% WR)
    └── 2026-01-03_sniper_1h.json              (5 trades, 60.0% WR)
```

---

## How to View in UI

1. **Refresh your browser** (Ctrl+Shift+R / Cmd+Shift+R)
2. **Go to "Backtest Results" tab**
3. **Select from dropdown**:
   - Latest Backtest (SNIPER 1h)
   - Or any of the 15 individual runs

### What You'll See:

Each dropdown option shows:
```
[MODE] - [TIMEFRAME] ([TRADES] trades, [WIN_RATE]%)
```

Examples:
- `MODERATE - 1h (16 trades, 87.5%)`
- `AGGRESSIVE - 15m (10 trades, 90.0%)`
- `ELITE - 15m (3 trades, 100.0%)`

---

## Key Findings from Latest Backtest

### ✅ Best Performing:
1. **MODERATE 1h**: 16 trades, 87.5% WR, 11.05 PF
2. **AGGRESSIVE 15m**: 10 trades, 90.0% WR, 6.26 PF
3. **ELITE 15m**: 3 trades, 100% WR, 999 PF

### ⚠️ Avoid:
1. **5m timeframe**: All modes generated 0 trades
2. **SNIPER 1h**: 60% WR, 0.66 PF (losing money)

### 📊 Recommended:
- **For Day Trading**: MODERATE 1h (87.5% WR, +1.26R avg)
- **For Scalping**: AGGRESSIVE 15m (90% WR, +0.53R avg)
- **For Quality**: ELITE 15m (100% WR, +0.96R avg)

---

## Verification Commands

To verify the cleanup worked:

```bash
# Check total files
ls backtest-results/runs/*.json | wc -l
# Output: 15

# Check API
curl http://localhost:3000/api/backtest-results/status
# Output: {"available":true,"hasIndex":true,"totalRuns":15,...}

# List all runs
curl http://localhost:3000/api/backtest-results/runs | python3 -m json.tool
```

---

## Conclusion

✅ **Index cleaned successfully**
- Removed 35 old/invalid entries
- Kept 15 latest backtest runs (5m/15m/1h)
- All files synchronized with index
- API serving correct data

**Server Status**: Running on http://localhost:3000
**Ready to view**: Refresh browser to see updated results

---

**Generated**: January 3, 2026
**Status**: ✅ Clean and Ready
