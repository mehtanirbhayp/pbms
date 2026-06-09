const express = require('express');
const Database = require('../utils/database');
const moment = require('moment');
const router = express.Router();

// Create new loan
router.post('/', async (req, res) => {
  try {
    const {
      serialNumber,
      companyId,
      customerName,
      fatherName,
      husbandName,
      address,
      occupation,
      cellNumber,
      loanAmount,
      itemWeight,
      itemDescription,
      itemType,
      loanDate,
      interestRate = 2.0,
      timeLimitDate
    } = req.body;

    // Validate required fields
    if (!serialNumber || !companyId || !customerName || !address || !loanAmount || !itemWeight || !itemDescription || !itemType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    if (!['gold', 'silver'].includes(itemType)) {
      return res.status(400).json({
        success: false,
        error: 'Item type must be gold or silver'
      });
    }

    const db = new Database();
    
    // Check if company exists and supports this item type
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [companyId]);
    if (!company) {
      await db.close();
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    if (company.type !== 'both' && company.type !== itemType) {
      await db.close();
      return res.status(400).json({
        success: false,
        error: `Company ${company.name} does not support ${itemType} loans`
      });
    }

    // Create or find customer
    let customerId;
    const existingCustomer = await db.get(
      'SELECT id FROM customers WHERE name = ? AND cell_number = ?',
      [customerName, cellNumber]
    );

    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Update customer information
      await db.run(
        'UPDATE customers SET father_name = ?, husband_name = ?, address = ?, occupation = ? WHERE id = ?',
        [fatherName, husbandName, address, occupation, customerId]
      );
    } else {
      const customerResult = await db.run(
        'INSERT INTO customers (name, father_name, husband_name, address, occupation, cell_number) VALUES (?, ?, ?, ?, ?, ?)',
        [customerName, fatherName, husbandName, address, occupation, cellNumber]
      );
      customerId = customerResult.id;
    }

    const normalizedSerial = String(serialNumber).trim();
    if (!normalizedSerial) {
      await db.close();
      return res.status(400).json({
        success: false,
        error: 'Serial number cannot be empty'
      });
    }

    const existingSerial = await db.get(
      'SELECT id FROM loans WHERE company_id = ? AND serial_number = ?',
      [companyId, normalizedSerial]
    );

    if (existingSerial) {
      await db.close();
      return res.status(400).json({
        success: false,
        error: 'A loan with this serial number already exists for the selected company'
      });
    }

    // Create loan
    const loanDateFormatted = loanDate ? moment(loanDate).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
    const timeLimitDateFormatted = timeLimitDate ? moment(timeLimitDate).format('YYYY-MM-DD') : null;
    const loanResult = await db.run(
      `INSERT INTO loans (serial_number, company_id, customer_id, loan_amount, item_weight, 
       item_description, item_type, loan_date, interest_rate, time_limit_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [normalizedSerial, companyId, customerId, loanAmount, itemWeight, itemDescription, itemType, loanDateFormatted, interestRate, timeLimitDateFormatted]
    );

    await db.close();

    res.status(201).json({
      success: true,
      data: {
        loanId: loanResult.id,
        serialNumber: normalizedSerial,
        customerId,
        message: 'Loan created successfully'
      }
    });
  } catch (error) {
    console.error('Error creating loan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create loan'
    });
  }
});

// Get all loans with filters
router.get('/', async (req, res) => {
  try {
    const { companyId, status, itemType, search, page = 1, limit = 50 } = req.query;
    const db = new Database();
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (companyId) {
      whereClause += ' AND l.company_id = ?';
      params.push(companyId);
    }
    
    if (status) {
      whereClause += ' AND l.status = ?';
      params.push(status);
    }
    
    if (itemType) {
      whereClause += ' AND l.item_type = ?';
      params.push(itemType);
    }

    if (search && search.trim()) {
      const likeValue = `%${search.trim()}%`;
      whereClause += ' AND (l.serial_number LIKE ? OR cu.name LIKE ? OR cu.cell_number LIKE ?)';
      params.push(likeValue, likeValue, likeValue);
    }
    
    const offset = (page - 1) * limit;
    
    const loans = await db.query(`
      SELECT l.id, l.serial_number, l.company_id, l.customer_id, l.loan_amount, 
             l.item_weight, l.item_description, l.item_type, l.loan_date, 
             l.interest_rate, l.status, l.created_at,
             l.released_date, l.time_limit_date,
             c.name as company_name, c.type as company_type,
             cu.name as customer_name, cu.father_name, cu.husband_name, 
             cu.address, cu.occupation, cu.cell_number
      FROM loans l
      JOIN companies c ON l.company_id = c.id
      JOIN customers cu ON l.customer_id = cu.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    
    // Get total count
    const totalResult = await db.get(`
      SELECT COUNT(*) as total
      FROM loans l
      JOIN customers cu ON l.customer_id = cu.id
      ${whereClause}
    `, params);
    
    await db.close();
    
    res.json({
      success: true,
      data: {
        loans,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult.total,
          pages: Math.ceil(totalResult.total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch loans'
    });
  }
});

// Get loan by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = new Database();
    
    const loan = await db.get(`
      SELECT l.id, l.serial_number, l.company_id, l.customer_id, l.loan_amount, 
             l.item_weight, l.item_description, l.item_type, l.loan_date, 
             l.interest_rate, l.status, l.created_at,
             l.released_date, l.time_limit_date,
             l.notice1_date, l.notice2_date, l.notice3_date, l.notice4_date,
             l.notice1_comment, l.notice2_comment, l.notice3_comment, l.notice4_comment,
             c.name as company_name, c.type as company_type,
             cu.name as customer_name, cu.father_name, cu.husband_name, 
             cu.address, cu.occupation, cu.cell_number
      FROM loans l
      JOIN companies c ON l.company_id = c.id
      JOIN customers cu ON l.customer_id = cu.id
      WHERE l.id = ?
    `, [id]);
    
    await db.close();
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    res.json({
      success: true,
      data: loan
    });
  } catch (error) {
    console.error('Error fetching loan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch loan'
    });
  }
});

