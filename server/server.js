const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { body, param, validationResult } = require("express-validator");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

const db = require("./db");
// Initialize Telegram Bot & AI Listener alongside Express
const { sendTelegramMessage } = require("./bot");

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

function toStartOfDay(dateValue) {
  return new Date(`${toDateOnly(dateValue)}T00:00:00`);
}

function getDayDiff(targetDate, referenceDate = new Date()) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const target = toStartOfDay(targetDate);
  const reference = toStartOfDay(referenceDate);
  return Math.round((target.getTime() - reference.getTime()) / msPerDay);
}

function buildReminderMeta(dueDate, today = new Date()) {
  const daysUntilDue = getDayDiff(dueDate, today);

  if (daysUntilDue === 7 || daysUntilDue === 3 || daysUntilDue === 1) {
    return {
      reminderType: `DUE_${daysUntilDue}`,
      reminderKey: `due-${toDateOnly(dueDate)}-h${daysUntilDue}`,
      urgencyLabel: `H-${daysUntilDue}`,
    };
  }

  if (daysUntilDue === 0) {
    return {
      reminderType: "DUE_TODAY",
      reminderKey: `due-${toDateOnly(dueDate)}-today`,
      urgencyLabel: "Hari ini",
    };
  }

  if (daysUntilDue < 0) {
    const overdueDays = Math.abs(daysUntilDue);
    if (overdueDays === 1 || overdueDays % 7 === 0) {
      return {
        reminderType: "OVERDUE",
        reminderKey: `overdue-${toDateOnly(dueDate)}-d${overdueDays}`,
        urgencyLabel: `Terlambat ${overdueDays} hari`,
      };
    }
  }

  return null;
}

function formatReminderMessage(debt, dueDate, meta) {
  const monthlyPayment = Number(debt.monthly_payment) || 0;
  const remainingAmount = Number(debt.remaining_amount) || 0;

  return [
    "*Pengingat Cicilan*",
    "",
    `Nama: *${debt.name}*`,
    `Status: ${meta.urgencyLabel}`,
    `Jatuh tempo: ${toDateOnly(dueDate)}`,
    `Cicilan/bulan: Rp ${monthlyPayment.toLocaleString("id-ID")}`,
    `Sisa hutang: Rp ${remainingAmount.toLocaleString("id-ID")}`,
  ].join("\n");
}

async function sendDebtReminders(options = {}) {
  const { source = "scheduler" } = options;
  const envChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  let chatId = envChatId || "";

  if (!chatId) {
    const [userRows] = await db.query(
      `SELECT telegram_id FROM users WHERE id = 1 LIMIT 1`,
    );
    chatId = String(userRows[0]?.telegram_id || "").trim();
  }

  if (!chatId) {
    console.warn("[reminder] skip: TELEGRAM_CHAT_ID/telegram_id belum diatur");
    return {
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      reason: "missing_chat_id",
      source,
    };
  }

  const [rows] = await db.query(
    `SELECT id, user_id, name, monthly_payment, remaining_amount, start_date, elapsed_months, tenor_months
     FROM debts
     WHERE user_id = 1 AND status = 'active'`,
  );

  let attempted = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (const debt of rows) {
    const nextInstallment = Number(debt.elapsed_months || 0) + 1;
    const tenorMonths = Number(debt.tenor_months || 0);

    if (tenorMonths <= 0 || nextInstallment > tenorMonths) {
      skipped += 1;
      continue;
    }

    const dueDate = shiftMonths(debt.start_date, nextInstallment);
    const reminderMeta = buildReminderMeta(dueDate, new Date());

    if (!reminderMeta) {
      skipped += 1;
      continue;
    }

    attempted += 1;

    const [existingRows] = await db.query(
      `SELECT id FROM debt_reminder_logs
       WHERE user_id = ? AND debt_id = ? AND reminder_key = ?
       LIMIT 1`,
      [debt.user_id, debt.id, reminderMeta.reminderKey],
    );

    if (existingRows.length > 0) {
      skipped += 1;
      continue;
    }

    const message = formatReminderMessage(debt, dueDate, reminderMeta);

    try {
      await sendTelegramMessage(message, { chatId, parseMode: "Markdown" });

      await db.query(
        `INSERT INTO debt_reminder_logs (debt_id, user_id, reminder_type, reminder_key, due_date)
         VALUES (?, ?, ?, ?, ?)`,
        [
          debt.id,
          debt.user_id,
          reminderMeta.reminderType,
          reminderMeta.reminderKey,
          toDateOnly(dueDate),
        ],
      );

      sent += 1;
    } catch (err) {
      failed += 1;
      if (errors.length < 3) {
        errors.push(`debt:${debt.id} ${err.message}`);
      }
      console.error(
        `[reminder] gagal kirim untuk debt ${debt.id} via ${source}:`,
        err.message,
      );
    }
  }

  return {
    attempted,
    sent,
    skipped,
    failed,
    reason: failed > 0 ? "partial_error" : "ok",
    source,
    errors,
  };
}

