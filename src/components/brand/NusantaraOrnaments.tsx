import React, { useId } from "react";
import { REGION_COVER_IMAGE } from "@/lib/spotMeta";
import type { CulturalVibe } from "@/types/lokawira";

/**
 * Definisi motif batik & wastra Nusantara presisi tinggi (seamless horizontal tile).
 * Setiap motif mengacu pada geometri klasik:
 * - majapahit : Batik Kawung Ceplok & Surya Majapahit (kelopak 4 arah + cecek + bintang 8 penjuru)
 * - sogan     : Batik Parang Rusak Barong & Mlinjon (kurva S 45° bersambung ganda + belah ketupat)
 * - bahari    : Batik Mega Mendung Cirebon (awan berundak 4 lapis kurva Bézier halus)
 * - tridatu   : Wastra Songket & Pucuk Rebung / Tumpal Bali (tumpal bertingkat + geringsing emas)
 * - ukiran    : Ukiran Pa'barre Allo Toraja & Sulur Daun Labako Jember (roset surya + spiral ukel)
 */
function PatternDefs({ pid, vibe, scale = 1 }: { pid: string; vibe: CulturalVibe; scale?: number }) {
  const xform = scale !== 1 ? `scale(${scale})` : undefined;
  return (
    <defs>
      {vibe === "majapahit" && (
        <pattern id={pid} width="48" height="20" patternUnits="userSpaceOnUse" patternTransform={xform}>
          <rect width="48" height="20" fill="var(--vibe-surface-tint)" />
          {/* Garis pinggir keraton */}
          <line x1="0" y1="1" x2="48" y2="1" stroke="var(--vibe-primary)" strokeOpacity="0.45" strokeWidth="0.9" />
          <line x1="0" y1="19" x2="48" y2="19" stroke="var(--vibe-primary)" strokeOpacity="0.45" strokeWidth="0.9" />

          {/* Kawung utama (4 kelopak vesica simetris) di x=24 */}
          <g fill="var(--vibe-primary)" fillOpacity="0.78" stroke="var(--bg-basalt-card)" strokeWidth="0.7">
            <path d="M24,10 C21.2,7.2 21.2,3.6 24,2.2 C26.8,3.6 26.8,7.2 24,10 Z" />
            <path d="M24,10 C21.2,12.8 21.2,16.4 24,17.8 C26.8,16.4 26.8,12.8 24,10 Z" />
            <path d="M24,10 C20.2,7.4 16,7.4 14.2,10 C16,12.6 20.2,12.6 24,10 Z" />
            <path d="M24,10 C27.8,7.4 32,7.4 33.8,10 C32,12.6 27.8,12.6 24,10 Z" />
          </g>
          {/* Isen-isen / cecek di dalam tiap kelopak Kawung */}
          <g fill="var(--bg-basalt-card)" fillOpacity="0.9">
            <circle cx="24" cy="5.1" r="0.85" />
            <circle cx="24" cy="14.9" r="0.85" />
            <circle cx="18.2" cy="10" r="0.85" />
            <circle cx="29.8" cy="10" r="0.85" />
          </g>
          {/* Inti Surya Majapahit 8-penjuru */}
          <polygon
            points="24,6.8 25.1,8.8 27.2,10 25.1,11.2 24,13.2 22.9,11.2 20.8,10 22.9,8.8"
            fill="var(--vibe-accent)"
            stroke="var(--vibe-primary-lip)"
            strokeWidth="0.55"
          />
          <circle cx="24" cy="10" r="1.15" fill="var(--bg-basalt-card)" />

          {/* Pengisi sudut & sambungan seamless di x=0 dan x=48 */}
          <g fill="var(--vibe-primary)" fillOpacity="0.55">
            <path d="M0,10 C3.5,7.6 6.8,7.6 8.4,10 C6.8,12.4 3.5,12.4 0,10 Z" />
            <path d="M48,10 C44.5,7.6 41.2,7.6 39.6,10 C41.2,12.4 44.5,12.4 48,10 Z" />
            <polygon points="0,7.4 2.4,10 0,12.6" fill="var(--vibe-accent)" />
            <polygon points="48,7.4 45.6,10 48,12.6" fill="var(--vibe-accent)" />
          </g>
          {/* Tumpal / isen-isen penghubung */}
          <g fill="var(--vibe-secondary)" fillOpacity="0.65">
            <polygon points="11.5,3 13.5,5.2 11.5,7.4 9.5,5.2" />
            <polygon points="11.5,12.6 13.5,14.8 11.5,17 9.5,14.8" />
            <polygon points="36.5,3 38.5,5.2 36.5,7.4 34.5,5.2" />
            <polygon points="36.5,12.6 38.5,14.8 36.5,17 34.5,14.8" />
          </g>
        </pattern>
      )}

      {vibe === "sogan" && (
        <pattern id={pid} width="48" height="20" patternUnits="userSpaceOnUse" patternTransform={xform}>
          <rect width="48" height="20" fill="var(--vibe-surface-tint)" />
          <line x1="0" y1="1" x2="48" y2="1" stroke="var(--vibe-primary)" strokeOpacity="0.45" strokeWidth="0.9" />
          <line x1="0" y1="19" x2="48" y2="19" stroke="var(--vibe-primary)" strokeOpacity="0.45" strokeWidth="0.9" />

          {/* Parang Rusak: bilah S diagonal 45° ganda dengan highlight lontar */}
          {[-12, 12, 36].map((ox) => (
            <g key={ox} transform={`translate(${ox},0)`}>
              {/* Bilah luar Sogan */}
              <path
                d="M0,19.5 C4,15 7,12 10.5,8.5 C14,5 17,3.5 21,0.5"
                fill="none"
                stroke="var(--vibe-primary)"
                strokeWidth="4.4"
                strokeLinecap="round"
                strokeOpacity="0.82"
              />
              {/* Tulang tengah terang (khas batik tulis parang) */}
              <path
                d="M0.4,19.1 C4.2,14.8 7.2,11.8 10.5,8.5 C13.8,5.2 16.8,3.6 20.6,0.9"
                fill="none"
                stroke="var(--bg-basalt-card)"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeOpacity="0.9"
              />
              {/* Lengkung ujung parang (ukel) */}
              <path
                d="M11.5,18.5 C14.8,14.5 17.5,12.5 20.5,10"
                fill="none"
                stroke="var(--vibe-secondary)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeOpacity="0.7"
              />
              {/* Mlinjon (belah ketupat emas di antara bilah) */}
              <polygon
                points="17.5,13 20.2,15.4 17.5,17.8 14.8,15.4"
                fill="var(--vibe-accent)"
                stroke="var(--vibe-primary-lip)"
                strokeWidth="0.6"
              />
              <circle cx="17.5" cy="15.4" r="0.85" fill="var(--vibe-primary-lip)" />
              {/* Cecek 3 titik */}
              <circle cx="5.2" cy="5.5" r="0.85" fill="var(--vibe-accent)" />
              <circle cx="7.4" cy="3.8" r="0.7" fill="var(--vibe-primary)" fillOpacity="0.75" />
            </g>
          ))}
        </pattern>
      )}

      {vibe === "bahari" && (
        <pattern id={pid} width="64" height="20" patternUnits="userSpaceOnUse" patternTransform={xform}>
          <rect width="64" height="20" fill="var(--vibe-surface-tint)" />
          <line x1="0" y1="1" x2="64" y2="1" stroke="var(--vibe-primary)" strokeOpacity="0.4" strokeWidth="0.9" />
          <line x1="0" y1="19" x2="64" y2="19" stroke="var(--vibe-primary)" strokeOpacity="0.4" strokeWidth="0.9" />

          {/* Mega Mendung Cirebon: 3 lapisan awan berundak dengan lengkung khas */}
          {/* Lapisan 1 (luar, teal primer) */}
          <path
            d="M0,16 C6,16 9,12.5 13,9.2 C16.5,6.2 21,3.2 26,4.2 C29.5,4.9 30.5,7.2 32,7.2 C33.5,7.2 34.5,4.9 38,4.2 C43,3.2 47.5,6.2 51,9.2 C55,12.5 58,16 64,16"
            fill="none"
            stroke="var(--vibe-primary)"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeOpacity="0.85"
          />
          {/* Lapisan 2 (tengah, biru bahari sekunder) */}
          <path
            d="M4,17.4 C10,17.2 13,14 16.8,11.2 C20,8.8 23.2,6.8 27,7.6 C29.5,8.1 30.6,9.8 32,9.8 C33.4,9.8 34.5,8.1 37,7.6 C40.8,6.8 44,8.8 47.2,11.2 C51,14 54,17.2 60,17.4"
            fill="none"
            stroke="var(--vibe-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeOpacity="0.82"
          />
          {/* Lapisan 3 (inti, koral keemasan) */}
          <path
            d="M11,17.8 C16,17 19,14.6 22.5,12.8 C25.5,11.2 28.5,11 32,12.6 C35.5,11 38.5,11.2 41.5,12.8 C45,14.6 48,17 53,17.8"
            fill="none"
            stroke="var(--vibe-accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Awan pendamping atas untuk keseimbangan komposisi */}
          <path
            d="M0,7.5 C3.5,6.5 6.5,4 11,4.5 C8.5,6.5 5.5,8.5 0,9.5"
            fill="none"
            stroke="var(--vibe-accent)"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeOpacity="0.85"
          />
          <path
            d="M64,7.5 C60.5,6.5 57.5,4 53,4.5 C55.5,6.5 58.5,8.5 64,9.5"
            fill="none"
            stroke="var(--vibe-accent)"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeOpacity="0.85"
          />
          <circle cx="32" cy="15.8" r="1.25" fill="var(--vibe-primary)" fillOpacity="0.7" />
        </pattern>
      )}

      {vibe === "tridatu" && (
        <pattern id={pid} width="48" height="20" patternUnits="userSpaceOnUse" patternTransform={xform}>
          {/* Pita wastra Tridatu: merah, lontar, arang */}
          <rect width="48" height="20" fill="var(--bg-basalt-card)" />
          <rect y="0" width="48" height="3.2" fill="var(--vibe-primary)" fillOpacity="0.86" />
          <rect y="16.8" width="48" height="3.2" fill="#2A2433" fillOpacity="0.84" />
          <rect y="4.2" width="48" height="11.6" fill="var(--vibe-surface-tint)" />

          {/* Pucuk Rebung (Tumpal) & Geringsing Songket emas */}
          {[0, 24].map((ox) => (
            <g key={ox} transform={`translate(${ox},0)`}>
              {/* Belah ketupat Songket ganda */}
              <polygon
                points="12,3.4 20.2,10 12,16.6 3.8,10"
                fill="var(--vibe-primary)"
                fillOpacity="0.85"
                stroke="var(--vibe-accent)"
                strokeWidth="1"
              />
              <polygon
                points="12,6.2 16.4,10 12,13.8 7.6,10"
                fill="var(--vibe-accent)"
                fillOpacity="0.95"
              />
              <polygon points="12,8.1 14,10 12,11.9 10,10" fill="var(--bg-basalt-card)" />
              {/* Pucuk tumpal kiri-kanan */}
              <polygon points="0,5.2 3.2,10 0,14.8" fill="#2A2433" fillOpacity="0.72" />
              <polygon points="24,5.2 20.8,10 24,14.8" fill="#2A2433" fillOpacity="0.72" />
              {/* Titik benang emas songket */}
              <circle cx="5.2" cy="5.5" r="0.85" fill="var(--vibe-accent)" />
              <circle cx="18.8" cy="5.5" r="0.85" fill="var(--vibe-accent)" />
              <circle cx="5.2" cy="14.5" r="0.85" fill="var(--vibe-accent)" />
              <circle cx="18.8" cy="14.5" r="0.85" fill="var(--vibe-accent)" />
            </g>
          ))}
        </pattern>
      )}

      {vibe === "ukiran" && (
        <pattern id={pid} width="56" height="20" patternUnits="userSpaceOnUse" patternTransform={xform}>
          <rect width="56" height="20" fill="var(--vibe-surface-tint)" />
          <line x1="0" y1="1" x2="56" y2="1" stroke="var(--vibe-primary)" strokeOpacity="0.45" strokeWidth="0.9" />
          <line x1="0" y1="19" x2="56" y2="19" stroke="var(--vibe-primary)" strokeOpacity="0.45" strokeWidth="0.9" />

          {/* Pa'barre Allo (Roset Surya Ukiran Toraja) di x=28 */}
          <g transform="translate(28,10)">
            <circle r="6.8" fill="var(--vibe-primary)" fillOpacity="0.18" stroke="var(--vibe-primary)" strokeWidth="1.1" />
            <polygon
              points="0,-6.4 1.6,-2.2 6.4,0 1.6,2.2 0,6.4 -1.6,2.2 -6.4,0 -1.6,-2.2"
              fill="var(--vibe-primary)"
              fillOpacity="0.85"
            />
            <polygon
              points="0,-3.6 1,-1 3.6,0 1,1 0,3.6 -1,1 -3.6,0 -1,-1"
              fill="var(--vibe-accent)"
            />
            <circle r="1.2" fill="var(--bg-basalt-card)" />
          </g>

          {/* Sulur Ukel & Daun Tembakau (Labako) simetris kiri-kanan */}
          <path
            d="M4,15 C9,14 14,9 18.5,5.5 C15,11.5 11.5,15.5 4,15 Z"
            fill="var(--vibe-primary)"
            fillOpacity="0.72"
          />
          <path d="M6,14 C10.5,12 14,9.5 17,6.8" fill="none" stroke="var(--vibe-accent)" strokeWidth="1" strokeLinecap="round" />
          <path
            d="M52,15 C47,14 42,9 37.5,5.5 C41,11.5 44.5,15.5 52,15 Z"
            fill="var(--vibe-primary)"
            fillOpacity="0.72"
          />
          <path d="M50,14 C45.5,12 42,9.5 39,6.8" fill="none" stroke="var(--vibe-accent)" strokeWidth="1" strokeLinecap="round" />

          {/* Spiral ukel pengunci di x=0/56 */}
          <path
            d="M0,6 C3.5,6 5.5,8 4.8,10.2 C4.2,12 1.8,12.2 1.4,10.5"
            fill="none"
            stroke="var(--vibe-primary)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M56,6 C52.5,6 50.5,8 51.2,10.2 C51.8,12 54.2,12.2 54.6,10.5"
            fill="none"
            stroke="var(--vibe-primary)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="12" cy="5.2" r="1.15" fill="var(--vibe-accent)" />
          <circle cx="44" cy="5.2" r="1.15" fill="var(--vibe-accent)" />
        </pattern>
      )}
    </defs>
  );
}

