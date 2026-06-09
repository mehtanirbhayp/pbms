const express = require('express');
const Database = require('../utils/database');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const router = express.Router();

// Generate receipt number
function generateReceiptNumber(companyId, loanId) {
  const timestamp = Date.now().toString().slice(-6);
  const companyCode = companyId.toString().padStart(2, '0');
  const loanCode = loanId.toString().padStart(4, '0');
  return `RCP${companyCode}${loanCode}${timestamp}`;
}

// Generate PDF receipt
router.get('/:loanId/pdf', async (req, res) => {
  try {
    const { loanId } = req.params;
    const db = new Database();
    
    // Get loan details with customer and company info
    const loan = await db.get(`
      SELECT l.id, l.serial_number, l.company_id, l.customer_id, l.loan_amount, 
             l.item_weight, l.item_description, l.item_type, l.loan_date, 
             l.interest_rate, l.status, l.created_at,
             l.released_date,
             c.name as company_name, c.type as company_type,
             cu.name as customer_name, cu.father_name, cu.husband_name, 
             cu.address, cu.occupation, cu.cell_number
      FROM loans l
      JOIN companies c ON l.company_id = c.id
      JOIN customers cu ON l.customer_id = cu.id
      WHERE l.id = ?
    `, [loanId]);
    
    if (!loan) {
      await db.close();
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    // Check if receipt already exists
    let receipt = await db.get('SELECT * FROM receipts WHERE loan_id = ?', [loanId]);
    
    if (!receipt) {
      // Create new receipt
      const receiptNumber = generateReceiptNumber(loan.company_id, loanId);
      const receiptResult = await db.run(
        'INSERT INTO receipts (loan_id, receipt_number) VALUES (?, ?)',
        [loanId, receiptNumber]
      );
      receipt = {
        id: receiptResult.id,
        receipt_number: receiptNumber,
        loan_id: loanId
      };
    }
    
    await db.close();
    
    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${receipt.receipt_number}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Header
    doc.fontSize(20).font('Helvetica-Bold')
       .text(loan.company_name, { align: 'center' });
    
    doc.fontSize(12).font('Helvetica')
       .text('PAWN BROKER RECEIPT', { align: 'center' })
       .moveDown();
    
    // Receipt details
    doc.fontSize(10)
       .text(`Receipt No: ${receipt.receipt_number}`, 50, 120)
       .text(`Serial No: ${loan.serial_number}`, 300, 120)
       .text(`Date: ${moment(loan.loan_date).format('DD/MM/YYYY')}`, 50, 140)
       .text(`Generated: ${moment().format('DD/MM/YYYY HH:mm')}`, 300, 140)
       .moveDown();
    
    // Customer details
    doc.fontSize(12).font('Helvetica-Bold')
       .text('CUSTOMER DETAILS', 50, 180)
       .moveDown();
    
    doc.fontSize(10).font('Helvetica')
       .text(`Name: ${loan.customer_name}`, 50, 200)
       .text(`Father/Husband: ${loan.father_name || loan.husband_name || 'N/A'}`, 50, 220)
       .text(`Address: ${loan.address}`, 50, 240)
       .text(`Occupation: ${loan.occupation || 'N/A'}`, 50, 260)
       .text(`Cell No: ${loan.cell_number || 'N/A'}`, 50, 280)
       .moveDown();
    
    // Loan details
    doc.fontSize(12).font('Helvetica-Bold')
       .text('LOAN DETAILS', 50, 320)
       .moveDown();
    
    doc.fontSize(10).font('Helvetica')
       .text(`Loan Amount: ₹${parseFloat(loan.loan_amount).toFixed(2)}`, 50, 340)
       .text(`Item Type: ${loan.item_type.toUpperCase()}`, 50, 360)
       .text(`Weight: ${parseFloat(loan.item_weight).toFixed(3)} grams`, 50, 380)
       .text(`Interest Rate: ${parseFloat(loan.interest_rate).toFixed(2)}% per month`, 50, 400)
       .text(`Description: ${loan.item_description}`, 50, 420)
       .moveDown();
    
    // Terms and conditions
    doc.fontSize(10).font('Helvetica-Bold')
       .text('TERMS AND CONDITIONS:', 50, 460)
       .moveDown();
    
    doc.fontSize(9).font('Helvetica')
       .text('1. This receipt must be presented for redemption of the pledged item.', 50, 480)
       .text('2. Interest will be charged monthly on the loan amount.', 50, 495)
       .text('3. The pledged item will be sold if not redeemed within the agreed period.', 50, 510)
       .text('4. Please keep this receipt safe as it is required for item redemption.', 50, 525)
       .moveDown();
    
    // Signature line
    doc.text('Customer Signature: _________________', 50, 570)
       .text('Authorized Signature: _________________', 300, 570);
    
    // Footer
    doc.fontSize(8).font('Helvetica')
       .text('This is a computer generated receipt.', { align: 'center' }, 0, 750);
    
    doc.end();
    
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate receipt'
    });
  }
});

