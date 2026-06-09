const express = require('express');
const Database = require('../utils/database');
const ExcelJS = require('exceljs');
const moment = require('moment');
const router = express.Router();

// Get master sheet data for a company
router.get('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { startDate, endDate, status } = req.query;
    const db = new Database();
    
    // Build date filter
    let dateFilter = '';
    const params = [companyId];
    
    if (startDate && endDate) {
      dateFilter = 'AND l.loan_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      dateFilter = 'AND l.loan_date >= ?';
      params.push(startDate);
    } else if (endDate) {
      dateFilter = 'AND l.loan_date <= ?';
      params.push(endDate);
    }
    
    // Add status filter
    if (status) {
      dateFilter += ' AND l.status = ?';
      params.push(status);
    }
    
    // Get all loans for the company
    const loans = await db.query(`
      SELECT l.id, l.serial_number, l.company_id, l.customer_id, l.loan_amount, 
             l.item_weight, l.item_description, l.item_type, l.loan_date, 
             l.interest_rate, l.status, l.created_at,
             l.released_date,
             c.name as company_name,
             cu.name as customer_name, cu.father_name, cu.husband_name, 
             cu.address, cu.occupation, cu.cell_number
      FROM loans l
      JOIN companies c ON l.company_id = c.id
      JOIN customers cu ON l.customer_id = cu.id
      WHERE l.company_id = ? ${dateFilter}
      ORDER BY l.loan_date DESC, l.created_at DESC
    `, params);
    
    // Calculate day-wise statistics
    const dayWiseStats = {};
    let totalAmount = 0;
    let totalWeight = 0;
    let activeLoans = 0;
    let releasedLoans = 0;
    let unredeemedLoans = 0;
    
    loans.forEach(loan => {
      const date = loan.loan_date;
      
      if (!dayWiseStats[date]) {
        dayWiseStats[date] = {
          date,
          loans: 0,
          amount: 0,
          weight: 0,
          active: 0,
          released: 0,
          unredeemed: 0
        };
      }
      
      dayWiseStats[date].loans++;
      dayWiseStats[date].amount += parseFloat(loan.loan_amount);
      dayWiseStats[date].weight += parseFloat(loan.item_weight);
      
      if (loan.status === 'active') {
        dayWiseStats[date].active++;
        activeLoans++;
      } else if (loan.status === 'released') {
        dayWiseStats[date].released++;
        releasedLoans++;
      } else if (loan.status === 'unredeemed') {
        dayWiseStats[date].unredeemed++;
        unredeemedLoans++;
      }
      
      totalAmount += parseFloat(loan.loan_amount);
      totalWeight += parseFloat(loan.item_weight);
    });
    
    // Convert to array and sort by date
    const dayWiseArray = Object.values(dayWiseStats).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );
    
    // Get company info
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [companyId]);
    
    await db.close();
    
    res.json({
      success: true,
      data: {
        company,
        loans,
        dayWiseStats: dayWiseArray,
        summary: {
          totalLoans: loans.length,
          totalAmount,
          totalWeight,
          activeLoans,
          releasedLoans,
          unredeemedLoans
        }
      }
    });
  } catch (error) {
    console.error('Error fetching master sheet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch master sheet data'
    });
  }
});

