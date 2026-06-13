const express = require('express');
const Database = require('../utils/database');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const runMigrations = require('../utils/migrations');

const router = express.Router();

// Setup temporary folder for database migrations (inside the database directory)
const tempDir = path.join(__dirname, '../database/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Multer setup for handling uploaded database backup files
const upload = multer({ dest: tempDir });

// Helper to validate SQLite database structure
function validateDatabase(filePath) {
  return new Promise((resolve) => {
    const tempDb = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return resolve(false);
      }
      
      // Check for expected tables in sqlite_master
      const query = `
        SELECT count(*) as count 
        FROM sqlite_master 
        WHERE type='table' AND name IN ('loans', 'customers', 'companies', 'users', 'receipts')
      `;
      tempDb.get(query, [], (queryErr, row) => {
        tempDb.close();
        if (queryErr || !row || row.count !== 5) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  });
}

// Export database file
router.get('/export', async (req, res) => {
  let db;
  let tempBackupPath;
  try {
    const timestamp = Date.now();
    const tempDir = path.join(__dirname, '../database/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    tempBackupPath = path.join(tempDir, `pawn_broker_backup_${timestamp}.db`);
    
    db = new Database();
    // Run VACUUM INTO to create a safe copy of the active database without locking it
    await db.run(`VACUUM INTO '${tempBackupPath.replace(/'/g, "''")}'`);
    await db.close();
    db = null;

    const formattedDate = new Date().toISOString().slice(0, 10);
    const filename = `pawn_broker_backup_${formattedDate}.db`;

    res.download(tempBackupPath, filename, (err) => {
      // Delete temp backup file after transfer is complete/failed
      fs.unlink(tempBackupPath, (unlinkErr) => {
        if (unlinkErr && unlinkErr.code !== 'ENOENT') {
          console.error('Error deleting temp backup file:', unlinkErr);
        }
      });
    });
  } catch (error) {
    console.error('Error exporting database:', error);
    if (db) {
      try { await db.close(); } catch (_) {}
    }
    if (tempBackupPath && fs.existsSync(tempBackupPath)) {
      try { fs.unlinkSync(tempBackupPath); } catch (_) {}
    }
    res.status(500).json({
      success: false,
      error: 'Failed to export database: ' + error.message
    });
  }
});

// Import database file (restores the system to this database backup)
router.post('/import', upload.single('backupFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No backup file uploaded.'
    });
  }

  const uploadedFilePath = req.file.path;
  const targetDbPath = path.join(__dirname, '../database/pawn_broker.db');

  try {
    // 1. Validate the database structure
    const isValid = await validateDatabase(uploadedFilePath);
    if (!isValid) {
      fs.unlinkSync(uploadedFilePath);
      return res.status(400).json({
        success: false,
        error: 'Invalid backup file. The uploaded file is not a valid pawn broker database backup.'
      });
    }

    // 2. Perform atomic replace
    // Rename temp file to target path.
    // On macOS/Linux this overwrite is atomic and works even if file is open.
    fs.renameSync(uploadedFilePath, targetDbPath);

    // 3. Run migrations on the newly restored database to ensure the schema matches the current version
    await runMigrations();

    // 4. Read counts of imported tables to present in the response
    const db = new Database();
    const companies = await db.get('SELECT count(*) as count FROM companies');
    const customers = await db.get('SELECT count(*) as count FROM customers');
    const users = await db.get('SELECT count(*) as count FROM users');
    const loans = await db.get('SELECT count(*) as count FROM loans');
    const receipts = await db.get('SELECT count(*) as count FROM receipts');
    await db.close();

    res.json({
      success: true,
      message: 'Database restored successfully',
      imported: {
        companies: companies.count,
        customers: customers.count,
        users: users.count,
        loans: loans.count,
        receipts: receipts.count
      }
    });

  } catch (error) {
    console.error('Error during database import:', error);
    if (fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch (_) {}
    }
    res.status(500).json({
      success: false,
      error: 'Failed to restore database: ' + error.message
    });
  }
});

module.exports = router;
