/**
 * Vercel Serverless Function: Backtest Results (ALL endpoints consolidated)
 * GET /api/backtest-results?endpoint=latest
 * GET /api/backtest-results?endpoint=status
 * GET /api/backtest-results?endpoint=runs
 * GET /api/backtest-results?endpoint=run&id=xxx
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

  const { endpoint = 'latest', id } = req.query;

  try {
    const backtestDir = path.join(process.cwd(), 'backtest-results');

    // Route 1: Get latest backtest
    if (endpoint === 'latest') {
      const filePath = path.join(backtestDir, 'latest-backtest.json');

      try {
        const data = await fs.readFile(filePath, 'utf8');
        const results = JSON.parse(data);
        return res.status(200).json(results);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(404).json({
            error: 'No backtest results found',
            message: 'Run a backtest to generate results'
          });
        }
        throw error;
      }
    }

    // Route 2: Get status
    if (endpoint === 'status') {
      const latestPath = path.join(backtestDir, 'latest-backtest.json');
      const indexPath = path.join(backtestDir, 'index.json');
      const runsDir = path.join(backtestDir, 'runs');

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

      return res.status(200).json({
        available: hasLatest,
        hasIndex,
        totalRuns: runCount,
        directory: backtestDir,
        serverless: true
      });
    }

    // Route 3: Get runs index
    if (endpoint === 'runs') {
      const indexPath = path.join(backtestDir, 'index.json');

      try {
        const data = await fs.readFile(indexPath, 'utf8');
        const index = JSON.parse(data);
        return res.status(200).json(index);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(200).json({ runs: [] });
        }
        throw error;
      }
    }

    // Route 4: Get specific run by ID
    if (endpoint === 'run') {
      if (!id) {
        return res.status(400).json({
          error: 'Missing backtest run ID'
        });
      }

      const filePath = path.join(backtestDir, 'runs', `${id}.json`);

      try {
        const data = await fs.readFile(filePath, 'utf8');
        const results = JSON.parse(data);
        return res.status(200).json(results);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(404).json({
            error: 'Backtest run not found',
            message: `No backtest found with ID: ${id}`
          });
        }
        throw error;
      }
    }

    // Unknown endpoint
    return res.status(400).json({
      error: 'Invalid endpoint parameter',
      validEndpoints: ['latest', 'status', 'runs', 'run']
    });

  } catch (error) {
    console.error('Backtest results error:', error);
    res.status(500).json({
      error: 'Failed to process request',
      message: error.message
    });
  }
}
