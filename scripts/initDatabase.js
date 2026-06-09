const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'database', 'pawn_broker.db');

// Create database directory if it doesn't exist
const fs = require('fs');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
  // Companies table
  db.run(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('gold', 'silver', 'both')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Customers table
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      father_name TEXT,
      husband_name TEXT,
      address TEXT NOT NULL,
      occupation TEXT,
      cell_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Loans table
  db.run(`
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      serial_number TEXT NOT NULL,
      company_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      loan_amount DECIMAL(10,2) NOT NULL,
      item_weight DECIMAL(8,3) NOT NULL,
      item_description TEXT NOT NULL,
      item_type TEXT NOT NULL CHECK (item_type IN ('gold', 'silver')),
      loan_date DATE NOT NULL,
      interest_rate DECIMAL(5,2) DEFAULT 2.0,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'released', 'unredeemed')),
      released_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies (id),
      FOREIGN KEY (customer_id) REFERENCES customers (id)
    )
  `);

  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_company_serial
    ON loans (company_id, serial_number)
  `);

  // Receipts table
  db.run(`
    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL,
      receipt_number TEXT NOT NULL UNIQUE,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (loan_id) REFERENCES loans (id)
    )
  `);

  // Insert default companies
  const companies = [
    { name: 'Darshan Bankers', type: 'gold' },
    { name: 'Mutha Sobhagmull and Sons', type: 'both' },
    { name: 'Dariachand and Sons', type: 'gold' }
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO companies (name, type) VALUES (?, ?)');
  companies.forEach(company => {
    stmt.run(company.name, company.type);
  });
  stmt.finalize();

  const defaultUsername = 'admin';
  const defaultPassword = 'admin123';
  const passwordHash = bcrypt.hashSync(defaultPassword, 10);

  db.run(
    'INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    [defaultUsername, passwordHash, 'admin'],
    (err) => {
      if (err) {
        console.error('Error creating default admin user:', err.message);
      } else {
        console.log(`Default admin user ensured: ${defaultUsername}/${defaultPassword}`);
      }
    }
  );

  console.log('Database initialized successfully!');
  console.log('Companies created:');
  companies.forEach(company => {
    console.log(`- ${company.name} (${company.type})`);
  });
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('Database connection closed.');
  }
});

