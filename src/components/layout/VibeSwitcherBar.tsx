"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useVibeHex, VIBE_HEX } from "@/lib/vibeColors";
import { SPOT_FILTER_OPTIONS, SpotFilter } from "@/lib/spotFilter";
import Icon from "@/components/ui/Icon";
import { Region, SurfaceTheme } from "@/types/lokawira";

interface VibeSwitcherBarProps {
  // daftar kawasan dr server (bkn kode lagi)
  regions: Region[];
  activeRegionId: string;
  onChangeRegion: (regionId: string) => void;
  lokaPoints: number;
  filterType?: SpotFilter;
  onChangeFilter?: (filter: SpotFilter) => void;
  surfaceTheme?: SurfaceTheme;
  onToggleTheme?: () => void;
  gpsSimulated?: boolean;
  onToggleGps?: () => void;
  pdpConsentAccepted?: boolean;
  onAcceptPdp?: () => void;
  // Membuka sheet akun (masuk, daftar, dasbor, keluar)
  onOpenAccount?: () => void;
}

export default function VibeSwitcherBar({
  regions,
  activeRegionId,
  onChangeRegion,
  lokaPoints,
  filterType,
  onChangeFilter,
  onOpenAccount,
}: VibeSwitcherBarProps) {
  const vh = useVibeHex();
  const [regionMenuOpen, setRegionMenuOpen] = useState<boolean>(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const chipRowRef = useRef<HTMLDivElement | null>(null);

  // menu kawasan: tutup dgn Escape (fokus kembali ke pemicu) & klik di luar
  useEffect(() => {
    if (!regionMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRegionMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setRegionMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [regionMenuOpen]);

  // chip aktif slalu terlihat penuh, dgn jarak 12 px dr tepi (scrollIntoView mngabaikan padding)
  useEffect(() => {
    const row = chipRowRef.current;
    const active = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !active) return;
    const pad = 12;
    const left = active.offsetLeft - pad;
    const right = active.offsetLeft + active.offsetWidth + pad;
    if (left < row.scrollLeft) {
      row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    } else if (right > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: right - row.clientWidth, behavior: "smooth" });
    }
  }, [filterType]);

  const VIBE_OPTIONS = regions.map((r) => ({ id: r.id, shortName: r.name, regionLabel: r.label, theme: r.theme }));
  const currentVibe = VIBE_OPTIONS.find((v) => v.id === activeRegionId) || VIBE_OPTIONS[0] || { id: "", shortName: "Memuat kawasan", regionLabel: "", theme: "majapahit" as const };

  const playerLevel = Math.floor(lokaPoints / 150) + 1;
  const currentLevelXp = lokaPoints % 150;
  const xpPercent = Math.min(100, Math.round((currentLevelXp / 150) * 100));

  const RING_R = 22;
  const RING_C = 2 * Math.PI * RING_R;

  return (
    <MotionConfig reducedMotion="user">
    <header className="fixed top-3 left-3 right-3 sm:left-5 sm:right-5 z-30 pointer-events-none">
      <div className="flex items-start justify-between gap-3">
        {/* level badge dgn cincin XP */}
        <button
          type="button"
          onClick={onOpenAccount}
          className="pointer-events-auto andesite-glass rounded-full pl-1.5 pr-4 h-[56px] flex items-center gap-2.5 text-left hover:bg-slateElev transition-colors"
        >
          <span className="sr-only">Buka akun. </span>
          <div className="relative w-11 h-11 shrink-0">
            <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle cx="26" cy="26" r={RING_R} fill="none" stroke="var(--bg-obsidian-ash)" strokeWidth="5" />
              <circle
                cx="26"
                cy="26"
                r={RING_R}
                fill="none"
                stroke="var(--vibe-primary)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - xpPercent / 100)}
                style={{ transition: "stroke-dashoffset 500ms ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon name="trophy" size={22} className="text-vibePrimary" motion="pop" />
            </div>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-extrabold text-alabaster">Level {playerLevel}</p>
            <p className="text-[11px] font-bold text-vibeSecondary tabular-nums">{lokaPoints} XP</p>
          </div>
        </button>

        {/* Pemilih kawasan */}
        <div ref={menuWrapRef} className="pointer-events-auto relative min-w-0 flex-1 max-w-[270px]">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setRegionMenuOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={regionMenuOpen}
            className="andesite-glass w-full h-[56px] pl-4 pr-3 rounded-full flex items-center gap-2.5 hover:bg-slateElev transition-colors"
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: VIBE_HEX[currentVibe.theme].primary }}
            />
            <span className="min-w-0 flex-1 text-left leading-tight">
              <span className="sr-only">Pilih kawasan: </span>
              <span className="block text-sm font-extrabold text-alabaster truncate">
                {currentVibe.shortName}
              </span>
              <span className="block text-[11px] font-semibold text-pebble truncate">
                {currentVibe.regionLabel}
              </span>
            </span>
            <Icon
              name="down"
              size={16}
              weight="bold"
              className={`shrink-0 text-pebble transition-transform ${regionMenuOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
          {regionMenuOpen && (
            <motion.div
              key="region-menu"
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 480, damping: 34 }}
              style={{ transformOrigin: "top right" }}
              className="absolute right-0 mt-2 w-[min(18rem,calc(100vw-1.5rem))] gamiz-card p-2 space-y-1 z-40"
            >
              {VIBE_OPTIONS.map((v) => {
                const isSelected = v.id === activeRegionId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      onChangeRegion(v.id);
                      setRegionMenuOpen(false);
                    }}
                    className={`w-full min-h-[48px] px-3 py-2 rounded-xl flex items-center justify-between text-left transition-colors ${
                      isSelected
                        ? "bg-[var(--vibe-surface-tint)] text-alabaster"
                        : "text-pebble hover:bg-slateElev hover:text-alabaster"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: VIBE_HEX[v.theme].primary }}
                      />
                      <div>
                        <span className="text-sm font-extrabold block">{v.shortName}</span>
                        <span className="text-xs text-pebble block">{v.regionLabel}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <Icon name="check" size={20} className="text-vibePrimary" motion="pop" />
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      {/* Filter: pil terpisah, tnpa wadah - Baris bisa digeser; tepi kanan memudar sbg petunjuk */}
      {onChangeFilter && (
        <div
          ref={chipRowRef}
          role="group"
          aria-label="Filter titik peta"
          className="pointer-events-auto relative mt-2.5 flex items-center gap-2 overflow-x-auto scroll-hide -mx-3 px-3 sm:mx-0 sm:px-0 pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] sm:[mask-image:none]"
        >
          {SPOT_FILTER_OPTIONS.map((chip) => {
            const isActive = filterType === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onChangeFilter(chip.id)}
                aria-pressed={isActive}
                className={`relative min-h-[44px] px-4 rounded-full text-xs font-extrabold whitespace-nowrap shrink-0 transition-colors border ${
                  isActive
                    ? "text-[var(--vibe-on-primary)] border-transparent"
                    : "bg-basalt text-pebble border-stoneSubtle hover:text-alabaster shadow-sm"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="filter-chip-pill"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-vibePrimary shadow-md"
                    transition={{ type: "spring", stiffness: 520, damping: 36 }}
                  />
                )}
                <span className="relative">{chip.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
    </MotionConfig>
  );
}
