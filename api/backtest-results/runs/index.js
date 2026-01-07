/**
 * Vercel Serverless Function: Get Backtest Runs Index
 * GET /api/backtest-results/runs
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
    // Read index.json from backtest-results directory
    const indexPath = path.join(process.cwd(), 'backtest-results', 'index.json');
    const data = await fs.readFile(indexPath, 'utf8');
    const index = JSON.parse(data);

    res.status(200).json(index);
  } catch (error) {
    console.error('Error reading backtest index:', error);

    if (error.code === 'ENOENT') {
      return res.status(200).json({ runs: [] });
    }

    res.status(500).json({
      error: 'Failed to read backtest index',
      message: error.message
    });
  }
}
