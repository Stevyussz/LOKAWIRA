"use client";

import { useEffect } from "react";

// menandai perangkat spek rendah di <html data-perf="low"> biar CSS bisa mematikan efek mahal
export default function PerfMode() {
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowCores = typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 2;
    const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2;
    if (lowCores || lowMemory) document.documentElement.dataset.perf = "low";
  }, []);
  return null;
}