// Update loan details
router.put('/:id', async (req, res) => {
  console.log('PUT /api/loans/:id route hit', req.params.id);
  try {
    const { id } = req.params;
    const {
      serialNumber,
      companyId,
      customerName,
      fatherName,
      husbandName,
      address,
      post,
      pinCode,
      occupation,
      cellNumber,
      loanAmount,
      itemWeight,
      itemDescription,
      itemType,
      loanDate,
      aadharNumber,
      timeLimitDate
    } = req.body;

    // Validate required fields
    if (!serialNumber || !companyId || !customerName || !address || !loanAmount || !itemWeight || !itemDescription || !itemType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    if (!['gold', 'silver'].includes(itemType)) {
      return res.status(400).json({
        success: false,
        error: 'Item type must be gold or silver'
      });
    }

    const db = new Database();
    
    // Check if loan exists
    const existingLoan = await db.get('SELECT * FROM loans WHERE id = ?', [id]);
    if (!existingLoan) {
      await db.close();
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    // Check if company exists and supports this item type
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [companyId]);
    if (!company) {
      await db.close();
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    if (company.type !== 'both' && company.type !== itemType) {
      await db.close();
      return res.status(400).json({
        success: false,
        error: `Company ${company.name} does not support ${itemType} loans`
      });
    }

    // Check if serial number is already used by another loan
    const normalizedSerial = String(serialNumber).trim();
    if (!normalizedSerial) {
      await db.close();
      return res.status(400).json({
        success: false,
        error: 'Serial number cannot be empty'
      });
    }

    const existingSerial = await db.get(
      'SELECT id FROM loans WHERE company_id = ? AND serial_number = ? AND id != ?',
      [companyId, normalizedSerial, id]
    );

    if (existingSerial) {
      await db.close();
      return res.status(400).json({
        success: false,
        error: 'A loan with this serial number already exists for the selected company'
      });
    }

    // Update or create customer
    let customerId = existingLoan.customer_id;
    const existingCustomer = await db.get(
      'SELECT id FROM customers WHERE name = ? AND cell_number = ?',
      [customerName, cellNumber]
    );

    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Update customer information (only fields that exist in the table)
      await db.run(
        'UPDATE customers SET father_name = ?, husband_name = ?, address = ?, occupation = ? WHERE id = ?',
        [fatherName, husbandName, address, occupation, customerId]
      );
    } else {
      // Create new customer (only fields that exist in the table)
      const customerResult = await db.run(
        'INSERT INTO customers (name, father_name, husband_name, address, occupation, cell_number) VALUES (?, ?, ?, ?, ?, ?)',
        [customerName, fatherName, husbandName, address, occupation, cellNumber]
      );
      customerId = customerResult.id;
    }

    // Update loan
    const loanDateFormatted = loanDate ? moment(loanDate).format('YYYY-MM-DD') : existingLoan.loan_date;
    const timeLimitDateFormatted = timeLimitDate ? moment(timeLimitDate).format('YYYY-MM-DD') : (timeLimitDate === '' ? null : existingLoan.time_limit_date);
    await db.run(
      `UPDATE loans SET 
       serial_number = ?, 
       company_id = ?, 
       customer_id = ?, 
       loan_amount = ?, 
       item_weight = ?, 
       item_description = ?, 
       item_type = ?, 
       loan_date = ?,
       time_limit_date = ?
       WHERE id = ?`,
      [normalizedSerial, companyId, customerId, loanAmount, itemWeight, itemDescription, itemType, loanDateFormatted, timeLimitDateFormatted, id]
    );

    // Fetch the updated loan to return it
    const updatedLoan = await db.get(`
      SELECT l.id, l.serial_number, l.company_id, l.customer_id, l.loan_amount, 
             l.item_weight, l.item_description, l.item_type, l.loan_date, 
             l.interest_rate, l.status, l.created_at,
             l.released_date, l.time_limit_date,
             c.name as company_name, c.type as company_type,
             cu.name as customer_name, cu.father_name, cu.husband_name, 
             cu.address, cu.occupation, cu.cell_number
      FROM loans l
      JOIN companies c ON l.company_id = c.id
      JOIN customers cu ON l.customer_id = cu.id
      WHERE l.id = ?
    `, [id]);
    
    await db.close();
    
    res.json({
      success: true,
      message: 'Loan updated successfully',
      data: updatedLoan
    });
  } catch (error) {
    console.error('Error updating loan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update loan'
    });
  }
});

