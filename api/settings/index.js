/**
 * Vercel Serverless Function: Settings Management
 * GET /api/settings - Get current configuration
 * POST /api/settings - Update configuration (serverless mode: localStorage only)
 */

import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // GET: Return configuration
  if (req.method === 'GET') {
    try {
      // Read config.json from project root
      const configPath = path.join(process.cwd(), 'config.json');
      const configData = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);

      res.status(200).json(config);
    } catch (error) {
      console.error('Error reading config:', error);

      // Return default config if file doesn't exist
      res.status(200).json({
        symbols: [
          'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT',
          'DOGEUSDT', 'XRPUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT'
        ],
        limit: 50,
        defaultTimeframes: ['15m', '1h', '4h'],
        // Default strategy settings
        strategyMode: 'conservative',
        // Risk management defaults
        riskPerTrade: 1,
        maxConcurrentTrades: 3,
        stopLossATRMultiplier: 1.5,
        // Signal filtering defaults
        minimumConfluence: 2,
        minimumRiskReward: 2,
        minimumConfidenceLevel: 'medium',
        // Advanced settings
        requireHTFAlignment: true,
        allowNeutralZone: true,
        obImpulseThreshold: 0.005
      });
    }
  }

  // POST: Update configuration
  if (req.method === 'POST') {
    try {
      const {
        symbols,
        limit,
        defaultTimeframes,
        strategyMode,
        riskPerTrade,
        maxConcurrentTrades,
        stopLossATRMultiplier,
        minimumConfluence,
        minimumRiskReward,
        minimumConfidenceLevel,
        requireHTFAlignment,
        allowNeutralZone,
        obImpulseThreshold
      } = req.body;

      // Read current config
      let config = {};
      try {
        const configPath = path.join(process.cwd(), 'config.json');
        const configData = await fs.readFile(configPath, 'utf8');
        config = JSON.parse(configData);
      } catch (error) {
        // Use default config if file doesn't exist
        config = {
          symbols: [],
          limit: 50,
          defaultTimeframes: ['15m', '1h', '4h']
        };
      }

      // Update settings
      if (symbols !== undefined) config.symbols = symbols;
      if (limit !== undefined) config.limit = limit;
      if (defaultTimeframes !== undefined) config.defaultTimeframes = defaultTimeframes;
      if (strategyMode !== undefined) config.strategyMode = strategyMode;
      if (riskPerTrade !== undefined) config.riskPerTrade = riskPerTrade;
      if (maxConcurrentTrades !== undefined) config.maxConcurrentTrades = maxConcurrentTrades;
      if (stopLossATRMultiplier !== undefined) config.stopLossATRMultiplier = stopLossATRMultiplier;
      if (minimumConfluence !== undefined) config.minimumConfluence = minimumConfluence;
      if (minimumRiskReward !== undefined) config.minimumRiskReward = minimumRiskReward;
      if (minimumConfidenceLevel !== undefined) config.minimumConfidenceLevel = minimumConfidenceLevel;
      if (requireHTFAlignment !== undefined) config.requireHTFAlignment = requireHTFAlignment;
      if (allowNeutralZone !== undefined) config.allowNeutralZone = allowNeutralZone;
      if (obImpulseThreshold !== undefined) config.obImpulseThreshold = obImpulseThreshold;

      // In serverless mode, we can't persist to file system reliably
      // Settings are already saved to localStorage on client side
      // This endpoint just returns success to prevent errors

      console.log('✅ Settings update acknowledged (serverless mode - using localStorage)');
      console.log('   Strategy mode:', config.strategyMode);
      console.log('   Risk per trade:', config.riskPerTrade + '%');
      console.log('   Symbols:', config.symbols?.length || 0);

      res.status(200).json({
        success: true,
        message: 'Settings acknowledged (stored in browser localStorage)',
        config: config,
        serverless: true,
        note: 'In serverless mode, settings are persisted in browser localStorage only. Server config is read-only from deployment.'
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Method not allowed
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
