"use client";

import React from "react";
import Icon from "@/components/ui/Icon";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  recenterLabel: string;
  isOffline?: boolean;
  onRetry?: () => void;
  onOpenNeeds?: () => void;
  onOpenTrail?: () => void;
  trailActive?: boolean;
  isSurgeDemo?: boolean;
  onToggleSurgeDemo?: () => void;
}

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onRecenter,
  recenterLabel,
  isOffline = false,
  onRetry,
  onOpenNeeds,
  onOpenTrail,
  trailActive = false,
  isSurgeDemo = false,
  onToggleSurgeDemo,
}: MapControlsProps) {
  return (
    <div
      className="fixed right-3 sm:right-5 z-20 flex flex-col gap-2"
      style={{ bottom: "calc(var(--sheet-h, 0px) + 108px + env(safe-area-inset-bottom))" }}
    >
      <div className="andesite-glass rounded-2xl p-1 hidden sm:flex flex-col">
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Perbesar peta"
          className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-alabaster hover:bg-slateElev transition-colors"
        >
          <Icon name="plus" size={20} weight="bold" />
        </button>
        <div className="h-px bg-stoneSubtle mx-2" />
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Perkecil peta"
          className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-alabaster hover:bg-slateElev transition-colors"
        >
          <Icon name="minus" size={20} weight="bold" />
        </button>
      </div>

      {isOffline && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Server tidak terhubung. Ketuk untuk mencoba lagi"
          className="min-h-[48px] min-w-[48px] rounded-2xl flex flex-col items-center justify-center text-[10px] font-extrabold leading-none gap-0.5 bg-basalt text-quotaFull border border-quotaFull"
        >
          <Icon name="alert" size={20} />
          <span>Offline</span>
        </button>
      )}

      {onOpenNeeds && (
        <button
          type="button"
          onClick={onOpenNeeds}
          aria-label="Cari makan, minum, oleh-oleh, atau fasilitas"
          className="andesite-glass min-h-[48px] min-w-[48px] rounded-2xl flex flex-col items-center justify-center text-[10px] font-extrabold leading-none gap-0.5 text-alabaster hover:bg-slateElev transition-colors"
        >
          <Icon name="search" size={20} className="text-vibePrimary" motion="pop" />
          <span>Cari</span>
        </button>
      )}

      {onOpenTrail && (
        <button
          type="button"
          onClick={onOpenTrail}
          aria-pressed={trailActive}
          aria-label="Buka rute jelajah terurut antartitik"
          className={`min-h-[48px] min-w-[48px] rounded-2xl flex flex-col items-center justify-center text-[10px] font-extrabold leading-none gap-0.5 transition-colors ${
            trailActive ? "bg-vibePrimary text-[var(--vibe-on-primary)] shadow-md" : "andesite-glass text-alabaster hover:bg-slateElev"
          }`}
        >
          <Icon name="map" size={20} className={trailActive ? "" : "text-vibePrimary"} motion="pop" />
          <span>Jelajah</span>
        </button>
      )}

      {onToggleSurgeDemo && (
        <button
          type="button"
          onClick={onToggleSurgeDemo}
          aria-pressed={isSurgeDemo}
          aria-label="Demo lonjakan pengunjung di situs utama"
          title="Mode demo: simulasikan situs utama padat 95%"
          className={`min-h-[48px] min-w-[48px] rounded-2xl flex flex-col items-center justify-center text-[10px] font-extrabold leading-none gap-0.5 transition-colors ${
            isSurgeDemo ? "bg-quotaFull text-[var(--vibe-on-primary)]" : "andesite-glass text-alabaster hover:bg-slateElev"
          }`}
        >
          <Icon name="users" size={20} motion="pop" />
          <span>Demo</span>
        </button>
      )}

      <button
        type="button"
        onClick={onRecenter}
        aria-label={recenterLabel}
        title="Pusatkan peta"
        className="andesite-glass min-h-[48px] min-w-[48px] rounded-2xl flex items-center justify-center hover:bg-slateElev transition-colors"
      >
        <Icon name="pin" size={24} className="text-vibePrimary" motion="pop" />
      </button>
    </div>
  );
}
