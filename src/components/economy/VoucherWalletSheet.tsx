"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Icon, { IconName } from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import QrCodeSvg from "@/components/ui/QrCodeSvg";
import LokaScene, { type LokaSceneKind } from "@/components/brand/LokaScene";
import { BatikWatermark, NusantaraCornerFrame, NusantaraPatternStrip, PrasastiSeal, RegionCoverBanner } from "@/components/brand/NusantaraOrnaments";
import { formatExpiry, formatWhen, isExpired } from "@/lib/formatTime";
import { formatRupiah } from "@/lib/format";
import { FEATURE_COVER_IMAGE, REGION_COVER_IMAGE } from "@/lib/spotMeta";
import { CulturalVibe, IssuedVoucher, ReservationPass, UnlockedLoreCard } from "@/types/lokawira";

interface VoucherWalletSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeVibe?: CulturalVibe;
  lokaPoints: number;
  vouchers: IssuedVoucher[];
  reservations: ReservationPass[];
  loreCards: UnlockedLoreCard[];
  // dipakai tombol di state kosong biar user laangsung punya langkah berikutnya
  onOpenScanner?: () => void;
  onOpenBoard?: () => void;
}

type WalletTab = "VOUCHERS" | "PASSES" | "LORE";

const TABS: { id: WalletTab; label: string; icon: IconName }[] = [
  { id: "VOUCHERS", label: "Voucer", icon: "voucher" },
  { id: "PASSES", label: "E-Ticket", icon: "ticket" },
  { id: "LORE", label: "Kartu Lore", icon: "story" },
];

// item daftar muncul bertahap - cuma opacity & trasnform, dibatasi biar ringan di HP lemah
const itemMotion = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring" as const, stiffness: 380, damping: 30, delay: Math.min(i, 5) * 0.05 },
});

function EmptyState({
  scene = "empty-wallet",
  vibe = "majapahit",
  title,
  hint,
  actionLabel,
  onAction,
}: {
  scene?: LokaSceneKind;
  vibe?: CulturalVibe;
  title: string;
  hint: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="py-8 px-4 text-center space-y-3">
      <LokaScene scene={scene} vibe={vibe} size={104} />
      <p className="text-base font-extrabold text-alabaster">{title}</p>
      <p className="text-sm text-pebble max-w-xs mx-auto">{hint}</p>
      <button
        type="button"
        onClick={onAction}
        className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center gap-2"
      >
        <Icon name="scan" size={18} />
        <span>{actionLabel}</span>
      </button>
    </div>
  );
}