let reminderJobRunning = false;
let reminderTableReady = false;

async function ensureReminderTable() {
  if (reminderTableReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS debt_reminder_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      debt_id INT NOT NULL,
      user_id INT NOT NULL,
      reminder_type VARCHAR(60) NOT NULL,
      reminder_key VARCHAR(120) NOT NULL,
      due_date DATE NOT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uniq_debt_reminder_key (user_id, debt_id, reminder_key),
      INDEX idx_debt_reminder_due_date (due_date),
      INDEX idx_debt_reminder_sent_at (sent_at)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS debt_reminder_job_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(80) NOT NULL,
      attempted INT NOT NULL DEFAULT 0,
      sent INT NOT NULL DEFAULT 0,
      skipped INT NOT NULL DEFAULT 0,
      failed INT NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'ok',
      note VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_debt_reminder_job_logs_created_at (created_at),
      INDEX idx_debt_reminder_job_logs_source (source)
    )
  `);

  reminderTableReady = true;
}

async function writeReminderJobLog(result, note = null) {
  await db.query(
    `INSERT INTO debt_reminder_job_logs (source, attempted, sent, skipped, failed, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      result.source || "scheduler",
      Number(result.attempted) || 0,
      Number(result.sent) || 0,
      Number(result.skipped) || 0,
      Number(result.failed) || 0,
      result.reason || "ok",
      note,
    ],
  );
}

async function runReminderJob(source = "scheduler") {
  if (reminderJobRunning) {
    return;
  }

  reminderJobRunning = true;
  try {
    await ensureReminderTable();
    const result = await sendDebtReminders({ source });
    await writeReminderJobLog(
      result,
      Array.isArray(result.errors) && result.errors.length > 0
        ? result.errors.join(" | ")
        : null,
    );
    console.log(
      `[reminder] ${source} done | attempted=${result.attempted} sent=${result.sent} skipped=${result.skipped} failed=${result.failed || 0}`,
    );
  } catch (err) {
    await writeReminderJobLog(
      {
        source,
        attempted: 0,
        sent: 0,
        skipped: 0,
        failed: 1,
        reason: "job_failed",
      },
      err.message,
    );
    console.error(`[reminder] ${source} failed:`, err.message);
  } finally {
    reminderJobRunning = false;
  }
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
app.use(express.json({ limit: "10mb" })); // Prevent DoS via large payloads

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120,
  // Read traffic can be bursty on dashboard; write routes are protected by strictLimiter.
  skip: (req) => req.method === "GET" || req.method === "OPTIONS",
  message: { error: "Terlalu banyak request, coba lagi nanti" },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // stricter limit for sensitive operations
  message: { error: "Terlalu banyak request, coba lagi nanti" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter); // Apply default rate limit to all routes

// Validation middleware to handle validation results
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validasi input gagal",
      details: errors.array().map((e) => ({ field: e.param, message: e.msg })),
    });
  }
  next();
};

// User authentication is hardcoded to user_id = 1 for now

function handleApiError(req, res, err, message = "Database error") {
  console.error(`[${req.method} ${req.path}]`, err);
  return res.status(500).json({ error: message });
}

function maskTelegramId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length <= 4) return raw;
  return `${raw.slice(0, 2)}${"*".repeat(Math.max(1, raw.length - 4))}${raw.slice(-2)}`;
}

async function ensureUserSettingsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      monthly_budget DECIMAL(15,2) NOT NULL DEFAULT 0,
      annual_investment_target DECIMAL(15,2) NOT NULL DEFAULT 0,
      language VARCHAR(10) NOT NULL DEFAULT 'id',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

