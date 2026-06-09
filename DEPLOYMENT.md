# Deployment Guide - Pawn Broker System

⚠️ **IMPORTANT: This project contains confidential information. Always use PRIVATE repositories and follow security best practices.**

This guide covers free deployment options for your Node.js/Express application with SQLite database, with emphasis on privacy and security.

## 🚀 Recommended Free Hosting Options

### 1. **Render** (Best Overall - Recommended)

**Why Render?**
- ✅ Free tier with persistent disk storage (perfect for SQLite)
- ✅ Automatic HTTPS
- ✅ Easy Git integration
- ✅ Automatic deployments
- ⚠️ Spins down after 15 min inactivity (wakes on request)

**Deployment Steps:**

1. **Push your code to GitHub (PRIVATE REPOSITORY REQUIRED)**
   
   **⚠️ CRITICAL: Create a PRIVATE repository, not public!**
   
   - Go to GitHub.com → New Repository
   - **Name**: `pawn-broker-system` (or your choice)
   - **Visibility**: Select **PRIVATE** ⚠️ (NOT public!)
   - Click "Create repository"
   
   Then push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_PRIVATE_GITHUB_REPO_URL
   git push -u origin main
   ```
   
   **Verify it's private:** Check that the repository shows "Private" badge on GitHub

2. **Sign up at [render.com](https://render.com)** (free account)

3. **Create a new Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: `pawn-broker-system` (or your choice)
     - **Environment**: `Node`
     - **Build Command**: `npm install && npm run init-db`
     - **Start Command**: `npm start`
     - **Plan**: Free

4. **Add Environment Variables** (if needed):
   - `PORT` (usually auto-set, but you can set it)
   - `NODE_ENV=production`

5. **Deploy!**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Your app will be live at `https://your-app-name.onrender.com`

**Important Notes:**
- The database will be created automatically on first run
- Data persists on Render's free tier
- First request after inactivity may take 30-60 seconds (cold start)

---

### 2. **Railway** (Great Alternative)

**Why Railway?**
- ✅ $5 free credit monthly (usually enough for small apps)
- ✅ Persistent storage
- ✅ Very fast deployments
- ✅ Great developer experience

**Deployment Steps:**

1. **Sign up at [railway.app](https://railway.app)** (GitHub login)

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - **Choose your PRIVATE repository** (only your private repos will be listed)

3. **Configure:**
   - Railway auto-detects Node.js
   - Add build command: `npm install && npm run init-db`
   - Start command: `npm start`

4. **Deploy:**
   - Railway automatically deploys
   - Get your live URL from the project dashboard

**Note:** Railway gives you a custom domain like `your-app.up.railway.app`

---

### 3. **Fly.io** (Good for Global Distribution)

**Why Fly.io?**
- ✅ Free tier with persistent volumes
- ✅ Global edge network
- ✅ Great for production apps

**Deployment Steps:**

1. **Install Fly CLI:**
   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **Sign up:** `fly auth signup`

3. **Initialize:**
   ```bash
   fly launch
   ```
   - Follow prompts
   - Choose a region
   - Don't deploy a Postgres database (you're using SQLite)

4. **Create a volume for database:**
   ```bash
   fly volumes create data --size 1
   ```

5. **Update fly.toml** (created automatically):
   ```toml
   [mounts]
     source = "data"
     destination = "/app/database"
   ```

6. **Deploy:**
   ```bash
   fly deploy
   ```

---

### 4. **Cyclic** (Simple Node.js Hosting)

**Why Cyclic?**
- ✅ Free tier
- ✅ Automatic deployments from GitHub
- ✅ Built for Node.js

**Deployment Steps:**

