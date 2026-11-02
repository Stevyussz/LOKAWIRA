"use client";

import React, { useMemo } from "react";
import { motion } from "motion/react";
import Icon, { IconName } from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import { CulturalSpot } from "@/types/lokawira";
import { anchorSpot } from "@/lib/geo";

interface QuotaBoardSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // titik di kawasan aktif
  spots: CulturalSpot[];
  // pesan jadwal masuk utk satu titik (membuka SmartQuotaModal)
  onBook: (spot: CulturalSpot) => void;
  // tunjukkan satu titik di peta
  onShowOnMap: (spot: CulturalSpot) => void;
}

type Level = "FULL" | "WARN" | "SAFE";

const LEVEL_META: Record<Level, { label: string; icon: IconName; text: string; bar: string; chip: string }> = {
  FULL: { label: "Padat", icon: "alert", text: "text-quotaFull", bar: "bg-quotaFull", chip: "bg-quotaFull/12 text-quotaFull" },
  WARN: { label: "Hampir penuh", icon: "alert", text: "text-quotaWarning", bar: "bg-quotaWarning", chip: "bg-quotaWarning/12 text-quotaWarning" },
  SAFE: { label: "Lengang", icon: "check", text: "text-quotaSafe", bar: "bg-quotaSafe", chip: "bg-quotaSafe/12 text-quotaSafe" },
};

const levelOf = (ratio: number): Level => (ratio >= 0.85 ? "FULL" : ratio >= 0.6 ? "WARN" : "SAFE");

const iconFor = (spot: CulturalSpot): IconName =>
  spot.spotType === "PRIMARY_DEST"
    ? "heritage"
    : spot.spotType === "SANGGAR_SENI"
    ? "sanggar"
    : spot.spotType === "UMKM_KULINER"
    ? "food"
    : "umkm";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

