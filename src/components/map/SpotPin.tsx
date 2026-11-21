"use client";

import React from "react";
import { motion } from "motion/react";
import Icon from "@/components/ui/Icon";
import { spotTypeIcon, spotTypeLabel } from "@/lib/spotMeta";
import type { CulturalSpot } from "@/types/lokawira";

export type PinSize = "full" | "compact" | "dot";

// Batas zoom tiap ukuran, dan jarak (px layar) di mana pin yg berdekatan digabung jadi satu lingkaran berangka
export const zoomTier = (z: number): PinSize => (z >= 15.3 ? "full" : z >= 11 ? "compact" : "dot");
export const CLUSTER_PX: Record<PinSize, number> = { full: 0, compact: 54, dot: 30 };
// Marker ditambatkan di bawah; pin kecil digeser biar titik tengahnya pas di lokasi
export const PIN_OFFSET: Record<PinSize, number> = { full: 0, compact: 18, dot: 8 };

export interface SpotPinProps {
  spot: CulturalSpot;
  hex: { primary: string; accent: string; umkm: string; safe?: string };
  isSelected: boolean;
  isCompleted: boolean;
  isRedirectTarget: boolean;
  onSelect: (spot: CulturalSpot) => void;
  size: PinSize;
  trailIndex?: number;
}

