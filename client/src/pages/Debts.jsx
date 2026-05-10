import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CalendarDays,
  CirclePlus,
  CreditCard,
  Gauge,
  ArrowDownRight,
  Wallet,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

const formatRp = (num) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  })
    .format(Math.round(Number(num) || 0))
    .replace("IDR", "Rp");

const debtTypeOptions = [
  { value: "mortgage", label: "KPR Rumah" },
  { value: "vehicle", label: "Cicilan Kendaraan" },
  { value: "credit-card", label: "Kartu Kredit" },
  { value: "business", label: "Pinjaman Usaha" },
  { value: "other", label: "Lainnya" },
];

const DebtStatCard = ({ label, value, icon: Icon, tone }) => (
  <div className="h-full rounded-[1.75rem] border border-card-border bg-card px-5 py-5 md:px-6 md:py-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
    <div className="flex h-full flex-col gap-4">
      <div
        className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center ${tone}`}
      >
        <Icon size={20} />
      </div>
      <div className="flex-1">
        <p className="text-[10px] md:text-[11px] uppercase tracking-[0.22em] text-text-muted font-black">
          {label}
        </p>
        <h3 className="mt-2 text-[1.45rem] sm:text-[1.6rem] md:text-[1.8rem] font-black text-text-main tracking-[-0.04em] leading-tight break-words max-w-full">
          {value}
        </h3>
      </div>
    </div>
  </div>
);

const Debts = () => {
  const [activeTab, setActiveTab] = useState("active");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [debts, setDebts] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    isExisting: false,
    name: "",
    debtType: "other",
    principal: "",
    interestRate: "8.5",
    tenorMonths: "120",
    startDate: today,
    walletId: "",
    notes: "",
    elapsedMonths: "",
  });

  const fetchDebtData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [debtsRes, installmentsRes, walletsRes] = await Promise.all([
        fetch("/api/debts"),
        fetch("/api/debts/installments"),
        fetch("/api/wallets"),
      ]);

      const debtsData = debtsRes.ok ? await debtsRes.json() : [];
      const installmentsData = installmentsRes.ok
        ? await installmentsRes.json()
        : [];
      const walletsData = walletsRes.ok ? await walletsRes.json() : [];

      setDebts(Array.isArray(debtsData) ? debtsData : []);
      setInstallments(Array.isArray(installmentsData) ? installmentsData : []);
      setWallets(Array.isArray(walletsData) ? walletsData : []);
    } catch (error) {
      console.error("Failed to load debt data:", error);
      setDebts([]);
      setInstallments([]);
      setWallets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDebtData();
  }, [fetchDebtData]);

  const stats = useMemo(() => {
    const totalPrincipal = debts
      .filter((d) => d.status !== "paid")
      .reduce((sum, d) => sum + Number(d.principal || 0), 0);
    const totalMonthly = debts
      .filter((d) => d.status === "active")
      .reduce((sum, d) => sum + Number(d.monthly || 0), 0);
    const totalCC = debts
      .filter((d) => d.type === "credit-card" && d.status !== "paid")
      .reduce((sum, d) => sum + Number(d.principal || 0), 0);
    const totalPaid = debts.reduce((sum, d) => sum + Number(d.paid || 0), 0);

    return [
      {
        label: "Total Kewajiban",
        value: formatRp(totalPrincipal),
        icon: CreditCard,
        tone: "text-rose-500 bg-rose-500/10",
      },
      {
        label: "Cicilan/Bulan",
        value: formatRp(totalMonthly),
        icon: ArrowDownRight,
        tone: "text-sky-500 bg-sky-500/10",
      },
      {
        label: "Tagihan CC",
        value: formatRp(totalCC),
        icon: BadgeDollarSign,
        tone: "text-violet-500 bg-violet-500/10",
      },
      {
        label: "Sudah Dibayar",
        value: formatRp(totalPaid),
        icon: Wallet,
        tone: "text-emerald-500 bg-emerald-500/10",
      },
    ];
  }, [debts]);

  const tabCounts = useMemo(() => {
    return {
      active: debts.filter((d) => d.status === "active").length,
      "credit-card": debts.filter((d) => d.type === "credit-card").length,
      paid: debts.filter((d) => d.status === "paid").length,
    };
  }, [debts]);

  const filteredDebts = useMemo(() => {
    if (activeTab === "active")
      return debts.filter((d) => d.status === "active");
    if (activeTab === "credit-card")
      return debts.filter((d) => d.type === "credit-card");
    return debts.filter((d) => d.status === "paid");
  }, [activeTab, debts]);

  const resetForm = useCallback(() => {
    setForm({
      isExisting: false,
      name: "",
      debtType: "other",
      principal: "",
      interestRate: "8.5",
      tenorMonths: "120",
      startDate: today,
      walletId: "",
      notes: "",
      elapsedMonths: "",
    });
  }, [today]);

  const openAddModal = useCallback(() => {
    resetForm();
    setFormErrors({});
    setSubmitError("");
    setIsModalOpen(true);
  }, [resetForm]);

  const updateFormField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const validateDebtForm = useCallback((currentForm) => {
    const errors = {};
    const name = String(currentForm.name || "").trim();
    const principal = Number(currentForm.principal);
    const tenorMonths = Number(currentForm.tenorMonths);
    const annualRate = Number(currentForm.interestRate || 0);
    const elapsedMonths = currentForm.isExisting
      ? Number(currentForm.elapsedMonths || 0)
      : 0;

    if (!name) {
      errors.name = "Nama hutang wajib diisi";
    } else if (name.length > 100) {
      errors.name = "Nama hutang maksimal 100 karakter";
    }

    if (!Number.isFinite(principal) || principal < 100) {
      errors.principal = "Pokok hutang minimal Rp100";
    }

    if (!Number.isInteger(tenorMonths) || tenorMonths < 1) {
      errors.tenorMonths = "Tenor minimal 1 bulan";
    }

    if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100) {
      errors.interestRate = "Bunga harus antara 0 sampai 100";
    }

    if (currentForm.isExisting) {
      if (!Number.isFinite(elapsedMonths) || elapsedMonths < 0) {
        errors.elapsedMonths = "Bulan berjalan tidak boleh negatif";
      } else if (Number.isFinite(tenorMonths) && elapsedMonths > tenorMonths) {
        errors.elapsedMonths = "Bulan berjalan tidak boleh melebihi tenor";
      }
    }

    if (String(currentForm.notes || "").length > 500) {
      errors.notes = "Catatan maksimal 500 karakter";
    }

    return errors;
  }, []);

  const inputClass = (fieldName) =>
    `w-full bg-body/50 border rounded-xl px-4 py-3 outline-none ${
      formErrors[fieldName]
        ? "border-rose-500 focus:border-rose-500"
        : "border-card-border focus:border-primary"
    }`;

  useEffect(() => {
    const openModalFromHeader = () => openAddModal();
    document.addEventListener("open-debt-modal", openModalFromHeader);
    return () => {
      document.removeEventListener("open-debt-modal", openModalFromHeader);
    };
  }, [openAddModal]);

  const handleAddDebt = async (e) => {
    e.preventDefault();

    const localErrors = validateDebtForm(form);
    if (Object.keys(localErrors).length > 0) {
      setFormErrors(localErrors);
      setSubmitError("Mohon perbaiki input yang masih invalid.");
      return;
    }

    const name = form.name.trim();
    const principal = Number(form.principal);
    const tenorMonths = Number(form.tenorMonths);
    const annualRate = Number(form.interestRate || 0);

    const elapsedMonths = form.isExisting
      ? Math.max(0, Number(form.elapsedMonths || 0))
      : 0;

    setSubmitError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type: form.debtType,
          principal,
          annualInterestRate: annualRate,
          interestRate: annualRate,
          tenorMonths,
          startDate: form.startDate || today,
          walletId: form.walletId || null,
          notes: form.notes.trim(),
          elapsedMonths,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const detailMap = {};
        if (Array.isArray(data.details)) {
          data.details.forEach((item) => {
            if (item?.field && item?.message) {
              detailMap[item.field] = item.message;
            }
          });
        }
        if (Object.keys(detailMap).length > 0) {
          setFormErrors((prev) => ({ ...prev, ...detailMap }));
        }
        throw new Error(data.error || "Gagal menyimpan hutang");
      }

      setIsModalOpen(false);
      resetForm();
      setFormErrors({});
      setSubmitError("");
      await fetchDebtData();
    } catch (error) {
      setSubmitError(`Gagal menyimpan hutang: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      <section className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4 md:gap-5 items-stretch">
        {stats.map((item) => {
          return (
            <DebtStatCard
              key={item.label}
              label={item.label}
              value={item.value}
              icon={item.icon}
              tone={item.tone}
            />
          );
        })}
      </section>

      <section className="flex flex-wrap gap-2 bg-card/70 border border-card-border rounded-2xl p-2 w-fit shadow-lg">
        {[
          { key: "active", label: "Aktif", count: tabCounts.active },
          {
            key: "credit-card",
            label: "Kartu Kredit",
            count: tabCounts["credit-card"],
          },
          { key: "paid", label: "Lunas", count: tabCounts.paid },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.key
                ? "bg-body text-text-main shadow-sm"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </section>

      <section className="bg-card border border-card-border rounded-[1.75rem] shadow-2xl p-6 md:p-10">
        {isLoading ? (
          <div className="min-h-[300px] flex flex-col items-center justify-center text-center">
            <p className="text-sm text-text-muted">Memuat data hutang...</p>
          </div>
        ) : filteredDebts.length === 0 ? (
          <div className="min-h-[300px] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
              <CreditCard size={28} />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-text-main tracking-tight">
              Belum ada hutang
            </h2>
            <p className="text-sm text-text-muted mt-2 max-w-xl">
              Tambahkan KPR, cicilan kendaraan, atau pinjaman lainnya untuk
              mulai tracking.
            </p>
            <button
              onClick={openAddModal}
              className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white text-sm font-black shadow-xl shadow-primary/20 transition-all active:scale-95"
            >
              <CirclePlus size={18} />
              Tambah Hutang
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDebts.map((debt) => (
              <div
                key={debt.id}
                className="bg-body/50 border border-card-border rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-black text-text-main">
                      {debt.name}
                    </h4>
                    <p className="text-xs text-text-muted font-semibold uppercase tracking-wider mt-1">
                      {debt.type === "credit-card"
                        ? "Kartu Kredit"
                        : "Pinjaman"}{" "}
                      • {debt.status === "paid" ? "Lunas" : "Aktif"}
                    </p>
                  </div>
                  <span className="text-sm font-black text-text-main">
                    {formatRp(debt.principal)}
                  </span>
                </div>
                {(debt.walletName || debt.notes) && (
                  <p className="mt-2 text-xs text-text-muted leading-relaxed">
                    {debt.walletName ? `Dompet: ${debt.walletName}` : ""}
                    {debt.walletName && debt.notes ? " • " : ""}
                    {debt.notes || ""}
                  </p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                  <div>
                    <p className="text-text-muted">Cicilan/Bulan</p>
                    <p className="font-bold text-text-main">
                      {formatRp(debt.monthly)}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Sudah Dibayar</p>
                    <p className="font-bold text-emerald-500">
                      {formatRp(debt.paid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Sisa Pokok</p>
                    <p className="font-bold text-text-main">
                      {formatRp(debt.remaining)}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Tenor</p>
                    <p className="font-bold text-text-main">
                      {debt.tenorMonths} bulan
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-card border border-card-border rounded-[1.75rem] shadow-2xl p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-text-main/5 text-text-muted flex items-center justify-center">
            <Gauge size={18} />
          </div>
          <h3 className="text-lg font-black text-text-main tracking-tight">
            Riwayat Cicilan
          </h3>
        </div>

        {installments.length === 0 ? (
          <div className="min-h-[220px] flex flex-col items-center justify-center text-center bg-body/40 border border-card-border rounded-[1.5rem] p-6">
            <div className="w-14 h-14 rounded-2xl bg-text-main/5 text-text-muted flex items-center justify-center mb-4">
              <CalendarDays size={24} />
            </div>
            <p className="text-base font-semibold text-text-main">
              Belum ada transaksi cicilan
            </p>
            <p className="text-sm text-text-muted mt-1">
              Pembayaran cicilan akan muncul di sini
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {installments.map((item) => (
              <div
                key={item.id}
                className="bg-body/40 border border-card-border rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-text-main">{item.debtName}</p>
                  <p className="text-xs text-text-muted">
                    {new Date(item.date).toLocaleDateString("id-ID")}
                  </p>
                </div>
                <p className="font-black text-emerald-500">
                  {formatRp(item.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-card border border-card-border rounded-[2rem] p-8 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-2xl font-black text-text-main tracking-tight">
                Tambah Hutang
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-main"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleAddDebt} className="space-y-4">
              {submitError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-600">
                  {submitError}
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-card-border bg-body/40 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-text-main">
                    Hutang yang sudah berjalan?
                  </p>
                  <p className="text-xs text-text-muted">
                    Aktifkan jika cicilan sudah berjalan beberapa bulan/tahun
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      isExisting: !prev.isExisting,
                    }))
                  }
                  className="text-primary"
                >
                  {form.isExisting ? (
                    <ToggleRight size={30} />
                  ) : (
                    <ToggleLeft size={30} />
                  )}
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Nama Hutang
                </label>
                <input
                  value={form.name}
                  onChange={(e) => updateFormField("name", e.target.value)}
                  placeholder="Contoh: KPR Rumah, Cicilan Motor"
                  className={inputClass("name")}
                  required
                />
                {formErrors.name && (
                  <p className="text-xs text-rose-500">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Jenis Hutang
                </label>
                <select
                  value={form.debtType}
                  onChange={(e) => updateFormField("debtType", e.target.value)}
                  className={inputClass("debtType")}
                >
                  {debtTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Pokok Hutang Awal
                  </label>
                  <input
                    type="number"
                    value={form.principal}
                    onChange={(e) =>
                      updateFormField("principal", e.target.value)
                    }
                    placeholder="500000000"
                    className={inputClass("principal")}
                    required
                  />
                  {formErrors.principal && (
                    <p className="text-xs text-rose-500">
                      {formErrors.principal}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Bunga (%/tahun)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.interestRate}
                    onChange={(e) =>
                      updateFormField("interestRate", e.target.value)
                    }
                    placeholder="8.5"
                    className={inputClass("interestRate")}
                  />
                  {formErrors.interestRate && (
                    <p className="text-xs text-rose-500">
                      {formErrors.interestRate}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Tenor Awal (bulan)
                  </label>
                  <input
                    type="number"
                    value={form.tenorMonths}
                    onChange={(e) =>
                      updateFormField("tenorMonths", e.target.value)
                    }
                    placeholder="120"
                    className={inputClass("tenorMonths")}
                    required
                  />
                  {formErrors.tenorMonths && (
                    <p className="text-xs text-rose-500">
                      {formErrors.tenorMonths}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      updateFormField("startDate", e.target.value)
                    }
                    className={inputClass("startDate")}
                    required
                  />
                </div>
              </div>

              {form.isExisting && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Sudah Berjalan (bulan)
                  </label>
                  <input
                    type="number"
                    value={form.elapsedMonths}
                    onChange={(e) =>
                      updateFormField("elapsedMonths", e.target.value)
                    }
                    placeholder="Contoh: 6"
                    className={inputClass("elapsedMonths")}
                  />
                  {formErrors.elapsedMonths && (
                    <p className="text-xs text-rose-500">
                      {formErrors.elapsedMonths}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Dompet Pembayaran (opsional)
                </label>
                <select
                  value={form.walletId}
                  onChange={(e) => updateFormField("walletId", e.target.value)}
                  className={inputClass("walletId")}
                >
                  <option value="">Pilih dompet</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Catatan (opsional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateFormField("notes", e.target.value)}
                  rows={3}
                  placeholder="Catatan tambahan..."
                  className={`${inputClass("notes")} resize-none`}
                />
                {formErrors.notes && (
                  <p className="text-xs text-rose-500">{formErrors.notes}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-primary hover:bg-primary/90 disabled:bg-primary/60 text-white rounded-xl py-3 font-black"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan Hutang"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Debts;
