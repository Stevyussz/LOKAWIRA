"use client";

import { useSyncExternalStore } from "react";

// event pasang aplikasi dr Chrome/Android disimpan di sini biar tombol "Pasang" bisa dipanggil kapan aja
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
let installed = false;
const EVT = "lokawira:pwa";
const emit = () => window.dispatchEvent(new Event(EVT));

export function initPwa() {
  installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
  // SW cuma di build produksi: di dev bikin cache basi & ngeganggu hot reload
  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    const reg = () => navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    // efek React biasanya jalan stlh event load lewat, jadi cek dulu
    if (document.readyState === "complete") reg();
    else window.addEventListener("load", reg, { once: true });
  }
  emit();
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  emit();
  return outcome === "accepted";
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
type Snap = "installed" | "prompt" | "ios" | "none";
const snap = (): Snap => (installed ? "installed" : deferred ? "prompt" : isIos() ? "ios" : "none");
const sub = (cb: () => void) => {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
};

// installed = udah kepasang, prompt = bisa dipasang lewat tombol, ios = harus lewat menu Bagikan, none = browser gak dukung
export const useInstallState = () => useSyncExternalStore(sub, snap, () => "none" as Snap);
