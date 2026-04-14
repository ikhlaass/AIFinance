import React, { useState, useEffect } from "react";
import TrendChart from "../components/TrendChart";
import CategoryChart from "../components/CategoryChart";
import TransactionItem from "../components/TransactionItem";
import WalletGrid from "../components/WalletGrid";
import StatCard from "../components/StatCard";
import AIInsightWidget from "../components/AIInsightWidget";
import { Bell, Search, Plus, ChevronRight, CreditCard } from "lucide-react";

const Dashboard = () => {
  const [summary, setSummary] = useState({
    income: 0,
    expense: 0,
    net_cash_flow: 0,
    net_worth: 0,
    total_assets_val: 0,
    cash_balance: 0,
    market_assets_val: 0,
    static_assets_val: 0,
    market_assets_count: 0,
    static_assets_count: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const formatRp = (num) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    })
      .format(Math.round(Number(num) || 0))
      .replace("IDR", "Rp");
  };

  const totalTrackedAssets =
    Number(summary.market_assets_val || 0) +
    Number(summary.static_assets_val || 0);
  const marketShare =
    totalTrackedAssets > 0
      ? (Number(summary.market_assets_val || 0) / totalTrackedAssets) * 100
      : 0;
  const staticShare =
    totalTrackedAssets > 0
      ? (Number(summary.static_assets_val || 0) / totalTrackedAssets) * 100
      : 0;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, transRes] = await Promise.all([
          fetch("/api/dashboard/summary").then((res) => res.json()),
          fetch("/api/transactions").then((res) => res.json()),
        ]);

        if (summaryRes) setSummary(summaryRes);
        if (transRes) setTransactions(transRes);
      } catch (error) {
        console.error("Dashboard API Error:", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    const handlePortfolioChanged = () => {
      fetchData();
    };

    document.addEventListener("portfolio-changed", handlePortfolioChanged);
    return () => {
      document.removeEventListener("portfolio-changed", handlePortfolioChanged);
    };
  }, []);

  return (
    <div className="space-y-12 pb-20 animate-in fade-in duration-700">
      {/* 0. AI INSIGHT WIDGET */}
      <AIInsightWidget />

      {/* 1. RINGKASAN CASH FLOW */}
      <section>
        <h2 className="text-sm font-bold text-text-main mb-6 uppercase tracking-widest flex items-center gap-4">
          Ringkasan Cash Flow -{" "}
          {new Date().toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard
            title="Pemasukan"
            value={formatRp(summary.income)}
            type="up"
            color="emerald"
          />
          <StatCard
            title="Pengeluaran"
            value={formatRp(summary.expense)}
            type="down"
            color="rose"
          />
          <StatCard
            title="Investasi"
            value={formatRp(summary.total_assets_val || 0)}
            type="chart"
            color="blue"
          />
          <StatCard
            title="Net Cash Flow"
            value={formatRp(summary.net_cash_flow)}
            type="wallet"
            color={summary.net_cash_flow >= 0 ? "emerald" : "rose"}
            trend={summary.net_cash_flow >= 0 ? "Surplus" : "Defisit"}
          />
        </div>
      </section>

      {/* 2. SALDO DOMPET */}
      <section className="space-y-6">
        <h2 className="text-sm font-bold text-text-main mb-4 uppercase tracking-widest">
          Saldo Dompet
        </h2>
        <div className="bg-card card-gradient rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 border border-card-border shadow-2xl relative overflow-hidden group transition-all">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-primary/10 transition-all duration-1000"></div>

          <div className="relative z-10 space-y-2">
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
              Total Saldo Dompet
            </p>
            <h2 className="text-3xl md:text-5xl font-black text-text-main tracking-tighter transition-all">
              {formatRp(summary.cash_balance)}
            </h2>
          </div>
        </div>

        <WalletGrid />
      </section>

      {/* 3. KEKAYAAN BERSIH */}
      <section className="space-y-6">
        <h2 className="text-sm font-bold text-text-main mb-4 uppercase tracking-widest">
          Kekayaan Bersih
        </h2>
        <div className="bg-card card-gradient rounded-[1.5rem] md:rounded-[2.5rem] p-8 md:p-12 border border-card-border shadow-2xl text-center group relative overflow-hidden transition-all">
          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <h2 className="text-4xl md:text-7xl font-black text-emerald-500 tracking-tighter group-hover:scale-105 transition-transform duration-500 relative z-10 transition-all">
            {formatRp(summary.net_worth)}
          </h2>
          <p className="text-[10px] text-text-muted mt-4 font-bold uppercase tracking-[0.2em] relative z-10">
            Cash + Nilai Aset Produktif
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-card-border rounded-[1.5rem] p-6 shadow-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">
              Aset Pasar
            </p>
            <h3 className="text-2xl font-black text-text-main mb-1">
              {formatRp(summary.market_assets_val || 0)}
            </h3>
            <p className="text-xs text-text-muted">
              {summary.market_assets_count || 0} aset dinamis •{" "}
              {marketShare.toFixed(1)}% dari aset terpantau
            </p>
          </div>
          <div className="bg-card border border-card-border rounded-[1.5rem] p-6 shadow-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">
              Aset Kontrak / Statis
            </p>
            <h3 className="text-2xl font-black text-text-main mb-1">
              {formatRp(summary.static_assets_val || 0)}
            </h3>
            <p className="text-xs text-text-muted">
              {summary.static_assets_count || 0} aset stabil •{" "}
              {staticShare.toFixed(1)}% dari aset terpantau
            </p>
          </div>
        </div>
      </section>

      {/* 4. TREN PENGELUARAN */}
      <section className="bg-card card-gradient rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 border border-card-border shadow-2xl transition-all">
        <h3 className="text-sm font-bold text-text-main mb-6 uppercase tracking-widest">
          Tren Pengeluaran (30 Hari Terakhir)
        </h3>
        <TrendChart />
      </section>

      {/* 5. PEMASUKAN & PENGELUARAN PER KATEGORI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-card card-gradient rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 border border-card-border shadow-xl transition-all hover:border-rose-500/20">
          <h3 className="text-sm font-bold text-text-main mb-8 uppercase tracking-widest">
            Pengeluaran per Kategori
          </h3>
          <CategoryChart type="expense" label="Pengeluaran" />
          <div className="mt-8 flex justify-between items-center text-xs">
            <span className="text-text-muted font-bold uppercase tracking-widest">
              Pengeluaran
            </span>
            <span className="text-text-main font-black text-lg">
              {formatRp(summary.expense)}
            </span>
          </div>
        </section>

        <section className="bg-card card-gradient rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 border border-card-border shadow-xl transition-all hover:border-emerald-500/20">
          <h3 className="text-sm font-bold text-text-main mb-8 uppercase tracking-widest">
            Pemasukan per Kategori
          </h3>
          <CategoryChart type="income" label="Pemasukan" />
          <div className="mt-8 flex justify-between items-center text-xs">
            <span className="text-text-muted font-bold uppercase tracking-widest">
              Pemasukan
            </span>
            <span className="text-text-main font-black text-lg">
              {formatRp(summary.income)}
            </span>
          </div>
        </section>
      </div>

      {/* 6. TRANSAKSI TERBARU */}
      <section className="bg-card card-gradient rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 border border-card-border shadow-2xl transition-all">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-sm font-bold text-text-main uppercase tracking-widest">
            Transaksi Terbaru
          </h3>
          <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:text-primary transition-colors">
            Lihat semua
          </button>
        </div>
        <div className="space-y-3 md:space-y-4">
          {transactions.length > 0 ? (
            transactions.map((t, idx) => (
              <TransactionItem
                key={t.id || idx}
                type={t.type}
                description={t.description || t.category}
                date={new Date(t.date).toLocaleDateString()}
                amount={formatRp(t.amount).replace("Rp", "")}
              />
            ))
          ) : (
            <p className="text-xs text-text-muted text-center py-4">
              Belum ada transaksi.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
