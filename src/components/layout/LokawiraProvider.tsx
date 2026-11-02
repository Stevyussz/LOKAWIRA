"use client";

import { api, ApiError, DEMO_MODE } from "@/lib/api";
import { useAuth } from "@/components/layout/AuthProvider";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  CulturalSpot,
  CulturalVibe,
  IssuedVoucher,
  ReservationPass,
  SurfaceTheme,
  UnlockedLoreCard,
} from "@/types/lokawira";
import {
  INITIAL_CULTURAL_SPOTS,
  INITIAL_LORE_CARDS,
  INITIAL_RESERVATIONS,
  INITIAL_VOUCHERS,
} from "@/lib/seedCulturalData";

interface LokawiraContextValue {
  activeVibe: CulturalVibe;
  setActiveVibe: (vibe: CulturalVibe) => void;
  surfaceTheme: SurfaceTheme;
  toggleSurfaceTheme: () => void;
  gpsSimulated: boolean;
  toggleGpsSimulated: () => void;
  pdpConsentAccepted: boolean;
  acceptPdpConsent: () => void;
  lokaPoints: number;
  addLokaPoints: (pts: number) => void;
  spots: CulturalSpot[];
  // cuma titik terbit - dipake peta & pencarian wisatawan (titik menunggu review gak tampil)
  publicSpots: CulturalSpot[];
  setSpots: React.Dispatch<React.SetStateAction<CulturalSpot[]>>;
  vouchers: IssuedVoucher[];
  setVouchers: React.Dispatch<React.SetStateAction<IssuedVoucher[]>>;
  reservations: ReservationPass[];
  setReservations: React.Dispatch<React.SetStateAction<ReservationPass[]>>;
  loreCards: UnlockedLoreCard[];
  setLoreCards: React.Dispatch<React.SetStateAction<UnlockedLoreCard[]>>;
  checkedInSpotIds: string[];
  markSpotCheckedIn: (spotId: string) => void;
  uiStateOverride: "NORMAL" | "LOADING" | "EMPTY" | "ERROR";
  setUiStateOverride: (st: "NORMAL" | "LOADING" | "EMPTY" | "ERROR") => void;
  refreshServerData: () => Promise<void>;
  // ambil XP, kartu lore, check-in, tas, dan tiket milik akun login dari server (gak ngapa2in buat tamu)
  syncProfile: () => Promise<void>;
  // loading: menunggu server - live: data dr server - offline: server tak terjangkau (data cth kalo mode demo)
  dataStatus: "loading" | "live" | "offline";
}

const LokawiraContext = createContext<LokawiraContextValue | null>(null);

