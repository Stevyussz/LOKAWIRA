"use client";

import { useSyncExternalStore } from "react";

// 3 tingkat animasi:
//  full   = semua animasi nyala
//  lite   = HP spek rendah: animasi berulang (loop) & blur dimatiin, transisi pendek tetep jalan
//  reduce = pengaturan "kurangi animasi" di HP: gerakan dimatiin, sisa fade halus
// pilihan pengguna (Akun) menang atas deteksi otomatis
export type MotionTier = "full" | "lite" | "reduce";
export type MotionChoice = "auto" | MotionTier;
export type MotionReason = "choice" | "os-reduce" | "low-memory" | "low-cores" | "save-data" | "slow-net" | "low-fps" | "none";

const KEY = "lokawira.motion";
const FPS_KEY = "lokawira.motion.fps";
const EVT = "lokawira:motion";

type Nav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };

export function readChoice(): MotionChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "full" || v === "lite" || v === "reduce" ? v : "auto";
  } catch {
    return "auto";
  }
}

// deteksi otomatis. deviceMemory dibulatkan ke bawah oleh browser (3 GB terbaca 2), jadi <=2 artinya RAM sekitar 3 GB ke bawah
export function detect(): { tier: MotionTier; reason: MotionReason } {
  const choice = readChoice();
  if (choice !== "auto") return { tier: choice, reason: "choice" };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return { tier: "reduce", reason: "os-reduce" };
  const nav = navigator as Nav;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return { tier: "lite", reason: "low-memory" };
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 2) return { tier: "lite", reason: "low-cores" };
  if (nav.connection?.saveData) return { tier: "lite", reason: "save-data" };
  if (nav.connection?.effectiveType && /(^|-)2g$/.test(nav.connection.effectiveType)) return { tier: "lite", reason: "slow-net" };
  try {
    if (sessionStorage.getItem(FPS_KEY) === "low") return { tier: "lite", reason: "low-fps" };
  } catch {}
  return { tier: "full", reason: "none" };
}

let state: { tier: MotionTier; reason: MotionReason } = { tier: "full", reason: "none" };

export function applyMotion() {
  state = detect();
  const root = document.documentElement;
  root.dataset.motion = state.tier;
  if (state.tier === "full") delete root.dataset.perf;
  else root.dataset.perf = "low";
  window.dispatchEvent(new Event(EVT));
}

export function setChoice(choice: MotionChoice) {
  try {
    if (choice === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {}
  applyMotion();
}

// ukur kelancaran layar sekali per sesi (cuma di mode otomatis & kalo masih full).
// Kalo rata2 di bawah ~30 fps, turun ke lite. HP yang lancar gak pernah diturunin
export function probeFps() {
  if (readChoice() !== "auto" || state.tier !== "full") return;
  try {
    if (sessionStorage.getItem(FPS_KEY)) return;
  } catch {}
  const frames: number[] = [];
  let last = 0;
  let skipped = 0;
  const tick = (t: number) => {
    // tab di belakang: rAF berhenti, jgn dihitung
    if (document.hidden) return;
    if (last) {
      // 5 frame pertama dibuang (masih sibuk muat halaman)
      if (skipped < 5) skipped++;
      else frames.push(t - last);
    }
    last = t;
    if (frames.length < 60) requestAnimationFrame(tick);
    else {
      const sorted = [...frames].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const low = median > 33;
      try {
        sessionStorage.setItem(FPS_KEY, low ? "low" : "ok");
      } catch {}
      if (low) applyMotion();
    }
  };
  requestAnimationFrame(tick);
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb);
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onOs = () => applyMotion();
  mq.addEventListener("change", onOs);
  return () => {
    window.removeEventListener(EVT, cb);
    mq.removeEventListener("change", onOs);
  };
};

export function useMotion() {
  const tier = useSyncExternalStore(subscribe, () => state.tier, () => "full" as MotionTier);
  const reason = useSyncExternalStore(subscribe, () => state.reason, () => "none" as MotionReason);
  return { tier, reason };
}

// buat MotionConfig (motion/react): reduce = semua gerakan transform mati
export function useReducedMotionConfig(): "always" | "never" {
  return useMotion().tier === "reduce" ? "always" : "never";
}

// buat kode non-React (kamera peta, scroll)
export const motionReduced = () => typeof document !== "undefined" && document.documentElement.dataset.motion === "reduce";

// skrip kecil di <head>: pasang data-motion SEBELUM halaman tergambar, biar gak ada kedip animasi di HP yg minta dikurangi
export const MOTION_BOOT = `(function(){try{var d=document.documentElement,c=localStorage.getItem("${KEY}"),t="full";if(c==="full"||c==="lite"||c==="reduce")t=c;else{var n=navigator,m=n.deviceMemory,k=n.connection||{};if(matchMedia("(prefers-reduced-motion: reduce)").matches)t="reduce";else if((typeof m==="number"&&m<=2)||n.hardwareConcurrency<=2||k.saveData||/(^|-)2g$/.test(k.effectiveType||"")||sessionStorage.getItem("${FPS_KEY}")==="low")t="lite"}d.dataset.motion=t;if(t!=="full")d.dataset.perf="low"}catch(e){}})();`;
