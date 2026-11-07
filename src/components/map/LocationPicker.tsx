"use client";

import React, { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MLMap, Marker as MLMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LatLng, ZONE_RADIUS_METERS, circlePolygon, distanceMeters, formatCoord, formatDistance, regionOrigin, INDONESIA_BOUNDS } from "@/lib/geo";
import { loadLontarStyle } from "@/lib/mapStyle";
import { searchPlaces, PlaceResult } from "@/lib/geocode";
import { LocationError, useLocation } from "@/components/layout/LocationProvider";
import Icon from "@/components/ui/Icon";
import { CulturalSpot } from "@/types/lokawira";

interface LocationPickerProps {
  // titik yg udh ada di kawasan (utk acuan posisi)
  spots: CulturalSpot[];
  value: LatLng | null;
  onChange: (c: LatLng) => void;
  // nama utk pembaca layar, mis - "Lokasi lapak"
  label?: string;
}

type MapLibre = typeof import("maplibre-gl");
const ll = (c: LatLng): [number, number] => [c.lng, c.lat];

const PIN_SVG = `<svg viewBox="0 0 64 76" width="40" height="48" aria-hidden="true"><path d="M32 74 C32 74 5 46 5 27 A27 27 0 0 1 59 27 C59 46 32 74 32 74 Z" fill="#1B6334" stroke="#FFFAEE" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="27" r="11" fill="#FFFAEE"/></svg>`;

