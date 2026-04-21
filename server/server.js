console.log("🚀 --- AI FINANCE SERVER STARTING UP / REBOOTING ---");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

const db = require("./db");
// Initialize Telegram Bot & AI Listener alongside Express
require("./bot");

const app = express();
const port = process.env.PORT || 5000;

const USD_TO_IDR_RATE = Number(process.env.USD_TO_IDR_RATE) || 15800;
const MARKET_QUOTE_TTL_MS = Number(process.env.MARKET_QUOTE_TTL_MS) || 120000;
const marketQuoteCache = new Map();
const CURATED_TICKER_SUGGESTIONS = [
  { symbol: "XAUUSD=X", name: "Gold Spot (XAU/USD)", exchange: "Forex" },
  { symbol: "GC=F", name: "Gold Futures", exchange: "COMEX" },
  { symbol: "BTC-USD", name: "Bitcoin", exchange: "Crypto" },
  { symbol: "ETH-USD", name: "Ethereum", exchange: "Crypto" },
  { symbol: "BBCA.JK", name: "Bank Central Asia", exchange: "IDX" },
  { symbol: "TLKM.JK", name: "Telkom Indonesia", exchange: "IDX" },
  { symbol: "BMRI.JK", name: "Bank Mandiri", exchange: "IDX" },
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ" },
  { symbol: "NVDA", name: "NVIDIA Corp.", exchange: "NASDAQ" },
];

const toIso = (value) => new Date(value).toISOString();
const toDateOnly = (value) => new Date(value).toISOString().split("T")[0];
const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

function shiftMonths(dateValue, months) {
  const base = new Date(`${toDateOnly(dateValue)}T00:00:00`);
  base.setMonth(base.getMonth() + months);
  return base;
}

function parseReportPeriod(period, startDate, endDate) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let start;
  let end;
  let label;

  if (period === "custom" && startDate && endDate) {
    start = new Date(`${startDate}T00:00:00`);
    end = new Date(`${endDate}T00:00:00`);
    label = "Custom";
  } else if (period === "last-3-months") {
    start = new Date(currentYear, currentMonth - 2, 1);
    end = now;
    label = "3 Bulan Terakhir";
  } else if (period === "this-year") {
    start = new Date(currentYear, 0, 1);
    end = now;
    label = "Tahun Ini";
  } else {
    start = new Date(currentYear, currentMonth, 1);
    end = now;
    label = "Bulan Ini";
  }

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const fallbackStart = new Date(currentYear, currentMonth, 1);
    return {
      periodKey: "this-month",
      label: "Bulan Ini",
      startDate: toDateOnly(fallbackStart),
      endDate: toDateOnly(now),
    };
  }

  if (start > end) {
    [start, end] = [end, start];
  }

  return {
    periodKey: period || "this-month",
    label,
    startDate: toDateOnly(start),
    endDate: toDateOnly(end),
  };
}

function addMonthsToDate(dateValue, months) {
  const date = new Date(`${toDateOnly(dateValue)}T00:00:00`);
  date.setMonth(date.getMonth() + Number(months || 0));
  return toDateOnly(date);
}

function calculateDebtSnapshot(
  principal,
  annualInterestRate,
  tenorMonths,
  elapsedMonths,
) {
  const principalValue = Number(principal) || 0;
  const rate = Number(annualInterestRate) || 0;
  const tenorValue = Math.max(1, Number(tenorMonths) || 0);
  const elapsedValue = Math.max(0, Number(elapsedMonths) || 0);
  const monthlyRate = rate > 0 ? rate / 12 / 100 : 0;

  const monthlyPayment =
    monthlyRate > 0
      ? principalValue *
        (monthlyRate / (1 - Math.pow(1 + monthlyRate, -tenorValue)))
      : principalValue / tenorValue;

  const paidMonths = Math.min(elapsedValue, tenorValue);
  const rawPaidAmount = monthlyPayment * paidMonths;
  const paidAmount = roundMoney(Math.min(principalValue, rawPaidAmount));
  const remainingAmount = roundMoney(Math.max(0, principalValue - paidAmount));

  return {
    monthlyPayment: roundMoney(monthlyPayment),
    paidMonths,
    paidAmount,
    remainingAmount,
    status: remainingAmount <= 0 ? "paid" : "active",
  };
}

function normalizeDebtRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    principal: Number(row.principal) || 0,
    monthly: Number(row.monthly_payment) || 0,
    paid: Number(row.paid_amount) || 0,
    remaining: Number(row.remaining_amount) || 0,
    interestRate: Number(row.annual_interest_rate) || 0,
    tenorMonths: Number(row.tenor_months) || 0,
    startDate: row.start_date ? toDateOnly(row.start_date) : null,
    walletId: row.wallet_id || null,
    walletName: row.wallet_name || null,
    notes: row.notes || "",
    elapsedMonths: Number(row.elapsed_months) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getMarketQuoteInIdr(ticker, options = {}) {
  const { forceRefresh = false } = options;
  const normalizedTicker = String(ticker || "")
    .trim()
    .toUpperCase();
  if (!normalizedTicker) {
    throw new Error("Ticker kosong");
  }

  const now = Date.now();
  const cached = marketQuoteCache.get(normalizedTicker);
  const isFresh = cached && now - cached.fetchedAtEpochMs < MARKET_QUOTE_TTL_MS;

  if (!forceRefresh && isFresh) {
    return {
      unitPriceIdr: cached.unitPriceIdr,
      priceSource: "cache",
      priceUpdatedAt: toIso(cached.fetchedAtEpochMs),
      cacheAgeMs: now - cached.fetchedAtEpochMs,
    };
  }

  try {
    const quote = await yahooFinance.quote(normalizedTicker);
    const marketPrice = Number(quote?.regularMarketPrice ?? quote?.price);

    if (!Number.isFinite(marketPrice) || marketPrice <= 0) {
      throw new Error(`Harga market invalid untuk ${normalizedTicker}`);
    }

    const unitPriceIdr = normalizedTicker.endsWith(".JK")
      ? marketPrice
      : marketPrice * USD_TO_IDR_RATE;

    marketQuoteCache.set(normalizedTicker, {
      unitPriceIdr,
      fetchedAtEpochMs: now,
    });

    return {
      unitPriceIdr,
      priceSource: "live",
      priceUpdatedAt: toIso(now),
      cacheAgeMs: 0,
    };
  } catch (err) {
    if (cached) {
      return {
        unitPriceIdr: cached.unitPriceIdr,
        priceSource: "stale-cache",
        priceUpdatedAt: toIso(cached.fetchedAtEpochMs),
        cacheAgeMs: now - cached.fetchedAtEpochMs,
      };
    }
    throw err;
  }
}

app.use(cors());
app.use(express.json());

// User authentication is hardcoded to user_id = 1 for now

