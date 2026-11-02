"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import Icon from "@/components/ui/Icon";
import { CulturalSpot, CulturalVibe, SurfaceTheme } from "@/types/lokawira";
import { VIBE_METADATA } from "@/lib/seedCulturalData";
import { VIBE_HEX } from "@/lib/vibeColors";
import MapBackdrop from "@/components/map/MapBackdrop";
import { ORIGIN_ON_CANVAS, ZONE_RADIUS_UNITS, Point, anchorSpot, project, regionOrigin } from "@/lib/geo";
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
  // server gak terjangkau: tampilkan penanda & izinnkan coba lagi
  isOffline?: boolean;
  onRetry?: () => void;
  // Demo: paksa situs utama ke 95% biar jalur pengalihan terlihat tnpa data langsung
  isSurgeDemo?: boolean;
  onToggleSurgeDemo?: () => void;
}

// Posisi peemain pd kanvas (simulasi; GPS nyata blm tersedia)
const PLAYER_POSITION = { x: 1120, y: 830 };

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
}: CulturalQuestMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.05);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  const vibeMeta = VIBE_METADATA[activeVibe];

  const filteredSpots = spots.filter((spot) => matchesSpotFilter(spot, filterType));
  const visibleIds = new Set(filteredSpots.map((x) => x.id));

  // posisi pin dihitung dr koordinat nyata relatif ke titik utama kawasan (bkn urutan data)
  const positions = useMemo(() => {
    const m = new Map<string, Point>();
    const origin = regionOrigin(spots);
    if (origin) spots.forEach((sp) => m.set(sp.id, project(sp.coordinates, origin.coordinates)));
    return m;
  }, [spots]);
  const posOf = (sp: CulturalSpot): Point => positions.get(sp.id) ?? ORIGIN_ON_CANVAS;

  // kamera terbang ke titik terpilih
  const autoFitRef = useRef<boolean>(false);
  useEffect(() => {
    if (!selectedSpot) return;
    const sel = spots.find((x) => x.id === selectedSpot.id);
    if (!sel) return;

    const primary = anchorSpot(spots);
    const crowded = primary ? primary.quota.currentVisitors / primary.quota.maxCapacity >= 0.85 : false;

    if (crowded && sel.spotType === "PRIMARY_DEST") {
      const pts = spots.map(posOf);
      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const maxY = Math.max(...pts.map((p) => p.y));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw < 640;
      // Ruang tampil: lebar dikurangi kontrol kanan, tnggi dikurangi HUD atas & kartu bawah
      const availW = Math.max(180, vw - (isMobile ? 130 : 420));
      const availH = Math.max(160, vh * (isMobile ? 0.34 : 0.55));
      const fitW = (availW - 70) / Math.max(1, maxX - minX);
      const fitH = (availH - 120) / Math.max(1, maxY - minY);
      const fit = Math.min(1.05, Math.max(0.42, Math.min(fitW, fitH)));
      autoFitRef.current = true;
      setZoom(Number(fit.toFixed(2)));
      // geser sedikit ke kiri biar isi gak tertutup kolom tombol kamera di kanan
      setPan({ x: (1200 - cx) * fit - (isMobile ? 48 : 0), y: (800 - cy) * fit - (isMobile ? 70 : 0) });
      return;
    }

    if (autoFitRef.current) {
      autoFitRef.current = false;
      setZoom(1.05);
    }
    const targetPos = posOf(sel);
    setPan({ x: (1200 - targetPos.x) * 0.65, y: (780 - targetPos.y) * 0.65 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpot, spots]);

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  const pinchDistance = () => {
    const pts = Array.from(pointersRef.current.values());
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      pinchRef.current = { dist: pinchDistance(), zoom };
      setIsDragging(false);
      return;
    }
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const ratio = pinchDistance() / (pinchRef.current.dist || 1);
      setZoom(Math.max(0.4, Math.min(1.8, Number((pinchRef.current.zoom * ratio).toFixed(2)))));
      return;
    }
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: Math.max(-620, Math.min(620, dragStartRef.current.panX + dx)),
      y: Math.max(-460, Math.min(460, dragStartRef.current.panY + dy)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((z) => Math.max(0.4, Math.min(1.8, Number((z + delta).toFixed(2)))));
  };

  const handleRecenter = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1.05);
  };

  const activeTargetPos = selectedSpot ? posOf(selectedSpot) : ORIGIN_ON_CANVAS;

  // pengalihan antrean: situs utama >= 85% memunculkan jalur ke mitra terdekat
  const primarySpotData = anchorSpot(spots);
  const primaryPos = primarySpotData ? posOf(primarySpotData) : null;
  const redirectActive = primarySpotData
    ? primarySpotData.quota.currentVisitors / primarySpotData.quota.maxCapacity >= 0.85
    : false;
  const redirectTargets = redirectActive
    ? spots
        .map((spot) => ({ spot, pos: posOf(spot) }))
        .filter(({ spot }) => spot.spotType !== "PRIMARY_DEST" && visibleIds.has(spot.id))
    : [];
  const routesVisible = redirectActive && !!primarySpotData && visibleIds.has(primarySpotData.id);

  const hex = VIBE_HEX[activeVibe] ?? VIBE_HEX.majapahit;

  const typeLabel = (t: CulturalSpot["spotType"]) =>
    t === "PRIMARY_DEST"
      ? "Cagar Utama"
      : t === "SANGGAR_SENI"
      ? "Sanggar Seni"
      : t === "UMKM_KULINER"
      ? "Makan & Minum"
      : "Oleh-oleh";

  const handleSelect = (spot: CulturalSpot) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
    onSelectSpot(spot);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      role="region"
      aria-label={`Peta eksplorasi budaya ${vibeMeta.region}`}
      className={`fixed inset-0 w-screen h-screen overflow-hidden select-none ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{ backgroundColor: "var(--map-land)", touchAction: "none" }}
    >
      <div
        className={`w-[2400px] h-[1600px] absolute left-1/2 top-1/2 ${
          isDragging ? "" : "transition-transform duration-500 ease-out"
        }`}
        style={{
          transform: `translate3d(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px), 0) scale(${zoom})`,
        }}
      >
        <svg viewBox="0 0 2400 1600" className="w-full h-full" aria-hidden="true">
          <MapBackdrop />
          <defs>
            <marker id="redirectArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--quota-safe)" stroke="var(--bg-basalt-card)" strokeWidth="1.5" strokeLinejoin="round" />
            </marker>
          </defs>

          {/* Zona 250 m */}
          <circle
            cx={ORIGIN_ON_CANVAS.x}
            cy={ORIGIN_ON_CANVAS.y}
            r={ZONE_RADIUS_UNITS}
            fill="var(--vibe-primary)"
            fillOpacity="0.1"
            stroke="var(--vibe-primary)"
            strokeOpacity="0.4"
            strokeWidth="3"
          />

          {/* rute ke titik terpilih */}
          <path
            d={`M ${PLAYER_POSITION.x} ${PLAYER_POSITION.y} L ${activeTargetPos.x} ${activeTargetPos.y}`}
            fill="none"
            stroke="var(--bg-basalt-card)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d={`M ${PLAYER_POSITION.x} ${PLAYER_POSITION.y} L ${activeTargetPos.x} ${activeTargetPos.y}`}
            fill="none"
            stroke="var(--vibe-primary)"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* jalur pengalihan antrean: satu warna (hijau = bebas antre), melengkung biar gak terbaca sbg jalan, & berujung panah arah tujuan */}
          {primaryPos && routesVisible &&
            redirectTargets.map(({ spot, pos }) => {
              const dx = pos.x - primaryPos.x;
              const dy = pos.y - primaryPos.y;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              // mulai di tepi cincin pin utama, berhenti sblm ujung pin tujaun
              const sx = primaryPos.x + ux * 34;
              const sy = primaryPos.y + uy * 34;
              const ex = pos.x - ux * 46;
              const ey = pos.y - uy * 46 - 18;
              // titik kontrol bergeser tegak lurus: lenggkung ke sisi luar
              const side = dx >= 0 ? 1 : -1;
              const cx = (sx + ex) / 2 - uy * 46 * side;
              const cy = (sy + ey) / 2 + ux * 46 * side;
              const d = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
              return (
                <g key={`redirect-${spot.id}`}>
                  <path d={d} fill="none" stroke="var(--bg-basalt-card)" strokeWidth="14" strokeLinecap="round" />
                  <motion.path
                    d={d}
                    fill="none"
                    stroke="var(--quota-safe)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    markerEnd="url(#redirectArrow)"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ type: "spring", stiffness: 60, damping: 18, delay: 0.15 }}
                  />
                  <circle r="7" fill="var(--bg-basalt-card)" stroke="var(--quota-safe)" strokeWidth="4">
                    <animateMotion dur="2.6s" repeatCount="indefinite" path={d} begin="1s" />
                  </circle>
                </g>
              );
            })}
        </svg>

        {/* Posisi pemain */}
        <div
          style={{
            left: `${PLAYER_POSITION.x}px`,
            top: `${PLAYER_POSITION.y}px`,
            scale: String(1 / zoom),
            transition: "scale 500ms ease-out",
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none flex flex-col items-center"
        >
          <div className="relative flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-[#1F6FB5]/25 animate-ping absolute" />
            <div className="w-7 h-7 rounded-full bg-[#1F6FB5] ring-4 ring-[var(--bg-basalt-card)] shadow-lg" />
          </div>
          <span className="mt-1.5 px-2.5 py-0.5 rounded-full bg-basalt text-[11px] font-extrabold text-alabaster shadow-sm">
            Kamu
          </span>
        </div>

        {/* Marker */}
        {filteredSpots.map((spot) => {
          const pos = posOf(spot);
          const isSelected = selectedSpot?.id === spot.id;
          const isCompleted = checkedInSpotIds.includes(spot.id);
          const quotaRatio = spot.quota.currentVisitors / spot.quota.maxCapacity;
          const isCrowded = quotaRatio >= 0.85;
          const isPrimary = spot.spotType === "PRIMARY_DEST";
          const isSanggar = spot.spotType === "SANGGAR_SENI";
          const isRedirectTarget = routesVisible && !isPrimary;

          const body = isCompleted
            ? "#2B8A4B"
            : isPrimary
            ? hex.primary
            : isSanggar
            ? hex.accent
            : hex.umkm;
          const iconName = isCompleted
            ? "check"
            : isPrimary
            ? "heritage"
            : isSanggar
            ? "sanggar"
            : spot.spotType === "UMKM_KULINER"
            ? "food"
            : "umkm";

          return (
            <div
              key={spot.id}
              // ukuran pin tetap di layar berapa pun zoom-nya (skala balik), biar label slalu terbcaa
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                scale: String(1 / zoom),
                transition: "transform 300ms, scale 500ms ease-out",
              }}
              className={`absolute -translate-x-1/2 -translate-y-full origin-bottom ${
                isSelected ? "z-30 scale-[1.3]" : "z-20 hover:scale-110"
              }`}
            >
              {/* bayangan & gelombang di tanah */}
              <span
                aria-hidden="true"
                className="absolute left-1/2 -translate-x-1/2 bottom-[-6px] w-9 h-3 rounded-[50%] bg-[#4A341C]/30 blur-[2px]"
              />
              {isSelected && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 bottom-[-12px] w-14 h-6 rounded-[50%] border-2 animate-ground-pulse"
                  style={{ borderColor: body }}
                />
              )}

              <button
                type="button"
                onClick={() => handleSelect(spot)}
                aria-label={`Pilih titik ${spot.name}, ${typeLabel(spot.spotType)}`}
                aria-pressed={isSelected}
                className="relative block w-[56px] h-[68px] before:absolute before:-inset-3 before:content-['']"
              >
                <span className={isSelected ? "animate-pin-bob block" : "block"}>
                  <svg viewBox="0 0 64 76" className="w-[56px] h-[68px] drop-shadow-[0_6px_6px_rgba(74,52,28,0.3)]" aria-hidden="true">
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
                    <path
                      d="M12 24 A20 20 0 0 1 32 7 A20 20 0 0 1 52 24 C44 16 20 16 12 24 Z"
                      fill="#FFF8EC"
                      fillOpacity="0.28"
                    />
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
                  {isPrimary
                    ? isCrowded
                      ? `Padat ${Math.round(quotaRatio * 100)}%`
                      : `Lengang ${Math.round(quotaRatio * 100)}%`
                    : `+${spot.quest.rewardPoints} XP`}
                </span>
              )}

              <span
                className={`absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold max-w-[150px] truncate shadow-sm ${
                  isSelected
                    ? "bg-vibePrimary text-[var(--vibe-on-primary)]"
                    : "bg-basalt text-alabaster"
                }`}
              >
                {spot.name.split("&")[0].trim()}
              </span>
            </div>
          );
        })}
      </div>

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
            <button
              type="button"
              onClick={onResetFilter}
              className="btn-tactile-secondary min-h-[44px] px-4 text-xs"
            >
              Tampilkan semua titik
            </button>
          )}
        </div>
      )}

      {/* kontrol kaera: zoom cuma di layar lebar, di HP pakai cubit */}
      <div
        className="fixed right-3 sm:right-5 z-20 flex flex-col gap-2 top-1/2 -translate-y-1/2"
        style={{ top: "calc(50% - 40px)" }}
      >
        <div className="andesite-glass rounded-2xl p-1 hidden sm:flex flex-col">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
            aria-label="Perbesar peta"
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-alabaster hover:bg-slateElev transition-colors"
          >
            <Icon name="plus" size={20} weight="bold" />
          </button>
          <div className="h-px bg-stoneSubtle mx-2" />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
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
              isSurgeDemo
                ? "bg-quotaFull text-[var(--vibe-on-primary)]"
                : "andesite-glass text-alabaster hover:bg-slateElev"
            }`}
          >
            <Icon name="users" size={20} motion="pop" />
            <span>Demo</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleRecenter}
          aria-label="Pusatkan ke lokasi saya"
          title="Pusatkan peta"
          className="andesite-glass min-h-[48px] min-w-[48px] rounded-2xl flex items-center justify-center hover:bg-slateElev transition-colors"
        >
          <Icon name="pin" size={24} className="text-vibePrimary" motion="pop" />
        </button>
      </div>
    </div>
  );
}
