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

const TrendChart = () => {
  const [chartData, setChartData] = React.useState({
    labels: [],
    datasets: []
  });

  // Ambil warna dari variabel CSS sistem agar sinkron dengan Dark Mode
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#94a3b8';

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#cbd5e1',
        bodyColor: '#ffffff',
        padding: 12,
        cornerRadius: 12,
        displayColors: false,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(context.parsed.y);
            }
            return label;
          }
        }
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { color: textColor, font: { size: 10, weight: 'bold' } },
        border: { display: false }
      },
      y: {
        grid: { display: false, drawBorder: false },
        border: { display: false },
        ticks: { display: false },
      },
    },
  };

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
                backgroundColor: (context) => {
                  const ctx = context.chart.ctx;
                  const gradient = ctx.createLinearGradient(0, 0, 0, 250);
                  gradient.addColorStop(0, 'rgba(14, 165, 233, 0.5)'); // Terang di atas
                  gradient.addColorStop(1, 'rgba(14, 165, 233, 0.0)'); // Pudar di bawah
                  return gradient;
                },
                borderWidth: 3,
                pointBackgroundColor: '#0ea5e9',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 0, // Sembunyikan titik saat tidak disorot
                pointHoverRadius: 6,
                tension: 0.4, 
                cubicInterpolationMode: 'monotone', // Mencegah kurva bablas menembus garis di bawah nol (Overshoot)
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
