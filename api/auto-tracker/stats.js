/**
 * Vercel Serverless Function: Auto-Tracker Stats
 * GET /api/auto-tracker/stats
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
    // Try to read tracked signals from cache
    const trackedFile = path.join('/tmp', 'auto-tracked-signals.json');

    let trackedSignals = [];
    try {
      const data = await fs.readFile(trackedFile, 'utf8');
      trackedSignals = JSON.parse(data);
    } catch (fileError) {
      // File doesn't exist, return empty stats
    }

    // Calculate stats
    const total = trackedSignals.length;
    const active = trackedSignals.filter(s => s.status === 'ACTIVE').length;
    const won = trackedSignals.filter(s => s.status === 'WON').length;
    const lost = trackedSignals.filter(s => s.status === 'LOST').length;
    const expired = trackedSignals.filter(s => s.status === 'EXPIRED').length;

    const winRate = total > 0 ? ((won / (won + lost)) * 100).toFixed(1) : '0.0';

    // Calculate total P&L
    let totalPnL = 0;
    trackedSignals.forEach(signal => {
      if (signal.status === 'WON') {
        totalPnL += signal.riskReward || 2.0;
      } else if (signal.status === 'LOST') {
        totalPnL -= 1;
      }
    });

    res.status(200).json({
      total,
      active,
      won,
      lost,
      expired,
      winRate: parseFloat(winRate),
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      error: error.message,
      total: 0,
      active: 0,
      won: 0,
      lost: 0,
      expired: 0,
      winRate: 0,
      totalPnL: 0
    });
  }
}
