const express = require('express');
const Database = require('../utils/database');
const router = express.Router();

// Export all data
router.get('/export', async (req, res) => {
  try {
    const db = new Database();
    
    // Export all tables in order (respecting foreign key dependencies)
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tables: {}
    };

    // Export companies
    exportData.tables.companies = await db.query('SELECT * FROM companies ORDER BY id');
    
    // Export customers
    exportData.tables.customers = await db.query('SELECT * FROM customers ORDER BY id');
    
    // Export users
    exportData.tables.users = await db.query('SELECT * FROM users ORDER BY id');
    
    // Export loans
    exportData.tables.loans = await db.query('SELECT * FROM loans ORDER BY id');
    
    // Export receipts
    exportData.tables.receipts = await db.query('SELECT * FROM receipts ORDER BY id');
    
    await db.close();

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `pawn_broker_backup_${timestamp}.json`;

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Send the JSON data
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export data: ' + error.message
    });
  }
});

// Import all data - accepts JSON directly in request body
router.post('/import', async (req, res) => {
  let db;
  try {
    // Get the import data from request body
    const importData = req.body;

    // Validate the import data structure
    if (!importData || !importData.tables || typeof importData.tables !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup file format. Please select a valid backup JSON file.'
      });
    }

    db = new Database();

    // Start transaction by disabling foreign keys temporarily
    await db.run('PRAGMA foreign_keys = OFF');
    
    // Clear existing data (in reverse order of dependencies)
    await db.run('DELETE FROM receipts');
    await db.run('DELETE FROM loans');
    await db.run('DELETE FROM customers');
    await db.run('DELETE FROM companies');
    await db.run('DELETE FROM users');

    // Reset auto-increment counters
    await db.run('DELETE FROM sqlite_sequence WHERE name IN ("companies", "customers", "users", "loans", "receipts")');

    // Import companies
    if (importData.tables.companies && Array.isArray(importData.tables.companies)) {
      for (const company of importData.tables.companies) {
        await db.run(
          'INSERT INTO companies (id, name, type, created_at) VALUES (?, ?, ?, ?)',
          [company.id, company.name, company.type, company.created_at]
        );
      }
    }

    // Import customers
    if (importData.tables.customers && Array.isArray(importData.tables.customers)) {
      for (const customer of importData.tables.customers) {
        await db.run(
          'INSERT INTO customers (id, name, father_name, husband_name, address, occupation, cell_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            customer.id,
            customer.name,
            customer.father_name || null,
            customer.husband_name || null,
            customer.address,
            customer.occupation || null,
            customer.cell_number || null,
            customer.created_at
          ]
        );
      }
    }

    // Import users
    if (importData.tables.users && Array.isArray(importData.tables.users)) {
      for (const user of importData.tables.users) {
        await db.run(
          'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
          [user.id, user.username, user.password_hash, user.role || 'admin', user.created_at]
        );
      }
    }

    // Import loans
    if (importData.tables.loans && Array.isArray(importData.tables.loans)) {
      for (const loan of importData.tables.loans) {
        await db.run(
          `INSERT INTO loans (
            id, serial_number, company_id, customer_id, loan_amount, item_weight,
            item_description, item_type, loan_date, interest_rate, status,
            released_date, created_at, notice1_date, notice2_date, notice3_date, notice4_date,
            notice1_comment, notice2_comment, notice3_comment, notice4_comment
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            loan.id,
            loan.serial_number,
            loan.company_id,
            loan.customer_id,
            loan.loan_amount,
            loan.item_weight,
            loan.item_description,
            loan.item_type,
            loan.loan_date,
            loan.interest_rate || 2.0,
            loan.status || 'active',
            loan.released_date || null,
            loan.created_at,
            loan.notice1_date || null,
            loan.notice2_date || null,
            loan.notice3_date || null,
            loan.notice4_date || null,
            loan.notice1_comment || null,
            loan.notice2_comment || null,
            loan.notice3_comment || null,
            loan.notice4_comment || null
          ]
        );
      }
    }

    // Import receipts
    if (importData.tables.receipts && Array.isArray(importData.tables.receipts)) {
      for (const receipt of importData.tables.receipts) {
        await db.run(
          'INSERT INTO receipts (id, loan_id, receipt_number, generated_at) VALUES (?, ?, ?, ?)',
          [receipt.id, receipt.loan_id, receipt.receipt_number, receipt.generated_at]
        );
      }
    }

    // Re-enable foreign keys
    await db.run('PRAGMA foreign_keys = ON');

    await db.close();

    res.json({
      success: true,
      message: 'Data imported successfully',
      imported: {
        companies: importData.tables.companies?.length || 0,
        customers: importData.tables.customers?.length || 0,
        users: importData.tables.users?.length || 0,
        loans: importData.tables.loans?.length || 0,
        receipts: importData.tables.receipts?.length || 0
      }
    });
  } catch (error) {
    console.error('Error importing data:', error);
    
    // Close database connection if it was opened
    if (db) {
      try {
        await db.close();
      } catch (closeError) {
        console.error('Error closing database:', closeError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to import data: ' + error.message
    });
  }
});

module.exports = router;
