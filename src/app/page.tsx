"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchesSpotFilter, SpotFilter } from "@/lib/spotFilter";
import { api, ApiError, DEMO_MODE, describeError } from "@/lib/api";
import { LocationError, useLocation } from "@/components/layout/LocationProvider";
import { useWalkingRoute } from "@/lib/useWalkingRoute";
import { fetchMultiStopRoute, type TravelMode, type WalkingRoute } from "@/lib/route";
import { anchorSpot, distanceMeters, formatDistance, orderTrailStops, regionOrigin } from "@/lib/geo";
import { useLokawira } from "@/components/layout/LokawiraProvider";
import { isExpired } from "@/lib/formatTime";
import { levelProgress } from "@/lib/progress";
import AgendaSheet from "@/components/agenda/AgendaSheet";
import { trackOnce } from "@/lib/track";
import VibeSwitcherBar from "@/components/layout/VibeSwitcherBar";
import BottomNavConsole from "@/components/layout/BottomNavConsole";
import StoryTellerDock from "@/components/ai/StoryTellerDock";
import CulturalQuestMap from "@/components/map/CulturalQuestMap";
import CulturalTrailSheet from "@/components/map/CulturalTrailSheet";
import SpotCard from "@/components/map/SpotCard";
import StatusBanner from "@/components/layout/StatusBanner";
import ObjectLensScanner from "@/components/ai/ObjectLensScanner";
import SmartQuotaModal from "@/components/quota/SmartQuotaModal";
import SpotInfoSheet from "@/components/map/SpotInfoSheet";
import VoucherWalletSheet from "@/components/economy/VoucherWalletSheet";
import QuotaBoardSheet from "@/components/quota/QuotaBoardSheet";
import NeedsSearchSheet from "@/components/quota/NeedsSearchSheet";
import AccountSheet from "@/components/layout/AccountSheet";
import RegionInkTransition from "@/components/layout/RegionInkTransition";
import {
  CulturalSpot,
  IssuedVoucher,
  LensVerificationResult,
  ReservationPass,
  UnlockedLoreCard,
  EventOccurrence,
} from "@/types/lokawira";
import { useReducedMotionConfig } from "@/lib/motionPref";

