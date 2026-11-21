import React, { useId } from "react";
import { REGION_COVER_IMAGE } from "@/lib/spotMeta";
import type { CulturalVibe } from "@/types/lokawira";

function PatternDefs({ pid, vibe }: { pid: string; vibe: CulturalVibe }) {
  return (
    <defs>
      {vibe === "majapahit" && (
        /* Batik Kawung & Surya Majapahit */
        <pattern id={pid} width="28" height="14" patternUnits="userSpaceOnUse">
          <rect width="28" height="14" fill="var(--vibe-primary)" fillOpacity="0.16" />
          <g fill="var(--vibe-primary)" fillOpacity="0.72">
            <ellipse cx="14" cy="3.2" rx="2.6" ry="1.8" />
            <ellipse cx="14" cy="10.8" rx="2.6" ry="1.8" />
            <ellipse cx="9.2" cy="7" rx="2.2" ry="1.6" />
            <ellipse cx="18.8" cy="7" rx="2.2" ry="1.6" />
          </g>
          <polygon points="14,4.2 15.2,6.2 17,7 15.2,7.8 14,9.8 12.8,7.8 11,7 12.8,6.2" fill="var(--vibe-accent)" />
          <circle cx="0" cy="7" r="2.2" fill="var(--vibe-accent)" fillOpacity="0.7" />
          <circle cx="28" cy="7" r="2.2" fill="var(--vibe-accent)" fillOpacity="0.7" />
          <line x1="0" y1="0.8" x2="28" y2="0.8" stroke="var(--vibe-primary)" strokeOpacity="0.35" strokeWidth="1" />
        </pattern>
      )}
      {vibe === "sogan" && (
        /* Batik Parang Rusak diagonal & mlinjon */
        <pattern id={pid} width="28" height="14" patternUnits="userSpaceOnUse">
          <rect width="28" height="14" fill="var(--vibe-primary)" fillOpacity="0.14" />
          <path d="M-2,14 C3,8 7,6 12,0" fill="none" stroke="var(--vibe-primary)" strokeWidth="3.2" strokeLinecap="round" strokeOpacity="0.76" />
          <path d="M12,14 C17,8 21,6 26,0" fill="none" stroke="var(--vibe-primary)" strokeWidth="3.2" strokeLinecap="round" strokeOpacity="0.76" />
          <path d="M5,14 C10,9 14,6 19,0" fill="none" stroke="var(--vibe-accent)" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.85" />
          <path d="M19,14 C24,9 28,6 33,0" fill="none" stroke="var(--vibe-accent)" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.85" />
          <polygon points="7,2.5 9,4.5 7,6.5 5,4.5" fill="var(--vibe-secondary)" fillOpacity="0.82" />
          <polygon points="21,8 23,10 21,12 19,10" fill="var(--vibe-secondary)" fillOpacity="0.82" />
        </pattern>
      )}
      {vibe === "bahari" && (
        /* Batik Mega Mendung berombak */
        <pattern id={pid} width="36" height="14" patternUnits="userSpaceOnUse">
          <rect width="36" height="14" fill="var(--vibe-primary)" fillOpacity="0.14" />
          <path d="M0,11 Q4.5,2 9,7 Q13.5,11 18,5 Q22.5,2 27,7 Q31.5,11 36,6" fill="none" stroke="var(--vibe-primary)" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M0,13 Q4.5,5 9,10 Q13.5,13 18,8 Q22.5,5 27,10 Q31.5,13 36,9" fill="none" stroke="var(--vibe-accent)" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.9" />
          <circle cx="9" cy="3.5" r="1.3" fill="var(--vibe-primary)" fillOpacity="0.65" />
          <circle cx="27" cy="3.5" r="1.3" fill="var(--vibe-primary)" fillOpacity="0.65" />
        </pattern>
      )}
      {vibe === "tridatu" && (
        /* Tenun Ikat & Tumpal Bali */
        <pattern id={pid} width="24" height="14" patternUnits="userSpaceOnUse">
          <rect width="24" height="4.5" fill="var(--vibe-primary)" fillOpacity="0.72" />
          <rect y="4.5" width="24" height="5" fill="var(--bg-basalt-card)" />
          <rect y="9.5" width="24" height="4.5" fill="#2A2433" fillOpacity="0.78" />
          <polygon points="12,1 18,7 12,13 6,7" fill="var(--vibe-accent)" fillOpacity="0.9" />
          <polygon points="12,3.5 14.5,7 12,10.5 9.5,7" fill="var(--bg-basalt-card)" />
          <polygon points="0,1 3,7 0,13" fill="var(--vibe-accent)" fillOpacity="0.72" />
          <polygon points="24,1 21,7 24,13" fill="var(--vibe-accent)" fillOpacity="0.72" />
        </pattern>
      )}
      {vibe === "ukiran" && (
        /* Batik Daun Tembakau (Labako Jember) & Ukiran Sulur */
        <pattern id={pid} width="32" height="14" patternUnits="userSpaceOnUse">
          <rect width="32" height="14" fill="var(--vibe-primary)" fillOpacity="0.14" />
          <path d="M5,11 Q13,2 22,5 Q15,12 5,11 Z" fill="var(--vibe-primary)" fillOpacity="0.68" />
          <path d="M7,9.8 Q14,6.2 20,5.5" fill="none" stroke="var(--vibe-accent)" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M23,11 C26,11 29,8 29,5 C29,3 26.5,2.5 26,4.5" fill="none" stroke="var(--vibe-primary)" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="27" cy="9.5" r="1.6" fill="var(--vibe-accent)" />
          <circle cx="2.5" cy="4.5" r="1.4" fill="var(--vibe-accent)" fillOpacity="0.8" />
        </pattern>
      )}
    </defs>
  );
}

