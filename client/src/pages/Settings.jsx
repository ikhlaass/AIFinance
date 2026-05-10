import React, { useEffect, useState } from "react";
import {
  Wallet,
  Upload,
  Send,
  User,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  X,
  Zap,
} from "lucide-react";
import AIAssignmentPanel from "../components/AIAssignmentPanel";

const toRp = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(Number(value || 0))
    .replace("IDR", "Rp");

const Settings = () => {
  const [activeTab, setActiveTab] = useState("wallet");
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState("ok");

  const [overview, setOverview] = useState({
    user: { name: "", email: "" },
    telegram: {
      connected: false,
      chatIdMasked: "",
      botUsername: null,
      botLink: null,
    },
  });

  const [wallets, setWallets] = useState([]);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletBalance, setNewWalletBalance] = useState("0");
  const [profileName, setProfileName] = useState("");

  const showNotice = (text, tone = "ok") => {
    setNotice(text);
    setNoticeTone(tone);
    window.setTimeout(() => setNotice(""), 3000);
  };

  const fetchOverview = async () => {
    const res = await fetch("/api/settings/overview");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal memuat pengaturan");
    setOverview(data);
    setProfileName(data.user?.name || "");
  };

  const fetchWallets = async () => {
    const res = await fetch("/api/wallets");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal memuat dompet");
    setWallets(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setIsBusy(true);
        await fetchOverview();
        await fetchWallets();
      } catch (err) {
        showNotice(err.message, "error");
      } finally {
        setIsBusy(false);
      }
    };
    bootstrap();
  }, []);

  const saveProfile = async () => {
    try {
      setIsBusy(true);
      const res = await fetch("/api/settings/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan profil");
      showNotice("Profil tersimpan");
      await fetchOverview();
    } catch (err) {
      showNotice(err.message, "error");
    } finally {
      setIsBusy(false);
    }
  };

  const addWallet = async () => {
    try {
      setIsBusy(true);
      const res = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWalletName.trim(),
          balance: Number(newWalletBalance || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah dompet");
      setNewWalletName("");
      setNewWalletBalance("0");
      showNotice("Dompet baru ditambahkan");
      await fetchWallets();
      setIsWalletModalOpen(false);
    } catch (err) {
      showNotice(err.message, "error");
    } finally {
      setIsBusy(false);
    }
  };

  const deleteWallet = async (walletId) => {
    try {
      setIsBusy(true);
      const res = await fetch(`/api/wallets/${walletId}/delete`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus dompet");
      showNotice("Dompet dihapus");
      await fetchWallets();
    } catch (err) {
      showNotice(err.message, "error");
    } finally {
      setIsBusy(false);
    }
  };

  const sendTelegramTest = async () => {
    try {
      setIsBusy(true);
      const res = await fetch("/api/settings/telegram/test", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal kirim test Telegram");
      showNotice("Pesan test Telegram berhasil dikirim");
    } catch (err) {
      showNotice(err.message, "error");
    } finally {
      setIsBusy(false);
    }
  };

  const disconnectTelegram = async () => {
    try {
      setIsBusy(true);
      const res = await fetch("/api/settings/telegram/disconnect", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memutuskan Telegram");
      showNotice("Telegram diputuskan");
      await fetchOverview();
    } catch (err) {
      showNotice(err.message, "error");
    } finally {
      setIsBusy(false);
    }
  };

  const downloadTemplate = () => {
    const csv =
      "tanggal,tipe,kategori,jumlah,deskripsi,dompet,catatan\n2026-04-25,expense,Makanan,50000,Makan siang,BCA,";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-import-transaksi.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const TABS = [
    { id: "wallet", label: "Dompet", icon: Wallet },
    { id: "import", label: "Import", icon: Upload },
    { id: "telegram", label: "Telegram", icon: Send },
    { id: "ai-assign", label: "AI Assignment", icon: Zap },
    { id: "account", label: "Akun", icon: User },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      {notice && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-bold flex items-center gap-2 ${
            noticeTone === "error"
              ? "border-rose-500/40 bg-rose-500/10 text-rose-500"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
          }`}
        >
          {noticeTone === "error" ? (
            <AlertTriangle size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          {notice}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible md:flex-wrap">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all ${
                isActive
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "bg-card border border-card-border text-text-muted hover:text-text-main hover:border-primary/40"
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "wallet" && (
        <section className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-text-main uppercase tracking-widest">
                Saldo Dompet
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Kelola akun keuangan Anda
              </p>
            </div>
            <button
              onClick={() => setIsWalletModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:shadow-lg shadow-primary/30 transition-all active:scale-95"
            >
              <Plus size={18} /> Tambah
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {wallets.map((wallet) => (
              <article
                key={wallet.id}
                className="bg-card border border-card-border rounded-[1.75rem] px-5 py-4 shadow-[0_8px_22px_rgba(15,23,42,0.08)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)] hover:border-primary/40 transition-all flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">
                    {wallet.name}
                  </p>
                  <p
                    className={`mt-2 text-lg font-black leading-tight tracking-tight ${
                      Number(wallet.balance) < 0
                        ? "text-rose-500"
                        : "text-emerald-500"
                    }`}
                  >
                    {toRp(wallet.balance)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => deleteWallet(wallet.id)}
                  className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all disabled:opacity-50"
                >
                  <Trash2 size={18} />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "import" && (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-bold text-text-main uppercase tracking-widest">
              Import Transaksi
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Impor data transaksi dari file CSV
            </p>
          </div>

          <div className="bg-card border border-card-border rounded-[1.75rem] md:rounded-[2rem] p-6 md:p-8 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
            <ol className="space-y-3 mb-6">
              {[
                "Download template CSV terlebih dahulu.",
                "Isi data transaksi sesuai format.",
                "Upload file CSV yang sudah diisi.",
                "Review data sebelum import permanen.",
              ].map((step, idx) => (
                <li key={idx} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                    {idx + 1}
                  </span>
                  <span className="text-text-main font-medium pt-0.5">
                    {step}
                  </span>
                </li>
              ))}
            </ol>

            <div className="flex flex-row flex-nowrap gap-2 pt-4 border-t border-card-border overflow-x-auto pb-1">
              <button
                type="button"
                onClick={downloadTemplate}
                className="shrink-0 px-5 py-2.5 rounded-xl border border-card-border font-bold hover:bg-body/40 transition-all text-sm"
              >
                Download Template
              </button>
              <label className="shrink-0 px-5 py-2.5 rounded-xl bg-primary text-white font-bold cursor-pointer hover:shadow-lg shadow-primary/30 transition-all text-sm">
                Upload File CSV
                <input type="file" accept=".csv" className="hidden" />
              </label>
            </div>
          </div>
        </section>
      )}

      {activeTab === "telegram" && (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-bold text-text-main uppercase tracking-widest">
              Integrasi Telegram
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Hubungkan bot Telegram untuk input AI otomatis
            </p>
          </div>

          <div className="bg-card border border-card-border rounded-[1.75rem] md:rounded-[2rem] p-6 md:p-8 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">
                  Status Koneksi
                </p>
                <p className="mt-2 font-semibold text-text-main">
                  {overview.telegram.connected
                    ? `Terhubung (${overview.telegram.chatIdMasked})`
                    : "Belum terhubung"}
                </p>
              </div>
              <div
                className={`px-4 py-2 rounded-lg text-xs font-bold ${
                  overview.telegram.connected
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-slate-500/10 text-slate-500"
                }`}
              >
                {overview.telegram.connected ? "✓ Aktif" : "○ Offline"}
              </div>
            </div>

            <div className="h-px bg-card-border mb-6" />

            <div className="flex flex-col sm:flex-row gap-3">
              {overview.telegram.botLink ? (
                <a
                  href={overview.telegram.botLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold transition-all text-sm inline-flex items-center justify-center gap-2"
                >
                  <ExternalLink size={16} /> Hubungkan Telegram
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="px-5 py-2.5 rounded-xl border border-card-border text-text-muted font-bold text-sm"
                >
                  Konfigurasi Bot Diperlukan
                </button>
              )}
              <button
                type="button"
                onClick={sendTelegramTest}
                disabled={isBusy}
                className="px-5 py-2.5 rounded-xl border border-card-border font-bold hover:bg-body/40 transition-all text-sm disabled:opacity-50"
              >
                Kirim Test
              </button>
              <button
                type="button"
                onClick={disconnectTelegram}
                disabled={isBusy || !overview.telegram.connected}
                className="px-5 py-2.5 rounded-xl border border-rose-500/40 text-rose-500 font-bold hover:bg-rose-500/10 transition-all text-sm disabled:opacity-50"
              >
                Putuskan
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === "account" && (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-bold text-text-main uppercase tracking-widest">
              Pengaturan Akun
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Kelola profil dan data akun Anda
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-card-border rounded-[1.75rem] p-6 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted mb-4">
                Informasi Akun
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-text-muted mb-1">Nama</p>
                  <p className="font-bold text-lg text-text-main">
                    {overview.user.name || "User"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-text-muted mb-1">
                    Email
                  </p>
                  <p className="font-medium text-sm text-text-muted">
                    {overview.user.email || "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-[1.75rem] p-6 shadow-[0_10px_28px_rgba(15,23,42,0.08)] flex flex-col justify-between">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted block mb-3">
                  Ubah Nama Lengkap
                </label>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  className="w-full bg-body/50 border border-card-border rounded-xl px-4 py-3 text-text-main placeholder:text-text-muted outline-none focus:border-primary transition-all text-sm mb-4"
                />
              </div>
              <button
                type="button"
                onClick={saveProfile}
                disabled={isBusy}
                className="w-full px-5 py-3 rounded-xl bg-primary hover:shadow-lg shadow-primary/30 text-white font-bold transition-all text-sm"
              >
                <Save size={16} className="inline mr-2" /> Simpan
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === "ai-assign" && <AIAssignmentPanel />}

      {isWalletModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsWalletModalOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-card border border-card-border rounded-[1.75rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-black text-text-main">
                  Tambah Dompet
                </h2>
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-[0.14em] mt-1">
                  Buat akun keuangan baru
                </p>
              </div>
              <button
                onClick={() => setIsWalletModalOpen(false)}
                className="text-text-muted hover:text-text-main hover:bg-body/40 p-2 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addWallet();
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted block mb-2">
                  Nama Bank/E-Wallet
                </label>
                <input
                  type="text"
                  placeholder="Contoh: BCA, OVO, Dana"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  required
                  className="w-full bg-body/50 border border-card-border rounded-xl px-4 py-3 text-text-main placeholder:text-text-muted outline-none focus:border-primary font-semibold transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted block mb-2">
                  Saldo Awal (Rp)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={newWalletBalance}
                  onChange={(e) => setNewWalletBalance(e.target.value)}
                  className="w-full bg-body/50 border border-card-border rounded-xl px-4 py-3 text-text-main outline-none focus:border-primary font-semibold transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-4 bg-primary hover:shadow-lg shadow-primary/30 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 mt-6"
              >
                <Plus size={18} /> {isBusy ? "Membuat..." : "Konfirmasi"}
              </button>
            </form>
          </div>
        </div>
      )}

      {isBusy && (
        <div className="fixed bottom-5 right-5 px-5 py-3 rounded-xl bg-card border border-card-border text-sm font-bold text-text-main shadow-lg animate-in slide-in-from-bottom">
          ⏳ Memproses...
        </div>
      )}
    </div>
  );
};

export default Settings;
