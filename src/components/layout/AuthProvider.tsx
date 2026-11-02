"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, ApiError, setAuthTokenProvider } from "@/lib/api";
import { AuthUser } from "@/types/lokawira";
import type { RegisterRequest } from "@/types/api";

// Sesi user - loading: memeeriksa sesi tersimpan - guest: blm masuk (pengunjung boleh pakai aplikasi tnpa akun)
export type AuthStatus = "loading" | "guest" | "authed" | "offline";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (r: RegisterRequest) => Promise<AuthUser>;
  logout: () => Promise<void>;
  recheck: () => Promise<void>;
}

const TOKEN_KEY = "lokawira.token";
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const tokenRef = useRef<string | null>(null);

  const persist = (token: string | undefined) => {
    tokenRef.current = token ?? null;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // penyimpanan diblokir: sesi cuma hidup selama tab terbuka
    }
  };

  const recheck = useCallback(async () => {
    setStatus("loading");
    try {
      const { user: me } = await api.me();
      setUser(me);
      setStatus("authed");
    } catch (err) {
      if (err instanceof ApiError && err.isOffline) {
        setStatus("offline");
        return;
      }
      persist(undefined);
      setUser(null);
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    setAuthTokenProvider(() => tokenRef.current);
    try {
      tokenRef.current = localStorage.getItem(TOKEN_KEY);
    } catch {
      tokenRef.current = null;
    }
    recheck();
  }, [recheck]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    persist(res.token);
    setUser(res.user);
    setStatus("authed");
    return res.user;
  }, []);

  const register = useCallback(async (r: RegisterRequest) => {
    const res = await api.register(r);
    persist(res.token);
    setUser(res.user);
    setStatus("authed");
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // tetap keluar di perangkat ini walau server tak terjnagkau
    }
    persist(undefined);
    setUser(null);
    setStatus("guest");
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout, recheck }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export const ROLE_LABEL: Record<AuthUser["role"], string> = {
  VISITOR: "Wisatawan",
  MERCHANT: "Mitra",
  ADMIN: "Pengelola",
};

// tujuan stlh masuk: hormati next cuma kalo berupa path internal
export function homeFor(role: AuthUser["role"]): string {
  return role === "ADMIN" ? "/admin" : role === "MERCHANT" ? "/merchant-pos" : "/";
}
export function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}
