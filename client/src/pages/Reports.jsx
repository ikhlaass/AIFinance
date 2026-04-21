import React, { useEffect, useMemo, useState } from "react";
import {
  FileDown,
  CalendarRange,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  Landmark,
  Scale,
  BarChart3,
  PieChart,
  Store,
  Sparkles,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

const formatRp = (num) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  })
    .format(Math.round(Number(num) || 0))
    .replace("IDR", "Rp");

const formatMonth = (ym) => {
  if (!ym || !String(ym).includes("-")) return ym;
  const [year, month] = String(ym).split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
};

const emptyReport = {
  period: {
    periodKey: "this-month",
    label: "Bulan Ini",
    startDate: "",
    endDate: "",
  },
  summary: {
    income: 0,
    expense: 0,
    investment: 0,
    netCashFlow: 0,
    savingsRate: 0,
  },
  position: {
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0,
  },
  monthlyTrend: [],
  categories: {
    income: [],
    expense: [],
  },
  topMerchants: [],
  comparison: {
    income: 0,
    investment: 0,
    expense: 0,
    net: 0,
  },
};

const panelClass =
  "rounded-[1.35rem] border border-card-border bg-card p-4 md:p-5 shadow-[0_10px_28px_rgba(15,23,42,0.08)]";

const SummaryCard = ({ title, value, tone, icon: Icon, footer }) => (
  <div
    className={`${panelClass} h-full min-h-[120px] flex flex-col justify-between text-center`}
  >
    <div className="flex flex-col items-center gap-3 md:gap-4">
      <div
        className={`w-10 h-10 md:w-11 md:h-11 shrink-0 rounded-2xl flex items-center justify-center ${tone}`}
      >
        <Icon size={17} />
      </div>
      <div className="min-w-0 w-full">
        <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-black text-center">
          {title}
        </p>
        <h3 className="mt-1 text-[1.02rem] sm:text-[1.08rem] md:text-[1.15rem] lg:text-[1.22rem] xl:text-[1.3rem] font-black text-text-main tracking-tight leading-none whitespace-nowrap tabular-nums text-center">
          {value}
        </h3>
      </div>
    </div>
    <div className="mt-2 min-h-[14px]">
      {footer ? (
        <p className="text-[10px] font-bold text-text-muted text-center">
          {footer}
        </p>
      ) : null}
    </div>
  </div>
);

