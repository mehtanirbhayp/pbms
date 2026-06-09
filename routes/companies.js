const express = require('express');
const Database = require('../utils/database');
const router = express.Router();

// Get all companies
router.get('/', async (req, res) => {
  try {
    const db = new Database();
    const companies = await db.query('SELECT * FROM companies ORDER BY name');
    await db.close();
    
    res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch companies'
    });
  }
});

// Get company by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = new Database();
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [id]);
    await db.close();
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }
    
    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company'
    });
  }
});

// Get company statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const db = new Database();
    
    // Get total loans count
    const totalLoans = await db.get(
      'SELECT COUNT(*) as count FROM loans WHERE company_id = ?',
      [id]
    );
    
    // Get active loans count
    const activeLoans = await db.get(
      'SELECT COUNT(*) as count FROM loans WHERE company_id = ? AND status = "active"',
      [id]
    );
    
    // Get total loan amount
    const totalAmount = await db.get(
      'SELECT SUM(loan_amount) as total FROM loans WHERE company_id = ? AND status = "active"',
      [id]
    );
    
    // Get total weight
    const totalWeight = await db.get(
      'SELECT SUM(item_weight) as total FROM loans WHERE company_id = ? AND status = "active"',
      [id]
    );
    
    // Get gold weight
    const goldWeight = await db.get(
      'SELECT SUM(item_weight) as total FROM loans WHERE company_id = ? AND status = "active" AND item_type = "gold"',
      [id]
    );
    
    // Get silver weight
    const silverWeight = await db.get(
      'SELECT SUM(item_weight) as total FROM loans WHERE company_id = ? AND status = "active" AND item_type = "silver"',
      [id]
    );
    
    await db.close();
    
    res.json({
      success: true,
      data: {
        totalLoans: totalLoans.count,
        activeLoans: activeLoans.count,
        totalAmount: totalAmount.total || 0,
        totalWeight: totalWeight.total || 0,
        goldWeight: goldWeight.total || 0,
        silverWeight: silverWeight.total || 0
      }
    });
  } catch (error) {
    console.error('Error fetching company stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company statistics'
    });
  }
});

// Create new company (admin function)
router.post('/', async (req, res) => {
  try {
    const { name, type } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: 'Company name and type are required'
      });
    }
    
    if (!['gold', 'silver', 'both'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be gold, silver, or both'
      });
    }
    
    const db = new Database();
    const result = await db.run(
      'INSERT INTO companies (name, type) VALUES (?, ?)',
      [name, type]
    );
    await db.close();
    
    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        name,
        type
      }
    });
  } catch (error) {
    console.error('Error creating company:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({
        success: false,
        error: 'Company name already exists'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create company'
      });
    }
  }
});

module.exports = router;

