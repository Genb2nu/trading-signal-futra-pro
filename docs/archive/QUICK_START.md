# Quick Start Guide

## Installation

```bash
npm install
```

## Development Mode

Run both backend (port 3000) and frontend (port 5173):

```bash
npm run dev
```

Or use the start script:

```bash
./start.sh
```

Then open your browser:
- Frontend UI: http://localhost:5173
- Backend API: http://localhost:3000/api/health

## Production Build

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

The entire application runs on port 3000.

## How to Use

### 1. Signal Tracker Page

1. **Select Timeframe**: Choose between 1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M
2. **Select Symbols**: Check the symbols you want to scan (select all or pick specific ones)
3. **Click "Start Scan"**: The system will analyze all selected symbols
4. **View Results**: Signals appear in a table with:
   - Symbol name
   - Entry price
   - Stop loss level
   - Take profit target
   - Risk/reward ratio
   - Confidence level (high/medium)
   - Detected patterns (Order Block, FVG, Liquidity Sweep, BMS)

### 2. Settings Page

1. **Symbol Limit**: Set how many symbols to track (default: 50)
2. **Symbol Selection**:
   - Click "Select Top 50" to auto-select the most popular pairs
   - Use search box to find specific symbols
   - Check/uncheck individual symbols
3. **Click "Save Settings"**: Configuration saves to `config.json`

## Understanding the Signals

### Signal Types

- **BUY (Bullish)**: Long position recommendation
- **SELL (Bearish)**: Short position recommendation

### Confidence Levels

- **High**: 3+ SMC patterns aligned (very strong signal)
- **Medium**: 2 SMC patterns aligned (good signal)

### Patterns Detected

1. **Order Block**: Institutional order zones
2. **FVG (Fair Value Gap)**: Price imbalances
3. **Liquidity Sweep**: Stop hunts at key levels
4. **BMS (Break of Market Structure)**: Trend reversals

### How to Trade

1. **Entry**: Use the entry price shown in the signal
2. **Stop Loss**: Place stop loss at the level shown
3. **Take Profit**: Target the take profit level (default 2:1 R:R)
4. **Position Size**: Calculate based on your risk tolerance
5. **Confirmation**: Higher timeframes (4h, 1d) give more reliable signals

## API Endpoints

If you want to integrate with other tools:

- `GET /api/health` - Check system status
- `GET /api/symbols` - Get configured symbols
- `POST /api/scan` - Scan symbols (body: `{symbols, timeframe, strategy}`)
- `GET /api/settings` - Get settings
- `POST /api/settings` - Update settings

Example API call:

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["BTCUSDT", "ETHUSDT"], "timeframe": "1h", "strategy": "SMC"}'
```

## Troubleshooting

### Can't connect to Binance

- Check your internet connection
- Binance API might be temporarily down
- Some countries/regions may have restrictions

### No signals found

- SMC signals require specific market conditions
- Try different timeframes (4h and 1d often work better)
- Scan more symbols to increase chances
- Volatile market conditions produce more signals

### Application won't start

- Make sure port 3000 is not already in use
- Run `npm install` again to ensure all dependencies are installed
- Check Node.js version (requires v16+)

## Tips for Best Results

1. **Use Higher Timeframes**: 4h and 1d charts produce more reliable signals
2. **Scan Regularly**: Market conditions change - scan multiple times per day
3. **Check Multiple Symbols**: More symbols = higher chance of finding quality setups
4. **Verify Manually**: Always review the chart yourself before trading
5. **Risk Management**: Never risk more than 1-2% of your capital per trade
6. **Paper Trade First**: Test the signals on paper before using real money

## Advanced Configuration

Edit `config.json` directly for advanced settings:

```json
{
  "symbols": ["BTCUSDT", "ETHUSDT", ...],
  "limit": 50,
  "defaultTimeframes": ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"]
}
```

## Performance Notes

- Scanning 50 symbols takes ~5-10 seconds (100ms delay per symbol)
- Binance API has rate limits (1200 requests/minute)
- Recommended: Scan 10-20 symbols at a time for faster results
- Server requires ~100MB RAM

## Deployment

For cloud deployment (Heroku, Railway, Render, etc.):

1. Build: `npm run build`
2. Set PORT environment variable
3. Start: `npm start`
4. Ensure the platform supports Node.js 16+

## Support

For issues, check:
- README.md for detailed documentation
- Binance API status: https://www.binance.com/en/support/announcement
- GitHub Issues (if applicable)

---

**Disclaimer**: This is an educational tool. Always do your own research before trading. Cryptocurrency trading carries significant risk.
