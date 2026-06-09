# Client Deployment Guide - Using Git Clone

This guide explains how to deploy the Pawn Broker Management System on a client's system using `git clone`.

## 📋 Prerequisites

Before starting, ensure the client's system has:

1. **Node.js** (version 14 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`
   - Verify npm: `npm --version`

2. **Git** (for cloning the repository)
   - Windows: https://git-scm.com/download/win
   - Mac: Usually pre-installed, or use Homebrew: `brew install git`
   - Linux: `sudo apt-get install git` (Ubuntu/Debian) or `sudo yum install git` (CentOS/RHEL)
   - Verify installation: `git --version`

3. **Internet Connection** (required for cloning and installing dependencies)

## 🚀 Step-by-Step Deployment Process

### Step 1: Get Access to the Repository

**Option A: Private GitHub Repository (Recommended)**
- You (the developer) will provide the client with:
  - Repository URL (e.g., `https://github.com/your-org/pawn-broker-system.git`)
  - Access credentials (GitHub username/password) OR personal access token
  - **Important:** Ensure the repository is set to **PRIVATE** for security

**Option B: Public Repository (Not Recommended for Confidential Data)**
- Only use this if the repository is intentionally public
- Client can clone without authentication

### Step 2: Clone the Repository

Open terminal/command prompt and navigate to where you want to install the application:

```bash
# Navigate to desired location (example: Desktop)
cd ~/Desktop  # On Mac/Linux
# OR
cd C:\Users\YourUsername\Desktop  # On Windows

# Clone the repository
git clone https://github.com/your-org/pawn-broker-system.git

# Navigate into the project directory
cd pawn-broker-system
```

**If repository is private and authentication is required:**
- **Using HTTPS:** Git will prompt for username and password (or personal access token)
- **Using Personal Access Token (Recommended):**
  - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
  - Generate a new token with `repo` scope
  - Use the token as password when prompted

### Step 3: Install Dependencies

Install all required Node.js packages:

```bash
npm install
```

This will:
- Read `package.json` to identify dependencies
- Download and install all required packages to `node_modules/` folder
- This may take 2-5 minutes depending on internet speed

**Expected output:** A long list of installed packages, ending with something like:
```
added 234 packages in 2m
```

### Step 4: Initialize the Database

Create and set up the SQLite database with initial data:

```bash
npm run init-db
```

This will:
- Create the `database/` directory if it doesn't exist
- Create `pawn_broker.db` database file
- Create all required tables (companies, customers, loans, receipts, users)
- Insert default companies:
  - Darshan Bankers (Gold loans)
  - Mutha Sobhagmull and Sons (Both gold and silver loans)
  - Dariachand and Sons (Gold loans)
- Create default admin user:
  - Username: `admin`
  - Password: `admin123`

**Expected output:**
```
Database initialized successfully!
Companies created:
- Darshan Bankers (gold)
- Mutha Sobhagmull and Sons (both)
- Dariachand and Sons (gold)
Default admin user ensured: admin/admin123
Database connection closed.
```

### Step 5: Configure Environment Variables (Optional)

Create a `.env` file in the project root if you need custom configuration:

```bash
# Create .env file (optional)
# On Windows (PowerShell):
New-Item .env

# On Mac/Linux:
touch .env
```

Add any required environment variables (if needed):
```
PORT=3000
NODE_ENV=production
# Add other variables as needed
```

**Note:** For basic deployment, this step is optional as the app works with defaults.

### Step 6: Start the Application

Start the server:

```bash
npm start
```

**Expected output:**
```
Pawn Broker System running on port 3000
Access the system at:
  Local: http://localhost:3000
  Network: http://192.168.x.x:3000
```

### Step 7: Access the Application

Open a web browser and navigate to:
- **Local access:** http://localhost:3000
- **Network access:** http://[your-ip-address]:3000
  - Find your IP address:
    - Windows: `ipconfig` (look for IPv4 Address)
    - Mac/Linux: `ifconfig` or `ip addr`

### Step 8: Change Default Admin Password (CRITICAL)

**⚠️ IMPORTANT SECURITY STEP:**

1. Open the application in browser
2. Log in with default credentials:
   - Username: `admin`
   - Password: `admin123`
3. **Immediately change the password** to a strong password:
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, and symbols
   - Example: `MyP@wnBr0ker2024!`

**How to change password:**
- If user management feature exists in the UI, use it
- OR update directly in database (see below)

## 📁 Project Structure After Deployment

```
pawn-broker-system/
├── database/
│   └── pawn_broker.db          # Created after init-db
├── node_modules/               # Created after npm install
├── public/
│   └── index.html              # Frontend interface
├── routes/                     # API routes
├── utils/                      # Utility functions
├── middleware/                 # Authentication middleware
├── scripts/
│   └── initDatabase.js         # Database initialization
├── server.js                   # Main server file
├── package.json                # Dependencies
└── .env                        # Environment variables (optional)
```

## 🔄 Updating the Application

When you release updates, the client can update their installation:

```bash
# Navigate to project directory
cd pawn-broker-system

# Pull latest changes from repository
git pull origin main

# Reinstall dependencies (if package.json changed)
npm install

# Run migrations if database schema changed
npm run init-db  # Only if schema updates are needed

# Restart the server
# Stop current server (Ctrl+C) then:
npm start
```

**Note:** 
- Database file (`pawn_broker.db`) is NOT overwritten by `git pull` (it's in `.gitignore`)
- Existing data will be preserved
- Only run `init-db` again if you specifically need to reset the database

## 🔒 Security Considerations

### 1. Repository Access
- ✅ Use **PRIVATE** GitHub repository
- ✅ Limit access to authorized personnel only
- ✅ Use personal access tokens instead of passwords when possible

### 2. Default Credentials
- ⚠️ **CHANGE default admin password immediately** after first deployment
- Default: `admin` / `admin123` - **MUST CHANGE THIS!**

### 3. Network Security
- Consider IP whitelisting if accessing over network
- Use VPN for remote access
- Enable firewall rules if exposing to internet

### 4. Database Backups
- Regular backups of `database/pawn_broker.db` recommended
- Store backups securely

### 5. Environment Variables
- Never commit `.env` file to repository (already in `.gitignore`)
- Keep sensitive configuration in `.env` file

## 🛠️ Troubleshooting

### Issue: "git: command not found"
**Solution:** Install Git from https://git-scm.com/downloads

### Issue: "node: command not found" or "npm: command not found"
**Solution:** Install Node.js from https://nodejs.org/

### Issue: "Permission denied" when running npm install
**Solution (Linux/Mac):** 
```bash
sudo npm install
```
Or fix npm permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors

### Issue: "Port 3000 already in use"
**Solution:** 
- Stop the other application using port 3000, OR
- Change the port by creating `.env` file:
  ```
  PORT=3001
  ```
  Then access at `http://localhost:3001`

### Issue: Database not found after deployment
**Solution:** Run database initialization:
```bash
npm run init-db
```

### Issue: Cannot clone repository (authentication error)
**Solutions:**
1. Verify repository URL is correct
2. Check if repository is private and you have access
3. Generate personal access token on GitHub and use it as password
4. Try using SSH instead of HTTPS (requires SSH key setup)

### Issue: npm install fails
**Solutions:**
1. Check internet connection
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and `package-lock.json`, then run `npm install` again
4. Try updating npm: `npm install -g npm@latest`

### Issue: Application won't start
**Solutions:**
1. Check if all dependencies installed: `npm install`
2. Check if database initialized: `npm run init-db`
3. Check terminal output for error messages
4. Verify Node.js version: `node --version` (should be 14+)

## 📞 Support

If you encounter issues during deployment:
1. Check the error messages in terminal
2. Verify all prerequisites are installed
3. Review this guide's troubleshooting section
4. Contact the development team with:
   - Error messages
   - Steps you've taken
   - Your system information (OS, Node.js version)

## 🎯 Quick Reference Commands

```bash
# Clone repository
git clone <repository-url>
cd pawn-broker-system

# Install dependencies
npm install

# Initialize database
npm run init-db

# Start application
npm start

# For development (with auto-restart)
npm run dev

# Update application
git pull origin main
npm install
npm start
```

## ✅ Post-Deployment Checklist

- [ ] Repository cloned successfully
- [ ] Dependencies installed (`npm install` completed)
- [ ] Database initialized (`npm run init-db` completed)
- [ ] Application starts without errors (`npm start` works)
- [ ] Application accessible in browser
- [ ] Can log in with default credentials
- [ ] **Default admin password changed** ⚠️ CRITICAL
- [ ] Tested creating a loan
- [ ] Tested generating a receipt
- [ ] Backup strategy planned for database

---

**Deployment Date:** ________________  
**Deployed By:** ________________  
**System Information:**
- OS: ________________
- Node.js Version: ________________
- Database Path: ________________

