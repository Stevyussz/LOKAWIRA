"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { homeFor, safeNext, useAuth } from "@/components/layout/AuthProvider";
import { DEMO_MODE, describeError } from "@/lib/api";
import Icon from "@/components/ui/Icon";

type Mode = "masuk" | "daftar";

const DEMO_ACCOUNTS = [
  { label: "Wisatawan", email: "wisatawan@lokawira.demo" },
  { label: "Mitra", email: "mitra@lokawira.demo" },
  { label: "Pengelola", email: "admin@lokawira.demo" },
];

function MasukContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, status, login, register } = useAuth();

  const [mode, setMode] = useState<Mode>(params.get("mode") === "daftar" ? "daftar" : "masuk");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"VISITOR" | "MERCHANT">("MERCHANT");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // udh masuk: langssung ke tujuan
  useEffect(() => {
    if (status === "authed" && user) router.replace(safeNext(params.get("next")) ?? homeFor(user.role));
  }, [status, user, router, params]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "daftar" && name.trim().length < 2) return setError("Nama minimal 2 karakter.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Format email belum benar.");
    if (password.length < 8 && mode === "daftar") return setError("Kata sandi minimal 8 karakter.");
    if (!password) return setError("Kata sandi wajib diisi.");

    setBusy(true);
    try {
      const u =
        mode === "masuk"
          ? await login(email.trim(), password)
          : await register({ name: name.trim(), email: email.trim(), password, role });
      router.replace(safeNext(params.get("next")) ?? homeFor(u.role));
    } catch (err) {
      setError(describeError(err, "Gagal masuk. Coba lagi."));
    } finally {
      setBusy(false);
    }
  };

  const fieldClass =
    "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";

  return (
    <main className="min-h-screen flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <h1 className="font-display text-2xl font-extrabold text-alabaster">
            {mode === "masuk" ? "Masuk ke LOKAWIRA" : "Buat akun LOKAWIRA"}
          </h1>
          <p className="text-sm text-pebble">
            Untuk mitra (UMKM, sanggar) dan pengelola. Wisatawan boleh memakai aplikasi tanpa akun.
          </p>
        </div>

        <div className="gamiz-card p-5 space-y-4">
          <div role="tablist" aria-label="Masuk atau daftar" className="relative flex gap-1 bg-obsidian p-1 rounded-2xl">
            {(["masuk", "daftar"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 min-h-[44px] rounded-xl text-sm font-extrabold transition-colors ${
                  mode === m ? "bg-vibePrimary text-[var(--vibe-on-primary)]" : "text-pebble hover:text-alabaster"
                }`}
              >
                {m === "masuk" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3.5" noValidate>
            {mode === "daftar" && (
              <>
                <fieldset className="space-y-2">
                  <legend className="block text-xs font-bold text-pebble mb-1.5">Jenis akun</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: "MERCHANT", label: "Mitra", hint: "UMKM atau sanggar seni" },
                        { id: "VISITOR", label: "Wisatawan", hint: "Simpan progres petualangan" },
                      ] as const
                    ).map((o) => (
                      <label
                        key={o.id}
                        className={`min-h-[56px] p-3 rounded-xl border-2 cursor-pointer text-left ${
                          role === o.id ? "border-vibePrimary bg-[var(--vibe-surface-tint)]" : "border-stoneStrong bg-basalt"
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={o.id}
                          checked={role === o.id}
                          onChange={() => setRole(o.id)}
                          className="sr-only"
                        />
                        <span className="block text-sm font-extrabold text-alabaster">{o.label}</span>
                        <span className="block text-[11px] text-pebble">{o.hint}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="auth-name" className="block text-xs font-bold text-pebble mb-1.5">
                    {role === "MERCHANT" ? "Nama pemilik atau usaha" : "Nama"}
                  </label>
                  <input id="auth-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
                </div>
              </>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-bold text-pebble mb-1.5">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-bold text-pebble mb-1.5">
                Kata sandi
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPw ? "text" : "password"}
                  autoComplete={mode === "masuk" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${fieldClass} pr-24`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-pressed={showPw}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[44px] px-3 rounded-lg text-xs font-extrabold text-pebble hover:text-alabaster"
                >
                  {showPw ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>
              {mode === "daftar" && <p className="text-[11px] text-pebble mt-1">Minimal 8 karakter.</p>}
            </div>

            {error && (
              <p role="alert" className="text-sm font-bold text-quotaFull flex items-start gap-2">
                <Icon name="alert" size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-tactile-primary w-full min-h-[52px] px-5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {busy ? <Icon name="loader" size={18} weight="bold" motion="spin" /> : <Icon name="shield" size={18} />}
              <span>{busy ? "Memproses" : mode === "masuk" ? "Masuk" : "Buat akun"}</span>
            </button>
          </form>

          {DEMO_MODE && mode === "masuk" && (
            <div className="rounded-2xl bg-obsidian p-3.5 space-y-2">
              <p className="text-xs font-extrabold text-alabaster">Akun demo (hanya mode demo)</p>
              <p className="text-[11px] text-pebble">
                Kata sandi semuanya <span className="font-num font-bold">demo1234</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword("demo1234");
                      setError(null);
                    }}
                    className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs"
                  >
                    Isi akun {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-center">
          <Link href="/" className="text-sm font-extrabold text-vibePrimary inline-flex items-center gap-1.5 min-h-[44px]">
            <Icon name="back" size={16} weight="bold" />
            Lanjut tanpa akun, buka peta
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function MasukPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <MasukContent />
    </Suspense>
  );
}
