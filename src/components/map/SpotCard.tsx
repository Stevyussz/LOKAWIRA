"use client";

import React from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Icon from "@/components/ui/Icon";
import Loka from "@/components/brand/Loka";
import { NusantaraPatternStrip } from "@/components/brand/NusantaraOrnaments";
import GuideCard from "@/components/map/GuideCard";
import type { TravelMode, WalkingRoute } from "@/lib/route";
import { formatEventDateTime, formatRupiah, formatShortDayTime } from "@/lib/format";
import { spotTypeIcon } from "@/lib/spotMeta";
import { ENTRY_LABEL, entryOf, needsBooking, openState, tzOf } from "@/lib/spotRules";
import type { CulturalSpot, EventOccurrence } from "@/types/lokawira";

interface SpotCardProps {
  visible: boolean;
  selectedSpot: CulturalSpot;
  reducedMotion: "user" | "always" | "never";
  isCompact: boolean;
  isAlreadyCheckedIn: boolean;
  checkInCode?: string;
  nextEvent: EventOccurrence | null;
  guidePhase: "off" | "preview" | "navigating";
  guideSpot: CulturalSpot | null;
  guideRoute: WalkingRoute | null;
  guideRouteLoading: boolean;
  guideMode?: TravelMode;
  onChangeGuideMode?: (m: TravelMode) => void;
  checkInRadius: number | null;
  setCardEl: (el: HTMLDivElement | null) => void;
  onToggleCompact: () => void;
  onHide: () => void;
  onStartGuide: (spot: CulturalSpot) => void;
  onStartNavigating: () => void;
  onStopGuide: () => void;
  onCheckIn: (spot: CulturalSpot) => Promise<boolean>;
  onOpenScanner: () => void;
  onOpenInfo: () => void;
  onOpenQuota: () => void;
  onOpenBoard: () => void;
  onOpenAgenda: () => void;
}