async function ensureAiPendingTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_pending_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      payload JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ai_pending_user_created_at (user_id, created_at)
    )
  `);
}

function normalizeWalletText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreByRecentUsage(usageCount) {
  const capped = Math.max(0, Math.min(5, Number(usageCount) || 0));
  return (capped / 5) * 0.2;
}

async function getWalletCandidates(userId, payload) {
  const amount = Number(payload?.amount || 0);
  const type = payload?.type === "income" ? "income" : "expense";
  const walletHint = normalizeWalletText(payload?.wallet_name);
  const description = normalizeWalletText(payload?.description);
  const category = String(payload?.category || "").trim();

  const [walletRows] = await db.query(
    `SELECT id, name, balance FROM wallets WHERE user_id = ? AND is_active = 1`,
    [userId],
  );

  if (!walletRows.length) return [];

  const [recentRows] = await db.query(
    `SELECT wallet_id, COUNT(*) as cnt
       FROM transactions
      WHERE user_id = ?
        AND category = ?
      GROUP BY wallet_id`,
    [userId, category],
  );
  const recentMap = new Map(
    recentRows.map((r) => [Number(r.wallet_id), Number(r.cnt)]),
  );

  const candidates = walletRows.map((wallet) => {
    const nameNorm = normalizeWalletText(wallet.name);
    let score = 0.1;
    let reason = "base";

    if (walletHint && nameNorm === walletHint) {
      score += 0.7;
      reason = "exact_wallet_name_match";
    } else if (
      walletHint &&
      (nameNorm.includes(walletHint) || walletHint.includes(nameNorm))
    ) {
      score += 0.5;
      reason = "partial_wallet_name_match";
    }

    if (description && nameNorm && description.includes(nameNorm)) {
      score += 0.45;
      reason =
        reason === "base"
          ? "wallet_mentioned_in_description"
          : `${reason}+wallet_mentioned_in_description`;
    }

    score += scoreByRecentUsage(recentMap.get(Number(wallet.id)));

    if (type === "expense" && Number(wallet.balance) >= amount && amount > 0) {
      score += 0.15;
      reason =
        reason === "base"
          ? "sufficient_balance"
          : `${reason}+sufficient_balance`;
    }

    if (type === "income") {
      score += 0.05;
    }

    return {
      id: Number(wallet.id),
      name: wallet.name,
      balance: Number(wallet.balance) || 0,
      confidence: Math.min(0.99, Number(score.toFixed(2))),
      reason,
    };
  });

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

async function chooseWalletByLlm(payload, candidates) {
  const key = String(process.env.GEMINI_API_KEY || "").trim();
  if (!key || !candidates.length) return null;

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = [
    "Pilih SATU dompet terbaik untuk transaksi ini dari daftar kandidat.",
    "Jawab JSON murni tanpa markdown dengan format:",
    '{"walletId": number|null, "confidence": number, "reason": "short reason"}',
    "Jika tidak yakin pilih null untuk walletId.",
    `payload: ${JSON.stringify(payload)}`,
    `candidates: ${JSON.stringify(candidates.map((c) => ({ id: c.id, name: c.name, balance: c.balance, confidence: c.confidence })))}`,
  ].join("\n");

  try {
    const result = await model.generateContent([prompt]);
    const raw = String(result.response.text() || "")
      .replace(/```json|```/g, "")
      .trim();
    const parsed = JSON.parse(raw);
    const walletId = Number(parsed?.walletId || 0) || null;

    if (!walletId) return null;
    const chosen = candidates.find((c) => c.id === walletId);
    if (!chosen) return null;

    return {
      walletId,
      confidence: Math.max(
        0,
        Math.min(0.99, Number(parsed?.confidence || chosen.confidence || 0)),
      ),
      reason: String(parsed?.reason || "llm_selected").slice(0, 200),
    };
  } catch (err) {
    console.warn("[ai/assign-wallet] LLM fallback gagal:", err.message);
    return null;
  }
}

function normalizeTransactionPayload(payload) {
  const type = payload?.type === "income" ? "income" : "expense";
  const amount = Number(payload?.amount || 0);
  const category = String(payload?.category || "Lainnya").trim() || "Lainnya";
  const description = String(payload?.description || "").trim();
  const dateCandidate = String(payload?.date || "").trim();
  const isDateValid = /^\d{4}-\d{2}-\d{2}$/.test(dateCandidate);
  const transactionDate = isDateValid
    ? dateCandidate
    : new Date().toISOString().slice(0, 10);
  const walletName = String(payload?.wallet_name || "").trim();

  return {
    type,
    amount,
    category,
    description,
    date: transactionDate,
    wallet_name: walletName,
  };
}

async function applyTransactionToWallet(userId, walletId, payload) {
  const normalized = normalizeTransactionPayload(payload);
  if (!normalized.amount || normalized.amount <= 0) {
    throw new Error("amount tidak valid");
  }

  const [result] = await db.query(
    `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, transaction_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      walletId,
      normalized.type,
      normalized.amount,
      normalized.category,
      normalized.description,
      normalized.date,
    ],
  );

  await db.query(
    normalized.type === "expense"
      ? "UPDATE wallets SET balance = balance - ? WHERE id = ?"
      : "UPDATE wallets SET balance = balance + ? WHERE id = ?",
    [normalized.amount, walletId],
  );

  return result.insertId;
}

async function ensureAiAssignmentLogsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_assignment_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      transaction_id INT,
      pending_assignment_id INT,
      method VARCHAR(50) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      category VARCHAR(100),
      description TEXT,
      chosen_wallet_id INT,
      confidence DECIMAL(5,4) NOT NULL DEFAULT 0,
      reason VARCHAR(255),
      candidates JSON,
      source VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_ai_assignment_logs_user (user_id),
      INDEX idx_ai_assignment_logs_created_at (created_at),
      INDEX idx_ai_assignment_logs_method (method)
    )
  `);
}

async function logAssignmentDecision(logEntry) {
  await ensureAiAssignmentLogsTable();
  const {
    userId = 1,
    transactionId = null,
    pendingAssignmentId = null,
    method = "unknown",
    amount = 0,
    category = "",
    description = "",
    chosenWalletId = null,
    confidence = 0,
    reason = "",
    candidates = null,
    source = "api",
  } = logEntry;

  await db.query(
    `INSERT INTO ai_assignment_logs 
     (user_id, transaction_id, pending_assignment_id, method, amount, category, description, 
      chosen_wallet_id, confidence, reason, candidates, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      transactionId,
      pendingAssignmentId,
      method,
      amount,
      category,
      description,
      chosenWalletId,
      confidence,
      reason,
      candidates ? JSON.stringify(candidates) : null,
      source,
    ],
  );
}

// External endpoint to assign wallet for an AI-parsed transaction (used by webhooks or UI)
app.post(
  "/api/ai/assign-wallet",
  strictLimiter,
  body("payload").isObject().withMessage("payload harus object"),
  body("payload.amount")
    .isFloat({ gt: 0 })
    .withMessage("payload.amount wajib lebih dari 0"),
  body("payload.type")
    .isIn(["income", "expense"])
    .withMessage("payload.type harus income atau expense"),
  validateRequest,
  async (req, res) => {
    try {
      const userId = 1; // single-user mode for now
      const payload = normalizeTransactionPayload(req.body.payload || {});
      const chosenWalletId = Number(req.body.chosenWalletId || 0) || null;

      await ensureAiPendingTable();

      // If chosenWalletId provided, apply immediately
      if (chosenWalletId) {
        const transactionId = await applyTransactionToWallet(
          userId,
          chosenWalletId,
          payload,
        );
        await logAssignmentDecision({
          userId,
          transactionId,
          method: "manual_override",
          amount: payload.amount,
          category: payload.category,
          description: payload.description,
          chosenWalletId,
          confidence: 1.0,
          reason: "user_manual_choice",
          source: "api",
        });
        return res.json({
          success: true,
          assigned: true,
          method: "manual_override",
          walletId: chosenWalletId,
          transactionId,
        });
      }

      const candidates = await getWalletCandidates(userId, payload);

      // Deterministic path first
      if (candidates.length === 1) {
        const transactionId = await applyTransactionToWallet(
          userId,
          candidates[0].id,
          payload,
        );
        await logAssignmentDecision({
          userId,
          transactionId,
          method: "deterministic_single_wallet",
          amount: payload.amount,
          category: payload.category,
          description: payload.description,
          chosenWalletId: candidates[0].id,
          confidence: candidates[0].confidence,
          reason: candidates[0].reason,
          candidates: [candidates[0]],
          source: "api",
        });
        return res.json({
          success: true,
          assigned: true,
          method: "deterministic_single_wallet",
          walletId: candidates[0].id,
          confidence: candidates[0].confidence,
          transactionId,
          candidates,
        });
      }

      const top = candidates[0];
      if (top && top.confidence >= 0.8) {
        const transactionId = await applyTransactionToWallet(
          userId,
          top.id,
          payload,
        );
        await logAssignmentDecision({
          userId,
          transactionId,
          method: "deterministic_scored",
          amount: payload.amount,
          category: payload.category,
          description: payload.description,
          chosenWalletId: top.id,
          confidence: top.confidence,
          reason: top.reason,
          candidates: candidates.slice(0, 5),
          source: "api",
        });
        return res.json({
          success: true,
          assigned: true,
          method: "deterministic_scored",
          walletId: top.id,
          confidence: top.confidence,
          reason: top.reason,
          transactionId,
          candidates,
        });
      }

      // LLM fallback if deterministic confidence is not enough
      const llmPick = await chooseWalletByLlm(payload, candidates.slice(0, 5));
      if (llmPick && llmPick.confidence >= 0.75) {
        const transactionId = await applyTransactionToWallet(
          userId,
          llmPick.walletId,
          payload,
        );
        await logAssignmentDecision({
          userId,
          transactionId,
          method: "llm_fallback",
          amount: payload.amount,
          category: payload.category,
          description: payload.description,
          chosenWalletId: llmPick.walletId,
          confidence: llmPick.confidence,
          reason: llmPick.reason,
          candidates: candidates.slice(0, 5),
          source: "api",
        });
        return res.json({
          success: true,
          assigned: true,
          method: "llm_fallback",
          walletId: llmPick.walletId,
          confidence: llmPick.confidence,
          reason: llmPick.reason,
          transactionId,
          candidates,
        });
      }

      // If still uncertain, store pending assignment
      const pendingPayload = {
        ...payload,
        assignment: {
          method: "pending_review",
          candidates: candidates.slice(0, 5),
          llmPick,
        },
      };
      const [result] = await db.query(
        `INSERT INTO ai_pending_assignments (user_id, payload) VALUES (?, ?)`,
        [userId, JSON.stringify(pendingPayload)],
      );
      const pendingId = result.insertId;

      await logAssignmentDecision({
        userId,
        pendingAssignmentId: pendingId,
        method: "pending_review",
        amount: payload.amount,
        category: payload.category,
        description: payload.description,
        chosenWalletId: null,
        confidence: top?.confidence || 0,
        reason: "insufficient_confidence_for_automatic_assignment",
        candidates: candidates.slice(0, 5),
        source: "api",
      });

      return res.json({
        success: true,
        assigned: false,
        pendingId,
        method: "pending_review",
        candidates: candidates.slice(0, 5),
      });
    } catch (err) {
      return handleApiError(req, res, err, "Gagal assign dompet (AI)");
    }
  },
);

