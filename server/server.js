const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
// Initialize Telegram Bot & AI Listener alongside Express
require('./bot');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// User authentication is hardcoded to user_id = 1 for now

app.get('/api/dashboard/summary', async (req, res) => {
  try {
    const [incomeResult] = await db.query(
      `SELECT SUM(amount) as total FROM transactions WHERE user_id = 1 AND type = 'income'`
    );
    const [expenseResult] = await db.query(
      `SELECT SUM(amount) as total FROM transactions WHERE user_id = 1 AND type = 'expense'`
    );
    
    // We ensure the numbers map nicely or default to 0
    const income = incomeResult[0].total || 0;
    const expense = expenseResult[0].total || 0;
    const net = income - expense;

    res.json({ income, expense, net });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/wallets', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, balance FROM wallets WHERE user_id = 1 AND is_active = true`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, type, amount, category, description, transaction_date as date 
       FROM transactions 
       WHERE user_id = 1 
       ORDER BY transaction_date DESC, id DESC LIMIT 5`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/trends', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(transaction_date, '%d/%m') as date, SUM(amount) as total 
       FROM transactions 
       WHERE user_id = 1 AND type = 'expense' 
       GROUP BY transaction_date 
       ORDER BY transaction_date ASC 
       LIMIT 30`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/categories/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const [rows] = await db.query(
      `SELECT category, SUM(amount) as total 
       FROM transactions 
       WHERE user_id = 1 AND type = ? 
       GROUP BY category 
       ORDER BY total DESC`, [type]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
