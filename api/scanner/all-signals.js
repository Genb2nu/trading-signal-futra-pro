/**
 * Vercel Serverless Function: Get All Signals
 * GET /api/scanner/all-signals
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Try to read signals from cache file
    const signalsFile = path.join('/tmp', 'scanner-signals.json');

    let signals = [];
    try {
      const data = await fs.readFile(signalsFile, 'utf8');
      const parsed = JSON.parse(data);
      signals = parsed.signals || [];
    } catch (fileError) {
      // File doesn't exist or can't be read - return empty signals
      console.log('No cached signals found, returning empty array');
    }

    const { limit = 100, offset = 0 } = req.query;
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    const paginatedSignals = signals.slice(offsetNum, offsetNum + limitNum);

    res.status(200).json({
      success: true,
      total: signals.length,
      offset: offsetNum,
      limit: limitNum,
      signals: paginatedSignals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get signals error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      signals: []
    });
  }
}
