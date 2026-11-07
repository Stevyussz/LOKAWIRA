"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMotion } from "@/lib/motionPref";
import { VIBE_HEX } from "@/lib/vibeColors";
import { CulturalVibe } from "@/types/lokawira";

// pergantian kawasan terasa kyk tinta budaya baru yg merembes di atas lontar: lingkaran berwarna kawasan tujuan melebar dr t
export default function RegionInkTransition({ activeVibe }: { activeVibe: CulturalVibe }) {
  const { tier } = useMotion();
  const reduce = tier === "reduce";
  const prev = useRef<CulturalVibe>(activeVibe);
  const [ink, setInk] = useState<{ key: number; color: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (prev.current === activeVibe) return;
    prev.current = activeVibe;
    // tinta cuma di tingkat full: efek layar penuh terlalu berat buat HP spek rendah
    if (tier !== "full") return;
    const trigger = document.querySelector<HTMLElement>('[aria-haspopup="true"]');
    const r = trigger?.getBoundingClientRect();
    setInk({
      key: Date.now(),
      color: VIBE_HEX[activeVibe].primary,
      x: r ? r.left + r.width / 2 : window.innerWidth - 60,
      y: r ? r.top + r.height / 2 : 60,
    });
  }, [activeVibe, tier]);

  return (
    <AnimatePresence>
      {ink && (
        <motion.div
          key={ink.key}
          aria-hidden="true"
          className="fixed inset-0 z-[35] pointer-events-none"
          style={{ backgroundColor: ink.color }}
          initial={{ clipPath: `circle(0px at ${ink.x}px ${ink.y}px)`, opacity: 0.5 }}
          animate={{
            clipPath: `circle(1800px at ${ink.x}px ${ink.y}px)`,
            opacity: [0.5, 0.42, 0],
          }}
          transition={{
            clipPath: { duration: 0.7, ease: [0.2, 0.7, 0.2, 1] },
            opacity: { duration: 0.95, times: [0, 0.55, 1], ease: "easeOut" },
          }}
          onAnimationComplete={() => setInk(null)}
        />
      )}
    </AnimatePresence>
  );
}
