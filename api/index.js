import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { testConnection, getUSDTSymbols } from './binanceService.js';
import { scanMultipleSymbols, formatSignalsForDisplay } from './smcAnalyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    console.log('Health check requested...');
    const binanceConnected = await testConnection();
    console.log('Binance connection status:', binanceConnected);
    res.json({
      status: 'ok',
      binance: binanceConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL ? 'vercel' : 'local'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get configured symbols
app.get('/api/symbols', async (req, res) => {
  try {
    const configPath = path.join(__dirname, '../config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    res.json({ symbols: config.symbols || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all available symbols from Binance
app.get('/api/symbols/all', async (req, res) => {
  try {
    const symbols = await getUSDTSymbols();
    res.json({ symbols });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scan endpoint
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

    const results = await scanMultipleSymbols(symbols, timeframe, (progress) => {
      console.log(`Progress: ${progress.percentage}% (${progress.completed}/${progress.total})`);
    });

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

// Get settings
app.get('/api/settings', async (req, res) => {
  try {
    const configPath = path.join(__dirname, '../config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update settings
app.post('/api/settings', async (req, res) => {
  try {
    const configPath = path.join(__dirname, '../config.json');
    await fs.writeFile(configPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
