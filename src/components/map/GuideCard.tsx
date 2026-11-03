"use client";

import React, { useEffect, useRef } from "react";
import Icon from "@/components/ui/Icon";
import Loka from "@/components/brand/Loka";
import { useLocation } from "@/components/layout/LocationProvider";
import { bearingDegrees, compassWord, distanceMeters, formatDistance } from "@/lib/geo";
import type { WalkingRoute } from "@/lib/route";
import type { CulturalSpot } from "@/types/lokawira";

// jarak (m) yg dianggap "sudah tiba" di UI kalo server gak ngasih radius. Server tetap menentukan sendiri
export const ARRIVED_METERS = 60;

interface GuideCardProps {
  spot: CulturalSpot;
  phase: "preview" | "navigating";
  route: WalkingRoute | null;
  routeLoading: boolean;
  // radius check-in dr server (kalo ada), dipake nentuin "sudah tiba"
  arriveRadius?: number | null;
  isCheckedIn: boolean;
  onStart: () => void;
  onStop: () => void;
  onCheckIn: () => void;
}

// kartu pandu: preview (lihat rute penuh, tekan Mulai) lalu navigasi (jarak, arah, tiba -> Check-In)
export default function GuideCard({ spot, phase, route, routeLoading, arriveRadius, isCheckedIn, onStart, onStop, onCheckIn }: GuideCardProps) {
  const { position, watchError } = useLocation();
  const dest = spot.coordinates;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=walking`;

  const meters = position ? distanceMeters(position, dest) : null;
  const bearing = position ? bearingDegrees(position, dest) : null;
  const rotation = bearing === null ? 0 : position?.heading != null ? bearing - position.heading : bearing;
  const threshold = Math.max(arriveRadius ?? ARRIVED_METERS, 20);
  const arrived = meters !== null && meters <= threshold;
  const roughFix = position !== null && position.accuracy > 100;
  const walkMinutes = route ? Math.max(1, Math.round(route.seconds / 60)) : meters !== null ? Math.max(1, Math.round(meters / 1.3 / 60)) : null;

  // layar jangan mati selama navigasi
  useEffect(() => {
    if (phase !== "navigating") return;
    type WL = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WL> } };
    let lock: WL | null = null;
    let cancelled = false;
    const acquire = () => {
      nav.wakeLock
        ?.request("screen")
        .then((l) => {
          if (cancelled) void l.release();
          else lock = l;
        })
        .catch(() => undefined);
    };
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => undefined);
    };
  }, [phase]);

  // getar sekali begitu tiba
  const wasArrived = useRef(false);
  useEffect(() => {
    if (arrived && !wasArrived.current && "vibrate" in navigator) navigator.vibrate([60, 40, 60]);
    wasArrived.current = arrived;
  }, [arrived]);

  const name = spot.name.split("&")[0].trim();

  if (phase === "preview") {
    return (
      <div className="space-y-3" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className="w-12 h-12 rounded-2xl bg-slateElev flex items-center justify-center shrink-0">
            <Loka variant="mark" size={38} mood={routeLoading || !position ? "think" : "happy"} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold text-vibePrimary">Rute jalan kaki</p>
            <h3 className="text-base font-extrabold text-alabaster leading-snug">{name}</h3>
            {!position ? (
              <p className="text-xs text-pebble mt-0.5">Mencari lokasimu</p>
            ) : routeLoading && !route ? (
              <p className="text-xs text-pebble mt-0.5">Menghitung rute</p>
            ) : route ? (
              <p className="text-sm font-bold text-alabaster mt-0.5">
                <span className="font-num">{formatDistance(route.meters)}</span> · sekitar <span className="font-num">{walkMinutes}</span> menit
              </p>
            ) : (
              <p className="text-xs font-bold text-quotaWarning mt-0.5">
                Rute jalan belum tersedia. Garis putus menunjukkan arah lurus{meters !== null && <> (± <span className="font-num">{formatDistance(meters)}</span>)</>}.
              </p>
            )}
          </div>
        </div>
        {roughFix && <p className="text-[11px] font-bold text-quotaWarning">Sinyal GPS kurang tepat. Pindah ke area terbuka.</p>}
        {watchError && <p role="alert" className="text-[11px] font-bold text-quotaFull">{watchError}</p>}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button type="button" onClick={onStart} disabled={!position} className="btn-tactile-primary min-h-[48px] px-4 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            <Icon name="compass" size={20} motion="pop" />
            <span>Mulai</span>
          </button>
          <button type="button" onClick={onStop} className="btn-tactile-secondary min-h-[48px] px-4 text-sm">Batal</button>
        </div>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="min-h-[44px] inline-flex items-center text-xs font-extrabold text-vibePrimary underline underline-offset-2">
          Buka rute di Google Maps
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-live="polite">
      <div className={`rounded-2xl p-3.5 flex items-center gap-3.5 ${arrived ? "bg-quotaSafe/10" : "bg-obsidian"}`}>
        <span
          aria-hidden="true"
          className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${arrived ? "bg-quotaSafe text-[var(--vibe-on-primary)]" : "bg-slateElev text-vibePrimary"}`}
        >
          {arrived ? (
            <Icon name="check" size={30} weight="bold" />
          ) : (
            <span style={{ transform: `rotate(${rotation}deg)`, transition: "transform 400ms ease-out" }} className="inline-flex">
              <Icon name="arrowUp" size={32} weight="bold" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold text-vibePrimary truncate">Menuju {name}</p>
          {meters === null ? (
            <p className="text-sm font-extrabold text-alabaster">Mencari lokasimu</p>
          ) : arrived ? (
            <p className="text-sm font-extrabold text-alabaster">Kamu sudah tiba. Silakan Check-In.</p>
          ) : (
            <p className="text-sm font-extrabold text-alabaster">
              <span className="font-num">{formatDistance(meters)}</span> ke arah {compassWord(bearing ?? 0)}
              {walkMinutes !== null && <span className="text-pebble font-bold"> · ±<span className="font-num">{walkMinutes}</span> mnt</span>}
            </p>
          )}
          <p className="text-[11px] text-pebble">
            {position?.heading == null ? "Berjalanlah agar arah di peta menyesuaikan." : "Peta mengikuti arah jalanmu."}
            {position && <> Akurasi ±<span className="font-num">{Math.round(position.accuracy)}</span> m.</>}
          </p>
        </div>
      </div>
      {roughFix && <p className="text-[11px] font-bold text-quotaWarning">Sinyal GPS kurang tepat. Pindah ke area terbuka.</p>}
      {watchError && <p role="alert" className="text-[11px] font-bold text-quotaFull">{watchError}</p>}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={onCheckIn}
          disabled={!arrived || isCheckedIn}
          className={`${arrived && !isCheckedIn ? "btn-tactile-primary" : "btn-tactile-secondary"} min-h-[48px] px-4 text-sm flex items-center justify-center gap-2 disabled:opacity-60`}
        >
          <Icon name={isCheckedIn ? "check" : "pin"} size={20} motion="pop" />
          <span>{isCheckedIn ? "Sudah Check-In" : arrived ? "Check-In sekarang" : "Check-In (setelah tiba)"}</span>
        </button>
        <button type="button" onClick={onStop} className="btn-tactile-secondary min-h-[48px] px-4 text-sm">Berhenti</button>
      </div>
    </div>
  );
}
