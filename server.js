require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const loanRoutes = require('./routes/loans');
const receiptRoutes = require('./routes/receipts');
const masterSheetRoutes = require('./routes/masterSheet');
const reportRoutes = require('./routes/reports');
const noticeRoutes = require('./routes/notices');
const dataMigrationRoutes = require('./routes/dataMigration');
const runMigrations = require('./utils/migrations');
const authenticate = require('./middleware/authenticate');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Optional: IP Whitelisting for additional security (uncomment to enable)
// Requires ALLOWED_IPS environment variable (comma-separated IP addresses)
// Example: ALLOWED_IPS=192.168.1.100,203.0.113.50
// const ipWhitelist = require('./middleware/ipWhitelist');
// app.use(ipWhitelist);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', authenticate, companyRoutes);
app.use('/api/loans', authenticate, loanRoutes);
app.use('/api/receipts', authenticate, receiptRoutes);
app.use('/api/master-sheet', authenticate, masterSheetRoutes);
app.use('/api/reports', authenticate, reportRoutes);
app.use('/api/notices', authenticate, noticeRoutes);
app.use('/api/data-migration', authenticate, dataMigrationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Pawn Broker System is running' });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  console.error('Request URL:', req.url);
  console.error('Request Method:', req.method);
  
  // Don't send error details in production, but log them
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong!' 
    : err.message || 'Something went wrong!';
  
  res.status(err.status || 500).json({ 
    error: errorMessage,
    ...(process.env.NODE_ENV !== 'production' && { details: err.message, stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
  try {
    await runMigrations();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Pawn Broker System running on port ${PORT}`);
      console.log(`Access the system at:`);
      console.log(`  Local: http://localhost:${PORT}`);
      console.log(`  Network: http://192.168.29.246:${PORT}`);
      console.log(`\nShare this network URL with your client for remote access`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
