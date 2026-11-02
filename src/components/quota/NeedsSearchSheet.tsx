"use client";

import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import Icon, { IconName } from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import { CulturalSpot } from "@/types/lokawira";
import { regionOrigin } from "@/lib/geo";

interface NeedsSearchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // titik di kawasan aktif
  spots: CulturalSpot[];
  onShowOnMap: (spot: CulturalSpot) => void;
}

interface Need {
  id: string;
  label: string;
  icon: IconName;
  match: (s: CulturalSpot) => boolean;
}

const has = (s: CulturalSpot, word: string) =>
  s.facilities.some((f) => f.toLowerCase().includes(word));

// kebutuhan yg bisa dijawab dr data yg benar-benar ada (jenis titik & daftar fasilitas)
const NEEDS: Need[] = [
  { id: "food", label: "Makan & minum", icon: "food", match: (s) => s.spotType === "UMKM_KULINER" },
  { id: "craft", label: "Oleh-oleh & kriya", icon: "craft", match: (s) => s.spotType === "UMKM_KRIYA" },
  { id: "show", label: "Sanggar & pertunjukan", icon: "sanggar", match: (s) => s.spotType === "SANGGAR_SENI" },
  { id: "qris", label: "Bisa bayar QRIS", icon: "qr", match: (s) => has(s, "qris") },
  { id: "wheel", label: "Ramah kursi roda", icon: "users", match: (s) => has(s, "kursi roda") },
  { id: "park", label: "Ada parkir", icon: "pin", match: (s) => has(s, "parkir") },
  { id: "guide", label: "Ada pemandu", icon: "guide", match: (s) => has(s, "pemandu") || has(s, "audio") },
];

const TYPE_WORDS: Record<CulturalSpot["spotType"], string> = {
  PRIMARY_DEST: "cagar budaya candi situs wisata utama",
  SANGGAR_SENI: "sanggar seni pertunjukan tari",
  UMKM_KULINER: "makan minum kuliner jajan warung",
  UMKM_KRIYA: "oleh-oleh kriya souvenir kerajinan",
};

const TYPE_LABEL: Record<CulturalSpot["spotType"], string> = {
  PRIMARY_DEST: "Cagar budaya utama",
  SANGGAR_SENI: "Sanggar seni",
  UMKM_KULINER: "Makan & minum",
  UMKM_KRIYA: "Oleh-oleh dan kriya",
};

const iconFor = (s: CulturalSpot): IconName =>
  s.spotType === "PRIMARY_DEST"
    ? "heritage"
    : s.spotType === "SANGGAR_SENI"
    ? "sanggar"
    : s.spotType === "UMKM_KULINER"
    ? "food"
    : "umkm";

// Jarak garis lurus (Haversine) antr dua titik, dlm meter
function meters(a: CulturalSpot["coordinates"], b: CulturalSpot["coordinates"]): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const fmtDistance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

