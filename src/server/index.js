import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import axios from 'axios';
import { getUSDTSymbols, testConnection } from './binanceService.js';
import { scanMultipleSymbols, formatSignalsForDisplay } from './smcAnalyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Config file path
const CONFIG_PATH = path.join(__dirname, '../../config.json');

/**
 * Load configuration from file
 */
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Return default config if file doesn't exist
    return {
      symbols: [],
      limit: 50,
      defaultTimeframes: ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M']
    };
  }
}

/**
 * Save configuration to file
 */
async function saveConfig(config) {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

/**
 * Initialize config with USDT symbols if empty
 */
async function initializeConfig() {
  let config = await loadConfig();

  if (!config.symbols || config.symbols.length === 0) {
    console.log('Fetching USDT symbols from Binance...');
    try {
      const allSymbols = await getUSDTSymbols();
      config.symbols = allSymbols.slice(0, config.limit || 50);
      await saveConfig(config);
      console.log(`Initialized config with ${config.symbols.length} USDT symbols`);
    } catch (error) {
      console.error('Error initializing config:', error.message);
    }
  }

  return config;
}

// API Routes

/**
 * Health check endpoint
 */
app.get('/api/health', async (req, res) => {
  const binanceConnected = await testConnection();
  res.json({
    status: 'ok',
    binance: binanceConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

/**
 * Get available symbols from settings
 */
app.get('/api/symbols', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json({
      symbols: config.symbols,
      limit: config.limit
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all USDT symbols from Binance
 */
app.get('/api/symbols/all', async (req, res) => {
  try {
    const symbols = await getUSDTSymbols();
    res.json({ symbols });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Scan symbols for SMC signals
 */
app.post('/api/scan', async (req, res) => {
  try {
    const { symbols, timeframe, strategy } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Symbols array is required' });
    }

    if (!timeframe) {
      return res.status(400).json({ error: 'Timeframe is required' });
    }

    console.log(`Scanning ${symbols.length} symbols on ${timeframe} timeframe...`);

    // Scan all symbols
    const results = await scanMultipleSymbols(symbols, timeframe, (progress) => {
      console.log(`Progress: ${progress.percentage}% (${progress.completed}/${progress.total})`);
    });

    // Format signals for display
    const signals = formatSignalsForDisplay(results);

    console.log(`Scan complete. Found ${signals.length} signals.`);

    res.json({
      success: true,
      signals,
      scanned: symbols.length,
      found: signals.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get klines/candlestick data for charting
 */
app.get('/api/klines', async (req, res) => {
  try {
    const { symbol, interval, limit } = req.query;

    if (!symbol || !interval) {
      return res.status(400).json({ error: 'Symbol and interval are required' });
    }

    const klinesLimit = limit || 200;
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${klinesLimit}`;

    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error('Klines fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current settings
 */
app.get('/api/settings', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update settings
 */
app.post('/api/settings', async (req, res) => {
  try {
    const { symbols, limit, defaultTimeframes } = req.body;

    const config = await loadConfig();

    if (symbols !== undefined) config.symbols = symbols;
    if (limit !== undefined) config.limit = limit;
    if (defaultTimeframes !== undefined) config.defaultTimeframes = defaultTimeframes;

    await saveConfig(config);

    res.json({
      success: true,
      config
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../dist');
  app.use(express.static(staticPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// Start server
async function startServer() {
  try {
    // Initialize configuration
    await initializeConfig();

    // Test Binance connection
    const connected = await testConnection();
    if (!connected) {
      console.warn('Warning: Cannot connect to Binance API');
    } else {
      console.log('Connected to Binance API');
    }

    // Start listening
    app.listen(PORT, () => {
      console.log(`\n🚀 SMC Trading Signal Server running on port ${PORT}`);
      console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`💻 Development mode - Frontend running separately on Vite`);
      }
      console.log('');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