app.get("/api/ai/assignment-logs", async (req, res) => {
  try {
    const userId = 1;
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const offset = Math.max(0, Number(req.query.offset) || 0);

    await ensureAiAssignmentLogsTable();

    const [logs] = await db.query(
      `SELECT id, method, amount, category, description, chosen_wallet_id, confidence, reason, 
              candidates, source, created_at
       FROM ai_assignment_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );

    const [totalRows] = await db.query(
      `SELECT COUNT(*) as total FROM ai_assignment_logs WHERE user_id = ?`,
      [userId],
    );

    const total = totalRows[0]?.total || 0;

    res.json({
      success: true,
      logs: (logs || []).map((log) => ({
        id: log.id,
        method: log.method,
        amount: log.amount,
        category: log.category,
        description: log.description,
        chosenWalletId: log.chosen_wallet_id,
        confidence: Number(log.confidence),
        reason: log.reason,
        candidates: log.candidates ? JSON.parse(log.candidates) : [],
        source: log.source,
        createdAt: log.created_at,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    return handleApiError(req, res, err, "Gagal fetch assignment logs");
  }
});

async function getOrCreateUserSettings(userId = 1) {
  await ensureUserSettingsTable();
  await db.query(
    `INSERT INTO user_settings (user_id) VALUES (?)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [userId],
  );
  const [rows] = await db.query(
    `SELECT monthly_budget, annual_investment_target, language
     FROM user_settings WHERE user_id = ? LIMIT 1`,
    [userId],
  );
  return (
    rows[0] || {
      monthly_budget: 0,
      annual_investment_target: 0,
      language: "id",
    }
  );
}

app.get("/api/settings/overview", async (req, res) => {
  try {
    const [userRows] = await db.query(
      `SELECT id, name, email, telegram_id FROM users WHERE id = 1 LIMIT 1`,
    );
    const user = userRows[0] || {
      id: 1,
      name: "User",
      email: "",
      telegram_id: null,
    };

    const settings = await getOrCreateUserSettings(1);
    const envBotUsername = String(process.env.TELEGRAM_BOT_USERNAME || "")
      .trim()
      .replace(/^@/, "");
    const botLink = envBotUsername
      ? `https://t.me/${envBotUsername}?start=connect_autofint`
      : null;

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      telegram: {
        connected: Boolean(user.telegram_id),
        chatIdMasked: maskTelegramId(user.telegram_id),
        botUsername: envBotUsername || null,
        botLink,
      },
      preferences: {
        monthlyBudget: Number(settings.monthly_budget) || 0,
        annualTarget: Number(settings.annual_investment_target) || 0,
        language: settings.language || "id",
      },
    });
  } catch (err) {
    return handleApiError(req, res, err, "Gagal memuat pengaturan");
  }
});

