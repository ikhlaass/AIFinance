import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Calendar, DollarSign, Tag, FileText, CreditCard, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const TransactionModal = ({ isOpen, onClose, onFinish, transactionToEdit }) => {
  const [wallets, setWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [walletId, setWalletId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (isOpen) {
      axios.get('/api/wallets').then(res => {
        setWallets(res.data);
        if (res.data.length > 0 && !transactionToEdit) setWalletId(res.data[0].id);
      }).catch(console.error);
    }
  }, [isOpen]);

  // Efek memori saat tombol edit diklik
  useEffect(() => {
    if (isOpen && transactionToEdit) {
      setType(transactionToEdit.type || 'expense');
      setAmount(transactionToEdit.amount || '');
      setCategory(transactionToEdit.category || '');
      setDescription(transactionToEdit.description || '');
      setWalletId(transactionToEdit.wallet_id || '');
      if (transactionToEdit.date) {
        setDate(transactionToEdit.date.split('T')[0]);
      }
    } else if (isOpen) {
      setType('expense');
      setAmount('');
      setCategory('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, transactionToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !category || !walletId) return alert('Lengkapi data wajib!');
    
    setIsLoading(true);
    try {
      if (transactionToEdit) {
        await axios.put(`/api/transactions/${transactionToEdit.id}`, {
          type,
          amount: parseFloat(amount),
          category,
          description,
          wallet_id: walletId,
          transaction_date: date
        });
      } else {
        await axios.post('/api/transactions', {
          type,
          amount: parseFloat(amount),
          category,
          description,
          wallet_id: walletId,
          transaction_date: date
        });
      }
      onFinish(); // Callback to refresh data
      onClose(); // Close modal
    } catch (error) {
      console.error(error);
      alert('Gagal menambahkan transaksi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-card card-gradient rounded-[2rem] border border-card-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 md:p-8 border-b border-card-border/50">
          <div>
            <h2 className="text-xl font-black text-text-main">
              {transactionToEdit ? 'Edit Transaksi' : 'Tambah Transaksi'}
            </h2>
            <p className="text-[10px] text-text-muted mt-1 font-bold tracking-widest uppercase">Input Manual Keuangan</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-body/50 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer z-10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          
          {/* Type Selector */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={cn(
                "flex items-center justify-center gap-2 py-4 rounded-xl border transition-all text-sm font-black uppercase tracking-widest",
                type === 'expense' 
                  ? "border-rose-500 bg-rose-500/10 text-rose-500 shadow-sm"
                  : "border-card-border bg-body/50 text-text-muted hover:border-text-muted/30"
              )}
            >
              <ArrowDownRight size={18} /> Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={cn(
                "flex items-center justify-center gap-2 py-4 rounded-xl border transition-all text-sm font-black uppercase tracking-widest",
                type === 'income' 
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-500 shadow-sm"
                  : "border-card-border bg-body/50 text-text-muted hover:border-text-muted/30"
              )}
            >
              <ArrowUpRight size={18} /> Pemasukan
            </button>
          </div>

          <div className="space-y-4">
            {/* Amount */}
            <div className="relative">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Jumlah (Rp)</label>
              <div className="relative">
                <DollarSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <input 
                  type="number" 
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Contoh: 15000"
                  required
                  className="w-full bg-body border border-card-border text-text-main md:text-lg rounded-xl pl-11 pr-4 py-4 outline-none focus:border-blue-500 transition-all shadow-inner font-bold"
                />
              </div>
            </div>

            {/* Category */}
            <div className="relative">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Kategori</label>
              <div className="relative">
                <Tag size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <input 
                  type="text" 
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="Cth: Makanan, Gaji, Transport"
                  required
                  className="w-full bg-body border border-card-border text-text-main text-sm rounded-xl pl-11 pr-4 py-3 outline-none focus:border-blue-500 transition-all font-medium"
                />
              </div>
            </div>

            {/* Description */}
            <div className="relative">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Catatan / Deskripsi</label>
              <div className="relative">
                <FileText size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <input 
                  type="text" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Cth: Bayar Nasi Padang pakai ayam"
                  className="w-full bg-body border border-card-border text-text-main text-sm rounded-xl pl-11 pr-4 py-3 outline-none focus:border-blue-500 transition-all font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               {/* Wallet */}
              <div className="relative">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Dompet</label>
                <div className="relative">
                  <CreditCard size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  <select 
                    value={walletId}
                    onChange={e => setWalletId(e.target.value)}
                    required
                    className="w-full bg-body border border-card-border text-text-main text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-blue-500 transition-all font-medium appearance-none"
                  >
                    <option value="" disabled>Pilih Dompet...</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

               {/* Date */}
               <div className="relative">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 block">Tanggal</label>
                <div className="relative">
                  <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  <input 
                    type="date" 
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    className="w-full bg-body border border-card-border text-text-main text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-blue-500 transition-all font-medium appearance-none block w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 mt-4"
          >
            {isLoading ? 'Menyimpan...' : 'Simpan Transaksi'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
