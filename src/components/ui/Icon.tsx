"use client";

import React from "react";
import { motion } from "motion/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  ArrowLeft,
  ArrowUp,
  Backpack,
  Bank,
  BookOpenText,
  Camera,
  CaretDown,
  CaretRight,
  CaretUp,
  CheckCircle,
  CircleNotch,
  Coins,
  Compass,
  Copy,
  Database,
  ForkKnife,
  Hammer,
  MagnifyingGlass,
  MapPin,
  MapTrifold,
  MaskHappy,
  Medal,
  Minus,
  Plus,
  PlusCircle,
  QrCode,
  Scan,
  Scroll,
  SealCheck,
  ShieldCheck,
  SignOut,
  SpeakerHigh,
  Storefront,
  Ticket,
  Trophy,
  TrendUp,
  UploadSimple,
  DownloadSimple,
  User,
  Users,
  Warning,
  X,
} from "@phosphor-icons/react";

// nama bermakna → glyph Phosphor - Satu keluarga, satu ketbalan, biar seragam
const GLYPHS = {
  arrowUp: ArrowUp,
  compass: Compass,
  map: MapTrifold,
  pin: MapPin,
  heritage: Bank,
  sanggar: MaskHappy,
  umkm: Storefront,
  food: ForkKnife,
  camera: Camera,
  scan: Scan,
  story: Scroll,
  speaker: SpeakerHigh,
  ticket: Ticket,
  voucher: Coins,
  bag: Backpack,
  user: User,
  users: Users,
  check: CheckCircle,
  seal: SealCheck,
  trophy: Trophy,
  medal: Medal,
  search: MagnifyingGlass,
  craft: Hammer,
  guide: BookOpenText,
  alert: Warning,
  qr: QrCode,
  shield: ShieldCheck,
  signOut: SignOut,
  trend: TrendUp,
  database: Database,
  close: X,
  plus: Plus,
  plusCircle: PlusCircle,
  minus: Minus,
  copy: Copy,
  upload: UploadSimple,
  download: DownloadSimple,
  back: ArrowLeft,
  down: CaretDown,
  up: CaretUp,
  next: CaretRight,
  loader: CircleNotch,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof GLYPHS;

// none: statis - pop: membesar pas hover - wiggle: goyang kecil pas hover
export type IconMotion = "none" | "pop" | "wiggle" | "spin";

interface IconProps {
  name: IconName;
  size?: number;
  // duotone: dua lapis (bentuk & isian transparan) - bold: aksi kecil kyk tutup/zoom - fill: terpilih
  weight?: "duotone" | "bold" | "fill";
  motion?: IconMotion;
  className?: string;
  // teks alternaatif - Kosongkan kalo ikon cuma dekorasi di samping label
  label?: string;
}

// warna mengikuti currentColor, jadi ikon otomatis ikut palet kawasan & ikut beruubah pas tombol ditekan atw tab aktif
export default function Icon({
  name,
  size = 20,
  weight = "duotone",
  motion: motionKind = "none",
  className = "",
  label,
}: IconProps) {
  const Glyph = GLYPHS[name];
  const a11y = label
    ? ({ role: "img", "aria-label": label } as const)
    : ({ "aria-hidden": true } as const);

  const glyph = <Glyph size={size} weight={weight} />;

  if (motionKind === "none") {
    return (
      <span
        {...a11y}
        className={`inline-flex shrink-0 items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        {glyph}
      </span>
    );
  }

  const variants = {
    // tnpa whileTap: motion otomatis membuat elemen ber-whileTap bisa difokus keyboard (tabindex=0), yg menambah perhentian Tab palsu pd setiap ikon
    pop: { whileHover: { scale: 1.18 } },
    wiggle: { whileHover: { rotate: [0, -12, 10, -6, 0] } },
    spin: { animate: { rotate: 360 } },
  }[motionKind];

  return (
    <motion.span
      {...a11y}
      {...variants}
      transition={
        motionKind === "spin"
          ? { repeat: Infinity, ease: "linear", duration: 0.9 }
          : { type: "spring", stiffness: 520, damping: 14 }
      }
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {glyph}
    </motion.span>
  );
}
