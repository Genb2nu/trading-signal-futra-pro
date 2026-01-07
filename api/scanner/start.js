/**
 * Vercel Serverless Function: Start Scanner
 * POST /api/scanner/start
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanMultipleSymbols, formatSignalsForDisplay } from '../smcAnalyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read config for symbols
    const configPath = path.join(__dirname, '../../config.json');
    let config;
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(configData);
    } catch (error) {
      console.error('Error reading config:', error);
      return res.status(500).json({ error: 'Could not read configuration' });
    }

    const symbols = config.symbols || [];
    const timeframe = req.body.timeframe || config.defaultTimeframes?.[0] || '1h';

    if (symbols.length === 0) {
      return res.status(400).json({ error: 'No symbols configured' });
    }

    console.log(`Starting scan for ${symbols.length} symbols on ${timeframe}...`);

    // Run scan
    const results = await scanMultipleSymbols(symbols, timeframe, (progress) => {
      console.log(`Progress: ${progress.percentage}% (${progress.completed}/${progress.total})`);
    });

    const signals = formatSignalsForDisplay(results);

    // Cache signals to temp file
    const signalsFile = path.join('/tmp', 'scanner-signals.json');
    await fs.writeFile(signalsFile, JSON.stringify({
      signals,
      timestamp: new Date().toISOString(),
      timeframe,
      symbolCount: symbols.length
    }));

    console.log(`Scan complete. Found ${signals.length} signals.`);

    res.status(200).json({
      success: true,
      message: 'Scan completed',
      signalsFound: signals.length,
      symbolsScanned: symbols.length,
      timeframe,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Scanner start error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
