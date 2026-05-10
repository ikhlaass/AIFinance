const { Telegraf } = require("telegraf");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("./db");
require("dotenv").config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

async function sendTelegramMessage(text, options = {}) {
  if (!bot) {
    throw new Error(
      "Telegram bot belum dikonfigurasi (TELEGRAM_BOT_TOKEN kosong)",
    );
  }

  const defaultChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const chatId = String(options.chatId || defaultChatId || "").trim();

  if (!chatId) {
    throw new Error("TELEGRAM_CHAT_ID belum diatur");
  }

  return bot.telegram.sendMessage(chatId, text, {
    parse_mode: options.parseMode || "Markdown",
    disable_web_page_preview: true,
  });
}

async function saveTelegramChatId(chatId) {
  const normalized = String(chatId || "").trim();
  if (!normalized) return;

  try {
    await db.query("UPDATE users SET telegram_id = ? WHERE id = 1", [
      normalized,
    ]);
  } catch (err) {
    console.error("❌ Gagal menyimpan telegram_id:", err.message);
  }
}

// ==============================
// Logika AI Multimodal
// ==============================
async function processWithGemini(promptText, inlineData = null) {
  if (!genAI) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const systemInstruction = `Kamu adalah asisten keuangan eksekutif. Ekstrak data transaksi keuangan dari teks, audio, gambar struk, atau dokumen. 
Jika input sama sekali tidak mengandung informasi keuangan atau tidak relevan (seperti foto pemandangan, percakapan halo, gambar hewan), JANGAN MENGARANG DATA. Kembalikan JSON persis seperti ini: {"error": "Input ini tidak mengandung informasi transaksi keuangan yang bisa saya catat."}

Jika valid, kembalikan JSON MURNI TANPA MARKDOWN:
{ 
  "type": "expense" atau "income", 
  "amount": angka (tanpa titik koma), 
  "category": "Makanan/Transportasi/Belanja/Hiburan/Kesehatan/Listrik/Gaji/Lainnya", 
  "wallet_name": "Nama dompet yang paling cocok (misal: BCA, Cash, OVO, atau nama baru jika disebut)", 
  "date": "YYYY-MM-DD", 
  "description": "ringkasan singkat" 
}`;

  const contents = [systemInstruction];
  if (promptText) contents.push(promptText);
  if (inlineData) contents.push(inlineData);

  const result = await model.generateContent(contents);
  const rawText = result.response.text();

  try {
    return JSON.parse(rawText.replace(/```json|```/g, "").trim());
  } catch (e) {
    throw new Error("AI mengembalikan format yang tidak dikenali.");
  }
}

// Fungsi untuk menjaring foto, dokumen, voice note, dsb.
async function processMediaContext(ctx) {
  let text = ctx.message.caption || ctx.message.text || "";
  let inlineData = null;
  let fileId = null;
  let mimeType = "";

  if (ctx.message.photo && ctx.message.photo.length > 0) {
    fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    mimeType = "image/jpeg";
  } else if (ctx.message.voice) {
    fileId = ctx.message.voice.file_id;
    mimeType = ctx.message.voice.mime_type || "audio/ogg";
  } else if (ctx.message.document) {
    fileId = ctx.message.document.file_id;
    mimeType = ctx.message.document.mime_type;
  }

  if (fileId) {
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await fetch(fileLink.href);
    if (!response.ok)
      throw new Error("Gagal menyedot file dari server Telegram");
    const arrayBuffer = await response.arrayBuffer();
    inlineData = {
      inlineData: {
        data: Buffer.from(arrayBuffer).toString("base64"),
        mimeType: mimeType,
      },
    };
  }

  return { text, inlineData };
}

async function ensureAiPendingTableBot() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_pending_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      payload JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function createPendingAssignment(userId, payload) {
  await ensureAiPendingTableBot();
  const [result] = await db.query(
    `INSERT INTO ai_pending_assignments (user_id, payload) VALUES (?, ?)`,
    [userId, JSON.stringify(payload)],
  );
  return result.insertId;
}

function getDashboardKeyboard() {
  const ngrokUrl = process.env.NGROK_URL?.trim();
  if (!ngrokUrl) return undefined;

  return {
    inline_keyboard: [[{ text: "📱 AIFinance", web_app: { url: ngrokUrl } }]],
  };
}

async function configureTelegramMenuButton() {
  const ngrokUrl = process.env.NGROK_URL?.trim();
  if (!bot || !ngrokUrl || !BOT_TOKEN) return;

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: {
          type: "web_app",
          text: "AIFinance",
          web_app: { url: ngrokUrl },
        },
      }),
    });
  } catch (err) {
    console.error("❌ Gagal set menu button Telegram:", err.message);
  }
}

