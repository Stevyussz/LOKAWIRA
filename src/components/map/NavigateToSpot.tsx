"use client";

import React from "react";
import Icon from "@/components/ui/Icon";
import { useLocation } from "@/components/layout/LocationProvider";
import { bearingDegrees, compassWord, distanceMeters, formatDistance } from "@/lib/geo";
import type { CulturalSpot } from "@/types/lokawira";

// jarak (m) yg dianggap "sudah tiba" di UI - server tetap menentukan sendiri radius check-in
export const ARRIVED_METERS = 60;

// pemandu arah ke titik: jarak langsung, panah arah, dan tautan rute jalan kaki di aplikasi peta
export default function NavigateToSpot({ spot }: { spot: CulturalSpot }) {
  const { position, watching, watchError, startWatching, stopWatching } = useLocation();

  const dest = spot.coordinates;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=walking`;

  const meters = position ? distanceMeters(position, dest) : null;
  const bearing = position ? bearingDegrees(position, dest) : null;
  // kalo lagi bergerak, panah dihitung relatif ke arah jalan. Kalo diam, panah mengacu ke utara
  const rotation = bearing === null ? 0 : position?.heading != null ? bearing - position.heading : bearing;
  const arrived = meters !== null && position !== null && meters <= Math.max(ARRIVED_METERS, position.accuracy);
  const roughFix = position !== null && position.accuracy > 100;

  if (!watching) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => startWatching()}
          className="btn-tactile-secondary min-h-[44px] px-4 text-xs inline-flex items-center gap-2"
        >
          <Icon name="compass" size={18} className="text-vibePrimary" motion="pop" />
          <span>Pandu aku ke sini</span>
        </button>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[44px] px-2 inline-flex items-center text-xs font-extrabold text-vibePrimary underline underline-offset-2"
        >
          Buka rute di Google Maps
        </a>
        {watchError && <p role="alert" className="basis-full text-xs font-bold text-quotaFull">{watchError}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-obsidian p-3.5 flex items-center gap-3.5" aria-live="polite">
      <span
        aria-hidden="true"
        className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${arrived ? "bg-quotaSafe text-[var(--vibe-on-primary)]" : "bg-slateElev text-vibePrimary"}`}
      >
        {arrived ? (
          <Icon name="check" size={30} weight="bold" />
        ) : (
          <span style={{ transform: `rotate(${rotation}deg)`, transition: "transform 400ms ease-out" }} className="inline-flex">
            <Icon name="up" size={32} weight="bold" />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        {meters === null ? (
          <p className="text-sm font-extrabold text-alabaster">Mencari lokasimu</p>
        ) : arrived ? (
          <p className="text-sm font-extrabold text-alabaster">Kamu sudah tiba. Silakan Check-In.</p>
        ) : (
          <p className="text-sm font-extrabold text-alabaster">
            <span className="font-num">{formatDistance(meters)}</span> ke arah {compassWord(bearing ?? 0)}
          </p>
        )}
        <p className="text-[11px] text-pebble">
          {position?.heading == null ? "Panah mengacu ke utara. Berjalanlah agar arahnya menyesuaikan." : "Panah mengikuti arah jalanmu."}
          {position && <> Akurasi ±<span className="font-num">{Math.round(position.accuracy)}</span> m.</>}
        </p>
        {roughFix && <p className="text-[11px] font-bold text-quotaWarning">Sinyal GPS kurang tepat. Pindah ke area terbuka.</p>}
        {watchError && <p role="alert" className="text-[11px] font-bold text-quotaFull">{watchError}</p>}
        <div className="flex flex-wrap items-center gap-x-3">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="min-h-[44px] inline-flex items-center text-xs font-extrabold text-vibePrimary underline underline-offset-2">
            Rute di Google Maps
          </a>
          <button type="button" onClick={stopWatching} className="min-h-[44px] inline-flex items-center text-xs font-extrabold text-pebble underline underline-offset-2">
            Berhenti memandu
          </button>
        </div>
      </div>
    </div>
  );
}