export function NusantaraPatternStrip({
  vibe = "majapahit",
  height = 14,
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
      <PatternDefs pid={pid} vibe={vibe} />
      <rect width="100%" height="100%" fill={`url(#${pid})`} />
    </svg>
  );
}

export function BatikWatermark({
  vibe = "majapahit",
  className = "",
}: {
  vibe?: CulturalVibe;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const pid = `lkw-wm-${vibe}-${uid}`;
  return (
    <svg aria-hidden="true" className={`pointer-events-none absolute inset-0 w-full h-full opacity-[0.08] ${className}`}>
      <defs>
        {vibe === "majapahit" && (
          <pattern id={pid} width="40" height="40" patternUnits="userSpaceOnUse">
            <ellipse cx="20" cy="8" rx="5" ry="3.5" fill="var(--vibe-primary)" />
            <ellipse cx="20" cy="32" rx="5" ry="3.5" fill="var(--vibe-primary)" />
            <ellipse cx="8" cy="20" rx="3.5" ry="5" fill="var(--vibe-primary)" />
            <ellipse cx="32" cy="20" rx="3.5" ry="5" fill="var(--vibe-primary)" />
            <circle cx="20" cy="20" r="3" fill="var(--vibe-accent)" />
          </pattern>
        )}
        {vibe === "sogan" && (
          <pattern id={pid} width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M-4,36 C8,22 14,14 28,-4" fill="none" stroke="var(--vibe-primary)" strokeWidth="4" strokeLinecap="round" />
            <path d="M14,36 C26,22 32,14 46,-4" fill="none" stroke="var(--vibe-primary)" strokeWidth="4" strokeLinecap="round" />
            <polygon points="18,14 22,18 18,22 14,18" fill="var(--vibe-accent)" />
          </pattern>
        )}
        {vibe === "bahari" && (
          <pattern id={pid} width="48" height="28" patternUnits="userSpaceOnUse">
            <path d="M0,18 Q12,4 24,14 T48,18" fill="none" stroke="var(--vibe-primary)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M0,24 Q12,10 24,20 T48,24" fill="none" stroke="var(--vibe-accent)" strokeWidth="2" strokeLinecap="round" />
          </pattern>
        )}
        {vibe === "tridatu" && (
          <pattern id={pid} width="36" height="36" patternUnits="userSpaceOnUse">
            <polygon points="18,2 34,18 18,34 2,18" fill="none" stroke="var(--vibe-primary)" strokeWidth="2.2" />
            <polygon points="18,10 26,18 18,26 10,18" fill="var(--vibe-accent)" />
          </pattern>
        )}
        {vibe === "ukiran" && (
          <pattern id={pid} width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M8,32 Q20,10 36,16 Q24,34 8,32 Z" fill="var(--vibe-primary)" />
            <circle cx="14" cy="14" r="2.5" fill="var(--vibe-accent)" />
            <circle cx="34" cy="34" r="2.5" fill="var(--vibe-accent)" />
          </pattern>
        )}
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pid})`} />
    </svg>
  );
}

export function NusantaraCornerFrame({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const cornerPath = "M2 22 L2 8 Q2 2 8 2 L22 2 M6 15 Q6 6 15 6";
  const dot = <circle cx="5.5" cy="5.5" r="1.8" fill="var(--vibe-accent)" />;
  const cls = "pointer-events-none absolute text-vibePrimary opacity-65";
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <svg width={size} height={size} viewBox="0 0 24 24" className={`${cls} top-2 left-2`} fill="none">
        <path d={cornerPath} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        {dot}
      </svg>
      <svg width={size} height={size} viewBox="0 0 24 24" className={`${cls} top-2 right-2 -scale-x-100`} fill="none">
        <path d={cornerPath} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        {dot}
      </svg>
      <svg width={size} height={size} viewBox="0 0 24 24" className={`${cls} bottom-2 left-2 -scale-y-100`} fill="none">
        <path d={cornerPath} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        {dot}
      </svg>
      <svg width={size} height={size} viewBox="0 0 24 24" className={`${cls} bottom-2 right-2 -scale-x-100 -scale-y-100`} fill="none">
        <path d={cornerPath} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        {dot}
      </svg>
    </div>
  );
}

export function PrasastiSeal({
  size = 44,
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
      <svg viewBox="0 0 48 48" width={size} height={size} className="block">
        <polygon
          points="24,2 29,6 35,4 37,10 43,12 41,18 46,24 41,30 43,36 37,38 35,44 29,42 24,46 19,42 13,44 11,38 5,36 7,30 2,24 7,18 5,12 11,10 13,4 19,6"
          fill="var(--vibe-accent)"
          fillOpacity="0.28"
          stroke="var(--vibe-primary)"
          strokeWidth="1.8"
        />
        <circle cx="24" cy="24" r="15" fill="var(--bg-basalt-card)" stroke="var(--vibe-primary)" strokeWidth="1.5" strokeDasharray="2 2" />
      </svg>
      {typeof accuracyPct === "number" ? (
        <span className="absolute inset-0 flex items-center justify-center font-num text-[10px] font-extrabold text-vibePrimary">
          {accuracyPct}%
        </span>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-display text-[10px] font-extrabold text-vibePrimary">
          SAH
        </span>
      )}
    </div>
  );
}

export function RegionCoverBanner({
  vibe = "majapahit",
  imageSrc,
  eyebrow,
  title,
  subtitle,
  compact = false,
  stripHeight = 12,
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
    <div className={`relative overflow-hidden rounded-2xl border border-stoneSubtle bg-[#2A2433] ${className}`}>
      <div
        className={`relative w-full bg-[#2A2433] ${compact ? "min-h-[96px]" : "min-h-[128px]"} flex items-end justify-between gap-3 p-3.5 sm:p-4`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(42,36,51,0.44) 0%, rgba(42,36,51,0.78) 60%, rgba(42,36,51,0.93) 100%)",
          }}
        />
        <div className="relative z-10 min-w-0 flex-1 text-left space-y-0.5 bg-[#2A2433]/0">
          {eyebrow && (
            <span className="inline-block px-2 py-0.5 rounded-full bg-vibePrimary text-[10px] font-extrabold tracking-wide text-[var(--vibe-on-primary)]">
              {eyebrow}
            </span>
          )}
          <HeadingTag
            id={titleId}
            className={`font-display font-extrabold text-[#FFF8EC] leading-snug ${
              as === "h1" ? "text-xl sm:text-2xl" : "text-base sm:text-lg"
            }`}
          >
            {title}
          </HeadingTag>
          {subtitle && (
            <p className="text-[11px] sm:text-xs font-medium text-[#FFF8EC]/95 leading-snug line-clamp-2">
              {subtitle}
            </p>
          )}
          {children}
        </div>
        {rightSlot && <div className="relative z-10 shrink-0 self-start">{rightSlot}</div>}
      </div>
      <div className="bg-basalt">
        <NusantaraPatternStrip vibe={vibe} height={stripHeight} />
      </div>
    </div>
  );
}
