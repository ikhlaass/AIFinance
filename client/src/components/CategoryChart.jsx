import React from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

const CATEGORY_CACHE_TTL_MS = 2 * 60 * 1000;
const categoryCache = new Map();

function buildChartData(data, isExpense) {
  const bgColors = data.map((_, i) => {
    const opacities = [1, 0.8, 0.6, 0.4, 0.2];
    if (isExpense) {
      return `rgba(244, 63, 94, ${opacities[i % opacities.length]})`;
    }
    return `rgba(16, 185, 129, ${opacities[i % opacities.length]})`;
  });

  return {
    labels: data.map((d) => d.category),
    datasets: [
      {
        data: data.map((d) => Number(d.total)),
        backgroundColor: bgColors,
        borderWidth: 0,
        hoverOffset: 6,
        cutout: "80%",
        borderRadius: 20,
      },
    ],
  };
}

const CategoryChart = React.memo(({ type, label }) => {
  const isExpense = type === "expense";
  const [chartData, setChartData] = React.useState({
    labels: [label, "Lainnya"],
    datasets: [
      {
        data: [100, 0],
        backgroundColor: [
          isExpense ? "#f43f5e" : "#10b981",
          "var(--card-border)",
        ],
        borderWidth: 0,
        hoverOffset: 6,
        cutout: "80%",
        borderRadius: 20, // Membuat ujung donat tumpul layaknya sosis
      },
    ],
  });

  React.useEffect(() => {
    const cacheKey = `${type}`;
    const cached = categoryCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.fetchedAt < CATEGORY_CACHE_TTL_MS) {
      setChartData(cached.chartData);
      return;
    }

    const controller = new AbortController();

    fetch(`/api/categories/${type}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error && data.length > 0) {
          const nextData = buildChartData(data, isExpense);
          categoryCache.set(cacheKey, {
            chartData: nextData,
            fetchedAt: now,
          });
          setChartData(nextData);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error(`Error fetching category stats for ${type}:`, err);
        }
      });

    return () => controller.abort();
  }, [type, isExpense]);

  const options = {
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    maintainAspectRatio: false,
    responsive: true,
  };

  return (
    <div className="relative w-40 h-40 mx-auto drop-shadow-2xl transition-transform hover:scale-105 duration-300">
      <Doughnut data={chartData} options={options} />
      <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
        <span className="text-[10px] uppercase font-black text-text-main tracking-widest">
          {label}
        </span>
      </div>
    </div>
  );
});

export default CategoryChart;
