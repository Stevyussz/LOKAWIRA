"use client";

import React from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import { ROLE_LABEL, useAuth } from "@/components/layout/AuthProvider";

interface AccountSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

// Akun: pengunjung boleh tnpa akun; mitra & pengelola masuk utk membuka dasbor masing-masing
export default function AccountSheet({ isOpen, onClose }: AccountSheetProps) {
  const { user, status, logout } = useAuth();

  const header = (
    <div className="flex items-start justify-between gap-3">
      <h2 id="account-sheet-title" className="font-display text-xl min-[380px]:text-2xl font-extrabold text-alabaster leading-tight">
        Akun
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup akun"
        className="btn-tactile-secondary min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
      >
        <Icon name="close" size={18} weight="bold" />
      </button>
    </div>
  );

  return (
    <Sheet isOpen={isOpen} onClose={onClose} titleId="account-sheet-title" header={header} maxWidthClass="sm:max-w-md">
      {status === "authed" && user ? (
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="w-14 h-14 rounded-2xl bg-vibePrimary text-[var(--vibe-on-primary)] font-display text-2xl font-extrabold flex items-center justify-center shrink-0"
            >
              {user.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <div className="min-w-0">
              <p className="text-base font-extrabold text-alabaster truncate">{user.name}</p>
              <p className="text-xs text-pebble truncate">{user.email}</p>
              <p className="mt-1 inline-flex text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slateElev text-alabaster">
                {ROLE_LABEL[user.role]}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {(user.role === "MERCHANT" || user.role === "ADMIN") && (
              <Link href="/merchant-pos" onClick={onClose} className="btn-tactile-primary min-h-[48px] px-4 text-sm flex items-center justify-center gap-2">
                <Icon name="umkm" size={18} />
                <span>Buka Dasbor Mitra</span>
              </Link>
            )}
            {user.role === "ADMIN" && (
              <Link href="/admin" onClick={onClose} className="btn-tactile-secondary min-h-[48px] px-4 text-sm flex items-center justify-center gap-2">
                <Icon name="database" size={18} />
                <span>Buka Dasbor Pengelola</span>
              </Link>
            )}
            <button
              type="button"
              onClick={async () => {
                await logout();
                onClose();
              }}
              className="btn-tactile-secondary w-full min-h-[48px] px-4 text-sm flex items-center justify-center gap-2"
            >
              <Icon name="signOut" size={18} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          <p className="text-sm text-pebble leading-relaxed">
            Kamu bisa menjelajah, memindai objek, dan memesan tiket tanpa akun. Masuk diperlukan untuk
            mitra (UMKM dan sanggar) dan pengelola.
          </p>
          {status === "offline" && (
            <p role="status" className="text-xs font-bold text-quotaFull">
              Server tidak terjangkau, sesi belum bisa diperiksa.
            </p>
          )}
          <div className="space-y-2.5">
            <Link href="/masuk" onClick={onClose} className="btn-tactile-primary min-h-[48px] px-4 text-sm flex items-center justify-center gap-2">
              <Icon name="user" size={18} />
              <span>Masuk</span>
            </Link>
            <Link href="/masuk?mode=daftar" onClick={onClose} className="btn-tactile-secondary min-h-[48px] px-4 text-sm flex items-center justify-center gap-2">
              <span>Daftar sebagai mitra atau wisatawan</span>
            </Link>
          </div>
        </div>
      )}
    </Sheet>
  );
}
