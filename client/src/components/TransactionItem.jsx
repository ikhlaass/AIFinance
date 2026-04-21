import React from "react";
import { Plus, Minus } from "lucide-react";

const TransactionItem = ({ type, description, date, amount }) => {
  const isIncome = type === "income";

  return (
    <div className="flex items-center gap-4 py-4 px-6 rounded-2xl bg-card border border-card-border hover:border-primary/30 transition-all shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)]">
      <div
        className={`p-2 rounded-lg ${isIncome ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}
      >
        {isIncome ? <Plus size={20} /> : <Minus size={20} />}
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-medium text-text-main">{description}</h4>
        <span className="text-[10px] text-text-muted uppercase tracking-widest">
          {date}
        </span>
      </div>
      <div
        className={`text-sm font-bold ${isIncome ? "text-emerald-500" : "text-rose-500"}`}
      >
        {isIncome ? "+" : "-"}Rp{amount}
      </div>
    </div>
  );
};

export default TransactionItem;
