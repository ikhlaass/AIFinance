import React from "react";
import {
  LayoutDashboard,
  Bot,
  PlusCircle,
  ReceiptText,
  Briefcase,
  HandCoins,
  PieChart,
  Users,
  HelpCircle,
  Settings,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { NavLink } from "react-router-dom";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: ReceiptText, label: "Transaksi", path: "/transactions" },
  { icon: Briefcase, label: "Aset Tracker", path: "/assets" },
  { icon: HandCoins, label: "Hutang", path: "/debts" },
  { icon: PieChart, label: "Laporan", path: "/reports" },
  { icon: Users, label: "Affiliate", disabled: true },
  { icon: HelpCircle, label: "Bantuan", disabled: true },
  { icon: Settings, label: "Pengaturan", disabled: true },
];

const Sidebar = ({ theme, toggleTheme, isOpen, onClose }) => {
  const isLight = theme === "light";

  return (
    <aside
      className={cn(
        "w-64 bg-sidebar h-screen fixed left-0 top-0 flex flex-col text-gray-400 border-r border-card-border z-50 transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
      )}
    >
      {/* Logo Section */}
      <div className="p-7 pb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0 w-12 h-12 rounded-[1.1rem] bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-400 p-[1px] shadow-[0_10px_30px_rgba(14,165,233,0.35)]">
            <div
              className={cn(
                "relative w-full h-full rounded-[1.05rem] flex items-center justify-center overflow-hidden transition-colors duration-300 border",
                isLight
                  ? "bg-white border-slate-200 text-slate-900"
                  : "bg-slate-950/70 border-white/10 backdrop-blur-md text-white",
              )}
            >
              <div
                className={cn(
                  "absolute -right-1 -top-1 w-5 h-5 rounded-full blur-sm",
                  isLight ? "bg-sky-400/10" : "bg-cyan-300/20",
                )}
              ></div>
              <span
                className={cn(
                  "relative font-black text-[15px] tracking-[-0.08em] leading-none",
                  isLight ? "text-slate-900" : "text-white",
                )}
              >
                AF
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-text-main font-black text-[15px] leading-none uppercase tracking-[0.22em] truncate">
              AIFinance
            </h1>
            <p className="mt-1 text-[10px] text-text-muted font-bold uppercase tracking-[0.3em] truncate">
              Finance Automation
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className={cn(
            "lg:hidden p-2 rounded-lg transition-colors",
            isLight ? "hover:bg-slate-100" : "hover:bg-white/5",
          )}
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item, index) => (
          <NavLink
            key={index}
            to={item.path || "#"}
            onClick={item.disabled ? (e) => e.preventDefault() : onClose}
            className={({ isActive }) =>
              cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-bold",
                isActive && !item.disabled
                  ? isLight
                    ? "bg-blue-50 text-blue-600 border border-blue-200 shadow-sm outline-none"
                    : "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/5 outline-none"
                  : isLight
                    ? "hover:bg-slate-100 hover:text-slate-800 text-slate-500"
                    : "hover:bg-sidebar-active/50 hover:text-gray-200 text-gray-400",
                item.disabled && "opacity-50 cursor-not-allowed",
              )
            }
          >
            <item.icon
              size={18}
              className={cn(
                "transition-colors",
                isLight
                  ? "text-slate-400 group-hover:text-blue-600"
                  : "text-gray-500 group-hover:text-blue-400",
              )}
            />
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <span className="bg-blue-500/10 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-md border border-blue-500/20">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Theme Toggle & User */}
      <div className="p-4 mt-auto space-y-4">
        <button
          onClick={toggleTheme}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all group",
            isLight
              ? "bg-slate-50 border-slate-200 hover:border-blue-300"
              : "bg-sidebar-active/30 border-card-border hover:border-blue-500/30",
          )}
        >
          <div className="flex items-center gap-3">
            {theme === "dark" ? (
              <Moon size={18} className="text-blue-400" />
            ) : (
              <Sun size={18} className="text-amber-400" />
            )}
            <span
              className={cn(
                "text-xs font-bold uppercase tracking-widest",
                isLight ? "text-slate-600" : "text-gray-300",
              )}
            >
              {theme === "dark" ? "Dark Mode" : "Light Mode"}
            </span>
          </div>
          <div
            className={cn(
              "w-8 h-4 rounded-full relative transition-all",
              theme === "dark" ? "bg-blue-600" : "bg-gray-300",
            )}
          >
            <div
              className={cn(
                "absolute top-1 w-2 h-2 bg-white rounded-full transition-all",
                theme === "dark" ? "right-1" : "left-1",
              )}
            />
          </div>
        </button>

        <div
          className={cn(
            "flex items-center gap-3 p-4 rounded-2xl border transition-colors group cursor-pointer shadow-sm",
            isLight
              ? "bg-slate-50 border-slate-200 hover:border-blue-300"
              : "bg-sidebar-active/30 border-card-border hover:border-primary/30",
          )}
        >
          <div
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black",
              isLight
                ? "bg-blue-100 text-blue-700"
                : "bg-emerald-500/20 text-emerald-500",
            )}
          >
            I
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-text-main truncate">Idrus</h4>
            <p className="text-[10px] text-text-muted truncate font-medium">
              andiikhl***@gmail.com
            </p>
          </div>
        </div>

        <button
          className={cn(
            "w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all text-xs font-bold uppercase tracking-widest",
            isLight
              ? "text-slate-500 hover:text-rose-500 hover:bg-rose-50"
              : "text-gray-500 hover:text-rose-400 hover:bg-rose-400/5",
          )}
        >
          <LogOut size={16} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
