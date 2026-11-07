"use client";

import { useEffect } from "react";
import { applyMotion, probeFps } from "@/lib/motionPref";
import { initPwa } from "@/lib/pwa";

// tingkat animasi (data-motion & data-perf di <html>) dipasang dulu oleh skrip di <head>.
// Di sini disinkronkan ke React, lalu kelancaran layar diukur sekali setelah halaman tenang
export default function PerfMode() {
  useEffect(() => {
    applyMotion();
    initPwa();
    const t = window.setTimeout(probeFps, 2500);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
