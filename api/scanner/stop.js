/**
 * Vercel Serverless Function: Stop Scanner
 * POST /api/scanner/stop
 */

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

  // In serverless mode, there's nothing to stop
  res.status(200).json({
    success: true,
    message: 'Scanner stopped (serverless mode)',
    timestamp: new Date().toISOString()
  });
}