export function LokawiraProvider({ children }: { children: React.ReactNode }) {
  const [activeVibe, setActiveVibe] = useState<CulturalVibe>("majapahit");
  const [surfaceTheme, setSurfaceTheme] = useState<SurfaceTheme>("andesite");
  const [gpsSimulated, setGpsSimulated] = useState<boolean>(true);
  const [pdpConsentAccepted, setPdpConsentAccepted] = useState<boolean>(false);
  const [lokaPoints, setLokaPoints] = useState<number>(DEMO_MODE ? 420 : 0);
  const [spots, setSpotsRaw] = useState<CulturalSpot[]>(DEMO_MODE ? INITIAL_CULTURAL_SPOTS : []);
  // stlh user mengubah kuota scr lokal (demo/admin), hasil fetch awal yg terlammbat gak boleh menimpanya
  const spotsTouchedRef = useRef<boolean>(false);
  const setSpots: React.Dispatch<React.SetStateAction<CulturalSpot[]>> = (value) => {
    spotsTouchedRef.current = true;
    setSpotsRaw(value);
  };
  const [vouchers, setVouchers] = useState<IssuedVoucher[]>(DEMO_MODE ? INITIAL_VOUCHERS : []);
  const [reservations, setReservations] = useState<ReservationPass[]>(
    DEMO_MODE ? INITIAL_RESERVATIONS : []
  );
  const [loreCards, setLoreCards] = useState<UnlockedLoreCard[]>(
    DEMO_MODE ? INITIAL_LORE_CARDS : []
  );
  const [checkedInSpotIds, setCheckedInSpotIds] = useState<string[]>([]);
  const [uiStateOverride, setUiStateOverride] = useState<
    "NORMAL" | "LOADING" | "EMPTY" | "ERROR"
  >("NORMAL");

  const [dataStatus, setDataStatus] = useState<"loading" | "live" | "offline">("loading");

  const { user: authUser, status: authStatus } = useAuth();

  // gabung dua daftar: item server menang kalo kuncinya sama, item lokal yg gak ada di server tetep disimpen
  const mergeBy = <T,>(local: T[], server: T[], key: (x: T) => string): T[] => {
    const seen = new Set(server.map(key));
    return [...server, ...local.filter((x) => !seen.has(key(x)))];
  };

  const refreshServerData = async () => {
    try {
      const data = await api.getSnapshot();
      if (Array.isArray(data.spots) && !spotsTouchedRef.current) setSpotsRaw(data.spots);
      // user login: server = sumber kebenaran. Tamu: server gak nyimpen tas tamu, jadi digabung biar gak kehapus
      if (Array.isArray(data.vouchers)) {
        const serverVouchers = data.vouchers;
        setVouchers((prev) => (authUser ? serverVouchers : mergeBy(prev, serverVouchers, (v) => v.code)));
      }
      if (Array.isArray(data.reservations)) {
        const serverRes = data.reservations;
        setReservations((prev) => (authUser ? serverRes : mergeBy(prev, serverRes, (r) => r.ticketId)));
      }
      setDataStatus("live");
    } catch (err) {
      // server tak terjangkau atw menolak: tampilan tetap hidup, tp status dicatat biar UI jujur
      setDataStatus(err instanceof ApiError ? "offline" : "offline");
    }
  };

  const syncProfile = async () => {
    if (!authUser) return;
    try {
      const p = await api.getProfile();
      setLokaPoints(p.xp);
      setLoreCards(p.loreCards);
      setCheckedInSpotIds(p.checkedInSpotIds);
      // buat mitra/admin, voucer & tiket di snapshot itu milik lapaknya, bkn tas pribadi
      if (authUser.role === "VISITOR") {
        setVouchers(p.vouchers);
        setReservations(p.reservations);
      }
    } catch {
      // server tak terjangkau: tampilan lokal dibiarkan, dicoba lagi pas sinkron berikutnya
    }
  };

  // muat data pas sesi pertama kali jelas, & muat ulang pas user masuk/keluar: isi snapshot bergantung peran (mis
  const prevAuthId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (authStatus === "loading") return;
    // ganti akun / keluar: kosongin tas biar data akun sebelumnya gak kebawa di perangkat bareng
    const currentId = authUser?.id ?? null;
    if (prevAuthId.current !== undefined && prevAuthId.current !== currentId) {
      setVouchers(DEMO_MODE ? INITIAL_VOUCHERS : []);
      setReservations(DEMO_MODE ? INITIAL_RESERVATIONS : []);
      setLokaPoints(DEMO_MODE ? 420 : 0);
      setLoreCards(DEMO_MODE ? INITIAL_LORE_CARDS : []);
      setCheckedInSpotIds([]);
    }
    prevAuthId.current = currentId;
    spotsTouchedRef.current = false;
    refreshServerData().then(syncProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id, authStatus]);

  const toggleSurfaceTheme = () => {
    setSurfaceTheme((prev) => (prev === "andesite" ? "daylight" : "andesite"));
  };

  const toggleGpsSimulated = () => {
    setGpsSimulated((prev) => !prev);
  };

  const acceptPdpConsent = () => {
    setPdpConsentAccepted(true);
    setGpsSimulated(true);
  };

  const addLokaPoints = (pts: number) => {
    setLokaPoints((prev) => prev + pts);
  };

  const markSpotCheckedIn = (spotId: string) => {
    if (!checkedInSpotIds.includes(spotId)) {
      // XP-nya ditambah pemanggil sesuai awardedPoints dari server (dulu ke-tambah dua kali)
      setCheckedInSpotIds((prev) => [...prev, spotId]);
    }
  };

  return (
    <LokawiraContext.Provider
      value={{
        activeVibe,
        setActiveVibe,
        surfaceTheme,
        toggleSurfaceTheme,
        gpsSimulated,
        toggleGpsSimulated,
        pdpConsentAccepted,
        acceptPdpConsent,
        lokaPoints,
        addLokaPoints,
        spots,
        publicSpots: spots.filter((s) => !s.status || s.status === "PUBLISHED"),
        setSpots,
        vouchers,
        setVouchers,
        reservations,
        setReservations,
        loreCards,
        setLoreCards,
        checkedInSpotIds,
        markSpotCheckedIn,
        uiStateOverride,
        setUiStateOverride,
        refreshServerData,
        syncProfile,
        dataStatus,
      }}
    >
      <div
        data-vibe={activeVibe}
        data-theme={surfaceTheme}
        className="min-h-screen bg-andesite text-alabaster font-sans transition-colors duration-300"
      >
        {children}
      </div>
    </LokawiraContext.Provider>
  );
}

export function useLokawira() {
  const ctx = useContext(LokawiraContext);
  if (!ctx) {
    throw new Error("useLokawira must be used within a LokawiraProvider");
  }
  return ctx;
}
