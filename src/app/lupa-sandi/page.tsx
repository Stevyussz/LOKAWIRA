"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import AuthShell from "@/components/layout/AuthShell";
import { api, DEMO_MODE, describeError } from "@/lib/api";

const field =
  "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";

// satu halaman 2 tahap: tanpa ?token = minta tautan, dg ?token = atur kata sandi baru
function LupaContent() {
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Format email belum benar.");
    setBusy(true);
    try {
      const res = await api.forgotPassword({ email: email.trim() });
      // cuma server demo yg ngasih token (gak ada email) - server asli kirim lewat email
      if (DEMO_MODE && res.demoToken) setToken(res.demoToken);
      setSent(true);
    } catch (err) {
      setError(describeError(err, "Permintaan gagal. Coba lagi."));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Kata sandi minimal 8 karakter.");
    setBusy(true);
    try {
      await api.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(describeError(err, "Kata sandi gagal diatur ulang."));
    } finally {
      setBusy(false);
    }
  };

  const hasToken = token.length > 0;

  return (
    <AuthShell
      title={hasToken ? "Atur kata sandi baru" : "Lupa kata sandi"}
      subtitle={hasToken ? "Pilih kata sandi baru untuk akunmu." : "Masukkan email akunmu. Kami kirim tautan untuk mengaturnya ulang."}
      mood={hasToken ? "cheer" : "curious"}
    >
        <div className="space-y-4">
          {done ? (
            <div role="status" className="space-y-3 text-center">
              <p className="text-sm font-bold text-quotaSafe">Kata sandi berhasil diganti.</p>
              <Link href="/masuk" className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center justify-center">
                Masuk sekarang
              </Link>
            </div>
          ) : hasToken ? (
            <form onSubmit={reset} className="space-y-3.5" noValidate>
              {sent && DEMO_MODE && (
                <p role="status" className="text-xs text-pebble rounded-xl bg-slateElev p-3">
                  Mode demo: email tidak dikirim, jadi kamu langsung dibawa ke langkah ini.
                </p>
              )}
              <div>
                <label htmlFor="rp-pass" className="block text-xs font-bold text-pebble mb-1.5">Kata sandi baru</label>
                <input id="rp-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
                <p className="text-[11px] text-pebble mt-1">Minimal 8 karakter.</p>
              </div>
              {error && (
                <p role="alert" className="text-sm font-bold text-quotaFull flex items-start gap-2">
                  <Icon name="alert" size={18} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </p>
              )}
              <button type="submit" disabled={busy} className="btn-tactile-primary w-full min-h-[52px] px-5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
                {busy && <Icon name="loader" size={18} weight="bold" motion="spin" />}
                <span>{busy ? "Menyimpan" : "Simpan kata sandi"}</span>
              </button>
            </form>
          ) : sent ? (
            <p role="status" className="text-sm text-alabaster leading-relaxed">
              Kalau email itu terdaftar, tautan pengaturan ulang sudah dikirim. Cek kotak masuk (dan folder spam) dalam beberapa menit.
            </p>
          ) : (
            <form onSubmit={request} className="space-y-3.5" noValidate>
              <div>
                <label htmlFor="fp-email" className="block text-xs font-bold text-pebble mb-1.5">Email</label>
                <input id="fp-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
              </div>
              {error && (
                <p role="alert" className="text-sm font-bold text-quotaFull flex items-start gap-2">
                  <Icon name="alert" size={18} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </p>
              )}
              <button type="submit" disabled={busy} className="btn-tactile-primary w-full min-h-[52px] px-5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
                {busy && <Icon name="loader" size={18} weight="bold" motion="spin" />}
                <span>{busy ? "Mengirim" : "Kirim tautan"}</span>
              </button>
            </form>
          )}
        </div>

        <p className="text-center">
          <Link href="/masuk" className="inline-flex min-h-[44px] items-center text-sm font-extrabold text-vibePrimary underline underline-offset-2">
            Kembali ke halaman masuk
          </Link>
        </p>
    </AuthShell>
  );
}

export default function LupaSandiPage() {
  return (
    <Suspense fallback={null}>
      <LupaContent />
    </Suspense>
  );
}
