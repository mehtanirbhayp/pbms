# Mutha Sobhagmull and Sons - Pawn Broker Management System

A comprehensive digital pawn broker management system for Mutha Sobhagmull and Sons and their subsidiary companies.

## Features

### Company Management
- **Darshan Bankers** - Gold loans
- **Mutha Sobhagmull and Sons** - Both gold and silver loans (Parent company)
- **Dariachand and Sons** - Gold loans

### Core Functionality
- ✅ **Loan Management**: Create, view, and manage loans with complete customer details
- ✅ **Receipt Generation**: Generate PDF receipts with all required information
- ✅ **Release Tracking**: Mark items as released when customers redeem them
- ✅ **Master Sheet**: Company-wise master sheets with day-wise calculations
- ✅ **Excel Export**: Export master sheet data to Excel format
- ✅ **Database Management**: SQLite database for reliable data storage

### Receipt Information
Each receipt contains:
- Serial number
- Customer name, father/husband name, address, occupation, cell number
- Loan date and amount
- Item weight and description
- Company information

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: SQLite3
- **PDF Generation**: PDFKit
- **Excel Export**: ExcelJS
- **Frontend**: Vanilla HTML/CSS/JavaScript

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation Steps

1. **Clone or download the project**
   ```bash
   cd Pawn_broker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the database**
   ```bash
   npm run init-db
   ```

4. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

5. **Access the system**
   Open your browser and go to: `http://localhost:3000`

## API Endpoints

### Companies
- `GET /api/companies` - Get all companies
- `GET /api/companies/:id` - Get company by ID
- `GET /api/companies/:id/stats` - Get company statistics

### Loans
- `POST /api/loans` - Create new loan
- `GET /api/loans` - Get all loans (with filters)
- `GET /api/loans/:id` - Get loan by ID
- `PATCH /api/loans/:id/deliver` - Mark loan as released
- `PATCH /api/loans/:id/default` - Mark loan as unredeemed

### Receipts
- `GET /api/receipts/:loanId` - Get receipt details (JSON)
- `GET /api/receipts/:loanId/pdf` - Generate PDF receipt
- `GET /api/receipts/company/:companyId` - Get all receipts for a company

### Master Sheet
- `GET /api/master-sheet/:companyId` - Get master sheet data
- `GET /api/master-sheet/:companyId/export` - Export to Excel
- `GET /api/master-sheet/:companyId/summary` - Get summary statistics

## Database Schema

### Companies Table
- `id` - Primary key
- `name` - Company name
- `type` - 'gold', 'silver', or 'both'
- `created_at` - Creation timestamp

### Customers Table
- `id` - Primary key
- `name` - Customer name
- `father_name` - Father's name
- `husband_name` - Husband's name
- `address` - Customer address
- `occupation` - Customer occupation
- `cell_number` - Contact number
- `created_at` - Creation timestamp

### Loans Table
- `id` - Primary key
- `serial_number` - Unique serial number
- `company_id` - Foreign key to companies
- `customer_id` - Foreign key to customers
- `loan_amount` - Loan amount in rupees
- `item_weight` - Weight in grams
- `item_description` - Description of pledged item
- `item_type` - 'gold' or 'silver'
- `loan_date` - Date of loan
- `interest_rate` - Interest rate per month
- `status` - 'active', 'released', or 'unredeemed'
- `released_date` - Date when item was released
- `created_at` - Creation timestamp

### Receipts Table
- `id` - Primary key
- `loan_id` - Foreign key to loans
- `receipt_number` - Unique receipt number
- `generated_at` - Generation timestamp

## Usage Guide

### Creating a New Loan
1. Go to "New Loan" tab
2. Select the company and item type
3. Fill in customer details
4. Enter loan amount, weight, and description
5. Click "Create Loan"

### Viewing Loans
1. Go to "View Loans" tab
2. Use filters to narrow down results
3. Click "Load Loans" to view data
4. Use action buttons to release, mark as unredeemed, or generate receipts

### Generating Receipts
1. Go to "Receipts" tab
2. Enter the loan ID
3. Click "Generate Receipt" to download PDF

### Master Sheet
1. Go to "Master Sheet" tab
2. Select company and filters
3. Click "Load Master Sheet" to view data
4. Click "Export to Excel" to download spreadsheet

## File Structure

```
Pawn_broker/
├── server.js                 # Main server file
├── package.json              # Dependencies and scripts
├── README.md                 # This file
├── scripts/
│   └── initDatabase.js       # Database initialization
├── routes/
│   ├── companies.js          # Company management routes
│   ├── loans.js              # Loan management routes
│   ├── receipts.js           # Receipt generation routes
│   └── masterSheet.js        # Master sheet routes
├── utils/
│   └── database.js           # Database utility class
├── public/
│   └── index.html            # Frontend interface
└── database/
    └── pawn_broker.db        # SQLite database (created after init)
```

## Development

### Adding New Features
1. Create new routes in the `routes/` directory
2. Add corresponding frontend functionality in `public/index.html`
3. Update the database schema if needed in `scripts/initDatabase.js`

### Database Modifications
1. Modify the schema in `scripts/initDatabase.js`
2. Delete the existing database file
3. Run `npm run init-db` to recreate the database

## Security Notes

- The system is designed for internal use
- Consider adding authentication for production use
- Consider implementing data encryption for sensitive information

## Support

For technical support or feature requests, please contact the development team.

## License

This project is proprietary software for Mutha Sobhagmull and Sons.