export default function SpotPin({
  spot,
  hex,
  isSelected,
  isCompleted,
  isRedirectTarget,
  onSelect,
  size,
  trailIndex,
}: SpotPinProps) {
  const quotaRatio = spot.quota.currentVisitors / spot.quota.maxCapacity;
  const isCrowded = quotaRatio >= 0.85;
  const isPrimary = spot.spotType === "PRIMARY_DEST";
  const isSanggar = spot.spotType === "SANGGAR_SENI";
  const safeColor = hex.safe ?? "#1B6334";
  const body = isCompleted ? safeColor : isPrimary ? hex.primary : isSanggar ? hex.accent : hex.umkm;
  const iconName = isCompleted ? "check" : spotTypeIcon(spot.spotType);
  const label = `Pilih titik ${spot.name}, ${spotTypeLabel(spot.spotType)}`;

  if (size === "compact" || (size === "dot" && isSelected)) {
    return (
      <div className="relative flex flex-col items-center">
        <button
          type="button"
          onClick={() => onSelect(spot)}
          aria-label={label}
          aria-pressed={isSelected}
          className={`relative rounded-full flex items-center justify-center shadow-md before:absolute before:-inset-2 before:content-[''] ${
            isSelected ? "w-11 h-11" : "w-9 h-9"
          }`}
          style={{
            backgroundColor: isSelected ? body : "var(--bg-basalt-card)",
            border: `3px solid ${isSelected ? "var(--bg-basalt-card)" : body}`,
            color: isSelected ? "#FFF8EC" : body,
            boxShadow: isSelected ? `0 0 0 3px ${body}` : undefined,
          }}
        >
          <Icon name={iconName} size={isSelected ? 22 : 18} />
          {typeof trailIndex === "number" && (
            <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-vibePrimary ring-2 ring-[var(--bg-basalt-card)] text-[10px] font-num font-extrabold text-[#FFF8EC] flex items-center justify-center">
              {trailIndex}
            </span>
          )}
          {isPrimary && isCrowded && !isCompleted && (
            <span aria-hidden="true" className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-quotaFull ring-2 ring-[var(--bg-basalt-card)]" />
          )}
        </button>
        {isSelected && (
          <span className="absolute top-full mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold max-w-[150px] truncate shadow-sm bg-vibePrimary text-[var(--vibe-on-primary)]">
            {spot.name.split("&")[0].trim()}
          </span>
        )}
      </div>
    );
  }

  // Zoom jauh: titik warna, area sentuh minimal 44x44px (16px + 2*14px)
  if (size === "dot") {
    return (
      <button
        type="button"
        onClick={() => onSelect(spot)}
        aria-label={label}
        aria-pressed={false}
        className="relative block w-4 h-4 rounded-full shadow before:absolute before:-inset-3.5 before:content-['']"
        style={{ backgroundColor: body, border: "2.5px solid var(--bg-basalt-card)" }}
      />
    );
  }

  return (
    <div className={`relative origin-bottom ${isSelected ? "scale-[1.3]" : "hover:scale-110"}`} style={{ transition: "transform 200ms" }}>
      <span aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 bottom-[-6px] w-9 h-3 rounded-[50%] bg-[#4A341C]/25" />
      {isSelected && (
        <span
          aria-hidden="true"
          className="absolute left-1/2 bottom-[-12px] w-14 h-6 rounded-[50%] border-2 animate-ground-pulse"
          style={{ borderColor: body }}
        />
      )}
      <button
        type="button"
        onClick={() => onSelect(spot)}
        aria-label={label}
        aria-pressed={isSelected}
        className="relative block w-[56px] h-[68px] before:absolute before:-inset-3 before:content-['']"
      >
        <span className={isSelected ? "animate-pin-bob block" : "block"}>
          <svg viewBox="0 0 64 76" className="w-[56px] h-[68px]" aria-hidden="true">
            <defs>
              <linearGradient id={`pg-${spot.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={body} />
                <stop offset="100%" stopColor={body} stopOpacity="0.82" />
              </linearGradient>
            </defs>
            <path
              d="M32 74 C32 74 5 46 5 27 A27 27 0 0 1 59 27 C59 46 32 74 32 74 Z"
              fill={`url(#pg-${spot.id})`}
              stroke="var(--bg-basalt-card)"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path d="M12 24 A20 20 0 0 1 32 7 A20 20 0 0 1 52 24 C44 16 20 16 12 24 Z" fill="#FFF8EC" fillOpacity="0.28" />
            <circle cx="32" cy="27" r="18" fill="var(--bg-basalt-card)" />
          </svg>
          <span className="absolute left-1/2 top-[27px] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <Icon name={iconName} size={30} motion="pop" />
          </span>
        </span>
        {typeof trailIndex === "number" && (
          <span className="absolute -top-1 -left-1 min-w-[20px] h-[20px] px-1 rounded-full bg-vibePrimary ring-2 ring-[var(--bg-basalt-card)] text-[11px] font-num font-extrabold text-[#FFF8EC] flex items-center justify-center shadow">
            {trailIndex}
          </span>
        )}
        {isPrimary && isCrowded && !isCompleted && (
          <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-quotaFull ring-2 ring-[var(--bg-basalt-card)] text-[10px] font-extrabold text-[#FFF8EC] flex items-center justify-center">
            !
          </span>
        )}
      </button>

      {isRedirectTarget && !isSelected && (
        <motion.span
          initial={{ opacity: 0, y: 6, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.9 }}
          className="absolute left-1/2 -translate-x-1/2 -top-8 px-2.5 py-1 rounded-full bg-quotaSafe text-[11px] font-extrabold text-[var(--vibe-on-primary)] shadow-md whitespace-nowrap"
        >
          Bebas antre
        </motion.span>
      )}
      {isSelected && (
        <span className="absolute left-1/2 -translate-x-1/2 -top-8 px-2.5 py-1 rounded-full bg-basalt text-[11px] font-extrabold text-alabaster shadow-md whitespace-nowrap">
          {isPrimary ? (isCrowded ? `Padat ${Math.round(quotaRatio * 100)}%` : `Lengang ${Math.round(quotaRatio * 100)}%`) : `+${spot.quest.rewardPoints} XP`}
        </span>
      )}
      <span
        className={`absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold max-w-[150px] truncate shadow-sm ${
          isSelected ? "bg-vibePrimary text-[var(--vibe-on-primary)]" : "bg-basalt text-alabaster"
        }`}
      >
        {spot.name.split("&")[0].trim()}
      </span>
    </div>
  );
}
