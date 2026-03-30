import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const CategoryChart = ({ type, label }) => {
  const isExpense = type === 'expense';
  const [chartData, setChartData] = React.useState({
    labels: [label, 'Lainnya'],
    datasets: [{
      data: [100, 0],
      backgroundColor: [isExpense ? '#f43f5e' : '#10b981', 'var(--card-border)'],
      borderWidth: 0,
      hoverOffset: 4,
      cutout: '75%',
    }]
  });

  React.useEffect(() => {
    fetch(`/api/categories/${type}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error && data.length > 0) {
          // If we have categories, we map them correctly
          const bgColors = data.map((_, i) => {
            if (isExpense) {
              const opacities = [1, 0.8, 0.6, 0.4, 0.2];
              return `rgba(244, 63, 94, ${opacities[i % opacities.length]})`;
            } else {
              const opacities = [1, 0.8, 0.6, 0.4, 0.2];
              return `rgba(16, 185, 129, ${opacities[i % opacities.length]})`;
            }
          });

          setChartData({
            labels: data.map(d => d.category),
            datasets: [{
              data: data.map(d => Number(d.total)),
              backgroundColor: bgColors,
              borderWidth: 0,
              hoverOffset: 4,
              cutout: '75%',
            }]
          });
        }
      })
      .catch(err => console.error(`Error fetching category stats for ${type}:`, err));
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
    <div className="relative w-32 h-32 mx-auto">
      <Doughnut data={chartData} options={options} />
      <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
        <span className="text-[10px] uppercase font-bold text-text-muted">{label}</span>
      </div>
    </div>
  );
};

export default CategoryChart;
