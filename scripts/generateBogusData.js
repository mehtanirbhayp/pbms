const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'pawn_broker.db');
const db = new sqlite3.Database(dbPath);

console.log('Connecting to database...');

db.serialize(() => {
  // 1. Get starting IDs
  db.get('SELECT COALESCE(MAX(id), 0) as maxId FROM customers', (err, customerRow) => {
    if (err) {
      console.error('Error reading max customer ID:', err);
      process.exit(1);
    }
    const customerStartId = customerRow.maxId + 1;

    db.get('SELECT COALESCE(MAX(id), 0) as maxId FROM loans', (err, loanRow) => {
      if (err) {
        console.error('Error reading max loan ID:', err);
        process.exit(1);
      }
      const loanStartId = loanRow.maxId + 1;

      db.get('SELECT id FROM companies LIMIT 1', (err, companyRow) => {
        if (err || !companyRow) {
          console.error('No companies found. Please run migrations first.', err);
          process.exit(1);
        }
        const companyId = companyRow.id;

        console.log(`Starting generation...`);
        console.log(`- Base Customer ID starts at: ${customerStartId}`);
        console.log(`- Base Loan ID starts at: ${loanStartId}`);
        console.log(`- Using Company ID: ${companyId}`);

        // Start transaction
        db.run('BEGIN TRANSACTION', () => {
          // A. Insert 10,000 customers
          console.log('Inserting 10,000 bogus customers...');
          const customerStmt = db.prepare(`
            INSERT INTO customers (id, name, father_name, address, occupation, cell_number) 
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (let i = 0; i < 10000; i++) {
            const customerId = customerStartId + i;
            customerStmt.run(
              customerId,
              `Bogus Customer ${customerId}`,
              `Father ${customerId}`,
              `Bogus Address, Street ${customerId}, City`,
              'Business',
              '9876543210'
            );
          }
          customerStmt.finalize();

          // B. Insert 100,100 loans
          console.log('Inserting 100,100 bogus loans...');
          const loanStmt = db.prepare(`
            INSERT INTO loans (
              id, serial_number, company_id, customer_id, loan_amount, item_weight,
              item_description, item_type, loan_date, interest_rate, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const todayStr = new Date().toISOString().slice(0, 10);
          for (let i = 0; i < 100100; i++) {
            const loanId = loanStartId + i;
            const customerId = customerStartId + (i % 10000); // cycle through our 10,000 new customers
            loanStmt.run(
              loanId,
              `BG-${loanId}`,
              companyId,
              customerId,
              15000.00,
              12.500,
              'Bogus Gold Ring 22k',
              'gold',
              todayStr,
              2.00,
              'active',
              new Date().toISOString()
            );
          }
          loanStmt.finalize();

          // C. Insert 100,100 receipts
          console.log('Inserting 100,100 bogus receipts...');
          const receiptStmt = db.prepare(`
            INSERT INTO receipts (loan_id, receipt_number, generated_at) 
            VALUES (?, ?, ?)
          `);
          for (let i = 0; i < 100100; i++) {
            const loanId = loanStartId + i;
            receiptStmt.run(
              loanId,
              `REC-BG-${loanId}`,
              new Date().toISOString()
            );
          }
          receiptStmt.finalize();

          // Commit transaction
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              console.error('Transaction commit failed:', commitErr);
              db.run('ROLLBACK', () => {
                db.close();
                process.exit(1);
              });
            } else {
              console.log('Successfully committed transaction!');
              console.log('Database populated with:');
              console.log('- 10,000 Customers');
              console.log('- 100,100 Loans');
              console.log('- 100,100 Receipts');
              console.log('Total added: 210,200 rows');
              
              db.close(() => {
                console.log('Database connection closed.');
              });
            }
          });
        });
      });
    });
  });
});
