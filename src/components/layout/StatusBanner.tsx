"use client";

import React from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Icon from "@/components/ui/Icon";
import Loka from "@/components/brand/Loka";
import { useReducedMotionConfig } from "@/lib/motionPref";

interface StatusBannerProps {
  message: string | null;
  isError: boolean;
  levelUp?: number | null;
  onClose: () => void;
}

export default function StatusBanner({ message, isError, levelUp = null, onClose }: StatusBannerProps) {
  const reducedMotion = useReducedMotionConfig();
  return (
    <MotionConfig reducedMotion={reducedMotion}>
      <AnimatePresence>
      {message && (
        <motion.div
          key="status-banner"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="fixed top-[132px] left-3 right-3 sm:left-auto sm:right-5 sm:w-[360px] z-40 gamiz-card px-4 py-3 flex items-center gap-3"
        >
          {levelUp && !isError ? (
            <Loka variant="mark" size={40} mood="cheer" motion="hop" />
          ) : (
            <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isError ? "bg-quotaFull/15" : "bg-quotaSafe/15"}`}>
              <Icon name={isError ? "alert" : "check"} size={22} className={isError ? "text-quotaFull" : "text-quotaSafe"} motion="pop" />
            </span>
          )}
          <div className="flex-1 min-w-0 space-y-1">
            {levelUp && !isError && (
              <span className="inline-block px-2 py-0.5 rounded-full bg-vibePrimary text-[11px] font-extrabold text-[var(--vibe-on-primary)]">
                Naik Level {levelUp}!
              </span>
            )}
            <p className="text-sm font-bold text-alabaster leading-snug">{message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup notifikasi"
            className="min-w-[44px] min-h-[44px] rounded-full text-pebble hover:bg-slateElev flex items-center justify-center"
          >
            <Icon name="close" size={16} weight="bold" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
    </MotionConfig>
  );
}
