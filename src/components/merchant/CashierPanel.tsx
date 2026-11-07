"use client";

import React, { useState } from "react";
import Icon from "@/components/ui/Icon";
import { isExpired } from "@/lib/formatTime";
import { api, ApiError, DEMO_MODE, describeError } from "@/lib/api";
import type { IssuedVoucher } from "@/types/lokawira";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

type Kind = "VOUCHER" | "VISIT";
// LKW- = voucer diskon, KDR- = bukti hadir. Angka doang (tanpa awalan) ditolak biar gak ketuker
function detect(raw: string): { kind: Kind; code: string } | null {
  const c = raw.toUpperCase().replace(/\s+/g, "");
  const m = c.match(/^(LKW|KDR)-?(\d{4,})$/);
  if (!m) return null;
  return { kind: m[1] === "LKW" ? "VOUCHER" : "VISIT", code: `${m[1]}-${m[2]}` };
}

interface Props {
  myVouchers: IssuedVoucher[];
  setVouchers: React.Dispatch<React.SetStateAction<IssuedVoucher[]>>;
  noLapak: boolean;
  onGoRegister: () => void;
  initialCode?: string;
}

type Result = { ok: boolean; title: string; text: string };

// Kasir: satu kotak kode buat dua urusan, voucer diskon (LKW-) dan bukti hadir pengunjung (KDR-)
export default function CashierPanel({ myVouchers, setVouchers, noLapak, onGoRegister, initialCode = "" }: Props) {
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const guess = detect(code);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = detect(code);
    if (!d) {
      setResult({ ok: false, title: "Kodenya belum benar", text: "Kode diawali LKW- (voucer diskon) atau KDR- (bukti hadir), lalu angka. Contoh: LKW-849201. Cek lagi layar pengunjung." });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      if (d.kind === "VOUCHER") {
        const data = await api.redeemVoucher(d.code);
        if (Array.isArray(data.vouchers)) setVouchers(data.vouchers);
        setResult({
          ok: true,
          title: "Voucer sah. Beri potongan harga",
          text: `Potong ${rupiah(data.redeemedVoucher.discountAmount)} dari belanjaan pengunjung${data.redeemedVoucher.minimumSpend > 0 ? ` (belanja minimal ${rupiah(data.redeemedVoucher.minimumSpend)})` : ""}. Voucer ini sudah terpakai dan tidak bisa dipakai lagi.`,
        });
      } else {
        const res = await api.verifyCheckIn({ code: d.code });
        setResult({
          ok: true,
          title: "Kehadiran terverifikasi",
          text:
            res.visitorHasAccount === false
              ? `Pengunjung benar hadir di ${res.spotName}. Ia belum punya akun, jadi hadiah XP tidak tercatat. Sarankan ia daftar di LOKAWIRA agar hadiah berikutnya tersimpan. Kode ini tidak bisa dipakai lagi.`
              : `Pengunjung benar hadir di ${res.spotName}. Hadiah misi +${res.awardedPoints} XP sudah masuk ke akunnya. Kode ini tidak bisa dipakai lagi.`,
        });
      }
      setCode("");
    } catch (err) {
      if (d.kind === "VOUCHER" && err instanceof ApiError && err.isOffline && DEMO_MODE) {
        const local = myVouchers.find((v) => v.code.toUpperCase() === d.code);
        if (local && local.status === "ACTIVE") {
          const updated: IssuedVoucher = { ...local, status: "REDEEMED", redeemedAt: new Date().toISOString() };
          setVouchers((prev) => prev.map((v) => (v.code === local.code ? updated : v)));
          setResult({ ok: true, title: "Voucer dicatat di perangkat ini", text: "Mode demo: server tidak terjangkau." });
          setCode("");
          return;
        }
      }
      setResult({ ok: false, title: "Belum berhasil", text: describeError(err, "Kode tidak bisa diproses. Coba lagi.") });
    } finally {
      setBusy(false);
    }
  };

  if (noLapak) {
    return (
      <div className="gamiz-card p-6 text-center space-y-3">
        <div className="mx-auto w-14 h-14 rounded-3xl bg-slateElev flex items-center justify-center text-vibePrimary">
          <Icon name="umkm" size={30} />
        </div>
        <p className="text-base font-extrabold text-alabaster">Belum ada lapak</p>
        <p className="text-sm text-pebble max-w-sm mx-auto">Kasir baru bisa dipakai setelah lapakmu terdaftar. Daftarkan dulu, cuma beberapa menit.</p>
        <button type="button" onClick={onGoRegister} className="btn-tactile-primary min-h-[48px] px-5 text-sm">Daftarkan lapak</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <section className="lg:col-span-7 gamiz-card p-5 space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-alabaster">Kasir: periksa kode pengunjung</h2>
          <p className="text-xs text-pebble mt-1 leading-relaxed">
            Minta pengunjung menunjukkan kode di layar HP-nya, lalu ketik di sini. Aplikasi otomatis tahu itu voucer diskon atau bukti hadir.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <label htmlFor="kasir-code" className="block text-xs font-bold text-pebble mb-1.5">Kode dari pengunjung</label>
            <input
              id="kasir-code"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setResult(null);
              }}
              placeholder="LKW-849201 atau KDR-123456"
              aria-describedby="kasir-hint"
              className="w-full min-h-[56px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong font-num text-xl font-extrabold tracking-wider text-alabaster placeholder:text-ashMuted placeholder:text-sm placeholder:font-bold placeholder:tracking-normal"
            />
            <p id="kasir-hint" aria-live="polite" className="mt-1.5 text-[11px] font-bold text-pebble min-h-[1rem]">
              {guess ? (guess.kind === "VOUCHER" ? "Ini voucer diskon. Akan ditukar dengan potongan harga." : "Ini bukti hadir. Akan dicatat sebagai kunjungan yang sah.") : "Kode diawali LKW- (voucer) atau KDR- (bukti hadir)."}
            </p>
          </div>
          <button type="submit" disabled={busy} className="btn-tactile-primary w-full min-h-[54px] px-6 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
            {busy ? <Icon name="loader" size={20} weight="bold" motion="spin" /> : <Icon name="shield" size={20} />}
            <span>{busy ? "Memeriksa" : guess?.kind === "VISIT" ? "Verifikasi kehadiran" : guess?.kind === "VOUCHER" ? "Tukarkan voucer" : "Periksa kode"}</span>
          </button>
        </form>

        {result && (
          <div role="status" aria-live="polite" className={`p-4 rounded-2xl border-2 bg-obsidian ${result.ok ? "border-quotaSafe" : "border-quotaFull"}`}>
            <div className="flex items-start gap-2.5">
              <Icon name={result.ok ? "check" : "alert"} size={22} className={`mt-0.5 shrink-0 ${result.ok ? "text-quotaSafe" : "text-quotaFull"}`} />
              <div>
                <p className="text-sm font-extrabold text-alabaster">{result.title}</p>
                <p className="text-xs text-pebble mt-0.5 leading-relaxed">{result.text}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-obsidian p-3.5 space-y-1">
            <p className="text-xs font-extrabold text-alabaster flex items-center gap-1.5"><Icon name="ticket" size={16} className="text-vibePrimary" /> Kode LKW-</p>
            <p className="text-[11px] text-pebble leading-snug">Voucer diskon. Pengunjung menunjukkannya saat bayar. Kamu potong harganya sebesar nilai voucer.</p>
          </div>
          <div className="rounded-2xl bg-obsidian p-3.5 space-y-1">
            <p className="text-xs font-extrabold text-alabaster flex items-center gap-1.5"><Icon name="seal" size={16} className="text-vibeSecondary" /> Kode KDR-</p>
            <p className="text-[11px] text-pebble leading-snug">Bukti hadir. Pengunjung menunjukkannya setelah check-in di lapakmu. Kamu ketik di sini supaya dia dapat hadiah misi.</p>
          </div>
        </div>
      </section>

      <section className="lg:col-span-5 gamiz-card p-5 space-y-3">
        <h2 className="text-sm font-extrabold text-alabaster">Voucer untuk lapakmu ({myVouchers.length})</h2>
        {myVouchers.length === 0 ? (
          <p className="text-sm text-pebble">Belum ada voucer. Voucer muncul setelah wisatawan memotret objek di lapakmu. Atur objeknya di tab Promo &amp; Scan.</p>
        ) : (
          <ul className="space-y-2.5">
            {myVouchers.map((v) => {
              const expired = v.status === "ACTIVE" && isExpired(v.expiresAt);
              const live = v.status === "ACTIVE" && !expired;
              return (
              <li key={v.code} className="list-none rounded-2xl border border-stoneSubtle bg-basalt p-3.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className={`font-num text-sm font-extrabold block ${live ? "text-quotaSafe" : "text-pebble"}`}>{v.code}</span>
                  <p className="text-xs font-bold text-alabaster mt-0.5 truncate">{v.merchantName}</p>
                  <p className="font-num text-[11px] text-vibeSecondary">-{rupiah(v.discountAmount)}</p>
                </div>
                {live ? (
                  <button type="button" onClick={() => { setCode(v.code); setResult(null); }} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs">Pilih</button>
                ) : (
                  <span className="text-[11px] font-bold text-pebble">{expired ? "Kedaluwarsa" : "Sudah dipakai"}</span>
                )}
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