// papan Antrean: gambaran seluruh titik di kawasan, diurutkan dr yg paing padat
export default function QuotaBoardSheet({ isOpen, onClose, spots, onBook, onShowOnMap }: QuotaBoardSheetProps) {
  const rows = useMemo(
    () =>
      spots
        .map((spot) => ({ spot, ratio: spot.quota.currentVisitors / spot.quota.maxCapacity }))
        .sort((a, b) => b.ratio - a.ratio),
    [spots]
  );
  const primary = anchorSpot(spots);
  const primaryRatio = primary ? primary.quota.currentVisitors / primary.quota.maxCapacity : 0;
  const redirect = !!primary && primaryRatio >= 0.85;
  const partners = spots.filter((s) => s.spotType !== "PRIMARY_DEST");
  const bestReward = partners.reduce((m, s) => Math.max(m, s.quest.voucherReward.discountAmount), 0);

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id="quota-board-title" className="font-display text-xl min-[380px]:text-2xl font-extrabold text-alabaster leading-tight">
          Papan Antrean
        </h2>
        <p className="text-xs text-pebble mt-1">
          Pilih tujuan yang lengang. <span className="font-bold">Angka kuota adalah data demo.</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup Papan Antrean"
        className="btn-tactile-secondary min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
      >
        <Icon name="close" size={18} weight="bold" />
      </button>
    </div>
  );

  return (
    <Sheet isOpen={isOpen} onClose={onClose} titleId="quota-board-title" header={header}>
      {rows.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-slateElev flex items-center justify-center text-vibePrimary">
            <Icon name="users" size={34} />
          </div>
          <p className="text-base font-extrabold text-alabaster">Belum ada titik di kawasan ini</p>
          <p className="text-sm text-pebble">Pindah kawasan dari pemilih di atas peta.</p>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {primary && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              aria-label="Rekomendasi"
              className={`rounded-2xl p-4 space-y-2.5 ${redirect ? "bg-[var(--vibe-surface-tint)]" : "bg-quotaSafe/10"}`}
            >
              <p className="text-sm font-extrabold text-alabaster leading-snug">
                {redirect
                  ? `Antrean ${primary.name} sekitar ${primary.quota.estimatedWaitMinutes} menit.`
                  : `${primary.name} sedang lengang. Langsung masuk.`}
              </p>
              {redirect && partners.length > 0 && (
                <p className="text-xs text-alabaster leading-relaxed">
                  Ambil jadwal masuk, lalu kunjungi{" "}
                  <strong>{partners.map((p) => p.name.split("&")[0].trim()).join(" dan ")}</strong> sambil
                  menunggu. Hadiah voucer hingga{" "}
                  <strong className="font-num text-vibeSecondary">{rupiah(bestReward)}</strong>.
                </p>
              )}
              {redirect && (
                <button
                  type="button"
                  onClick={() => onBook(primary)}
                  className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center gap-2"
                >
                  <Icon name="ticket" size={18} />
                  <span>Ambil jadwal masuk</span>
                </button>
              )}
            </motion.section>
          )}

          <ul className="space-y-3">
            {rows.map(({ spot, ratio }, i) => {
              const level = levelOf(ratio);
              const meta = LEVEL_META[level];
              const isPrimary = spot.spotType === "PRIMARY_DEST";
              const pct = Math.min(100, Math.round(ratio * 100));
              return (
                <motion.li
                  key={spot.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30, delay: 0.08 + Math.min(i, 5) * 0.05 }}
                  className="list-none rounded-2xl border border-stoneSubtle bg-basalt p-3.5 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-slateElev flex items-center justify-center text-vibePrimary shrink-0">
                      <Icon name={iconFor(spot)} size={26} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-alabaster leading-snug">{spot.name}</p>
                      <p className="text-[11px] text-pebble mt-0.5">
                        {isPrimary
                          ? "Cagar budaya utama"
                          : spot.spotType === "SANGGAR_SENI"
                          ? "Sanggar seni"
                          : spot.spotType === "UMKM_KULINER"
                          ? "Makan & minum"
                          : "Oleh-oleh dan kriya"}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full ${meta.chip}`}>
                      <Icon name={meta.icon} size={13} />
                      {meta.label}
                    </span>
                  </div>

                  <div>
                    <div
                      role="meter"
                      aria-label={`Kuota ${spot.name}`}
                      aria-valuemin={0}
                      aria-valuemax={spot.quota.maxCapacity}
                      aria-valuenow={spot.quota.currentVisitors}
                      className="h-2.5 rounded-full bg-obsidian overflow-hidden"
                    >
                      <motion.div
                        className={`h-full rounded-full origin-left ${meta.bar}`}
                        style={{ width: `${pct}%` }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ type: "spring", stiffness: 140, damping: 22, delay: 0.15 + i * 0.05 }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px] font-bold text-pebble font-num">
                      <span>
                        {spot.quota.currentVisitors}/{spot.quota.maxCapacity} pengunjung
                      </span>
                      <span>
                        {spot.quota.estimatedWaitMinutes > 0
                          ? `Antre sekitar ${spot.quota.estimatedWaitMinutes} menit`
                          : "Tanpa antre"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {isPrimary ? (
                      <span className="text-[11px] text-pebble">Slot berikutnya: <strong className="font-num text-alabaster">{spot.quota.nextAvailableSlot}</strong></span>
                    ) : (
                      <span className="text-[11px] font-bold text-quotaSafe font-num">
                        Voucer {rupiah(spot.quest.voucherReward.discountAmount)}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onShowOnMap(spot)}
                        className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5"
                      >
                        <Icon name="pin" size={16} />
                        <span>Lihat di peta</span>
                      </button>
                      {isPrimary && level !== "SAFE" && (
                        <button
                          type="button"
                          onClick={() => onBook(spot)}
                          className="btn-tactile-primary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5"
                        >
                          <Icon name="ticket" size={16} />
                          <span>Ambil jadwal</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