// Update loan status (release item)
router.patch('/:id/deliver', async (req, res) => {
  try {
    const { id } = req.params;
    const { releasedDate } = req.body;
    
    const db = new Database();
    
    // Check if loan exists and is active
    const loan = await db.get('SELECT * FROM loans WHERE id = ? AND status = "active"', [id]);
    if (!loan) {
      await db.close();
      return res.status(404).json({
        success: false,
        error: 'Active loan not found'
      });
    }
    
    const releasedDateFormatted = releasedDate ? moment(releasedDate).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
    
    // Update loan status to released and set released_date
    await db.run(
      'UPDATE loans SET status = "released", released_date = ? WHERE id = ?',
      [releasedDateFormatted, id]
    );
    
    // Fetch the updated loan to return it
    const updatedLoan = await db.get(`
      SELECT l.id, l.serial_number, l.company_id, l.customer_id, l.loan_amount, 
             l.item_weight, l.item_description, l.item_type, l.loan_date, 
             l.interest_rate, l.status, l.created_at,
             l.released_date, l.time_limit_date,
             c.name as company_name, c.type as company_type,
             cu.name as customer_name, cu.father_name, cu.husband_name, 
             cu.address, cu.occupation, cu.cell_number
      FROM loans l
      JOIN companies c ON l.company_id = c.id
      JOIN customers cu ON l.customer_id = cu.id
      WHERE l.id = ?
    `, [id]);
    
    await db.close();
    
    res.json({
      success: true,
      message: 'Loan marked as released successfully',
      data: updatedLoan
    });
  } catch (error) {
    console.error('Error releasing loan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to release loan'
    });
  }
});

// Update release date for a released loan
router.patch('/:id/release-date', async (req, res) => {
  try {
    const { id } = req.params;
    const { releasedDate } = req.body;
    
    if (!releasedDate) {
      return res.status(400).json({
        success: false,
        error: 'Release date is required'
      });
    }
    
    const db = new Database();
    
    // Check if loan exists and is released
    const loan = await db.get('SELECT * FROM loans WHERE id = ? AND status = "released"', [id]);
    if (!loan) {
      await db.close();
      return res.status(404).json({
        success: false,
        error: 'Released loan not found'
      });
    }
    
    const releasedDateFormatted = moment(releasedDate).format('YYYY-MM-DD');
    
    // Update release date
    await db.run(
      'UPDATE loans SET released_date = ? WHERE id = ?',
      [releasedDateFormatted, id]
    );
    
    // Fetch the updated loan to return it
    const updatedLoan = await db.get(`
      SELECT l.id, l.serial_number, l.company_id, l.customer_id, l.loan_amount, 
             l.item_weight, l.item_description, l.item_type, l.loan_date, 
             l.interest_rate, l.status, l.created_at,
             l.released_date, l.time_limit_date,
             c.name as company_name, c.type as company_type,
             cu.name as customer_name, cu.father_name, cu.husband_name, 
             cu.address, cu.occupation, cu.cell_number
      FROM loans l
      JOIN companies c ON l.company_id = c.id
      JOIN customers cu ON l.customer_id = cu.id
      WHERE l.id = ?
    `, [id]);
    
    await db.close();
    
    res.json({
      success: true,
      message: 'Release date updated successfully',
      data: updatedLoan
    });
  } catch (error) {
    console.error('Error updating release date:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update release date'
    });
  }
});

