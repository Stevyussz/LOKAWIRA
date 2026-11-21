"use client";

import React from "react";
import Sheet from "@/components/ui/Sheet";
import Icon from "@/components/ui/Icon";
import LokaScene from "@/components/brand/LokaScene";
import { NusantaraPatternStrip } from "@/components/brand/NusantaraOrnaments";
import { distanceMeters, formatDistance } from "@/lib/geo";
import type { TravelMode, WalkingRoute } from "@/lib/route";
import { spotTypeIcon, spotTypeLabel } from "@/lib/spotMeta";
import type { CulturalSpot, CulturalVibe } from "@/types/lokawira";

interface CulturalTrailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  regionName: string;
  vibe: CulturalVibe;
  orderedSpots: CulturalSpot[];
  checkedInSpotIds: string[];
  mode: TravelMode;
  onChangeMode: (m: TravelMode) => void;
  trailActive: boolean;
  trailRoute: WalkingRoute | null;
  trailLoading: boolean;
  onActivateTrail: () => void;
  onStopTrail: () => void;
  onSelectStop: (spot: CulturalSpot) => void;
}

export default function CulturalTrailSheet({
  isOpen,
  onClose,
  regionName,
  vibe,
  orderedSpots,
  checkedInSpotIds,
  mode,
  onChangeMode,
  trailActive,
  trailRoute,
  trailLoading,
  onActivateTrail,
  onStopTrail,
  onSelectStop,
}: CulturalTrailSheetProps) {
  let straightMeters = 0;
  const legMeters: (number | null)[] = orderedSpots.map((sp, i) => {
    if (i === 0) return null;
    const d = distanceMeters(orderedSpots[i - 1].coordinates, sp.coordinates);
    straightMeters += d;
    return d;
  });

  const totalMeters = trailRoute?.meters ?? straightMeters;
  const speedMs = mode === "motorcycle" ? 7.2 : 1.3;
  const totalMinutes = trailRoute
    ? Math.max(1, Math.round(trailRoute.seconds / 60))
    : Math.max(1, Math.round(totalMeters / speedMs / 60));

  const nextStop = orderedSpots.find((s) => !checkedInSpotIds.includes(s.id)) ?? orderedSpots[0] ?? null;

  const header = (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="trail-sheet-title" className="font-display text-xl min-[380px]:text-2xl font-extrabold text-alabaster leading-tight">
            Rute Jelajah Kawasan
          </h2>
          <p className="text-xs text-pebble mt-1">
            Urutan kunjung terpendek di {regionName || "kawasan ini"} untuk jelajah berurutan.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup Rute Jelajah"
          className="btn-tactile-secondary min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
        >
          <Icon name="close" size={18} weight="bold" />
        </button>
      </div>
      <NusantaraPatternStrip vibe={vibe} height={8} />
    </div>
  );

  return (
    <Sheet isOpen={isOpen} onClose={onClose} titleId="trail-sheet-title" header={header}>
      {orderedSpots.length < 2 ? (
        <div className="py-8 text-center space-y-3">
          <LokaScene scene="empty-map" vibe={vibe} size={104} />
          <p className="text-base font-extrabold text-alabaster">Rute butuh minimal 2 titik</p>
          <p className="text-sm text-pebble max-w-xs mx-auto">
            Kawasan ini baru memiliki {orderedSpots.length} titik aktif. Jelajahi langsung di peta atau pindah ke kawasan lain.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          <div role="group" aria-label="Moda jelajah" className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "foot", label: "Jalan kaki" },
                { id: "motorcycle", label: "Sepeda motor" },
              ] as const
            ).map((opt) => {
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChangeMode(opt.id)}
                  className={`min-h-[44px] px-3 rounded-xl text-xs font-extrabold border transition-colors ${
                    active
                      ? "bg-vibePrimary text-[var(--vibe-on-primary)] border-transparent"
                      : "bg-basalt text-pebble border-stoneSubtle hover:text-alabaster"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl bg-obsidian p-3.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-pebble">Perkiraan total jalur ({orderedSpots.length} pemberhentian)</p>
              <p className="text-sm font-extrabold text-alabaster mt-0.5">
                {trailLoading ? (
                  "Menghitung rute jalan..."
                ) : (
                  <>
                    <span className="font-num">{formatDistance(totalMeters)}</span> · sekitar{" "}
                    <span className="font-num">{totalMinutes}</span> menit ({mode === "motorcycle" ? "motor" : "jalan kaki"})
                  </>
                )}
              </p>
            </div>
            {trailActive && (
              <span className="px-2.5 py-1 rounded-full bg-quotaSafe/15 text-[11px] font-extrabold text-quotaSafe">
                Aktif di peta
              </span>
            )}
          </div>

          <ol className="space-y-2.5">
            {orderedSpots.map((spot, i) => {
              const done = checkedInSpotIds.includes(spot.id);
              const leg = legMeters[i];
              return (
                <li
                  key={spot.id}
                  className="list-none rounded-2xl border border-stoneSubtle bg-basalt p-3 flex items-center gap-3"
                >
                  <span
                    className={`w-8 h-8 rounded-full font-num text-xs font-extrabold flex items-center justify-center shrink-0 ${
                      done ? "bg-quotaSafe text-[var(--vibe-on-primary)]" : "bg-vibePrimary text-[var(--vibe-on-primary)]"
                    }`}
                  >
                    {done ? <Icon name="check" size={16} /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-alabaster leading-snug truncate">{spot.name}</p>
                    <p className="text-[11px] text-pebble flex items-center gap-1.5 mt-0.5">
                      <Icon name={spotTypeIcon(spot.spotType)} size={13} className="text-vibePrimary shrink-0" />
                      <span>{spotTypeLabel(spot.spotType)}</span>
                      {leg !== null && <span>· {formatDistance(leg)} dr titik sebelumnya</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStop(spot);
                      onClose();
                    }}
                    className="btn-tactile-secondary min-h-[44px] px-3 text-xs shrink-0"
                  >
                    Pilih
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-wrap gap-2 pt-1">
            {!trailActive ? (
              <button
                type="button"
                onClick={() => {
                  onActivateTrail();
                  if (orderedSpots[0]) onSelectStop(orderedSpots[0]);
                  onClose();
                }}
                className="btn-tactile-primary flex-1 min-h-[48px] px-5 text-sm inline-flex items-center justify-center gap-2"
              >
                <Icon name="map" size={18} />
                <span>Tampilkan rute di peta</span>
              </button>
            ) : (
              <>
                {nextStop && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStop(nextStop);
                      onClose();
                    }}
                    className="btn-tactile-primary flex-1 min-h-[48px] px-4 text-sm inline-flex items-center justify-center gap-2"
                  >
                    <Icon name="compass" size={18} />
                    <span>Lanjut ke titik berikutnya</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onStopTrail}
                  className="btn-tactile-secondary min-h-[48px] px-4 text-sm"
                >
                  Tutup rute
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