// ==============================
// Handler Telegraf Pintar
// ==============================
if (bot) {
  bot.start((ctx) => {
    saveTelegramChatId(ctx.chat?.id);
    const ngrokUrl = process.env.NGROK_URL?.trim();
    ctx.reply(
      "Halo! Saya *AIFinance* AI 🤖✨\n\nUntuk mulai mencatat, Abang bisa lempar saya:\n💬 Teks pesan biasa\n🎙️ Voice Note / Suara\n📸 Foto Struk kasir\n📄 Dokumen/PDF tagihan",
      {
        parse_mode: "Markdown",
        reply_markup: getDashboardKeyboard(),
      },
    );
  });

  // Menangkap semua pesan terlepas dari medianya
  bot.on("message", async (ctx) => {
    saveTelegramChatId(ctx.chat?.id);

    if (ctx.message.text && ctx.message.text.startsWith("/")) return;
    if (
      !ctx.message.text &&
      !ctx.message.photo &&
      !ctx.message.voice &&
      !ctx.message.document
    )
      return;

    const waitMsg = await ctx.reply("⏳ Mata & Telinga AI sedang mencerna...");

    try {
      const { text, inlineData } = await processMediaContext(ctx);
      const today = new Date().toISOString().split("T")[0];

      let promptText = `Ini Instruksi Utama. Tanggal otomatis sistem: ${today}. `;
      if (text) promptText += `Keterangan/Pesan tambahan Pengguna: "${text}"`;
      if (!text && !inlineData) throw new Error("Format pesan tidak dikenali.");

      const data = await processWithGemini(promptText, inlineData);

      if (data.error) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          waitMsg.message_id,
          undefined,
          `🤔 *Info AIFinance:*\n\n_${data.error}_`,
          { parse_mode: "Markdown" },
        );
        return;
      }

      const userId = 1;

      // If AI returned a wallet_name, try exact match first
      if (data.wallet_name && String(data.wallet_name).trim()) {
        const [walletRows] = await db.query(
          "SELECT id, name FROM wallets WHERE user_id = ? AND name LIKE ? LIMIT 1",
          [userId, `%${data.wallet_name}%`],
        );
        if (walletRows.length > 0) {
          const wallet = walletRows[0];
          const amount = Number(data.amount || 0);
          await db.query(
            `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, transaction_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              userId,
              wallet.id,
              data.type,
              amount,
              data.category,
              data.description,
              data.date,
            ],
          );
          await db.query(
            data.type === "expense"
              ? "UPDATE wallets SET balance = balance - ? WHERE id = ?"
              : "UPDATE wallets SET balance = balance + ? WHERE id = ?",
            [amount, wallet.id],
          );

          const emoji = data.type === "expense" ? "🔴" : "🟢";
          const statusText = `🪄 *Struk/Audio Berhasil Diproses!*\n\n${emoji} **${data.type === "expense" ? "Pengeluaran" : "Pemasukan"}**\n📝 ${data.description}\n💰 Rp ${Number(data.amount).toLocaleString("id-ID")}\n📂 ${data.category}\n💳 ${wallet.name}\n📅 ${data.date}`;

          await ctx.telegram.editMessageText(
            ctx.chat.id,
            waitMsg.message_id,
            undefined,
            statusText,
            { parse_mode: "Markdown" },
          );
          return;
        }
      }

      // No clear wallet — prepare candidate list and ask user to choose
      const [allWallets] = await db.query(
        "SELECT id, name, balance FROM wallets WHERE user_id = ? AND is_active = 1",
        [userId],
      );

      const [recentRows] = await db.query(
        `SELECT wallet_id, COUNT(*) as cnt FROM transactions WHERE user_id = ? AND category = ? GROUP BY wallet_id ORDER BY cnt DESC LIMIT 3`,
        [userId, data.category || ""],
      );
      const recentMap = new Map(
        recentRows.map((r) => [Number(r.wallet_id), Number(r.cnt)]),
      );

      const candidates = (allWallets || []).map((w) => {
        let score = 0.3; // base
        if (recentMap.has(w.id)) score += 0.4; // used for same category
        if (Number(w.balance) > (Number(data.amount) || 0)) score += 0.2; // sufficient balance
        return {
          id: w.id,
          name: w.name,
          balance: Number(w.balance),
          score: Math.min(0.99, score),
        };
      });

      if (!candidates || candidates.length === 0) {
        const newName = data.wallet_name || "Cash/Tunai";
        const [newWallet] = await db.query(
          "INSERT INTO wallets (user_id, name, balance, is_active) VALUES (?, ?, 0, 1)",
          [userId, newName],
        );
        const walletId = newWallet.insertId;
        const amount = Number(data.amount || 0);
        await db.query(
          `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, transaction_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            walletId,
            data.type,
            amount,
            data.category,
            data.description,
            data.date,
          ],
        );
        await db.query(
          data.type === "expense"
            ? "UPDATE wallets SET balance = balance - ? WHERE id = ?"
            : "UPDATE wallets SET balance = balance + ? WHERE id = ?",
          [amount, walletId],
        );

        const emoji = data.type === "expense" ? "🔴" : "🟢";
        let statusText = `🪄 *Struk/Audio Berhasil Diproses!*\n\n${emoji} **${data.type === "expense" ? "Pengeluaran" : "Pemasukan"}**\n📝 ${data.description}\n💰 Rp ${Number(data.amount).toLocaleString("id-ID")}\n📂 ${data.category}\n💳 ${newName}\n📅 ${data.date}`;
        statusText += `\n\n✨ _Catatan: Dompet baru "${newName}" otomatis dibuat!_`;

        await ctx.telegram.editMessageText(
          ctx.chat.id,
          waitMsg.message_id,
          undefined,
          statusText,
          { parse_mode: "Markdown" },
        );
        return;
      }

      // create pending assignment record
      const pendingPayload = { parsed: data, originalText: text };
      const pendingId = await createPendingAssignment(userId, pendingPayload);

      // build inline keyboard: each wallet candidate + options
      const keyboard = candidates
        .slice(0, 5)
        .map((c) => [
          {
            text: `${c.name} (${Math.round(c.score * 100)}%)`,
            callback_data: `assign:${pendingId}:${c.id}`,
          },
        ])
        .concat([
          [
            {
              text: "Gunakan Dompet Lain",
              callback_data: `assign:${pendingId}:0`,
            },
            {
              text: "Lewati / Tandai Nanti",
              callback_data: `assign:${pendingId}:skip`,
            },
          ],
        ]);

      const promptMsg = `Saya mendeteksi transaksi:\n*${data.type === "expense" ? "Pengeluaran" : "Pemasukan"}* - Rp ${Number(data.amount).toLocaleString("id-ID")}\n_${data.description}_\n\nPilih dompet yang sesuai:`;

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        waitMsg.message_id,
        undefined,
        promptMsg,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: keyboard },
        },
      );
    } catch (err) {
      console.error("❌ Error Bot:", err.message);
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        waitMsg.message_id,
        undefined,
        `❌ Yah gagal: ${err.message}`,
      );
    }
  });

  // Handle callback queries for assignment
  bot.on("callback_query", async (ctx) => {
    try {
      const dataStr = String(ctx.callbackQuery?.data || "");
      if (!dataStr.startsWith("assign:")) return ctx.answerCbQuery();
      // format: assign:{pendingId}:{walletId|0|skip}
      const parts = dataStr.split(":");
      const pendingId = Number(parts[1] || 0);
      const walletPart = parts[2] || "skip";

      if (!pendingId) {
        await ctx.answerCbQuery("Tautan kadaluarsa atau tidak valid", {
          show_alert: true,
        });
        return;
      }

      const [rows] = await db.query(
        `SELECT payload FROM ai_pending_assignments WHERE id = ? LIMIT 1`,
        [pendingId],
      );
      if (!rows || rows.length === 0) {
        await ctx.answerCbQuery(
          "Permintaan tidak ditemukan atau sudah diproses",
          { show_alert: true },
        );
        return;
      }

      const payload = JSON.parse(rows[0].payload || "{}");
      const parsed = payload.parsed || {};
      const userId = 1;

      if (walletPart === "skip") {
        await db.query(`DELETE FROM ai_pending_assignments WHERE id = ?`, [
          pendingId,
        ]);
        await ctx.editMessageText(`✅ Baik, saya tandai untuk dicek nanti.`);
        await ctx.answerCbQuery();
        return;
      }

      const walletId = Number(walletPart || 0);
      if (!walletId) {
        await ctx.answerCbQuery("Pilih dompet lain via aplikasi web.", {
          show_alert: true,
        });
        return;
      }

      // apply assignment
      const amount = Number(parsed.amount || 0);
      await db.query(
        `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, transaction_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          walletId,
          parsed.type,
          amount,
          parsed.category,
          parsed.description,
          parsed.date,
        ],
      );
      await db.query(
        parsed.type === "expense"
          ? "UPDATE wallets SET balance = balance - ? WHERE id = ?"
          : "UPDATE wallets SET balance = balance + ? WHERE id = ?",
        [amount, walletId],
      );

      await db.query(`DELETE FROM ai_pending_assignments WHERE id = ?`, [
        pendingId,
      ]);

      await ctx.editMessageText(
        `✅ Transaksi telah dicatat ke dompet pilihan.`,
      );
      await ctx.answerCbQuery();
    } catch (err) {
      console.error("callback_query error:", err.message);
      try {
        await ctx.answerCbQuery("Terjadi kesalahan, coba lagi.", {
          show_alert: true,
        });
      } catch (e) {}
    }
  });

  bot
    .launch()
    .then(() => console.log("🤖 Mata dan Telinga AIFinance telah dipasang!"))
    .catch((err) => console.error("❌ Bot launch error:", err.message));
  configureTelegramMenuButton();
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
} else {
  console.warn(
    "⚠️ Telegram bot tidak dijalankan karena TELEGRAM_BOT_TOKEN kosong.",
  );
}

module.exports = {
  sendTelegramMessage,
};
