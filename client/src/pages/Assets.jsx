import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Plus,
  TrendingUp,
  TrendingDown,
  Trash2,
  Search,
  X,
  Building2,
  Calendar,
  ChevronDown,
  Info,
  RefreshCw,
  Wallet,
  ArrowUpCircle,
  Gem,
  MapPin,
  Handshake,
  Coins,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Assets = () => {
  const [assets, setAssets] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isYieldModalOpen, setIsYieldModalOpen] = useState(false);
  const [activeAsset, setActiveAsset] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastMarketSyncAt, setLastMarketSyncAt] = useState(null);

  // Form State
  const [investmentType, setInvestmentType] = useState("Pasar Modal");
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [unitType, setUnitType] = useState("Unit");
  const [quantity, setQuantity] = useState("1");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [broker, setBroker] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickerSuggestions, setTickerSuggestions] = useState([]);
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
  const [isSearchingTicker, setIsSearchingTicker] = useState(false);

  // Yield State
  const [yieldAmount, setYieldAmount] = useState("");
  const [yieldWalletId, setYieldWalletId] = useState("");
  const [yieldDate, setYieldDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [yieldDesc, setYieldDesc] = useState("");

  useEffect(() => {
    const keyword = ticker.trim();
    if (!keyword) {
      setTickerSuggestions([]);
      setShowTickerSuggestions(false);
      setIsSearchingTicker(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearchingTicker(true);
      try {
        const response = await fetch(
          `/api/market/suggest?q=${encodeURIComponent(keyword)}&t=${Date.now()}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (cancelled) return;

        if (Array.isArray(data)) {
          setTickerSuggestions(data);
          setShowTickerSuggestions(true);
        } else {
          setTickerSuggestions([]);
          setShowTickerSuggestions(false);
        }
      } catch (err) {
        if (!cancelled) {
          setTickerSuggestions([]);
          setShowTickerSuggestions(false);
        }
      } finally {
        if (!cancelled) setIsSearchingTicker(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ticker]);

  const resolveLastMarketSyncAt = (assetList) => {
    if (!Array.isArray(assetList)) return null;

    const timestamps = assetList
      .filter((asset) => asset.type === "market" && asset.price_updated_at)
      .map((asset) => new Date(asset.price_updated_at).getTime())
      .filter((ts) => Number.isFinite(ts));

    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps)).toISOString();
  };

  const notifyPortfolioChanged = () => {
    document.dispatchEvent(new CustomEvent("portfolio-changed"));
  };

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [assetRes, walletRes] = await Promise.all([
        fetch("/api/assets").then((r) => r.json()),
        fetch("/api/wallets").then((r) => r.json()),
      ]);

      if (Array.isArray(assetRes)) {
        setAssets(assetRes);
        setLastMarketSyncAt(resolveLastMarketSyncAt(assetRes));
      }
      if (Array.isArray(walletRes)) setWallets(walletRes);
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
    const handleOpenModal = () => setIsModalOpen(true);
    document.addEventListener("open-asset-modal", handleOpenModal);
    return () =>
      document.removeEventListener("open-asset-modal", handleOpenModal);
  }, []);

  const refreshPrices = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/assets?force=1&t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await response.json();
      setAssets(data);
      setLastMarketSyncAt(resolveLastMarketSyncAt(data));
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWalletId) {
      alert("Pilih dompet sumber dana terlebih dahulu!");
      return;
    }

    const tickerText = ticker.trim();
    const hasTicker = tickerText.length > 0;
    const qtyNum = parseFloat(quantity) || 1;
    const purchaseNum = parseFloat(purchasePrice) || 0;
    const totalNum = parseFloat(totalValue) || 0;

    if (!name.trim() && !hasTicker) {
      alert("Isi nama aset atau ticker terlebih dahulu!");
      return;
    }

    if (hasTicker && purchaseNum <= 0) {
      alert("Untuk aset berticker, harga beli harus diisi!");
      return;
    }

    if (!hasTicker && totalNum <= 0) {
      alert("Untuk aset manual, total nilai aset harus diisi!");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: hasTicker ? "market" : "custom",
          ticker: hasTicker ? tickerText : null,
          name: name.trim() || tickerText.toUpperCase() || "Portfolio Item",
          unit_type: unitType,
          quantity: hasTicker ? qtyNum : 1,
          purchase_price: hasTicker ? purchaseNum : totalNum,
          total_value: hasTicker ? purchaseNum * qtyNum : totalNum,
          broker,
          wallet_id: selectedWalletId,
          transaction_date: txDate,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Server error");

      setIsModalOpen(false);
      resetForm();
      fetchInitialData();
      notifyPortfolioChanged();
    } catch (error) {
      alert("Gagal menyimpan investasi: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleYieldSubmit = async (e) => {
    e.preventDefault();
    if (!yieldWalletId) {
      alert("Pilih dompet tujuan!");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/assets/yield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: activeAsset.id,
          wallet_id: yieldWalletId,
          amount: parseFloat(yieldAmount),
          transaction_date: yieldDate,
          description: yieldDesc || `Yield from ${activeAsset.name}`,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Server error");

      setIsYieldModalOpen(false);
      resetYieldForm();
      fetchInitialData();
      notifyPortfolioChanged();
    } catch (error) {
      alert("Gagal merekam hasil: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus investasi?")) return;
    try {
      const response = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      fetchInitialData();
      notifyPortfolioChanged();
    } catch (error) {
      alert("Gagal menghapus");
    }
  };

  const resetForm = () => {
    setInvestmentType("Pasar Modal");
    setTicker("");
    setName("");
    setUnitType("Unit");
    setQuantity("1");
    setPurchasePrice("");
    setTotalValue("");
    setBroker("");
    setTxDate(new Date().toISOString().split("T")[0]);
    setSelectedWalletId("");
    setTickerSuggestions([]);
    setShowTickerSuggestions(false);
  };

  const resetYieldForm = () => {
    setYieldAmount("");
    setYieldWalletId("");
    setYieldDate(new Date().toISOString().split("T")[0]);
    setYieldDesc("");
    setActiveAsset(null);
  };

  const formatRp = (num) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    })
      .format(num || 0)
      .replace("IDR", "Rp");
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return "Belum ada data market";
    const dt = new Date(isoString);
    if (Number.isNaN(dt.getTime())) return "Belum ada data market";

    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(dt);
  };

  const getAssetMeta = (asset) => {
    const isMarket = asset.type === "market";
    const label = isMarket ? "Market Asset" : "Static Asset";
    const tone = isMarket
      ? "bg-sky-500/10 text-sky-500 border-sky-500/20"
      : "bg-amber-500/10 text-amber-500 border-amber-500/20";
    const dot = isMarket ? "bg-sky-500" : "bg-amber-500";
    const subtitle = isMarket
      ? "Nilai bergerak otomatis mengikuti pasar"
      : "Nilai mengikuti perjanjian / pencairan";
    return { label, tone, dot, subtitle, isMarket };
  };

  const getTickerBadgeLabel = (asset) => {
    if (!asset?.ticker)
      return (asset?.name || "").substring(0, 2).toUpperCase();

    const ticker = String(asset.ticker).toUpperCase();
    if (ticker.includes("-")) return ticker.split("-")[0];
    if (ticker.includes(".")) return ticker.split(".")[0];
    return ticker.length > 6 ? ticker.substring(0, 6) : ticker;
  };

  const totalMarketValue = assets
    .filter((asset) => asset.type === "market")
    .reduce(
      (acc, asset) =>
        acc + Number(asset.current_value || asset.total_value || 0),
      0,
    );

  const totalStaticValue = assets
    .filter((asset) => asset.type !== "market")
    .reduce((acc, asset) => acc + Number(asset.total_value || 0), 0);

  const totalVisibleValue = totalMarketValue + totalStaticValue;

  const totalPortfolioValue = assets.reduce(
    (acc, curr) => acc + Number(curr.current_value || curr.total_value),
    0,
  );

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 font-sans">
      {/* Universal Investment Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <span className="text-[11px] font-bold uppercase text-primary tracking-wider font-mono">
              {assets.length} ACTIVE ASSETS
            </span>
          </div>
          <p className="text-[10px] font-semibold text-text-muted tracking-wide">
            Market terakhir diperbarui: {formatDateTime(lastMarketSyncAt)}
          </p>
        </div>
        <button
          onClick={refreshPrices}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-card-border rounded-xl text-xs font-semibold text-text-muted hover:text-text-main transition-all shadow-sm active:scale-95"
        >
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          Refresh Layar Harga
        </button>
      </div>

      {/* Main Portfolio Value Card */}
      <section className="bg-card card-gradient rounded-[2.5rem] p-8 md:p-12 border border-card-border shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-primary/20 transition-all duration-1000"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 font-mono">
              Total Portfolio Value
            </p>
            <h2 className="text-5xl md:text-7xl font-black text-text-main tracking-tighter">
              {formatRp(totalPortfolioValue)}
            </h2>
            <p className="text-[11px] text-text-muted font-medium mt-3 max-w-xl">
              Gabungan aset pasar yang bergerak otomatis dan aset statis yang
              mengikuti perjanjian atau pencairan.
            </p>
          </div>
          <div className="bg-slate-900 dark:bg-slate-950 text-white px-8 py-6 rounded-[2rem] border border-white/5 flex flex-col items-center justify-center shadow-2xl group-hover:scale-105 transition-transform duration-500">
            <Gem size={24} className="text-primary mb-2" />
            <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-1">
              Status
            </p>
            <p className="text-2xl font-black tracking-tight text-white">
              VIBRANT
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-[1.5rem] border border-card-border bg-body/40 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500">
                Aset Pasar
              </span>
              <span className="text-xs font-bold text-text-muted">Dinamis</span>
            </div>
            <div className="h-2 rounded-full bg-card-border overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full"
                style={{
                  width:
                    totalVisibleValue > 0
                      ? `${(totalMarketValue / totalVisibleValue) * 100}%`
                      : "0%",
                }}
              ></div>
            </div>
            <p className="text-sm font-black text-text-main mt-3">
              {formatRp(totalMarketValue)}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-card-border bg-body/40 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">
                Aset Statis
              </span>
              <span className="text-xs font-bold text-text-muted">Kontrak</span>
            </div>
            <div className="h-2 rounded-full bg-card-border overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{
                  width:
                    totalVisibleValue > 0
                      ? `${(totalStaticValue / totalVisibleValue) * 100}%`
                      : "0%",
                }}
              ></div>
            </div>
            <p className="text-sm font-black text-text-main mt-3">
              {formatRp(totalStaticValue)}
            </p>
          </div>
        </div>
      </section>

      {/* Grid Content */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="h-24 bg-card animate-pulse rounded-2xl border border-card-border"
              ></div>
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="bg-card border border-card-border rounded-[2rem] flex flex-col items-center justify-center py-24 text-center opacity-40">
            <Coins size={40} className="text-text-muted mb-4" />
            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">
              No Records Found
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {assets.map((asset) => {
              const meta = getAssetMeta(asset);
              const currentVal = Number(
                asset.current_value || asset.total_value,
              );
              const costBasis =
                Number(asset.purchase_price) * Number(asset.quantity);
              const totalReturn = Number(asset.total_yield || 0);
              const roiPercent =
                costBasis > 0
                  ? ((currentVal - costBasis + totalReturn) / costBasis) * 100
                  : 0;
              const isProfit = roiPercent >= 0;

              return (
                <div
                  key={asset.id}
                  className={cn(
                    "border rounded-[1.5rem] p-4 px-5 transition-all duration-500 group relative overflow-hidden flex flex-col justify-between min-h-[170px] shadow-xl",
                    asset.type === "market"
                      ? "bg-card border-sky-500/15 hover:border-sky-500/40"
                      : "bg-card border-amber-500/15 hover:border-amber-500/40",
                  )}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>

                  <div className="relative z-10 flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[11px] tracking-tight shadow-inner uppercase border",
                          asset.type === "market"
                            ? "bg-sky-500/10 text-sky-500 border-sky-500/20"
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20",
                        )}
                        title={asset.ticker || asset.name}
                      >
                        <span className="whitespace-nowrap leading-none">
                          {getTickerBadgeLabel(asset)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <h3 className="font-black text-text-main text-xs uppercase tracking-tight truncate max-w-[120px]">
                          {asset.name}
                        </h3>
                        <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest">
                          {asset.broker || "Personal"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setActiveAsset(asset);
                          setIsYieldModalOpen(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all text-[9px] font-black uppercase tracking-tighter"
                        title="Record Income"
                      >
                        <Plus size={10} />
                        Hasil
                      </button>
                      <button
                        onClick={() => handleDelete(asset.id)}
                        className="p-1 px-2 text-text-muted hover:text-rose-500 transition-colors pointer-events-auto"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "relative z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] w-fit mb-4",
                      meta.tone,
                    )}
                  >
                    <span
                      className={cn("w-2 h-2 rounded-full", meta.dot)}
                    ></span>
                    {meta.label}
                  </div>

                  <div className="relative z-10 space-y-3">
                    <div className="flex justify-between items-end">
                      <div className="flex flex-col gap-1">
                        <p className="text-[9px] text-text-muted font-black uppercase tracking-widest">
                          {asset.type === "market"
                            ? "Market Value"
                            : "Contract Value"}
                        </p>
                        <h4 className="text-xl font-black text-text-main tracking-tighter leading-none">
                          {formatRp(currentVal)}
                        </h4>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <div
                          className={cn(
                            "flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full",
                            isProfit
                              ? "text-emerald-500 bg-emerald-500/10"
                              : "text-rose-500 bg-rose-500/10",
                          )}
                        >
                          {isProfit ? (
                            <TrendingUp size={10} />
                          ) : (
                            <TrendingDown size={10} />
                          )}
                          {roiPercent.toFixed(1)}%
                        </div>
                        <p className="text-[9px] text-text-muted font-bold">
                          {asset.type === "market" ? "Unrealized" : "Yield"}:{" "}
                          {formatRp(totalReturn)}
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-text-muted leading-relaxed">
                      {meta.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Investment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-card border border-card-border rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="px-10 pt-10 pb-6 flex justify-between items-center border-b border-card-border">
              <div>
                <h2 className="text-2xl font-black text-text-main tracking-tighter">
                  Tambah Investasi
                </h2>
                <p className="text-[11px] text-text-muted font-bold uppercase tracking-widest mt-1">
                  Daftarkan aset portfolio Anda
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-text-muted hover:text-text-main transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-10 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar"
            >
              <div className="space-y-2">
                <label className="text-[11px] font-black text-text-muted uppercase tracking-widest ml-1">
                  Kategori Investasi
                </label>
                <div className="relative">
                  <select
                    value={investmentType}
                    onChange={(e) => setInvestmentType(e.target.value)}
                    className="w-full appearance-none bg-slate-500/5 border border-card-border rounded-2xl px-6 py-4 outline-none focus:border-primary font-bold text-text-main transition-all cursor-pointer"
                  >
                    <option value="Saham">Saham</option>
                    <option value="Crypto">Crypto</option>
                    <option value="Reksadana">Reksadana</option>
                    <option value="Obligasi">Obligasi</option>
                    <option value="Emas">Emas</option>
                    <option value="Properti">Properti</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                  <ChevronDown
                    size={18}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-text-muted uppercase tracking-widest ml-1">
                  Nama Aset
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rumah Bandung / Piutang Budi / BBCA"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-500/5 border border-card-border rounded-2xl px-6 py-4 outline-none font-bold text-text-main focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-text-muted uppercase tracking-widest ml-1">
                  Market Ticker (Opsional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. BBCA.JK, BTC-USD, XAUUSD=X"
                    value={ticker}
                    onFocus={() => {
                      if (tickerSuggestions.length > 0) {
                        setShowTickerSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowTickerSuggestions(false), 150);
                    }}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    className="w-full bg-slate-500/5 border border-card-border rounded-2xl px-6 py-4 pr-12 outline-none focus:border-primary text-sm font-bold text-text-main"
                  />
                  <Search
                    size={16}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-text-muted"
                  />

                  {showTickerSuggestions && ticker.trim() && (
                    <div className="absolute z-30 left-0 right-0 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-card-border bg-card shadow-2xl p-2 space-y-1">
                      {isSearchingTicker && (
                        <p className="px-3 py-2 text-xs text-text-muted font-semibold">
                          Mencari ticker...
                        </p>
                      )}

                      {!isSearchingTicker && tickerSuggestions.length === 0 && (
                        <p className="px-3 py-2 text-xs text-text-muted font-semibold">
                          Tidak ada hasil. Coba ticker lain.
                        </p>
                      )}

                      {!isSearchingTicker &&
                        tickerSuggestions.map((item) => (
                          <button
                            key={`${item.symbol}-${item.source || "src"}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setTicker(
                                String(item.symbol || "").toUpperCase(),
                              );
                              if (!name.trim() && item.name) {
                                setName(item.name);
                              }
                              setShowTickerSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-500/10 transition-colors"
                          >
                            <p className="text-sm font-black text-text-main">
                              {item.symbol}
                            </p>
                            <p className="text-[11px] text-text-muted font-semibold">
                              {item.name} • {item.exchange || "Market"}
                            </p>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-text-muted font-semibold">
                  Jika ticker diisi, aset otomatis dianggap dinamis (harga
                  live). Jika kosong, aset dianggap statis (nilai manual).
                </p>
              </div>

              {ticker.trim() ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-text-muted uppercase tracking-widest ml-1">
                      Jumlah
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      required
                      className="w-full bg-slate-500/5 border border-card-border rounded-2xl px-6 py-4 outline-none font-bold text-text-main focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-text-muted uppercase tracking-widest ml-1">
                      Harga Beli
                    </label>
                    <input
                      type="number"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      required
                      className="w-full bg-slate-500/5 border border-card-border rounded-2xl px-6 py-4 outline-none font-bold text-text-main focus:border-primary"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-text-muted uppercase tracking-widest ml-1">
                    Total Nilai Aset (IDR)
                  </label>
                  <input
                    type="number"
                    placeholder="5.000.000"
                    value={totalValue}
                    onChange={(e) => setTotalValue(e.target.value)}
                    required
                    className="w-full bg-slate-500/5 border border-card-border rounded-2xl px-6 py-4 outline-none font-black text-text-main text-lg focus:border-primary"
                  />
                </div>
              )}

              <div className="space-y-6 pt-2">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-text-muted uppercase tracking-widest ml-1">
                    Broker / Akun / Partner
                  </label>
                  <div className="relative">
                    <Building2
                      size={16}
                      className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                    <input
                      type="text"
                      placeholder="e.g. Stockbit / Nama Orang"
                      value={broker}
                      onChange={(e) => setBroker(e.target.value)}
                      className="w-full bg-slate-500/5 border-b border-card-border px-6 pl-14 py-4 outline-none focus:border-primary text-sm font-bold text-text-main"
                    />
                  </div>
                </div>

                <div className="bg-slate-500/5 p-5 rounded-2xl border border-card-border">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-3 block">
                    Transaction Date
                  </label>
                  <div className="relative">
                    <Calendar
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-primary"
                    />
                    <input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      required
                      className="w-full bg-card border border-card-border rounded-xl px-4 pl-12 py-3 outline-none text-sm font-bold text-text-main shadow-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-[11px] font-black text-text-muted uppercase tracking-widest ml-1">
                  Sumber Dana (Dompet) *
                </label>
                <div className="relative">
                  <Wallet
                    size={16}
                    className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <select
                    value={selectedWalletId}
                    onChange={(e) => setSelectedWalletId(e.target.value)}
                    required
                    className="w-full appearance-none bg-slate-500/5 border border-card-border rounded-2xl pl-14 pr-6 py-4 outline-none font-black text-text-main shadow-sm transition-all focus:border-primary"
                  >
                    <option value="">
                      {wallets.length > 0
                        ? "Pilih dompet..."
                        : "Daftarkan dompet dulu di Dashboard!"}
                    </option>
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatRp(w.balance)})
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={18}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || wallets.length === 0}
                className="w-full py-5 bg-primary hover:bg-primary/90 disabled:bg-slate-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/10 active:scale-95"
              >
                {isSubmitting ? "Mendaftarkan..." : "Konfirmasi Aset"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Yield Modal */}
      {isYieldModalOpen && activeAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in"
            onClick={() => setIsYieldModalOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-card border border-card-border rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-text-main tracking-tighter">
                Record Income
              </h2>
              <button
                onClick={() => setIsYieldModalOpen(false)}
                className="text-text-muted hover:text-text-main"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleYieldSubmit} className="space-y-6">
              <div className="bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/10 text-center">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">
                  Jumlah Hasil Diterima
                </p>
                <input
                  type="number"
                  value={yieldAmount}
                  onChange={(e) => setYieldAmount(e.target.value)}
                  required
                  className="w-full bg-transparent outline-none text-3xl font-black text-emerald-500 text-center"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-text-muted uppercase tracking-widest ml-1">
                  Masuk ke Dompet
                </label>
                <select
                  value={yieldWalletId}
                  onChange={(e) => setYieldWalletId(e.target.value)}
                  required
                  className="w-full bg-slate-500/5 border border-card-border rounded-xl px-4 py-4 font-black text-text-main outline-none focus:border-primary"
                >
                  <option value="">Pilih dompet...</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                Confirm Income
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assets;