// Update loan status (mark as unredeemed)
router.patch('/:id/default', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = new Database();
    
    // Check if loan exists and is active
    const loan = await db.get('SELECT * FROM loans WHERE id = ? AND status = "active"', [id]);
    if (!loan) {
      await db.close();
      return res.status(404).json({
        success: false,
        error: 'Active loan not found'
      });
    }
    
    await db.run(
      'UPDATE loans SET status = "unredeemed" WHERE id = ?',
      [id]
    );
    
    // Fetch the updated loan to return it
    const updatedLoan = await db.get(`
      SELECT l.id, l.serial_number, l.company_id, l.customer_id, l.loan_amount, 
             l.item_weight, l.item_description, l.item_type, l.loan_date, 
             l.interest_rate, l.status, l.created_at,
             l.released_date, l.time_limit_date,
             c.name as company_name, c.type as company_type,
             cu.name as customer_name, cu.father_name, cu.husband_name, 
             cu.address, cu.occupation, cu.cell_number
      FROM loans l
      JOIN companies c ON l.company_id = c.id
      JOIN customers cu ON l.customer_id = cu.id
      WHERE l.id = ?
    `, [id]);
    
    await db.close();
    
    res.json({
      success: true,
      message: 'Loan marked as unredeemed successfully',
      data: updatedLoan
    });
  } catch (error) {
    console.error('Error marking loan as unredeemed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark loan as unredeemed'
    });
  }
});

// Undo loan status change (revert to active)
router.patch('/:id/undo', async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = new Database();
    
    // Check if loan exists and is not active (can only undo released or unredeemed loans)
    const loan = await db.get('SELECT * FROM loans WHERE id = ?', [id]);
    if (!loan) {
      await db.close();
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    const currentStatus = (loan.status || '').toLowerCase();
    
    if (currentStatus === 'active') {
      await db.close();
      return res.status(400).json({
        success: false,
        error: 'Loan is already active. Nothing to undo.'
      });
    }
    
    // Revert status to active and clear released_date if it was a released loan
    // For unredeemed loans, we just need to change status, no date field to clear
    const isReleased = currentStatus === 'released' || currentStatus === 'delivered';
    const isUnredeemed = currentStatus === 'unredeemed' || currentStatus === 'defaulted';
    
    if (isReleased) {
      // Clear released_date for released loans
      await db.run(
        'UPDATE loans SET status = "active", released_date = NULL WHERE id = ?',
        [id]
      );
    } else if (isUnredeemed) {
      // For unredeemed loans, just update status (no date field to clear)
      await db.run(
        'UPDATE loans SET status = "active" WHERE id = ?',
        [id]
      );
    } else {
      // For any other status, just update to active
      await db.run(
        'UPDATE loans SET status = "active" WHERE id = ?',
        [id]
      );
    }
    
    // Fetch the updated loan to return it
    const updatedLoan = await db.get(`
      SELECT l.id, l.serial_number, l.company_id, l.customer_id, l.loan_amount, 
             l.item_weight, l.item_description, l.item_type, l.loan_date, 
             l.interest_rate, l.status, l.created_at,
             l.released_date, l.time_limit_date,
             c.name as company_name, c.type as company_type,
             cu.name as customer_name, cu.father_name, cu.husband_name, 
             cu.address, cu.occupation, cu.cell_number
      FROM loans l
      JOIN companies c ON l.company_id = c.id
      JOIN customers cu ON l.customer_id = cu.id
      WHERE l.id = ?
    `, [id]);
    
    await db.close();
    
    res.json({
      success: true,
      message: 'Loan status reverted to active successfully',
      data: updatedLoan
    });
  } catch (error) {
    console.error('Error undoing loan status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to undo loan status'
    });
  }
});

// Delete loan permanently
router.delete('/:id', async (req, res) => {
  let db;
  let transactionStarted = false;

  try {
    const { id } = req.params;
    db = new Database();

    const loan = await db.get(
      'SELECT id FROM loans WHERE id = ?',
      [id]
    );

    if (!loan) {
      await db.close();
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }

    await db.run('BEGIN TRANSACTION');
    transactionStarted = true;

    await db.run('DELETE FROM receipts WHERE loan_id = ?', [id]);
    const deleteResult = await db.run('DELETE FROM loans WHERE id = ?', [id]);

    if (deleteResult.changes === 0) {
      await db.run('ROLLBACK');
      transactionStarted = false;
      await db.close();

      return res.status(404).json({
        success: false,
        error: 'Loan not found or already deleted'
      });
    }

    await db.run('COMMIT');
    transactionStarted = false;
    await db.close();

    res.json({
      success: true,
      message: 'Loan deleted permanently',
      deletedLoanId: Number(id)
    });
  } catch (error) {
    console.error('Error deleting loan:', error);

    if (db) {
      if (transactionStarted) {
        try {
          await db.run('ROLLBACK');
        } catch (rollbackError) {
          console.error('Failed to rollback transaction:', rollbackError);
        }
      }

      try {
        await db.close();
      } catch (closeError) {
        console.error('Failed to close database after delete error:', closeError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete loan'
    });
  }
});

module.exports = router;