1. **Sign up at [cyclic.sh](https://cyclic.sh)** (GitHub login)

2. **Connect Repository:**
   - Click "New App"
   - **Select your PRIVATE GitHub repo**
   - Cyclic auto-detects Node.js

3. **Deploy:**
   - Cyclic handles everything automatically
   - Get your URL: `https://your-app.cyclic.app`

**Note:** May need to verify persistent storage support for SQLite

---

## 📋 Pre-Deployment Checklist (PRIVACY & SECURITY)

Before deploying, ensure:

### Repository Security
- [ ] **Repository is set to PRIVATE on GitHub** ⚠️ CRITICAL
- [ ] Only trusted team members have repository access
- [ ] `.gitignore` excludes `node_modules`, `.env`, and `database/*.db`
- [ ] No credentials or sensitive data committed to git
- [ ] Reviewed all files for confidential information

### Application Security
- [ ] Default admin password changed (currently `admin123` - CHANGE THIS!)
- [ ] Strong admin password set (12+ characters)
- [ ] All sensitive config moved to environment variables
- [ ] HTTPS enabled (automatic on recommended platforms)
- [ ] Authentication middleware is working correctly

### Deployment Configuration
- [ ] Database initialization script runs on first deploy
- [ ] `package.json` has correct start script
- [ ] Port is configured via `process.env.PORT`
- [ ] Environment variables configured in hosting platform

## 🔧 Configuration Updates Needed

Your project is already well-configured! Just ensure:

1. **Database Path**: Already handles directory creation ✅
2. **Port Configuration**: Uses `process.env.PORT || 3000` ✅
3. **Static Files**: Served correctly ✅

## 🗄️ Database Considerations

**SQLite on Free Hosting:**
- ✅ Works great on Render, Railway, Fly.io
- ✅ Data persists on these platforms
- ⚠️ For production with high traffic, consider migrating to PostgreSQL later

**If you need to migrate to PostgreSQL later:**
- Render offers free PostgreSQL
- Railway offers PostgreSQL addon
- Supabase offers free PostgreSQL tier

## 🔒 Security & Privacy Recommendations (CRITICAL)

### Repository Security
1. **✅ ALWAYS use PRIVATE GitHub repositories** - Never make this repo public
2. **✅ Limit repository access** - Only grant access to trusted team members
3. **✅ Review .gitignore** - Ensure `.env`, `database/*.db`, and sensitive files are excluded
4. **✅ Never commit credentials** - Use environment variables for all secrets

### Application Security
1. **✅ Change default admin credentials immediately** after first deployment
   - Default: `admin` / `admin123` - **CHANGE THIS!**
2. **✅ Use strong passwords** - At least 12 characters, mix of letters, numbers, symbols
3. **✅ Enable HTTPS** - Automatic on all recommended platforms ✅
4. **✅ Use environment variables** for all sensitive configuration
5. **✅ Consider IP whitelisting** - Restrict access to known IP addresses (see below)
6. **✅ Regular backups** - Backup your database regularly
7. **✅ Monitor access logs** - Review who is accessing the system

### Additional Security Measures

#### Option 1: IP Whitelisting (Recommended for Confidential Data)
Add IP restrictions to your deployment:

**For Render:**
- Use a reverse proxy (Cloudflare) with IP filtering
- Or upgrade to paid tier for custom firewall rules

**For Railway/Fly.io:**
- Use middleware to check request IPs
- Add IP whitelist in your application code

#### Option 2: Additional Password Protection
Consider adding:
- Two-factor authentication (2FA)
- Session timeout
- Login attempt limits

#### Option 3: Self-Hosting (Maximum Privacy)
For maximum control and privacy, consider self-hosting:
- Deploy on your own server/VPS
- Use VPN for access
- Full control over security measures

## 📊 Monitoring Your Deployment

All platforms provide:
- Deployment logs
- Application logs
- Health check endpoints (you already have `/api/health`)

## 🆘 Troubleshooting

**Database not found errors:**
- Ensure `npm run init-db` runs during build
- Check that database directory is writable

**App not starting:**
- Check logs in platform dashboard
- Verify PORT environment variable
- Ensure all dependencies are in `package.json`

**Slow first request:**
- Normal on free tiers (cold start)
- Consider upgrading to paid tier for always-on

## 💰 Cost Comparison

| Platform | Free Tier | Paid Tier Starts At |
|----------|-----------|---------------------|
| Render   | ✅ Yes (with limits) | $7/month |
| Railway  | ✅ $5 credit/month | $5/month |
| Fly.io   | ✅ Yes (with limits) | Pay-as-you-go |
| Cyclic   | ✅ Yes | $10/month |

## 🎯 Quick Start Recommendation

**For confidential/internal use:** Use **Render** with a PRIVATE repository - easiest setup with good security.

**For maximum privacy:** Consider **self-hosting** on your own server with VPN access.

**For production with sensitive data:** 
- Use **Railway** or **Fly.io** with IP restrictions
- Or upgrade to paid tier for advanced security features
- Consider adding Cloudflare for additional protection

## 🏠 Self-Hosting Option (Maximum Privacy)

If you want complete control and maximum privacy:

### Option 1: Local Network Deployment
- Deploy on a computer/server in your office
- Access via local network IP (e.g., `http://192.168.1.100:3000`)
- No external access = maximum security
- Free and completely private

### Option 2: VPS (Virtual Private Server)
- Rent a VPS from providers like:
  - DigitalOcean ($4-6/month)
  - Linode ($5/month)
  - Vultr ($2.50/month)
- Full control over security
- Can set up VPN for access
- More secure than shared hosting

### Option 3: Cloud with VPN
- Deploy on any cloud platform
- Use VPN (like Tailscale, ZeroTier) for access
- Only VPN users can access the application
- Best balance of convenience and security

---

## 🔐 Security & Privacy

**⚠️ CRITICAL: This application contains confidential information.**

See **[SECURITY.md](./SECURITY.md)** for comprehensive security guidelines including:
- Changing default admin password
- IP whitelisting setup
- VPN configuration
- Backup strategies
- Security best practices

## Need Help?

- Render Docs: https://render.com/docs
- Railway Docs: https://docs.railway.app
- Fly.io Docs: https://fly.io/docs
- Security Guide: See [SECURITY.md](./SECURITY.md)

