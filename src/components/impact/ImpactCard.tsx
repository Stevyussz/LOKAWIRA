"use client";

import React, { useCallback, useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/ui/Icon";
import { api, describeError } from "@/lib/api";
import type { ImpactResponse } from "@/types/api";
import type { Region } from "@/types/lokawira";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

// dampak nyata 30 hari: bukti buat mitra (ke pembeli/sponsor) & pengelola (ke pemda). Semua angka anonim
export default function ImpactCard({ title, regions }: { title: string; regions?: Region[] }) {
  const [data, setData] = useState<ImpactResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [regionId, setRegionId] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setErr(null);
    api
      .impact({ days: 30, regionId: regionId || undefined })
      .then(setData)
      .catch((e) => setErr(describeError(e, "Data dampak belum bisa dimuat.")));
  }, [regionId]);
  useEffect(load, [load]);

  const t = data?.totals;
  const tiles: { icon: IconName; label: string; value: string; hint: string }[] = t
    ? [
        { icon: "qr", label: "Poster QR dipindai", value: String(t.qrOpens), hint: "Orang yang lewat lalu ingin tahu isinya" },
        { icon: "compass", label: "Diarahkan ke lokasi", value: String(t.guides), hint: "Memakai Pandu aku menuju titik" },
        { icon: "calendar", label: "Pengingat acara", value: String(t.reminders), hint: `Dari ${t.upcomingEvents} jadwal acara 30 hari ke depan` },
        { icon: "pin", label: "Datang dan check-in", value: String(t.checkIns), hint: `${t.checkInsVerified} diverifikasi pemilik lapak` },
        { icon: "voucher", label: "Voucer ditukar", value: String(t.vouchersRedeemed), hint: `Belanja dengan potongan ${rupiah(t.redeemedValue)}` },
        { icon: "sanggar", label: "Titik punya agenda", value: `${t.spotsWithEvents}/${t.spots}`, hint: "Titik dengan acara terjadwal" },
      ]
    : [];

  const copySummary = async () => {
    if (!t) return;
    const area = regionId ? regions?.find((r) => r.id === regionId)?.name ?? "" : regions ? "semua kawasan" : "lapak saya";
    const text = `Dampak LOKAWIRA 30 hari terakhir (${area}): poster QR dipindai ${t.qrOpens} kali, ${t.guides} orang diarahkan ke lokasi, ${t.reminders} pengingat acara disimpan, ${t.checkIns} check-in (${t.checkInsVerified} diverifikasi), ${t.vouchersRedeemed} voucer ditukar dengan potongan ${rupiah(t.redeemedValue)}, ${t.spotsWithEvents} dari ${t.spots} titik punya agenda.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <section className="gamiz-card p-5 space-y-4" aria-labelledby="impact-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="impact-title" className="text-base font-extrabold text-alabaster">{title}</h2>
          <p className="text-xs text-pebble mt-1">30 hari terakhir. Angka anonim, tanpa data pribadi pengunjung.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {regions && (
            <>
              <label htmlFor="impact-region" className="sr-only">Kawasan</label>
              <select id="impact-region" value={regionId} onChange={(e) => setRegionId(e.target.value)} className="min-h-[44px] px-3 rounded-xl bg-obsidian border border-stoneStrong text-xs font-bold text-alabaster">
                <option value="">Semua kawasan</option>
                {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </>
          )}
          <button type="button" onClick={copySummary} disabled={!t} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5 disabled:opacity-60">
            <Icon name={copied ? "check" : "copy"} size={16} />
            <span>{copied ? "Tersalin" : "Salin ringkasan"}</span>
          </button>
        </div>
      </div>
      {err ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm font-bold text-quotaFull">{err}</p>
          <button type="button" onClick={load} className="btn-tactile-secondary min-h-[44px] px-4 text-xs">Coba lagi</button>
        </div>
      ) : !t ? (
        <p role="status" className="text-sm text-pebble">Memuat data dampak</p>
      ) : (
        <ul className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
          {tiles.map((x) => (
            <li key={x.label} className="list-none rounded-2xl bg-obsidian p-3.5 space-y-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-pebble">
                <Icon name={x.icon} size={14} className="text-vibePrimary" />
                {x.label}
              </span>
              <span className="block font-num text-2xl font-extrabold text-alabaster">{x.value}</span>
              <span className="block text-[11px] text-pebble leading-snug">{x.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
