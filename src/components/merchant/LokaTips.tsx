"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Loka from "@/components/brand/Loka";
import { api } from "@/lib/api";
import { merchantTips, type MerchantTip, type TipAction } from "@/lib/loka";
import type { CulturalSpot, SpotImpact } from "@/types/lokawira";

const ACTION_LABEL: Record<TipAction, string> = {
  EDIT: "Ubah lapak",
  SCAN: "Buka Promo & Scan",
  EVENT: "Buat agenda",
  POSTER: "Buka poster QR",
  CASHIER: "Buka Kasir",
};

interface Props {
  spots: CulturalSpot[];
  onAction: (action: Exclude<TipAction, "POSTER">, spotId: string) => void;
}

// saran Loka buat mitra: dr kelengkapan lapak & angka dampak 30 hari. Aturannya tetap (bukan tebakan AI), jadi selalu jalan
export default function LokaTips({ spots, onAction }: Props) {
  const [impact, setImpact] = useState<SpotImpact[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    api
      .impact({ days: 30 })
      .then((r) => setImpact(r.spots))
      .catch(() => setImpact([]));
  }, []);

  const tips = useMemo(() => {
    if (impact === null) return [];
    const byId = new Map(impact.map((x) => [x.spotId, x]));
    return spots.filter((s) => s.status !== "ARCHIVED").flatMap((s) => merchantTips(s, byId.get(s.id)).map((t) => ({ ...t, spotName: s.name })));
  }, [spots, impact]);

  if (impact === null || spots.length === 0) return null;
  const shown = showAll ? tips : tips.slice(0, 3);
  const many = spots.length > 1;

  return (
    <section className="gamiz-card p-5 space-y-3" aria-labelledby="loka-tips-title">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-slateElev flex items-center justify-center shrink-0">
          <Loka variant="mark" size={32} mood={tips.length ? "curious" : "cheer"} />
        </span>
        <div className="min-w-0">
          <h2 id="loka-tips-title" className="text-base font-extrabold text-alabaster">Saran Loka untuk lapakmu</h2>
          <p className="text-xs text-pebble">Dari kelengkapan lapak dan angka 30 hari terakhir.</p>
        </div>
      </div>
      {tips.length === 0 ? (
        <p className="text-sm text-alabaster">Lapakmu sudah lengkap dan ramai dikunjungi. Pertahankan agenda rutinmu.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((t: MerchantTip & { spotName: string }, i) => (
            <li key={`${t.spotId}-${t.title}-${i}`} className="list-none rounded-2xl bg-obsidian p-3.5 flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-alabaster">
                  {t.title}
                  {many && <span className="font-bold text-pebble"> · {t.spotName}</span>}
                </p>
                <p className="text-xs text-pebble leading-snug mt-0.5">{t.text}</p>
              </div>
              {t.action === "POSTER" ? (
                <Link href={`/poster/${t.spotId}`} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center justify-center gap-1.5 shrink-0">
                  <Icon name="qr" size={16} />
                  <span>{ACTION_LABEL.POSTER}</span>
                </Link>
              ) : t.action ? (
                <button type="button" onClick={() => onAction(t.action as Exclude<TipAction, "POSTER">, t.spotId)} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center justify-center gap-1.5 shrink-0">
                  <Icon name="next" size={16} />
                  <span>{ACTION_LABEL[t.action]}</span>
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {tips.length > 3 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="min-h-[44px] text-xs font-extrabold text-vibePrimary underline underline-offset-2">
          {showAll ? "Tampilkan lebih sedikit" : `Lihat ${tips.length - 3} saran lain`}
        </button>
      )}
    </section>
  );
}
