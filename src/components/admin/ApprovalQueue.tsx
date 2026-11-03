"use client";

import React, { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { API_BASE, api, describeError } from "@/lib/api";
import { DEFAULT_TARGET } from "@/components/merchant/ScanObjectEditor";
import { formatCoord } from "@/lib/geo";
import type { MerchantSummary } from "@/types/api";
import type { CulturalSpot } from "@/types/lokawira";

interface Props {
  spots: CulturalSpot[];
  onSpots: (spots: CulturalSpot[]) => void;
  onToast: (text: string, isError?: boolean) => void;
  // dikabari tiap jumlah antrean berubah (buat lencana di tab)
  onCount?: (n: number) => void;
}

// antrean persetujuan: mitra baru & titik dari mitra nunggu keputusan pengelola
export default function ApprovalQueue({ spots, onSpots, onToast, onCount }: Props) {
  const [merchants, setMerchants] = useState<MerchantSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // id yg lagi nunggu alasan penolakan diisi
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const [rosterFilter, setRosterFilter] = useState("");
  const roster = (merchants ?? []).filter((m) => !rosterFilter || m.status === rosterFilter);
  const pendingSpots = spots.filter((s) => s.status === "PENDING_REVIEW");
  const pendingMerchants = (merchants ?? []).filter((m) => m.status === "PENDING");

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api.listMerchants();
      setMerchants(res.merchants);
    } catch (err) {
      setMerchants([]);
      setLoadError(describeError(err, "Daftar mitra gagal dimuat."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (merchants) onCount?.(pendingMerchants.length + pendingSpots.length);
  }, [merchants, pendingMerchants.length, pendingSpots.length, onCount]);

  const openReject = (id: string) => {
    setRejectingId(id);
    setReason("");
  };

  const decideMerchant = async (m: MerchantSummary, approve: boolean) => {
    setBusyId(m.id);
    try {
      const res = approve ? await api.approveMerchant(m.id) : await api.rejectMerchant(m.id, { reason: reason.trim() || undefined });
      setRejectingId(null);
      setMerchants((prev) => (prev ?? []).map((x) => (x.id === m.id ? res.merchant : x)));
      onToast(approve ? `${m.name} disetujui sebagai mitra.` : `${m.name} ditolak.`);
    } catch (err) {
      onToast(describeError(err, "Keputusan gagal disimpan."), true);
    } finally {
      setBusyId(null);
    }
  };

  const decideSpot = async (s: CulturalSpot, publish: boolean) => {
    setBusyId(s.id);
    try {
      const res = await api.reviewSpot(s.id, { decision: publish ? "PUBLISH" : "REJECT", reason: publish ? undefined : reason.trim() || undefined });
      setRejectingId(null);
      onSpots(res.spots);
      onToast(publish ? `"${s.name}" diterbitkan di peta.` : `"${s.name}" ditolak.`);
    } catch (err) {
      onToast(describeError(err, "Keputusan gagal disimpan."), true);
    } finally {
      setBusyId(null);
    }
  };

  const btnYes = "btn-tactile-primary min-h-[44px] px-4 text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-70";
  const btnNo = "btn-tactile-secondary min-h-[44px] px-4 text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-70";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <section className="gamiz-card p-5 space-y-3" aria-labelledby="aq-merchants">
        <div className="flex items-center justify-between gap-2">
          <h2 id="aq-merchants" className="text-base font-extrabold text-alabaster">
            Mitra menunggu persetujuan ({pendingMerchants.length})
          </h2>
          <button type="button" onClick={load} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5">
            <Icon name="database" size={16} />
            <span>Muat ulang</span>
          </button>
        </div>
        {loadError && <p role="alert" className="text-sm font-bold text-quotaFull">{loadError}</p>}
        {merchants === null ? (
          <p role="status" className="text-sm text-pebble">Memuat daftar mitra</p>
        ) : pendingMerchants.length === 0 ? (
          <p className="text-sm text-pebble">Tidak ada pendaftar baru. Semua mitra sudah diputuskan.</p>
        ) : (
          <ul className="space-y-2.5">
            {pendingMerchants.map((m) => (
              <li key={m.id} className="list-none rounded-2xl bg-obsidian p-3.5 space-y-2.5">
                <div>
                  <p className="text-sm font-extrabold text-alabaster">{m.name}</p>
                  <p className="text-[11px] text-pebble break-all">{m.email}</p>
                  <p className="text-[11px] text-pebble">
                    Daftar {new Date(m.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} · <span className="font-num">{m.spotCount}</span> lapak
                  </p>
                </div>
                                {rejectingId === m.id && (
                  <div className="space-y-2">
                    <label htmlFor={`rj-${m.id}`} className="block text-xs font-bold text-pebble">Alasan penolakan (opsional, dilihat mitra)</label>
                    <textarea id={`rj-${m.id}`} rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-basalt border border-stoneStrong text-sm text-alabaster" />
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setRejectingId(null)} className={btnNo}>Batal</button>
                      <button type="button" disabled={busyId === m.id} onClick={() => decideMerchant(m, false)} className={btnNo}>Kirim penolakan</button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busyId === m.id} onClick={() => openReject(m.id)} aria-label={`Tolak ${m.name}`} aria-expanded={rejectingId === m.id} className={btnNo}>Tolak</button>
                  <button type="button" disabled={busyId === m.id} onClick={() => decideMerchant(m, true)} aria-label={`Setujui ${m.name}`} className={btnYes}>
                    {busyId === m.id ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Icon name="check" size={16} />}
                    <span>Setujui</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="gamiz-card p-5 space-y-3" aria-labelledby="aq-spots">
        <h2 id="aq-spots" className="text-base font-extrabold text-alabaster">
          Titik menunggu review ({pendingSpots.length})
        </h2>
        {pendingSpots.length === 0 ? (
          <p className="text-sm text-pebble">Tidak ada titik baru dari mitra yang perlu ditinjau.</p>
        ) : (
          <ul className="space-y-2.5">
            {pendingSpots.map((s) => (
              <li key={s.id} className="list-none rounded-2xl bg-obsidian p-3.5 space-y-2.5">
                <div>
                  <span className="text-[11px] font-bold text-vibeSecondary">{s.regionName} · {s.opkCategory}</span>
                  <p className="text-sm font-extrabold text-alabaster mt-0.5">{s.name}</p>
                  <p className="font-num text-[11px] text-pebble">{formatCoord(s.coordinates)}</p>
                  <p className="text-[11px] text-pebble">{s.address}</p>
                  <p className="text-[11px] text-pebble mt-1">Petunjuk misi: {s.quest.riddleClue}</p>
                  <p className="text-[11px] text-pebble">Objek yang dipotret: <b className="text-alabaster">{s.quest.targetObjectPrompt === DEFAULT_TARGET ? "belum diisi" : s.quest.targetObjectPrompt}</b></p>
                  <p className="font-num text-[11px] text-pebble">Voucer: Rp{s.quest.voucherReward.discountAmount.toLocaleString("id-ID")} · min. Rp{s.quest.voucherReward.minimumSpend.toLocaleString("id-ID")}</p>
                  {(s.quest.referenceImages?.length ?? 0) > 0 ? (
                    <ul className="grid grid-cols-5 gap-1.5 mt-2" aria-label={`Foto contoh ${s.name}`}>
                      {s.quest.referenceImages!.map((img, i) => (
                        <li key={img.id} className="list-none aspect-square rounded-lg overflow-hidden border border-stoneSubtle">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`${API_BASE}${img.url}`} alt={`Foto contoh ${i + 1} dari ${s.name}`} className="w-full h-full object-cover" />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] font-bold text-quotaWarning mt-1">Mitra belum mengunggah foto contoh. AI belum bisa mengenali objek ini.</p>
                  )}
                </div>
                                {rejectingId === s.id && (
                  <div className="space-y-2">
                    <label htmlFor={`rj-${s.id}`} className="block text-xs font-bold text-pebble">Alasan penolakan (opsional, dilihat mitra)</label>
                    <textarea id={`rj-${s.id}`} rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-basalt border border-stoneStrong text-sm text-alabaster" />
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setRejectingId(null)} className={btnNo}>Batal</button>
                      <button type="button" disabled={busyId === s.id} onClick={() => decideSpot(s, false)} className={btnNo}>Kirim penolakan</button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busyId === s.id} onClick={() => openReject(s.id)} aria-label={`Tolak titik ${s.name}`} aria-expanded={rejectingId === s.id} className={btnNo}>Tolak</button>
                  <button type="button" disabled={busyId === s.id} onClick={() => decideSpot(s, true)} aria-label={`Terbitkan titik ${s.name}`} className={btnYes}>
                    {busyId === s.id ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Icon name="check" size={16} />}
                    <span>Terbitkan</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lg:col-span-2 gamiz-card p-5 space-y-3" aria-labelledby="aq-roster">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="aq-roster" className="text-base font-extrabold text-alabaster">Semua mitra <span className="font-num">({roster.length})</span></h2>
          <label className="sr-only" htmlFor="aq-roster-filter">Filter status mitra</label>
          <select id="aq-roster-filter" value={rosterFilter} onChange={(e) => setRosterFilter(e.target.value)} className="min-h-[44px] px-3 rounded-xl bg-obsidian border border-stoneStrong text-xs font-bold text-alabaster">
            <option value="">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="PENDING">Menunggu</option>
            <option value="REJECTED">Ditolak atau dinonaktifkan</option>
          </select>
        </div>
        <p className="text-xs text-pebble leading-relaxed">Mitra yang dinonaktifkan tidak bisa lagi mengubah lapak atau menerima voucer. Kamu bisa mengaktifkannya lagi kapan saja.</p>
        {merchants === null ? (
          <p role="status" className="text-sm text-pebble">Memuat daftar mitra</p>
        ) : roster.length === 0 ? (
          <p className="text-sm text-pebble">Tidak ada mitra untuk filter ini.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {roster.map((m) => {
              const label = m.status === "ACTIVE" ? { t: "Aktif", c: "bg-basalt text-quotaSafe" } : m.status === "PENDING" ? { t: "Menunggu persetujuan", c: "bg-slateElev text-alabaster" } : { t: "Ditolak / nonaktif", c: "bg-slateElev text-quotaFull" };
              return (
                <li key={m.id} className="list-none rounded-2xl bg-obsidian p-3.5 space-y-2">
                  <div>
                    <p className="text-sm font-extrabold text-alabaster">{m.name}</p>
                    <p className="text-[11px] text-pebble break-all">{m.email}</p>
                    <p className="text-[11px] text-pebble"><span className="font-num">{m.spotCount}</span> lapak</p>
                    <p className={`inline-flex mt-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full ${label.c}`}>{label.t}</p>
                  </div>
                  {rejectingId === `r-${m.id}` && (
                    <div className="space-y-2">
                      <label htmlFor={`rr-${m.id}`} className="block text-xs font-bold text-pebble">Alasan (dilihat mitra)</label>
                      <textarea id={`rr-${m.id}`} rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-basalt border border-stoneStrong text-sm text-alabaster" />
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setRejectingId(null)} className={btnNo}>Batal</button>
                        <button type="button" disabled={busyId === m.id} onClick={() => decideMerchant(m, false)} className={btnNo}>Nonaktifkan</button>
                      </div>
                    </div>
                  )}
                  {m.status === "ACTIVE" ? (
                    <button type="button" onClick={() => { setRejectingId(`r-${m.id}`); setReason(""); }} aria-label={`Nonaktifkan ${m.name}`} aria-expanded={rejectingId === `r-${m.id}`} className={btnNo}>Nonaktifkan</button>
                  ) : (
                    <button type="button" disabled={busyId === m.id} onClick={() => decideMerchant(m, true)} aria-label={`Aktifkan ${m.name}`} className={btnYes}>
                      <Icon name="check" size={16} />
                      <span>{m.status === "PENDING" ? "Setujui" : "Aktifkan lagi"}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
