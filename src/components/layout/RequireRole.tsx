"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ROLE_LABEL, useAuth } from "@/components/layout/AuthProvider";
import { UserRole } from "@/types/lokawira";

// penjaga halaman di sisi tampilan, biar orang yg gak berhak gak melihat dasbor - penting: ini bkn keamanan
export default function RequireRole({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user, status, logout, recheck } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "guest") router.replace(`/masuk?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status === "authed" && user && roles.includes(user.role)) return <>{children}</>;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div role="status" className="gamiz-card max-w-sm w-full p-6 text-center space-y-4">
        {status === "loading" || status === "guest" ? (
          <>
            <h1 className="font-display text-xl font-extrabold text-alabaster">
              {status === "guest" ? "Mengalihkan ke halaman masuk" : "Memeriksa sesi"}
            </h1>
            <p className="text-sm text-pebble">Sebentar ya.</p>
          </>
        ) : status === "offline" ? (
          <>
            <h1 className="font-display text-xl font-extrabold text-alabaster">Server tidak terjangkau</h1>
            <p className="text-sm text-pebble">Sesimu belum bisa diperiksa. Periksa koneksi lalu coba lagi.</p>
            <button type="button" onClick={() => recheck()} className="btn-tactile-primary min-h-[48px] px-5 text-sm">
              Coba lagi
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-extrabold text-alabaster">Akses ditolak</h1>
            <p className="text-sm text-pebble">
              Halaman ini untuk {roles.map((r) => ROLE_LABEL[r]).join(" atau ")}. Kamu masuk sebagai{" "}
              {user ? ROLE_LABEL[user.role] : "tamu"}.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/" className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center">
                Kembali ke peta
              </Link>
              <button type="button" onClick={() => logout()} className="btn-tactile-secondary min-h-[48px] px-5 text-sm">
                Ganti akun
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
