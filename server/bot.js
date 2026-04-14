const { Telegraf } = require('telegraf');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./db');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN.trim());
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());

// ==============================
// Logika AI Multimodal
// ==============================
async function processWithGemini(promptText, inlineData = null) {
  // Menggunakan Gemini 1.5 Flash karena kemampuannya membaca Visual, Suara, dan Teks dengan sangatt cepat
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
     return JSON.parse(rawText.replace(/```json|```/g, '').trim());
  } catch (e) {
     throw new Error("AI mengembalikan format yang tidak dikenali.");
  }
}

// Fungsi untuk menjaring foto, dokumen, voice note, dsb.
async function processMediaContext(ctx) {
  let text = ctx.message.caption || ctx.message.text || '';
  let inlineData = null;
  let fileId = null;
  let mimeType = '';

  if (ctx.message.photo && ctx.message.photo.length > 0) {
    // Array foto di telegram berisi kualitas dari terburuk sampai terbaik, ambil yang terbesar
    fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    mimeType = 'image/jpeg';
  } else if (ctx.message.voice) {
    fileId = ctx.message.voice.file_id;
    // Format Voice Note Telegram berbentuk ogg 
    mimeType = ctx.message.voice.mime_type || 'audio/ogg';
  } else if (ctx.message.document) {
    fileId = ctx.message.document.file_id;
    mimeType = ctx.message.document.mime_type;
  }

  // Jika ada file yang tertaut, unduh sementara lalu buat Base64
  if (fileId) {
    const fileLink = await ctx.telegram.getFileLink(fileId);
    
    // Gunakan fungsi Bawaan Node.js Fetch (tidak butuh modul axios eksternal)
    const response = await fetch(fileLink.href);
    if (!response.ok) throw new Error("Gagal menyedot file dari server Telegram");
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Bungkus ke spesifikasi API Generative AI
    inlineData = {
      inlineData: {
        data: Buffer.from(arrayBuffer).toString("base64"),
        mimeType: mimeType
      }
    };
  }

  return { text, inlineData };
}

// ==============================
// Handler Telegraf Pintar
// ==============================
bot.start((ctx) => {
  const ngrokUrl = process.env.NGROK_URL?.trim();
  ctx.reply(
    "Halo! Saya *AUTOFINT* AI 🤖✨\n\nUntuk mulai mencatat, Abang bisa lempar saya:\n💬 Teks pesan biasa\n🎙️ Voice Note / Suara\n📸 Foto Struk kasir\n📄 Dokumen/PDF tagihan",
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

// Menangkap semua pesan terlepas dari medianya
bot.on('message', async (ctx) => {
  // Hiraukan command text berawalan slash (seperti /start dsb)
  if (ctx.message.text && ctx.message.text.startsWith('/')) return;
  // Hiraukan hal abstrak yang gak disupport (seperti Location, Sticker)
  if (!ctx.message.text && !ctx.message.photo && !ctx.message.voice && !ctx.message.document) return;

  const waitMsg = await ctx.reply("⏳ Mata & Telinga AI sedang mencerna...");

  try {
    const { text, inlineData } = await processMediaContext(ctx);
    const today = new Date().toISOString().split('T')[0];
    
    let promptText = `Ini Instruksi Utama. Tanggal otomatis sistem: ${today}. `;
    if (text) promptText += `Keterangan/Pesan tambahan Pengguna: "${text}"`;
    if (!text && !inlineData) throw new Error("Format pesan tidak dikenali.");

    // Tembak Data ke Google Gemini!
    const data = await processWithGemini(promptText, inlineData);

    // Filter jebakan (misal pengguna mengirim foto selfie bukan struk)
    if (data.error) {
      await ctx.telegram.editMessageText(
        ctx.chat.id, waitMsg.message_id, undefined,
        `🤔 *Info Autofint:*\n\n_${data.error}_`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const userId = 1;
    let [walletRows] = await db.query(
      'SELECT id, name FROM wallets WHERE user_id = ? AND name LIKE ? LIMIT 1',
      [userId, `%${data.wallet_name}%`]
    );

    let walletId;
    let walletName;
    let isNewWallet = false;

    if (walletRows.length > 0) {
      walletId = walletRows[0].id;
      walletName = walletRows[0].name;
    } else {
      // JURUS SMART AI: Buat dompet baru otomatis jika AI mendeteksi nama baru
      const newName = data.wallet_name || 'Cash/Tunai';
      const [newWallet] = await db.query(
        'INSERT INTO wallets (user_id, name, balance, is_active) VALUES (?, ?, 0, 1)',
        [userId, newName]
      );
      walletId = newWallet.insertId;
      walletName = newName;
      isNewWallet = true;
    }

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
    let statusText = `🪄 *Struk/Audio Berhasil Diproses!*\n\n${emoji} **${data.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}**\n📝 ${data.description}\n💰 Rp ${Number(data.amount).toLocaleString('id-ID')}\n📂 ${data.category}\n💳 ${walletName}\n📅 ${data.date}`;
    
    if (isNewWallet) {
      statusText += `\n\n✨ _Catatan: Dompet baru "${walletName}" otomatis dibuat!_`;
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id, waitMsg.message_id, undefined,
      statusText,
      { parse_mode: 'Markdown' }
    );

  } catch (err) {
    console.error("❌ Error Bot:", err.message);
    await ctx.telegram.editMessageText(
      ctx.chat.id, waitMsg.message_id, undefined,
      `❌ Yah gagal: ${err.message}`
    );
  }
});

bot.launch().then(() => console.log("🤖 Mata dan Telinga AUTOFINT telah dipasang!"));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