app.post(
  "/api/settings/account",
  strictLimiter,
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Nama wajib diisi")
    .isLength({ max: 100 })
    .withMessage("Nama maksimal 100 karakter"),
  validateRequest,
  async (req, res) => {
    try {
      const name = String(req.body.name || "").trim();
      await db.query(`UPDATE users SET name = ? WHERE id = 1`, [name]);
      return res.json({ success: true });
    } catch (err) {
      return handleApiError(req, res, err, "Gagal menyimpan profil");
    }
  },
);

app.post(
  "/api/settings/budget",
  strictLimiter,
  body("monthlyBudget")
    .isFloat({ min: 0 })
    .withMessage("Budget bulanan tidak valid"),
  validateRequest,
  async (req, res) => {
    try {
      const monthlyBudget = Number(req.body.monthlyBudget || 0);
      await ensureUserSettingsTable();
      await db.query(
        `INSERT INTO user_settings (user_id, monthly_budget)
         VALUES (1, ?)
         ON DUPLICATE KEY UPDATE monthly_budget = VALUES(monthly_budget)`,
        [monthlyBudget],
      );
      return res.json({ success: true });
    } catch (err) {
      return handleApiError(req, res, err, "Gagal menyimpan budget");
    }
  },
);

app.post(
  "/api/settings/target",
  strictLimiter,
  body("annualTarget")
    .isFloat({ min: 0 })
    .withMessage("Target investasi tidak valid"),
  validateRequest,
  async (req, res) => {
    try {
      const annualTarget = Number(req.body.annualTarget || 0);
      await ensureUserSettingsTable();
      await db.query(
        `INSERT INTO user_settings (user_id, annual_investment_target)
         VALUES (1, ?)
         ON DUPLICATE KEY UPDATE annual_investment_target = VALUES(annual_investment_target)`,
        [annualTarget],
      );
      return res.json({ success: true });
    } catch (err) {
      return handleApiError(req, res, err, "Gagal menyimpan target");
    }
  },
);

app.post(
  "/api/settings/language",
  strictLimiter,
  body("language")
    .trim()
    .isIn(["id", "en"])
    .withMessage("Bahasa tidak didukung"),
  validateRequest,
  async (req, res) => {
    try {
      const language = String(req.body.language || "id").trim();
      await ensureUserSettingsTable();
      await db.query(
        `INSERT INTO user_settings (user_id, language)
         VALUES (1, ?)
         ON DUPLICATE KEY UPDATE language = VALUES(language)`,
        [language],
      );
      return res.json({ success: true });
    } catch (err) {
      return handleApiError(req, res, err, "Gagal menyimpan bahasa");
    }
  },
);

app.post("/api/settings/telegram/test", strictLimiter, async (req, res) => {
  try {
    const [userRows] = await db.query(
      `SELECT telegram_id FROM users WHERE id = 1 LIMIT 1`,
    );
    const dbChatId = String(userRows[0]?.telegram_id || "").trim();
    const envChatId = String(process.env.TELEGRAM_CHAT_ID || "").trim();
    const chatId = dbChatId || envChatId;

    if (!chatId) {
      return res.status(400).json({
        error:
          "Telegram belum terhubung. Klik Hubungkan Telegram lalu kirim /start ke bot.",
      });
    }

    await sendTelegramMessage(
      "✅ *Koneksi Telegram berhasil*\n\nBot sudah terhubung dengan akun AUTOFINT Anda.",
      { chatId, parseMode: "Markdown" },
    );

    return res.json({ success: true });
  } catch (err) {
    return handleApiError(req, res, err, "Gagal mengirim pesan test Telegram");
  }
});

app.post(
  "/api/settings/telegram/disconnect",
  strictLimiter,
  async (req, res) => {
    try {
      await db.query(`UPDATE users SET telegram_id = NULL WHERE id = 1`);
      return res.json({ success: true });
    } catch (err) {
      return handleApiError(req, res, err, "Gagal memutuskan Telegram");
    }
  },
);

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
    return handleApiError(req, res, err, "Database error");
  }
});

