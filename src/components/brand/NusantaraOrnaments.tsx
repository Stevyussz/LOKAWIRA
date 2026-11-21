import React, { useId } from "react";
import { REGION_COVER_IMAGE } from "@/lib/spotMeta";
import type { CulturalVibe } from "@/types/lokawira";

export function NusantaraPatternStrip({
  vibe = "majapahit",
  height = 10,
  className = "",
}: {
  vibe?: CulturalVibe;
  height?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const pid = `lkw-pat-${vibe}-${uid}`;
  return (
    <svg
      aria-hidden="true"
      className={`w-full block ${className}`}
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        {vibe === "majapahit" && (
          <pattern id={pid} width="24" height="12" patternUnits="userSpaceOnUse">
            <rect width="24" height="12" fill="var(--vibe-primary)" fillOpacity="0.16" />
            <polygon points="12,1 18,6 12,11 6,6" fill="var(--vibe-primary)" fillOpacity="0.65" />
            <circle cx="12" cy="6" r="1.8" fill="var(--vibe-accent)" />
            <circle cx="0" cy="6" r="2" fill="var(--vibe-accent)" fillOpacity="0.55" />
            <circle cx="24" cy="6" r="2" fill="var(--vibe-accent)" fillOpacity="0.55" />
          </pattern>
        )}
        {vibe === "sogan" && (
          <pattern id={pid} width="20" height="12" patternUnits="userSpaceOnUse">
            <rect width="20" height="12" fill="var(--vibe-primary)" fillOpacity="0.14" />
            <ellipse cx="10" cy="3" rx="3.2" ry="1.8" fill="var(--vibe-primary)" fillOpacity="0.6" />
            <ellipse cx="10" cy="9" rx="3.2" ry="1.8" fill="var(--vibe-primary)" fillOpacity="0.6" />
            <ellipse cx="4" cy="6" rx="2.6" ry="1.6" fill="var(--vibe-accent)" fillOpacity="0.7" />
            <ellipse cx="16" cy="6" rx="2.6" ry="1.6" fill="var(--vibe-accent)" fillOpacity="0.7" />
            <circle cx="10" cy="6" r="1.4" fill="var(--vibe-secondary)" />
          </pattern>
        )}
        {vibe === "bahari" && (
          <pattern id={pid} width="28" height="12" patternUnits="userSpaceOnUse">
            <rect width="28" height="12" fill="var(--vibe-primary)" fillOpacity="0.12" />
            <path d="M0 9 Q7 2 14 7 T28 9" fill="none" stroke="var(--vibe-primary)" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M0 11 Q7 5 14 9.5 T28 11" fill="none" stroke="var(--vibe-accent)" strokeWidth="1.4" strokeOpacity="0.8" />
          </pattern>
        )}
        {vibe === "tridatu" && (
          <pattern id={pid} width="16" height="12" patternUnits="userSpaceOnUse">
            <rect width="16" height="4" fill="var(--vibe-primary)" fillOpacity="0.7" />
            <rect y="4" width="16" height="4" fill="var(--bg-basalt-card)" />
            <rect y="8" width="16" height="4" fill="#2A2433" fillOpacity="0.75" />
            <polygon points="8,1 13,11 3,11" fill="var(--vibe-accent)" fillOpacity="0.78" />
          </pattern>
        )}
        {vibe === "ukiran" && (
          <pattern id={pid} width="24" height="12" patternUnits="userSpaceOnUse">
            <rect width="24" height="12" fill="var(--vibe-primary)" fillOpacity="0.14" />
            <polygon points="12,1 22,11 2,11" fill="none" stroke="var(--vibe-primary)" strokeWidth="1.8" />
            <circle cx="12" cy="7" r="2.2" fill="var(--vibe-accent)" />
            <line x1="0" y1="6" x2="4" y2="6" stroke="var(--vibe-primary)" strokeWidth="1.5" />
            <line x1="20" y1="6" x2="24" y2="6" stroke="var(--vibe-primary)" strokeWidth="1.5" />
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
          fillOpacity="0.22"
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
  vibe,
  eyebrow,
  title,
  subtitle,
  compact = false,
  className = "",
  children,
}: {
  vibe: CulturalVibe;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const coverSrc = REGION_COVER_IMAGE[vibe] ?? REGION_COVER_IMAGE.majapahit;
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-stoneSubtle ${className}`}>
      <div
        className={`relative w-full bg-vibePrimary/15 ${compact ? "min-h-[104px]" : "min-h-[136px]"} flex flex-col justify-end`}
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
              "linear-gradient(180deg, rgba(42,36,51,0.18) 0%, rgba(42,36,51,0.68) 65%, rgba(42,36,51,0.88) 100%)",
          }}
        />
        <div className="relative z-10 p-3.5 sm:p-4 text-left space-y-0.5">
          {eyebrow && (
            <span className="inline-block px-2 py-0.5 rounded-full bg-vibePrimary text-[10px] font-extrabold tracking-wide text-[var(--vibe-on-primary)]">
              {eyebrow}
            </span>
          )}
          <h3 className="font-display text-base sm:text-lg font-extrabold text-[#FFF8EC] leading-snug">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] sm:text-xs font-medium text-[#FFF8EC]/90 leading-snug line-clamp-2">
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </div>
      <NusantaraPatternStrip vibe={vibe} height={8} />
    </div>
  );
}
