"use client";

import React from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import { ROLE_LABEL, useAuth } from "@/components/layout/AuthProvider";
import { useLokawira } from "@/components/layout/LokawiraProvider";
import AccountSecurity from "@/components/layout/AccountSecurity";
import { useLocation } from "@/components/layout/LocationProvider";
import { levelProgress } from "@/lib/progress";

interface AccountSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

// Akun: pengunjung boleh tnpa akun; mitra & pengelola masuk utk membuka dasbor masing-masing
export default function AccountSheet({ isOpen, onClose }: AccountSheetProps) {
  const { user, status, logout } = useAuth();
  const { lokaPoints, loreCards, checkedInSpotIds, vouchers } = useLokawira();
  const { consent: locConsent, revokeConsent } = useLocation();
  const lv = levelProgress(lokaPoints);
  const stats = [
    { icon: "pin" as const, value: checkedInSpotIds.length, label: "Titik dikunjungi" },
    { icon: "story" as const, value: loreCards.length, label: "Kisah terbuka" },
    { icon: "voucher" as const, value: vouchers.length, label: "Voucer" },
  ];

  const journey = (
    <section aria-labelledby="journey-title" className="rounded-2xl bg-slateElev p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="journey-title" className="text-sm font-extrabold text-alabaster">Perjalananku</h3>
        <p className="text-sm font-extrabold text-alabaster">
          Level <span className="font-num">{lv.level}</span>
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Progres menuju level berikutnya"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={lv.percent}
        className="h-2.5 rounded-full bg-pumice overflow-hidden"
      >
        <div className="h-full rounded-full bg-vibePrimary transition-[width] duration-500" style={{ width: `${lv.percent}%` }} />
      </div>
      <p className="text-xs text-pebble">
        <span className="font-num font-bold text-alabaster">{lokaPoints}</span> XP · <span className="font-num">{lv.needed}</span> XP lagi ke level {lv.level + 1}
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {stats.map((st) => (
          <li key={st.label} className="rounded-xl bg-basalt px-2 py-2.5 text-center">
            <Icon name={st.icon} size={18} className="mx-auto text-vibePrimary" />
            <p className="mt-1 font-num text-base font-extrabold text-alabaster">{st.value}</p>
            <p className="text-[11px] leading-tight text-pebble">{st.label}</p>
          </li>
        ))}
      </ul>
    </section>
  );

  const locationRow = locConsent ? (
    <div className="rounded-2xl bg-slateElev p-3.5 flex items-center justify-between gap-3">
      <p className="text-xs text-alabaster"><b>Izin lokasi aktif.</b> Dipakai untuk pemandu arah dan check-in.</p>
      <button type="button" onClick={revokeConsent} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs shrink-0">Cabut</button>
    </div>
  ) : null;

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

          {journey}
          {locationRow}

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

          <div className="border-t border-stoneSubtle pt-4 space-y-2">
            <h3 className="text-xs font-extrabold text-pebble">Keamanan akun</h3>
            <AccountSecurity onDone={onClose} />
          </div>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {journey}
          {locationRow}
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