// Endpoint Khusus AI Dashboard Insight
app.get("/api/dashboard/ai-insight", async (req, res) => {
  try {
    res.json({
      insight:
        "Bang, insight cepat: jaga pengeluaran terbesar, pertahankan kas yang cukup, dan hindari porsi aset pasar yang terlalu dominan.",
    });
  } catch (err) {
    console.error("[DEBUG ai-insight]", {
      msg: err?.message,
      line: err?.stack?.split("\n")[0],
    });
    return handleApiError(req, res, err, "Gagal merumuskan insight AI");
  }
});

app.get("/api/wallets", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, balance FROM wallets WHERE user_id = 1 AND is_active = true`,
    );
    res.json(rows);
  } catch (err) {
    return handleApiError(req, res, err, "Database error");
  }
});

app.post(
  "/api/wallets",
  strictLimiter,
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Nama dompet wajib diisi")
    .isLength({ max: 100 })
    .withMessage("Nama dompet maksimal 100 karakter"),
  body("balance")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Saldo harus angka positif"),
  validateRequest,
  async (req, res) => {
    try {
      const { name, balance = 0 } = req.body;

      // Gunakan 1 sebagai ganti 'true' untuk kompatibilitas MySQL TINYINT
      const [result] = await db.query(
        `INSERT INTO wallets (user_id, name, balance, is_active) VALUES (1, ?, ?, 1)`,
        [name, balance],
      );

      res.json({ success: true, id: result.insertId });
    } catch (err) {
      return handleApiError(req, res, err, "Gagal di Database");
    }
  },
);

app.post(
  "/api/wallets/:id/delete",
  strictLimiter,
  param("id").isInt({ min: 1 }).withMessage("ID dompet tidak valid"),
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const walletId = parseInt(id);

      // Perintah DELETE permanen dari database
      const [result] = await db.query(
        `DELETE FROM wallets WHERE id = ? AND user_id = 1`,
        [walletId],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Dompet tidak ditemukan" });
      }

      res.json({ success: true });
    } catch (err) {
      return handleApiError(req, res, err, "Database error");
    }
  },
);

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
    return handleApiError(req, res, err, "Database error");
  }
});

app.post(
  "/api/transactions",
  strictLimiter,
  body("type")
    .trim()
    .isIn(["income", "expense"])
    .withMessage("Type harus 'income' atau 'expense'"),
  body("amount")
    .isFloat({ min: 0.01 })
    .withMessage("Amount harus angka positif"),
  body("wallet_id")
    .isInt({ min: 1 })
    .withMessage("Wallet ID harus angka positif"),
  body("category")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Category maksimal 50 karakter"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description maksimal 500 karakter"),
  body("transaction_date")
    .optional()
    .isISO8601()
    .withMessage("Format tanggal tidak valid"),
  validateRequest,
  async (req, res) => {
    const connection = await db.getConnection();
    try {
      const {
        type,
        amount,
        category,
        description,
        wallet_id,
        transaction_date,
      } = req.body;
      const amountNum = Number(amount);
      const walletIdNum = Number(wallet_id);

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
      return handleApiError(req, res, err, "Database error");
    } finally {
      connection.release();
    }
  },
);

app.delete(
  "/api/transactions/:id",
  strictLimiter,
  param("id").isInt({ min: 1 }).withMessage("ID transaksi tidak valid"),
  validateRequest,
  async (req, res) => {
    const connection = await db.getConnection();
    try {
      const { id } = req.params;
      const txId = Number(id);

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
      return handleApiError(req, res, err, "Database error");
    } finally {
      connection.release();
    }
  },
);

app.put(
  "/api/transactions/:id",
  strictLimiter,
  param("id").isInt({ min: 1 }).withMessage("ID transaksi tidak valid"),
  body("type")
    .trim()
    .isIn(["income", "expense"])
    .withMessage("Type harus 'income' atau 'expense'"),
  body("amount")
    .isFloat({ min: 0.01 })
    .withMessage("Amount harus angka positif"),
  body("wallet_id")
    .isInt({ min: 1 })
    .withMessage("Wallet ID harus angka positif"),
  body("category")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Category maksimal 50 karakter"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description maksimal 500 karakter"),
  body("transaction_date")
    .optional()
    .isISO8601()
    .withMessage("Format tanggal tidak valid"),
  validateRequest,
  async (req, res) => {
    const connection = await db.getConnection();
    try {
      const { id } = req.params;
      const {
        type,
        amount,
        category,
        description,
        wallet_id,
        transaction_date,
      } = req.body;
      const txId = Number(id);
      const walletIdNum = Number(wallet_id);
      const amountNum = Number(amount);

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
      const revertChange =
        oldTx.type === "income" ? -oldTx.amount : oldTx.amount;
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
      return handleApiError(req, res, err, "Database error");
    } finally {
      connection.release();
    }
  },
);

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
    return handleApiError(req, res, err, "Database error");
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
    return handleApiError(req, res, err, "Database error");
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
    return handleApiError(req, res, err, "Database error");
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
    return handleApiError(req, res, err, "Gagal mencari ticker");
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
    return handleApiError(req, res, err, "Database error");
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
    return handleApiError(req, res, err, "Database error");
  }
});

app.post(
  "/api/debts",
  strictLimiter,
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Nama hutang wajib diisi")
    .isLength({ max: 100 })
    .withMessage("Nama hutang maksimal 100 karakter"),
  body("principal")
    .isFloat({ min: 100 })
    .withMessage("Pokok hutang minimal 100"),
  body("tenorMonths").isInt({ min: 1 }).withMessage("Tenor harus positif"),
  body("annualInterestRate")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Bunga antara 0-100%"),
  body("interestRate")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Bunga antara 0-100%"),
  body("walletId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Wallet ID tidak valid"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes maksimal 500 karakter"),
  validateRequest,
  async (req, res) => {
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
      return handleApiError(req, res, err, "Database error");
    } finally {
      connection.release();
    }
  },
);

app.delete(
  "/api/debts/:id",
  strictLimiter,
  param("id").isInt({ min: 1 }).withMessage("ID hutang tidak valid"),
  validateRequest,
  async (req, res) => {
    const connection = await db.getConnection();
    try {
      const debtId = Number(req.params.id);

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
      return handleApiError(req, res, err, "Database error");
    } finally {
      connection.release();
    }
  },
);

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
    return handleApiError(req, res, err, "Database error");
  }
});

app.post(
  "/api/assets",
  strictLimiter,
  body("ticker")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Ticker maksimal 20 karakter"),
  body("name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Nama aset maksimal 100 karakter"),
  body("quantity")
    .isFloat({ min: 0.001 })
    .withMessage("Jumlah harus angka positif"),
  body("purchase_price")
    .isFloat({ min: 0 })
    .withMessage("Harga beli tidak boleh negatif"),
  body("total_value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Total nilai tidak boleh negatif"),
  body("wallet_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Wallet ID tidak valid"),
  body("transaction_date")
    .optional()
    .isISO8601()
    .withMessage("Format tanggal tidak valid"),
  validateRequest,
  async (req, res) => {
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
          return res.status(400).json({
            error: "Terjadi kesalahan sistem saat memvalidasi ticker.",
          });
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
      return handleApiError(req, res, err, "Database error");
    } finally {
      connection.release();
    }
  },
);

app.post(
  "/api/assets/yield",
  strictLimiter,
  body("asset_id")
    .isInt({ min: 1 })
    .withMessage("Asset ID harus angka positif"),
  body("wallet_id")
    .isInt({ min: 1 })
    .withMessage("Wallet ID harus angka positif"),
  body("amount")
    .isFloat({ min: 0.01 })
    .withMessage("Jumlah harus angka positif"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Deskripsi maksimal 500 karakter"),
  body("transaction_date")
    .optional()
    .isISO8601()
    .withMessage("Format tanggal tidak valid"),
  validateRequest,
  async (req, res) => {
    const connection = await db.getConnection();
    try {
      const { asset_id, wallet_id, amount, description, transaction_date } =
        req.body;
      const finalDate =
        transaction_date || new Date().toISOString().split("T")[0];
      const amountNum = Number(amount);

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
      return handleApiError(req, res, err, "Database error");
    } finally {
      connection.release();
    }
  },
);

app.delete(
  "/api/assets/:id",
  strictLimiter,
  param("id").isInt({ min: 1 }).withMessage("ID aset tidak valid"),
  validateRequest,
  async (req, res) => {
    const connection = await db.getConnection();
    try {
      const { id } = req.params;
      const assetId = Number(id);

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

      await connection.query(
        `DELETE FROM assets WHERE id = ? AND user_id = 1`,
        [assetId],
      );

      await connection.commit();

      res.json({ success: true });
    } catch (err) {
      await connection.rollback();
      return handleApiError(req, res, err, "Database error");
    } finally {
      connection.release();
    }
  },
);

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);

  // Kick off scheduler: initial run and then every hour.
  setTimeout(() => {
    runReminderJob("startup").catch((err) => {
      console.error("[reminder] startup job failed:", err.message);
    });
  }, 1000);

  setInterval(
    () => {
      runReminderJob("interval").catch((err) => {
        console.error("[reminder] interval job failed:", err.message);
      });
    },
    60 * 60 * 1000,
  );
});
