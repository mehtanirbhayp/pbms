const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'database', 'pawn_broker.db');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

function migrateSerialNumbers(db, finish) {
  const migrationSql = `
    BEGIN TRANSACTION;
    DROP TABLE IF EXISTS loans_new;
    CREATE TABLE IF NOT EXISTS loans_new (
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
    );
    INSERT INTO loans_new (
      id, serial_number, company_id, customer_id, loan_amount, item_weight,
      item_description, item_type, loan_date, interest_rate, status,
      released_date, created_at
    )
    SELECT
      id, serial_number, company_id, customer_id, loan_amount, item_weight,
      item_description, item_type, loan_date, interest_rate, 
      CASE 
        WHEN status = 'delivered' THEN 'released'
        WHEN status = 'defaulted' THEN 'unredeemed'
        ELSE status
      END as status,
      delivered_date as released_date, created_at
    FROM loans;
    DROP TABLE loans;
    ALTER TABLE loans_new RENAME TO loans;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_company_serial
      ON loans (company_id, serial_number);
    COMMIT;
  `;

  db.exec(migrationSql, (err) => {
    if (err) {
      db.exec('ROLLBACK;', () => finish(err));
    } else {
      finish();
    }
  });
}

function ensureCompositeIndex(db, finish) {
  db.run(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_company_serial ON loans (company_id, serial_number)',
    (err) => finish(err)
  );
}

function migrateStatusValues(db, finish) {
  // Check the current table schema
  db.get(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'loans'",
    (err, row) => {
      if (err) {
        return finish(err);
      }
      
      if (!row || !row.sql) {
        // Table doesn't exist, nothing to migrate
        return finish();
      }
      
      const tableSql = row.sql;
      const hasOldConstraint = tableSql.includes("status IN ('active', 'delivered', 'defaulted')");
      const hasNewConstraint = tableSql.includes("status IN ('active', 'released', 'unredeemed')");
      const hasDeliveredDate = tableSql.includes('delivered_date');
      const hasReleasedDate = tableSql.includes('released_date');
      
      // If table already has new constraint and released_date, nothing to do
      if (hasNewConstraint && hasReleasedDate) {
        return finish();
      }
      
      // If table has old constraint, we need to recreate it
      if (hasOldConstraint || hasDeliveredDate) {
        // Determine which date column to use in the SELECT
        const dateColumn = hasDeliveredDate ? 'delivered_date' : (hasReleasedDate ? 'released_date' : 'NULL');
        
        // Recreate table with new schema
        const migrationSql = 
          'BEGIN TRANSACTION; ' +
          'DROP TABLE IF EXISTS loans_migration_temp; ' +
          'CREATE TABLE loans_migration_temp (' +
          '  id INTEGER PRIMARY KEY AUTOINCREMENT,' +
          '  serial_number TEXT NOT NULL,' +
          '  company_id INTEGER NOT NULL,' +
          '  customer_id INTEGER NOT NULL,' +
          '  loan_amount DECIMAL(10,2) NOT NULL,' +
          '  item_weight DECIMAL(8,3) NOT NULL,' +
          '  item_description TEXT NOT NULL,' +
          '  item_type TEXT NOT NULL CHECK (item_type IN (\'gold\', \'silver\')),' +
          '  loan_date DATE NOT NULL,' +
          '  interest_rate DECIMAL(5,2) DEFAULT 2.0,' +
          '  status TEXT DEFAULT \'active\' CHECK (status IN (\'active\', \'released\', \'unredeemed\')),' +
          '  released_date DATE,' +
          '  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,' +
          '  FOREIGN KEY (company_id) REFERENCES companies (id),' +
          '  FOREIGN KEY (customer_id) REFERENCES customers (id)' +
          '); ' +
          'INSERT INTO loans_migration_temp (' +
          '  id, serial_number, company_id, customer_id, loan_amount, item_weight,' +
          '  item_description, item_type, loan_date, interest_rate, status,' +
          '  released_date, created_at' +
          ') ' +
          'SELECT ' +
          '  id, serial_number, company_id, customer_id, loan_amount, item_weight,' +
          '  item_description, item_type, loan_date, interest_rate,' +
          '  CASE ' +
          '    WHEN status = \'delivered\' THEN \'released\' ' +
          '    WHEN status = \'defaulted\' THEN \'unredeemed\' ' +
          '    ELSE status ' +
          '  END as status,' +
          '  ' + dateColumn + ' as released_date,' +
          '  created_at ' +
          'FROM loans; ' +
          'DROP TABLE loans; ' +
          'ALTER TABLE loans_migration_temp RENAME TO loans; ' +
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_company_serial ' +
          '  ON loans (company_id, serial_number); ' +
          'COMMIT;';
        
        db.exec(migrationSql, (execErr) => {
          if (execErr) {
            db.exec('ROLLBACK;', () => finish(execErr));
          } else {
            finish();
          }
        });
      } else {
        // Table exists but no constraint issue, just try to rename column if needed
        if (hasDeliveredDate && !hasReleasedDate) {
          db.run(
            `ALTER TABLE loans RENAME COLUMN delivered_date TO released_date`,
            (renameErr) => {
              // Ignore error if already renamed or doesn't exist
              finish();
            }
          );
        } else {
          finish();
        }
      }
    }
  );
}

