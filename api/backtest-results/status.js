/**
 * Vercel Serverless Function: Get Backtest Results Status
 * GET /api/backtest-results/status
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
    const backtestDir = path.join(process.cwd(), 'backtest-results');
    const latestPath = path.join(backtestDir, 'latest-backtest.json');
    const indexPath = path.join(backtestDir, 'index.json');
    const runsDir = path.join(backtestDir, 'runs');

    // Check if files exist
    let hasLatest = false;
    let hasIndex = false;
    let runCount = 0;

    try {
      await fs.access(latestPath);
      hasLatest = true;
    } catch (error) {
      // File doesn't exist
    }

    try {
      await fs.access(indexPath);
      hasIndex = true;
    } catch (error) {
      // File doesn't exist
    }

    try {
      const files = await fs.readdir(runsDir);
      runCount = files.filter(f => f.endsWith('.json')).length;
    } catch (error) {
      // Directory doesn't exist
    }

    res.status(200).json({
      available: hasLatest,
      hasIndex,
      totalRuns: runCount,
      directory: backtestDir,
      serverless: true
    });
  } catch (error) {
    console.error('Error checking backtest status:', error);
    res.status(500).json({
      error: 'Failed to check backtest status',
      message: error.message
    });
  }
}
