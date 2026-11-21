import React from "react";
import Loka, { type LokaMood, type LokaMotion } from "@/components/brand/Loka";
import { NusantaraPatternStrip } from "@/components/brand/NusantaraOrnaments";
import type { CulturalVibe } from "@/types/lokawira";

export type LokaSceneKind = "empty-map" | "empty-wallet" | "empty-agenda" | "empty-search" | "level-up";

const SCENE_CFG: Record<LokaSceneKind, { mood: LokaMood; motion?: LokaMotion; badgeText?: string }> = {
  "empty-map": { mood: "curious" },
  "empty-wallet": { mood: "happy" },
  "empty-agenda": { mood: "think" },
  "empty-search": { mood: "curious" },
  "level-up": { mood: "cheer", motion: "hop" },
};

// Adegan ilustrasi Loka ringan berbasis SVG + maskot untuk empty state & perayaan level
export default function LokaScene({
  scene,
  vibe = "majapahit",
  size = 112,
  className = "",
}: {
  scene: LokaSceneKind;
  vibe?: CulturalVibe;
  size?: number;
  className?: string;
}) {
  const cfg = SCENE_CFG[scene];
  return (
    <div
      aria-hidden="true"
      className={`relative mx-auto inline-flex flex-col items-center justify-center rounded-3xl bg-obsidian/70 border border-stoneSubtle px-5 py-3 overflow-hidden ${className}`}
      style={{ minWidth: size + 36 }}
    >
      <svg viewBox="0 0 160 88" width={size + 28} height={Math.round((size + 28) * 0.55)} className="absolute inset-x-0 top-1 mx-auto opacity-80 pointer-events-none">
        {/* Halo Lontar */}
        <ellipse cx="80" cy="74" rx="56" ry="8" fill="var(--vibe-primary)" fillOpacity="0.12" />
        {scene === "empty-map" && (
          <g fill="none" stroke="var(--vibe-primary)" strokeWidth="2" strokeLinecap="round">
            <rect x="14" y="22" width="32" height="22" rx="4" fill="var(--bg-basalt-card)" strokeOpacity="0.7" />
            <path d="M20 32 Q28 26 36 36" strokeDasharray="3 2" />
            <circle cx="132" cy="30" r="11" fill="var(--bg-basalt-card)" stroke="var(--vibe-accent)" />
            <polygon points="132,22 135,30 132,38 129,30" fill="var(--vibe-primary)" stroke="none" />
          </g>
        )}
        {scene === "empty-wallet" && (
          <g fill="none" stroke="var(--vibe-primary)" strokeWidth="2">
            <rect x="16" y="26" width="28" height="20" rx="5" fill="var(--bg-basalt-card)" strokeOpacity="0.7" />
            <line x1="20" y1="36" x2="40" y2="36" strokeDasharray="3 2" stroke="var(--vibe-accent)" />
            <circle cx="132" cy="30" r="10" fill="var(--vibe-accent)" fillOpacity="0.25" stroke="var(--vibe-accent)" />
            <circle cx="132" cy="30" r="3" fill="var(--vibe-primary)" stroke="none" />
          </g>
        )}
        {scene === "empty-agenda" && (
          <g fill="none" stroke="var(--vibe-primary)" strokeWidth="2">
            <rect x="14" y="24" width="26" height="24" rx="5" fill="var(--bg-basalt-card)" strokeOpacity="0.75" />
            <line x1="14" y1="31" x2="40" y2="31" />
            <rect x="118" y="20" width="12" height="30" rx="5" fill="var(--vibe-accent)" fillOpacity="0.28" stroke="var(--vibe-primary)" />
            <line x1="124" y1="26" x2="124" y2="44" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )}
        {scene === "empty-search" && (
          <g fill="none" stroke="var(--vibe-primary)" strokeWidth="2" strokeLinecap="round">
            <circle cx="28" cy="32" r="11" fill="var(--bg-basalt-card)" />
            <line x1="36" y1="40" x2="44" y2="48" strokeWidth="3" />
            <path d="M122 46 Q120 26 130 22 Q140 26 138 46 Z" fill="var(--vibe-accent)" fillOpacity="0.28" />
          </g>
        )}
        {scene === "level-up" && (
          <g fill="var(--vibe-accent)" fillOpacity="0.55">
            <polygon points="24,18 26,24 32,26 26,28 24,34 22,28 16,26 22,24" />
            <polygon points="136,16 138,22 144,24 138,26 136,32 134,26 128,24 134,22" />
            <circle cx="38" cy="46" r="2.5" fill="var(--vibe-primary)" />
            <circle cx="122" cy="48" r="2.5" fill="var(--vibe-primary)" />
          </g>
        )}
      </svg>

      <div className="relative z-10 py-1">
        <Loka variant="full" size={size * 0.72} mood={cfg.mood} motion={cfg.motion} />
      </div>
      <div className="w-full -mx-5 mt-1">
        <NusantaraPatternStrip vibe={vibe} height={6} />
      </div>
    </div>
  );
}
