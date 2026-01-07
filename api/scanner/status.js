/**
 * Vercel Serverless Function: Scanner Status
 * GET /api/scanner/status
 */

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
    // For Vercel, we don't have a persistent scanner
    // Return status indicating serverless mode
    res.status(200).json({
      running: false,
      mode: 'serverless',
      message: 'Continuous scanner not available on Vercel. Use manual scan instead.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Scanner status error:', error);
    res.status(500).json({
      error: error.message,
      running: false
    });
  }
}