function ensureUsersTable(db, callback) {
  db.run(
    `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    (tableErr) => {
      if (tableErr) {
        return callback(tableErr);
      }

      db.get(
        'SELECT id FROM users WHERE username = ?',
        ['admin'],
        (selectErr, row) => {
          if (selectErr) {
            return callback(selectErr);
          }

          if (row) {
            return callback();
          }

          const passwordHash = bcrypt.hashSync('admin123', 10);
          db.run(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            ['admin', passwordHash, 'admin'],
            callback
          );
        }
      );
    }
  );
}

function addNoticeColumns(db, callback) {
  // Get all column names
  db.all("PRAGMA table_info(loans)", (err, columns) => {
    if (err) {
      return callback(err);
    }

    const columnNames = columns.map(col => col.name);
    const hasNotice1 = columnNames.includes('notice1_date');
    const hasNotice2 = columnNames.includes('notice2_date');
    const hasNotice3 = columnNames.includes('notice3_date');
    const hasNotice4 = columnNames.includes('notice4_date');
    const hasNotice1Comment = columnNames.includes('notice1_comment');
    const hasNotice2Comment = columnNames.includes('notice2_comment');
    const hasNotice3Comment = columnNames.includes('notice3_comment');
    const hasNotice4Comment = columnNames.includes('notice4_comment');

    if (hasNotice1 && hasNotice2 && hasNotice3 && hasNotice4 && 
        hasNotice1Comment && hasNotice2Comment && hasNotice3Comment && hasNotice4Comment) {
      // All columns exist, nothing to do
      return callback();
    }

    // Add missing columns one by one (SQLite limitation)
    const columnsToAdd = [];
    if (!hasNotice1) columnsToAdd.push('notice1_date DATE');
    if (!hasNotice2) columnsToAdd.push('notice2_date DATE');
    if (!hasNotice3) columnsToAdd.push('notice3_date DATE');
    if (!hasNotice4) columnsToAdd.push('notice4_date DATE');
    if (!hasNotice1Comment) columnsToAdd.push('notice1_comment TEXT');
    if (!hasNotice2Comment) columnsToAdd.push('notice2_comment TEXT');
    if (!hasNotice3Comment) columnsToAdd.push('notice3_comment TEXT');
    if (!hasNotice4Comment) columnsToAdd.push('notice4_comment TEXT');

    if (columnsToAdd.length === 0) {
      return callback();
    }

    let completed = 0;
    let hasError = false;

    const addNextColumn = () => {
      if (completed >= columnsToAdd.length) {
        callback();
        return;
      }

      const columnDef = columnsToAdd[completed];
      db.run(`ALTER TABLE loans ADD COLUMN ${columnDef}`, (err) => {
        if (err) {
          // Ignore error if column already exists
          if (err.message && err.message.includes('duplicate column name')) {
            // Column already exists, continue
          } else {
            hasError = true;
            return callback(err);
          }
        }
        completed++;
        addNextColumn();
      });
    };

    addNextColumn();
  });
}

function addRemarksColumn(db, callback) {
  // Get all column names
  db.all("PRAGMA table_info(loans)", (err, columns) => {
    if (err) {
      return callback(err);
    }

    const columnNames = columns.map(col => col.name);
    const hasRemarks = columnNames.includes('remarks');

    if (hasRemarks) {
      // Column already exists, nothing to do
      return callback();
    }

    // Add remarks column
    db.run('ALTER TABLE loans ADD COLUMN remarks TEXT', (err) => {
      if (err) {
        // Ignore error if column already exists
        if (err.message && err.message.includes('duplicate column name')) {
          // Column already exists, continue
          return callback();
        } else {
          return callback(err);
        }
      }
      callback();
    });
  });
}

function addTimeLimitDateColumn(db, callback) {
  // Get all column names
  db.all("PRAGMA table_info(loans)", (err, columns) => {
    if (err) {
      return callback(err);
    }

    const columnNames = columns.map(col => col.name);
    const hasTimeLimitDate = columnNames.includes('time_limit_date');

    if (hasTimeLimitDate) {
      // Column already exists, nothing to do
      return callback();
    }

    // Add time_limit_date column
    db.run('ALTER TABLE loans ADD COLUMN time_limit_date DATE', (err) => {
      if (err) {
        // Ignore error if column already exists
        if (err.message && err.message.includes('duplicate column name')) {
          // Column already exists, continue
          return callback();
        } else {
          return callback(err);
        }
      }
      callback();
    });
  });
}

function ensureCompaniesTable(db, callback) {
  db.run(
    `
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK (type IN ('gold', 'silver', 'both')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    (tableErr) => {
      if (tableErr) {
        return callback(tableErr);
      }

      // Ensure default companies exist
      const companies = [
        { name: 'Darshan Bankers', type: 'gold' },
        { name: 'Mutha Sobhagmull and Sons', type: 'both' },
        { name: 'Dariachand and Sons', type: 'gold' }
      ];

      let completed = 0;
      let hasError = false;

      companies.forEach(company => {
        db.run(
          'INSERT OR IGNORE INTO companies (name, type) VALUES (?, ?)',
          [company.name, company.type],
          (err) => {
            if (err && !hasError) {
              hasError = true;
              return callback(err);
            }
            completed++;
            if (completed === companies.length && !hasError) {
              callback();
            }
          }
        );
      });

      // If no companies to insert, callback immediately
      if (companies.length === 0) {
        callback();
      }
    }
  );
}

function runMigrations() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      }
    });

    const finish = (error) => {
      db.close((closeErr) => {
        if (error) {
          reject(error);
        } else if (closeErr) {
          reject(closeErr);
        } else {
          resolve();
        }
      });
    };

    db.serialize(() => {
      ensureUsersTable(db, (userErr) => {
        if (userErr) {
          return finish(userErr);
        }

        ensureCompaniesTable(db, (companyErr) => {
          if (companyErr) {
            return finish(companyErr);
          }

          migrateStatusValues(db, (statusErr) => {
            if (statusErr) {
              return finish(statusErr);
            }

            addNoticeColumns(db, (noticeErr) => {
              if (noticeErr) {
                return finish(noticeErr);
              }

              addRemarksColumn(db, (remarksErr) => {
                if (remarksErr) {
                  return finish(remarksErr);
                }

                addTimeLimitDateColumn(db, (timeLimitErr) => {
                  if (timeLimitErr) {
                    return finish(timeLimitErr);
                  }

                  db.get(
                    "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name = 'loans'",
                    (err, row) => {
                      if (err) {
                        return finish(err);
                      }

                    if (!row) {
                      return finish();
                    }

                    const tableSql = row.sql || '';
                    const hasUniqueSerial =
                      /serial_number\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(tableSql);

                    if (hasUniqueSerial) {
                      migrateSerialNumbers(db, finish);
                    } else {
                      ensureCompositeIndex(db, finish);
                    }
                  }
                );
                });
              });
            });
          });
        });
      });
    });
  });
}

module.exports = runMigrations;