// "Butuh apa?": wisatwan mencari makan, minum, oleh-oleh, atw fasilitas
export default function NeedsSearchSheet({ isOpen, onClose, spots, onShowOnMap }: NeedsSearchSheetProps) {
  const [query, setQuery] = useState("");
  const [needId, setNeedId] = useState<string | null>(null);

  const reference = regionOrigin(spots);

  const availableNeeds = useMemo(
    () => NEEDS.map((n) => ({ ...n, count: spots.filter(n.match).length })).filter((n) => n.count > 0),
    [spots]
  );

  const results = useMemo(() => {
    const need = NEEDS.find((n) => n.id === needId);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return spots
      .filter((s) => (need ? need.match(s) : true))
      .filter((s) => {
        if (terms.length === 0) return true;
        const hay = `${s.name} ${s.address} ${s.facilities.join(" ")} ${TYPE_WORDS[s.spotType]}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
      .map((s) => ({ spot: s, dist: reference ? meters(reference.coordinates, s.coordinates) : 0 }))
      .sort((a, b) => a.dist - b.dist);
  }, [spots, query, needId, reference]);

  const header = (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="needs-sheet-title" className="font-display text-xl min-[380px]:text-2xl font-extrabold text-alabaster leading-tight">
            Butuh apa?
          </h2>
          <p className="text-xs text-pebble mt-1">Cari makan, minum, oleh-oleh, atau fasilitas di sekitar.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup pencarian"
          className="btn-tactile-secondary min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
        >
          <Icon name="close" size={18} weight="bold" />
        </button>
      </div>

      <label className="relative block">
        <span className="sr-only">Cari nama tempat atau fasilitas</span>
        <Icon name="search" size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pebble" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Contoh: wedang, QRIS, parkir"
          className="w-full min-h-[48px] pl-11 pr-3 rounded-2xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted"
        />
      </label>

      {availableNeeds.length > 0 && (
        <div role="group" aria-label="Kebutuhan cepat" className="flex gap-2 overflow-x-auto scroll-hide -mx-5 px-5 pb-1">
          {availableNeeds.map((n) => {
            const on = needId === n.id;
            return (
              <button
                key={n.id}
                type="button"
                aria-pressed={on}
                onClick={() => setNeedId(on ? null : n.id)}
                className={`min-h-[44px] px-3.5 rounded-full text-xs font-extrabold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 border transition-colors ${
                  on
                    ? "bg-vibePrimary text-[var(--vibe-on-primary)] border-transparent"
                    : "bg-basalt text-pebble border-stoneSubtle hover:text-alabaster"
                }`}
              >
                <Icon name={n.icon} size={16} />
                <span>{n.label}</span>
                <span className="font-num opacity-90">{n.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Sheet isOpen={isOpen} onClose={onClose} titleId="needs-sheet-title" header={header}>
      {results.length === 0 ? (
        <div className="py-10 text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-slateElev flex items-center justify-center text-vibePrimary">
            <Icon name="search" size={34} />
          </div>
          <p className="text-base font-extrabold text-alabaster">
            {query ? `Tidak ada yang cocok dengan "${query}"` : "Belum ada tempat untuk kebutuhan ini"}
          </p>
          <p className="text-sm text-pebble max-w-xs mx-auto">Coba kata lain, atau hapus pilihan kebutuhan.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setNeedId(null);
            }}
            className="btn-tactile-secondary min-h-[44px] px-5 text-sm"
          >
            Tampilkan semua
          </button>
        </div>
      ) : (
        <ul className="space-y-3 pt-1">
          {results.map(({ spot, dist }, i) => {
            const ratio = spot.quota.currentVisitors / spot.quota.maxCapacity;
            const crowded = ratio >= 0.85;
            const partner = spot.spotType !== "PRIMARY_DEST";
            return (
              <motion.li
                key={spot.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 30, delay: Math.min(i, 5) * 0.05 }}
                className="list-none rounded-2xl border border-stoneSubtle bg-basalt p-3.5 space-y-2.5"
              >
                <div className="flex items-start gap-3">
                  <span className="w-11 h-11 rounded-2xl bg-slateElev flex items-center justify-center text-vibePrimary shrink-0">
                    <Icon name={iconFor(spot)} size={26} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-alabaster leading-snug">{spot.name}</p>
                    <p className="text-[11px] text-pebble mt-0.5">
                      {TYPE_LABEL[spot.spotType]}
                      {reference && spot.id !== reference.id && (
                        <>
                          {" · "}
                          <span className="font-num font-bold">{fmtDistance(dist)}</span> dari{" "}
                          {reference.name.split("&")[0].trim()}
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full ${
                      crowded ? "bg-basalt text-quotaFull border border-quotaFull" : "bg-basalt text-quotaSafe border border-quotaSafe"
                    }`}
                  >
                    <Icon name={crowded ? "alert" : "check"} size={13} />
                    {crowded ? "Padat" : "Lengang"}
                  </span>
                </div>

                {spot.facilities.length > 0 && (
                  <p className="text-xs text-pebble leading-relaxed">{spot.facilities.join(" · ")}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {partner ? (
                    <span className="text-[11px] font-bold text-quotaSafe font-num">
                      Voucer {rupiah(spot.quest.voucherReward.discountAmount)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-pebble">
                      {spot.quota.estimatedWaitMinutes > 0 ? `Antre sekitar ${spot.quota.estimatedWaitMinutes} menit` : "Tanpa antre"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onShowOnMap(spot)}
                    className="btn-tactile-primary min-h-[44px] px-4 text-xs inline-flex items-center gap-1.5"
                  >
                    <Icon name="pin" size={16} />
                    <span>Lihat di peta</span>
                  </button>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      <p className="mt-5 text-[11px] text-pebble leading-relaxed">
        Yang tampil hanya mitra dan fasilitas yang terdata di LOKAWIRA. Toilet, musala, dan ATM belum ada di data kami.
      </p>
    </Sheet>
  );
}
