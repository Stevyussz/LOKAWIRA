"use client";

import React, { useState } from "react";
import Icon from "@/components/ui/Icon";
import { api, describeError } from "@/lib/api";
import { usePagedList } from "@/lib/usePagedList";
import type { IssuedVoucher, ReservationPass } from "@/types/lokawira";

const PAGE_SIZE = 10;
const select =
  "min-h-[44px] px-3 rounded-xl bg-obsidian border border-stoneStrong text-xs font-bold text-alabaster";

function MoreButton({ hasMore, loading, onClick }: { hasMore: boolean; loading: boolean; onClick: () => void }) {
  if (!hasMore) return null;
  return (
    <button type="button" onClick={onClick} disabled={loading} className="btn-tactile-secondary w-full min-h-[48px] px-4 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
      {loading && <Icon name="loader" size={16} weight="bold" motion="spin" />}
      <span>{loading ? "Memuat" : "Muat lebih banyak"}</span>
    </button>
  );
}

function ListState({ loading, error, empty, onRetry }: { loading: boolean; error: string | null; empty: boolean; onRetry: () => void }) {
  if (error) {
    return (
      <div role="alert" className="space-y-2">
        <p className="text-sm font-bold text-quotaFull">{error}</p>
        <button type="button" onClick={onRetry} className="btn-tactile-secondary min-h-[44px] px-4 text-xs">Coba lagi</button>
      </div>
    );
  }
  if (loading && empty) return <p role="status" className="text-sm text-pebble">Memuat daftar</p>;
  if (!loading && empty) return <p className="text-sm text-pebble">Belum ada data untuk filter ini.</p>;
  return null;
}

// daftar E-Ticket (berhalaman) + penandaan masuk lokasi
export function ReservationsPanel({ onToast }: { onToast: (text: string, isError?: boolean) => void }) {
  const [status, setStatus] = useState("");
  const list = usePagedList<ReservationPass>(
    async (cursor) => {
      const r = await api.adminReservations({ status: status || undefined, limit: PAGE_SIZE, cursor });
      return { items: r.reservations, nextCursor: r.nextCursor };
    },
    [status]
  );

  const verify = async (ticketId: string) => {
    try {
      const res = await api.checkInTicket({ ticketId });
      list.setItems((prev) => prev.map((x) => (x.ticketId === ticketId ? res.reservation : x)));
      onToast(`E-Ticket ${ticketId} ditandai masuk lokasi dan tersimpan di server.`);
    } catch (err) {
      onToast(describeError(err, "E-Ticket gagal diverifikasi."), true);
    }
  };

  return (
    <section className="lg:col-span-5 gamiz-card p-6 space-y-3" aria-labelledby="pl-res">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="pl-res" className="text-base font-extrabold text-alabaster">
          Verifikasi E-Ticket Masuk <span className="font-num">({list.items.length}{list.hasMore ? "+" : ""})</span>
        </h2>
        <label className="sr-only" htmlFor="pl-res-status">Filter status tiket</label>
        <select id="pl-res-status" value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
          <option value="">Semua</option>
          <option value="CONFIRMED">Menunggu masuk</option>
          <option value="CHECKED_IN">Sudah masuk</option>
        </select>
      </div>
      <ListState loading={list.loading} error={list.error} empty={list.items.length === 0} onRetry={list.reload} />
      <div className="space-y-2.5">
        {list.items.map((res) => (
          <div key={res.ticketId} className="p-4 rounded-2xl bg-obsidian flex items-center justify-between gap-2">
            <div>
              <span className="font-num text-xs font-bold text-vibeSecondary block">{res.ticketId} • {res.scheduledSlot}</span>
              <p className="text-xs font-extrabold text-alabaster mt-0.5">{res.visitorName} ({res.partySize} orang)</p>
              <p className="text-[11px] text-pebble">{res.spotName}</p>
            </div>
            {res.status === "CONFIRMED" ? (
              <button type="button" onClick={() => verify(res.ticketId)} aria-label={`Check-in tiket ${res.ticketId}`} className="btn-tactile-primary min-h-[44px] px-3.5 py-1.5 text-xs">
                Check-In
              </button>
            ) : (
              <span className="font-num text-xs text-quotaSafe font-bold">SELESAI</span>
            )}
          </div>
        ))}
      </div>
      <MoreButton hasMore={list.hasMore} loading={list.loading} onClick={list.loadMore} />
    </section>
  );
}

// daftar voucer yg beredar (berhalaman)
export function VouchersPanel() {
  const [status, setStatus] = useState("");
  const list = usePagedList<IssuedVoucher>(
    async (cursor) => {
      const r = await api.adminVouchers({ status: status || undefined, limit: PAGE_SIZE, cursor });
      return { items: r.vouchers, nextCursor: r.nextCursor };
    },
    [status]
  );

  return (
    <section className="gamiz-card p-6 space-y-4" aria-labelledby="pl-vou">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="pl-vou" className="text-base font-extrabold text-alabaster">
          Distribusi Tiket Voucer UMKM <span className="font-num">({list.items.length}{list.hasMore ? "+" : ""})</span>
        </h2>
        <label className="sr-only" htmlFor="pl-vou-status">Filter status voucer</label>
        <select id="pl-vou-status" value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
          <option value="">Semua</option>
          <option value="ACTIVE">Aktif</option>
          <option value="REDEEMED">Sudah ditebus</option>
        </select>
      </div>
      <ListState loading={list.loading} error={list.error} empty={list.items.length === 0} onRetry={list.reload} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.items.map((v) => (
          <div key={v.code} className="perforated-ticket p-4 flex items-center justify-between gap-3">
            <div>
              <span className="font-num text-xs font-bold text-vibePrimary block">{v.code} • {v.status}</span>
              <p className="text-sm font-extrabold text-alabaster mt-0.5">{v.merchantName}</p>
              <p className="text-xs text-pebble">{v.discountTitle}</p>
            </div>
            <span className="font-num text-sm font-extrabold text-quotaSafe">Rp{v.discountAmount.toLocaleString("id-ID")}</span>
          </div>
        ))}
      </div>
      <MoreButton hasMore={list.hasMore} loading={list.loading} onClick={list.loadMore} />
    </section>
  );
}