const Reports = () => {
  const [report, setReport] = useState(emptyReport);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("this-month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (period === "custom" && customStart && customEnd) {
        params.set("start_date", customStart);
        params.set("end_date", customEnd);
      }

      const response = await fetch(
        `/api/reports/overview?${params.toString()}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memuat laporan");

      setReport({
        ...emptyReport,
        ...data,
        summary: { ...emptyReport.summary, ...(data.summary || {}) },
        position: { ...emptyReport.position, ...(data.position || {}) },
        categories: {
          income: data.categories?.income || [],
          expense: data.categories?.expense || [],
        },
        comparison: { ...emptyReport.comparison, ...(data.comparison || {}) },
      });
    } catch (error) {
      console.error("Report fetch error:", error);
      setReport(emptyReport);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (period === "custom" && (!customStart || !customEnd)) return;
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customStart, customEnd]);

  const trendData = useMemo(() => {
    const labels = report.monthlyTrend.map((item) => formatMonth(item.month));

    return {
      labels,
      datasets: [
        {
          label: "Pemasukan",
          data: report.monthlyTrend.map((item) => Number(item.income) || 0),
          backgroundColor: "rgba(16,185,129,0.75)",
          borderRadius: 8,
        },
        {
          label: "Pengeluaran",
          data: report.monthlyTrend.map((item) => Number(item.expense) || 0),
          backgroundColor: "rgba(244,63,94,0.75)",
          borderRadius: 8,
        },
        {
          label: "Investasi",
          data: report.monthlyTrend.map((item) => Number(item.investment) || 0),
          backgroundColor: "rgba(59,130,246,0.75)",
          borderRadius: 8,
        },
      ],
    };
  }, [report.monthlyTrend]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    plugins: {
      legend: { display: false },
    },
  };

  const incomeCategoryData = useMemo(
    () => ({
      labels: report.categories.income.map((item) => item.category),
      datasets: [
        {
          data: report.categories.income.map((item) => Number(item.total) || 0),
          backgroundColor: [
            "#10b981",
            "#34d399",
            "#6ee7b7",
            "#a7f3d0",
            "#059669",
            "#22c55e",
          ],
          borderWidth: 0,
        },
      ],
    }),
    [report.categories.income],
  );

  const expenseCategoryData = useMemo(
    () => ({
      labels: report.categories.expense.map((item) => item.category),
      datasets: [
        {
          data: report.categories.expense.map(
            (item) => Number(item.total) || 0,
          ),
          backgroundColor: [
            "#f43f5e",
            "#fb7185",
            "#fda4af",
            "#fecdd3",
            "#e11d48",
            "#ef4444",
          ],
          borderWidth: 0,
        },
      ],
    }),
    [report.categories.expense],
  );

  const topBase = Math.max(
    Number(report.comparison.income) || 0,
    Number(report.comparison.investment) || 0,
    Number(report.comparison.expense) || 0,
    1,
  );

  const topMerchantBase = Math.max(
    ...report.topMerchants.map((item) => Number(item.total) || 0),
    1,
  );

  const totalIncomeCategory = report.categories.income.reduce(
    (sum, item) => sum + (Number(item.total) || 0),
    0,
  );

  const totalExpenseCategory = report.categories.expense.reduce(
    (sum, item) => sum + (Number(item.total) || 0),
    0,
  );

  const debtToAssetRatio =
    Number(report.position.totalAssets) > 0
      ? (Number(report.position.totalLiabilities || 0) /
          Number(report.position.totalAssets || 0)) *
        100
      : 0;

  const exportCsv = () => {
    const rows = [
      ["Metrik", "Nominal"],
      ["Pemasukan", report.summary.income],
      ["Pengeluaran", report.summary.expense],
      ["Investasi", report.summary.investment],
      ["Net Cash Flow", report.summary.netCashFlow],
      ["Total Aset", report.position.totalAssets],
      ["Total Kewajiban", report.position.totalLiabilities],
      ["Kekayaan Bersih", report.position.netWorth],
    ];

    const csv =
      "data:text/csv;charset=utf-8," + rows.map((r) => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `laporan-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-20 animate-in fade-in duration-700">
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-3 items-stretch">
        <div className="rounded-2xl border border-card-border bg-card/95 px-4 py-4 md:px-5 md:py-4 shadow-[0_8px_22px_rgba(15,23,42,0.08)] flex items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted font-black">
              Ringkasan Periode
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm md:text-base font-black text-text-main leading-none">
                {report.period.label || "Bulan Ini"}
              </span>
              {report.period.startDate && report.period.endDate ? (
                <span className="text-xs text-text-muted leading-none">
                  {report.period.startDate} s/d {report.period.endDate}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-card-border bg-card/95 p-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-card-border bg-card text-sm font-bold text-text-main hover:bg-body/70"
          >
            <FileDown size={16} /> PDF
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-card-border bg-card text-sm font-bold text-text-main hover:bg-body/70"
          >
            <FileDown size={16} /> CSV
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-card-border bg-card min-w-[170px]">
            <CalendarRange size={16} className="text-text-muted" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-text-main outline-none"
            >
              <option value="this-month">Bulan Ini</option>
              <option value="last-3-months">3 Bulan Terakhir</option>
              <option value="this-year">Tahun Ini</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </section>

      {period === "custom" ? (
        <section className={`${panelClass} flex flex-wrap items-center gap-3`}>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-3 py-2 rounded-xl border border-card-border bg-body/50 text-sm text-text-main outline-none"
          />
          <span className="text-sm text-text-muted">sampai</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-2 rounded-xl border border-card-border bg-body/50 text-sm text-text-main outline-none"
          />
        </section>
      ) : null}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Pemasukan"
          value={formatRp(report.summary.income)}
          icon={TrendingUp}
          tone="bg-emerald-500/10 text-emerald-500"
        />
        <SummaryCard
          title="Total Pengeluaran"
          value={formatRp(report.summary.expense)}
          icon={TrendingDown}
          tone="bg-rose-500/10 text-rose-500"
        />
        <SummaryCard
          title="Total Investasi"
          value={formatRp(report.summary.investment)}
          icon={PiggyBank}
          tone="bg-blue-500/10 text-blue-500"
        />
        <SummaryCard
          title="Net Cash Flow"
          value={formatRp(report.summary.netCashFlow)}
          icon={Wallet}
          tone={
            report.summary.netCashFlow >= 0
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-rose-500/10 text-rose-500"
          }
          footer={`Saving Rate: ${Number(report.summary.savingsRate || 0).toFixed(1)}%`}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="Total Aset"
          value={formatRp(report.position.totalAssets)}
          icon={Landmark}
          tone="bg-emerald-500/10 text-emerald-500"
          footer={`Debt Ratio: ${debtToAssetRatio.toFixed(1)}%`}
        />
        <SummaryCard
          title="Total Kewajiban"
          value={formatRp(report.position.totalLiabilities)}
          icon={TrendingDown}
          tone="bg-rose-500/10 text-rose-500"
        />
        <SummaryCard
          title="Kekayaan Bersih"
          value={formatRp(report.position.netWorth)}
          icon={Scale}
          tone="bg-sky-500/10 text-sky-500"
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={panelClass}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-text-muted" />
            <h3 className="text-xl font-black text-text-main">Tren Bulanan</h3>
          </div>
          <div className="h-[280px]">
            {report.monthlyTrend.length > 0 ? (
              <Bar
                data={trendData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "bottom" },
                  },
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted text-sm">
                Belum ada data transaksi pada periode ini
              </div>
            )}
          </div>
        </div>

        <div className={panelClass}>
          <div className="flex items-center gap-2 mb-4">
            <PieChart size={18} className="text-text-muted" />
            <h3 className="text-xl font-black text-text-main">
              Pemasukan per Kategori
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-center">
            <div className="h-[220px]">
              {report.categories.income.length > 0 ? (
                <Doughnut data={incomeCategoryData} options={doughnutOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-text-muted text-sm">
                  Belum ada data pemasukan
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-[220px] overflow-auto pr-1 custom-scrollbar">
              {report.categories.income.map((item, idx) => {
                const val = Number(item.total) || 0;
                const pct =
                  totalIncomeCategory > 0
                    ? (val / totalIncomeCategory) * 100
                    : 0;
                return (
                  <div
                    key={`${item.category}-${idx}`}
                    className="rounded-xl border border-card-border bg-body/30 p-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm font-bold">
                      <span className="text-text-main truncate">
                        {item.category}
                      </span>
                      <span className="text-emerald-500">{formatRp(val)}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      {pct.toFixed(1)}% kontribusi
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={panelClass}>
          <div className="flex items-center gap-2 mb-4">
            <PieChart size={18} className="text-text-muted" />
            <h3 className="text-xl font-black text-text-main">
              Pengeluaran per Kategori
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-center">
            <div className="h-[220px]">
              {report.categories.expense.length > 0 ? (
                <Doughnut
                  data={expenseCategoryData}
                  options={doughnutOptions}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-text-muted text-sm">
                  Belum ada data pengeluaran
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-[220px] overflow-auto pr-1 custom-scrollbar">
              {report.categories.expense.map((item, idx) => {
                const val = Number(item.total) || 0;
                const pct =
                  totalExpenseCategory > 0
                    ? (val / totalExpenseCategory) * 100
                    : 0;
                return (
                  <div
                    key={`${item.category}-${idx}`}
                    className="rounded-xl border border-card-border bg-body/30 p-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm font-bold">
                      <span className="text-text-main truncate">
                        {item.category}
                      </span>
                      <span className="text-rose-500">{formatRp(val)}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      {pct.toFixed(1)}% kontribusi
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={panelClass}>
          <div className="flex items-center gap-2 mb-4">
            <Store size={18} className="text-text-muted" />
            <h3 className="text-xl font-black text-text-main">
              Merchant Teratas
            </h3>
          </div>

          {report.topMerchants.length > 0 ? (
            <div className="space-y-3">
              {report.topMerchants.map((item, idx) => {
                const pct = Math.min(
                  100,
                  ((Number(item.total) || 0) / topMerchantBase) * 100,
                );
                return (
                  <div
                    key={`${item.merchant}-${idx}`}
                    className="rounded-xl border border-card-border p-3 bg-body/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-text-main truncate">
                        {idx + 1}. {item.merchant}
                      </p>
                      <p className="text-sm font-black text-rose-500">
                        {formatRp(item.total)}
                      </p>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-body/70 overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      {item.count} transaksi
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-text-muted text-sm">
              Belum ada data merchant
            </div>
          )}
        </div>
      </section>

      <section className={`${panelClass} space-y-5`}>
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-text-muted" />
          <h3 className="text-xl font-black text-text-main">
            Ringkasan Perbandingan
          </h3>
        </div>

        {[
          {
            label: "Pemasukan",
            value: Number(report.comparison.income) || 0,
            color: "bg-emerald-500",
            text: "text-emerald-500",
          },
          {
            label: "Investasi",
            value: Number(report.comparison.investment) || 0,
            color: "bg-blue-500",
            text: "text-blue-500",
          },
          {
            label: "Pengeluaran",
            value: Number(report.comparison.expense) || 0,
            color: "bg-rose-500",
            text: "text-rose-500",
          },
        ].map((row) => (
          <div key={row.label} className="space-y-2">
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-text-main">{row.label}</span>
              <span className={row.text}>{formatRp(row.value)}</span>
            </div>
            <div className="w-full h-3 rounded-full bg-body/60 overflow-hidden">
              <div
                className={`h-full ${row.color}`}
                style={{
                  width: `${Math.min(100, (row.value / topBase) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}

        <div className="pt-2 border-t border-card-border flex items-center justify-between">
          <span className="text-sm font-bold text-text-main">
            Selisih Bersih
          </span>
          <span
            className={`text-2xl font-black ${
              Number(report.comparison.net) >= 0
                ? "text-emerald-500"
                : "text-rose-500"
            }`}
          >
            {Number(report.comparison.net) >= 0 ? "+" : ""}
            {formatRp(report.comparison.net)}
          </span>
        </div>
      </section>

      {isLoading ? (
        <div className="text-sm text-text-muted font-medium">
          Memuat laporan...
        </div>
      ) : null}
    </div>
  );
};

export default Reports;
