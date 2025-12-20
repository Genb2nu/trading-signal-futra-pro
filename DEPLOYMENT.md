# Vercel Deployment Guide

This guide will help you deploy the SMC Trading Signal Detector to Vercel.

## Prerequisites

1. A GitHub account
2. A Vercel account (sign up at https://vercel.com)
3. Vercel CLI installed (optional, for command-line deployment)

## Method 1: Deploy via GitHub (Recommended)

### Step 1: Push to GitHub

1. Create a new repository on GitHub
2. Add the remote and push your code:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### Step 2: Import to Vercel

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repository
4. Vercel will auto-detect the settings
5. Click "Deploy"

The deployment will:
- Run `npm run build` to build the frontend and backend
- Deploy the `dist` folder as static files
- Deploy the `api` folder as serverless functions

### Step 3: Configure Environment (if needed)

If you need to add environment variables:
1. Go to your project settings in Vercel
2. Navigate to "Environment Variables"
3. Add any required variables (e.g., API keys)

## Method 2: Deploy via Vercel CLI

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

From your project directory:

```bash
# For preview deployment
vercel

# For production deployment
vercel --prod
```

## Project Configuration

The project includes:

- **vercel.json**: Vercel configuration file
  - Specifies build command and output directory
  - Configures serverless function settings
  - Sets up API rewrites

- **api/index.js**: Serverless function entry point
  - Handles all `/api/*` routes
  - Connects to Binance API
  - Serves SMC analysis endpoints

## Post-Deployment

After deployment:

1. **Access your app**: Vercel will provide a URL (e.g., `your-app.vercel.app`)
2. **Custom domain**: Add a custom domain in project settings if desired
3. **Monitor**: Check the Vercel dashboard for logs and analytics

## API Endpoints

Your deployed app will have these endpoints:

- `GET /api/health` - Health check
- `GET /api/symbols` - Get configured symbols
- `GET /api/symbols/all` - Get all Binance USDT pairs
- `POST /api/scan` - Scan symbols for signals
- `GET /api/settings` - Get settings
- `POST /api/settings` - Update settings

## Troubleshooting

### Build Failures

If the build fails:
1. Check the build logs in Vercel dashboard
2. Ensure all dependencies are in `package.json`
3. Verify `npm run build` works locally

### API Errors

If API endpoints return errors:
1. Check function logs in Vercel dashboard
2. Verify Binance API is accessible
3. Check for rate limiting issues

### Configuration Issues

If settings don't persist:
1. Note that Vercel filesystem is read-only
2. Consider using Vercel KV or another database for persistent storage
3. Or use environment variables for configuration

## Important Notes

- **Serverless Functions**: API routes run as serverless functions with a 30-second timeout
- **Read-Only Filesystem**: Settings saved via the UI won't persist across deployments
- **Rate Limits**: Binance API rate limits still apply
- **Cold Starts**: First request to API may be slower due to function initialization

## Recommended: Use Environment Variables

For production, consider moving configuration to environment variables:

1. In Vercel dashboard, add environment variables:
   - `SYMBOLS` - Comma-separated list of symbols
   - `SYMBOL_LIMIT` - Maximum number of symbols

2. Update code to read from `process.env`

## Support

- Vercel Documentation: https://vercel.com/docs
- GitHub Issues: Report issues in your repository
- Binance API Docs: https://binance-docs.github.io/apidocs/

## License

MIT
