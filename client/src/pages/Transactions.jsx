import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Search,
  Filter,
  Trash2,
  Calendar,
  CreditCard,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  ChevronDown,
  Edit,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dropdown States
  const [activeDropdown, setActiveDropdown] = useState(null); // 'type', 'wallet', 'date', 'menu_id'
  const dropdownRef = useRef(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterWallet, setFilterWallet] = useState("");
  const [dateFilter, setDateFilter] = useState("Semua Waktu"); // Semua Waktu, Hari Ini, Minggu Ini, Bulan Ini, Custom
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const formatRp = (num) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    })
      .format(num || 0)
      .replace("IDR", "Rp");
  };

  const getRelativeDates = (filterName) => {
    const today = new Date();

    // Helper agar tidak terkena bug zona waktu (Timezone shift) seperti .toISOString()
    const getLocalYMD = (d) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    let start = "";
    let end = "";

    if (filterName === "Hari Ini") {
      start = end = getLocalYMD(today);
    } else if (filterName === "Minggu Ini") {
      // Menghindari mutasi objek asli
      const day = today.getDay(); // 0 (Minggu) sampai 6 (Sabtu)

      const startObj = new Date(today);
      startObj.setDate(today.getDate() - day);

      const endObj = new Date(startObj);
      endObj.setDate(startObj.getDate() + 6);

      start = getLocalYMD(startObj);
      end = getLocalYMD(endObj);
    } else if (filterName === "Bulan Ini") {
      const y = today.getFullYear();
      const m = today.getMonth();

      start = getLocalYMD(new Date(y, m, 1));
      end = getLocalYMD(new Date(y, m + 1, 0));
    }

    return { start, end };
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (filterType) params.type = filterType;
      if (filterWallet) params.wallet_id = filterWallet;

      if (dateFilter !== "Semua Waktu" && dateFilter !== "Custom") {
        const { start, end } = getRelativeDates(dateFilter);
        params.start_date = start;
        params.end_date = end;
      } else if (dateFilter === "Custom" && customStart && customEnd) {
        params.start_date = customStart;
        params.end_date = customEnd;
      }

      const res = await axios.get("/api/transactions", { params });
      setTransactions(res.data);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get("/api/wallets")
      .then((res) => setWallets(res.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions();
    }, 400);
    return () => clearTimeout(timer);
  }, [
    filterType,
    filterWallet,
    dateFilter,
    customStart,
    customEnd,
    searchQuery,
  ]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleExport = () => exportCSV();
    document.addEventListener("export-csv", handleExport);
    return () => document.removeEventListener("export-csv", handleExport);
  }, [transactions]);

  const handleDelete = async (id) => {
    if (!window.confirm("Yakin ingin menghapus transaksi ini?")) return;
    try {
      await axios.delete(`/api/transactions/${id}`);
      setActiveDropdown(null);
      fetchTransactions();
    } catch (error) {
      alert("Gagal menghapus transaksi");
    }
  };

  const handleEdit = (transaction) => {
    setActiveDropdown(null);
    document.dispatchEvent(
      new CustomEvent("edit-transaction", { detail: transaction }),
    );
  };

  const exportCSV = () => {
    if (transactions.length === 0) return alert("Tidak ada data");
    let csvContent =
      "data:text/csv;charset=utf-8,Tanggal,Deskripsi,Kategori,Tipe,Dompet,Nominal\n";
    transactions.forEach((t) => {
      csvContent += `"${t.date}","${t.description}","${t.category}","${t.type}","${t.wallet_name}","${t.amount}"\r\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Export_${new Date().getTime()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const groupTransactions = () => {
    let filtered = transactions;
    if (searchQuery) {
      filtered = filtered.filter(
        (t) =>
          (t.description || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (t.category || "").toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    return filtered.reduce((groups, t) => {
      const d = new Date(t.date);
      const day = d.toLocaleDateString("id-ID", { weekday: "long" });
      const rest = d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const dateStr = `${day.charAt(0).toUpperCase() + day.slice(1)}, ${rest}`;

      if (!groups[dateStr])
        groups[dateStr] = { date: dateStr, total: 0, items: [] };
      groups[dateStr].items.push(t);
      groups[dateStr].total +=
        t.type === "income" ? parseFloat(t.amount) : -parseFloat(t.amount);
      return groups;
    }, {});
  };

  const groupedData = groupTransactions();

  const selectedWalletName =
    wallets.find((w) => String(w.id) === String(filterWallet))?.name ||
    "Semua Dompet";
  const selectedTypeLabel =
    filterType === "income"
      ? "Pemasukan"
      : filterType === "expense"
        ? "Pengeluaran"
        : "Semua Tipe";

  const activeChips = [
    filterType ? `Tipe: ${selectedTypeLabel}` : null,
    filterWallet ? `Dompet: ${selectedWalletName}` : null,
    dateFilter !== "Semua Waktu" ? `Tanggal: ${dateFilter}` : null,
    searchQuery ? `Cari: ${searchQuery}` : null,
  ].filter(Boolean);

  const FilterButton = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveDropdown(activeDropdown === id ? null : id)}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-sm font-medium",
        activeDropdown === id
          ? "border-blue-500 text-blue-500 bg-blue-500/5"
          : "border-card-border text-text-muted hover:border-text-muted",
      )}
    >
      <Icon size={16} />
      <span className="text-xs font-bold">{label}</span>
      <ChevronDown size={14} />
    </button>
  );

  return (
    <div
      className="space-y-8 pb-20 animate-in fade-in duration-700 font-sans"
      ref={dropdownRef}
    >
      {/* SEARCH & FILTERS - Autofint Style */}
      <section className="bg-card border border-card-border rounded-xl shadow-sm overflow-visible">
        <div className="flex items-center px-4 py-3 border-b border-card-border/60">
          <Search size={18} className="text-text-muted mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Cari transaksi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-text-main placeholder-text-muted text-sm outline-none font-medium h-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 px-4 py-3 relative">
          <div className="relative">
            <FilterButton id="type" icon={Filter} label={selectedTypeLabel} />
            {activeDropdown === "type" && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-card border border-card-border shadow-xl rounded-xl z-40 py-2 overflow-hidden animate-in zoom-in-95">
                {["", "income", "expense"].map((t, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setFilterType(t);
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-body/50"
                  >
                    {t === ""
                      ? "Semua Tipe"
                      : t === "income"
                        ? "Pemasukan"
                        : "Pengeluaran"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <FilterButton
              id="wallet"
              icon={CreditCard}
              label={selectedWalletName}
            />
            {activeDropdown === "wallet" && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-card border border-card-border shadow-xl rounded-xl z-40 py-2 overflow-hidden animate-in zoom-in-95">
                <button
                  onClick={() => {
                    setFilterWallet("");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-body/50"
                >
                  Semua Dompet
                </button>
                {wallets.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setFilterWallet(w.id);
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-body/50"
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <FilterButton id="date" icon={Calendar} label={dateFilter} />
            {activeDropdown === "date" && (
              <div className="absolute top-full left-0 mt-2 w-52 bg-card border border-card-border shadow-xl rounded-xl z-40 py-2 overflow-hidden animate-in zoom-in-95">
                {[
                  "Semua Waktu",
                  "Hari Ini",
                  "Minggu Ini",
                  "Bulan Ini",
                  "Custom",
                ].map((d, i) => (
                  <div key={i}>
                    <button
                      onClick={() => {
                        setDateFilter(d);
                        if (d !== "Custom") setActiveDropdown(null);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-sm text-text-main hover:bg-body/50 flex items-center justify-between",
                        dateFilter === d &&
                          "text-blue-500 font-bold bg-blue-500/5",
                      )}
                    >
                      {d}
                      {dateFilter === d && <span className="text-xs">✓</span>}
                    </button>

                    {d === "Custom" && dateFilter === "Custom" && (
                      <div className="px-4 py-3 space-y-2 bg-body/30 border-t border-card-border/50">
                        <input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="w-full bg-body border border-card-border text-xs rounded px-2 py-1 outline-none text-text-main"
                        />
                        <input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="w-full bg-body border border-card-border text-xs rounded px-2 py-1 outline-none text-text-main"
                        />
                        <button
                          onClick={() => setActiveDropdown(null)}
                          className="w-full bg-blue-500 text-white text-xs py-1 rounded font-bold"
                        >
                          Terapkan
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            {activeChips.map((chip, idx) => (
              <span
                key={idx}
                className="text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* DATE-GROUPED TRANSACTIONS */}
      <section className="space-y-6">
        {isLoading ? (
          <div className="text-center py-6 text-sm text-text-muted">
            Memuat...
          </div>
        ) : Object.keys(groupedData).length === 0 ? (
          <div className="text-center py-10 text-text-muted text-sm border-2 border-dashed border-card-border rounded-xl">
            Tidak ada transaksi ditemukan.
          </div>
        ) : (
          Object.values(groupedData).map((group, index) => (
            <div
              key={index}
              className="animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              {/* Autofint Style Date Header */}
              <div className="flex justify-between items-end pb-2 mb-2 px-1">
                <h3 className="text-[13px] font-bold text-blue-500">
                  {group.date}
                </h3>
                <span
                  className={cn(
                    "text-[13px] font-bold",
                    group.total > 0
                      ? "text-emerald-500"
                      : group.total < 0
                        ? "text-rose-500"
                        : "text-text-muted",
                  )}
                >
                  {group.total > 0 ? "+" : ""}
                  {formatRp(group.total)}
                </span>
              </div>

              {/* Transactions Container (No heavy border) */}
              <div className="bg-card border border-card-border/60 rounded-xl overflow-visible divide-y divide-card-border/50 shadow-sm">
                {group.items.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 sm:px-5 min-h-[72px] hover:bg-body/20 transition-colors"
                  >
                    {/* Left: Round Icon & Labels */}
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border",
                          t.type === "income"
                            ? "bg-emerald-50 text-emerald-500 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                            : "bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20",
                        )}
                      >
                        {t.type === "income" ? (
                          <ArrowUpRight size={18} strokeWidth={2.5} />
                        ) : (
                          <ArrowDownRight size={18} strokeWidth={2.5} />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-text-main line-clamp-1">
                          {t.description || "Tanpa deskripsi"}
                        </span>
                        <span className="text-[11px] font-medium text-text-muted mt-0.5">
                          {t.category || "Umum"} &bull;{" "}
                          {t.wallet_name || "Cash"}
                        </span>
                      </div>
                    </div>

                    {/* Right: Amount & Dots */}
                    <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                      <span
                        className={cn(
                          "text-[14px] font-black whitespace-nowrap min-w-[110px] text-right",
                          t.type === "income"
                            ? "text-emerald-500"
                            : "text-rose-500",
                        )}
                      >
                        {t.type === "income" ? "+" : ""}
                        {formatRp(t.amount)}
                      </span>

                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveDropdown(
                              activeDropdown === t.id ? null : t.id,
                            )
                          }
                          className="p-1 px-2 text-text-muted hover:text-text-main transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {activeDropdown === t.id && (
                          <div className="absolute right-0 bottom-full mb-1 w-32 bg-card border border-card-border shadow-md rounded-md z-[60] py-1 animate-in zoom-in-95">
                            <button
                              onClick={() => handleEdit(t)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-text-main hover:bg-body/50 border-b border-card-border/50"
                            >
                              <Edit size={14} className="text-blue-500" /> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10"
                            >
                              <Trash2 size={14} /> Hapus
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};

export default Transactions;