// Export master sheet to Excel
router.get('/:companyId/export', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { startDate, endDate, status } = req.query;
    const db = new Database();
    
    // Build date filter (same as above)
    let dateFilter = '';
    const params = [companyId];
    
    if (startDate && endDate) {
      dateFilter = 'AND l.loan_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      dateFilter = 'AND l.loan_date >= ?';
      params.push(startDate);
    } else if (endDate) {
      dateFilter = 'AND l.loan_date <= ?';
      params.push(endDate);
    }
    
    if (status) {
      dateFilter += ' AND l.status = ?';
      params.push(status);
    }
    
    // Get loans data
    const loans = await db.query(`
      SELECT l.id, l.serial_number, l.company_id, l.customer_id, l.loan_amount, 
             l.item_weight, l.item_description, l.item_type, l.loan_date, 
             l.interest_rate, l.status, l.created_at,
             l.released_date,
             c.name as company_name,
             cu.name as customer_name, cu.father_name, cu.husband_name, 
             cu.address, cu.occupation, cu.cell_number
      FROM loans l
      JOIN companies c ON l.company_id = c.id
      JOIN customers cu ON l.customer_id = cu.id
      WHERE l.company_id = ? ${dateFilter}
      ORDER BY l.loan_date DESC, l.created_at DESC
    `, params);
    
    // Get company info
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [companyId]);
    
    await db.close();
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Master Sheet');
    
    // Set up headers
    worksheet.columns = [
      { header: 'Serial No', key: 'serial_number', width: 15 },
      { header: 'Date', key: 'loan_date', width: 12 },
      { header: 'Customer Name', key: 'customer_name', width: 25 },
      { header: 'Father/Husband', key: 'father_husband', width: 20 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Occupation', key: 'occupation', width: 15 },
      { header: 'Cell No', key: 'cell_number', width: 15 },
      { header: 'Loan Amount', key: 'loan_amount', width: 15 },
      { header: 'Item Type', key: 'item_type', width: 10 },
      { header: 'Weight (gms)', key: 'item_weight', width: 12 },
      { header: 'Description', key: 'item_description', width: 30 },
      { header: 'Interest Rate', key: 'interest_rate', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Released Date', key: 'released_date', width: 15 }
    ];
    
    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Add data rows
    loans.forEach(loan => {
      worksheet.addRow({
        serial_number: loan.serial_number,
        loan_date: moment(loan.loan_date).format('DD/MM/YYYY'),
        customer_name: loan.customer_name,
        father_husband: loan.father_name || loan.husband_name || '',
        address: loan.address,
        occupation: loan.occupation || '',
        cell_number: loan.cell_number || '',
        loan_amount: parseFloat(loan.loan_amount).toFixed(2),
        item_type: loan.item_type.toUpperCase(),
        item_weight: parseFloat(loan.item_weight).toFixed(3),
        item_description: loan.item_description,
        interest_rate: parseFloat(loan.interest_rate).toFixed(2) + '%',
        status: loan.status.toUpperCase(),
        released_date: loan.released_date ? moment(loan.released_date).format('DD/MM/YYYY') : ''
      });
    });
    
    // Add summary section
    const summaryRow = loans.length + 3;
    worksheet.getCell(`A${summaryRow}`).value = 'SUMMARY';
    worksheet.getCell(`A${summaryRow}`).font = { bold: true, size: 14 };
    
    const totalAmount = loans.reduce((sum, loan) => sum + parseFloat(loan.loan_amount), 0);
    const totalWeight = loans.reduce((sum, loan) => sum + parseFloat(loan.item_weight), 0);
    const activeLoans = loans.filter(loan => loan.status === 'active').length;
    const releasedLoans = loans.filter(loan => loan.status === 'released').length;
    const unredeemedLoans = loans.filter(loan => loan.status === 'unredeemed').length;
    
    worksheet.getCell(`A${summaryRow + 1}`).value = 'Total Loans:';
    worksheet.getCell(`B${summaryRow + 1}`).value = loans.length;
    worksheet.getCell(`A${summaryRow + 2}`).value = 'Total Amount:';
    worksheet.getCell(`B${summaryRow + 2}`).value = `₹${totalAmount.toFixed(2)}`;
    worksheet.getCell(`A${summaryRow + 3}`).value = 'Total Weight:';
    worksheet.getCell(`B${summaryRow + 3}`).value = `${totalWeight.toFixed(3)} gms`;
    worksheet.getCell(`A${summaryRow + 4}`).value = 'Active Loans:';
    worksheet.getCell(`B${summaryRow + 4}`).value = activeLoans;
    worksheet.getCell(`A${summaryRow + 5}`).value = 'Released Loans:';
    worksheet.getCell(`B${summaryRow + 5}`).value = releasedLoans;
    worksheet.getCell(`A${summaryRow + 6}`).value = 'Unredeemed Loans:';
    worksheet.getCell(`B${summaryRow + 6}`).value = unredeemedLoans;
    
    // Style summary section
    for (let i = summaryRow + 1; i <= summaryRow + 6; i++) {
      worksheet.getCell(`A${i}`).font = { bold: true };
    }
    
    // Set response headers
    const fileName = `${company.name}_MasterSheet_${moment().format('YYYY-MM-DD')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error exporting master sheet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export master sheet'
    });
  }
});

// Get day-wise summary for dashboard
router.get('/:companyId/summary', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { days = 30 } = req.query;
    const db = new Database();
    
    const startDate = moment().subtract(parseInt(days), 'days').format('YYYY-MM-DD');
    
    // Get day-wise loan counts and amounts
    const dayWiseData = await db.query(`
      SELECT 
        loan_date,
        COUNT(*) as loan_count,
        SUM(loan_amount) as total_amount,
        SUM(item_weight) as total_weight,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'released' THEN 1 ELSE 0 END) as released_count,
        SUM(CASE WHEN status = 'unredeemed' THEN 1 ELSE 0 END) as unredeemed_count
      FROM loans 
      WHERE company_id = ? AND loan_date >= ?
      GROUP BY loan_date
      ORDER BY loan_date DESC
    `, [companyId, startDate]);
    
    // Get overall statistics
    const overallStats = await db.get(`
      SELECT 
        COUNT(*) as total_loans,
        SUM(loan_amount) as total_amount,
        SUM(item_weight) as total_weight,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_loans,
        SUM(CASE WHEN status = 'released' THEN 1 ELSE 0 END) as released_loans,
        SUM(CASE WHEN status = 'unredeemed' THEN 1 ELSE 0 END) as unredeemed_loans
      FROM loans 
      WHERE company_id = ?
    `, [companyId]);
    
    await db.close();
    
    res.json({
      success: true,
      data: {
        dayWiseData,
        overallStats
      }
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch summary data'
    });
  }
});

module.exports = router;

