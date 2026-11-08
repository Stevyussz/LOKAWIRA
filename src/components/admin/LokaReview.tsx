"use client";

import React, { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import Loka from "@/components/brand/Loka";
import { api, describeError } from "@/lib/api";
import { spotChecks, type CheckLevel, type SpotCheck } from "@/lib/loka";
import type { LokaMode } from "@/types/api";
import type { CulturalSpot } from "@/types/lokawira";

const LEVEL: Record<CheckLevel, { label: string; cls: string; icon: "alert" | "shield" | "check" }> = {
  BLOCK: { label: "Perlu diperbaiki", cls: "text-quotaFull", icon: "alert" },
  WARN: { label: "Periksa", cls: "text-quotaWarning", icon: "shield" },
  INFO: { label: "Catatan", cls: "text-pebble", icon: "check" },
};

// cek pengajuan titik: aturan tetap langsung tampil, pemeriksaan Loka (teks + foto contoh) atas permintaan
export default function LokaReview({ spot }: { spot: CulturalSpot }) {
  const local = useMemo(() => spotChecks(spot), [spot]);
  const [res, setRes] = useState<{ checks: SpotCheck[]; mode: LokaMode } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const checks = res?.checks ?? local;

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setRes(await api.reviewSpotWithLoka(spot.id));
    } catch (e) {
      setErr(describeError(e, "Loka belum bisa memeriksa sekarang."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl bg-basalt p-3 space-y-2" aria-label={`Hasil cek ${spot.name}`} role="group">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold text-alabaster">
          {checks.length === 0 ? "Tidak ada masalah ditemukan" : `${checks.filter((c) => c.level !== "INFO").length} hal perlu dilihat`}
        </p>
        <button type="button" disabled={busy} onClick={run} className="btn-tactile-secondary min-h-[44px] px-3 text-[11px] inline-flex items-center gap-1.5 disabled:opacity-60 shrink-0">
          {busy ? <Icon name="loader" size={14} weight="bold" motion="spin" /> : <Loka variant="mark" size={20} mood="think" />}
          <span>{res ? "Periksa ulang" : "Periksa dengan Loka"}</span>
        </button>
      </div>
      {checks.length > 0 && (
        <ul className="space-y-1.5">
          {checks.map((c, i) => (
            <li key={i} className="list-none flex items-start gap-2 text-[11px] leading-snug">
              <Icon name={LEVEL[c.level].icon} size={14} className={`${LEVEL[c.level].cls} shrink-0 mt-px`} />
              <span className="text-alabaster">
                <b className={LEVEL[c.level].cls}>{LEVEL[c.level].label}:</b> {c.text}
              </span>
            </li>
          ))}
        </ul>
      )}
      {res && (
        <p role="status" className="text-[11px] text-pebble">
          {res.mode === "AI" ? "Loka ikut memeriksa teks dan foto contoh. Keputusan tetap di tanganmu." : "Pemeriksaan AI sedang tidak tersedia. Yang tampil hanya cek kelengkapan."}
        </p>
      )}
      {err && <p role="alert" className="text-[11px] font-bold text-quotaFull">{err}</p>}
    </div>
  );
}
