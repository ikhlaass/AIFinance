import React from "react";
import { TrendingUp, TrendingDown, Wallet, PieChart } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const icons = {
  up: TrendingUp,
  down: TrendingDown,
  wallet: Wallet,
  chart: PieChart,
};

const StatCard = ({ title, value, type, trend, color }) => {
  const Icon = icons[type] || Wallet;
  const valueLength = String(value || "").length;
  const isLongValue = valueLength >= 13;
  const isVeryLongValue = valueLength >= 16;

  return (
    <div className="h-full min-h-[118px] rounded-2xl border border-card-border bg-card px-4 py-4 md:px-5 md:py-5 shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)] hover:border-primary/40 transition-all group">
      <div className="flex h-full items-center gap-3 md:gap-4">
        <div
          className={cn(
            "w-10 h-10 rounded-xl transition-transform group-hover:scale-105 duration-300 shrink-0 flex items-center justify-center",
            color === "emerald"
              ? "bg-emerald-500/10 text-emerald-500"
              : color === "rose"
                ? "bg-rose-500/10 text-rose-500"
                : color === "blue"
                  ? "bg-blue-500/10 text-blue-500"
                  : "bg-gray-500/10 text-gray-500",
          )}
        >
          <Icon size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.15em]">
            {title}
          </p>
          <h3
            className={cn(
              "mt-1 font-black text-text-main tracking-tight leading-none whitespace-nowrap tabular-nums",
              isVeryLongValue
                ? "text-[0.92rem] sm:text-[0.98rem] md:text-[1.04rem] lg:text-[1.1rem]"
                : isLongValue
                  ? "text-[0.98rem] sm:text-[1.04rem] md:text-[1.1rem] lg:text-[1.18rem]"
                  : "text-[1.05rem] sm:text-[1.12rem] md:text-[1.2rem] lg:text-[1.3rem]",
            )}
          >
            {value}
          </h3>
          {trend && (
            <p className="text-[10px] mt-2 text-emerald-500 font-bold tracking-wide uppercase">
              {trend}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