// Get receipt details (JSON)
router.get('/:loanId', async (req, res) => {
  try {
    const { loanId } = req.params;
    const db = new Database();
    
    // Get loan details with customer and company info
    const loan = await db.get(`
      SELECT l.id, l.serial_number, l.company_id, l.customer_id, l.loan_amount, 
             l.item_weight, l.item_description, l.item_type, l.loan_date, 
             l.interest_rate, l.status, l.created_at,
             l.released_date,
             c.name as company_name, c.type as company_type,
             cu.name as customer_name, cu.father_name, cu.husband_name, 
             cu.address, cu.occupation, cu.cell_number
      FROM loans l
      JOIN companies c ON l.company_id = c.id
      JOIN customers cu ON l.customer_id = cu.id
      WHERE l.id = ?
    `, [loanId]);
    
    if (!loan) {
      await db.close();
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    // Check if receipt exists
    let receipt = await db.get('SELECT * FROM receipts WHERE loan_id = ?', [loanId]);
    
    if (!receipt) {
      // Create new receipt
      const receiptNumber = generateReceiptNumber(loan.company_id, loanId);
      const receiptResult = await db.run(
        'INSERT INTO receipts (loan_id, receipt_number) VALUES (?, ?)',
        [loanId, receiptNumber]
      );
      receipt = {
        id: receiptResult.id,
        receipt_number: receiptNumber,
        loan_id: loanId,
        generated_at: new Date().toISOString()
      };
    }
    
    await db.close();
    
    res.json({
      success: true,
      data: {
        receipt,
        loan,
        customer: {
          name: loan.customer_name,
          father_name: loan.father_name,
          husband_name: loan.husband_name,
          address: loan.address,
          occupation: loan.occupation,
          cell_number: loan.cell_number
        },
        company: {
          name: loan.company_name,
          type: loan.company_type
        }
      }
    });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch receipt'
    });
  }
});

// Get all receipts for a company
router.get('/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const db = new Database();
    
    const offset = (page - 1) * limit;
    
    const receipts = await db.query(`
      SELECT r.*, l.serial_number, l.loan_amount, l.item_weight, l.item_type, l.loan_date, l.status,
             c.name as company_name, cu.name as customer_name, cu.cell_number
      FROM receipts r
      JOIN loans l ON r.loan_id = l.id
      JOIN companies c ON l.company_id = c.id
      JOIN customers cu ON l.customer_id = cu.id
      WHERE l.company_id = ?
      ORDER BY r.generated_at DESC
      LIMIT ? OFFSET ?
    `, [companyId, parseInt(limit), offset]);
    
    // Get total count
    const totalResult = await db.get(`
      SELECT COUNT(*) as total FROM receipts r
      JOIN loans l ON r.loan_id = l.id
      WHERE l.company_id = ?
    `, [companyId]);
    
    await db.close();
    
    res.json({
      success: true,
      data: {
        receipts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult.total,
          pages: Math.ceil(totalResult.total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch receipts'
    });
  }
});

module.exports = router;

