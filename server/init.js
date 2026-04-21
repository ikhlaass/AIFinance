const mysql = require("mysql2/promise");
require("dotenv").config();

async function initDB() {
  console.log("Starting Database Initialization...");
  try {
    // 1. Connect without database selected
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 3306,
    });

    console.log("Connected to MySQL server.");

    // 2. Create the Database if it doesn't exist
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`,
    );
    console.log(`Database \`${process.env.DB_NAME}\` is ready.`);

    // 3. Switch to the newly created database
    await connection.query(`USE \`${process.env.DB_NAME}\`;`);

    // 4. Create Users Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        telegram_id VARCHAR(50) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Users table is ready.");

    // 5. Create Wallets Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(50) NOT NULL,
        balance DECIMAL(15,2) DEFAULT 0.00,
        is_active BOOLEAN DEFAULT true,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("Wallets table is ready.");

    // 6. Create Transactions Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        wallet_id INT NOT NULL,
        type ENUM('income', 'expense') NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT,
        transaction_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
      )
    `);
    console.log("Transactions table is ready.");

    // 7. Create Assets Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('market', 'custom') NOT NULL,
        ticker VARCHAR(20),
        name VARCHAR(120) NOT NULL,
        quantity DECIMAL(20,8) NOT NULL DEFAULT 1,
        purchase_price DECIMAL(20,2) NOT NULL DEFAULT 0,
        total_value DECIMAL(20,2) NOT NULL DEFAULT 0,
        broker VARCHAR(120),
        unit_type VARCHAR(50),
        wallet_id INT,
        transaction_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL
      )
    `);
    console.log("Assets table is ready.");

    // 8. Create Debts Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS debts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(120) NOT NULL,
        type ENUM('mortgage', 'vehicle', 'credit-card', 'business', 'other') NOT NULL DEFAULT 'other',
        principal DECIMAL(15,2) NOT NULL DEFAULT 0,
        annual_interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
        tenor_months INT NOT NULL DEFAULT 0,
        monthly_payment DECIMAL(15,2) NOT NULL DEFAULT 0,
        paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        elapsed_months INT NOT NULL DEFAULT 0,
        status ENUM('active', 'paid') NOT NULL DEFAULT 'active',
        start_date DATE NOT NULL,
        wallet_id INT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL
      )
    `);
    console.log("Debts table is ready.");

    // 9. Create Debt Installments Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS debt_installments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        debt_id INT NOT NULL,
        user_id INT NOT NULL,
        amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        paid_at DATE NOT NULL,
        notes VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_debt_installments_debt_id (debt_id),
        INDEX idx_debt_installments_user_id (user_id)
      )
    `);
    console.log("Debt installments table is ready.");

    // 10. Ensure transactions has asset_id column for investment link
    const [assetColumnRows] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'transactions'
         AND COLUMN_NAME = 'asset_id'`,
      [process.env.DB_NAME],
    );
    if (Number(assetColumnRows[0]?.count) === 0) {
      await connection.query(
        `ALTER TABLE transactions ADD COLUMN asset_id INT NULL`,
      );
    }

    const [assetIndexRows] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'transactions'
         AND INDEX_NAME = 'idx_transactions_asset_id'`,
      [process.env.DB_NAME],
    );
    if (Number(assetIndexRows[0]?.count) === 0) {
      await connection.query(
        `ALTER TABLE transactions ADD INDEX idx_transactions_asset_id (asset_id)`,
      );
    }

    const [assetFkRows] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.REFERENTIAL_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = ?
         AND TABLE_NAME = 'transactions'
         AND CONSTRAINT_NAME = 'fk_transactions_asset'`,
      [process.env.DB_NAME],
    );
    if (Number(assetFkRows[0]?.count) === 0) {
      await connection.query(
        `ALTER TABLE transactions
         ADD CONSTRAINT fk_transactions_asset
         FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL`,
      );
    }
    console.log("Transactions schema sync for asset_id is ready.");

    // 11. Insert Main User
    await connection.query(`
      INSERT INTO users (id, name, email) 
      VALUES (1, 'Idrus', 'andi.ikhlas107@gmail.com')
      ON DUPLICATE KEY UPDATE name=name;
    `);

    // 12. Optional dummy seed (disabled by default)
    if (process.env.SEED_DEMO === "true") {
      const wallets = [
        "Cash/Tunai",
        "BCA",
        "Mandiri",
        "BRI",
        "BNI",
        "GoPay",
        "OVO",
        "DANA",
        "ShopeePay",
      ];
      for (const w of wallets) {
        await connection.query(
          `INSERT INTO wallets (user_id, name, balance)
           SELECT 1, ?, 0.00 FROM DUAL
           WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE user_id = 1 AND name = ?)`,
          [w, w],
        );
      }

      const dummyTransactions = [
        {
          wallet_id: 1,
          type: "income",
          amount: 3000000,
          category: "Gajian",
          desc: "saya baru saja gajian 3jt",
          date: "2026-03-27",
        },
        {
          wallet_id: 1,
          type: "expense",
          amount: 20000,
          category: "Makanan",
          desc: "saya baru saja membeli nasi goreng 20k",
          date: "2026-03-27",
        },
        {
          wallet_id: 1,
          type: "expense",
          amount: 25000,
          category: "Umum",
          desc: "Jajan sore",
          date: "2026-03-26",
        },
      ];

      for (const t of dummyTransactions) {
        await connection.query(
          `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, transaction_date)
           SELECT 1, ?, ?, ?, ?, ?, ? FROM DUAL
           WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE user_id = 1 AND description = ?)`,
          [t.wallet_id, t.type, t.amount, t.category, t.desc, t.date, t.desc],
        );
      }

      await connection.query(
        `UPDATE wallets SET balance = 2955000 WHERE id = 1 AND user_id = 1`,
      );
      console.log("Mock data inserted successfully!");
    }

    console.log("Initialization Process Finished! 🎉");
    process.exit(0);
  } catch (err) {
    console.error("Error during initialization:", err);
    process.exit(1);
  }
}

initDB();
