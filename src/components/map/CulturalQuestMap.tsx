"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import type { GeoJSONSource, Map as MLMap, Marker as MLMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Icon from "@/components/ui/Icon";
import Loka from "@/components/brand/Loka";
import { CulturalSpot, CulturalVibe, SurfaceTheme } from "@/types/lokawira";
import { VIBE_METADATA } from "@/lib/seedCulturalData";
import { VIBE_HEX } from "@/lib/vibeColors";
import { ZONE_RADIUS_METERS, LatLng, anchorSpot, bearingDegrees, circlePolygon, curveBetween, distanceMeters, formatDistance, regionOrigin } from "@/lib/geo";
import { loadLontarStyle } from "@/lib/mapStyle";
import { fetchWalkingRoute, WalkingRoute } from "@/lib/route";
import { matchesSpotFilter, SpotFilter, SPOT_FILTER_OPTIONS } from "@/lib/spotFilter";

interface CulturalQuestMapProps {
  spots: CulturalSpot[];
  selectedSpot: CulturalSpot | null;
  onSelectSpot: (spot: CulturalSpot) => void;
  activeVibe: CulturalVibe;
  surfaceTheme?: SurfaceTheme;
  onToggleTheme?: () => void;
  checkedInSpotIds: string[];
  filterType: SpotFilter;
  onResetFilter?: () => void;
  // Membuka sheet "Butuh apa?"
  onOpenNeeds?: () => void;
  // server gak terjangkau: tampilkan penanda & izinkan coba lagi
  isOffline?: boolean;
  onRetry?: () => void;
  // Demo: paksa situs utama ke 95% biar jalur pengalihan terlihat tnpa data langsung
  isSurgeDemo?: boolean;
  onToggleSurgeDemo?: () => void;
  // posisi GPS asli pengguna (kalo lagi dipandu). Kosong = penanda 'Kamu' gak tampil
  userPosition?: { lat: number; lng: number; heading?: number | null } | null;
}

type MapLibre = typeof import("maplibre-gl");
type Pt = [number, number];
const EMPTY = { type: "FeatureCollection", features: [] } as const;
const ll = (c: LatLng): Pt => [c.lng, c.lat];
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobileView = () => typeof window !== "undefined" && window.innerWidth < 640;

// padding kamera: ruang buat HUD atas & kartu bawah, biar titik gak ketutup
const cameraPadding = () => ({ top: 150, bottom: isMobileView() ? 300 : 120, left: 24, right: 84 });

// MapLibre nambah role/tabindex ke elemen marker; isinya udah tombol sendiri, jadi dicopot biar gak interaktif bersarang
function plainMarkerEl(el: HTMLElement) {
  el.setAttribute("role", "group");
  el.removeAttribute("tabindex");
  el.removeAttribute("aria-label");
}

const typeLabel = (t: CulturalSpot["spotType"]) =>
  t === "PRIMARY_DEST" ? "Cagar Utama" : t === "SANGGAR_SENI" ? "Sanggar Seni" : t === "UMKM_KULINER" ? "Makan & Minum" : "Oleh-oleh";

interface PinProps {
  spot: CulturalSpot;
  hex: { primary: string; accent: string; umkm: string };
  isSelected: boolean;
  isCompleted: boolean;
  isRedirectTarget: boolean;
  onSelect: (spot: CulturalSpot) => void;
}

