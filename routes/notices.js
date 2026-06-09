const express = require('express');
const Database = require('../utils/database');
const ExcelJS = require('exceljs');
const moment = require('moment');
const multer = require('multer');
const router = express.Router();

// Configure multer for file uploads (in memory)
const upload = multer({ storage: multer.memoryStorage() });

// Export loans for notice management
router.get('/export', async (req, res) => {
  try {
    const { companyId, status, startDate, endDate } = req.query;
    console.log('Notice export request with filters:', { companyId, status, startDate, endDate }); // Debug
    const db = new Database();
    
    // Build WHERE clause with filters
    let whereClause = '1=1'; // Start with always true condition
    const params = [];
    
    // Company filter
    if (companyId && companyId.trim() !== '') {
      whereClause += ' AND l.company_id = ?';
      params.push(companyId.trim());
    }
    
    // Status filter (only apply if status is specified and not empty)
    if (status && status.trim() !== '') {
      whereClause += ' AND l.status = ?';
      params.push(status.trim());
      console.log('Applying status filter:', status.trim()); // Debug
    } else {
      console.log('No status filter applied - showing all statuses'); // Debug
    }
    
    // Date range filters
    if (startDate && endDate) {
      whereClause += ' AND l.loan_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      whereClause += ' AND l.loan_date >= ?';
      params.push(startDate);
    } else if (endDate) {
      whereClause += ' AND l.loan_date <= ?';
      params.push(endDate);
    }
    
    // Get filtered loans with customer details
    const loans = await db.query(`
      SELECT l.id, l.serial_number, l.loan_date, l.loan_amount,
             l.notice1_date, l.notice2_date, l.notice3_date, l.notice4_date,
             l.notice1_comment, l.notice2_comment, l.notice3_comment, l.notice4_comment,
             cu.name as customer_name, 
             cu.father_name, cu.husband_name, cu.address
      FROM loans l
      JOIN customers cu ON l.customer_id = cu.id
      WHERE ${whereClause}
      ORDER BY l.loan_date DESC, l.serial_number
    `, params);
    
    await db.close();
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Notice Management');
    
    // Set column headers - all notice checkboxes first, then all comments
    worksheet.columns = [
      { header: 'Serial Number', key: 'serialNumber', width: 20 },
      { header: 'Loan Date', key: 'loanDate', width: 15 },
      { header: 'Loan Amount', key: 'loanAmount', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Father/Husband Name', key: 'fatherHusband', width: 25 },
      { header: 'Address', key: 'address', width: 40 },
      { header: 'Notice1', key: 'notice1', width: 12 },
      { header: 'Notice2', key: 'notice2', width: 12 },
      { header: 'Notice3', key: 'notice3', width: 12 },
      { header: 'Notice4', key: 'notice4', width: 12 },
      { header: 'Notice1 Comment', key: 'notice1Comment', width: 30 },
      { header: 'Notice2 Comment', key: 'notice2Comment', width: 30 },
      { header: 'Notice3 Comment', key: 'notice3Comment', width: 30 },
      { header: 'Notice4 Comment', key: 'notice4Comment', width: 30 }
    ];
    
    // Style header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Add data rows
    loans.forEach(loan => {
      const row = worksheet.addRow({
        serialNumber: loan.serial_number,
        loanDate: moment(loan.loan_date).format('DD/MM/YYYY'),
        loanAmount: parseFloat(loan.loan_amount).toFixed(2),
        name: loan.customer_name,
        fatherHusband: loan.father_name || loan.husband_name || '',
        address: loan.address || '',
        notice1: loan.notice1_date ? '✓' : '',
        notice2: loan.notice2_date ? '✓' : '',
        notice3: loan.notice3_date ? '✓' : '',
        notice4: loan.notice4_date ? '✓' : '',
        notice1Comment: loan.notice1_comment || '',
        notice2Comment: loan.notice2_comment || '',
        notice3Comment: loan.notice3_comment || '',
        notice4Comment: loan.notice4_comment || ''
      });
      
      // Add notice columns with simple data validation (columns G, H, I, J - notice checkboxes)
      [7, 8, 9, 10].forEach((colNum, index) => {
        const cell = row.getCell(colNum);
        const noticeNum = index + 1;
        const hasNotice = loan[`notice${noticeNum}_date`];
        
        // Set cell value - show existing notice or empty for user to mark
        if (hasNotice) {
          cell.value = '✓';
          cell.font = { color: { argb: 'FF008000' }, bold: true }; // Green checkmark
        } else {
          cell.value = '';
        }
        
        // Add simple data validation dropdown using comma-separated list
        // This is the most compatible format for Excel
        try {
          cell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"✓,X"'], // Simple comma-separated list in quotes
            showDropDown: true,
            showErrorMessage: false,
            showInputMessage: false // Disable input message to avoid issues
          };
        } catch (e) {
          // If data validation fails, just format the cell
          console.warn('Could not set data validation:', e);
        }
        
        // Center align notice columns and add border to make them look like checkboxes
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        
        // Add background color to make it look more like a checkbox
        if (!hasNotice) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' } // White background
          };
        }
      });
    });
    
    // Format amount column
    worksheet.getColumn('loanAmount').numFmt = '#,##0.00';
    
    // Set response headers
    const fileName = `Loans_Notice_Management_${moment().format('YYYY-MM-DD')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error exporting loans for notices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export loans'
    });
  }
});

// Import notices from Excel file
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    
    const worksheet = workbook.getWorksheet(1); // Get first worksheet
    if (!worksheet) {
      return res.status(400).json({
        success: false,
        error: 'Excel file is empty or invalid'
      });
    }
    
    const db = new Database();
    let updatedCount = 0;
    const today = moment().format('YYYY-MM-DD');
    
    // Skip header row (row 1) and process data rows
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      
      // Get serial number (column A)
      const serialNumber = row.getCell(1).value;
      if (!serialNumber || !serialNumber.toString().trim()) {
        continue; // Skip empty rows
      }
      
      // Get notice checkboxes and comments
      // Columns: 7=Notice1, 8=Notice2, 9=Notice3, 10=Notice4, 11=Notice1 Comment, 12=Notice2 Comment, 13=Notice3 Comment, 14=Notice4 Comment
      const notice1 = row.getCell(7).value;
      const notice2 = row.getCell(8).value;
      const notice3 = row.getCell(9).value;
      const notice4 = row.getCell(10).value;
      const notice1Comment = row.getCell(11).value || '';
      const notice2Comment = row.getCell(12).value || '';
      const notice3Comment = row.getCell(13).value || '';
      const notice4Comment = row.getCell(14).value || '';
      
      // Find loan by serial number
      const loan = await db.get(
        'SELECT id FROM loans WHERE serial_number = ? AND status = ?',
        [serialNumber.toString().trim(), 'active']
      );
      
      if (!loan) {
        console.warn(`Loan not found for serial number: ${serialNumber}`);
        continue;
      }
      
      // Build update query for notices
      const updates = [];
      const params = [];
      
      // Helper function to check if notice is marked
      const isMarked = (value) => {
        if (!value) return false;
        const str = value.toString().trim().toLowerCase();
        // Accept ✓, X, Yes, Y, or any non-empty value (except 'no', 'n')
        return str === '✓' || str === 'x' || str === 'yes' || str === 'y' || 
               value === true || (str.length > 0 && str !== 'no' && str !== 'n');
      };
      
      // Process each notice: if marked, set date and comment; if not marked, clear date and comment
      if (isMarked(notice1)) {
        updates.push('notice1_date = ?');
        params.push(today);
        updates.push('notice1_comment = ?');
        params.push(notice1Comment.toString().trim());
      } else {
        // Clear notice if not marked
        updates.push('notice1_date = NULL');
        updates.push('notice1_comment = NULL');
      }
      
      if (isMarked(notice2)) {
        updates.push('notice2_date = ?');
        params.push(today);
        updates.push('notice2_comment = ?');
        params.push(notice2Comment.toString().trim());
      } else {
        updates.push('notice2_date = NULL');
        updates.push('notice2_comment = NULL');
      }
      
      if (isMarked(notice3)) {
        updates.push('notice3_date = ?');
        params.push(today);
        updates.push('notice3_comment = ?');
        params.push(notice3Comment.toString().trim());
      } else {
        updates.push('notice3_date = NULL');
        updates.push('notice3_comment = NULL');
      }
      
      if (isMarked(notice4)) {
        updates.push('notice4_date = ?');
        params.push(today);
        updates.push('notice4_comment = ?');
        params.push(notice4Comment.toString().trim());
      } else {
        updates.push('notice4_date = NULL');
        updates.push('notice4_comment = NULL');
      }
      
      if (updates.length > 0) {
        params.push(loan.id);
        await db.run(
          `UPDATE loans SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
        updatedCount++;
      }
    }
    
    await db.close();
    
    res.json({
      success: true,
      updated: updatedCount,
      message: `Successfully updated ${updatedCount} loan(s)`
    });
    
  } catch (error) {
    console.error('Error importing notices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import notices: ' + error.message
    });
  }
});

module.exports = router;

