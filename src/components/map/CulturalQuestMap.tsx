"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GeoJSONSource, Map as MLMap, Marker as MLMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Icon from "@/components/ui/Icon";
import Loka from "@/components/brand/Loka";
import LokaScene from "@/components/brand/LokaScene";
import { RegionCoverBanner } from "@/components/brand/NusantaraOrnaments";
import SpotPin, { CLUSTER_PX, PIN_OFFSET, PinSize, zoomTier } from "@/components/map/SpotPin";
import ClusterPin from "@/components/map/ClusterPin";
import MapControls from "@/components/map/MapControls";
import { CulturalSpot, CulturalVibe } from "@/types/lokawira";
import { VIBE_METADATA } from "@/lib/seedCulturalData";
import { VIBE_HEX } from "@/lib/vibeColors";
import { VIBE_MAP_PALETTE } from "@/lib/spotMeta";
import { ZONE_RADIUS_METERS, LatLng, anchorSpot, bearingDegrees, circlePolygon, lookAheadBearing, curveBetween, distanceMeters, formatDistance, regionOrigin, INDONESIA_BOUNDS } from "@/lib/geo";
import { applyVibeToMap, loadLontarStyle } from "@/lib/mapStyle";
import type { WalkingRoute } from "@/lib/route";
import { matchesSpotFilter, SpotFilter, SPOT_FILTER_OPTIONS } from "@/lib/spotFilter";
import { motionReduced } from "@/lib/motionPref";

interface CulturalQuestMapProps {
  spots: CulturalSpot[];
  selectedSpot: CulturalSpot | null;
  onSelectSpot: (spot: CulturalSpot) => void;
  activeVibe: CulturalVibe;
  // id kawasan aktif: ganti kawasan = kamera ngepasin titik2 kawasan baru (dua kawasan bisa sepalet)
  regionKey?: string;
  // pusat kawasan aktif: dipakai kamera kalo kawasan belum punya titik (mis. kawasan baru diaktifkan)
  regionCenter?: { lat: number; lng: number } | null;
  // "Majapahit, Trowulan, Mojokerto" buat label peta
  regionLabel?: string;
  checkedInSpotIds: string[];
  filterType: SpotFilter;
  onResetFilter?: () => void;
  // Membuka sheet "Butuh apa?"
  onOpenNeeds?: () => void;
  // Membuka panel Rute Jelajah
  onOpenTrail?: () => void;
  trailSpotIds?: string[];
  trailCoords?: [number, number][] | null;
  isLoading?: boolean;
  // server gak terjangkau: tampilkan penanda & izinkan coba lagi
  isOffline?: boolean;
  onRetry?: () => void;
  // Demo: paksa situs utama ke 95% biar jalur pengalihan terlihat tnpa data langsung
  isSurgeDemo?: boolean;
  onToggleSurgeDemo?: () => void;
  // posisi GPS asli pengguna (kalo lagi dipandu). Kosong = penanda 'Kamu' gak tampil
  userPosition?: { lat: number; lng: number; heading?: number | null } | null;
  // lagi dipandu? preview = rute penuh dr posisi ke tujuan, navigating = kamera ngikutin posisi & arah hadap
  guide?: GuideInfo | null;
}

export interface GuideInfo {
  phase: "preview" | "navigating";
  spot: CulturalSpot;
  route: WalkingRoute | null;
}

type MapLibre = typeof import("maplibre-gl");
type Pt = [number, number];
const EMPTY = { type: "FeatureCollection", features: [] } as const;
const ll = (c: LatLng): Pt => [c.lng, c.lat];
// ikut tingkat animasi aplikasi (pengaturan HP atau pilihan di Akun)
const prefersReducedMotion = motionReduced;
const isMobileView = () => typeof window !== "undefined" && window.innerWidth < 640;

