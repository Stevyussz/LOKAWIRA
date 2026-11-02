"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useVibeHex } from "@/lib/vibeColors";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Icon from "@/components/ui/Icon";
import { matchesSpotFilter, SpotFilter } from "@/lib/spotFilter";
import { api, ApiError, DEMO_MODE, describeError } from "@/lib/api";
import { LocationError, useLocation } from "@/components/layout/LocationProvider";
import NavigateToSpot from "@/components/map/NavigateToSpot";
import { formatDistance } from "@/lib/geo";
import { anchorSpot } from "@/lib/geo";
import { useLokawira } from "@/components/layout/LokawiraProvider";
import VibeSwitcherBar from "@/components/layout/VibeSwitcherBar";
import BottomNavConsole from "@/components/layout/BottomNavConsole";
import StoryTellerDock from "@/components/ai/StoryTellerDock";
import CulturalQuestMap from "@/components/map/CulturalQuestMap";
import ObjectLensScanner from "@/components/ai/ObjectLensScanner";
import SmartQuotaModal from "@/components/quota/SmartQuotaModal";
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
} from "@/types/lokawira";

export default function LokawiraExplorerPage() {
  const vh = useVibeHex();
  const {
    activeVibe,
    setActiveVibe,
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
  } = useLokawira();
  const { position: userPosition, getFix } = useLocation();

  const regionalSpots = useMemo(
    () => spots.filter((s) => s.vibe === activeVibe),
    [spots, activeVibe]
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
  const [isNeedsOpen, setIsNeedsOpen] = useState<boolean>(false);
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [bannerIsError, setBannerIsError] = useState<boolean>(false);
  // kode kehadiran per titik, dr server - Ditunjukkan ke pemilik lapak utk hadiah misi
  const [checkInCodes, setCheckInCodes] = useState<Record<string, string>>({});
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
      spots.find((s) => s.vibe === activeVibe) || spots[0] || null;
    setSelectedSpot(firstInRegion);
    setIsSpotCardVisible(true);
    setFilterType("ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVibe]);

  // Data titik berubah (kuota, demo): segarkan salinan titik teriplih, jgn ganti pilihan user
  useEffect(() => {
    setSelectedSpot((prev) => (prev ? spots.find((s) => s.id === prev.id) ?? prev : prev));
  }, [spots]);

  // filter beerubah: titik terpilih yg tersaring hrs pindah ke titik yg tampil, atw kartunya disembunyikan kalo gak ada satu pun yg cocok
  useEffect(() => {
    const visible = spots.filter((s) => s.vibe === activeVibe && matchesSpotFilter(s, filterType));
    setSelectedSpot((prev) => {
      if (prev && matchesSpotFilter(prev, filterType)) return prev;
      return visible[0] ?? prev;
    });
    if (visible.length === 0) setIsSpotCardVisible(false);
    else setIsSpotCardVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

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
    () => vouchers.filter((v) => v.status === "ACTIVE"),
    [vouchers]
  );

  const handleScanVerified = (
    result: LensVerificationResult,
    newLoreCard: UnlockedLoreCard,
    newVoucher?: IssuedVoucher
  ) => {
    addLokaPoints(result.awardedPoints);
    setLoreCards((prev) => [newLoreCard, ...prev]);
    if (newVoucher) {
      setVouchers((prev) => [newVoucher, ...prev]);
    }
    notify(
      `Artefak "${result.detectedObjectName}" terbuka! +${result.awardedPoints} XP & Voucer ${
        newVoucher?.code || ""
      } masuk ke Tas.`
    );
  };

  const handleReservationCreated = (
    reservation: ReservationPass,
    bonusVoucher?: IssuedVoucher
  ) => {
    setReservations((prev) => [reservation, ...prev]);
    if (bonusVoucher) {
      setVouchers((prev) => [bonusVoucher, ...prev]);
    }
    addLokaPoints(75);
    notify(
      `E-Ticket ${reservation.ticketId} (${reservation.scheduledSlot}) aktif! +75 XP ditambahkan.`
    );
  };

  const handleCheckInQuest = async (spot: CulturalSpot) => {
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
      notify(`Check-in di ${spot.name} berhasil. +${res.awardedPoints} XP. Tunjukkan kode kehadiranmu ke pemilik lapak.`);
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
            ? `Kamu sekitar ${formatDistance(d)} dari ${spot.name}. Dekati sampai kurang dari ${r} m, lalu check-in lagi.`
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
    }
  };

  type NavSection = "MAP" | "STORY" | "QUOTA" | "WALLET";
  // tab aktif diturunkan dr apa yg lg terbuka, jd otomatis kembali ke Peta begitu Tas, Antrean, atw Kisah dtiutup
  const activeNav: NavSection = isWalletOpen
    ? "WALLET"
    : isBoardOpen
    ? "QUOTA"
    : isStoryExpanded
    ? "STORY"
    : "MAP";

  const handleBottomSectionSelect = (section: NavSection) => {
    if (section === "MAP") {
      setIsStoryExpanded(false);
      setIsBoardOpen(false);
      setIsWalletOpen(false);
      setIsSpotCardVisible(true);
    } else if (section === "STORY") {
      setIsStoryExpanded((prev) => !prev);
    } else if (section === "QUOTA") {
      setIsBoardOpen(true);
    } else if (section === "WALLET") {
      setIsWalletOpen(true);
    }
  };

  const activeQuotaRatio = selectedSpot
    ? selectedSpot.quota.currentVisitors / selectedSpot.quota.maxCapacity
    : 0;
  const isSelectedCrowded = activeQuotaRatio >= 0.85;
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
        checkedInSpotIds={checkedInSpotIds}
        filterType={filterType}
        onResetFilter={() => setFilterType("ALL")}
        onOpenNeeds={() => setIsNeedsOpen(true)}
        isOffline={dataStatus === "offline"}
        onRetry={() => refreshServerData()}
        isSurgeDemo={isSurgeDemo}
        onToggleSurgeDemo={handleToggleSurgeDemo}
        userPosition={userPosition}
      />

      {/* 2 - TOP FLOATING GAMIFICATION HUD & FILTER CHIPS */}
      <VibeSwitcherBar
        activeVibe={activeVibe}
        onChangeVibe={setActiveVibe}
        lokaPoints={lokaPoints}
        onOpenAccount={() => setIsAccountOpen(true)}
        filterType={filterType}
        onChangeFilter={setFilterType}
      />

      {/* 3 - FLOATING COLLAPSIBLE KI NARADA AI STORYTELLER */}
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
      <MotionConfig reducedMotion="user">
      <AnimatePresence>
      {selectedSpot && isSpotCardVisible && !isStoryExpanded && (
        <div
          key="spot-card"
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
              {!isSheetCompact && (
                <p className="text-xs text-pebble mt-0.5 line-clamp-1">{selectedSpot.address}</p>
              )}
              {isSheetCompact && (
                <p className="text-xs font-bold text-pebble mt-0.5">
                  +{selectedSpot.quest.rewardPoints} XP · {isSelectedCrowded ? "Padat" : "Masih lega"}
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
                  {selectedSpot.quota.currentVisitors}/{selectedSpot.quota.maxCapacity} (data demo)
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
              onClick={() => setIsQuotaModalOpen(true)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-quotaFull/10 flex items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon name="alert" size={16} className="text-quotaFull shrink-0" />
                <span className="text-xs font-bold text-alabaster">
                  Antrean sekitar {selectedSpot.quest ? selectedSpot.quota.estimatedWaitMinutes : 0} menit. Ambil tiket dan dapat voucer UMKM.
                </span>
              </span>
              <Icon name="next" size={16} weight="bold" className="text-quotaFull shrink-0" />
            </button>
          )}

          {!isSheetCompact && <NavigateToSpot spot={selectedSpot} />}

          <div className="grid grid-cols-[1fr_1fr] sm:grid-cols-[auto_auto_1fr] gap-2">
            <button
              type="button"
              onClick={() => handleCheckInQuest(selectedSpot)}
              disabled={isAlreadyCheckedIn}
              className="btn-tactile-secondary min-h-[48px] px-4 text-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <Icon name={isAlreadyCheckedIn ? "check" : "pin"} size={20} motion="pop" />
              <span>{isAlreadyCheckedIn ? "Sudah Check-In" : "Check-In"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsQuotaModalOpen(true)}
              className="btn-tactile-secondary min-h-[48px] px-4 text-sm flex items-center justify-center gap-2"
            >
              <Icon name="ticket" size={20} className="text-vibePrimary" motion="pop" />
              <span>Tiket</span>
            </button>

            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="btn-tactile-primary col-span-2 sm:col-span-1 min-h-[48px] px-4 text-sm flex items-center justify-center gap-2"
            >
              <Icon name="camera" size={22} motion="pop" />
              <span>Scan Objek</span>
            </button>
          </div>

          {checkInCodes[selectedSpot.id] && (
            <p className="text-xs text-pebble flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Kode kehadiran:</span>
              <span className="font-num text-sm font-extrabold tracking-wider text-alabaster bg-obsidian rounded-lg px-2.5 py-1">
                {checkInCodes[selectedSpot.id]}
              </span>
              <span>Tunjukkan ke pemilik lapak.</span>
            </p>
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
        isPrimaryCrowded={isPrimaryCrowded}
      />
    </main>
  );
}
