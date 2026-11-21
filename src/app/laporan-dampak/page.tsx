"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Icon, { type IconName } from "@/components/ui/Icon";
import Loka from "@/components/brand/Loka";
import { NusantaraCornerFrame, NusantaraPatternStrip, PrasastiSeal } from "@/components/brand/NusantaraOrnaments";
import RequireRole from "@/components/layout/RequireRole";
import { useAuth } from "@/components/layout/AuthProvider";
import { useLokawira } from "@/components/layout/LokawiraProvider";
import { api, describeError } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import type { ImpactResponse } from "@/types/api";

const PERIODS = [7, 30, 90] as const;

function ImpactReportContent() {
  const { user } = useAuth();
  const { activeVibe, regions } = useLokawira();
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [regionId, setRegionId] = useState<string>("");
  const [data, setData] = useState<ImpactResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN";
  const dashboardHref = isAdmin ? "/admin" : "/merchant-pos";
  const activeRegionObj = regions.find((r) => r.id === regionId) ?? null;
  const scopeLabel = isAdmin
    ? activeRegionObj
      ? `${activeRegionObj.name}, ${activeRegionObj.label}`
      : "Semua Kawasan Aktif"
    : `Lapak Mitra (${user?.name ?? "Terdaftar"})`;

  const load = useCallback(() => {
    setErr(null);
    api
      .impact({ days, regionId: isAdmin && regionId ? regionId : undefined })
      .then(setData)
      .catch((e) => setErr(describeError(e, "Laporan dampak belum bisa dimuat.")));
  }, [days, isAdmin, regionId]);

  useEffect(() => {
    load();
  }, [load]);

  const t = data?.totals;
  const checkInVerifyPct = t && t.checkIns > 0 ? Math.round((t.checkInsVerified / t.checkIns) * 100) : 0;
  const voucherRedeemPct = t && t.vouchersIssued > 0 ? Math.round((t.vouchersRedeemed / t.vouchersIssued) * 100) : 0;
  const kpis: { icon: IconName; label: string; value: string; note: string }[] = t
    ? [
        { icon: "qr", label: "Poster QR Dipindai", value: String(t.qrOpens), note: "Ketertarikan pengunjung di lokasi" },
        { icon: "compass", label: "Diarahkan via Pandu", value: String(t.guides), note: "Memulai rute jalan kaki / motor" },
        { icon: "calendar", label: "Pengingat Agenda", value: String(t.reminders), note: `${t.upcomingEvents} agenda 30 hari ke depan` },
        { icon: "pin", label: "Check-in & Hadir", value: String(t.checkIns), note: `${t.checkInsVerified} diverifikasi kasir (${checkInVerifyPct}%)` },
        { icon: "voucher", label: "Voucer Ditebus", value: String(t.vouchersRedeemed), note: `${voucherRedeemPct}% dari ${t.vouchersIssued} terbit` },
        { icon: "seal", label: "Perputaran Potongan", value: formatRupiah(t.redeemedValue), note: `${t.spotsWithEvents}/${t.spots} titik punya agenda` },
      ]
    : [];

  const sortedSpots = [...(data?.spots ?? [])].sort(
    (a, b) => b.checkIns + b.vouchersRedeemed - (a.checkIns + a.vouchersRedeemed)
  );
  const topSpots = sortedSpots.slice(0, 8);
  const maxBar = Math.max(1, ...topSpots.map((s) => Math.max(s.checkIns, s.vouchersRedeemed)));
  const generatedLabel = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <main className="min-h-screen p-4 sm:p-8 max-w-5xl mx-auto space-y-5 print:p-0 print:max-w-none">
      {/* Bilah kontrol non-cetak */}
      <div className="print:hidden gamiz-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={dashboardHref} className="btn-tactile-secondary min-h-[44px] px-4 text-xs inline-flex items-center gap-1.5">
            <Icon name="back" size={16} />
            <span>Kembali ke dasbor</span>
          </Link>
          <div role="group" aria-label="Pilih periode laporan" className="inline-flex rounded-xl bg-obsidian p-1 gap-1">
            {PERIODS.map((p) => {
              const active = days === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDays(p)}
                  className={`min-h-[44px] px-3 rounded-lg text-xs font-extrabold transition-colors ${
                    active ? "bg-vibePrimary text-[var(--vibe-on-primary)]" : "text-pebble hover:text-alabaster"
                  }`}
                >
                  {p} hari
                </button>
              );
            })}
          </div>
          {isAdmin && (
            <>
              <label htmlFor="report-region" className="sr-only">Filter kawasan laporan</label>
              <select
                id="report-region"
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="min-h-[44px] px-3 rounded-xl bg-obsidian border border-stoneStrong text-xs font-bold text-alabaster"
              >
                <option value="">Semua kawasan</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-tactile-primary min-h-[44px] px-5 text-xs sm:text-sm inline-flex items-center gap-2"
        >
          <Icon name="download" size={18} />
          <span>Cetak atau Simpan PDF</span>
        </button>
      </div>

      {/* Dokumen A4 Printable */}
      <article
        aria-labelledby="report-heading"
        data-vibe={activeRegionObj?.theme ?? activeVibe}
        className="relative rounded-3xl bg-basalt border border-stoneSubtle overflow-hidden shadow-md print:shadow-none print:rounded-none print:border-stoneStrong"
      >
        <NusantaraPatternStrip vibe={activeRegionObj?.theme ?? activeVibe} height={10} />

        <div className="relative p-6 sm:p-8 space-y-6">
          <NusantaraCornerFrame size={26} />

          <header className="relative z-10 flex flex-wrap items-start justify-between gap-4 border-b border-stoneSubtle pb-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <Loka variant="mark" size={34} />
                <span className="font-display text-sm font-extrabold tracking-wide text-vibePrimary">
                  LOKAWIRA · LAPORAN DAMPAK WISATA BUDAYA
                </span>
              </div>
              <h1 id="report-heading" className="font-display text-2xl sm:text-3xl font-extrabold text-alabaster leading-tight">
                Ringkasan Kinerja Ekonomi &amp; Budaya ({days} Hari)
              </h1>
              <p className="text-xs sm:text-sm text-pebble">
                Cakupan: <strong className="text-alabaster">{scopeLabel}</strong> · Dicetak {generatedLabel}
              </p>
            </div>
            <PrasastiSeal size={52} />
          </header>

          {err ? (
            <div role="alert" className="relative z-10 rounded-2xl bg-obsidian p-5 space-y-3">
              <p className="text-sm font-bold text-quotaFull">{err}</p>
              <button type="button" onClick={load} className="btn-tactile-secondary min-h-[44px] px-4 text-xs">
                Coba muat ulang
              </button>
            </div>
          ) : !data || !t ? (
            <div role="status" className="relative z-10 py-10 text-center space-y-2">
              <Loka variant="mark" size={40} mood="think" />
              <p className="text-sm font-bold text-pebble">Menyiapkan data laporan dampak...</p>
            </div>
          ) : (
            <>
              {/* Ringkasan KPI */}
              <section aria-label="Indikator Utama" className="relative z-10 space-y-3">
                <h2 className="text-sm font-extrabold text-alabaster">1. Indikator Keterlibatan &amp; Dampak Ekonomi</h2>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {kpis.map((item) => (
                    <li key={item.label} className="list-none rounded-2xl bg-obsidian border border-stoneSubtle p-4 space-y-1">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-pebble">
                        <Icon name={item.icon} size={15} className="text-vibePrimary" />
                        {item.label}
                      </span>
                      <span className="block font-num text-2xl font-extrabold text-alabaster">{item.value}</span>
                      <span className="block text-[11px] text-pebble leading-snug">{item.note}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Grafik batang murni CSS/SVG */}
              {topSpots.length > 0 && (
                <section aria-label="Perbandingan Titik Teraktif" className="relative z-10 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-extrabold text-alabaster">2. Titik Teraktif (Check-in vs Penukaran Voucer)</h2>
                    <div className="flex items-center gap-4 text-[11px] font-bold text-pebble">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-vibePrimary inline-block" aria-hidden="true" />
                        Check-in
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-quotaSafe inline-block" aria-hidden="true" />
                        Voucer Ditebus
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-obsidian border border-stoneSubtle p-4 space-y-3">
                    {topSpots.map((s) => {
                      const checkW = Math.round((s.checkIns / maxBar) * 100);
                      const voucherW = Math.round((s.vouchersRedeemed / maxBar) * 100);
                      return (
                        <div key={s.spotId} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-alabaster truncate pr-2">{s.spotName}</span>
                            <span className="font-num text-[11px] text-pebble shrink-0">
                              {s.checkIns} hadir · {s.vouchersRedeemed} voucer
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="h-2 rounded-full bg-basalt overflow-hidden">
                              <div className="h-full rounded-full bg-vibePrimary" style={{ width: `${checkW}%` }} />
                            </div>
                            <div className="h-2 rounded-full bg-basalt overflow-hidden">
                              <div className="h-full rounded-full bg-quotaSafe" style={{ width: `${voucherW}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Rincian per titik */}
              <section aria-label="Rincian Per Titik" className="relative z-10 space-y-3">
                <h2 className="text-sm font-extrabold text-alabaster">3. Rincian Per Titik Budaya &amp; Mitra UMKM</h2>
                {sortedSpots.length === 0 ? (
                  <p className="text-sm text-pebble rounded-2xl bg-obsidian p-4">Belum ada titik dalam cakupan laporan ini.</p>
                ) : (
                  <div
                    tabIndex={0}
                    role="region"
                    aria-label="Tabel rincian per titik budaya"
                    className="overflow-x-auto rounded-2xl border border-stoneSubtle focus:outline-none focus-visible:ring-2 focus-visible:ring-vibePrimary"
                  >
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-obsidian text-pebble font-extrabold">
                        <tr>
                          <th className="py-2.5 px-3">Nama Titik</th>
                          <th className="py-2.5 px-3 font-num text-right">Poster QR</th>
                          <th className="py-2.5 px-3 font-num text-right">Pandu</th>
                          <th className="py-2.5 px-3 font-num text-right">Check-in</th>
                          <th className="py-2.5 px-3 font-num text-right">Voucer</th>
                          <th className="py-2.5 px-3 font-num text-right">Nilai Potongan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stoneSubtle">
                        {sortedSpots.map((s) => (
                          <tr key={s.spotId} className="bg-basalt text-alabaster">
                            <td className="py-2.5 px-3 font-bold">{s.spotName}</td>
                            <td className="py-2.5 px-3 font-num text-right">{s.qrOpens}</td>
                            <td className="py-2.5 px-3 font-num text-right">{s.guides}</td>
                            <td className="py-2.5 px-3 font-num text-right">
                              {s.checkIns} <span className="text-pebble">({s.checkInsVerified} sah)</span>
                            </td>
                            <td className="py-2.5 px-3 font-num text-right">
                              {s.vouchersRedeemed}/{s.vouchersIssued}
                            </td>
                            <td className="py-2.5 px-3 font-num text-right font-extrabold text-quotaSafe">
                              {formatRupiah(s.redeemedValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {/* Pernyataan privasi UU PDP */}
          <footer className="relative z-10 rounded-2xl bg-obsidian border border-stoneSubtle p-4 text-[11px] text-pebble leading-relaxed">
            <strong className="text-alabaster block mb-0.5">Kepatuhan Privasi &amp; Anonimitas (UU PDP No. 27 Tahun 2022)</strong>
            Seluruh angka pada laporan ini adalah data agregat anonim dari interaksi QR publik, penghitung kunjungan, dan penukaran voucer UMKM. LOKAWIRA tidak menyimpan pelacakan riwayat lokasi pribadi pengunjung maupun menampilkan identitas pribadi wisatawan dalam laporan pengelola atau instansi daerah.
          </footer>
        </div>

        <NusantaraPatternStrip vibe={activeRegionObj?.theme ?? activeVibe} height={10} />
      </article>
    </main>
  );
}

export default function ImpactReportPage() {
  return (
    <RequireRole roles={["MERCHANT", "ADMIN"]}>
      <ImpactReportContent />
    </RequireRole>
  );
}