export default function LokawiraExplorerPage() {
  const reducedMotion = useReducedMotionConfig();
  const {
    activeVibe,
    regions,
    activeRegion,
    activeRegionId,
    setActiveRegionId,
    lokaPoints,
    addLokaPoints,
    publicSpots: spots,
    setSpots,
    dataStatus,
    refreshServerData,
    vouchers,
    setVouchers,
    reservations,
    setReservations,
    loreCards,
    setLoreCards,
    checkedInSpotIds,
    markSpotCheckedIn,
    syncProfile,
  } = useLokawira();
  const { position: userPosition, getFix, startWatching, stopWatching } = useLocation();

  // ---- pandu: off -> preview (rute penuh) -> navigating (kamera ngikutin) ----
  const [guidePhase, setGuidePhase] = useState<"off" | "preview" | "navigating">("off");
  const [guideSpot, setGuideSpot] = useState<CulturalSpot | null>(null);
  const [guideMode, setGuideMode] = useState<TravelMode>("foot");
  const guideModeManualRef = useRef(false);
  const { route: guideRoute, loading: guideRouteLoading } = useWalkingRoute(
    guidePhase !== "off" ? userPosition : null,
    guidePhase !== "off" ? guideSpot : null,
    guideMode
  );
  // ---- rute jelajah multi-titik ----
  const [isTrailOpen, setIsTrailOpen] = useState(false);
  const [trailActive, setTrailActive] = useState(false);
  const [trailMode, setTrailMode] = useState<TravelMode>("foot");
  const [trailRoute, setTrailRoute] = useState<WalkingRoute | null>(null);
  const [trailLoading, setTrailLoading] = useState(false);
  // radius check-in dr server (kosong = server gak mewajibkan jarak)
  const [checkInRadius, setCheckInRadius] = useState<number | null>(null);
  useEffect(() => {
    api.health().then((h) => setCheckInRadius(h.checkInRadiusMeters ?? null)).catch(() => undefined);
  }, []);

  const regionalSpots = useMemo(
    // titik kawasan aktif (dr regionId, bkn palet: dua kawasan boleh sepalet)
    () => spots.filter((s) => s.regionId === activeRegionId),
    [spots, activeRegionId]
  );

  const orderedTrailSpots = useMemo(() => {
    if (regionalSpots.length < 2) return regionalSpots;
    const origin = userPosition ?? regionOrigin(regionalSpots)?.coordinates;
    if (!origin) return regionalSpots.slice(0, 8);
    return orderTrailStops(origin, regionalSpots).slice(0, 8);
  }, [regionalSpots, userPosition]);

  useEffect(() => {
    setTrailActive(false);
    setTrailRoute(null);
  }, [activeRegionId]);

  useEffect(() => {
    if (!trailActive || orderedTrailSpots.length < 2) {
      setTrailRoute(null);
      setTrailLoading(false);
      return;
    }
    let cancelled = false;
    setTrailLoading(true);
    const waypoints = [...(userPosition ? [userPosition] : []), ...orderedTrailSpots.map((s) => s.coordinates)];
    fetchMultiStopRoute(waypoints, trailMode).then((r) => {
      if (cancelled) return;
      setTrailRoute(r);
      setTrailLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [trailActive, trailMode, orderedTrailSpots, userPosition]);

  const [selectedSpot, setSelectedSpot] = useState<CulturalSpot | null>(
    regionalSpots[0] || spots[0] || null
  );
  const [filterType, setFilterType] = useState<SpotFilter>("ALL");
  const [isStoryExpanded, setIsStoryExpanded] = useState<boolean>(false);
  const [isSheetCompact, setIsSheetCompact] = useState<boolean>(false);
  const [isSpotCardVisible, setIsSpotCardVisible] = useState<boolean>(true);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState<boolean>(false);
  const [isWalletOpen, setIsWalletOpen] = useState<boolean>(false);
  const [isBoardOpen, setIsBoardOpen] = useState<boolean>(false);
  // agenda acara budaya kawasan aktif (null = lagi dimuat)
  const [isAgendaOpen, setIsAgendaOpen] = useState<boolean>(false);
  const [agenda, setAgenda] = useState<EventOccurrence[] | null>(null);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [isNeedsOpen, setIsNeedsOpen] = useState<boolean>(false);
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  // panel info titik (jam buka, alamat, fasilitas) buat titik yg gak pake tiket
  const [showSpotInfo, setShowSpotInfo] = useState<boolean>(false);
  useEffect(() => setShowSpotInfo(false), [selectedSpot?.id]);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [bannerIsError, setBannerIsError] = useState<boolean>(false);
  const [levelUpBadge, setLevelUpBadge] = useState<number | null>(null);
  // kode kehadiran per titik, dr server - Ditunjukkan ke pemilik lapak utk hadiah misi
  const [checkInCodes, setCheckInCodes] = useState<Record<string, string>>({});
  // tinggi kartu bawah dibagi lewat --sheet-h biar tombol peta & kamera gak ketutup kartu
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    if (!cardEl) {
      root.style.setProperty("--sheet-h", "0px");
      return;
    }
    const apply = () => root.style.setProperty("--sheet-h", `${Math.round(cardEl.getBoundingClientRect().height)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(cardEl);
    return () => {
      ro.disconnect();
      root.style.setProperty("--sheet-h", "0px");
    };
  }, [cardEl]);

  const notify = (text: string, isError = false, newLevel: number | null = null) => {
    setBannerIsError(isError);
    setLevelUpBadge(newLevel);
    setStatusBanner(text);
  };

  const levelAfterAward = (awarded: number): number | null => {
    if (awarded <= 0) return null;
    const prev = levelProgress(lokaPoints).level;
    const next = levelProgress(lokaPoints + awarded).level;
    return next > prev ? next : null;
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) {
      setIsSheetCompact(true);
    }
  }, []);

  // banner status hilang sendiri biar gak menutupi pin & kartu di bawahnya
  useEffect(() => {
    if (!statusBanner) return;
    const t = setTimeout(() => setStatusBanner(null), 7000);
    return () => clearTimeout(t);
  }, [statusBanner]);

  // ganti kawasan: pilih titik pertama kawasan itu & reset filter biar peta gak kosong
  useEffect(() => {
    const firstInRegion =
      spots.find((s) => s.regionId === activeRegionId) || spots[0] || null;
    setSelectedSpot(firstInRegion);
    setIsSpotCardVisible(true);
    setFilterType("ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRegionId]);

  // Data titik berubah (kuota, demo): segarkan salinan titik teriplih, jgn ganti pilihan user.
  // Kalo belum ada yg dipilih (data baru datang dr server), pilih titik pertama kawasan biar kartu langsung muncul
  useEffect(() => {
    setSelectedSpot((prev) => (prev ? spots.find((s) => s.id === prev.id) ?? prev : prev));
  }, [spots]);
  useEffect(() => {
    if (selectedSpot) return;
    const first = spots.find((s) => s.regionId === activeRegionId) ?? spots[0];
    if (first) {
      setSelectedSpot(first);
      setIsSpotCardVisible(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots]);

  // filter beerubah: titik terpilih yg tersaring hrs pindah ke titik yg tampil, atw kartunya disembunyikan kalo gak ada satu pun yg cocok
  useEffect(() => {
    const visible = spots.filter((s) => s.regionId === activeRegionId && matchesSpotFilter(s, filterType));
    setSelectedSpot((prev) => {
      if (prev && matchesSpotFilter(prev, filterType)) return prev;
      return visible[0] ?? prev;
    });
    if (visible.length === 0) setIsSpotCardVisible(false);
    else setIsSpotCardVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  // agenda kawasan: dimuat tiap ganti kawasan
  const loadAgenda = useCallback(() => {
    if (!activeRegionId) return;
    setAgendaError(null);
    api
      .listEvents({ regionId: activeRegionId, days: 30 })
      .then((r) => setAgenda(r.occurrences ?? []))
      .catch((e) => {
        setAgenda([]);
        setAgendaError(describeError(e, "Agenda belum bisa dimuat."));
      });
  }, [activeRegionId]);
  useEffect(() => {
    setAgenda(null);
    loadAgenda();
  }, [loadAgenda]);
  const nextEvent = selectedSpot ? agenda?.find((o) => o.spotId === selectedSpot.id && new Date(o.endsAt) > new Date()) : undefined;
  const todayEventCount = useMemo(() => {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
    return (agenda ?? []).filter((o) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(o.startsAt)) === day).length;
  }, [agenda]);

  // tautan dr poster QR (?titik=id): buka titik itu & pindah ke kawasannya, sekali aja
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (deepLinkDone.current || spots.length === 0) return;
    const id = new URLSearchParams(window.location.search).get("titik");
    if (!id) {
      deepLinkDone.current = true;
      return;
    }
    const target = spots.find((x) => x.id === id);
    if (!target) return;
    deepLinkDone.current = true;
    trackOnce("QR_OPEN", target.id);
    if (target.regionId && target.regionId !== activeRegionId) setActiveRegionId(target.regionId);
    // tunggu efek ganti kawasan selesai milih titik pertama, baru timpa dgn titik tujuan
    setTimeout(() => {
      setFilterType("ALL");
      setSelectedSpot(target);
      setIsSpotCardVisible(true);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots]);

  const nearbyUmkmSpots = useMemo(
    () =>
      regionalSpots.filter(
        (s) =>
          s.spotType === "SANGGAR_SENI" ||
          s.spotType === "UMKM_KULINER" ||
          s.spotType === "UMKM_KRIYA"
      ),
    [regionalSpots]
  );

  const primarySpot = useMemo(
    () =>
      anchorSpot(regionalSpots) ||
      regionalSpots[0] ||
      null,
    [regionalSpots]
  );

  const isPrimaryCrowded = primarySpot
    ? primarySpot.quota.currentVisitors / primarySpot.quota.maxCapacity >= 0.85
    : false;

  const isSurgeDemo = primarySpot
    ? primarySpot.quota.currentVisitors / primarySpot.quota.maxCapacity >= 0.9
    : false;
  const handleToggleSurgeDemo = () => {
    if (!primarySpot) return;
    const target = isSurgeDemo
      ? Math.floor(primarySpot.quota.maxCapacity * 0.45)
      : Math.floor(primarySpot.quota.maxCapacity * 0.95);
    const ratio = target / primarySpot.quota.maxCapacity;
    setSpots((prev) =>
      prev.map((s) =>
        s.id === primarySpot.id
          ? {
              ...s,
              quota: {
                ...s.quota,
                currentVisitors: target,
                estimatedWaitMinutes: ratio >= 0.85 ? 35 : ratio >= 0.6 ? 15 : 0,
              },
            }
          : s
      )
    );
    notify(
      isSurgeDemo
        ? "Mode demo: antrean situs utama kembali lengang."
        : "Mode demo: situs utama padat. Jalur pengalihan ke mitra sekitar menyala."
    );
  };

  const activeVouchers = useMemo(
    () => vouchers.filter((v) => v.status === "ACTIVE" && !isExpired(v.expiresAt)),
    [vouchers]
  );

  const handleScanVerified = (
    result: LensVerificationResult,
    newLoreCard: UnlockedLoreCard,
    newVoucher?: IssuedVoucher
  ) => {
    const leveledUpTo = levelAfterAward(result.awardedPoints);
    addLokaPoints(result.awardedPoints);
    setLoreCards((prev) => (prev.some((c) => c.spotId === newLoreCard.spotId && c.objectName === newLoreCard.objectName) ? prev : [newLoreCard, ...prev]));
    if (newVoucher) {
      setVouchers((prev) => [newVoucher, ...prev]);
    }
    notify(
      newVoucher
        ? `Kisah "${result.detectedObjectName}" terbuka! +${result.awardedPoints} XP dan voucer ${newVoucher.code} masuk ke Tas.`
        : result.rewardNote === "LOGIN_FOR_REWARD"
        ? `Kisah "${result.detectedObjectName}" terbuka! Masuk atau daftar untuk mendapat XP dan voucer belanja.`
        : `Kisah "${result.detectedObjectName}" terbuka. Hadiah di titik ini sudah kamu ambil hari ini.`,
      false,
      leveledUpTo
    );
    // user login: samakan dgn catatan server (XP gak boleh cuma percaya hitungan klien)
    syncProfile();
  };

  const handleReservationCreated = (
    reservation: ReservationPass,
    bonusVoucher?: IssuedVoucher,
    awardedPoints = 0
  ) => {
    setReservations((prev) => [reservation, ...prev]);
    if (bonusVoucher) {
      setVouchers((prev) => [bonusVoucher, ...prev]);
    }
    const leveledUpTo = levelAfterAward(awardedPoints);
    addLokaPoints(awardedPoints);
    notify(
      `E-Ticket ${reservation.ticketId} (${reservation.scheduledSlot}) aktif!${awardedPoints > 0 ? ` +${awardedPoints} XP.` : ""}`,
      false,
      leveledUpTo
    );
    syncProfile();
  };

  const handleCheckInQuest = async (spot: CulturalSpot): Promise<boolean> => {
    try {
      let res;
      try {
        // coba dulu tanpa lokasi (geofence server bisa mati, mis pas demo). Kalo dipanggil pas lg dipandu, koordinat segar ikut dikirim
        const fresh = userPosition && Date.now() - userPosition.at < 20000 ? userPosition : null;
        res = await api.checkIn({
          spotId: spot.id,
          ...(fresh ? { lat: fresh.lat, lng: fresh.lng, accuracyMeters: fresh.accuracy } : {}),
        });
      } catch (err) {
        if (!(err instanceof ApiError) || err.code !== "LOCATION_REQUIRED") throw err;
        // server minta bukti lokasi: baca sekali (minta persetujuan kalo belum), lalu ulangi
        const fix = await getFix();
        res = await api.checkIn({ spotId: spot.id, lat: fix.lat, lng: fix.lng, accuracyMeters: fix.accuracy });
      }
      // XP & kode kehadiran ditentukan server, bkn klien
      const leveledUpTo = levelAfterAward(res.awardedPoints);
      markSpotCheckedIn(spot.id);
      addLokaPoints(res.awardedPoints);
      setCheckInCodes((prev) => ({ ...prev, [spot.id]: res.checkIn.code }));
      notify(
        res.awardedPoints > 0
          ? `Check-in di ${spot.name} berhasil. +${res.awardedPoints} XP. Tunjukkan kode kehadiranmu ke pemilik lapak.`
          : `Check-in di ${spot.name} berhasil. Masuk atau daftar agar XP dan hadiah misimu tercatat.`,
        false,
        leveledUpTo
      );
      syncProfile();
      return true;
    } catch (err) {
      if (err instanceof LocationError) {
        notify(
          err.reason === "declined"
            ? "Check-in di titik ini butuh lokasimu untuk memastikan kamu sudah tiba. Izinkan lokasi lalu coba lagi."
            : err.message,
          true
        );
      } else if (err instanceof ApiError && err.code === "OUT_OF_RANGE") {
        const d = Number(err.details?.distanceMeters);
        const r = Number(err.details?.radiusMeters) || 100;
        notify(
          Number.isFinite(d)
            ? `Kamu sekitar ${formatDistance(d)} dari ${spot.name}. Dekati sampai kurang dari ${r} m, lalu check-in lagi. Tekan Pandu aku untuk diarahkan.`
            : `Kamu belum cukup dekat dengan ${spot.name}.`,
          true
        );
      } else if (err instanceof ApiError && err.code === "LOCATION_TOO_INACCURATE") {
        notify("Sinyal GPS kurang tepat. Pindah ke area terbuka lalu coba lagi.", true);
      } else if (err instanceof ApiError && err.code === "ALREADY_CHECKED_IN_TODAY") {
        markSpotCheckedIn(spot.id);
        notify(`Kamu sudah check-in di ${spot.name} hari ini.`, true);
      } else if (err instanceof ApiError && err.code === "IMPOSSIBLE_TRAVEL") {
        notify("Perpindahanmu dari check-in sebelumnya terlalu cepat untuk dicatat. Coba lagi sebentar lagi.", true);
      } else if (err instanceof ApiError && err.isOffline && DEMO_MODE) {
        markSpotCheckedIn(spot.id);
        addLokaPoints(50);
        notify(`Check-in di ${spot.name} dicatat di perangkat ini saja (mode demo, server tidak terjangkau).`);
      } else {
        notify(describeError(err, "Check-in gagal. Coba lagi."), true);
      }
      return false;
    }
  };

  type NavSection = "MAP" | "STORY" | "AGENDA" | "WALLET";
  // tab aktif diturunkan dr apa yg lg terbuka, jd otomatis kembali ke Peta begitu Tas, Agenda, atw Kisah dtiutup
  const activeNav: NavSection = isWalletOpen
    ? "WALLET"
    : isAgendaOpen
    ? "AGENDA"
    : isStoryExpanded
    ? "STORY"
    : "MAP";

  const handleBottomSectionSelect = (section: NavSection) => {
    if (section === "MAP") {
      setIsStoryExpanded(false);
      setIsBoardOpen(false);
      setIsAgendaOpen(false);
      setIsWalletOpen(false);
      setIsSpotCardVisible(true);
    } else if (section === "STORY") {
      // Kisah = cerita titik yg dipilih. Kawasan tanpa titik: kasih tau, jangan diam
      if (!selectedSpot) {
        notify("Pilih satu titik di peta dulu untuk membuka kisahnya bersama Loka.");
        return;
      }
      setIsStoryExpanded((prev) => !prev);
    } else if (section === "AGENDA") {
      setIsAgendaOpen(true);
      if (agendaError) loadAgenda();
    } else if (section === "WALLET") {
      setIsWalletOpen(true);
    }
  };

  const activeQuotaRatio = selectedSpot
    ? selectedSpot.quota.currentVisitors / selectedSpot.quota.maxCapacity
    : 0;
  const isSelectedCrowded = activeQuotaRatio >= 0.85;
  const startGuide = async (spot: CulturalSpot) => {
    trackOnce("GUIDE_START", spot.id);
    guideModeManualRef.current = false;
    setGuideMode(userPosition && distanceMeters(userPosition, spot.coordinates) > 1500 ? "motorcycle" : "foot");
    setGuideSpot(spot);
    const ok = await startWatching();
    if (!ok) {
      setGuideSpot(null);
      notify("Pandu butuh lokasimu. Izinkan lokasi lalu tekan Pandu aku lagi.", true);
      return;
    }
    setIsSheetCompact(false);
    setGuidePhase("preview");
  };
  useEffect(() => {
    if (guidePhase === "off" || !guideSpot || !userPosition || guideModeManualRef.current) return;
    setGuideMode(distanceMeters(userPosition, guideSpot.coordinates) > 1500 ? "motorcycle" : "foot");
  }, [guidePhase, guideSpot, userPosition]);
  const stopGuide = () => {
    setGuidePhase("off");
    setGuideSpot(null);
    stopWatching();
  };
  // pindah ke titik lain = pandu sebelumnya berhenti
  useEffect(() => {
    if (guidePhase !== "off" && selectedSpot && guideSpot && selectedSpot.id !== guideSpot.id) {
      setGuidePhase("off");
      setGuideSpot(null);
      stopWatching();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpot?.id]);

  const isAlreadyCheckedIn = selectedSpot
    ? checkedInSpotIds.includes(selectedSpot.id)
    : false;

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none">
      {/* 1 - FULL-SCREEN INTERACTIVE WORLD MAP CANVAS */}
      <CulturalQuestMap
        spots={regionalSpots}
        selectedSpot={selectedSpot}
        onSelectSpot={(spot) => {
          setSelectedSpot(spot);
          setIsSpotCardVisible(true);
        }}
        activeVibe={activeVibe}
        regionKey={activeRegionId}
        regionCenter={activeRegion?.center ?? null}
        regionLabel={activeRegion ? `${activeRegion.name}, ${activeRegion.label}` : ""}
        checkedInSpotIds={checkedInSpotIds}
        filterType={filterType}
        onResetFilter={() => setFilterType("ALL")}
        onOpenNeeds={() => setIsNeedsOpen(true)}
        onOpenTrail={regionalSpots.length >= 2 ? () => setIsTrailOpen(true) : undefined}
        trailSpotIds={trailActive ? orderedTrailSpots.map((s) => s.id) : undefined}
        trailCoords={
          trailActive
            ? trailRoute?.coords ?? orderedTrailSpots.map((s) => [s.coordinates.lng, s.coordinates.lat] as [number, number])
            : null
        }
        isLoading={dataStatus === "loading"}
        isOffline={dataStatus === "offline"}
        onRetry={() => refreshServerData()}
        isSurgeDemo={isSurgeDemo}
        onToggleSurgeDemo={DEMO_MODE ? handleToggleSurgeDemo : undefined}
        userPosition={userPosition}
        guide={guidePhase !== "off" && guideSpot ? { phase: guidePhase, spot: guideSpot, route: guideRoute } : null}
      />

      {/* 2 - TOP FLOATING GAMIFICATION HUD & FILTER CHIPS */}
      <VibeSwitcherBar
        regions={regions.filter((r) => r.status === "ACTIVE")}
        activeRegionId={activeRegionId}
        onChangeRegion={setActiveRegionId}
        lokaPoints={lokaPoints}
        onOpenAccount={() => setIsAccountOpen(true)}
        filterType={filterType}
        onChangeFilter={setFilterType}
      />

      {/* 3 - FLOATING COLLAPSIBLE LOKA AI STORYTELLER */}
      <StoryTellerDock
        selectedSpot={selectedSpot}
        isExpanded={isStoryExpanded}
        onToggleExpand={() => setIsStoryExpanded((prev) => !prev)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onSelectNearbyUmkm={() => {
          if (nearbyUmkmSpots[0]) {
            setSelectedSpot(nearbyUmkmSpots[0]);
            setIsSpotCardVisible(true);
          }
        }}
      />

      <StatusBanner
        message={statusBanner}
        isError={bannerIsError}
        levelUp={levelUpBadge}
        onClose={() => {
          setStatusBanner(null);
          setLevelUpBadge(null);
        }}
      />

      {selectedSpot && (
        <SpotCard
          visible={isSpotCardVisible && !isStoryExpanded}
          selectedSpot={selectedSpot}
          reducedMotion={reducedMotion}
          isCompact={isSheetCompact}
          isAlreadyCheckedIn={isAlreadyCheckedIn}
          checkInCode={checkInCodes[selectedSpot.id]}
          nextEvent={nextEvent ?? null}
          guidePhase={guidePhase}
          guideSpot={guideSpot}
          guideRoute={guideRoute}
          guideRouteLoading={guideRouteLoading}
          guideMode={guideMode}
          onChangeGuideMode={(m) => {
            guideModeManualRef.current = true;
            setGuideMode(m);
          }}
          checkInRadius={checkInRadius}
          setCardEl={setCardEl}
          onToggleCompact={() => setIsSheetCompact((v) => !v)}
          onHide={() => setIsSpotCardVisible(false)}
          onStartGuide={startGuide}
          onStartNavigating={() => setGuidePhase("navigating")}
          onStopGuide={stopGuide}
          onCheckIn={handleCheckInQuest}
          onOpenScanner={() => setIsScannerOpen(true)}
          onOpenInfo={() => setShowSpotInfo(true)}
          onOpenQuota={() => setIsQuotaModalOpen(true)}
          onOpenBoard={() => setIsBoardOpen(true)}
          onOpenAgenda={() => setIsAgendaOpen(true)}
        />
      )}

      {/* 5 - MODALS & SHEETS */}
      <ObjectLensScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        activeSpot={selectedSpot}
        onScanVerified={handleScanVerified}
      />

      <SpotInfoSheet
        spot={selectedSpot}
        isOpen={showSpotInfo && !!selectedSpot}
        onClose={() => setShowSpotInfo(false)}
        nextEvent={nextEvent}
        onGuide={(spot) => {
          setShowSpotInfo(false);
          startGuide(spot);
        }}
        onTicket={() => {
          setShowSpotInfo(false);
          setIsQuotaModalOpen(true);
        }}
        onAgenda={() => {
          setShowSpotInfo(false);
          setIsAgendaOpen(true);
        }}
      />

      <SmartQuotaModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
        spot={selectedSpot || primarySpot}
        nearbyUmkmSpots={nearbyUmkmSpots}
        onReservationCreated={handleReservationCreated}
        onSelectSpotOnMap={(spot) => {
          setSelectedSpot(spot);
          setIsSpotCardVisible(true);
        }}
      />

      <VoucherWalletSheet
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        activeVibe={activeVibe}
        lokaPoints={lokaPoints}
        vouchers={vouchers}
        reservations={reservations}
        loreCards={loreCards}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenBoard={() => setIsBoardOpen(true)}
      />

      <AccountSheet isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />

      <NeedsSearchSheet
        isOpen={isNeedsOpen}
        onClose={() => setIsNeedsOpen(false)}
        vibe={activeVibe}
        spots={regionalSpots}
        userPosition={userPosition}
        onShowOnMap={(spot) => {
          // titik pilihan hrs terrlihat: kalo filter menyembunyikannya, kembali ke "smua"
          if (!matchesSpotFilter(spot, filterType)) setFilterType("ALL");
          setSelectedSpot(spot);
          setIsSpotCardVisible(true);
          setIsStoryExpanded(false);
          setIsNeedsOpen(false);
        }}
      />

      <RegionInkTransition activeVibe={activeVibe} />

      <AgendaSheet
        isOpen={isAgendaOpen}
        onClose={() => setIsAgendaOpen(false)}
        vibe={activeVibe}
        regionName={activeRegion ? `${activeRegion.name}, ${activeRegion.label}` : "kawasan ini"}
        occurrences={agenda}
        error={agendaError}
        onRetry={loadAgenda}
        spots={regionalSpots}
        onShowOnMap={(spot) => {
          if (!matchesSpotFilter(spot, filterType)) setFilterType("ALL");
          setSelectedSpot(spot);
          setIsSpotCardVisible(true);
          setIsAgendaOpen(false);
        }}
      />

      <QuotaBoardSheet
        isOpen={isBoardOpen}
        onClose={() => setIsBoardOpen(false)}
        vibe={activeVibe}
        spots={regionalSpots}
        onBook={(spot) => {
          setSelectedSpot(spot);
          setIsBoardOpen(false);
          setIsQuotaModalOpen(true);
        }}
        onShowOnMap={(spot) => {
          if (!matchesSpotFilter(spot, filterType)) setFilterType("ALL");
          setSelectedSpot(spot);
          setIsSpotCardVisible(true);
          setIsBoardOpen(false);
        }}
      />

      <CulturalTrailSheet
        isOpen={isTrailOpen}
        onClose={() => setIsTrailOpen(false)}
        regionName={activeRegion ? `${activeRegion.name}, ${activeRegion.label}` : "kawasan ini"}
        vibe={activeVibe}
        orderedSpots={orderedTrailSpots}
        checkedInSpotIds={checkedInSpotIds}
        mode={trailMode}
        onChangeMode={setTrailMode}
        trailActive={trailActive}
        trailRoute={trailRoute}
        trailLoading={trailLoading}
        onActivateTrail={() => setTrailActive(true)}
        onStopTrail={() => {
          setTrailActive(false);
          setTrailRoute(null);
        }}
        onSelectStop={(spot) => {
          if (!matchesSpotFilter(spot, filterType)) setFilterType("ALL");
          setSelectedSpot(spot);
          setIsSpotCardVisible(true);
        }}
      />

      {/* 6 - BOTTOM FLOATING ADVENTURER DOCK */}
      <BottomNavConsole
        activeSection={activeNav}
        onSelectSection={handleBottomSectionSelect}
        activeVoucherCount={activeVouchers.length}
        todayEventCount={todayEventCount}
      />
    </main>
  );
}
