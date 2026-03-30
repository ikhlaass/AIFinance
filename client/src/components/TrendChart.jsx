import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler
);

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: 'var(--card-bg)',
      titleColor: 'var(--text-muted)',
      bodyColor: 'var(--text-main)',
      borderColor: 'var(--card-border)',
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: 'var(--text-muted)', font: { size: 10 } },
    },
    y: {
      grid: { color: 'var(--card-border)', drawBorder: false },
      ticks: { 
        color: 'var(--text-muted)', 
        font: { size: 10 },
        callback: (value) => value > 1000 ? (value/1000) + 'k' : value
      },
    },
  },
};

const TrendChart = () => {
  const [chartData, setChartData] = React.useState({
    labels: [],
    datasets: []
  });

  React.useEffect(() => {
    fetch('/api/trends')
      .then(res => res.json())
      .then(data => {
        if (!data.error && data.length > 0) {
          setChartData({
            labels: data.map(d => d.date),
            datasets: [
              {
                fill: true,
                label: 'Pengeluaran',
                data: data.map(d => Number(d.total)),
                borderColor: '#0ea5e9',
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                borderWidth: 2,
                pointRadius: 3,
                tension: 0.4,
              },
            ],
          });
        }
      })
      .catch(err => console.error("Error fetching trend:", err));
  }, []);

  return (
    <div className="h-[250px] w-full">
      {chartData.labels.length > 0 ? (
        <Line options={options} data={chartData} />
      ) : (
        <div className="w-full h-full flex justify-center items-center text-xs text-text-muted">Loading chart / Belum ada data tren...</div>
      )}
    </div>
  );
};

export default TrendChart;