export function NusantaraPatternStrip({
  vibe = "majapahit",
  height = 18,
  className = "",
}: {
  vibe?: CulturalVibe;
  height?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const pid = `lkw-pat-${vibe}-${uid}`;
  return (
    <svg aria-hidden="true" className={`w-full block ${className}`} style={{ height }} preserveAspectRatio="none">
      <PatternDefs pid={pid} vibe={vibe} scale={height / 20} />
      <rect width="100%" height="100%" fill={`url(#${pid})`} />
    </svg>
  );
}

/**
 * Tekstur batik geometris halus berbasis vektor (bukan polkadot) untuk permukaan luas
 * seperti kartu kolektor Kartu Lore atau latar stub voucer.
 */
export function BatikWatermark({
  vibe = "majapahit",
  tone = "vibe",
  className = "",
}: {
  vibe?: CulturalVibe;
  tone?: "vibe" | "light";
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const pid = `lkw-wm-${vibe}-${tone}-${uid}`;
  const strokeMain = tone === "light" ? "#FFF8EC" : "var(--vibe-primary)";
  const accentFill = tone === "light" ? "#FFF8EC" : "var(--vibe-accent)";
  const baseOpacity = tone === "light" ? "opacity-[0.16]" : "opacity-[0.065]";

  return (
    <svg aria-hidden="true" className={`pointer-events-none absolute inset-0 w-full h-full ${baseOpacity} ${className}`}>
      <defs>
        {vibe === "majapahit" && (
          <pattern id={pid} width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M22,22 C17,15 17,6 22,2 C27,6 27,15 22,22 Z" fill="none" stroke={strokeMain} strokeWidth="1.4" />
            <path d="M22,22 C17,29 17,38 22,42 C27,38 27,29 22,22 Z" fill="none" stroke={strokeMain} strokeWidth="1.4" />
            <path d="M22,22 C15,17 6,17 2,22 C6,27 15,27 22,22 Z" fill="none" stroke={strokeMain} strokeWidth="1.4" />
            <path d="M22,22 C29,17 38,17 42,22 C38,27 29,27 22,22 Z" fill="none" stroke={strokeMain} strokeWidth="1.4" />
            <polygon points="22,18 25,22 22,26 19,22" fill={accentFill} />
            <circle cx="22" cy="11" r="1.2" fill={strokeMain} />
            <circle cx="22" cy="33" r="1.2" fill={strokeMain} />
            <circle cx="11" cy="22" r="1.2" fill={strokeMain} />
            <circle cx="33" cy="22" r="1.2" fill={strokeMain} />
          </pattern>
        )}
        {vibe === "sogan" && (
          <pattern id={pid} width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M-4,40 C8,26 16,18 32,-4" fill="none" stroke={strokeMain} strokeWidth="3.2" strokeLinecap="round" />
            <path d="M16,40 C28,26 36,18 52,-4" fill="none" stroke={strokeMain} strokeWidth="3.2" strokeLinecap="round" />
            <polygon points="20,15 24,20 20,25 16,20" fill="none" stroke={accentFill} strokeWidth="1.4" />
            <circle cx="20" cy="20" r="1.5" fill={strokeMain} />
          </pattern>
        )}
        {vibe === "bahari" && (
          <pattern id={pid} width="56" height="32" patternUnits="userSpaceOnUse">
            <path
              d="M0,22 C8,22 12,13 18,9 C23,6 26,9 28,9 C30,9 33,6 38,9 C44,13 48,22 56,22"
              fill="none"
              stroke={strokeMain}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M6,27 C13,26 17,19 22,16 C25,14 27,16 28,16 C29,16 31,14 34,16 C39,19 43,26 50,27"
              fill="none"
              stroke={accentFill}
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </pattern>
        )}
        {vibe === "tridatu" && (
          <pattern id={pid} width="40" height="40" patternUnits="userSpaceOnUse">
            <polygon points="20,3 37,20 20,37 3,20" fill="none" stroke={strokeMain} strokeWidth="1.6" />
            <polygon points="20,10 30,20 20,30 10,20" fill="none" stroke={accentFill} strokeWidth="1.3" />
            <polygon points="20,16 24,20 20,24 16,20" fill={strokeMain} />
          </pattern>
        )}
        {vibe === "ukiran" && (
          <pattern id={pid} width="44" height="44" patternUnits="userSpaceOnUse">
            <circle cx="22" cy="22" r="12" fill="none" stroke={strokeMain} strokeWidth="1.3" />
            <polygon
              points="22,8 25,18 36,22 25,26 22,36 19,26 8,22 19,18"
              fill="none"
              stroke={strokeMain}
              strokeWidth="1.4"
            />
            <circle cx="22" cy="22" r="2.5" fill={accentFill} />
          </pattern>
        )}
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pid})`} />
    </svg>
  );
}

/**
 * Emblem vektor ikonik 5 kawasan Nusantara.
 * Tajam di ukuran kecil (HUD peta 36-40px) maupun besar (kartu kawasan / header).
 */
export function NusantaraEmblem({
  vibe = "majapahit",
  size = 38,
  color,
  accent,
  className = "",
}: {
  vibe?: CulturalVibe;
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}) {
  const cPrimary = color ?? "var(--vibe-primary)";
  const cAccent = accent ?? "var(--vibe-accent)";

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 44 44"
      className={`shrink-0 block ${className}`}
      fill="none"
    >
      {/* Dasar medali prasasti lontar */}
      <circle cx="22" cy="22" r="20.5" fill="var(--bg-basalt-card)" stroke={cPrimary} strokeWidth="2" />
      <circle cx="22" cy="22" r="17" fill={cPrimary} fillOpacity="0.11" stroke={cPrimary} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 2" />

      {vibe === "majapahit" && (
        /* Surya Majapahit 8-sinar & teratai */
        <g>
          <polygon
            points="22,6.5 24.4,15 32.8,11.2 29,19.6 37.5,22 29,24.4 32.8,32.8 24.4,29 22,37.5 19.6,29 11.2,32.8 15,24.4 6.5,22 15,19.6 11.2,11.2 19.6,15"
            fill={cPrimary}
          />
          <circle cx="22" cy="22" r="6.4" fill={cAccent} stroke="var(--bg-basalt-card)" strokeWidth="1.4" />
          <polygon points="22,17.8 23.6,20.4 26.2,22 23.6,23.6 22,26.2 20.4,23.6 17.8,22 20.4,20.4" fill={cPrimary} />
        </g>
      )}

      {vibe === "sogan" && (
        /* Kawung Keraton 4-kelopak & intan mlinjon */
        <g>
          <path d="M22,22 C17.5,16 17.5,10 22,7.5 C26.5,10 26.5,16 22,22 Z" fill={cPrimary} />
          <path d="M22,22 C17.5,28 17.5,34 22,36.5 C26.5,34 26.5,28 22,22 Z" fill={cPrimary} />
          <path d="M22,22 C16,17.5 10,17.5 7.5,22 C10,26.5 16,26.5 22,22 Z" fill={cPrimary} />
          <path d="M22,22 C28,17.5 34,17.5 36.5,22 C34,26.5 28,26.5 22,22 Z" fill={cPrimary} />
          <circle cx="22" cy="12.5" r="1.4" fill="var(--bg-basalt-card)" />
          <circle cx="22" cy="31.5" r="1.4" fill="var(--bg-basalt-card)" />
          <circle cx="12.5" cy="22" r="1.4" fill="var(--bg-basalt-card)" />
          <circle cx="31.5" cy="22" r="1.4" fill="var(--bg-basalt-card)" />
          <polygon points="22,16.5 27.5,22 22,27.5 16.5,22" fill={cAccent} stroke="var(--bg-basalt-card)" strokeWidth="1.2" />
          <circle cx="22" cy="22" r="1.7" fill={cPrimary} />
        </g>
      )}

      {vibe === "bahari" && (
        /* Layar Pinisi di atas awan/ombak Mega Mendung */
        <g>
          {/* Layar Pinisi */}
          <path d="M21,9 L21,25 L11.5,25 C14,19 17.5,13.5 21,9 Z" fill={cPrimary} />
          <path d="M23,11.5 L23,25 L31.5,25 C29.5,20 26.5,15 23,11.5 Z" fill={cAccent} />
          {/* Lambung kapal */}
          <path d="M10.5,26.5 L33.5,26.5 L30,30.5 L14,30.5 Z" fill={cPrimary} />
          {/* Lengkung ombak Mega Mendung */}
          <path
            d="M9.5,33 C13,30.5 16.5,34.5 22,32.5 C27.5,30.5 31,34.5 34.5,32.5"
            stroke={cPrimary}
            strokeWidth="2.1"
            strokeLinecap="round"
          />
        </g>
      )}

      {vibe === "tridatu" && (
        /* Candi Bentar & Padma (Teratai Bali) */
        <g>
          {/* Sayap Candi Bentar kiri-kanan */}
          <path d="M10,33 L18.5,33 L18.5,11 L16,13.5 L16,17 L13.5,19.5 L13.5,24 L10,27.5 Z" fill={cPrimary} />
          <path d="M34,33 L25.5,33 L25.5,11 L28,13.5 L28,17 L30.5,19.5 L30.5,24 L34,27.5 Z" fill={cPrimary} />
          {/* Padma emas di celah gerbang */}
          <polygon points="22,14 24.4,20.5 22,24.5 19.6,20.5" fill={cAccent} />
          <path d="M15.5,33 L28.5,33 L26.5,29.5 L17.5,29.5 Z" fill="#2A2433" />
          <circle cx="22" cy="10" r="1.8" fill={cAccent} />
        </g>
      )}

      {vibe === "ukiran" && (
        /* Atap Tongkonan & Pa'barre Allo */
        <g>
          {/* Atap melengkung Tongkonan */}
          <path d="M7.5,14.5 C12.5,21.5 31.5,21.5 36.5,14.5 C34.5,23 31,26 22,26 C13,26 9.5,23 7.5,14.5 Z" fill={cPrimary} />
          {/* Badan & tiang */}
          <rect x="15.5" y="25.5" width="13" height="6" rx="1" fill={cAccent} stroke={cPrimary} strokeWidth="1.2" />
          <path d="M14,34.5 L30,34.5 M17.5,31.5 L17.5,34.5 M26.5,31.5 L26.5,34.5" stroke={cPrimary} strokeWidth="2" strokeLinecap="round" />
          {/* Surya kecil di puncak */}
          <circle cx="22" cy="12" r="2.6" fill={cAccent} stroke={cPrimary} strokeWidth="1.1" />
        </g>
      )}
    </svg>
  );
}

/**
 * Bingkai sudut ukiran Lung-Lungan / Ukel klasik Nusantara.
 */
export function NusantaraCornerFrame({
  size = 28,
  tone = "vibe",
  className = "",
}: {
  size?: number;
  tone?: "vibe" | "gold";
  className?: string;
}) {
  const strokeCls = tone === "gold" ? "text-[#F6D379] opacity-80" : "text-vibePrimary opacity-60";
  const dotColor = tone === "gold" ? "#FFF8EC" : "var(--vibe-accent)";

  const renderCorner = (posClass: string) => (
    <svg width={size} height={size} viewBox="0 0 36 36" className={`pointer-events-none absolute ${strokeCls} ${posClass}`} fill="none">
      {/* Bingkai siku bertingkat keraton */}
      <path d="M3 32 L3 10 Q3 3 10 3 L32 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 25 L7.5 12.5 Q7.5 7.5 12.5 7.5 L25 7.5" stroke="currentColor" strokeWidth="1.15" strokeOpacity="0.72" strokeLinecap="round" />
      {/* Sulur ukel melengkung di sudut dalam */}
      <path d="M11 20 C11 14.5 14.5 11 20 11 C17.5 11 16 12.5 16 14.2 C16 15.6 17.3 16.4 18.4 15.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {/* Kuncup teratai sudut & titik cecek */}
      <polygon points="7.5,4.2 10.2,7.5 7.5,10.8 4.8,7.5" fill={dotColor} />
      <circle cx="28.5" cy="7.5" r="1.2" fill={dotColor} />
      <circle cx="7.5" cy="28.5" r="1.2" fill={dotColor} />
    </svg>
  );

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {renderCorner("top-2 left-2")}
      {renderCorner("top-2 right-2 -scale-x-100")}
      {renderCorner("bottom-2 left-2 -scale-y-100")}
      {renderCorner("bottom-2 right-2 -scale-x-100 -scale-y-100")}
    </div>
  );
}

/**
 * Garis pemisah elegan dengan medali Gunungan / Kembang Ceplok di tengah.
 */
export function NusantaraDivider({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex items-center gap-2.5 text-vibePrimary ${className}`}>
      <span className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border-stone-strong)] to-vibePrimary/40" />
      <svg width="36" height="14" viewBox="0 0 36 14" fill="none" className="shrink-0">
        <polygon points="4,7 7.5,4.2 11,7 7.5,9.8" fill="var(--vibe-accent)" fillOpacity="0.85" />
        <polygon points="18,1 23,7 18,13 13,7" fill="currentColor" fillOpacity="0.85" />
        <polygon points="18,4 20.5,7 18,10 15.5,7" fill="var(--bg-basalt-card)" />
        <polygon points="25,7 28.5,4.2 32,7 28.5,9.8" fill="var(--vibe-accent)" fillOpacity="0.85" />
      </svg>
      <span className="flex-1 h-px bg-gradient-to-l from-transparent via-[var(--border-stone-strong)] to-vibePrimary/40" />
    </div>
  );
}