// padding kamera: ruang buat HUD atas & kartu bawah, biar titik gak ketutup
// tinggi kartu bawah dibaca dr --sheet-h (diisi halaman), jadi padding ngikutin ukuran kartu asli
const sheetHeight = () => (typeof document === "undefined" ? 0 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sheet-h")) || 0);
const cameraPadding = () => ({ top: 150, bottom: Math.round(92 + (sheetHeight() || (isMobileView() ? 200 : 20)) + 24), left: 24, right: 84 });

// MapLibre nambah role/tabindex ke elemen marker; isinya udah tombol sendiri, jadi dicopot biar gak interaktif bersarang
function plainMarkerEl(el: HTMLElement) {
  el.setAttribute("role", "group");
  el.removeAttribute("tabindex");
  el.removeAttribute("aria-label");
}

export default function CulturalQuestMap({
  spots,
  selectedSpot,
  onSelectSpot,
  activeVibe,
  regionKey = "",
  regionCenter = null,
  regionLabel = "",
  checkedInSpotIds,
  filterType,
  onResetFilter,
  onOpenNeeds,
  onOpenTrail,
  trailSpotIds,
  trailCoords = null,
  isLoading = false,
  isOffline = false,
  onRetry,
  isSurgeDemo = false,
  onToggleSurgeDemo,
  userPosition = null,
  guide = null,
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
  const latest = useRef({ spots, selectedSpot, userPosition, guide, regionCenter, activeVibe });
  latest.current = { spots, selectedSpot, userPosition, guide, regionCenter, activeVibe };

  // ---- chip di tepi layar: muncul kalo tujuan di luar tampilan, nunjuk arahnya + jarak ----
  const edgeRef = useRef<HTMLButtonElement | null>(null);
  const updateEdge = useCallback(() => {
    const el = edgeRef.current;
    const map = mapRef.current;
    const { guide: g, userPosition: me } = latest.current;
    const sel = g?.spot ?? null;
    if (!el) return;
    if (!map || !sel || !me || g?.phase !== "navigating") {
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
        const [ml, style] = await Promise.all([
          import("maplibre-gl").then((m) => ((m as unknown as { default?: MapLibre }).default ?? m) as MapLibre),
          loadLontarStyle(latest.current.activeVibe),
        ]);
        if (cancelled || !hostRef.current) return;
        const origin = regionOrigin(latest.current.spots);
        map = new ml.Map({
          container: hostRef.current,
          style,
          center: origin ? ll(origin.coordinates) : latest.current.regionCenter ? ll(latest.current.regionCenter) : [113.7005, -8.1724],
          zoom: origin ? 16 : 12,
          minZoom: 3,
          maxZoom: 19.5,
          // cuma Indonesia: gak bisa digeser ke luar, dan dunia gak digambar berulang
          maxBounds: INDONESIA_BOUNDS,
          renderWorldCopies: false,
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
          const pal = VIBE_MAP_PALETTE[latest.current.activeVibe] ?? VIBE_MAP_PALETTE.majapahit;
          map.addSource("zone", { type: "geojson", data: EMPTY as never });
          map.addLayer({ id: "zone-fill", type: "fill", source: "zone", paint: { "fill-color": pal.primary, "fill-opacity": 0.08 } }, firstLabel);
          map.addLayer({ id: "zone-line", type: "line", source: "zone", paint: { "line-color": pal.primary, "line-opacity": 0.45, "line-width": 2 } }, firstLabel);
          map.addSource("redirect", { type: "geojson", data: EMPTY as never });
          map.addLayer({ id: "redirect-casing", type: "line", source: "redirect", layout: { "line-cap": "round" }, paint: { "line-color": pal.road, "line-width": 9 } }, firstLabel);
          map.addLayer({ id: "redirect-line", type: "line", source: "redirect", layout: { "line-cap": "round" }, paint: { "line-color": pal.safe, "line-width": 4.5 } }, firstLabel);
          map.addSource("redirect-end", { type: "geojson", data: EMPTY as never });
          map.addLayer({ id: "redirect-end", type: "circle", source: "redirect-end", paint: { "circle-radius": 6, "circle-color": pal.road, "circle-stroke-color": pal.safe, "circle-stroke-width": 3.5 } }, firstLabel);
          map.addSource("trail", { type: "geojson", data: EMPTY as never });
          map.addLayer({ id: "trail-casing", type: "line", source: "trail", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": pal.road, "line-width": 8 } }, firstLabel);
          map.addLayer({ id: "trail-line", type: "line", source: "trail", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": pal.umkm, "line-width": 4, "line-dasharray": [2, 1.5] } }, firstLabel);
          map.addSource("route", { type: "geojson", data: EMPTY as never });
          map.addLayer({ id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": pal.road, "line-width": 10 } }, firstLabel);
          map.addLayer({ id: "route-road", type: "line", source: "route", filter: ["==", ["get", "kind"], "road"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": pal.primary, "line-width": 5 } }, firstLabel);
          map.addLayer({ id: "route-straight", type: "line", source: "route", filter: ["==", ["get", "kind"], "straight"], layout: { "line-cap": "round" }, paint: { "line-color": pal.primary, "line-width": 4, "line-dasharray": [0.5, 2.2] } }, firstLabel);
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

  // ---- ukuran pin & pengelompokan saat peta diperkecil ----
  // dihitung ulang tiap peta berhenti bergerak (bkn tiap frame), jadi ringan walau titiknya banyak
  const [pinSize, setPinSize] = useState<PinSize>("full");
  const [clusters, setClusters] = useState<{ key: string; ids: string[]; center: Pt; hasSelected: boolean }[]>([]);
  const filteredRef = useRef(filteredSpots);
  filteredRef.current = filteredSpots;
  const recluster = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const size = zoomTier(map.getZoom());
    setPinSize(size);
    const r = CLUSTER_PX[size];
    const selId = latest.current.selectedSpot?.id;
    const groups: { ids: string[]; x: number; y: number; pts: Pt[] }[] = [];
    if (r > 0) {
      // titik terpilih & cagar utama duluan biar jadi pusat kelompok. Terpilih ikut digabung:
      // kalo dibiarin besar sendiri, dia nutupin lingkaran kelompok di sebelahnya
      const rank = (sp: CulturalSpot) => (sp.id === selId ? 2 : sp.spotType === "PRIMARY_DEST" ? 1 : 0);
      const order = [...filteredRef.current].sort((a, b) => rank(b) - rank(a));
      for (const sp of order) {
        const pt = map.project(ll(sp.coordinates));
        const g = groups.find((x) => Math.hypot(x.x - pt.x, x.y - pt.y) < r);
        if (g) {
          g.ids.push(sp.id);
          g.pts.push(ll(sp.coordinates));
        } else groups.push({ ids: [sp.id], x: pt.x, y: pt.y, pts: [ll(sp.coordinates)] });
      }
    }
    const next = groups
      .filter((g) => g.ids.length > 1)
      .map((g) => ({
        key: [...g.ids].sort().join("|"),
        ids: g.ids,
        hasSelected: !!selId && g.ids.includes(selId),
        center: [g.pts.reduce((a, p) => a + p[0], 0) / g.pts.length, g.pts.reduce((a, p) => a + p[1], 0) / g.pts.length] as Pt,
      }));
    const sig = (l: { key: string; hasSelected: boolean }[]) => l.map((c) => c.key + (c.hasSelected ? "*" : "")).join(",");
    setClusters((prev) => (sig(prev) === sig(next) ? prev : next));
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const onZoom = () => setPinSize(zoomTier(map.getZoom()));
    map.on("zoom", onZoom);
    map.on("moveend", recluster);
    recluster();
    return () => {
      map.off("zoom", onZoom);
      map.off("moveend", recluster);
    };
  }, [ready, recluster]);
  useEffect(() => {
    if (ready) recluster();
  }, [ready, recluster, filteredSpots, selectedSpot?.id]);

  // anggota kelompok disembunyiin (sekalian keluar dr pembaca layar), pin kecil digeser biar pas di lokasinya
  useEffect(() => {
    const hidden = new Set(clusters.flatMap((c) => c.ids));
    markersRef.current.forEach((v, id) => {
      v.el.style.display = hidden.has(id) ? "none" : "";
      // terpilih di zoom dekat = pin besar (tambatan bawah); di zoom sedang/jauh lingkaran 44 px
      const off = pinSize === "full" ? 0 : id === selectedSpot?.id ? 22 : PIN_OFFSET[pinSize];
      v.marker.setOffset([0, off]);
    });
  }, [clusters, pinSize, selectedSpot?.id, pinEls]);

  const clusterStore = useRef<Map<string, { marker: MLMarker; el: HTMLDivElement }>>(new Map());
  const [clusterEls, setClusterEls] = useState<{ key: string; el: HTMLDivElement }[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!ready || !map || !ml) return;
    const store = clusterStore.current;
    const keep = new Set(clusters.map((c) => c.key));
    store.forEach((v, k) => {
      if (!keep.has(k)) {
        v.marker.remove();
        store.delete(k);
      }
    });
    for (const c of clusters) {
      if (store.has(c.key)) continue;
      const el = document.createElement("div");
      el.style.zIndex = "32";
      const marker = new ml.Marker({ element: el, anchor: "center" }).setLngLat(c.center).addTo(map);
      plainMarkerEl(el);
      store.set(c.key, { marker, el });
    }
    setClusterEls(Array.from(store, ([key, v]) => ({ key, el: v.el })));
  }, [ready, clusters]);
  useEffect(() => {
    const store = clusterStore.current;
    return () => {
      store.forEach((v) => v.marker.remove());
      store.clear();
    };
  }, [attempt]);

  const zoomToCluster = (ids: string[]) => {
    const map = mapRef.current;
    const pts = filteredSpots.filter((sp) => ids.includes(sp.id)).map((sp) => ll(sp.coordinates));
    if (!map || !pts.length) return;
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    const b: [Pt, Pt] = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
    // titik2 yg sama persis: cukup perbesar 3 tingkat
    if (b[0][0] === b[1][0] && b[0][1] === b[1][1]) map.easeTo({ center: b[0], zoom: map.getZoom() + 3, duration: prefersReducedMotion() ? 0 : 600 });
    else map.fitBounds(b, { padding: cameraPadding(), maxZoom: 16, duration: prefersReducedMotion() ? 0 : 700 });
  };

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

  // ---- arah hadap: heading GPS (kalo lagi gerak) > arah rute ~30 m di depan > arah lurus ke tujuan ----
  const route = guide?.route ?? null;
  const facing = useMemo(() => {
    if (!userPosition) return null;
    if (typeof userPosition.heading === "number") return userPosition.heading;
    if (guide && route) {
      const ahead = lookAheadBearing(route.coords, userPosition, 30);
      if (ahead !== null) return ahead;
    }
    return guide ? bearingDegrees(userPosition, guide.spot.coordinates) : null;
  }, [userPosition, guide, route]);
  const [mapBearing, setMapBearing] = useState(0);
  // kerucut digambar relatif ke putaran peta (pas ngikutin arah, peta ikut muter jadi kerucut tetap menghadap atas)
  const coneDeg = (facing ?? 0) - mapBearing;

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

    if (userPosition && guide) {
      const geometry = route
        ? { type: "LineString", coordinates: route.coords }
        : { type: "LineString", coordinates: [ll(userPosition), ll(guide.spot.coordinates)] };
      set("route", { type: "Feature", properties: { kind: route ? "road" : "straight" }, geometry });
    } else {
      set("route", EMPTY);
    }

    if (trailCoords && trailCoords.length >= 2) {
      set("trail", { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: trailCoords } });
    } else {
      set("trail", EMPTY);
    }
  }, [ready, primarySpotData, routesVisible, filteredSpots, userPosition, guide, route, trailCoords]);

  useEffect(() => {
    const map = mapRef.current;
    if (ready && map) applyVibeToMap(map, activeVibe);
  }, [ready, activeVibe]);

  // ---- kamera ----
  const fitAll = useCallback((list: CulturalSpot[], animate: boolean) => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml) return;
    if (list.length === 0) {
      // kawasan tanpa titik: tampilkan wilayahnya, jangan diam di kawasan sebelumnya
      const c = latest.current.regionCenter;
      if (c) map.easeTo({ center: ll(c), zoom: 12, duration: animate && !prefersReducedMotion() ? 800 : 0 });
      return;
    }
    const b = new ml.LngLatBounds(ll(list[0].coordinates), ll(list[0].coordinates));
    list.forEach((s) => b.extend(ll(s.coordinates)));
    map.fitBounds(b, { padding: cameraPadding(), maxZoom: 17, duration: animate && !prefersReducedMotion() ? 800 : 0 });
  }, []);

  useEffect(() => {
    if (ready) fitAll(latest.current.spots, false);
  }, [ready, activeVibe, regionKey, regionCenter?.lat, regionCenter?.lng, fitAll]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedSpot) return;
    if (latest.current.guide) return;
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
  }, [ready, guide, userPosition, updateEdge]);

  // ---- kamera pandu ----
  // preview: zoom out biar rute penuh (posisi -> tujuan) keliatan
  const followRef = useRef(false);
  const [following, setFollowing] = useState(false);
  const phase = guide?.phase ?? null;
  const guideId = guide?.spot.id ?? null;
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!ready || !map || !ml) return;
    if (phase !== "preview" || !guide) return;
    followRef.current = false;
    setFollowing(false);
    const pts: Pt[] = [ll(guide.spot.coordinates)];
    if (userPosition) pts.push(ll(userPosition));
    if (route) route.coords.forEach((c) => pts.push(c));
    const b = new ml.LngLatBounds(pts[0], pts[0]);
    pts.forEach((c) => b.extend(c));
    map.fitBounds(b, { padding: cameraPadding(), maxZoom: 18, bearing: 0, pitch: 0, duration: prefersReducedMotion() ? 0 : 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, phase, guideId, route, !!userPosition]);

  // navigating: kamera ngikutin posisi, peta diputar biar arah hadap ada di atas layar
  const lastBearing = useRef(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (phase !== "navigating") {
      if (lastBearing.current !== 0 || map.getBearing() !== 0) {
        lastBearing.current = 0;
        map.easeTo({ bearing: 0, pitch: 0, duration: prefersReducedMotion() ? 0 : 500 });
      }
      followRef.current = false;
      setFollowing(false);
      return;
    }
    if (!followRef.current) {
      followRef.current = true;
      setFollowing(true);
    }
  }, [ready, phase]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || phase !== "navigating" || !followRef.current || !userPosition) return;
    let bearing = lastBearing.current;
    // arah cuma diputar kalo beda > 8 derajat, biar peta gak goyang tiap fix GPS
    if (facing !== null) {
      const diff = ((facing - bearing + 540) % 360) - 180;
      if (Math.abs(diff) > 8 || lastBearing.current === 0) bearing = facing;
    }
    lastBearing.current = bearing;
    map.easeTo({
      center: ll(userPosition),
      zoom: Math.max(map.getZoom(), 18),
      bearing,
      pitch: 0,
      padding: cameraPadding(),
      duration: prefersReducedMotion() ? 0 : 900,
      easing: (t) => t,
    });
  }, [ready, phase, userPosition, facing, following]);
  // geser manual = lepas dari mode ngikutin (tombol pusatkan menyalakannya lagi)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const onDrag = () => {
      if (followRef.current) {
        followRef.current = false;
        setFollowing(false);
      }
    };
    const onRotate = () => setMapBearing(Math.round(map.getBearing()));
    map.on("dragstart", onDrag);
    map.on("rotate", onRotate);
    return () => {
      map.off("dragstart", onDrag);
      map.off("rotate", onRotate);
    };
  }, [ready]);

  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (phase === "navigating") {
      followRef.current = true;
      setFollowing(true);
    } else if (userPosition) {
      map.easeTo({ center: ll(userPosition), zoom: Math.max(map.getZoom(), 17), padding: cameraPadding(), duration: prefersReducedMotion() ? 0 : 600 });
    } else {
      fitAll(spots, true);
    }
  };

  const focusTarget = () => {
    const map = mapRef.current;
    if (!map || !guide) return;
    followRef.current = false;
    setFollowing(false);
    map.easeTo({ center: ll(guide.spot.coordinates), padding: cameraPadding(), duration: prefersReducedMotion() ? 0 : 600 });
  };

  const handleSelect = (spot: CulturalSpot) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
    onSelectSpot(spot);
  };

  return (
    <div
      role="region"
      aria-label={`Peta eksplorasi budaya ${regionLabel || vibeMeta.region}`}
      className="fixed inset-0 w-screen h-screen overflow-hidden select-none"
      style={{ backgroundColor: "var(--map-land)", touchAction: "none" }}
    >
      {/* style inline: css maplibre (.maplibregl-map) maksa position:relative & ngalahin kelas utilitas */}
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />

      {pinEls.map(({ id, el }) => {
        const spot = filteredSpots.find((x) => x.id === id);
        if (!spot) return null;
        const trailPos = trailSpotIds ? trailSpotIds.indexOf(spot.id) : -1;
        return createPortal(
          <SpotPin
            spot={spot}
            hex={{ ...hex, safe: VIBE_MAP_PALETTE[activeVibe]?.safe }}
            isSelected={selectedSpot?.id === spot.id}
            isCompleted={checkedInSpotIds.includes(spot.id)}
            isRedirectTarget={routesVisible && spot.spotType !== "PRIMARY_DEST"}
            onSelect={handleSelect}
            size={pinSize}
            trailIndex={trailPos >= 0 ? trailPos + 1 : undefined}
          />,
          el,
          id
        );
      })}

      {clusterEls.map(({ key, el }) => {
        const c = clusters.find((x) => x.key === key);
        if (!c) return null;
        const names = c.ids.map((id) => filteredSpots.find((sp) => sp.id === id)?.name.split("&")[0].trim() ?? "").filter(Boolean);
        return createPortal(<ClusterPin count={c.ids.length} names={names} hex={hex} hasSelected={c.hasSelected} onZoom={() => zoomToCluster(c.ids)} />, el, key);
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
                <stop offset="0%" stopColor={hex.umkm} stopOpacity="0.8" />
                <stop offset="100%" stopColor={hex.umkm} stopOpacity="0" />
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

      {ready && !isLoading && !mapError && filteredSpots.length === 0 && (
        <div
          role="status"
          className="fixed left-3 right-[76px] sm:right-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-96 top-[28%] z-20 gamiz-card overflow-hidden p-4 text-center space-y-3"
        >
          <RegionCoverBanner
            vibe={activeVibe}
            compact
            eyebrow="Kawasan Budaya"
            title={regionLabel || vibeMeta.region}
            subtitle={filterType === "ALL" ? "Sedang kurasi bersama warga & penggerak lokal." : `Filter ${SPOT_FILTER_OPTIONS.find((o) => o.id === filterType)?.label ?? "titik"} belum menemukan titik.`}
          />
          <LokaScene scene="empty-map" vibe={activeVibe} size={88} />
          <p className="text-xs text-pebble leading-relaxed">
            {filterType === "ALL"
              ? "Titik-titik cagar dan pelaku usaha sedang disiapkan agar tampil lengkap di peta ini."
              : "Coba filter lain atau pindah ke kawasan lain dari pemilih di atas peta."}
          </p>
          {onResetFilter && filterType !== "ALL" && (
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
        <span aria-hidden="true" className="inline-flex text-vibePrimary"><Icon name="arrowUp" size={18} weight="bold" /></span>
        <span />
      </button>

      <MapControls
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onRecenter={handleRecenter}
        recenterLabel={phase === "navigating" ? "Ikuti posisi dan arah saya" : userPosition ? "Pusatkan ke lokasi saya" : "Tampilkan semua titik di kawasan"}
        isOffline={isOffline}
        onRetry={onRetry}
        onOpenNeeds={onOpenNeeds}
        onOpenTrail={onOpenTrail}
        trailActive={Boolean(trailSpotIds && trailSpotIds.length > 0)}
        isSurgeDemo={isSurgeDemo}
        onToggleSurgeDemo={onToggleSurgeDemo}
      />
    </div>
  );
}
