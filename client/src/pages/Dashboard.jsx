import React, { useState, useEffect } from "react";
import TrendChart from "../components/TrendChart";
import CategoryChart from "../components/CategoryChart";
import TransactionItem from "../components/TransactionItem";
import WalletGrid from "../components/WalletGrid";
import AIInsightWidget from "../components/AIInsightWidget";
import { TrendingUp, TrendingDown, PiggyBank, Wallet } from "lucide-react";

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

  const cashflowCards = [
    {
      key: "income",
      title: "Pemasukan",
      value: formatRp(summary.income),
      Icon: TrendingUp,
      tone: "bg-emerald-500/10 text-emerald-500",
    },
    {
      key: "expense",
      title: "Pengeluaran",
      value: formatRp(summary.expense),
      Icon: TrendingDown,
      tone: "bg-rose-500/10 text-rose-500",
    },
    {
      key: "investment",
      title: "Investasi",
      value: formatRp(summary.total_assets_val || 0),
      Icon: PiggyBank,
      tone: "bg-blue-500/10 text-blue-500",
    },
    {
      key: "net-cash-flow",
      title: "Net Cash Flow",
      value: formatRp(summary.net_cash_flow),
      Icon: Wallet,
      tone:
        summary.net_cash_flow >= 0
          ? "bg-emerald-500/10 text-emerald-500"
          : "bg-rose-500/10 text-rose-500",
      footer: summary.net_cash_flow >= 0 ? "Surplus" : "Defisit",
      footerTone:
        summary.net_cash_flow >= 0 ? "text-emerald-500" : "text-rose-500",
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-10 pb-20 animate-in fade-in duration-700">
      <AIInsightWidget />

      <section className="space-y-5">
        <h2 className="text-sm font-bold text-text-main uppercase tracking-widest flex items-center gap-4">
          Ringkasan Cash Flow -{" "}
          {new Date().toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {cashflowCards.map((card) => (
            <article
              key={card.key}
              className="rounded-2xl border border-card-border bg-card/95 px-4 py-4 md:px-5 md:py-4 shadow-[0_8px_22px_rgba(15,23,42,0.08)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)] transition-all"
            >
              <div className="flex flex-col items-center text-center gap-2.5">
                <div
                  className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${card.tone}`}
                >
                  <card.Icon size={17} />
                </div>
                <div className="min-w-0 w-full">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">
                    {card.title}
                  </p>
                  <p className="mt-1 text-[1.04rem] md:text-[1.14rem] font-black leading-none tracking-tight text-text-main whitespace-nowrap tabular-nums overflow-hidden text-ellipsis">
                    {card.value}
                  </p>
                  {card.footer ? (
                    <p
                      className={`mt-1.5 text-[10px] font-bold uppercase tracking-wide ${card.footerTone || "text-text-muted"}`}
                    >
                      {card.footer}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-sm font-bold text-text-main mb-4 uppercase tracking-widest">
          Saldo Dompet
        </h2>
        <div className="bg-card card-gradient rounded-[1.75rem] md:rounded-[2rem] p-6 md:p-8 border border-card-border shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)] relative overflow-hidden group transition-all">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-primary/10 transition-all duration-1000" />

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

      <section className="space-y-6">
        <h2 className="text-sm font-bold text-text-main mb-4 uppercase tracking-widest">
          Kekayaan Bersih
        </h2>
        <div className="bg-card card-gradient rounded-[1.75rem] md:rounded-[2rem] p-8 md:p-10 border border-card-border shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)] text-center group relative overflow-hidden transition-all">
          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <h2 className="text-4xl md:text-7xl font-black text-emerald-500 tracking-tighter group-hover:scale-105 transition-transform duration-500 relative z-10 transition-all">
            {formatRp(summary.net_worth)}
          </h2>
          <p className="text-[10px] text-text-muted mt-4 font-bold uppercase tracking-[0.2em] relative z-10">
            Cash + Nilai Aset Produktif
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-card-border rounded-[1.5rem] p-6 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
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
          <div className="bg-card border border-card-border rounded-[1.5rem] p-6 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
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

      <section className="bg-card card-gradient rounded-[1.75rem] md:rounded-[2rem] p-6 md:p-8 border border-card-border shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)] transition-all">
        <h3 className="text-sm font-bold text-text-main mb-6 uppercase tracking-widest">
          Tren Pengeluaran (30 Hari Terakhir)
        </h3>
        <TrendChart />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-card card-gradient rounded-[1.75rem] md:rounded-[2rem] p-6 md:p-8 border border-card-border shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)] transition-all hover:border-rose-500/20">
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

        <section className="bg-card card-gradient rounded-[1.75rem] md:rounded-[2rem] p-6 md:p-8 border border-card-border shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)] transition-all hover:border-emerald-500/20">
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

      <section className="bg-card card-gradient rounded-[1.75rem] md:rounded-[2rem] p-6 md:p-8 border border-card-border shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)] transition-all">
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
