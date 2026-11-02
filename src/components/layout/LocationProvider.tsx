"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import { DEMO_MODE } from "@/lib/api";

export interface Fix {
  lat: number;
  lng: number;
  // radius akurasi dlm meter, makin kecil makin tepat
  accuracy: number;
  // arah gerak (derajat) kalo perangkat lg bergerak, selain itu null
  heading: number | null;
  at: number;
}

export type LocationFailure = "declined" | "denied" | "unavailable" | "timeout" | "unsupported";
export class LocationError extends Error {
  readonly reason: LocationFailure;
  constructor(reason: LocationFailure, message: string) {
    super(message);
    this.name = "LocationError";
    this.reason = reason;
  }
}

const MESSAGES: Record<LocationFailure, string> = {
  declined: "Kamu belum mengizinkan lokasi.",
  denied: "Izin lokasi ditolak di peramban. Aktifkan lewat pengaturan situs, lalu coba lagi.",
  unavailable: "Lokasi belum bisa ditentukan. Coba pindah ke area terbuka.",
  timeout: "Mencari lokasi terlalu lama. Coba lagi di area terbuka.",
  unsupported: "Perangkat ini tidak mendukung lokasi.",
};

interface LocationContextValue {
  // persetujuan LOKAWIRA sendiri (di luar izin peramban), disimpan di perangkat
  consent: boolean;
  revokeConsent: () => void;
  position: Fix | null;
  watching: boolean;
  watchError: string | null;
  startWatching: () => Promise<boolean>;
  stopWatching: () => void;
  // satu kali baca lokasi (dipakai check-in): gak nyalain pemantauan terus-menerus
  getFix: () => Promise<Fix>;
}

const CONSENT_KEY = "lokawira.locationConsent";
const LocationContext = createContext<LocationContextValue | null>(null);

const toFix = (p: GeolocationPosition): Fix => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: p.coords.accuracy,
  heading: typeof p.coords.heading === "number" && Number.isFinite(p.coords.heading) ? p.coords.heading : null,
  at: p.timestamp,
});

const reasonFromCode = (code: number): LocationFailure => (code === 1 ? "denied" : code === 3 ? "timeout" : "unavailable");

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [position, setPosition] = useState<Fix | null>(null);
  const [watching, setWatching] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const consentRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONSENT_KEY) === "1";
      consentRef.current = saved;
      setConsent(saved);
    } catch {
      // penyimpanan diblokir: persetujuan cuma berlaku selama tab terbuka
    }
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setWatching(false);
    setPosition(null);
  }, []);

  const settle = useCallback((ok: boolean) => {
    if (ok) {
      consentRef.current = true;
      setConsent(true);
      try {
        localStorage.setItem(CONSENT_KEY, "1");
      } catch {
        // abaikan
      }
    }
    setAskOpen(false);
    resolverRef.current?.(ok);
    resolverRef.current = null;
  }, []);

  const ensureConsent = useCallback(
    () =>
      consentRef.current
        ? Promise.resolve(true)
        : new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
            setAskOpen(true);
          }),
    []
  );

  const revokeConsent = useCallback(() => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    consentRef.current = false;
    setConsent(false);
    setWatching(false);
    setPosition(null);
    try {
      localStorage.removeItem(CONSENT_KEY);
    } catch {
      // abaikan
    }
  }, []);

  const getFix = useCallback(async (): Promise<Fix> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) throw new LocationError("unsupported", MESSAGES.unsupported);
    if (!(await ensureConsent())) throw new LocationError("declined", MESSAGES.declined);
    return new Promise<Fix>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(toFix(p)),
        (e) => {
          const r = reasonFromCode(e.code);
          reject(new LocationError(r, MESSAGES[r]));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      )
    );
  }, [ensureConsent]);

  const startWatching = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setWatchError(MESSAGES.unsupported);
      return false;
    }
    if (watchIdRef.current !== null) return true;
    if (!(await ensureConsent())) return false;
    setWatchError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (p) => {
        setPosition(toFix(p));
        setWatchError(null);
      },
      (e) => {
        setWatchError(MESSAGES[reasonFromCode(e.code)]);
        if (e.code === 1) stopWatching();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    setWatching(true);
    return true;
  }, [ensureConsent, stopWatching]);

  useEffect(
    () => () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    },
    []
  );

  const header = (
    <h2 id="loc-consent-title" className="font-display text-xl font-extrabold text-alabaster leading-tight">
      Izinkan LOKAWIRA memakai lokasimu?
    </h2>
  );

  return (
    <LocationContext.Provider value={{ consent, revokeConsent, position, watching, watchError, startWatching, stopWatching, getFix }}>
      {children}
      <Sheet isOpen={askOpen} onClose={() => settle(false)} titleId="loc-consent-title" header={header} maxWidthClass="sm:max-w-md">
        <div className="space-y-4 pt-1">
          <ul className="space-y-3 text-sm text-alabaster">
            <li className="flex gap-3">
              <Icon name="compass" size={22} className="text-vibePrimary shrink-0 mt-0.5" />
              <span><b>Untuk apa:</b> menunjukkan arah dan jarak ke titik tujuan, dan memastikan kamu benar-benar sudah tiba saat check-in.</span>
            </li>
            <li className="flex gap-3">
              <Icon name="shield" size={22} className="text-vibePrimary shrink-0 mt-0.5" />
              <span><b>Yang dikirim:</b> koordinat dan akurasi GPS hanya saat kamu menekan Check-In. Saat dipandu, posisimu hanya dipakai di perangkatmu dan tidak dikirim ke server.</span>
            </li>
            <li className="flex gap-3">
              <Icon name="database" size={22} className="text-vibePrimary shrink-0 mt-0.5" />
              <span><b>Disimpan:</b> server hanya memeriksa jarak dan tidak menyimpan koordinat mentahmu lebih lama dari yang diperlukan untuk pemeriksaan itu.</span>
            </li>
            <li className="flex gap-3">
              <Icon name="user" size={22} className="text-vibePrimary shrink-0 mt-0.5" />
              <span><b>Kendalimu:</b> kamu bisa mencabut izin kapan saja lewat menu Akun. Setelah ini peramban juga akan meminta izin sendiri.</span>
            </li>
          </ul>
          {DEMO_MODE && (
            <p className="text-[11px] text-pebble rounded-xl bg-slateElev p-3">
              Mode demo: teks ini masih draf dan perlu diganti dengan kebijakan privasi resmi sebelum dipakai publik.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => settle(false)} className="btn-tactile-secondary min-h-[48px] text-sm">Nanti saja</button>
            <button type="button" onClick={() => settle(true)} className="btn-tactile-primary min-h-[48px] text-sm">Izinkan</button>
          </div>
        </div>
      </Sheet>
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation harus dipakai di dalam LocationProvider");
  return ctx;
}
