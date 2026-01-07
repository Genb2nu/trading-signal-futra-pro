/**
 * Vercel Serverless Function: Auto-Track Signals
 * POST /api/auto-tracker/auto-track
 */

import fs from 'fs/promises';
import path from 'path';

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
    // Read available signals
    const signalsFile = path.join('/tmp', 'scanner-signals.json');
    let availableSignals = [];

    try {
      const data = await fs.readFile(signalsFile, 'utf8');
      const parsed = JSON.parse(data);
      availableSignals = parsed.signals || [];
    } catch (fileError) {
      return res.status(400).json({
        success: false,
        error: 'No signals available. Run a scan first.',
        tracked: 0
      });
    }

    // Filter for ENTRY_READY signals
    const readySignals = availableSignals.filter(signal =>
      signal.signal?.entryState === 'ENTRY_READY' &&
      signal.signal?.canTrack === true
    );

    if (readySignals.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No ENTRY_READY signals to track',
        tracked: 0
      });
    }

    // Read existing tracked signals
    const trackedFile = path.join('/tmp', 'auto-tracked-signals.json');
    let trackedSignals = [];

    try {
      const data = await fs.readFile(trackedFile, 'utf8');
      trackedSignals = JSON.parse(data);
    } catch (fileError) {
      // File doesn't exist, start fresh
    }

    // Track new signals (avoid duplicates)
    let newlyTracked = 0;
    const trackedIds = new Set(trackedSignals.map(s => s.id));

    readySignals.forEach(signal => {
      if (!trackedIds.has(signal.id)) {
        trackedSignals.push({
          ...signal,
          trackedAt: new Date().toISOString(),
          status: 'ACTIVE'
        });
        newlyTracked++;
      }
    });

    // Save updated tracked signals
    await fs.writeFile(trackedFile, JSON.stringify(trackedSignals, null, 2));

    res.status(200).json({
      success: true,
      message: `Tracked ${newlyTracked} new signal(s)`,
      tracked: newlyTracked,
      total: trackedSignals.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Auto-track error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      tracked: 0
    });
  }
}
