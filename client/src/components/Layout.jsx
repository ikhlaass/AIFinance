import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Search, Bell, Plus, Menu } from 'lucide-react';

const Layout = ({ children, theme, toggleTheme, title = "Dashboard", subtitle = "Ringkasan keuangan Maret 2026" }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg-main text-text-main font-sans selection:bg-blue-500/30 transition-colors duration-300">
      <Sidebar 
        theme={theme} 
        toggleTheme={toggleTheme} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      {/* Mobile Header Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <main className="flex-1 lg:ml-64 p-4 md:p-8 lg:p-12 max-w-[1400px] transition-all">
        {/* Header */}
        <header className="flex justify-between items-center mb-8 md:mb-16 gap-4 md:gap-10">
          <div className="flex items-center gap-4 lg:hidden">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-3 bg-card border border-card-border rounded-2xl text-text-muted hover:text-text-main transition-all"
            >
              <Menu size={20} />
            </button>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-600/20">
              AF
            </div>
          </div>

          <div className="flex-1 hidden md:block max-w-xl">
            <h1 className="text-3xl font-black text-text-main tracking-tight mb-1">{title}</h1>
            <p className="text-sm text-text-muted font-medium tracking-wide">{subtitle}</p>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6">
            <button className="p-2.5 md:p-3.5 bg-card border border-card-border rounded-xl md:rounded-2xl text-text-muted hover:text-text-main transition-all relative shadow-sm">
              <Bell size={18} md:size={20} />
              <div className="absolute top-2 right-2 md:top-3 md:right-3 w-2 h-2 bg-blue-500 rounded-full border-2 border-card shadow-glow"></div>
            </button>
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 md:px-8 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl text-xs md:text-sm font-black flex items-center gap-2 md:gap-3 transition-all shadow-xl shadow-blue-600/20 active:scale-95 shadow-sm">
              <Plus size={18} md:size={20} />
              <span className="hidden sm:inline">Tambah Transaksi</span>
              <span className="sm:hidden">Tambah</span>
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
};

export default Layout;
