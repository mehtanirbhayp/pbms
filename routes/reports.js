const express = require('express');
const Database = require('../utils/database');
const ExcelJS = require('exceljs');
const moment = require('moment');
const router = express.Router();

// Generate daily report
router.get('/daily', async (req, res) => {
  console.log('Daily report route hit, date:', req.query.date);
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date parameter is required'
      });
    }
    
    const db = new Database();
    
    // Get all companies
    const companies = await db.query('SELECT * FROM companies ORDER BY name');
    
    // Get all loans for the selected date with full details
    const loans = await db.query(`
      SELECT l.id, l.serial_number, l.company_id, l.loan_amount, 
             l.item_type, l.loan_date,
             c.name as company_name
      FROM loans l
      JOIN companies c ON l.company_id = c.id
      WHERE DATE(l.loan_date) = DATE(?)
      ORDER BY c.name, l.item_type, l.serial_number
    `, [date]);
    
    await db.close();
    
    // Organize data by company
    const companyData = {};
    let grandTotalGold = 0;
    let grandTotalSilver = 0;
    let grandTotalAmount = 0;
    let grandTotalGoldCount = 0;
    let grandTotalSilverCount = 0;
    
    companies.forEach(company => {
      companyData[company.id] = {
        name: company.name,
        gold: { count: 0, amount: 0 },
        silver: { count: 0, amount: 0 },
        total: { count: 0, amount: 0 }
      };
    });
    
    // Process loans
    loans.forEach(loan => {
      const companyId = loan.company_id;
      const itemType = loan.item_type.toLowerCase();
      const amount = parseFloat(loan.loan_amount) || 0;
      
      if (companyData[companyId]) {
        if (itemType === 'gold') {
          companyData[companyId].gold.count++;
          companyData[companyId].gold.amount += amount;
          grandTotalGoldCount++;
          grandTotalGold += amount;
        } else if (itemType === 'silver') {
          companyData[companyId].silver.count++;
          companyData[companyId].silver.amount += amount;
          grandTotalSilverCount++;
          grandTotalSilver += amount;
        }
        
        companyData[companyId].total.count++;
        companyData[companyId].total.amount += amount;
        grandTotalAmount += amount;
      }
    });
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Daily Report');
    
    // Set column widths
    worksheet.columns = [
      { header: 'Company Name', key: 'company', width: 30 },
      { header: 'Gold Loans', key: 'goldCount', width: 15 },
      { header: 'Gold Amount (₹)', key: 'goldAmount', width: 18 },
      { header: 'Silver Loans', key: 'silverCount', width: 15 },
      { header: 'Silver Amount (₹)', key: 'silverAmount', width: 18 },
      { header: 'Total Loans', key: 'totalCount', width: 15 },
      { header: 'Total Amount (₹)', key: 'totalAmount', width: 18 }
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
    companies.forEach(company => {
      const data = companyData[company.id];
      worksheet.addRow({
        company: data.name,
        goldCount: data.gold.count,
        goldAmount: data.gold.amount.toFixed(2),
        silverCount: data.silver.count,
        silverAmount: data.silver.amount.toFixed(2),
        totalCount: data.total.count,
        totalAmount: data.total.amount.toFixed(2)
      });
    });
    
    // Add empty row
    worksheet.addRow({});
    
    // Add summary row
    const summaryRow = worksheet.addRow({
      company: 'GRAND TOTAL',
      goldCount: grandTotalGoldCount,
      goldAmount: grandTotalGold.toFixed(2),
      silverCount: grandTotalSilverCount,
      silverAmount: grandTotalSilver.toFixed(2),
      totalCount: grandTotalGoldCount + grandTotalSilverCount,
      totalAmount: grandTotalAmount.toFixed(2)
    });
    
    // Style summary row
    summaryRow.font = { bold: true, size: 12 };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Add empty rows before detailed breakdown
    worksheet.addRow({});
    worksheet.addRow({});
    
    // Add detailed breakdown section header
    const detailHeaderRow = worksheet.addRow(['DETAILED BREAKDOWN BY COMPANY']);
    worksheet.mergeCells(`A${detailHeaderRow.number}:G${detailHeaderRow.number}`);
    detailHeaderRow.font = { bold: true, size: 14 };
    detailHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
    detailHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFB0B0B0' }
    };
    detailHeaderRow.height = 25;
    
    worksheet.addRow({});
    
    // Process each company for detailed breakdown
    companies.forEach(company => {
      const companyLoans = loans.filter(loan => loan.company_id === company.id);
      
      if (companyLoans.length === 0) {
        return; // Skip companies with no loans
      }
      
      // Company header
      const companyHeaderRow = worksheet.addRow([company.name.toUpperCase()]);
      worksheet.mergeCells(`A${companyHeaderRow.number}:G${companyHeaderRow.number}`);
      companyHeaderRow.font = { bold: true, size: 12 };
      companyHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8E8E8' }
      };
      companyHeaderRow.height = 20;
      
      // Check if this is Mutha Sobhagmull and Sons
      const isMuthaSobhagmull = company.name.toLowerCase().includes('mutha') || 
                                 company.name.toLowerCase().includes('sobha');
      
      if (isMuthaSobhagmull) {
        // For Mutha Sobhagmull: Separate columns for Gold and Silver
        const goldHeaderRow = worksheet.addRow(['GOLD LOANS', '', '', 'SILVER LOANS', '', '', '']);
        worksheet.mergeCells(`A${goldHeaderRow.number}:C${goldHeaderRow.number}`);
        worksheet.mergeCells(`D${goldHeaderRow.number}:F${goldHeaderRow.number}`);
        goldHeaderRow.font = { bold: true, size: 11 };
        goldHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
        goldHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
        
        const columnHeaderRow = worksheet.addRow(['Serial Number', 'Amount (₹)', '', 'Serial Number', 'Amount (₹)', '', '']);
        columnHeaderRow.font = { bold: true };
        columnHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5F5' }
        };
        
        // Separate gold and silver loans
        const goldLoans = companyLoans.filter(loan => loan.item_type.toLowerCase() === 'gold');
        const silverLoans = companyLoans.filter(loan => loan.item_type.toLowerCase() === 'silver');
        const maxRows = Math.max(goldLoans.length, silverLoans.length);
        
        let goldTotal = 0;
        let silverTotal = 0;
        
        for (let i = 0; i < maxRows; i++) {
          const goldLoan = goldLoans[i];
          const silverLoan = silverLoans[i];
          
          const rowData = [
            goldLoan ? goldLoan.serial_number : '',
            goldLoan ? parseFloat(goldLoan.loan_amount).toFixed(2) : '',
            '',
            silverLoan ? silverLoan.serial_number : '',
            silverLoan ? parseFloat(silverLoan.loan_amount).toFixed(2) : '',
            '',
            ''
          ];
          
          if (goldLoan) goldTotal += parseFloat(goldLoan.loan_amount);
          if (silverLoan) silverTotal += parseFloat(silverLoan.loan_amount);
          
          worksheet.addRow(rowData);
        }
        
        // Subtotal row for Mutha Sobhagmull
        const subtotalRow = worksheet.addRow([
          'SUB TOTAL',
          goldTotal.toFixed(2),
          '',
          'SUB TOTAL',
          silverTotal.toFixed(2),
          '',
          ''
        ]);
        subtotalRow.font = { bold: true };
        subtotalRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
      } else {
        // For other companies: Single column format
        const columnHeaderRow = worksheet.addRow(['Serial Number', 'Amount (₹)', '', '', '', '', '']);
        columnHeaderRow.font = { bold: true };
        columnHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5F5' }
        };
        
        let companyTotal = 0;
        
        companyLoans.forEach(loan => {
          const amount = parseFloat(loan.loan_amount);
          companyTotal += amount;
          worksheet.addRow([
            loan.serial_number,
            amount.toFixed(2),
            '',
            '',
            '',
            '',
            ''
          ]);
        });
        
        // Subtotal row
        const subtotalRow = worksheet.addRow([
          'SUB TOTAL',
          companyTotal.toFixed(2),
          '',
          '',
          '',
          '',
          ''
        ]);
        subtotalRow.font = { bold: true };
        subtotalRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
      }
      
      // Add empty row after each company
      worksheet.addRow({});
    });
    
    // Format amount columns as numbers
    worksheet.getColumn('goldAmount').numFmt = '#,##0.00';
    worksheet.getColumn('silverAmount').numFmt = '#,##0.00';
    worksheet.getColumn('totalAmount').numFmt = '#,##0.00';
    
    // Add title row at the top
    worksheet.insertRow(1, ['Daily Report - ' + moment(date).format('DD/MM/YYYY')]);
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Adjust row heights
    worksheet.getRow(1).height = 25;
    worksheet.getRow(2).height = 20;
    
    // Set response headers
    const fileName = `Daily_Report_${moment(date).format('DD-MM-YYYY')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error generating daily report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate daily report'
    });
  }
});

module.exports = router;

