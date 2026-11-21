"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import AuthShell from "@/components/layout/AuthShell";
import { useAuth } from "@/components/layout/AuthProvider";
import { api, describeError } from "@/lib/api";

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const { user, recheck } = useAuth();
  const [status, setStatus] = useState<"idle" | "verifying" | "verified" | "error">(token ? "verifying" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setStatus("verifying");
    setError(null);
    api
      .verifyEmail({ token })
      .then(async () => {
        if (cancelled) return;
        await recheck({ silent: true }).catch(() => {});
        if (!cancelled) setStatus("verified");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setError(describeError(err, "Tautan verifikasi tidak valid atau sudah kedaluwarsa."));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleResend = async () => {
    setError(null);
    setResending(true);
    setResent(false);
    try {
      await api.resendVerification();
      setResent(true);
    } catch (err) {
      setError(describeError(err, "Gagal mengirim ulang email verifikasi."));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title={status === "verified" ? "Email terverifikasi" : "Verifikasi email"}
      subtitle={
        status === "verified"
          ? "Alamat emailmu sudah terkonfirmasi. Kamu siap menjelajah."
          : "Pastikan alamat emailmu aktif untuk keamanan akun dan notifikasi penting."
      }
      mood={status === "verified" ? "cheer" : status === "error" ? "curious" : "think"}
    >
      <div className="space-y-4 text-center">
        {status === "verifying" && (
          <div role="status" className="py-4 flex flex-col items-center gap-3">
            <Icon name="loader" size={28} weight="bold" motion="spin" className="text-vibePrimary" />
            <p className="text-sm font-bold text-alabaster">Memeriksa tautan verifikasi...</p>
          </div>
        )}

        {status === "verified" && (
          <div role="status" className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-quotaSafe/15 text-quotaSafe mx-auto flex items-center justify-center">
              <Icon name="check" size={28} motion="pop" />
            </div>
            <p className="text-sm font-bold text-quotaSafe">Verifikasi selesai.</p>
            <Link
              href={user?.role === "ADMIN" ? "/admin" : user?.role === "MERCHANT" ? "/merchant-pos" : "/"}
              className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center justify-center"
            >
              Lanjut ke aplikasi
            </Link>
          </div>
        )}

        {status === "idle" && (
          <p className="text-sm text-pebble leading-relaxed">
            Buka tautan verifikasi dari email yang kami kirim saat kamu mendaftar. Jika belum masuk, periksa folder spam atau minta tautan baru di bawah ini.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm font-bold text-quotaFull flex items-start justify-center gap-2 text-left">
            <Icon name="alert" size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </p>
        )}

        {resent && (
          <p role="status" className="text-xs font-bold text-quotaSafe rounded-xl bg-quotaSafe/10 p-3">
            Tautan verifikasi baru dikirim ke email akunmu.
          </p>
        )}

        {status !== "verifying" && status !== "verified" && (
          <div className="space-y-2.5 pt-1">
            {user ? (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="btn-tactile-primary w-full min-h-[48px] px-5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {resending && <Icon name="loader" size={18} weight="bold" motion="spin" />}
                <span>{resending ? "Mengirim..." : "Kirim ulang tautan verifikasi"}</span>
              </button>
            ) : (
              <Link href="/masuk" className="btn-tactile-secondary w-full min-h-[48px] px-5 text-sm inline-flex items-center justify-center">
                Masuk untuk mengirim ulang verifikasi
              </Link>
            )}
            <p className="pt-1">
              <Link href="/" className="inline-flex min-h-[44px] items-center text-xs font-extrabold text-vibePrimary underline underline-offset-2">
                Kembali ke peta LOKAWIRA
              </Link>
            </p>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