export default function SpotCard({
  visible,
  selectedSpot,
  reducedMotion,
  isCompact,
  isAlreadyCheckedIn,
  checkInCode,
  nextEvent,
  guidePhase,
  guideSpot,
  guideRoute,
  guideRouteLoading,
  guideMode = "foot",
  onChangeGuideMode,
  checkInRadius,
  setCardEl,
  onToggleCompact,
  onHide,
  onStartGuide,
  onStartNavigating,
  onStopGuide,
  onCheckIn,
  onOpenScanner,
  onOpenInfo,
  onOpenQuota,
  onOpenBoard,
  onOpenAgenda,
}: SpotCardProps) {
  const activeQuotaRatio = selectedSpot.quota.currentVisitors / selectedSpot.quota.maxCapacity;
  const isSelectedCrowded = activeQuotaRatio >= 0.85;
  const en = entryOf(selectedSpot);
  const os = openState(selectedSpot);
  const booking = needsBooking(selectedSpot);
  const third = booking ? "col-span-2 px-2 gap-1.5 leading-tight" : "col-span-3 px-4 gap-2";

  return (
    <MotionConfig reducedMotion={reducedMotion}>
      <AnimatePresence>
        {visible && (
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
              className="gamiz-card overflow-hidden p-0"
            >
              <NusantaraPatternStrip vibe={selectedSpot.vibe} height={10} />
              <div className="px-4">
                <button
                  type="button"
                  onClick={onToggleCompact}
                  aria-label={isCompact ? "Tampilkan detail lokasi" : "Ringkas kartu lokasi"}
                  aria-expanded={!isCompact}
                  className="mx-auto flex w-full h-8 items-center justify-center"
                >
                  <span className="w-10 h-1.5 rounded-full bg-[var(--map-road-edge)]" />
                </button>
              </div>

              {guidePhase !== "off" && guideSpot ? (
                <div className="px-4 pb-4">
                <GuideCard
                  spot={guideSpot}
                  phase={guidePhase}
                  route={guideRoute}
                  routeLoading={guideRouteLoading}
                  mode={guideMode}
                  onChangeMode={onChangeGuideMode}
                  arriveRadius={checkInRadius}
                  isCheckedIn={checkedInSpotIdsIncludes(isAlreadyCheckedIn, guideSpot.id, selectedSpot.id)}
                  onStart={onStartNavigating}
                  onStop={onStopGuide}
                  onCheckIn={() => onCheckIn(guideSpot).then((ok) => ok && onStopGuide())}
                />
                </div>
              ) : (
                <div className="px-4 pb-4 space-y-2.5">
                  <div className="flex items-start gap-3">
                    <div
                      className={`relative w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ring-1 ring-inset ring-black/10 ${
                        selectedSpot.spotType === "PRIMARY_DEST"
                          ? "bg-vibePrimary text-[var(--vibe-on-primary)]"
                          : selectedSpot.spotType === "SANGGAR_SENI"
                          ? "bg-[var(--vibe-accent)] text-alabaster"
                          : "bg-[var(--pin-umkm)] text-[var(--vibe-on-primary)]"
                      }`}
                    >
                      <Icon name={spotTypeIcon(selectedSpot.spotType)} size={24} weight="duotone" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-base font-extrabold text-alabaster leading-snug line-clamp-1">
                        {selectedSpot.name}
                      </h3>
                      {!isCompact && selectedSpot.highlight && (
                        <p className="text-xs font-bold text-vibePrimary mt-0.5 line-clamp-1">
                          {selectedSpot.highlight}
                        </p>
                      )}
                      {!isCompact && (
                        <p className="text-xs text-pebble mt-0.5 line-clamp-1 flex items-center gap-1">
                          <Icon name="pin" size={13} className="text-vibePrimary shrink-0" />
                          <span className="truncate">{selectedSpot.address}</span>
                        </p>
                      )}
                      {isCompact && (
                        <p className="text-xs font-bold text-pebble mt-0.5">
                          +{selectedSpot.quest.rewardPoints} XP ·{" "}
                          {nextEvent && new Date(nextEvent.startsAt).getTime() - Date.now() < 7 * 86400000
                            ? `Acara ${formatShortDayTime(nextEvent.startsAt, tzOf(selectedSpot))}`
                            : isSelectedCrowded
                            ? "Padat"
                            : "Masih lega"}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={onHide}
                      aria-label="Sembunyikan kartu lokasi"
                      className="min-w-[44px] min-h-[44px] -mt-2 -mr-2 rounded-full text-pebble hover:bg-slateElev flex items-center justify-center shrink-0"
                    >
                      <Icon name="close" size={16} weight="bold" />
                    </button>
                  </div>

                  {!isCompact && nextEvent && (
                    <button
                      type="button"
                      onClick={onOpenAgenda}
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-obsidian flex items-center justify-between gap-3 text-left"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Icon name="calendar" size={16} className="text-vibePrimary shrink-0" />
                        <span className="text-xs text-alabaster min-w-0">
                          <b>{nextEvent.title}</b> · {formatEventDateTime(nextEvent.startsAt, tzOf(selectedSpot))}
                        </span>
                      </span>
                      <Icon name="next" size={16} weight="bold" className="text-vibePrimary shrink-0" />
                    </button>
                  )}

                  {!isCompact && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-obsidian text-[11px] font-extrabold text-alabaster inline-flex items-center gap-1">
                        <Icon name={en.mode === "FREE" ? "users" : "ticket"} size={14} className="text-vibePrimary" />
                        {en.mode === "TICKET" && en.priceIdr !== undefined
                          ? en.priceIdr === 0
                            ? "Tiket gratis"
                            : `Tiket ${formatRupiah(en.priceIdr)}`
                          : ENTRY_LABEL[en.mode]}
                      </span>
                      {os.label && (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                            os.status === "OPEN" ? "bg-obsidian text-quotaSafe" : "bg-obsidian text-quotaFull"
                          }`}
                        >
                          {os.label}
                        </span>
                      )}
                    </div>
                  )}

                  {!isCompact && (
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

                  {isSelectedCrowded && !isCompact && (
                    <button
                      type="button"
                      onClick={() => (booking ? onOpenQuota() : onOpenBoard())}
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-quotaFull/10 flex items-center justify-between gap-3 text-left"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Icon name="alert" size={16} className="text-quotaFull shrink-0" />
                        <span className="text-xs font-bold text-alabaster">
                          {booking
                            ? `Antrean sekitar ${selectedSpot.quota.estimatedWaitMinutes} menit. Ambil tiket dan dapat voucer UMKM.`
                            : "Sedang ramai. Lihat titik lain yang lebih lengang di sekitar sini."}
                        </span>
                      </span>
                      <Icon name="next" size={16} weight="bold" className="text-quotaFull shrink-0" />
                    </button>
                  )}

                  <div className="grid grid-cols-6 gap-2">
                    <button
                      type="button"
                      onClick={() => onStartGuide(selectedSpot)}
                      className="col-span-3 btn-tactile-primary min-h-[48px] px-4 text-sm flex items-center justify-center gap-2"
                    >
                      <Icon name="compass" size={20} motion="pop" />
                      <span>Pandu aku</span>
                    </button>

                    <button
                      type="button"
                      onClick={onOpenScanner}
                      className="col-span-3 btn-tactile-secondary min-h-[48px] px-4 text-sm flex items-center justify-center gap-2"
                    >
                      <Icon name="camera" size={20} className="text-vibePrimary" motion="pop" />
                      <span>Scan Objek</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onCheckIn(selectedSpot)}
                      disabled={isAlreadyCheckedIn}
                      aria-label={isAlreadyCheckedIn ? "Sudah Check-In" : undefined}
                      className={`${third} btn-tactile-secondary min-h-[48px] text-sm flex items-center justify-center disabled:opacity-70`}
                    >
                      <Icon name={isAlreadyCheckedIn ? "check" : "pin"} size={booking ? 18 : 20} className="shrink-0" motion="pop" />
                      <span>{isAlreadyCheckedIn ? (booking ? "Sudah" : "Sudah Check-In") : "Check-In"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onOpenInfo}
                      aria-haspopup="dialog"
                      className={`${third} btn-tactile-secondary min-h-[48px] text-sm flex items-center justify-center`}
                    >
                      <Icon name="guide" size={booking ? 18 : 20} className="text-vibePrimary shrink-0" motion="pop" />
                      <span>Info</span>
                    </button>

                    {booking && (
                      <button
                        type="button"
                        onClick={onOpenQuota}
                        aria-label={en.mode === "RESERVATION" ? "Pesan slot" : "Pesan tiket"}
                        className={`${third} btn-tactile-secondary min-h-[48px] text-sm flex items-center justify-center`}
                      >
                        <Icon name="ticket" size={18} className="text-vibePrimary shrink-0" motion="pop" />
                        <span>{en.mode === "RESERVATION" ? "Pesan" : "Tiket"}</span>
                      </button>
                    )}
                  </div>

                  {checkInCode && (
                    <div className="rounded-2xl bg-obsidian p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Loka variant="mark" size={32} mood="cheer" motion="hop" />
                        <p className="text-[11px] font-bold text-pebble">Kamu sudah sampai. Ini kode kehadiranmu</p>
                      </div>
                      <p className="font-num text-xl font-extrabold tracking-wider text-alabaster">{checkInCode}</p>
                      <p className="text-[11px] text-pebble">
                        Tunjukkan ke pemilik lapak. Setelah dia memverifikasi kode ini di aplikasi kasir, hadiah misi (+{selectedSpot.quest.rewardPoints} XP) masuk ke akunmu. Kode hanya berlaku sekali.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.section>
          </div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

function checkedInSpotIdsIncludes(isAlreadyCheckedIn: boolean, guideSpotId: string, selectedSpotId: string) {
  return guideSpotId === selectedSpotId ? isAlreadyCheckedIn : false;
}
