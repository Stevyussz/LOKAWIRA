import React, { useId } from "react";

// Loka, pemandu & maskot LOKAWIRA. Badan = pin lokasi, ujung bawah = titik tepat.
export type LokaMood = "happy" | "curious" | "cheer" | "think";

const INK = "#2A2433";
const CREAM = "#FFFAEE";
const TERRA = "#C8421F";
const TERRA_DEEP = "#8F2C10";
const GOLD = "#F4B63F";
const TEAL = "#1F8A83";
const TEAL_DEEP = "#14625D";

interface LokaProps {
  mood?: LokaMood;
  size?: number;
  // mark = versi ikon kecil (marker, favicon, avatar <= 48 px), full = lengkap dgn lengan & bintang
  variant?: "full" | "mark";
  // kalo diisi, jadi gambar bernama utk pembaca layar. Kosong = dekorasi
  label?: string;
  className?: string;
}

function FullFace({ mood }: { mood: LokaMood }) {
  // mata: bulat biasa, atau lengkung kalo lg senang banget
  const closed = mood === "cheer";
  // arah pandang pupil: curious ke kanan-atas, think ke kiri-atas
  const dx = mood === "curious" ? 5 : mood === "think" ? -5 : 0;
  const dy = mood === "curious" || mood === "think" ? -5 : 0;
  return (
    <>
      <ellipse cx="256" cy="258" rx="116" ry="92" fill={CREAM} stroke={INK} strokeWidth="6" />
      {closed ? (
        <>
          <path d="M178 254 C190 228 218 228 230 254" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
          <path d="M282 254 C294 228 322 228 334 254" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="204" cy="248" rx="27" ry="34" fill={INK} />
          <ellipse cx="308" cy="248" rx="27" ry="34" fill={INK} />
          <circle cx={214 + dx} cy={235 + dy} r="10" fill={CREAM} />
          <circle cx={318 + dx} cy={235 + dy} r="10" fill={CREAM} />
          <circle cx={197 + dx} cy={259 + dy} r="4.5" fill={CREAM} />
          <circle cx={301 + dx} cy={259 + dy} r="4.5" fill={CREAM} />
        </>
      )}
      {mood === "think" && <path d="M170 196 C186 186 210 186 226 194" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />}
      <circle cx="166" cy="292" r="17" fill={GOLD} opacity=".7" />
      <circle cx="346" cy="292" r="17" fill={GOLD} opacity=".7" />
      {mood === "happy" && (
        <path d="M230 292 C242 314 270 314 282 292 C270 298 242 298 230 292 Z" fill={TERRA_DEEP} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      )}
      {mood === "cheer" && (
        <path d="M222 288 C226 326 286 326 290 288 C274 296 238 296 222 288 Z" fill={TERRA_DEEP} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      )}
      {mood === "curious" && <ellipse cx="256" cy="304" rx="12" ry="14" fill={TERRA_DEEP} stroke={INK} strokeWidth="5" />}
      {mood === "think" && <path d="M236 302 C246 296 262 308 276 298" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />}
    </>
  );
}

function MarkFace({ mood }: { mood: LokaMood }) {
  const closed = mood === "cheer";
  return (
    <>
      <ellipse cx="32" cy="31" rx="17" ry="13" fill={CREAM} stroke={INK} strokeWidth="2" />
      {closed ? (
        <>
          <path d="M21.5 31 C23 27.5 27.5 27.5 29 31" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <path d="M35 31 C36.5 27.5 41 27.5 42.5 31" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="25.5" cy="30" rx="2.6" ry="3.4" fill={INK} />
          <ellipse cx="38.5" cy="30" rx="2.6" ry="3.4" fill={INK} />
        </>
      )}
      {mood === "curious" ? (
        <ellipse cx="32" cy="37.5" rx="2" ry="2.4" fill={INK} />
      ) : mood === "think" ? (
        <path d="M28.5 37.5 L35.5 37" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M28.5 36.5 C30.5 39 33.5 39 35.5 36.5" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      )}
    </>
  );
}

export default function Loka({ mood = "happy", size = 64, variant = "full", label, className }: LokaProps) {
  const uid = useId().replace(/:/g, "");
  const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };

  if (variant === "mark") {
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} className={className} {...a11y}>
        <path d="M32 62 C32 62 8 40 8 26 A24 24 0 0 1 56 26 C56 40 32 62 32 62 Z" fill={TERRA} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
        <MarkFace mood={mood} />
        <path d="M8.5 23 C9 8 55 8 55.5 23 C46 16.5 18 16.5 8.5 23 Z" fill={TEAL} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M30 13 C28.5 7 33 3.5 38 1.5 C38 6 39 10 38 13.5 Z" fill={TEAL} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }

  const pin = "M256 476 C256 476 104 336 104 222 A152 152 0 0 1 408 222 C408 336 256 476 256 476 Z";
  const band = "M112 214 C116 128 396 128 400 214 C346 184 166 184 112 214 Z";
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} {...a11y}>
      <defs>
        <clipPath id={`${uid}-body`}><path d={pin} /></clipPath>
        <clipPath id={`${uid}-band`}><path d={band} /></clipPath>
      </defs>
      <ellipse cx="256" cy="490" rx="76" ry="11" fill={INK} opacity=".16" />
      <g stroke={INK} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M110 306 C72 300 52 268 62 240 C98 246 120 272 122 306 Z" fill={TEAL} />
        <path d="M70 250 C88 262 104 280 112 300" fill="none" strokeWidth="4" opacity=".55" />
        <path d="M402 306 C440 300 460 268 450 240 C414 246 392 272 390 306 Z" fill={TEAL} />
        <path d="M442 250 C424 262 408 280 400 300" fill="none" strokeWidth="4" opacity=".55" />
      </g>
      <path d={pin} fill={TERRA} />
      <g clipPath={`url(#${uid}-body)`}>
        <ellipse cx="404" cy="300" rx="120" ry="230" fill={TERRA_DEEP} opacity=".55" />
        <path d="M150 360 L256 250 L362 360 L256 470 Z" fill={GOLD} opacity=".16" />
        <path d="M136 200 C140 160 168 128 206 116" fill="none" stroke={GOLD} strokeWidth="12" strokeLinecap="round" opacity=".55" />
      </g>
      <path d={pin} fill="none" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
      <FullFace mood={mood} />
      <path d="M232 150 C226 114 246 80 284 44 C292 84 300 120 290 150 Z" fill={TEAL} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <path d="M258 140 C256 112 268 86 284 62" fill="none" stroke={GOLD} strokeWidth="7" strokeLinecap="round" />
      <path d={band} fill={TEAL} />
      <g clipPath={`url(#${uid}-band)`} fill="none" stroke={TEAL_DEEP} strokeWidth="9" strokeLinecap="round">
        <path d="M150 232 L196 120" /><path d="M200 232 L246 120" /><path d="M250 232 L296 120" /><path d="M300 232 L346 120" /><path d="M350 232 L396 120" />
      </g>
      <path d={band} fill="none" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <circle cx="256" cy="176" r="12" fill={GOLD} stroke={INK} strokeWidth="5" />
      <circle cx="256" cy="176" r="4" fill={TERRA} />
      <path d="M256 360 L267 388 L295 398 L267 408 L256 436 L245 408 L217 398 L245 388 Z" fill={GOLD} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
    </svg>
  );
}
