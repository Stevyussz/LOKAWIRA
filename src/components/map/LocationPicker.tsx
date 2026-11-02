"use client";

import React, { useRef } from "react";
import MapBackdrop from "@/components/map/MapBackdrop";
import {
  CANVAS_H,
  CANVAS_W,
  LatLng,
  ORIGIN_ON_CANVAS,
  Point,
  ZONE_RADIUS_METERS,
  ZONE_RADIUS_UNITS,
  distanceMeters,
  formatCoord,
  formatDistance,
  project,
  regionOrigin,
  unproject,
} from "@/lib/geo";
import { CulturalSpot } from "@/types/lokawira";

interface LocationPickerProps {
  // titik yg udh ada di kawasan (utk acuan posisi)
  spots: CulturalSpot[];
  value: LatLng | null;
  onChange: (c: LatLng) => void;
  // nama utk pemabca layar, mis - "Lokasi lapak"
  label?: string;
}

const clampPt = (p: Point): Point => ({
  x: Math.min(CANVAS_W - 160, Math.max(160, p.x)),
  y: Math.min(CANVAS_H - 160, Math.max(160, p.y)),
});

// penentu lokasi dgn pin di peta
export default function LocationPicker({ spots, value, onChange, label = "Lokasi" }: LocationPickerProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const origin = regionOrigin(spots);

  if (!origin) {
    return (
      <p role="status" className="text-xs text-pebble p-3 rounded-xl bg-obsidian">
        Kawasan ini belum punya cagar utama sebagai acuan, jadi pin belum bisa ditaruh. Hubungi pengelola.
      </p>
    );
  }

  const pinPos = value ? project(value, origin.coordinates) : null;
  const dist = value ? distanceMeters(origin.coordinates, value) : null;
  const outside = dist !== null && dist > ZONE_RADIUS_METERS;

  const fromEvent = (clientX: number, clientY: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const p = clampPt({
      x: ((clientX - r.left) / r.width) * CANVAS_W,
      y: ((clientY - r.top) / r.height) * CANVAS_H,
    });
    onChange(unproject(p, origin.coordinates));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 120 : 24;
    const dir: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (e.key in dir) {
      e.preventDefault();
      const base = pinPos ?? ORIGIN_ON_CANVAS;
      const [dx, dy] = dir[e.key];
      onChange(unproject(clampPt({ x: base.x + dx, y: base.y + dy }), origin.coordinates));
    } else if ((e.key === "Enter" || e.key === " ") && !pinPos) {
      e.preventDefault();
      onChange(unproject(clampPt({ x: ORIGIN_ON_CANVAS.x + 120, y: ORIGIN_ON_CANVAS.y + 120 }), origin.coordinates));
    }
  };

  return (
    <div className="space-y-2">
      <div
        ref={boxRef}
        role="group"
        tabIndex={0}
        aria-label={`${label}: peta penentu pin. Ketuk peta untuk menaruh pin, atau fokuskan lalu tekan tombol panah untuk menggeser (Shift untuk lompatan besar).`}
        onPointerDown={(e) => fromEvent(e.clientX, e.clientY)}
        onKeyDown={onKeyDown}
        style={{ aspectRatio: "3 / 2" }}
        className="relative w-full rounded-2xl overflow-hidden border-2 border-stoneStrong cursor-crosshair touch-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--vibe-primary-lip)]"
      >
        <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="w-full h-full" aria-hidden="true">
          <MapBackdrop />
          <circle
            cx={ORIGIN_ON_CANVAS.x}
            cy={ORIGIN_ON_CANVAS.y}
            r={ZONE_RADIUS_UNITS}
            fill="var(--vibe-primary)"
            fillOpacity="0.1"
            stroke="var(--vibe-primary)"
            strokeOpacity="0.5"
            strokeWidth="5"
          />
          {spots.map((sp) => {
            const p = project(sp.coordinates, origin.coordinates);
            const main = sp.id === origin.id;
            return (
              <circle
                key={sp.id}
                cx={p.x}
                cy={p.y}
                r={main ? 46 : 30}
                fill={main ? "var(--vibe-primary)" : "var(--text-pebble)"}
                stroke="var(--bg-basalt-card)"
                strokeWidth="10"
              />
            );
          })}
          {pinPos && (
            <g transform={`translate(${pinPos.x - 96} ${pinPos.y - 228}) scale(3)`}>
              <path
                d="M32 74 C32 74 5 46 5 27 A27 27 0 0 1 59 27 C59 46 32 74 32 74 Z"
                fill="var(--quota-safe)"
                stroke="var(--bg-basalt-card)"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <circle cx="32" cy="27" r="11" fill="var(--bg-basalt-card)" />
            </g>
          )}
        </svg>
        {!pinPos && (
          <p className="absolute inset-x-0 bottom-3 text-center text-xs font-extrabold text-alabaster pointer-events-none">
            <span className="px-3 py-1.5 rounded-full bg-basalt shadow-sm">Ketuk peta untuk menaruh pin</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-pebble">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-3 h-3 rounded-full bg-vibePrimary" /> Cagar utama
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-3 h-3 rounded-full bg-pebble" /> Titik lain
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-3 h-3 rounded-full bg-quotaSafe" /> Pinmu
        </span>
        <span>Lingkaran = radius {ZONE_RADIUS_METERS} m</span>
      </div>

      <p aria-live="polite" className="text-xs min-h-[2.5rem]">
        {value && dist !== null ? (
          <>
            <span className="font-num font-bold text-alabaster">{formatCoord(value)}</span>
            <span className="text-pebble"> · sekitar {formatDistance(dist)} dari {origin.name.split("&")[0].trim()}</span>
            {outside && (
              <span className="block font-bold text-quotaWarning">
                Di luar radius {ZONE_RADIUS_METERS} m, jadi lapak tidak masuk rekomendasi pengalihan antrean.
              </span>
            )}
          </>
        ) : (
          <span className="text-pebble">Pin belum ditaruh.</span>
        )}
      </p>
    </div>
  );
}
