/**
 * Backtest Results API Routes
 * Serves backtest results stored in JSON files
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base path to backtest results directory
const BACKTEST_DIR = path.join(__dirname, '../../../backtest-results');

/**
 * GET /api/backtest-results/latest
 * Returns the most recent backtest results
 */
router.get('/latest', (req, res) => {
  try {
    const filePath = path.join(BACKTEST_DIR, 'latest-backtest.json');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'No backtest results found',
        message: 'Run a backtest to generate results'
      });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch (error) {
    console.error('Error reading latest backtest:', error);
    res.status(500).json({
      error: 'Failed to read backtest results',
      message: error.message
    });
  }
});

/**
 * GET /api/backtest-results/runs
 * Returns the index of all available backtest runs
 */
router.get('/runs', (req, res) => {
  try {
    const indexPath = path.join(BACKTEST_DIR, 'index.json');

    if (!fs.existsSync(indexPath)) {
      return res.json({ runs: [] });
    }

    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    res.json(index);
  } catch (error) {
    console.error('Error reading backtest index:', error);
    res.status(500).json({
      error: 'Failed to read backtest index',
      message: error.message
    });
  }
});

/**
 * GET /api/backtest-results/runs/:id
 * Returns a specific backtest run by ID
 */
router.get('/runs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(BACKTEST_DIR, 'runs', `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Backtest run not found',
        message: `No backtest found with ID: ${id}`
      });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch (error) {
    console.error('Error reading backtest run:', error);
    res.status(500).json({
      error: 'Failed to read backtest run',
      message: error.message
    });
  }
});

/**
 * GET /api/backtest-results/status
 * Returns directory status and availability
 */
router.get('/status', (req, res) => {
  try {
    const hasLatest = fs.existsSync(path.join(BACKTEST_DIR, 'latest-backtest.json'));
    const hasIndex = fs.existsSync(path.join(BACKTEST_DIR, 'index.json'));
    const runsDir = path.join(BACKTEST_DIR, 'runs');
    const runCount = fs.existsSync(runsDir)
      ? fs.readdirSync(runsDir).filter(f => f.endsWith('.json')).length
      : 0;

    res.json({
      available: hasLatest,
      hasIndex,
      totalRuns: runCount,
      directory: BACKTEST_DIR
    });
  } catch (error) {
    console.error('Error checking backtest status:', error);
    res.status(500).json({
      error: 'Failed to check backtest status',
      message: error.message
    });
  }
});

export default router;
