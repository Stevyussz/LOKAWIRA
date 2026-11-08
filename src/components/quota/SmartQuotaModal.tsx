"use client";

import React, { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { api, DEMO_MODE, describeError } from "@/lib/api";
import { useAuth } from "@/components/layout/AuthProvider";
import { motion } from "motion/react";
import Sheet from "@/components/ui/Sheet";
import { CulturalSpot, IssuedVoucher, ReservationPass } from "@/types/lokawira";
import { entryOf, isCrowded as crowdedNow } from "@/lib/spotRules";
import type { RedirectNote } from "@/types/api";

interface SmartQuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  spot: CulturalSpot | null;
  nearbyUmkmSpots: CulturalSpot[];
  onReservationCreated: (
    reservation: ReservationPass,
    bonusVoucher?: IssuedVoucher,
    awardedPoints?: number
  ) => void;
  onSelectSpotOnMap: (spot: CulturalSpot) => void;
}

export default function SmartQuotaModal({
  isOpen,
  onClose,
  spot,
  nearbyUmkmSpots,
  onReservationCreated,
  onSelectSpotOnMap,
}: SmartQuotaModalProps) {
  const { user } = useAuth();
  // nama pemesan menngikuti akun yg masuk; di luar mode demo gak ada nama bawaan
  const [visitorName, setVisitorName] = useState<string>(user?.name ?? (DEMO_MODE ? "Wisatawan Demo" : ""));
  useEffect(() => {
    if (user?.name) setVisitorName(user.name);
  }, [user?.name]);
  const [partySize, setPartySize] = useState<number>(2);
  const [scheduledSlot, setScheduledSlot] = useState<string>("14:30 WIB");
  const [acceptCircularQuest, setAcceptCircularQuest] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdPass, setCreatedPass] = useState<ReservationPass | null>(null);
  // alasan voucer pengalih gak terbit walau misinya diterima
  const [rewardNote, setRewardNote] = useState<RedirectNote | undefined>(undefined);
  const [createdVoucher, setCreatedVoucher] = useState<IssuedVoucher | undefined>(
    undefined
  );

  useEffect(() => {
    if (!isOpen || !spot) return;
    setScheduledSlot(spot.quota.nextAvailableSlot || "14:30 WIB");
    setCreatedPass(null);
    setCreatedVoucher(undefined);
    setRewardNote(undefined);
    setFormError(null);
  }, [isOpen, spot]);

  if (!spot) return null;

  const quotaRatio = spot.quota.currentVisitors / spot.quota.maxCapacity;
  // pengalihan ke UMKM cuma ditawarkan saat tempat terisi >= 85% (server juga ngecek)
  const isCrowded = crowdedNow(spot);
  // lapak pengalih selalu tempat lain, bkn tempat yg sedang dipesan
  const partners = nearbyUmkmSpots.filter((x) => x.id !== spot.id);
  // hadiah voucer dari UMKM sekitar (angka asli dari data mitra, bkn tulisan tetap)
  const bestReward = partners.reduce((m, x) => Math.max(m, x.quest.voucherReward.discountAmount), 0);
  const rewardText = bestReward > 0 ? `Rp${bestReward.toLocaleString("id-ID")}` : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim()) {
      setFormError("Nama pemesan wajib diisi untuk menerbitkan E-Ticket.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const data = await api.createReservation({
        spotId: spot.id,
        visitorName: visitorName.trim(),
        partySize,
        scheduledSlot,
        acceptCircularQuest: isCrowded && acceptCircularQuest && partners.length > 0,
      });

      setCreatedPass(data.reservation);
      setCreatedVoucher(data.bonusVoucher);
      setRewardNote(data.rewardNote);
      onReservationCreated(data.reservation, data.bonusVoucher, data.awardedPoints ?? 0);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Terjadi kesalahan saat memesan slot."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div>
            <span className="text-xs font-bold text-vibePrimary">
              Tiket masuk terjadwal
            </span>
            <h2
              id="smart-quota-title"
              className="text-lg sm:text-xl font-extrabold text-alabaster"
            >
              Pesan jadwal masuk
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Modal Reservasi (Escape)"
            className="btn-tactile-secondary min-h-[44px] px-3.5 py-1.5 text-xs flex items-center gap-1.5"
          >
            <Icon name="close" size={16} weight="bold" />
            <span>Tutup</span>
          </button>
        </div>
  );

  return (
    <Sheet isOpen={isOpen} onClose={onClose} titleId="smart-quota-title" header={header}>
      <div className="space-y-5 pt-1">
        {/* Capacity Status Bar */}
        <div className="bg-obsidian p-4 rounded-2xl space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-extrabold text-alabaster">
              {spot.name}
            </span>
            <span className="font-num text-xs font-bold text-vibeSecondary flex items-center gap-1.5 tabular-nums">
              <Icon name="users" size={16} className="text-vibePrimary" motion="pop" />
              {spot.quota.currentVisitors}/{spot.quota.maxCapacity} Pengunjung (
              {Math.round(quotaRatio * 100)}%)
              {DEMO_MODE && <span className="font-sans text-[11px] font-semibold text-pebble">Data demo</span>}
            </span>
          </div>

          {isCrowded && (
            <div className="p-3.5 rounded-xl bg-[var(--vibe-surface-tint)] text-xs text-alabaster flex items-start gap-2.5">
              <Icon name="alert" size={16} className="text-quotaWarning shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Antrean lokasi utama sedang padat (tunggu{" "}
                <strong>{spot.quota.estimatedWaitMinutes} menit</strong>). Ambil jam masuk
                terjadwal dan kunjungi UMKM radius 250m{rewardText ? <> untuk hadiah voucer hingga{" "}
                <strong className="font-num text-vibeSecondary">{rewardText}</strong></> : null}!
              </p>
            </div>
          )}
        </div>

        {/* Nearby Circular UMKM Cards */}
        {isCrowded && partners.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-pebble block">
              Rekomendasi Lapak UMKM Sekitar (Bebas Antre):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {partners.map((umkm) => (
                <div
                  key={umkm.id}
                  className="bg-obsidian p-3.5 rounded-2xl flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <span className="text-[11px] font-bold text-vibeSecondary">
                      {umkm.spotType === "SANGGAR_SENI" ? "Sanggar Seni" : "UMKM Kuliner/Kriya"}
                    </span>
                    <p className="text-sm font-extrabold text-alabaster mt-0.5">
                      {umkm.name}
                    </p>
                    <p className="text-xs text-quotaSafe font-num font-bold mt-0.5">
                      Voucer Rp{umkm.quest.voucherReward.discountAmount.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSpotOnMap(umkm);
                      onClose();
                    }}
                    className="btn-tactile-secondary min-h-[44px] px-3 py-1.5 text-xs flex items-center justify-center gap-1.5"
                  >
                    <Icon name="umkm" size={16} className="text-vibePrimary" motion="pop" />
                    <span>Pilih di Peta</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Booking Form or Ticket Reveal */}
        {!createdPass ? (
          <form onSubmit={handleSubmit} className="space-y-4 bg-obsidian p-4 rounded-2xl">
            {/* cara masuk: tiket berbayar dibayar di tempat, slot gratis cukup dipesan */}
            {(() => {
              const en = entryOf(spot);
              return (
                <p className="text-xs text-alabaster leading-relaxed">
                  {en.mode === "TICKET"
                    ? `Tiket masuk ${en.priceIdr ? `Rp${en.priceIdr.toLocaleString("id-ID")} per orang` : "gratis"}. ${en.note || "Bayar di loket saat masuk."} Pesan jam masuk di sini supaya tidak antre.`
                    : "Masuk gratis, tapi tempatnya terbatas. Pesan jam masuk di sini."}
                </p>
              );
            })()}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label
                  htmlFor="visitor-name-input"
                  className="block text-xs font-bold text-pebble mb-1.5"
                >
                  Nama Pemesan
                </label>
                <input
                  id="visitor-name-input"
                  type="text"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Nama lengkap kamu"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-basalt border border-stoneStrong text-xs text-alabaster"
                />
              </div>

              <div>
                <label
                  htmlFor="party-size-input"
                  className="block text-xs font-bold text-pebble mb-1.5"
                >
                  Jumlah Orang
                </label>
                <select
                  id="party-size-input"
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-basalt border border-stoneStrong text-xs text-alabaster font-num"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} Orang
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-pebble mb-1.5">
                Pilih Slot Jam Masuk
              </label>
              <div className="flex flex-wrap gap-2">
                {["14:30 WIB", "15:15 WIB", "16:00 WIB"].map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setScheduledSlot(slot)}
                    aria-pressed={scheduledSlot === slot}
                    className={`min-h-[44px] px-3.5 py-1.5 rounded-xl font-num text-xs font-bold transition-all flex items-center gap-1.5 ${
                      scheduledSlot === slot
                        ? "bg-vibePrimary text-[var(--vibe-on-primary)]"
                        : "bg-basalt text-pebble hover:text-alabaster"
                    }`}
                  >
                    <Icon name="voucher" size={14} className="text-vibeSecondary" motion="pop" />
                    <span>{slot}</span>
                  </button>
                ))}
              </div>
            </div>

            {isCrowded && partners.length > 0 && (
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptCircularQuest}
                  onChange={(e) => setAcceptCircularQuest(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-[var(--vibe-primary)]"
                />
                <span className="text-xs text-alabaster leading-relaxed">
                  Ikuti <strong>Misi Sirkular UMKM</strong> sambil menunggu jam masuk (otomatis
                  dapat voucer dari UMKM terdekat{rewardText ? ` hingga ${rewardText}` : ""}).
                </span>
              </label>
            )}

            {formError && (
              <p role="alert" className="text-xs text-quotaFull font-bold">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-tactile-primary w-full min-h-[50px] px-5 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Icon name="loader" size={16} weight="bold" motion="spin" />
                  <span>Menerbitkan E-Ticket...</span>
                </>
              ) : (
                <>
                  <Icon name="ticket" size={20} motion="pop" />
                  <span>Ambil QR Reservation Pass (+75 XP)</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="perforated-ticket p-5 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon name="check" size={24} className="text-quotaSafe" motion="pop" />
                <div>
                  <span className="text-xs font-bold text-quotaSafe block">
                    QR Reservation Pass Aktif
                  </span>
                  <h3 className="text-base font-extrabold text-alabaster">
                    {createdPass.spotName}
                  </h3>
                </div>
              </div>
              <span className="font-num text-sm font-extrabold px-3 py-1 rounded-xl bg-obsidian text-vibeSecondary">
                {createdPass.ticketId}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs bg-obsidian p-3.5 rounded-2xl">
              <div>
                <span className="text-pebble block">Pemesan</span>
                <strong className="text-alabaster">{createdPass.visitorName}</strong>
              </div>
              <div>
                <span className="text-pebble block">Jam Masuk</span>
                <strong className="font-num text-vibePrimary">
                  {createdPass.scheduledSlot}
                </strong>
              </div>
              <div>
                <span className="text-pebble block">Rombongan</span>
                <strong className="font-num text-alabaster">
                  {createdPass.partySize} Orang
                </strong>
              </div>
            </div>

            {!createdVoucher && rewardNote && (
              <p className="p-3.5 rounded-2xl bg-obsidian text-xs text-alabaster leading-relaxed">
                {rewardNote === "LOGIN_FOR_REWARD"
                  ? "Voucer pengalih antrean hanya untuk pengguna yang masuk. Masuk atau daftar, lalu pesan lagi untuk mendapatkannya."
                  : rewardNote === "ALREADY_CLAIMED_TODAY"
                  ? "Voucer pengalih antrean dari lapak ini sudah kamu terima hari ini."
                  : rewardNote === "NOT_CROWDED"
                  ? "Tempat ini sedang tidak padat, jadi tidak perlu dialihkan. Voucer pengalih hanya terbit saat tempat terisi 85% atau lebih."
                  : "Belum ada lapak mitra di kawasan ini, jadi voucer pengalih antrean belum tersedia."}
              </p>
            )}

            {createdVoucher && (
              <div className="p-3.5 rounded-2xl bg-obsidian text-xs flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] text-vibePrimary font-bold block">
                    Bonus Voucer Pengalih Antrean
                  </span>
                  <strong className="text-alabaster">{createdVoucher.merchantName}</strong>
                </div>
                <span className="font-num text-sm font-extrabold text-vibeSecondary">
                  {createdVoucher.code} (Rp
                  {createdVoucher.discountAmount.toLocaleString("id-ID")})
                </span>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </Sheet>
  );
}
