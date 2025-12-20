import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Import server modules
const binanceServicePath = path.join(__dirname, '../dist/server/binanceService.js');
const smcAnalyzerPath = path.join(__dirname, '../dist/server/smcAnalyzer.js');

let binanceService, smcAnalyzer;

// Dynamic imports for ES modules
const loadModules = async () => {
  if (!binanceService) {
    const { testBinanceConnection, getAvailableSymbols } = await import(binanceServicePath);
    binanceService = { testBinanceConnection, getAvailableSymbols };
  }
  if (!smcAnalyzer) {
    const { scanSymbols } = await import(smcAnalyzerPath);
    smcAnalyzer = { scanSymbols };
  }
};

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await loadModules();
    const binanceStatus = await binanceService.testBinanceConnection();
    res.json({
      status: 'ok',
      binance: binanceStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
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
    await loadModules();
    const symbols = await binanceService.getAvailableSymbols();
    res.json({ symbols });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scan endpoint
app.post('/api/scan', async (req, res) => {
  try {
    await loadModules();
    const { symbols, timeframe, strategy } = req.body;

    if (!symbols || !timeframe || !strategy) {
      return res.status(400).json({
        error: 'Missing required parameters: symbols, timeframe, strategy'
      });
    }

    const results = await smcAnalyzer.scanSymbols(symbols, timeframe);
    res.json({ signals: results });
  } catch (error) {
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
