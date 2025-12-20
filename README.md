# SMC Trading Signal Detector

A web application that detects Smart Money Concept (SMC) trading patterns on Binance cryptocurrency pairs and generates trading signals.

## Features

- **Smart Money Concept Detection**: Automatically detects SMC patterns including:
  - Order Blocks (bullish & bearish)
  - Fair Value Gaps (FVG)
  - Market Structure Breaks (BMS)
  - Liquidity Sweeps
  - Change of Character (ChoCh)

- **Multi-Symbol Scanning**: Scan up to 50+ USDT trading pairs simultaneously
- **Multiple Timeframes**: Support for 1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M
- **Real-time Analysis**: Direct integration with Binance API
- **Configurable Settings**: Customize which symbols to track
- **No Database Required**: All configuration stored in JSON file
- **Single Deployment**: Backend and frontend bundled together

## Project Structure

```
/src
  /server
    - index.js              # Express server
    - binanceService.js     # Binance API integration
    - smcAnalyzer.js        # Signal scanning logic
  /client
    - App.jsx              # Main React component
    - SignalTracker.jsx    # Signal scanning page
    - Settings.jsx         # Settings page
  /shared
    - smcDetectors.js      # SMC pattern detection algorithms
/dist                      # Production build output
config.json                # Symbol configuration
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. The application will automatically fetch USDT pairs from Binance on first run.

## Development

Run both backend and frontend in development mode:

```bash
npm run dev
```

- Backend API: http://localhost:3000
- Frontend: http://localhost:5173

## Production Build

Build for production:

```bash
npm run build
```

Start production server:

```bash
npm start
```

The application will run on port 3000 (or PORT environment variable).

## Usage

### Signal Tracker Page

1. **Select Timeframe**: Choose from 1m to 1M timeframes
2. **Select Strategy**: Currently supports SMC (extensible for future strategies)
3. **Select Symbols**: Choose which trading pairs to scan
4. **Start Scan**: Click to begin scanning
5. **View Results**: See detected signals with entry/exit levels

### Settings Page

1. **Configure Symbol Limit**: Set maximum number of symbols to track (default: 50)
2. **Select Symbols**: Choose specific USDT pairs to monitor
3. **Quick Actions**:
   - Select Top N symbols
   - Clear all selections
   - Search for specific symbols
4. **Save**: Persist settings to config.json

## API Endpoints

- `GET /api/health` - Health check and Binance connection status
- `GET /api/symbols` - Get configured symbols
- `GET /api/symbols/all` - Get all available USDT pairs from Binance
- `POST /api/scan` - Scan symbols for signals
  - Body: `{ symbols: string[], timeframe: string, strategy: string }`
- `GET /api/settings` - Get current settings
- `POST /api/settings` - Update settings

## SMC Strategy Explanation

The Smart Money Concept (SMC) is a trading methodology based on institutional order flow:

### Key Patterns Detected

1. **Order Blocks**: Areas where institutions place large orders
   - Bullish OB: Last down candle before strong upward impulse
   - Bearish OB: Last up candle before strong downward impulse

2. **Fair Value Gaps**: Price imbalances that tend to get filled
   - Bullish FVG: Gap created during upward moves
   - Bearish FVG: Gap created during downward moves

3. **Market Structure**: Trend identification
   - Uptrend: Higher Highs (HH) + Higher Lows (HL)
   - Downtrend: Lower Highs (LH) + Lower Lows (LL)

4. **Liquidity Sweeps**: Stop hunts where price briefly breaks levels then reverses

5. **Break of Structure**: Confirmation of trend change

### Signal Generation

Signals are generated when multiple patterns align (confluence):
- Entry: Current price when patterns align
- Stop Loss: Below/above nearest order block
- Take Profit: 2:1 risk-reward ratio
- Confidence: High when 3+ patterns align, Medium otherwise

## Configuration

Edit `config.json` to customize:

```json
{
  "symbols": ["BTCUSDT", "ETHUSDT", ...],
  "limit": 50,
  "defaultTimeframes": ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"]
}
```

## Technical Details

- **Backend**: Node.js + Express
- **Frontend**: React + Vite
- **API Integration**: Binance REST API (v3)
- **No Database**: Configuration in JSON file
- **Deployment**: Single process serving both API and frontend

## Performance Considerations

- Scanning many symbols takes time (100ms delay between requests)
- Higher timeframes (4h, 1d) provide more reliable signals
- Binance API rate limits apply (1200 requests/minute)
- Recommended: Select 10-20 symbols for faster scans

## Disclaimer

This tool is for educational and informational purposes only. Trading cryptocurrencies carries significant risk. Always do your own research and never invest more than you can afford to lose. Past performance does not guarantee future results.

## Future Enhancements

- Additional strategies (ICT, Wyckoff, etc.)
- Real-time notifications
- Signal history and performance tracking
- Advanced filtering options
- Backtesting capabilities
- Multi-exchange support

## License

MIT