function VoucherTicket({
  voucher,
  index,
  copied,
  onCopy,
}: {
  voucher: IssuedVoucher;
  index: number;
  copied: boolean;
  onCopy: () => void;
}) {
  const expired = voucher.status === "ACTIVE" && isExpired(voucher.expiresAt);
  const active = voucher.status === "ACTIVE" && !expired;
  const [showCode, setShowCode] = useState(false);
  return (
    <motion.li {...itemMotion(index)} className="ticket-shadow list-none">
      {/* voucer nonaktif dibedain lewat warna stub & label, bkn opacity (opacity bikin teks gagal kontras 4,5:1) */}
      <div className="ticket-cut-v relative flex rounded-2xl overflow-hidden border border-stoneSubtle">
        {/* Stub: nilai potongan, sisi yg dilhiat pertama */}
        <div
          className={`w-[96px] shrink-0 batik-stub-bg flex flex-col items-center justify-center text-center px-1.5 py-3 ${
            active ? "bg-vibePrimary text-[var(--vibe-on-primary)]" : "bg-pumice text-alabaster"
          }`}
        >
          <span className="text-[10px] font-extrabold tracking-wide">POTONGAN</span>
          <span className="font-num text-[11px] font-extrabold mt-1">Rp</span>
          <span className="font-display font-extrabold text-[26px] leading-none tracking-tight whitespace-nowrap">
            {voucher.discountAmount.toLocaleString("id-ID")}
          </span>
        </div>

        <span aria-hidden="true" className="perforation-v -ml-px" style={{ width: 2 }} />

        {/* Badan: siapa, apa, kode */}
        <div className="flex-1 min-w-0 p-3 space-y-1.5">
          <div>
            <p className="text-sm font-extrabold text-alabaster leading-snug line-clamp-2">{voucher.merchantName}</p>
            <p className="text-xs text-pebble mt-0.5 line-clamp-1">{voucher.discountTitle}</p>
          </div>

          <p className="text-[11px] text-pebble font-num leading-snug">
            Min. belanja {formatRupiah(voucher.minimumSpend)}
            <br />
            {formatExpiry(voucher.expiresAt)}
          </p>

          <div className="flex items-center gap-1">
            <span className="font-num text-[13px] font-extrabold tracking-wider text-vibeSecondary bg-obsidian rounded-xl px-2.5 py-1.5">
              {voucher.code}
            </span>
            <button
              type="button"
              onClick={onCopy}
              aria-label={`Salin kode ${voucher.code}`}
              className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-pebble hover:bg-slateElev transition-colors"
            >
              <Icon name={copied ? "check" : "copy"} size={18} className={copied ? "text-quotaSafe" : ""} />
            </button>
          </div>

          {active ? (
            <>
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                aria-expanded={showCode}
                className="btn-tactile-primary min-h-[44px] px-4 text-xs inline-flex items-center gap-1.5"
              >
                <Icon name="umkm" size={16} />
                <span>{showCode ? "Tutup kode" : "Tunjukkan ke kasir"}</span>
              </button>
              {showCode && (
                <div className="rounded-xl bg-obsidian p-3 flex items-center gap-3">
                  <QrCodeSvg value={voucher.code} size={96} label={`QR Voucer ${voucher.code}`} />
                  <div className="min-w-0 space-y-1">
                    <p className="font-num text-xl font-extrabold tracking-wider text-alabaster break-all">{voucher.code}</p>
                    <p className="text-[11px] text-pebble leading-snug">
                      Tunjukkan QR atau kode ini ke kasir {voucher.merchantName} untuk dipindai atau dimasukkan. Berlaku sekali pakai.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : expired ? (
            <p className="text-xs font-extrabold text-pebble flex items-center gap-1.5 min-h-[44px]">
              <Icon name="alert" size={16} />
              <span>Kedaluwarsa, tidak bisa ditukar lagi</span>
            </p>
          ) : (
            <p className="text-xs font-extrabold text-pebble flex items-center gap-1.5 min-h-[44px]">
              <Icon name="seal" size={16} />
              <span>Sudah ditebus {formatWhen(voucher.redeemedAt)}</span>
            </p>
          )}
        </div>
      </div>
    </motion.li>
  );
}

function PassTicket({ pass, index, vibe = "majapahit" }: { pass: ReservationPass; index: number; vibe?: CulturalVibe }) {
  const checkedIn = pass.status === "CHECKED_IN";
  return (
    <motion.li {...itemMotion(index)} className="ticket-shadow list-none">
      <div className="ticket-cut-h relative rounded-2xl overflow-hidden border border-stoneSubtle">
        <NusantaraPatternStrip vibe={vibe} height={12} />
        <div className="tumpal-edge" aria-hidden="true" />

        <div className="px-4 pt-3.5 pb-4 space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold text-vibePrimary">Tiket masuk</p>
              <h3 className="font-display text-lg font-extrabold text-alabaster leading-snug">
                {pass.spotName}
              </h3>
            </div>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1 rounded-full ${
                checkedIn ? "bg-quotaSafe/15 text-quotaSafe" : "bg-vibePrimary/10 text-[var(--vibe-primary-lip)]"
              }`}
            >
              <Icon name={checkedIn ? "check" : "ticket"} size={14} />
              {checkedIn ? "Sudah masuk" : "Terjadwal"}
            </span>
          </div>

          <div className="grid grid-cols-[1.4fr_1fr] gap-3 items-end">
            <div>
              <p className="text-[11px] font-bold text-pebble">Jam masuk</p>
              <p className="font-num text-[26px] leading-none font-extrabold text-alabaster mt-1">
                {pass.scheduledSlot}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-pebble">Rombongan</p>
              <p className="font-num text-base font-extrabold text-alabaster mt-1 flex items-center gap-1.5">
                <Icon name="users" size={16} className="text-vibePrimary" />
                {pass.partySize} orang
              </p>
            </div>
          </div>

          <p className="text-xs text-pebble">
            Atas nama <strong className="text-alabaster">{pass.visitorName}</strong>
            {pass.circularQuestAccepted && " · Misi Sirkular UMKM diikuti"}
          </p>
        </div>

        <div aria-hidden="true" className="perforation-h h-[6px] mx-5" style={{ marginTop: -2 }} />

        <div className="px-4 pt-3 pb-4 flex items-center gap-3.5">
          <QrCodeSvg value={pass.ticketId} size={84} label={`QR E-Ticket ${pass.ticketId}`} />
          <div className="min-w-0">
            <p className="font-num text-xs font-extrabold tracking-[0.18em] text-alabaster break-all">
              {pass.ticketId}
            </p>
            <p className="text-[11px] text-pebble mt-0.5">Tunjukkan QR atau kode ini ke petugas gerbang.</p>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

function LoreCollectible({ card, index, vibe = "majapahit" }: { card: UnlockedLoreCard; index: number; vibe?: CulturalVibe }) {
  const [open, setOpen] = useState(false);
  const acc = Math.round(card.confidenceScore * 100);
  return (
    <motion.li {...itemMotion(index)} className="ticket-shadow list-none">
      <article className="relative rounded-2xl overflow-hidden border border-stoneSubtle bg-basalt">
        <BatikWatermark vibe={vibe} />
        <RegionCoverBanner
          vibe={vibe}
          imageSrc={REGION_COVER_IMAGE[vibe]}
          compact
          as="h3"
          eyebrow={card.opkCategory}
          title={card.objectName}
          className="rounded-none border-0 border-b border-stoneSubtle"
          rightSlot={
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold bg-basalt text-alabaster rounded-full px-2.5 py-1 shadow-sm">
              <Icon name="seal" size={14} className="text-vibePrimary" />
              <span className="font-num">{acc}%</span>
            </span>
          }
        />

        <div className="relative p-4 space-y-2.5">
          <NusantaraCornerFrame size={18} />
          <div className="relative z-10 flex items-start justify-between gap-2.5">
            <p className={`font-serif text-sm text-alabaster leading-relaxed flex-1 ${open ? "" : "line-clamp-3"}`}>
              {card.story}
            </p>
            <PrasastiSeal size={42} accuracyPct={acc} />
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="min-h-[44px] -ml-1 px-1 text-xs font-extrabold text-vibePrimary inline-flex items-center gap-1"
          >
            {open ? "Ringkas" : "Baca selengkapnya"}
            <Icon name={open ? "up" : "down"} size={14} weight="bold" />
          </button>
          <div className="pt-2 border-t border-stoneSubtle flex items-center justify-between gap-2 text-[11px] text-pebble">
            <span className="min-w-0 truncate">Sumber: {card.verifiedSource}</span>
            <span className="shrink-0 font-bold text-vibeSecondary">{formatWhen(card.unlockedAt)}</span>
          </div>
        </div>
      </article>
    </motion.li>
  );
}

export default function VoucherWalletSheet({
  isOpen,
  onClose,
  activeVibe = "majapahit",
  lokaPoints,
  vouchers,
  reservations,
  loreCards,
  onOpenScanner,
  onOpenBoard,
}: VoucherWalletSheetProps) {
  const [activeTab, setActiveTab] = useState<WalletTab>("VOUCHERS");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const sortedVouchers = useMemo(
    () =>
      [...vouchers].sort((a, b) => {
        const live = (v: IssuedVoucher) => v.status === "ACTIVE" && !isExpired(v.expiresAt);
        if (live(a) !== live(b)) return live(a) ? -1 : 1;
        return b.discountAmount - a.discountAmount;
      }),
    [vouchers]
  );
  const active = vouchers.filter((v) => v.status === "ACTIVE" && !isExpired(v.expiresAt));
  const activeValue = active.reduce((sum, v) => sum + v.discountAmount, 0);

  const counts: Record<WalletTab, number> = {
    VOUCHERS: vouchers.length,
    PASSES: reservations.length,
    LORE: loreCards.length,
  };

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 2000);
  };

  const scanThenClose = () => {
    onClose();
    onOpenScanner?.();
  };

  const boardThenClose = () => {
    onClose();
    onOpenBoard?.();
  };

  const header = (
    <div className="space-y-3">
      <RegionCoverBanner
        vibe={activeVibe}
        imageSrc={FEATURE_COVER_IMAGE.tas}
        compact
        as="h2"
        titleId="wallet-sheet-title"
        title="Tas Petualang"
        subtitle={
          active.length > 0
            ? `${active.length} voucer siap tukar · senilai ${formatRupiah(activeValue)}`
            : "Voucer, E-Ticket, dan kartu kisah budayamu"
        }
        rightSlot={
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-basalt text-xs font-extrabold text-alabaster font-num shadow-sm">
              <Icon name="trophy" size={16} className="text-vibeSecondary" />
              {lokaPoints} XP
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Tas Petualang"
              className="btn-tactile-secondary min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Icon name="close" size={18} weight="bold" />
            </button>
          </div>
        }
      />

      <div role="tablist" aria-label="Isi tas" className="relative flex gap-1 bg-obsidian p-1 rounded-2xl">
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`wallet-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls="wallet-panel"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 min-h-[52px] px-1 rounded-xl text-[11px] sm:text-xs font-extrabold flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 whitespace-nowrap transition-colors ${
                selected ? "text-[var(--vibe-on-primary)]" : "text-pebble hover:text-alabaster"
              }`}
            >
              {selected && (
                <motion.span
                  layoutId="wallet-tab-pill"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-xl bg-vibePrimary shadow-[0_3px_0_0_var(--vibe-primary-lip)]"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                <Icon name={tab.icon} size={18} />
                <span className="hidden min-[360px]:inline sm:inline">{tab.label}</span>
              </span>
              <span className="relative font-num text-[11px]">({counts[tab.id]})</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <Sheet isOpen={isOpen} onClose={onClose} titleId="wallet-sheet-title" header={header}>
      <div id="wallet-panel" role="tabpanel" aria-labelledby={`wallet-tab-${activeTab}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
          >
            {activeTab === "VOUCHERS" &&
              (sortedVouchers.length === 0 ? (
                <EmptyState
                  scene="empty-wallet"
                  vibe={activeVibe}
                  title="Tasmu masih kosong"
                  hint="Pindai artefak budaya atau ikuti Misi Sirkular untuk mendapat voucer UMKM."
                  actionLabel="Scan objek sekarang"
                  onAction={scanThenClose}
                />
              ) : (
                <ul className="space-y-3.5 pt-1">
                  {sortedVouchers.map((v, i) => (
                    <VoucherTicket
                      key={v.code}
                      voucher={v}
                      index={i}
                      copied={copiedCode === v.code}
                      onCopy={() => handleCopyCode(v.code)}
                    />
                  ))}
                </ul>
              ))}

            {activeTab === "PASSES" &&
              (reservations.length === 0 ? (
                <EmptyState
                  scene="empty-wallet"
                  vibe={activeVibe}
                  title="Belum ada E-Ticket"
                  hint="Ambil jadwal masuk dari Papan Antrean atau tombol Tiket di kartu lokasi."
                  actionLabel={onOpenBoard ? "Lihat Papan Antrean" : "Scan objek sekarang"}
                  onAction={onOpenBoard ? boardThenClose : scanThenClose}
                />
              ) : (
                <ul className="space-y-4 pt-1">
                  {reservations.map((p, i) => (
                    <PassTicket key={p.ticketId} pass={p} index={i} vibe={activeVibe} />
                  ))}
                </ul>
              ))}

            {activeTab === "LORE" &&
              (loreCards.length === 0 ? (
                <EmptyState
                  scene="empty-search"
                  vibe={activeVibe}
                  title="Belum ada kartu koleksi"
                  hint="Setiap artefak yang berhasil dipindai membuka satu kartu kisah yang bersumber."
                  actionLabel="Scan objek sekarang"
                  onAction={scanThenClose}
                />
              ) : (
                <ul className="space-y-4 pt-1">
                  {loreCards.map((c, i) => (
                    <LoreCollectible key={c.id} card={c} index={i} vibe={activeVibe} />
                  ))}
                </ul>
              ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </Sheet>
  );
}