app.get("/api/dashboard/summary", async (req, res) => {
  try {
    const [incomeResult] = await db.query(
      `SELECT SUM(amount) as total FROM transactions WHERE user_id = 1 AND type = 'income'`,
    );
    const [expenseResult] = await db.query(
      `SELECT SUM(amount) as total FROM transactions WHERE user_id = 1 AND type = 'expense'`,
    );

    // Pemasukan dan Pengeluaran (Berdasarkan Transaksi Nyata)
    const income = Number(incomeResult[0].total) || 0;
    const expense = Number(expenseResult[0].total) || 0;

    // Kalkulasi Total Uang Tunai (Berdasarkan Saldo Nyata di Dompet)
    const [walletResult] = await db.query(
      `SELECT SUM(balance) as total FROM wallets WHERE user_id = 1 AND is_active = 1`,
    );
    const cashBalance = Number(walletResult[0]?.total) || 0;
    console.log(
      `[DEBUG] Summary - Income: ${income}, Expense: ${expense}, Cash: ${cashBalance}`,
    );

    // Tambah Nilai Aset ke Net Worth
    const [assetRows] = await db.query(
      `SELECT type, ticker, quantity, total_value, purchase_price FROM assets WHERE user_id = 1`,
    );
    let totalAssetsVal = 0;
    let marketAssetsVal = 0;
    let staticAssetsVal = 0;
    let marketAssetsCount = 0;
    let staticAssetsCount = 0;

    for (const asset of assetRows) {
      if (asset.type === "market" && asset.ticker) {
        marketAssetsCount += 1;
        try {
          const { unitPriceIdr } = await getMarketQuoteInIdr(asset.ticker);
          const assetValue = unitPriceIdr * Number(asset.quantity);
          marketAssetsVal += assetValue;
          totalAssetsVal += assetValue;
        } catch (e) {
          const fallbackValue =
            Number(asset.purchase_price) * Number(asset.quantity);
          marketAssetsVal += fallbackValue;
          totalAssetsVal += fallbackValue;
        }
      } else {
        staticAssetsCount += 1;
        const assetValue = Number(asset.total_value);
        staticAssetsVal += assetValue;
        totalAssetsVal += assetValue;
      }
    }

    const net_cash_flow = income - expense;
    const net_worth = cashBalance + totalAssetsVal;

    // Response yang Jujur & Akurat (WAJIB SINKRON)
    res.json({
      income,
      expense,
      net_cash_flow,
      cash_balance: cashBalance,
      total_assets_val: totalAssetsVal,
      market_assets_val: marketAssetsVal,
      static_assets_val: staticAssetsVal,
      market_assets_count: marketAssetsCount,
      static_assets_count: staticAssetsCount,
      net_worth,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Endpoint Khusus AI Dashboard Insight
app.get("/api/dashboard/ai-insight", async (req, res) => {
  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Rekap Uang
    const [incomeResult] = await db.query(
      `SELECT SUM(amount) as total FROM transactions WHERE user_id = 1 AND type = 'income'`,
    );
    const [expenseResult] = await db.query(
      `SELECT SUM(amount) as total FROM transactions WHERE user_id = 1 AND type = 'expense'`,
    );

    const income = incomeResult[0].total || 0;
    const expense = expenseResult[0].total || 0;

    // Intip 3 Kategori Pengeluaran Terboros
    const [categories] = await db.query(
      `SELECT category, SUM(amount) as total FROM transactions WHERE user_id = 1 AND type = 'expense' GROUP BY category ORDER BY total DESC LIMIT 3`,
    );

    const [walletResult] = await db.query(
      `SELECT SUM(balance) as total FROM wallets WHERE user_id = 1 AND is_active = 1`,
    );
    const cashBalance = Number(walletResult[0]?.total) || 0;

    const [assetRows] = await db.query(
      `SELECT type, ticker, quantity, total_value, purchase_price FROM assets WHERE user_id = 1`,
    );

    let marketAssetsVal = 0;
    let staticAssetsVal = 0;
    let marketAssetsCount = 0;
    let staticAssetsCount = 0;

    for (const asset of assetRows) {
      if (asset.type === "market" && asset.ticker) {
        marketAssetsCount += 1;
        try {
          const { unitPriceIdr } = await getMarketQuoteInIdr(asset.ticker);
          marketAssetsVal += unitPriceIdr * Number(asset.quantity);
        } catch (e) {
          marketAssetsVal +=
            Number(asset.purchase_price) * Number(asset.quantity);
        }
      } else {
        staticAssetsCount += 1;
        staticAssetsVal += Number(asset.total_value);
      }
    }

    const totalAssets = marketAssetsVal + staticAssetsVal;
    const marketShare =
      totalAssets > 0 ? (marketAssetsVal / totalAssets) * 100 : 0;
    const staticShare =
      totalAssets > 0 ? (staticAssetsVal / totalAssets) * 100 : 0;
    const liquidityShare =
      totalAssets + Number(cashBalance) > 0
        ? (Number(cashBalance) / (totalAssets + Number(cashBalance))) * 100
        : 0;

    let categoryText = "Tidak ada pengeluaran.";
    if (categories.length > 0) {
      categoryText = categories
        .map((c) => `${c.category} (Rp${c.total})`)
        .join(", ");
    }

    const prompt = `Anda adalah asisten keuangan pribadi yang cerdas dan akrab (selalu panggil user dengan sebutan 'Bang').
Bulan ini, pemasukan user adalah Rp${income} dan pengeluarannya Rp${expense}.
Pengeluaran terbesar ada di lini: ${categoryText}.
Komposisi aset user: market assets Rp${marketAssetsVal} (${marketAssetsCount} item, ${marketShare.toFixed(1)}%), static assets Rp${staticAssetsVal} (${staticAssetsCount} item, ${staticShare.toFixed(1)}%), cash Rp${cashBalance} (${liquidityShare.toFixed(1)}% dari total likuiditas+aset).
Tugas Anda: Berikan 1-2 kalimat (maksimal 30 kata) komentar analisa atau peringatan tajam namun suportif mengenai kesehatan keuangan user bulan ini. Jika porsi market assets terlalu besar, sebutkan risiko volatilitas dan sarankan penyeimbangan ke aset yang lebih stabil. Jika cash terlalu rendah, ingatkan soal likuiditas. Jangan gunakan kata pembuka seperti 'Halo'. Jangan gunakan markdown (*). Langsung to the point.`;

    const result = await model.generateContent([prompt]);
    const insight = result.response.text();

    res.json({ insight: insight.trim() });
  } catch (err) {
    console.error("AI Insight Error:", err);
    res.status(500).json({ error: "Gagal merumuskan insight AI" });
  }
});

app.get("/api/wallets", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, balance FROM wallets WHERE user_id = 1 AND is_active = true`,
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/wallets", async (req, res) => {
  try {
    const { name, balance = 0 } = req.body;
    console.log(
      `[WALLET CREATE] Request to add: ${name} with balance ${balance}`,
    );

    // Gunakan 1 sebagai ganti 'true' untuk kompatibilitas MySQL TINYINT
    const [result] = await db.query(
      `INSERT INTO wallets (user_id, name, balance, is_active) VALUES (1, ?, ?, 1)`,
      [name, balance],
    );

    console.log(`[WALLET CREATE] Success! Assigned ID: ${result.insertId}`);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("[WALLET CREATE] SQL Error:", err.message);
    res.status(500).json({ error: `Gagal di Database: ${err.message}` });
  }
});

app.post("/api/wallets/:id/delete", async (req, res) => {
  try {
    const { id } = req.params;
    const walletId = parseInt(id);
    console.log(
      `[HARD DELETE] Request to permanently remove wallet id: ${walletId}`,
    );

    if (isNaN(walletId)) {
      return res.status(400).json({ error: "ID tidak valid" });
    }

    // Perintah DELETE permanen dari database
    const [result] = await db.query(
      `DELETE FROM wallets WHERE id = ? AND user_id = 1`,
      [walletId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Dompet tidak ditemukan" });
    }

    console.log(
      `[HARD DELETE] Success! Wallet id ${walletId} removed from DB.`,
    );
    res.json({ success: true });
  } catch (err) {
    console.error("[HARD DELETE] Error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/transactions", async (req, res) => {
  try {
    const {
      type,
      category,
      wallet_id,
      start_date,
      end_date,
      limit = 50,
    } = req.query;
    let query = `SELECT t.id, t.wallet_id, t.type, t.amount, t.category, t.description, t.transaction_date as date, w.name as wallet_name 
                 FROM transactions t
                 LEFT JOIN wallets w ON t.wallet_id = w.id
                 WHERE t.user_id = 1`;
    const params = [];

    if (type) {
      query += ` AND t.type = ?`;
      params.push(type);
    }
    if (category) {
      query += ` AND t.category = ?`;
      params.push(category);
    }
    if (wallet_id) {
      query += ` AND t.wallet_id = ?`;
      params.push(wallet_id);
    }
    if (start_date && end_date) {
      query += ` AND t.transaction_date BETWEEN ? AND ?`;
      params.push(start_date, end_date);
    }

    query += ` ORDER BY t.transaction_date DESC, t.id DESC LIMIT ?`;
    params.push(parseInt(limit));

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/transactions", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { type, amount, category, description, wallet_id, transaction_date } =
      req.body;
    const amountNum = Number(amount);
    const walletIdNum = Number(wallet_id);

    if (
      !["income", "expense"].includes(type) ||
      !walletIdNum ||
      !Number.isFinite(amountNum) ||
      amountNum <= 0
    ) {
      return res.status(400).json({ error: "Input transaksi tidak valid" });
    }

    await connection.beginTransaction();

    const [walletRows] = await connection.query(
      `SELECT id FROM wallets WHERE id = ? AND user_id = 1 LIMIT 1`,
      [walletIdNum],
    );
    if (walletRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Dompet tidak ditemukan" });
    }

    // Insert Transaction
    const [result] = await connection.query(
      `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, transaction_date) 
       VALUES (1, ?, ?, ?, ?, ?, ?)`,
      [walletIdNum, type, amountNum, category, description, transaction_date],
    );

    // Update Wallet Balance
    const balanceChange = type === "income" ? amountNum : -amountNum;
    await connection.query(
      `UPDATE wallets SET balance = balance + ? WHERE id = ?`,
      [balanceChange, walletIdNum],
    );

    await connection.commit();

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    connection.release();
  }
});

app.delete("/api/transactions/:id", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const txId = Number(id);
    if (!txId)
      return res.status(400).json({ error: "ID transaksi tidak valid" });

    await connection.beginTransaction();

    // Get transaction details first for balance correction
    const [rows] = await connection.query(
      `SELECT type, amount, wallet_id FROM transactions WHERE id = ? AND user_id = 1`,
      [txId],
    );
    if (rows.length > 0) {
      const { type, amount, wallet_id } = rows[0];
      const balanceChange = type === "income" ? -amount : amount;

      // Revert Wallet Balance
      await connection.query(
        `UPDATE wallets SET balance = balance + ? WHERE id = ?`,
        [balanceChange, wallet_id],
      );

      // Delete Transaction
      await connection.query(
        `DELETE FROM transactions WHERE id = ? AND user_id = 1`,
        [txId],
      );
      await connection.commit();
      res.json({ success: true });
    } else {
      await connection.rollback();
      res.status(404).json({ error: "Transaction not found" });
    }
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    connection.release();
  }
});

app.put("/api/transactions/:id", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { type, amount, category, description, wallet_id, transaction_date } =
      req.body;
    const txId = Number(id);
    const walletIdNum = Number(wallet_id);
    const amountNum = Number(amount);

    if (
      !txId ||
      !["income", "expense"].includes(type) ||
      !walletIdNum ||
      !Number.isFinite(amountNum) ||
      amountNum <= 0
    ) {
      return res
        .status(400)
        .json({ error: "Input update transaksi tidak valid" });
    }

    await connection.beginTransaction();

    const [walletRows] = await connection.query(
      `SELECT id FROM wallets WHERE id = ? AND user_id = 1 LIMIT 1`,
      [walletIdNum],
    );
    if (walletRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Dompet tidak ditemukan" });
    }

    const [oldRows] = await connection.query(
      `SELECT type, amount, wallet_id FROM transactions WHERE id = ? AND user_id = 1`,
      [txId],
    );
    if (oldRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Normalisasi saldo dompet sebelumnya
    const oldTx = oldRows[0];
    const revertChange = oldTx.type === "income" ? -oldTx.amount : oldTx.amount;
    await connection.query(
      `UPDATE wallets SET balance = balance + ? WHERE id = ?`,
      [revertChange, oldTx.wallet_id],
    );

    // Setel beban saldo dompet yang baru
    const applyChange = type === "income" ? amountNum : -amountNum;
    await connection.query(
      `UPDATE wallets SET balance = balance + ? WHERE id = ?`,
      [applyChange, walletIdNum],
    );

    // Simpan perubahan ke transaksi
    await connection.query(
      `UPDATE transactions SET wallet_id=?, type=?, amount=?, category=?, description=?, transaction_date=? WHERE id=?`,
      [
        walletIdNum,
        type,
        amountNum,
        category,
        description,
        transaction_date,
        txId,
      ],
    );

    await connection.commit();

    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    connection.release();
  }
});

app.get("/api/trends", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(transaction_date, '%d/%m') as date, SUM(amount) as total 
       FROM transactions 
       WHERE user_id = 1 AND type = 'expense' 
       GROUP BY transaction_date 
       ORDER BY transaction_date ASC 
       LIMIT 30`,
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/categories/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const [rows] = await db.query(
      `SELECT category, SUM(amount) as total 
       FROM transactions 
       WHERE user_id = 1 AND type = ? 
       GROUP BY category 
       ORDER BY total DESC`,
      [type],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/reports/overview", async (req, res) => {
  try {
    const period = String(req.query.period || "this-month");
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const range = parseReportPeriod(period, startDate, endDate);

    const [incomeRows] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = 1 AND type = 'income' AND transaction_date BETWEEN ? AND ?`,
      [range.startDate, range.endDate],
    );

    const [expenseRows] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = 1 AND type = 'expense' AND transaction_date BETWEEN ? AND ?`,
      [range.startDate, range.endDate],
    );

    const [investmentRows] = await db.query(
      `SELECT COALESCE(
          SUM(
            CASE
              WHEN type = 'market' THEN quantity * purchase_price
              ELSE total_value
            END
          ), 0
        ) AS total
       FROM assets
       WHERE user_id = 1
         AND DATE(COALESCE(transaction_date, created_at)) BETWEEN ? AND ?`,
      [range.startDate, range.endDate],
    );

    const [walletRows] = await db.query(
      `SELECT COALESCE(SUM(balance), 0) AS total
       FROM wallets
       WHERE user_id = 1 AND is_active = 1`,
    );

    const [liabilityRows] = await db.query(
      `SELECT COALESCE(SUM(remaining_amount), 0) AS total
       FROM debts
       WHERE user_id = 1 AND status = 'active'`,
    );

    const [assetRows] = await db.query(
      `SELECT type, ticker, quantity, total_value, purchase_price
       FROM assets
       WHERE user_id = 1`,
    );

    let totalAssets = 0;
    for (const asset of assetRows) {
      if (asset.type === "market" && asset.ticker) {
        try {
          const { unitPriceIdr } = await getMarketQuoteInIdr(asset.ticker);
          totalAssets += unitPriceIdr * Number(asset.quantity || 0);
        } catch (err) {
          totalAssets +=
            Number(asset.purchase_price || 0) * Number(asset.quantity || 0);
        }
      } else {
        totalAssets += Number(asset.total_value || 0);
      }
    }

    const [trendTxRows] = await db.query(
      `SELECT DATE_FORMAT(transaction_date, '%Y-%m') AS ym,
              SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
              SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
       FROM transactions
       WHERE user_id = 1 AND transaction_date BETWEEN ? AND ?
       GROUP BY ym
       ORDER BY ym ASC`,
      [range.startDate, range.endDate],
    );

    const [trendInvestmentRows] = await db.query(
      `SELECT DATE_FORMAT(DATE(COALESCE(transaction_date, created_at)), '%Y-%m') AS ym,
              COALESCE(SUM(
                CASE
                  WHEN type = 'market' THEN quantity * purchase_price
                  ELSE total_value
                END
              ), 0) AS investment
       FROM assets
       WHERE user_id = 1
         AND DATE(COALESCE(transaction_date, created_at)) BETWEEN ? AND ?
       GROUP BY ym
       ORDER BY ym ASC`,
      [range.startDate, range.endDate],
    );

    const [incomeCategoryRows] = await db.query(
      `SELECT category, COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = 1 AND type = 'income' AND transaction_date BETWEEN ? AND ?
       GROUP BY category
       ORDER BY total DESC
       LIMIT 8`,
      [range.startDate, range.endDate],
    );

    const [expenseCategoryRows] = await db.query(
      `SELECT category, COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = 1 AND type = 'expense' AND transaction_date BETWEEN ? AND ?
       GROUP BY category
       ORDER BY total DESC
       LIMIT 8`,
      [range.startDate, range.endDate],
    );

    const [merchantRows] = await db.query(
      `SELECT COALESCE(NULLIF(TRIM(description), ''), category, 'Lainnya') AS merchant,
              COALESCE(SUM(amount), 0) AS total,
              COUNT(*) AS count
       FROM transactions
       WHERE user_id = 1 AND type = 'expense' AND transaction_date BETWEEN ? AND ?
       GROUP BY merchant
       ORDER BY total DESC
       LIMIT 8`,
      [range.startDate, range.endDate],
    );

    const income = Number(incomeRows[0]?.total) || 0;
    const expense = Number(expenseRows[0]?.total) || 0;
    const investment = Number(investmentRows[0]?.total) || 0;
    const netCashFlow = income - expense;
    const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

    const cashBalance = Number(walletRows[0]?.total) || 0;
    const totalLiabilities = Number(liabilityRows[0]?.total) || 0;
    const netWorth = cashBalance + totalAssets - totalLiabilities;

    const trendMap = new Map();
    for (const row of trendTxRows) {
      trendMap.set(row.ym, {
        month: row.ym,
        income: Number(row.income) || 0,
        expense: Number(row.expense) || 0,
        investment: 0,
      });
    }

    for (const row of trendInvestmentRows) {
      if (!trendMap.has(row.ym)) {
        trendMap.set(row.ym, {
          month: row.ym,
          income: 0,
          expense: 0,
          investment: Number(row.investment) || 0,
        });
      } else {
        const current = trendMap.get(row.ym);
        current.investment = Number(row.investment) || 0;
      }
    }

    const monthlyTrend = Array.from(trendMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((item) => ({
        ...item,
        net: item.income - item.expense,
      }));

    res.json({
      period: range,
      summary: {
        income,
        expense,
        investment,
        netCashFlow,
        savingsRate,
      },
      position: {
        totalAssets,
        totalLiabilities,
        netWorth,
      },
      monthlyTrend,
      categories: {
        income: incomeCategoryRows.map((row) => ({
          category: row.category || "Lainnya",
          total: Number(row.total) || 0,
        })),
        expense: expenseCategoryRows.map((row) => ({
          category: row.category || "Lainnya",
          total: Number(row.total) || 0,
        })),
      },
      topMerchants: merchantRows.map((row) => ({
        merchant: row.merchant || "Lainnya",
        total: Number(row.total) || 0,
        count: Number(row.count) || 0,
      })),
      comparison: {
        income,
        investment,
        expense,
        net: income - expense,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/market/suggest", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);

    const qLower = q.toLowerCase();

    const curated = CURATED_TICKER_SUGGESTIONS.filter(
      (item) =>
        item.symbol.toLowerCase().includes(qLower) ||
        item.name.toLowerCase().includes(qLower),
    ).map((item) => ({ ...item, source: "curated" }));

    let remote = [];
    try {
      const searchResult = await yahooFinance.search(q, {
        quotesCount: 12,
        newsCount: 0,
      });

      remote = (searchResult?.quotes || [])
        .map((item) => ({
          symbol: item.symbol,
          name: item.shortname || item.longname || item.symbol,
          exchange: item.exchange || item.exchDisp || "Market",
          source: "yahoo",
        }))
        .filter((item) => Boolean(item.symbol));
    } catch (err) {
      console.error("Ticker suggestion fallback to curated:", err.message);
    }

    const combined = [...curated, ...remote];
    const unique = [];
    const seen = new Set();
    for (const item of combined) {
      const key = String(item.symbol).toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }

    res.json(unique.slice(0, 10));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mencari ticker" });
  }
});

app.get("/api/debts", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.*, w.name AS wallet_name
       FROM debts d
       LEFT JOIN wallets w ON w.id = d.wallet_id
       WHERE d.user_id = 1
       ORDER BY d.created_at DESC, d.id DESC`,
    );

    res.json(rows.map(normalizeDebtRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/debts/installments", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT di.id, di.debt_id, d.name AS debt_name, di.amount, di.paid_at as date, di.notes
       FROM debt_installments di
       INNER JOIN debts d ON d.id = di.debt_id
       WHERE di.user_id = 1
       ORDER BY di.paid_at DESC, di.id DESC`,
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        debtId: row.debt_id,
        debtName: row.debt_name,
        amount: Number(row.amount) || 0,
        date: row.date,
        notes: row.notes || "",
      })),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/debts", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      name,
      type,
      debtType,
      principal,
      annualInterestRate,
      interestRate,
      tenorMonths,
      startDate,
      walletId,
      notes,
      elapsedMonths = 0,
    } = req.body;

    const cleanName = String(name || "").trim();
    const debtTypeValue = String(debtType || type || "other");
    const principalValue = Number(principal);
    const interestRateValue = Number(interestRate ?? annualInterestRate ?? 0);
    const tenorMonthsValue = Number(tenorMonths);
    const elapsedMonthsValue = Number(elapsedMonths || 0);
    const startDateValue = startDate
      ? toDateOnly(startDate)
      : toDateOnly(new Date());
    const walletIdValue = walletId ? Number(walletId) : null;

    if (!cleanName) {
      return res.status(400).json({ error: "Nama hutang wajib diisi" });
    }
    if (!Number.isFinite(principalValue) || principalValue <= 0) {
      return res.status(400).json({ error: "Pokok hutang tidak valid" });
    }
    if (!Number.isFinite(tenorMonthsValue) || tenorMonthsValue <= 0) {
      return res.status(400).json({ error: "Tenor tidak valid" });
    }
    if (!Number.isFinite(interestRateValue) || interestRateValue < 0) {
      return res.status(400).json({ error: "Bunga tidak valid" });
    }

    const snapshot = calculateDebtSnapshot(
      principalValue,
      interestRateValue,
      tenorMonthsValue,
      elapsedMonthsValue,
    );

    await connection.beginTransaction();

    if (walletIdValue) {
      const [walletRows] = await connection.query(
        `SELECT id FROM wallets WHERE id = ? AND user_id = 1 LIMIT 1`,
        [walletIdValue],
      );

      if (walletRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "Dompet tidak ditemukan" });
      }
    }

    const [insertResult] = await connection.query(
      `INSERT INTO debts (
        user_id, name, type, principal, annual_interest_rate, tenor_months,
        monthly_payment, paid_amount, remaining_amount, elapsed_months, status,
        start_date, wallet_id, notes
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanName,
        debtTypeValue,
        principalValue,
        interestRateValue,
        tenorMonthsValue,
        snapshot.monthlyPayment,
        snapshot.paidAmount,
        snapshot.remainingAmount,
        snapshot.paidMonths,
        snapshot.status,
        startDateValue,
        walletIdValue,
        notes ? String(notes).trim() : null,
      ],
    );

    const debtId = insertResult.insertId;
    const installmentRows = [];

    for (let index = 0; index < snapshot.paidMonths; index += 1) {
      const isLast = index === snapshot.paidMonths - 1;
      const priorPaid = snapshot.monthlyPayment * index;
      const amount = isLast
        ? roundMoney(Math.max(0, snapshot.paidAmount - priorPaid))
        : snapshot.monthlyPayment;

      if (amount <= 0) continue;

      installmentRows.push([
        debtId,
        1,
        amount,
        addMonthsToDate(startDateValue, index + 1),
        `Cicilan ${index + 1}`,
      ]);
    }

    if (installmentRows.length > 0) {
      await connection.query(
        `INSERT INTO debt_installments (debt_id, user_id, amount, paid_at, notes) VALUES ?`,
        [installmentRows],
      );
    }

    await connection.commit();

    const [createdRows] = await db.query(
      `SELECT d.*, w.name AS wallet_name
       FROM debts d
       LEFT JOIN wallets w ON w.id = d.wallet_id
       WHERE d.id = ? AND d.user_id = 1 LIMIT 1`,
      [debtId],
    );

    res.json({
      success: true,
      debt: normalizeDebtRow(createdRows[0]),
      installmentsCreated: installmentRows.length,
    });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    connection.release();
  }
});

app.delete("/api/debts/:id", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const debtId = Number(req.params.id);
    if (!debtId) {
      return res.status(400).json({ error: "ID hutang tidak valid" });
    }

    await connection.beginTransaction();

    const [debtRows] = await connection.query(
      `SELECT id FROM debts WHERE id = ? AND user_id = 1 LIMIT 1`,
      [debtId],
    );

    if (debtRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Hutang tidak ditemukan" });
    }

    await connection.query(`DELETE FROM debts WHERE id = ? AND user_id = 1`, [
      debtId,
    ]);
    await connection.commit();

    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    connection.release();
  }
});

// --- ASSET TRACKER API ---

app.get("/api/assets", async (req, res) => {
  try {
    const forceRefresh = req.query.force === "1";
    const [rows] = await db.query(`
      SELECT a.*, 
      (SELECT SUM(amount) FROM transactions WHERE asset_id = a.id AND type = 'income') as total_yield
      FROM assets a WHERE a.user_id = 1 ORDER BY a.created_at DESC
    `);

    // Proses harga real-time untuk aset tipe 'market'
    const processedAssets = await Promise.all(
      rows.map(async (asset) => {
        if (asset.type === "market" && asset.ticker) {
          try {
            const { unitPriceIdr, priceSource, priceUpdatedAt } =
              await getMarketQuoteInIdr(asset.ticker, { forceRefresh });

            return {
              ...asset,
              current_unit_price: unitPriceIdr,
              current_value: unitPriceIdr * Number(asset.quantity),
              price_source: priceSource,
              price_updated_at: priceUpdatedAt,
            };
          } catch (err) {
            console.error(`Gagal fetch ticker ${asset.ticker}:`, err.message);
            return {
              ...asset,
              current_unit_price: Number(asset.purchase_price) || 0,
              current_value:
                Number(asset.purchase_price) * Number(asset.quantity),
              price_source: "purchase-fallback",
              price_updated_at: null,
            };
          }
        }
        return {
          ...asset,
          price_source: "manual",
          price_updated_at: null,
        };
      }),
    );

    res.json(processedAssets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/assets", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      ticker,
      name,
      quantity,
      purchase_price,
      total_value,
      broker,
      unit_type,
      wallet_id,
      transaction_date,
    } = req.body;
    const finalTxDate =
      transaction_date || new Date().toISOString().split("T")[0];
    const normalizedTicker =
      typeof ticker === "string" ? ticker.trim().toUpperCase() : "";
    let inferredType = normalizedTicker ? "market" : "custom";

    // Validasi ticker jika user mengisi ticker (mode otomatis jadi market)
    let finalTicker = normalizedTicker || null;

    if (finalTicker) {
      try {
        // --- LOGIKA CERDAS: Auto-Correction Ticker ---
        let quote = null;
        const attempts = [
          finalTicker, // Asli (misal: BTC-USD atau BBCA.JK)
          `${finalTicker}-USD`, // Jika itu Crypto (BTC -> BTC-USD)
          `${finalTicker}.JK`, // Jika itu Saham Indo (BBCA -> BBCA.JK)
        ];

        let found = false;
        for (const t of attempts) {
          try {
            quote = await yahooFinance.quote(t);
            if (quote) {
              finalTicker = t; // Gunakan yang berhasil ditemukan
              found = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (!found) {
          return res.status(400).json({
            error: `Ticker '${finalTicker}' tidak ditemukan di pasar Global maupun Lokal.`,
          });
        }
      } catch (e) {
        return res
          .status(400)
          .json({ error: "Terjadi kesalahan sistem saat memvalidasi ticker." });
      }
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO assets (user_id, type, ticker, name, quantity, purchase_price, total_value, broker, unit_type, wallet_id, transaction_date) 
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inferredType,
        finalTicker,
        name || finalTicker,
        quantity,
        purchase_price,
        total_value,
        broker,
        unit_type,
        wallet_id,
        finalTxDate,
      ],
    );

    const assetId = result.insertId;

    // LOGIKA OTOMATIS: Potong Saldo Dompet jika wallet_id dipilih
    if (wallet_id) {
      const amountToDeduct =
        inferredType === "market"
          ? Number(purchase_price) * Number(quantity)
          : Number(total_value);

      // 1. Masukkan ke tabel Transaksi sebagai Pengeluaran Investasi (Diberi tag asset_id)
      await connection.query(
        `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, transaction_date, asset_id) 
         VALUES (1, ?, 'expense', ?, 'Investasi', ?, ?, ?)`,
        [
          wallet_id,
          amountToDeduct,
          `Pembelian Aset: ${name || ticker}`,
          finalTxDate,
          assetId,
        ],
      );

      // 2. Update Saldo Dompet
      await connection.query(
        `UPDATE wallets SET balance = balance - ? WHERE id = ?`,
        [amountToDeduct, wallet_id],
      );
    }

    await connection.commit();

    res.json({ success: true, id: assetId });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    connection.release();
  }
});

app.post("/api/assets/yield", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { asset_id, wallet_id, amount, description, transaction_date } =
      req.body;
    const finalDate =
      transaction_date || new Date().toISOString().split("T")[0];
    const amountNum = Number(amount);

    if (
      !asset_id ||
      !wallet_id ||
      !Number.isFinite(amountNum) ||
      amountNum <= 0
    ) {
      return res
        .status(400)
        .json({ error: "Input hasil investasi tidak valid" });
    }

    await connection.beginTransaction();

    // 1. Masukkan ke tabel Transaksi sebagai Pendapatan Aset
    await connection.query(
      `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, transaction_date, asset_id) 
       VALUES (1, ?, 'income', ?, 'Hasil Investasi', ?, ?, ?)`,
      [
        wallet_id,
        amountNum,
        description || "Hasil berkala dari aset",
        finalDate,
        asset_id,
      ],
    );

    // 2. Tambah Saldo Dompet
    await connection.query(
      `UPDATE wallets SET balance = balance + ? WHERE id = ?`,
      [amountNum, wallet_id],
    );

    await connection.commit();

    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    connection.release();
  }
});

app.delete("/api/assets/:id", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const assetId = Number(id);

    if (!assetId) {
      return res.status(400).json({ error: "ID aset tidak valid" });
    }

    await connection.beginTransaction();

    const [assetRows] = await connection.query(
      `SELECT id FROM assets WHERE id = ? AND user_id = 1 LIMIT 1`,
      [assetId],
    );

    if (assetRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Aset tidak ditemukan" });
    }

    // Balikkan efek transaksi aset ke saldo dompet agar dashboard tetap sinkron.
    const [walletAdjustments] = await connection.query(
      `SELECT wallet_id,
              SUM(CASE WHEN type = 'expense' THEN amount WHEN type = 'income' THEN -amount ELSE 0 END) AS reverse_delta
         FROM transactions
        WHERE user_id = 1 AND asset_id = ?
        GROUP BY wallet_id`,
      [assetId],
    );

    for (const row of walletAdjustments) {
      const walletId = Number(row.wallet_id);
      const reverseDelta = Number(row.reverse_delta) || 0;
      if (!walletId || reverseDelta === 0) continue;

      await connection.query(
        `UPDATE wallets SET balance = balance + ? WHERE id = ?`,
        [reverseDelta, walletId],
      );
    }

    await connection.query(
      `DELETE FROM transactions WHERE user_id = 1 AND asset_id = ?`,
      [assetId],
    );

    await connection.query(`DELETE FROM assets WHERE id = ? AND user_id = 1`, [
      assetId,
    ]);

    await connection.commit();

    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Database error" });
  } finally {
    connection.release();
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
