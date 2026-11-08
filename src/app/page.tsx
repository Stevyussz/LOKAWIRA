"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVibeHex } from "@/lib/vibeColors";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Icon from "@/components/ui/Icon";
import { matchesSpotFilter, SpotFilter } from "@/lib/spotFilter";
import { api, ApiError, DEMO_MODE, describeError } from "@/lib/api";
import { LocationError, useLocation } from "@/components/layout/LocationProvider";
import GuideCard from "@/components/map/GuideCard";
import { useWalkingRoute } from "@/lib/useWalkingRoute";
import { distanceMeters, formatDistance } from "@/lib/geo";
import { anchorSpot } from "@/lib/geo";
import { useLokawira } from "@/components/layout/LokawiraProvider";
import Loka from "@/components/brand/Loka";
import { isExpired } from "@/lib/formatTime";
import { ENTRY_LABEL, entryOf, needsBooking, openState, tzOf } from "@/lib/spotRules";
import AgendaSheet from "@/components/agenda/AgendaSheet";
import { trackOnce } from "@/lib/track";

const rupiahFmt = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
import VibeSwitcherBar from "@/components/layout/VibeSwitcherBar";
import BottomNavConsole from "@/components/layout/BottomNavConsole";
import StoryTellerDock from "@/components/ai/StoryTellerDock";
import CulturalQuestMap from "@/components/map/CulturalQuestMap";
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
  const vh = useVibeHex();
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
  const { route: guideRoute, loading: guideRouteLoading } = useWalkingRoute(
    guidePhase !== "off" ? userPosition : null,
    guidePhase !== "off" ? guideSpot : null
  );
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

  const notify = (text: string, isError = false) => {
    setBannerIsError(isError);
    setStatusBanner(text);
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
        : `Kisah "${result.detectedObjectName}" terbuka. Hadiah di titik ini sudah kamu ambil hari ini.`
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
    addLokaPoints(awardedPoints);
    notify(
      `E-Ticket ${reservation.ticketId} (${reservation.scheduledSlot}) aktif!${awardedPoints > 0 ? ` +${awardedPoints} XP.` : ""}`
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
      markSpotCheckedIn(spot.id);
      addLokaPoints(res.awardedPoints);
      setCheckInCodes((prev) => ({ ...prev, [spot.id]: res.checkIn.code }));
      notify(
        res.awardedPoints > 0
          ? `Check-in di ${spot.name} berhasil. +${res.awardedPoints} XP. Tunjukkan kode kehadiranmu ke pemilik lapak.`
          : `Check-in di ${spot.name} berhasil. Masuk atau daftar agar XP dan hadiah misimu tercatat.`
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
        regionLabel={activeRegion ? `${activeRegion.name}, ${activeRegion.label}` : ""}
        checkedInSpotIds={checkedInSpotIds}
        filterType={filterType}
        onResetFilter={() => setFilterType("ALL")}
        onOpenNeeds={() => setIsNeedsOpen(true)}
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

      {/* Notifikasi */}
      <AnimatePresence>
        {statusBanner && (
          <motion.div
            key="status-banner"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="fixed top-[132px] left-3 right-3 sm:left-auto sm:right-5 sm:w-[360px] z-40 gamiz-card px-4 py-3 flex items-center gap-3"
          >
            <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${bannerIsError ? "bg-quotaFull/15" : "bg-quotaSafe/15"}`}>
              <Icon name={bannerIsError ? "alert" : "check"} size={22} className={bannerIsError ? "text-quotaFull" : "text-quotaSafe"} motion="pop" />
            </span>
            <p className="text-sm font-bold text-alabaster flex-1">{statusBanner}</p>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              aria-label="Tutup notifikasi"
              className="min-w-[44px] min-h-[44px] rounded-full text-pebble hover:bg-slateElev flex items-center justify-center"
            >
              <Icon name="close" size={16} weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4 - KARTU LOKASI */}
      <MotionConfig reducedMotion={reducedMotion}>
      <AnimatePresence>
      {selectedSpot && isSpotCardVisible && !isStoryExpanded && (
        <div
          key="spot-card"
          ref={setCardEl}
          style={{ bottom: "calc(92px + env(safe-area-inset-bottom))" }}
          className="fixed left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-20 sm:w-[500px]"
        >
        <motion.section
          aria-label={`Detail lokasi ${selectedSpot.name}`}
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 28, transition: { duration: 0.18 } }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="gamiz-card p-4 pt-2 space-y-3"
        >
          <button
            type="button"
            onClick={() => setIsSheetCompact((v) => !v)}
            aria-label={isSheetCompact ? "Tampilkan detail lokasi" : "Ringkas kartu lokasi"}
            aria-expanded={!isSheetCompact}
            className="mx-auto flex w-full h-11 -mt-2.5 -mb-2 items-center justify-center"
          >
            <span className="w-10 h-1.5 rounded-full bg-[var(--map-road-edge)]" />
          </button>
          {guidePhase !== "off" && guideSpot ? (
            <GuideCard
              spot={guideSpot}
              phase={guidePhase}
              route={guideRoute}
              routeLoading={guideRouteLoading}
              arriveRadius={checkInRadius}
              isCheckedIn={checkedInSpotIds.includes(guideSpot.id)}
              onStart={() => setGuidePhase("navigating")}
              onStop={stopGuide}
              onCheckIn={() => handleCheckInQuest(guideSpot).then((ok) => ok && stopGuide())}
            />
          ) : (
          <>
          <div className="flex items-start gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                selectedSpot.spotType === "PRIMARY_DEST"
                  ? "bg-vibePrimary"
                  : selectedSpot.spotType === "SANGGAR_SENI"
                  ? "bg-[var(--vibe-accent)]"
                  : "bg-[#1F8A83]"
              }`}
            >
              <Icon name={
                  selectedSpot.spotType === "PRIMARY_DEST"
                    ? "heritage"
                    : selectedSpot.spotType === "SANGGAR_SENI"
                    ? "sanggar"
                    : selectedSpot.spotType === "UMKM_KULINER"
                    ? "food"
                    : "umkm"
                } size={28} motion="pop" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-base font-extrabold text-alabaster leading-snug">
                {selectedSpot.name}
              </h3>
              {!isSheetCompact && selectedSpot.highlight && (
                <p className="text-xs font-bold text-vibePrimary mt-0.5">{selectedSpot.highlight}</p>
              )}
              {!isSheetCompact && (
                <p className="text-xs text-pebble mt-0.5 line-clamp-1">{selectedSpot.address}</p>
              )}
              {isSheetCompact && (
                <p className="text-xs font-bold text-pebble mt-0.5">
                  +{selectedSpot.quest.rewardPoints} XP ·{" "}
                  {nextEvent && new Date(nextEvent.startsAt).getTime() - Date.now() < 7 * 86400000
                    ? `Acara ${new Intl.DateTimeFormat("id-ID", { timeZone: tzOf(selectedSpot), weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(nextEvent.startsAt))}`
                    : isSelectedCrowded ? "Padat" : "Masih lega"}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsSpotCardVisible(false)}
              aria-label="Sembunyikan kartu lokasi"
              className="min-w-[44px] min-h-[44px] -mt-2 -mr-2 rounded-full text-pebble hover:bg-slateElev flex items-center justify-center"
            >
              <Icon name="close" size={16} weight="bold" />
            </button>
          </div>

          {/* acara berikutnya di titik ini: jawaban buat "lewat doang, gak tau ada apa" */}
          {!isSheetCompact && nextEvent && (
            <button
              type="button"
              onClick={() => setIsAgendaOpen(true)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-obsidian flex items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon name="calendar" size={16} className="text-vibePrimary shrink-0" />
                <span className="text-xs text-alabaster min-w-0">
                  <b>{nextEvent.title}</b> · {new Intl.DateTimeFormat("id-ID", { timeZone: tzOf(selectedSpot), weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(nextEvent.startsAt))}
                </span>
              </span>
              <Icon name="next" size={16} weight="bold" className="text-vibePrimary shrink-0" />
            </button>
          )}

          {/* cara masuk & status buka */}
          {!isSheetCompact && (() => {
            const en = entryOf(selectedSpot);
            const os = openState(selectedSpot);
            return (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-full bg-obsidian text-[11px] font-extrabold text-alabaster inline-flex items-center gap-1">
                  <Icon name={en.mode === "FREE" ? "users" : "ticket"} size={14} className="text-vibePrimary" />
                  {en.mode === "TICKET" && en.priceIdr !== undefined ? (en.priceIdr === 0 ? "Tiket gratis" : `Tiket ${rupiahFmt(en.priceIdr)}`) : ENTRY_LABEL[en.mode]}
                </span>
                {os.label && (
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${os.status === "OPEN" ? "bg-obsidian text-quotaSafe" : "bg-obsidian text-quotaFull"}`}>
                    {os.label}
                  </span>
                )}
              </div>
            );
          })()}

          {/* Hadiah & kapasitas */}
          {!isSheetCompact && (
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-full bg-[var(--vibe-accent)] text-xs font-extrabold text-alabaster tabular-nums shrink-0">
              +{selectedSpot.quest.rewardPoints} XP
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] font-bold text-pebble mb-1">
                <span>{isSelectedCrowded ? "Padat" : "Masih lega"}</span>
                <span className="tabular-nums">
                  {selectedSpot.quota.currentVisitors}/{selectedSpot.quota.maxCapacity}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-obsidian overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    isSelectedCrowded ? "bg-quotaFull" : activeQuotaRatio > 0.6 ? "bg-quotaWarning" : "bg-quotaSafe"
                  }`}
                  style={{ width: `${Math.min(100, Math.round(activeQuotaRatio * 100))}%` }}
                />
              </div>
            </div>
          </div>
          )}

          {isSelectedCrowded && !isSheetCompact && (
            <button
              type="button"
              // titik bebas masuk gak punya tiket: arahkan ke papan antrean buat cari yg lengang
              onClick={() => (needsBooking(selectedSpot) ? setIsQuotaModalOpen(true) : setIsBoardOpen(true))}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-quotaFull/10 flex items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon name="alert" size={16} className="text-quotaFull shrink-0" />
                <span className="text-xs font-bold text-alabaster">
                  {needsBooking(selectedSpot)
                    ? `Antrean sekitar ${selectedSpot.quota.estimatedWaitMinutes} menit. Ambil tiket dan dapat voucer UMKM.`
                    : "Sedang ramai. Lihat titik lain yang lebih lengang di sekitar sini."}
                </span>
              </span>
              <Icon name="next" size={16} weight="bold" className="text-quotaFull shrink-0" />
            </button>
          )}

          
          {(() => {
            // baris 2: 3 tombol kalo titiknya perlu pesan, 2 kalo bebas masuk. Tinggi kartu tetap 2 baris biar peta gak makin sempit
            const booking = needsBooking(selectedSpot);
            const third = booking ? "col-span-2 px-2 gap-1.5 leading-tight" : "col-span-3 px-4 gap-2";
            return (
          <div className="grid grid-cols-6 gap-2">
            <button
              type="button"
              onClick={() => startGuide(selectedSpot)}
              className="col-span-3 btn-tactile-primary min-h-[48px] px-4 text-sm flex items-center justify-center gap-2"
            >
              <Icon name="compass" size={20} motion="pop" />
              <span>Pandu aku</span>
            </button>

            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="col-span-3 btn-tactile-secondary min-h-[48px] px-4 text-sm flex items-center justify-center gap-2"
            >
              <Icon name="camera" size={20} className="text-vibePrimary" motion="pop" />
              <span>Scan Objek</span>
            </button>

            <button
              type="button"
              onClick={() => handleCheckInQuest(selectedSpot)}
              disabled={isAlreadyCheckedIn}
              aria-label={isAlreadyCheckedIn ? "Sudah Check-In" : undefined}
              className={`${third} btn-tactile-secondary min-h-[48px] text-sm flex items-center justify-center disabled:opacity-70`}
            >
              <Icon name={isAlreadyCheckedIn ? "check" : "pin"} size={booking ? 18 : 20} className="shrink-0" motion="pop" />
              <span>{isAlreadyCheckedIn ? (booking ? "Sudah" : "Sudah Check-In") : "Check-In"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSpotInfo(true)}
              aria-haspopup="dialog"
              className={`${third} btn-tactile-secondary min-h-[48px] text-sm flex items-center justify-center`}
            >
              <Icon name="guide" size={booking ? 18 : 20} className="text-vibePrimary shrink-0" motion="pop" />
              <span>Info</span>
            </button>

            {booking && (
              <button
                type="button"
                onClick={() => setIsQuotaModalOpen(true)}
                aria-label={entryOf(selectedSpot).mode === "RESERVATION" ? "Pesan slot" : "Pesan tiket"}
                className={`${third} btn-tactile-secondary min-h-[48px] text-sm flex items-center justify-center`}
              >
                <Icon name="ticket" size={18} className="text-vibePrimary shrink-0" motion="pop" />
                {/* label pendek biar muat 1 baris di HP 360px; nama lengkap lewat aria-label */}
                <span>{entryOf(selectedSpot).mode === "RESERVATION" ? "Pesan" : "Tiket"}</span>
              </button>
            )}
          </div>
            );
          })()}

          {checkInCodes[selectedSpot.id] && (
            <div className="rounded-2xl bg-obsidian p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Loka variant="mark" size={32} mood="cheer" motion="hop" />
                <p className="text-[11px] font-bold text-pebble">Kamu sudah sampai. Ini kode kehadiranmu</p>
              </div>
              <p className="font-num text-xl font-extrabold tracking-wider text-alabaster">{checkInCodes[selectedSpot.id]}</p>
              <p className="text-[11px] text-pebble">
                Tunjukkan ke pemilik lapak. Setelah dia memverifikasi kode ini di aplikasi kasir, hadiah misi (+{selectedSpot.quest.rewardPoints} XP) masuk ke akunmu. Kode hanya berlaku sekali.
              </p>
            </div>
          )}
          </>
          )}
        </motion.section>
        </div>
      )}
      </AnimatePresence>
      </MotionConfig>

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
        lokaPoints={lokaPoints}
        vouchers={vouchers}
        reservations={reservations}
        loreCards={loreCards}
        onOpenScanner={() => setIsScannerOpen(true)}
      />

      <AccountSheet isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />

      <NeedsSearchSheet
        isOpen={isNeedsOpen}
        onClose={() => setIsNeedsOpen(false)}
        spots={regionalSpots}
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

      {/* 6 - BOTTOM FLOATING ADVENTURER DOCK */}
      <BottomNavConsole
        activeSection={activeNav}
        onSelectSection={handleBottomSectionSelect}
        onOpenScanner={() => setIsScannerOpen(true)}
        activeVoucherCount={activeVouchers.length}
        todayEventCount={todayEventCount}
      />
    </main>
  );
}
