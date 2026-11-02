"use client";

import React, { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { api, describeError } from "@/lib/api";
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

  const decideMerchant = async (m: MerchantSummary, approve: boolean) => {
    setBusyId(m.id);
    try {
      const res = approve ? await api.approveMerchant(m.id) : await api.rejectMerchant(m.id, {});
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
      const res = await api.reviewSpot(s.id, { decision: publish ? "PUBLISH" : "REJECT" });
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
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busyId === m.id} onClick={() => decideMerchant(m, false)} aria-label={`Tolak ${m.name}`} className={btnNo}>Tolak</button>
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
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busyId === s.id} onClick={() => decideSpot(s, false)} aria-label={`Tolak titik ${s.name}`} className={btnNo}>Tolak</button>
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
    </div>
  );
}
