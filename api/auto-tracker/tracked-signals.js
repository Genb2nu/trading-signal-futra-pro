/**
 * Vercel Serverless Function: Get Tracked Signals
 * GET /api/auto-tracker/tracked-signals
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
      // File doesn't exist, return empty array
      console.log('No tracked signals found');
    }

    res.status(200).json({
      success: true,
      signals: trackedSignals,
      count: trackedSignals.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get tracked signals error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      signals: []
    });
  }
}