// isi 1 pin (dirender ke elemen marker MapLibre lewat portal)
function SpotPin({ spot, hex, isSelected, isCompleted, isRedirectTarget, onSelect }: PinProps) {
  const quotaRatio = spot.quota.currentVisitors / spot.quota.maxCapacity;
  const isCrowded = quotaRatio >= 0.85;
  const isPrimary = spot.spotType === "PRIMARY_DEST";
  const isSanggar = spot.spotType === "SANGGAR_SENI";
  const body = isCompleted ? "#2B8A4B" : isPrimary ? hex.primary : isSanggar ? hex.accent : hex.umkm;
  const iconName = isCompleted ? "check" : isPrimary ? "heritage" : isSanggar ? "sanggar" : spot.spotType === "UMKM_KULINER" ? "food" : "umkm";

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
        aria-label={`Pilih titik ${spot.name}, ${typeLabel(spot.spotType)}`}
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

export default function CulturalQuestMap({
  spots,
  selectedSpot,
  onSelectSpot,
  activeVibe,
  checkedInSpotIds,
  filterType,
  onResetFilter,
  onOpenNeeds,
  isOffline = false,
  onRetry,
  isSurgeDemo = false,
  onToggleSurgeDemo,
  userPosition = null,
}: CulturalQuestMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const mlRef = useRef<MapLibre | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const vibeMeta = VIBE_METADATA[activeVibe];
  const hex = VIBE_HEX[activeVibe] ?? VIBE_HEX.majapahit;

  const filteredSpots = useMemo(() => spots.filter((spot) => matchesSpotFilter(spot, filterType)), [spots, filterType]);
  const visibleIds = useMemo(() => new Set(filteredSpots.map((x) => x.id)), [filteredSpots]);

  // pengalihan antrean: situs utama >= 85% memunculkan jalur ke mitra terdekat
  const primarySpotData = anchorSpot(spots);
  const redirectActive = primarySpotData ? primarySpotData.quota.currentVisitors / primarySpotData.quota.maxCapacity >= 0.85 : false;
  const routesVisible = redirectActive && !!primarySpotData && visibleIds.has(primarySpotData.id);

  // ref ke nilai terbaru, biar handler peta (dibikin sekali) gak basi
  const latest = useRef({ spots, selectedSpot, userPosition });
  latest.current = { spots, selectedSpot, userPosition };

  // ---- chip di tepi layar: muncul kalo tujuan di luar tampilan, nunjuk arahnya + jarak ----
  const edgeRef = useRef<HTMLButtonElement | null>(null);
  const updateEdge = useCallback(() => {
    const el = edgeRef.current;
    const map = mapRef.current;
    const { selectedSpot: sel, userPosition: me } = latest.current;
    if (!el) return;
    if (!map || !sel || !me) {
      el.style.display = "none";
      return;
    }
    const box = map.getContainer();
    const w = box.clientWidth;
    const h = box.clientHeight;
    const p = map.project(ll(sel.coordinates));
    const pad = cameraPadding();
    const left = pad.left + 4, right = w - pad.right - 12, top = pad.top, bottom = h - pad.bottom;
    if (p.x > left && p.x < right && p.y > top && p.y < bottom) {
      el.style.display = "none";
      return;
    }
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const k = Math.min(
      p.x === cx ? Infinity : ((p.x > cx ? right : left) - cx) / (p.x - cx),
      p.y === cy ? Infinity : ((p.y > cy ? bottom : top) - cy) / (p.y - cy)
    );
    el.style.display = "flex";
    el.style.left = `${cx + (p.x - cx) * k}px`;
    el.style.top = `${cy + (p.y - cy) * k}px`;
    const arrow = el.firstElementChild as HTMLElement | null;
    if (arrow) arrow.style.transform = `rotate(${(Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90}deg)`;
    const text = el.lastElementChild as HTMLElement | null;
    const label = formatDistance(distanceMeters(me, sel.coordinates));
    if (text && text.textContent !== label) text.textContent = label;
  }, []);

  // ---- bikin peta (sekali; ulang kalo user tekan "coba lagi") ----
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setMapError(null);
    (async () => {
      try {
        const [ml, style] = await Promise.all([import("maplibre-gl").then((m) => ((m as unknown as { default?: MapLibre }).default ?? m) as MapLibre), loadLontarStyle()]);
        if (cancelled || !hostRef.current) return;
        const origin = regionOrigin(latest.current.spots);
        map = new ml.Map({
          container: hostRef.current,
          style,
          center: origin ? ll(origin.coordinates) : [112.3787, -7.5555],
          zoom: 16,
          minZoom: 3,
          maxZoom: 19.5,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          fadeDuration: 120,
        });
        map.touchZoomRotate.disableRotation();
        map.keyboard.disableRotation();
        map.addControl(new ml.AttributionControl({ compact: true }), "top-right");
        mlRef.current = ml;
        mapRef.current = map;
        // gaya/ubin gak termuat dlm 20 dtk = anggap gagal
        timer = setTimeout(() => {
          if (!cancelled && !map?.isStyleLoaded()) setMapError("Peta belum bisa dimuat. Periksa koneksi internetmu.");
        }, 20000);
        map.once("style.load", () => {
          if (!map) return;
          clearTimeout(timer);
          // atribusi compact mulai terbuka & numpuk peta, tutup dulu (tetap bisa dibuka lewat tombol i)
          map.once("idle", () => {
            const attrib = hostRef.current?.querySelector(".maplibregl-ctrl-attrib");
            attrib?.classList.remove("maplibregl-compact-show");
            attrib?.removeAttribute("open");
          });
          const firstLabel = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
          map.addSource("zone", { type: "geojson", data: EMPTY as never });
          map.addLayer({ id: "zone-fill", type: "fill", source: "zone", paint: { "fill-color": "#C8421F", "fill-opacity": 0.08 } }, firstLabel);
          map.addLayer({ id: "zone-line", type: "line", source: "zone", paint: { "line-color": "#C8421F", "line-opacity": 0.45, "line-width": 2 } }, firstLabel);
          map.addSource("redirect", { type: "geojson", data: EMPTY as never });
          map.addLayer({ id: "redirect-casing", type: "line", source: "redirect", layout: { "line-cap": "round" }, paint: { "line-color": "#FFFAEE", "line-width": 9 } }, firstLabel);
          map.addLayer({ id: "redirect-line", type: "line", source: "redirect", layout: { "line-cap": "round" }, paint: { "line-color": "#1B6334", "line-width": 4.5 } }, firstLabel);
          map.addSource("redirect-end", { type: "geojson", data: EMPTY as never });
          map.addLayer({ id: "redirect-end", type: "circle", source: "redirect-end", paint: { "circle-radius": 6, "circle-color": "#FFFAEE", "circle-stroke-color": "#1B6334", "circle-stroke-width": 3.5 } }, firstLabel);
          map.addSource("route", { type: "geojson", data: EMPTY as never });
          map.addLayer({ id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#FFFAEE", "line-width": 10 } }, firstLabel);
          map.addLayer({ id: "route-road", type: "line", source: "route", filter: ["==", ["get", "kind"], "road"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#C8421F", "line-width": 5 } }, firstLabel);
          map.addLayer({ id: "route-straight", type: "line", source: "route", filter: ["==", ["get", "kind"], "straight"], layout: { "line-cap": "round" }, paint: { "line-color": "#C8421F", "line-width": 4, "line-dasharray": [0.5, 2.2] } }, firstLabel);
          setReady(true);
        });
        map.on("move", () => updateEdge());
      } catch {
        if (!cancelled) setMapError("Peta belum bisa dimuat. Pastikan perangkat mendukung WebGL dan koneksi internet aktif.");
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setReady(false);
      map?.remove();
      mapRef.current = null;
    };
  }, [attempt, updateEdge]);

  // ---- marker titik ----
  const markersRef = useRef<Map<string, { marker: MLMarker; el: HTMLDivElement }>>(new Map());
  const [pinEls, setPinEls] = useState<{ id: string; el: HTMLDivElement }[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!ready || !map || !ml) return;
    const store = markersRef.current;
    store.forEach((v, id) => {
      if (!visibleIds.has(id)) {
        v.marker.remove();
        store.delete(id);
      }
    });
    for (const sp of filteredSpots) {
      let m = store.get(sp.id);
      if (!m) {
        const el = document.createElement("div");
        const marker = new ml.Marker({ element: el, anchor: "bottom" }).setLngLat(ll(sp.coordinates)).addTo(map);
        plainMarkerEl(el);
        m = { marker, el };
        store.set(sp.id, m);
      } else {
        m.marker.setLngLat(ll(sp.coordinates));
      }
      m.el.style.zIndex = selectedSpot?.id === sp.id ? "30" : sp.spotType === "PRIMARY_DEST" ? "25" : "20";
    }
    setPinEls(Array.from(store, ([id, v]) => ({ id, el: v.el })));
  }, [ready, filteredSpots, visibleIds, selectedSpot?.id]);
  useEffect(() => {
    const store = markersRef.current;
    return () => {
      store.forEach((v) => v.marker.remove());
      store.clear();
    };
  }, [attempt]);

  // ---- Loka (posisi asli) + kerucut arah ----
  const playerRef = useRef<{ me: MLMarker; cone: MLMarker; meEl: HTMLDivElement; coneEl: HTMLDivElement } | null>(null);
  const [playerEls, setPlayerEls] = useState<{ meEl: HTMLDivElement; coneEl: HTMLDivElement } | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!ready || !map || !ml) return;
    if (!userPosition) {
      if (playerRef.current) {
        playerRef.current.me.remove();
        playerRef.current.cone.remove();
        playerRef.current = null;
        setPlayerEls(null);
      }
      updateEdge();
      return;
    }
    if (!playerRef.current) {
      const meEl = document.createElement("div");
      const coneEl = document.createElement("div");
      meEl.style.zIndex = "40";
      coneEl.style.zIndex = "5";
      coneEl.style.pointerEvents = "none";
      const cone = new ml.Marker({ element: coneEl, anchor: "center" }).setLngLat(ll(userPosition)).addTo(map);
      const me = new ml.Marker({ element: meEl, anchor: "bottom" }).setLngLat(ll(userPosition)).addTo(map);
      plainMarkerEl(meEl);
      plainMarkerEl(coneEl);
      playerRef.current = { me, cone, meEl, coneEl };
      setPlayerEls({ meEl, coneEl });
    } else {
      playerRef.current.me.setLngLat(ll(userPosition));
      playerRef.current.cone.setLngLat(ll(userPosition));
    }
    updateEdge();
  }, [ready, userPosition, updateEdge]);

  // kerucut: arah jalan kalo GPS punya heading, kalo diam mengarah ke tujuan
  const coneDeg =
    typeof userPosition?.heading === "number"
      ? userPosition.heading
      : userPosition && selectedSpot
      ? bearingDegrees(userPosition, selectedSpot.coordinates)
      : 0;

  // ---- rute jalan kaki nyata (OSM), cadangan garis putus kalo layanan gagal ----
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const routeKey = useRef<{ id: string; from: LatLng } | null>(null);
  const routeToken = useRef(0);
  useEffect(() => {
    if (!userPosition || !selectedSpot) {
      routeKey.current = null;
      routeToken.current++;
      setRoute(null);
      return;
    }
    const last = routeKey.current;
    if (last && last.id === selectedSpot.id && distanceMeters(last.from, userPosition) < 40) return;
    routeKey.current = { id: selectedSpot.id, from: { lat: userPosition.lat, lng: userPosition.lng } };
    const token = ++routeToken.current;
    fetchWalkingRoute(userPosition, selectedSpot.coordinates).then((r) => {
      if (token === routeToken.current) setRoute(r);
    });
  }, [userPosition, selectedSpot]);

  // ---- data garis & zona ----
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const set = (id: string, data: object) => (map.getSource(id) as GeoJSONSource | undefined)?.setData(data as never);

    set("zone", primarySpotData ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circlePolygon(primarySpotData.coordinates, ZONE_RADIUS_METERS)] } } : EMPTY);

    const feats = [];
    const ends = [];
    if (routesVisible && primarySpotData) {
      for (const sp of filteredSpots) {
        if (sp.spotType === "PRIMARY_DEST") continue;
        feats.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: curveBetween(primarySpotData.coordinates, sp.coordinates) } });
        ends.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: ll(sp.coordinates) } });
      }
    }
    set("redirect", { type: "FeatureCollection", features: feats });
    set("redirect-end", { type: "FeatureCollection", features: ends });

    if (userPosition && selectedSpot) {
      const geometry = route
        ? { type: "LineString", coordinates: route.coords }
        : { type: "LineString", coordinates: [ll(userPosition), ll(selectedSpot.coordinates)] };
      set("route", { type: "Feature", properties: { kind: route ? "road" : "straight" }, geometry });
    } else {
      set("route", EMPTY);
    }
  }, [ready, primarySpotData, routesVisible, filteredSpots, userPosition, selectedSpot, route]);

  // ---- kamera ----
  const fitAll = useCallback((list: CulturalSpot[], animate: boolean) => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml || list.length === 0) return;
    const b = new ml.LngLatBounds(ll(list[0].coordinates), ll(list[0].coordinates));
    list.forEach((s) => b.extend(ll(s.coordinates)));
    map.fitBounds(b, { padding: cameraPadding(), maxZoom: 17, duration: animate && !prefersReducedMotion() ? 800 : 0 });
  }, []);

  useEffect(() => {
    if (ready) fitAll(latest.current.spots, false);
  }, [ready, activeVibe, fitAll]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedSpot) return;
    const sel = spots.find((x) => x.id === selectedSpot.id);
    if (!sel) return;
    const primary = anchorSpot(spots);
    const crowded = primary ? primary.quota.currentVisitors / primary.quota.maxCapacity >= 0.85 : false;
    if (crowded && sel.spotType === "PRIMARY_DEST") {
      fitAll(spots, true);
      return;
    }
    map.easeTo({
      center: ll(sel.coordinates),
      zoom: Math.max(map.getZoom(), 16),
      padding: cameraPadding(),
      duration: prefersReducedMotion() ? 0 : 600,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedSpot?.id]);

  useEffect(() => {
    updateEdge();
  }, [ready, selectedSpot, userPosition, updateEdge]);

  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (userPosition) {
      map.easeTo({ center: ll(userPosition), zoom: Math.max(map.getZoom(), 17), padding: cameraPadding(), duration: prefersReducedMotion() ? 0 : 600 });
    } else {
      fitAll(spots, true);
    }
  };

  const focusTarget = () => {
    const map = mapRef.current;
    if (!map || !selectedSpot) return;
    map.easeTo({ center: ll(selectedSpot.coordinates), padding: cameraPadding(), duration: prefersReducedMotion() ? 0 : 600 });
  };

  const handleSelect = (spot: CulturalSpot) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
    onSelectSpot(spot);
  };

  return (
    <div
      role="region"
      aria-label={`Peta eksplorasi budaya ${vibeMeta.region}`}
      className="fixed inset-0 w-screen h-screen overflow-hidden select-none"
      style={{ backgroundColor: "var(--map-land)", touchAction: "none" }}
    >
      {/* style inline: css maplibre (.maplibregl-map) maksa position:relative & ngalahin kelas utilitas */}
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />

      {pinEls.map(({ id, el }) => {
        const spot = filteredSpots.find((x) => x.id === id);
        if (!spot) return null;
        return createPortal(
          <SpotPin
            spot={spot}
            hex={hex}
            isSelected={selectedSpot?.id === spot.id}
            isCompleted={checkedInSpotIds.includes(spot.id)}
            isRedirectTarget={routesVisible && spot.spotType !== "PRIMARY_DEST"}
            onSelect={handleSelect}
          />,
          el,
          id
        );
      })}

      {playerEls &&
        createPortal(
          <div className="pointer-events-none flex flex-col items-center">
            <Loka variant="mark" size={52} label="Posisimu" />
            <span className="absolute top-full mt-1 px-2.5 py-0.5 rounded-full bg-basalt text-[11px] font-extrabold text-alabaster shadow-sm">Kamu</span>
          </div>,
          playerEls.meEl
        )}
      {playerEls &&
        createPortal(
          <svg viewBox="0 0 160 160" width="230" height="230" aria-hidden="true" style={{ transform: `rotate(${coneDeg}deg)`, transition: "transform 300ms ease-out" }}>
            <defs>
              <radialGradient id="coneGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1F8A83" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#1F8A83" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path d="M80 80 L40 8 A84 84 0 0 1 120 8 Z" fill="url(#coneGrad)" />
          </svg>,
          playerEls.coneEl
        )}

      {!ready && !mapError && (
        <div role="status" className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="gamiz-card px-4 py-3 flex items-center gap-3">
            <Loka variant="mark" size={36} mood="think" />
            <p className="text-sm font-extrabold text-alabaster">Memuat peta</p>
          </div>
        </div>
      )}
      {mapError && (
        <div role="alert" className="absolute left-3 right-[76px] sm:right-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-80 top-[34%] z-20 gamiz-card p-4 text-center space-y-3">
          <div className="flex justify-center"><Loka variant="mark" size={44} mood="curious" /></div>
          <p className="text-sm font-extrabold text-alabaster">{mapError}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn-tactile-secondary min-h-[44px] px-4 text-xs">
            Coba lagi
          </button>
        </div>
      )}

      {filteredSpots.length === 0 && (
        <div
          role="status"
          className="fixed left-3 right-[76px] sm:right-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-80 top-[34%] z-20 gamiz-card p-4 text-center space-y-3"
        >
          <p className="text-sm font-extrabold text-alabaster">
            Belum ada {SPOT_FILTER_OPTIONS.find((o) => o.id === filterType)?.label ?? "titik"} di kawasan ini.
          </p>
          <p className="text-xs text-pebble">Coba filter lain atau pindah kawasan.</p>
          {onResetFilter && (
            <button type="button" onClick={onResetFilter} className="btn-tactile-secondary min-h-[44px] px-4 text-xs">
              Tampilkan semua titik
            </button>
          )}
        </div>
      )}

      <button
        ref={edgeRef}
        type="button"
        onClick={focusTarget}
        aria-label="Geser peta ke titik tujuan"
        style={{ display: "none" }}
        className="fixed z-20 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-basalt px-3 min-h-[44px] text-[11px] font-extrabold text-alabaster shadow-md border border-stoneStrong"
      >
        <span aria-hidden="true" className="inline-flex text-vibePrimary"><Icon name="up" size={18} weight="bold" /></span>
        <span />
      </button>

      {/* kontrol kamera: zoom cuma di layar lebar, di HP pakai cubit */}
      <div className="fixed right-3 sm:right-5 z-20 flex flex-col gap-2 top-1/2 -translate-y-1/2" style={{ top: "calc(50% - 40px)" }}>
        <div className="andesite-glass rounded-2xl p-1 hidden sm:flex flex-col">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            aria-label="Perbesar peta"
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-alabaster hover:bg-slateElev transition-colors"
          >
            <Icon name="plus" size={20} weight="bold" />
          </button>
          <div className="h-px bg-stoneSubtle mx-2" />
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
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
          onClick={handleRecenter}
          aria-label={userPosition ? "Pusatkan ke lokasi saya" : "Tampilkan semua titik di kawasan"}
          title="Pusatkan peta"
          className="andesite-glass min-h-[48px] min-w-[48px] rounded-2xl flex items-center justify-center hover:bg-slateElev transition-colors"
        >
          <Icon name="pin" size={24} className="text-vibePrimary" motion="pop" />
        </button>
      </div>
    </div>
  );
}
