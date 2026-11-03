"use client";

import React, { useState } from "react";
import Icon from "@/components/ui/Icon";
import { api, describeError } from "@/lib/api";
import type { CulturalSpot } from "@/types/lokawira";

interface Props {
  spots: CulturalSpot[];
  setSpots: React.Dispatch<React.SetStateAction<CulturalSpot[]>>;
  onToast: (text: string, isError?: boolean) => void;
}

// kepadatan tiap titik: pengelola isi jumlah pengunjung sekarang. >= 85% memicu pengalihan antrean ke mitra sekitar
export default function QuotaPanel({ spots, setSpots, onToast }: Props) {
  // yang paling padat di atas biar langsung kelihatan
  const live = spots
    .filter((s) => (s.status ?? "PUBLISHED") === "PUBLISHED")
    .sort((a, b) => b.quota.currentVisitors / b.quota.maxCapacity - a.quota.currentVisitors / a.quota.maxCapacity);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (spot: CulturalSpot, value: number) => {
    const n = Math.round(value);
    if (!Number.isFinite(n) || n < 0 || n > spot.quota.maxCapacity) {
      onToast(`Isi angka 0 sampai ${spot.quota.maxCapacity} untuk ${spot.name}.`, true);
      return;
    }
    setBusy(spot.id);
    try {
      const res = await api.updateQuota({ spotId: spot.id, currentVisitors: n });
      setSpots(res.spots);
      setDraft((p) => {
        const c = { ...p };
        delete c[spot.id];
        return c;
      });
      onToast(`Jumlah pengunjung ${spot.name} disimpan: ${n} dari ${spot.quota.maxCapacity}.`);
    } catch (err) {
      onToast(describeError(err, "Jumlah pengunjung gagal disimpan."), true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="lg:col-span-7 gamiz-card p-5 space-y-4" aria-labelledby="qp-title">
      <div>
        <h2 id="qp-title" className="text-base font-extrabold text-alabaster">Kepadatan pengunjung</h2>
        <p className="text-xs text-pebble mt-1 leading-relaxed">
          Isi jumlah orang yang ada di tiap lokasi sekarang. Kalau sudah 85% penuh atau lebih, aplikasi otomatis menyarankan wisatawan ke UMKM di sekitarnya (pengalihan antrean).
        </p>
      </div>
      {live.length === 0 ? (
        <p className="text-sm text-pebble">Belum ada titik yang tampil di peta.</p>
      ) : (
        <ul className="space-y-3">
          {live.map((spot) => {
            const ratio = spot.quota.currentVisitors / spot.quota.maxCapacity;
            const full = ratio >= 0.85;
            const val = draft[spot.id] ?? String(spot.quota.currentVisitors);
            return (
              <li key={spot.id} className="list-none p-4 rounded-2xl bg-obsidian space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-[var(--vibe-primary-lip)] block">{spot.regionName}</span>
                    <h3 className="text-sm font-extrabold text-alabaster">{spot.name}</h3>
                  </div>
                  <span className={`font-num text-xs font-extrabold px-3 py-1 rounded-full bg-basalt ${full ? "text-quotaFull" : "text-quotaSafe"}`}>
                    {spot.quota.currentVisitors}/{spot.quota.maxCapacity} ({Math.round(ratio * 100)}%)
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-basalt overflow-hidden" aria-hidden="true">
                  <div className={`h-full rounded-full ${full ? "bg-quotaFull" : ratio > 0.6 ? "bg-quotaWarning" : "bg-quotaSafe"}`} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
                </div>
                {full && <p className="text-[11px] font-bold text-quotaFull">Padat. Pengalihan antrean ke UMKM sekitar sedang aktif.</p>}
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label htmlFor={`qp-${spot.id}`} className="block text-[11px] font-bold text-pebble mb-1">Jumlah pengunjung sekarang</label>
                    <input
                      id={`qp-${spot.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={spot.quota.maxCapacity}
                      value={val}
                      onChange={(e) => setDraft((p) => ({ ...p, [spot.id]: e.target.value }))}
                      className="w-32 min-h-[48px] px-3.5 rounded-xl bg-basalt border border-stoneStrong text-sm font-num font-bold text-alabaster"
                    />
                  </div>
                  <button type="button" disabled={busy === spot.id} onClick={() => save(spot, Number(val))} className="btn-tactile-primary min-h-[48px] px-4 text-xs inline-flex items-center gap-1.5 disabled:opacity-70">
                    {busy === spot.id ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Icon name="check" size={16} />}
                    <span>Simpan</span>
                  </button>
                  <button type="button" disabled={busy === spot.id} onClick={() => { setDraft((p) => ({ ...p, [spot.id]: "0" })); save(spot, 0); }} className="btn-tactile-secondary min-h-[48px] px-4 text-xs disabled:opacity-70">
                    Kosongkan
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
