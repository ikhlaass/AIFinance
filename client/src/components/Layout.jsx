import React, { useState } from "react";
import Sidebar from "./Sidebar";
import TransactionModal from "./TransactionModal";
import { Plus, Menu, Download } from "lucide-react";
import { useLocation } from "react-router-dom";

const BrandMark = ({ compact = false }) => (
  <div
    className={
      compact
        ? "relative shrink-0 w-10 h-10 rounded-[0.95rem] bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-400 p-[1px] shadow-[0_8px_22px_rgba(14,165,233,0.28)]"
        : "relative shrink-0 w-12 h-12 rounded-[1.1rem] bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-400 p-[1px] shadow-[0_10px_30px_rgba(14,165,233,0.35)]"
    }
  >
    <div className="relative w-full h-full rounded-[inherit] bg-[#08111f] flex items-center justify-center overflow-hidden">
      <div className="absolute -right-1 -top-1 w-5 h-5 rounded-full bg-white/10 blur-sm"></div>
      <span
        className={
          compact
            ? "relative text-white font-black text-[13px] tracking-[-0.08em] leading-none"
            : "relative text-white font-black text-[15px] tracking-[-0.08em] leading-none"
        }
      >
        AF
      </span>
    </div>
  </div>
);

const Layout = ({ children, theme, toggleTheme }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState(null);
  const location = useLocation();

  React.useEffect(() => {
    const handleEditEvent = (e) => {
      setTransactionToEdit(e.detail);
      setIsModalOpen(true);
    };
    document.addEventListener("edit-transaction", handleEditEvent);
    return () =>
      document.removeEventListener("edit-transaction", handleEditEvent);
  }, []);

  // Menentukan Judul dan Subjudul Berdasarkan Halaman yang Aktif
  let title = "Dashboard";
  let subtitle = "Ringkasan keuangan Anda";

  if (location.pathname === "/transactions") {
    title = "Transaksi";
    subtitle = "Kelola semua riwayat keuangan";
  } else if (location.pathname === "/assets") {
    title = "Aset Tracker";
    subtitle = "Pantau portofolio & kekayaan bersih";
  } else if (location.pathname === "/debts") {
    title = "Hutang & Kewajiban";
    subtitle = "Kelola cicilan, pinjaman, dan tagihan";
  }

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
            <BrandMark compact />
          </div>

          <div className="flex-1 hidden md:block max-w-xl">
            <h1 className="text-3xl font-black text-text-main tracking-tight mb-1">
              {title}
            </h1>
            <p className="text-sm text-text-muted font-medium tracking-wide">
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {location.pathname === "/transactions" && (
              <button
                onClick={() =>
                  document.dispatchEvent(new CustomEvent("export-csv"))
                }
                className="flex items-center gap-2 px-3 md:px-4 py-2.5 md:py-3.5 bg-card border border-card-border rounded-xl md:rounded-2xl text-xs md:text-sm font-bold text-text-main hover:bg-body transition-all shadow-sm"
              >
                <Download size={18} className="text-blue-500" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}

            {(location.pathname === "/assets" ||
              location.pathname === "/transactions" ||
              location.pathname === "/debts") && (
              <button
                onClick={() => {
                  if (location.pathname === "/assets") {
                    document.dispatchEvent(new CustomEvent("open-asset-modal"));
                  } else if (location.pathname === "/debts") {
                    document.dispatchEvent(new CustomEvent("open-debt-modal"));
                  } else {
                    setIsModalOpen(true);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 md:px-8 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl text-xs md:text-sm font-black flex items-center gap-2 md:gap-3 transition-all shadow-xl shadow-blue-600/20 active:scale-95 shadow-sm"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">
                  {location.pathname === "/assets"
                    ? "Tambah Aset"
                    : location.pathname === "/debts"
                      ? "Tambah Hutang"
                      : "Tambah Transaksi"}
                </span>
                <span className="sm:hidden">Tambah</span>
              </button>
            )}
          </div>
        </header>

        {children}
      </main>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTransactionToEdit(null);
        }}
        onFinish={() => window.location.reload()}
        transactionToEdit={transactionToEdit}
      />
    </div>
  );
};

export default Layout;
