/**
 * Vercel Serverless Function: Get Latest Backtest Results
 * GET /api/backtest-results/latest
 */

import fs from 'fs/promises';
import path from 'path';

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
    // Read latest-backtest.json from backtest-results directory
    const filePath = path.join(process.cwd(), 'backtest-results', 'latest-backtest.json');
    const data = await fs.readFile(filePath, 'utf8');
    const results = JSON.parse(data);

    res.status(200).json(results);
  } catch (error) {
    console.error('Error reading latest backtest:', error);

    if (error.code === 'ENOENT') {
      return res.status(404).json({
        error: 'No backtest results found',
        message: 'Run a backtest to generate results'
      });
    }

    res.status(500).json({
      error: 'Failed to read backtest results',
      message: error.message
    });
  }
}
