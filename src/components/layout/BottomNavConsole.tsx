"use client";

import React from "react";
import { MotionConfig, motion } from "motion/react";
import Icon, { IconName } from "@/components/ui/Icon";
import { useReducedMotionConfig } from "@/lib/motionPref";

type Section = "MAP" | "STORY" | "AGENDA" | "WALLET";

interface BottomNavConsoleProps {
  activeSection: Section;
  onSelectSection: (section: Section) => void;
  onOpenScanner: () => void;
  activeVoucherCount: number;
  // jumlah acara hari ini di kawasan (titik kecil di tab Agenda)
  todayEventCount: number;
}

// Peta: kmebali ke jelajah - Kisah: cerita Loka
const ITEMS: { id: Section; label: string; icon: IconName }[] = [
  { id: "MAP", label: "Peta", icon: "compass" },
  { id: "STORY", label: "Kisah", icon: "story" },
  // tempat budaya jarang antre; yg kurang justru info "ada acara apa". Antrean pindah ke kartu titik saat ramai
  { id: "AGENDA", label: "Agenda", icon: "calendar" },
  { id: "WALLET", label: "Tas", icon: "bag" },
];

export default function BottomNavConsole({
  activeSection,
  onSelectSection,
  activeVoucherCount,
  todayEventCount,
}: BottomNavConsoleProps) {
  const reducedMotion = useReducedMotionConfig();
  return (
    <MotionConfig reducedMotion={reducedMotion}>
      <nav
        aria-label="Navigasi petualang"
        style={{ bottom: "calc(12px + env(safe-area-inset-bottom))" }}
        className="fixed left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.5rem)] max-w-[420px] andesite-glass rounded-[22px] p-1.5"
      >
        <div className="grid grid-cols-4 gap-1">
          {ITEMS.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                data-nav-id={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                aria-current={active ? "page" : undefined}
                className={`relative min-h-[56px] rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold transition-colors duration-200 ${
                  active ? "text-[var(--vibe-on-primary)]" : "text-pebble hover:bg-slateElev"
                }`}
              >
                {/* pil aktif meluncur antar tab (transform aja, rignan di HP lemah) */}
                {active && (
                  <motion.span
                    layoutId="nav-active-pill"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-2xl bg-vibePrimary shadow-[0_3px_0_0_var(--vibe-primary-lip)]"
                    transition={{ type: "spring", stiffness: 520, damping: 36 }}
                  />
                )}
                <motion.span
                  className="relative inline-flex"
                  animate={active ? { y: -1, scale: 1.12 } : { y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 460, damping: 18 }}
                >
                  <Icon name={item.icon} size={24} weight={active ? "fill" : "duotone"} />
                </motion.span>
                <span className="relative">{item.label}</span>

                {item.id === "AGENDA" && todayEventCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-2 right-[22%] w-2.5 h-2.5 rounded-full bg-vibePrimary ring-2 ring-[var(--bg-basalt-card)]"
                  />
                )}
                {item.id === "AGENDA" && todayEventCount > 0 && <span className="sr-only">, ada acara hari ini</span>}
                {item.id === "WALLET" && activeVoucherCount > 0 && (
                  <motion.span
                    key={activeVoucherCount}
                    initial={{ scale: 1.7 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 12 }}
                    className="absolute top-1.5 right-[20%] min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--vibe-accent)] text-[10px] font-extrabold text-alabaster flex items-center justify-center ring-2 ring-[var(--bg-basalt-card)]"
                  >
                    {activeVoucherCount}
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </MotionConfig>
  );
}
