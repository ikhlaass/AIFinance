import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Wallet, X, ArrowUpCircle, Gem } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const WalletItem = ({ wallet, onDelete }) => {
  const formatRp = (num) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    })
      .format(num || 0)
      .replace("IDR", "Rp");
  const isNegative = Number(wallet.balance) < 0;

  return (
    <div className="group relative flex items-center justify-between p-3 px-4 rounded-2xl bg-card border border-card-border hover:border-primary/30 transition-all duration-500 shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)] min-h-[60px] overflow-hidden">
      <div className="relative z-10 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
          <Wallet size={14} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            {wallet.name}
          </span>
          <span
            className={cn(
              "text-sm font-black tracking-tighter",
              isNegative ? "text-rose-500" : "text-text-main",
            )}
          >
            {formatRp(wallet.balance)}
          </span>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(wallet.id);
        }}
        className="opacity-0 group-hover:opacity-100 transition-all duration-300 p-1.5 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-lg focus:outline-none"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};

const WalletGrid = () => {
  const [wallets, setWallets] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newWalletName, setNewWalletName] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchWallets = useCallback(async () => {
    try {
      const response = await fetch("/api/wallets");
      if (!response.ok) throw new Error("Gagal mengambil data dompet");
      const data = await response.json();
      setWallets(data);
    } catch (err) {
      console.error("Wallet API Error:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const handleAddWallet = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWalletName,
          balance: parseFloat(initialBalance) || 0,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal antrian database");

      setIsModalOpen(false);
      setNewWalletName("");
      setInitialBalance("");
      fetchWallets();
    } catch (err) {
      alert("Gagal menambah dompet: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWallet = async (id) => {
    if (
      !window.confirm(
        "Ingin menghapus dompet ini dari tampilan aktif? Transaksi lama tetap tersimpan.",
      )
    )
      return;
    try {
      const walletId = String(id);
      // Gunakan jalur relatif agar Proxy Vite nangkep dengan benar
      const url = `/api/wallets/${walletId}/delete`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server error");
      }

      fetchWallets();
    } catch (err) {
      console.error("Delete Error:", err.name, err.message);
      alert("Gagal menghapus dompet: " + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* ADD WALLET BUTTON CARD */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-3 p-3 px-6 rounded-2xl border border-dashed border-card-border bg-card/50 hover:border-primary hover:bg-primary/5 transition-all duration-500 text-text-muted hover:text-primary group min-h-[60px] shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)]"
        >
          <Plus
            size={16}
            className="group-hover:rotate-90 transition-transform duration-500"
          />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] font-mono">
            New Wallet
          </span>
        </button>

        {wallets.map((wallet) => (
          <WalletItem
            key={wallet.id}
            wallet={wallet}
            onDelete={handleDeleteWallet}
          />
        ))}
      </div>

      {/* CREATE WALLET MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-card border border-card-border rounded-[2.5rem] shadow-[0_16px_40px_rgba(15,23,42,0.12)] p-10 animate-in zoom-in-95 duration-300 text-text-main">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-text-main tracking-tight">
                  Tambah Dompet
                </h2>
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                  Atur sendiri dompet Anda
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-main transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddWallet} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">
                  Nama Rekening/E-Wallet
                </label>
                <input
                  type="text"
                  placeholder="e.g. BCA, OVO, Cash"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  required
                  className="w-full bg-body/50 border border-card-border rounded-2xl px-6 py-4 outline-none focus:border-primary font-bold text-text-main transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">
                  Saldo Awal (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted font-bold">
                    Rp
                  </span>
                  <input
                    type="number"
                    placeholder="0"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    className="w-full bg-body/50 border border-card-border rounded-2xl pl-14 pr-6 py-4 outline-none focus:border-primary font-bold text-text-main transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-xl shadow-blue-950/40 flex items-center justify-center gap-2 active:scale-95"
              >
                <Plus size={16} />{" "}
                {isSubmitting ? "Mendaftarkan..." : "Konfirmasi Dompet"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletGrid;
