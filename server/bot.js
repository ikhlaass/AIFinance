const { Telegraf } = require('telegraf');
const db = require('./db');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN.trim());
const GEMINI_KEY = process.env.GEMINI_API_KEY.trim();

// ==============================
// Panggil Gemini - Simpel, tanpa retry
// ==============================
async function callGemini(text) {
  const today = new Date().toISOString().split('T')[0];
  const modelId = "gemini-flash-latest"; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text:
        `Kamu adalah asisten keuangan. Ekstrak data dari kalimat berikut ke JSON murni (tanpa markdown).
Kalimat: "${text}"

Kembalikan JSON:
{ "type": "expense"/"income", "amount": angka, "category": "Makanan/Transportasi/Belanja/Hiburan/Kesehatan/Listrik/Gaji/Lainnya", "wallet_name": "Cash/Tunai/BCA/Mandiri/BRI/BNI/GoPay/OVO/DANA/ShopeePay", "date": "YYYY-MM-DD (default hari ini: ${today})", "description": "ringkasan singkat" }`
      }] }],
      generationConfig: { temperature: 0.1 }
    })
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);

  const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ==============================
// /start
// ==============================
bot.start((ctx) => {
  const ngrokUrl = process.env.NGROK_URL?.trim();
  ctx.reply(
    "Halo! Saya *AUTOFINT* 🤖💳\n\nCatat transaksi cukup dengan kalimat biasa!\n\nContoh:\n• _beli nasi goreng 20rb_\n• _gaji masuk 3 juta ke BCA_\n• _bayar listrik 150000_",
    {
      parse_mode: 'Markdown',
      ...(ngrokUrl && {
        reply_markup: {
          inline_keyboard: [[{ text: "📊 Buka Web Dashboard", web_app: { url: ngrokUrl } }]]
        }
      })
    }
  );
});

// ==============================
// Handler teks
// ==============================
bot.on('text', async (ctx) => {
  const userInput = ctx.message.text.trim();
  if (userInput.startsWith('/')) return;

  const waitMsg = await ctx.reply("⏳ Memproses...");

  try {
    const data = await callGemini(userInput);
    console.log("✅ AI sukses:", data);

    const userId = 1;
    const [walletRows] = await db.query(
      'SELECT id, name FROM wallets WHERE user_id = ? AND name LIKE ? LIMIT 1',
      [userId, `%${data.wallet_name}%`]
    );

    const walletId = walletRows[0]?.id || 1;
    const walletName = walletRows[0]?.name || 'Cash/Tunai';

    await db.query(
      `INSERT INTO transactions (user_id, wallet_id, type, amount, category, description, transaction_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, walletId, data.type, data.amount, data.category, data.description, data.date]
    );

    await db.query(
      data.type === 'expense'
        ? 'UPDATE wallets SET balance = balance - ? WHERE id = ?'
        : 'UPDATE wallets SET balance = balance + ? WHERE id = ?',
      [data.amount, walletId]
    );

    const emoji = data.type === 'expense' ? '🔴' : '🟢';
    await ctx.telegram.editMessageText(
      ctx.chat.id, waitMsg.message_id, undefined,
      `✅ *Transaksi Tercatat!*\n\n${emoji} ${data.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}\n📝 ${data.description}\n💰 Rp ${Number(data.amount).toLocaleString('id-ID')}\n📂 ${data.category}\n💳 ${walletName}\n📅 ${data.date}`,
      { parse_mode: 'Markdown' }
    );

  } catch (err) {
    console.error("❌ Error:", err.message);
    await ctx.telegram.editMessageText(
      ctx.chat.id, waitMsg.message_id, undefined,
      `❌ Gagal: ${err.message}`
    );
  }
});

bot.launch().then(() => console.log("🤖 Bot AUTOFINT menyala!"));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
