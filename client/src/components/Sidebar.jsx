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
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Bot, label: 'AI Assistant', badge: 'PRO' },
  { icon: PlusCircle, label: 'Tambah Transaksi' },
  { icon: ReceiptText, label: 'Transaksi' },
  { icon: Briefcase, label: 'Aset Tracker' },
  { icon: HandCoins, label: 'Hutang' },
  { icon: PieChart, label: 'Laporan' },
  { icon: Users, label: 'Affiliate' },
  { icon: HelpCircle, label: 'Bantuan' },
  { icon: Settings, label: 'Pengaturan' },
];

const Sidebar = ({ theme, toggleTheme, isOpen, onClose }) => {
  return (
    <aside className={cn(
      "w-64 bg-sidebar h-screen fixed left-0 top-0 flex flex-col text-gray-400 border-r border-card-border z-50 transition-transform duration-300 lg:translate-x-0",
      isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
    )}>
      {/* Logo Section */}
      <div className="p-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 text-white font-black text-xl">
            AF
          </div>
          <div className="lg:block">
            <h1 className="text-text-main font-black text-lg leading-tight uppercase tracking-tighter">AIFinance</h1>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Finance Automation</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-2 hover:bg-white/5 rounded-lg">
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item, index) => (
          <button
            key={index}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-bold",
              item.active
                ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/5 transition-all outline-none"
                : "hover:bg-sidebar-active/50 hover:text-gray-200"
            )}
          >
            <item.icon size={18} className={cn(item.active ? "text-blue-400" : "text-gray-500 group-hover:text-blue-400")} />
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <span className="bg-blue-500/10 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-md border border-blue-500/20">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Theme Toggle & User */}
      <div className="p-4 mt-auto space-y-4">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-sidebar-active/30 border border-card-border hover:border-blue-500/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon size={18} className="text-blue-400" /> : <Sun size={18} className="text-amber-400" />}
            <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
          <div className={cn(
            "w-8 h-4 rounded-full relative transition-all",
            theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'
          )}>
            <div className={cn(
              "absolute top-1 w-2 h-2 bg-white rounded-full transition-all",
              theme === 'dark' ? 'right-1' : 'left-1'
            )} />
          </div>
        </button>

        <div className="flex items-center gap-3 p-4 rounded-2xl bg-sidebar-active/30 border border-card-border hover:border-primary/30 transition-colors group cursor-pointer shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-sm font-black">
            I
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-text-main truncate">Idrus</h4>
            <p className="text-[10px] text-text-muted truncate font-medium">andiikhl***@gmail.com</p>
          </div>
        </div>

        <button className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-gray-500 hover:text-rose-400 hover:bg-rose-400/5 transition-all text-xs font-bold uppercase tracking-widest">
          <LogOut size={16} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