/**
 * Stempel Surya Majapahit 12-sinar dengan cincin ganda & isen-isen.
 */
export function PrasastiSeal({
  size = 46,
  accuracyPct,
  className = "",
}: {
  size?: number;
  accuracyPct?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 56 56" width={size} height={size} className="block">
        <polygon
          points="28,2 32,9 39,5 39.5,13 47.5,12.5 44.5,19.8 52.5,23 46.5,28 52.5,33 44.5,36.2 47.5,43.5 39.5,43 39,51 32,47 28,54 24,47 17,51 16.5,43 8.5,43.5 11.5,36.2 3.5,33 9.5,28 3.5,23 11.5,19.8 8.5,12.5 16.5,13 17,5 24,9"
          fill="var(--vibe-accent)"
          fillOpacity="0.32"
          stroke="var(--vibe-primary)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="28" cy="28" r="18.5" fill="var(--bg-basalt-card)" stroke="var(--vibe-primary)" strokeWidth="1.6" />
        <circle cx="28" cy="28" r="15.2" fill="none" stroke="var(--vibe-accent)" strokeWidth="1.2" strokeDasharray="2 2.2" />
      </svg>
      {typeof accuracyPct === "number" ? (
        <span className="absolute inset-0 flex items-center justify-center font-num text-[10px] font-extrabold text-vibePrimary">
          {accuracyPct}%
        </span>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-display text-[10px] font-extrabold tracking-wide text-vibePrimary">
          SAH
        </span>
      )}
    </div>
  );
}

