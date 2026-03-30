import React, { useState, useEffect } from 'react';

const WalletItem = ({ name, balance, color }) => {
  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0).replace('IDR', 'Rp');
  return (
    <div className="flex justify-between items-center p-4 rounded-xl bg-card border border-card-border hover:border-primary/30 transition-shadow shadow-sm">
      <span className="text-xs font-semibold text-text-muted">{name}</span>
      <span className={`text-xs font-bold ${color || 'text-emerald-500'}`}>{formatRp(balance)}</span>
    </div>
  );
};

const WalletGrid = () => {
  const [wallets, setWallets] = useState([]);

  useEffect(() => {
    fetch('/api/wallets')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data && !data.error) setWallets(data);
      })
      .catch(err => console.error("Wallet API Error:", err.message));
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {wallets.length > 0 ? wallets.map((wallet) => (
        <WalletItem key={wallet.id} name={wallet.name} balance={wallet.balance} color="text-emerald-500" />
      )) : (
        <div className="w-full text-center py-4 bg-card border border-card-border rounded-xl text-text-muted col-span-full text-xs">
          Loading wallets / Belum ada dompet aktif...
        </div>
      )}
    </div>
  );
};

export default WalletGrid;
