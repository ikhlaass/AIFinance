const db = require("./db");
require("dotenv").config();

async function clearData() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Keep users table intact because app uses hardcoded user_id = 1.
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    await connection.query("TRUNCATE TABLE transactions");
    await connection.query("TRUNCATE TABLE assets");
    await connection.query("TRUNCATE TABLE wallets");
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");

    // Ensure main user exists after reset.
    await connection.query(
      `INSERT INTO users (id, name, email)
       VALUES (1, 'Idrus', 'andi.ikhlas107@gmail.com')
       ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email)`,
    );

    await connection.commit();
    console.log("Database financial data has been cleared successfully.");
    process.exit(0);
  } catch (err) {
    await connection.rollback();
    console.error("Failed to clear database data:", err.message);
    process.exit(1);
  } finally {
    connection.release();
  }
}

clearData();