/**
 * Sampul Editorial Nusantara Megah (khusus Halaman Penuh & Sheet Penuh, bukan overlay peta).
 * Menjaga bagian atas ilustrasi tetap cerah & megah, dengan gradasi lembut hanya di bawah
 * agar teks #FFF8EC tetap melampaui kontras WCAG AA 4,5:1.
 */
export function RegionCoverBanner({
  vibe = "majapahit",
  imageSrc,
  eyebrow,
  title,
  subtitle,
  compact = false,
  stripHeight = 16,
  as = "h3",
  titleId,
  rightSlot,
  className = "",
  children,
}: {
  vibe?: CulturalVibe;
  imageSrc?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  compact?: boolean;
  stripHeight?: number;
  as?: "h1" | "h2" | "h3" | "p";
  titleId?: string;
  rightSlot?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const coverSrc = imageSrc ?? REGION_COVER_IMAGE[vibe] ?? REGION_COVER_IMAGE.majapahit;
  const HeadingTag = as;
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-stoneSubtle bg-[#2A2433] shadow-[0_14px_30px_-16px_rgba(74,52,28,0.45)] ${className}`}>
      <div
        className={`relative w-full bg-[#2A2433] ${
          compact ? "min-h-[126px] sm:min-h-[144px]" : "min-h-[168px] sm:min-h-[196px]"
        } flex items-end justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Gradasi cerdas: 42% atas tetap terang agar ilustrasi megah terlihat utuh, 58% bawah hangat gelap demi kontras teks AA */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(42,36,51,0.10) 0%, rgba(42,36,51,0.22) 38%, rgba(42,36,51,0.78) 72%, rgba(34,26,38,0.94) 100%)",
          }}
        />
        <NusantaraCornerFrame size={20} tone="gold" />

        <div className="relative z-10 min-w-0 flex-1 text-left space-y-1">
          {eyebrow && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-vibePrimary text-[10px] font-extrabold tracking-wide text-[var(--vibe-on-primary)] shadow-sm">
              {eyebrow}
            </span>
          )}
          <HeadingTag
            id={titleId}
            className={`font-display font-extrabold text-[#FFF8EC] leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] ${
              as === "h1" ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl"
            }`}
          >
            {title}
          </HeadingTag>
          {subtitle && (
            <p className="text-xs sm:text-[13px] font-medium text-[#FFF8EC]/95 leading-snug line-clamp-2 max-w-2xl">
              {subtitle}
            </p>
          )}
          {children}
        </div>
        {rightSlot && <div className="relative z-10 shrink-0 self-start">{rightSlot}</div>}
      </div>
      <div className="bg-basalt border-t border-stoneSubtle">
        <NusantaraPatternStrip vibe={vibe} height={stripHeight} />
      </div>
    </div>
  );
}
