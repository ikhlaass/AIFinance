import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
);

const TREND_CACHE_TTL_MS = 2 * 60 * 1000;
let trendCache = null;

function buildTrendData(data) {
  return {
    labels: data.map((d) => d.date),
    datasets: [
      {
        fill: true,
        label: "Pengeluaran",
        data: data.map((d) => Number(d.total)),
        borderColor: "#0ea5e9",
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 250);
          gradient.addColorStop(0, "rgba(14, 165, 233, 0.5)");
          gradient.addColorStop(1, "rgba(14, 165, 233, 0.0)");
          return gradient;
        },
        borderWidth: 3,
        pointBackgroundColor: "#0ea5e9",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.4,
        cubicInterpolationMode: "monotone",
      },
    ],
  };
}

const TrendChart = React.memo(() => {
  const [chartData, setChartData] = React.useState({
    labels: [],
    datasets: [],
  });

  // Ambil warna dari variabel CSS sistem agar sinkron dengan Dark Mode
  const textColor = React.useMemo(() => {
    if (typeof window === "undefined") return "#94a3b8";
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue("--text-muted")
        .trim() || "#94a3b8"
    );
  }, []);

  const options = React.useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: "index",
          intersect: false,
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          titleColor: "#cbd5e1",
          bodyColor: "#ffffff",
          padding: 12,
          cornerRadius: 12,
          displayColors: false,
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || "";
              if (label) label += ": ";
              if (context.parsed.y !== null) {
                label += new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  minimumFractionDigits: 0,
                }).format(context.parsed.y);
              }
              return label;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: textColor, font: { size: 10, weight: "bold" } },
          border: { display: false },
        },
        y: {
          grid: { display: false, drawBorder: false },
          border: { display: false },
          ticks: { display: false },
        },
      },
    }),
    [textColor],
  );

  React.useEffect(() => {
    const now = Date.now();
    if (trendCache && now - trendCache.fetchedAt < TREND_CACHE_TTL_MS) {
      setChartData(trendCache.chartData);
      return;
    }

    const controller = new AbortController();

    fetch("/api/trends", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error && data.length > 0) {
          const nextData = buildTrendData(data);
          trendCache = {
            chartData: nextData,
            fetchedAt: now,
          };
          setChartData(nextData);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Error fetching trend:", err);
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="h-[250px] w-full">
      {chartData.labels.length > 0 ? (
        <Line options={options} data={chartData} />
      ) : (
        <div className="w-full h-full flex justify-center items-center text-xs text-text-muted">
          Loading chart / Belum ada data tren...
        </div>
      )}
    </div>
  );
});

export default TrendChart;
