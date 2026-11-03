"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLokawira } from "@/components/layout/LokawiraProvider";
import Icon, { IconName } from "@/components/ui/Icon";
import { describeError } from "@/lib/api";
import { useAuth } from "@/components/layout/AuthProvider";
import ApprovalQueue from "@/components/admin/ApprovalQueue";
import AdminSpotsPanel from "@/components/admin/AdminSpotsPanel";
import AdminSummary, { AdminTab } from "@/components/admin/AdminSummary";
import KnowledgePanel from "@/components/admin/KnowledgePanel";
import QuotaPanel from "@/components/admin/QuotaPanel";
import RewardsPanel from "@/components/admin/RewardsPanel";
import { ReservationsPanel, VouchersPanel } from "@/components/admin/PagedLists";
import RequireRole from "@/components/layout/RequireRole";

function AdminContent() {
  const { user, logout } = useAuth();
  const { activeVibe, spots, setSpots, vouchers, reservations, refreshServerData } = useLokawira();

  const [tab, setTab] = useState<AdminTab>("APPROVAL");
  const [approvalCount, setApprovalCount] = useState(0);
  const [adminToast, setAdminToast] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState(false);
  const toast = (text: string, isError = false) => {
    setToastIsError(isError);
    setAdminToast(text);
  };

  const handleReload = async () => {
    try {
      await refreshServerData();
      toast("Data dimuat ulang dari server.");
    } catch (err) {
      toast(describeError(err, "Gagal memuat ulang data."), true);
    }
  };

  const published = spots.filter((s) => (s.status ?? "PUBLISHED") === "PUBLISHED").length;
  const waitingTickets = reservations.filter((r) => r.status === "CONFIRMED").length;
  const activeVouchers = vouchers.filter((v) => v.status === "ACTIVE").length;

  const tabs: { id: AdminTab; label: string; icon: IconName; badge?: number }[] = [
    { id: "APPROVAL", label: "Persetujuan", icon: "seal", badge: approvalCount },
    { id: "SPOTS", label: "Titik di Peta", icon: "pin" },
    { id: "QUOTA", label: "Kuota & Tiket", icon: "users" },
    { id: "REWARDS", label: "Hadiah & Voucer", icon: "ticket" },
    { id: "KNOWLEDGE", label: "Pengetahuan Loka", icon: "guide" },
  ];

  return (
    <div className="min-h-screen flex flex-col pb-16">
      <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header className="gamiz-card px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-lg sm:text-xl font-extrabold text-alabaster leading-tight">Dasbor Pengelola</h1>
            <p className="text-xs text-pebble truncate">{user?.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5">
              <Icon name="back" size={16} weight="bold" />
              <span>Peta</span>
            </Link>
            <button type="button" onClick={() => logout()} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5">
              <Icon name="signOut" size={16} />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {adminToast && (
          <div
            role="status"
            aria-live="polite"
            className={`sticky top-3 z-30 p-4 rounded-2xl bg-slateElev border-2 flex items-center justify-between gap-2 text-xs font-bold text-alabaster shadow-md ${toastIsError ? "border-quotaFull" : "border-quotaSafe"}`}
          >
            <div className="flex items-center gap-2">
              <Icon name={toastIsError ? "alert" : "check"} size={16} className={`${toastIsError ? "text-quotaFull" : "text-quotaSafe"} shrink-0`} />
              <span>{adminToast}</span>
            </div>
            <button type="button" onClick={() => setAdminToast(null)} className="min-h-[44px] px-3 py-1 rounded-xl bg-obsidian text-pebble hover:text-alabaster">
              Tutup
            </button>
          </div>
        )}

        <AdminSummary
          onGo={setTab}
          cards={[
            { label: "Menunggu keputusanmu", value: approvalCount, hint: "Mitra dan titik baru. Ketuk untuk memeriksa.", icon: "seal", go: "APPROVAL", attention: true },
            { label: "Titik tampil di peta", value: published, hint: "Yang bisa dilihat wisatawan.", icon: "pin", go: "SPOTS" },
            { label: "Tiket menunggu masuk", value: waitingTickets, hint: "E-Ticket yang belum dipakai di pintu.", icon: "ticket", go: "QUOTA" },
            { label: "Voucer belum dipakai", value: activeVouchers, hint: "Sudah terbit, belum ditukar di kasir.", icon: "umkm", go: "REWARDS" },
          ]}
        />

        <div role="tablist" aria-label="Menu pengelola" className="gamiz-card p-2 grid grid-cols-2 lg:grid-cols-5 gap-2">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`${i === tabs.length - 1 ? "col-span-2 lg:col-span-1 " : ""}min-h-[52px] px-3 py-2 rounded-2xl text-xs font-extrabold text-center leading-tight flex items-center justify-center gap-2 transition-all ${
                tab === t.id ? "bg-vibePrimary text-[var(--vibe-on-primary)]" : "text-pebble hover:text-alabaster"
              }`}
            >
              <Icon name={t.icon} size={16} />
              <span>
                {t.label}
                {t.badge ? <> (<span className="font-num">{t.badge}</span>)</> : null}
              </span>
            </button>
          ))}
        </div>

        {/* antrean tetap dirender (disembunyikan) biar lencana jumlahnya selalu terbarui */}
        <div hidden={tab !== "APPROVAL"}>
          <ApprovalQueue spots={spots} onSpots={setSpots} onToast={toast} onCount={setApprovalCount} />
        </div>

        {tab === "SPOTS" && <AdminSpotsPanel spots={spots} setSpots={setSpots} defaultRegion={activeVibe} onToast={toast} onReload={handleReload} />}

        {tab === "QUOTA" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <QuotaPanel spots={spots} setSpots={setSpots} onToast={toast} />
            <ReservationsPanel onToast={toast} />
          </div>
        )}

        {tab === "REWARDS" && (
          <>
            <RewardsPanel spots={spots} setSpots={setSpots} onToast={toast} />
            <VouchersPanel />
          </>
        )}

        {tab === "KNOWLEDGE" && <KnowledgePanel onToast={toast} />}
      </main>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <RequireRole roles={["ADMIN"]}>
      <AdminContent />
    </RequireRole>
  );
}