// penentu lokasi dgn pin di peta nyata (OpenStreetMap): ketuk/seret pin, atau panah keyboard
export default function LocationPicker({ spots, value, onChange, label = "Lokasi" }: LocationPickerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const mlRef = useRef<MapLibre | null>(null);
  const pinRef = useRef<MLMarker | null>(null);
  const dotsRef = useRef<MLMarker[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const origin = regionOrigin(spots);
  const { getFix } = useLocation();
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // cari tempat & pakai lokasi sekarang, biar orang awam gak perlu nyari pin sendiri
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [helper, setHelper] = useState<{ ok: boolean; text: string } | null>(null);
  const [locating, setLocating] = useState(false);

  const latest = useRef({ onChange, value, origin, spots });
  latest.current = { onChange, value, origin, spots };
  const originId = origin?.id ?? null;

  useEffect(() => {
    if (!originId) return;
    let cancelled = false;
    let map: MLMap | null = null;
    setError(null);
    (async () => {
      try {
        const [ml, style] = await Promise.all([
          import("maplibre-gl").then((m) => ((m as unknown as { default?: MapLibre }).default ?? m) as MapLibre),
          loadLontarStyle(),
        ]);
        const o = latest.current.origin;
        if (cancelled || !hostRef.current || !o) return;
        map = new ml.Map({
          container: hostRef.current,
          style,
          center: ll(latest.current.value ?? o.coordinates),
          zoom: 16,
          minZoom: 10,
          maxZoom: 19.5,
          maxBounds: INDONESIA_BOUNDS,
          renderWorldCopies: false,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          // di dalam form yg bisa di-scroll: geser peta pakai dua jari, biar gak rebutan sama scroll halaman
          cooperativeGestures: true,
          locale: {
            "CooperativeGesturesHandler.WindowsHelpText": "Tahan Ctrl sambil scroll untuk memperbesar peta",
            "CooperativeGesturesHandler.MacHelpText": "Tahan ⌘ sambil scroll untuk memperbesar peta",
            "CooperativeGesturesHandler.MobileHelpText": "Gunakan dua jari untuk menggeser peta",
          },
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new ml.AttributionControl({ compact: true }), "top-right");
        mlRef.current = ml;
        mapRef.current = map;
        map.on("click", (e) => latest.current.onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
        map.once("style.load", () => {
          if (!map) return;
          map.once("idle", () => {
            const attrib = hostRef.current?.querySelector(".maplibregl-ctrl-attrib");
            attrib?.classList.remove("maplibregl-compact-show");
            attrib?.removeAttribute("open");
          });
          const firstLabel = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
          map.addSource("zone", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circlePolygon(o.coordinates, ZONE_RADIUS_METERS)] } },
          });
          map.addLayer({ id: "zone-fill", type: "fill", source: "zone", paint: { "fill-color": "#C8421F", "fill-opacity": 0.1 } }, firstLabel);
          map.addLayer({ id: "zone-line", type: "line", source: "zone", paint: { "line-color": "#C8421F", "line-opacity": 0.5, "line-width": 2.5 } }, firstLabel);
          setReady(true);
        });
      } catch {
        if (!cancelled) setError("Peta belum bisa dimuat. Periksa koneksi internetmu.");
      }
    })();
    return () => {
      cancelled = true;
      setReady(false);
      pinRef.current = null;
      dotsRef.current = [];
      map?.remove();
      mapRef.current = null;
    };
  }, [originId, attempt]);

  // zona mengikuti cagar utama
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !origin) return;
    (map.getSource("zone") as GeoJSONSource | undefined)?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [circlePolygon(origin.coordinates, ZONE_RADIUS_METERS)] },
    });
  }, [ready, origin]);

  // titik yg sudah ada
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!ready || !map || !ml) return;
    dotsRef.current.forEach((m) => m.remove());
    dotsRef.current = spots.map((sp) => {
      const el = document.createElement("div");
      const main = sp.id === originId;
      el.style.cssText = `width:${main ? 22 : 16}px;height:${main ? 22 : 16}px;border-radius:50%;background:${main ? "#C8421F" : "#574E63"};border:3px solid #FFFAEE;pointer-events:none`;
      return new ml.Marker({ element: el }).setLngLat(ll(sp.coordinates)).addTo(map);
    });
  }, [ready, spots, originId]);

  // pin milik user (bisa diseret)
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!ready || !map || !ml) return;
    if (!value) {
      pinRef.current?.remove();
      pinRef.current = null;
      return;
    }
    if (!pinRef.current) {
      const el = document.createElement("div");
      el.innerHTML = PIN_SVG;
      const marker = new ml.Marker({ element: el, anchor: "bottom", draggable: true }).setLngLat(ll(value)).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLngLat();
        latest.current.onChange({ lat: p.lat, lng: p.lng });
      });
      pinRef.current = marker;
    } else {
      pinRef.current.setLngLat(ll(value));
    }
    // pin di luar tampilan (hasil pencarian / lokasi saya): geser peta ke situ
    if (!map.getBounds().contains(ll(value))) map.easeTo({ center: ll(value), zoom: Math.max(map.getZoom(), 17), duration: 600 });
  }, [ready, value]);

  if (!origin) {
    return (
      <p role="status" className="text-xs text-pebble p-3 rounded-xl bg-obsidian">
        Kawasan ini belum punya cagar utama sebagai acuan, jadi pin belum bisa ditaruh. Hubungi pengelola.
      </p>
    );
  }

  const dist = value ? distanceMeters(origin.coordinates, value) : null;
  const outside = dist !== null && dist > ZONE_RADIUS_METERS;

  const runSearch = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (query.trim().length < 3) {
      setHelper({ ok: false, text: "Ketik minimal 3 huruf, misalnya nama jalan, desa, atau tempat terdekat." });
      return;
    }
    setSearching(true);
    setHelper(null);
    try {
      const found = await searchPlaces(query, origin.coordinates);
      setResults(found);
      if (found.length === 0) setHelper({ ok: false, text: "Tempat tidak ditemukan. Coba nama lain, atau ketuk langsung di peta." });
    } catch {
      setHelper({ ok: false, text: "Pencarian sedang tidak bisa. Ketuk langsung di peta untuk menaruh pin." });
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    setHelper(null);
    try {
      const fix = await getFix();
      onChange({ lat: fix.lat, lng: fix.lng });
      setHelper({ ok: true, text: `Pin ditaruh di lokasimu sekarang (akurasi ±${Math.round(fix.accuracy)} m). Geser pin kalau kurang pas.` });
    } catch (err) {
      setHelper({ ok: false, text: err instanceof LocationError ? err.message : "Lokasi belum bisa dibaca. Coba lagi di tempat terbuka." });
    } finally {
      setLocating(false);
    }
  };

  // keyboard: panah menggeser pin ~10 m (Shift ~50 m), Enter/Spasi menaruh pin pertama di dekat cagar utama
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const meters = e.shiftKey ? 50 : 10;
    const dLat = meters / 111_320;
    const base = value ?? origin.coordinates;
    const dLng = meters / (111_320 * Math.cos((base.lat * Math.PI) / 180));
    const move: Record<string, [number, number]> = { ArrowUp: [dLat, 0], ArrowDown: [-dLat, 0], ArrowLeft: [0, -dLng], ArrowRight: [0, dLng] };
    if (e.key in move) {
      e.preventDefault();
      const [a, b] = move[e.key];
      const next = { lat: base.lat + a, lng: base.lng + b };
      onChange(next);
      mapRef.current?.easeTo({ center: ll(next), duration: 120 });
    } else if ((e.key === "Enter" || e.key === " ") && !value) {
      e.preventDefault();
      onChange({ lat: origin.coordinates.lat - 40 / 111_320, lng: origin.coordinates.lng });
    }
  };

  return (
    <div className="space-y-2">
      <div role="search" className="flex gap-2">
        <label htmlFor={`${slug}-cari`} className="sr-only">Cari alamat atau nama tempat</label>
        <input
          id={`${slug}-cari`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // picker ini dipakai di dalam <form> lain: Enter cuma buat cari, bkn kirim form
            if (e.key === "Enter") runSearch(e);
          }}
          placeholder="Cari alamat atau nama tempat"
          className="flex-1 min-w-0 min-h-[48px] px-3.5 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted"
        />
        <button type="button" onClick={runSearch} disabled={searching} className="btn-tactile-secondary min-h-[48px] px-4 text-xs inline-flex items-center gap-1.5 shrink-0 disabled:opacity-70">
          {searching ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Icon name="search" size={16} />}
          <span>Cari</span>
        </button>
      </div>
      {results && results.length > 0 && (
        <ul aria-label="Hasil pencarian" className="rounded-2xl border border-stoneSubtle bg-basalt divide-y divide-stoneSubtle overflow-hidden">
          {results.map((r, i) => (
            <li key={`${r.coords.lat}-${r.coords.lng}-${i}`} className="list-none">
              <button
                type="button"
                onClick={() => {
                  onChange(r.coords);
                  setResults(null);
                  setHelper({ ok: true, text: `Pin ditaruh di ${r.name}. Geser pin kalau kurang pas.` });
                }}
                className="w-full min-h-[48px] px-3.5 py-2 text-left"
              >
                <span className="block text-sm font-bold text-alabaster">{r.name}</span>
                {r.detail && <span className="block text-[11px] text-pebble">{r.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={useMyLocation} disabled={locating} className="btn-tactile-secondary min-h-[48px] w-full px-4 text-xs inline-flex items-center justify-center gap-2 disabled:opacity-70">
        {locating ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Icon name="compass" size={18} className="text-vibePrimary" />}
        <span>Pakai lokasiku sekarang</span>
      </button>
      {helper && (
        <p role={helper.ok ? "status" : "alert"} className={`text-xs font-bold ${helper.ok ? "text-quotaSafe" : "text-quotaFull"}`}>{helper.text}</p>
      )}

      <div className="relative w-full rounded-2xl overflow-hidden border-2 border-stoneStrong" style={{ aspectRatio: "3 / 2", backgroundColor: "var(--map-land)" }}>
        <div
          ref={hostRef}
          role="group"
          tabIndex={0}
          aria-label={`${label}: peta penentu pin. Ketuk peta atau seret pin untuk menaruhnya, atau fokuskan lalu tekan tombol panah untuk menggeser (Shift untuk lompatan lebih jauh).`}
          onKeyDown={onKeyDown}
          style={{ position: "absolute", inset: 0 }}
          className="cursor-crosshair focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-4 focus-visible:outline-[var(--vibe-primary-lip)]"
        />
        {!ready && !error && <p role="status" className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-pebble pointer-events-none">Memuat peta</p>}
        {error && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center bg-basalt">
            <p className="text-xs font-extrabold text-alabaster">{error}</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn-tactile-secondary min-h-[44px] px-4 text-xs">Coba lagi</button>
          </div>
        )}
        {ready && !value && (
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
            {dist > 20000 && (
              <span className="block font-bold text-quotaFull">
                Lokasi ini jauh dari kawasan yang kamu pilih. Periksa pilihan Kawasan, atau pilih ulang pin.
              </span>
            )}
            {outside && dist <= 20000 && (
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
