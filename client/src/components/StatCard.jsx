import React from 'react';
import { TrendingUp, TrendingDown, Wallet, PieChart } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const icons = {
  up: TrendingUp,
  down: TrendingDown,
  wallet: Wallet,
  chart: PieChart
};

const StatCard = ({ title, value, type, trend, color }) => {
  const Icon = icons[type] || Wallet;
  
  return (
    <div className="bg-card card-gradient p-6 rounded-[1.5rem] border border-card-border shadow-xl hover:shadow-2xl hover:border-primary/50 transition-all group">
      <div className="flex items-center gap-4">
        <div className={cn(
          "p-3 rounded-xl transition-transform group-hover:scale-110 duration-300",
          color === 'emerald' ? 'bg-emerald-500/10 text-emerald-500' :
          color === 'rose' ? 'bg-rose-500/10 text-rose-500' :
          color === 'blue' ? 'bg-blue-500/10 text-blue-500' :
          'bg-gray-500/10 text-gray-500'
        )}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-[10px] font-black text-text-muted mb-1 uppercase tracking-widest">{title}</p>
          <h3 className="text-xl font-black text-text-main tracking-tighter">{value}</h3>
          {trend && (
            <p className="text-[10px] mt-1 text-emerald-500 font-bold tracking-wide">{trend}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
