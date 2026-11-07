"use client";

import { api } from "@/lib/api";
import type { MetricType } from "@/types/lokawira";

// catat jejak dampak sekali per sesi per titik (biar angka gak menggelembung krn muat ulang)
export function trackOnce(type: MetricType, spotId: string) {
  const key = `lokawira.track.${type}.${spotId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {}
  void api.track(type, spotId);
}
