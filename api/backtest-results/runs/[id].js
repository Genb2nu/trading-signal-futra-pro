/**
 * Vercel Serverless Function: Get Specific Backtest Run
 * GET /api/backtest-results/runs/:id
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
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        error: 'Missing backtest run ID'
      });
    }

    // Read specific backtest run from backtest-results/runs directory
    const filePath = path.join(process.cwd(), 'backtest-results', 'runs', `${id}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    const results = JSON.parse(data);

    res.status(200).json(results);
  } catch (error) {
    console.error('Error reading backtest run:', error);

    if (error.code === 'ENOENT') {
      return res.status(404).json({
        error: 'Backtest run not found',
        message: `No backtest found with ID: ${req.query.id}`
      });
    }

    res.status(500).json({
      error: 'Failed to read backtest run',
      message: error.message
    });
  }
}
