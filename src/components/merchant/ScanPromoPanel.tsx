"use client";

import React, { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import MoneyField from "@/components/merchant/MoneyField";
import ScanObjectEditor, { DEFAULT_TARGET } from "@/components/merchant/ScanObjectEditor";
import { api, describeError } from "@/lib/api";
import type { CulturalSpot } from "@/types/lokawira";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
const input = "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";
const labelCls = "block text-xs font-bold text-pebble mb-1.5";
export const DISCOUNT_MIN = 1000;
export const DISCOUNT_MAX = 100000;
export { DEFAULT_TARGET };

interface Props {
  mySpots: CulturalSpot[];
  setSpots: React.Dispatch<React.SetStateAction<CulturalSpot[]>>;
  accountBlocked: boolean;
  onGoRegister: () => void;
}

type Msg = { ok: boolean; text: string } | null;

// Promo & Scan: (1) objek apa yg dipotret wisatawan + foto contoh, (2) voucer hadiahnya
export default function ScanPromoPanel({ mySpots, setSpots, accountBlocked, onGoRegister }: Props) {
  const [spotId, setSpotId] = useState("");
  const spot = mySpots.find((s) => s.id === spotId) ?? mySpots[0] ?? null;

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(15000);
  const [minSpend, setMinSpend] = useState(30000);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMsg, setPromoMsg] = useState<Msg>(null);
  const [promoErrs, setPromoErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!spot) return;
    const r = spot.quest.voucherReward;
    setTitle(r.discountTitle);
    setAmount(r.discountAmount);
    setMinSpend(r.minimumSpend);
    setPromoMsg(null);
    setPromoErrs({});
  }, [spot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!spot) {
    return (
      <div className="gamiz-card p-6 text-center space-y-3">
        <p className="text-base font-extrabold text-alabaster">Belum ada lapak</p>
        <p className="text-sm text-pebble max-w-sm mx-auto">Daftarkan lapak dulu, baru kamu bisa mengatur objek yang dipindai dan voucer hadiahnya.</p>
        <button type="button" onClick={onGoRegister} className="btn-tactile-primary min-h-[48px] px-5 text-sm">Daftarkan lapak</button>
      </div>
    );
  }

  const savePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (title.trim().length < 5) errs.title = "Judul minimal 5 huruf. Contoh: Diskon belanja oleh-oleh.";
    if (amount < DISCOUNT_MIN || amount > DISCOUNT_MAX) errs.amount = `Potongan harus antara ${rupiah(DISCOUNT_MIN)} dan ${rupiah(DISCOUNT_MAX)}.`;
    if (minSpend > 10_000_000) errs.min = "Minimal belanja terlalu besar.";
    else if (minSpend > 0 && minSpend < amount) errs.min = `Minimal belanja sebaiknya tidak lebih kecil dari potongan (${rupiah(amount)}), supaya lapakmu tidak rugi.`;
    setPromoErrs(errs);
    setPromoMsg(null);
    if (Object.keys(errs).length) return;
    setPromoBusy(true);
    try {
      const res = await api.updatePromo({ spotId: spot.id, discountTitle: title.trim(), discountAmount: amount, minimumSpend: minSpend });
      setSpots(res.spots);
      setPromoMsg({ ok: true, text: "Voucer tersimpan. Wisatawan berikutnya yang berhasil memotret objekmu mendapat voucer ini." });
    } catch (err) {
      setPromoMsg({ ok: false, text: describeError(err, "Voucer gagal disimpan.") });
    } finally {
      setPromoBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="gamiz-card p-5 space-y-3">
        <h2 className="text-base font-extrabold text-alabaster">Cara kerja Promo &amp; Scan</h2>
        <ol className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          {[
            ["1", "Kamu pilih objek", "Misalnya tungku, kain batik, atau gerabah di lapakmu."],
            ["2", "Wisatawan memotretnya", "Lewat tombol Scan Objek di aplikasi, saat dia berada di lapakmu."],
            ["3", "Dia dapat voucer", "Kalau fotonya cocok, voucer dari kamu otomatis masuk ke Tas-nya."],
            ["4", "Voucer ditukar di Kasir", "Dia menunjukkan kodenya saat bayar. Kamu ketik di tab Kasir."],
          ].map(([n, t, d]) => (
            <li key={n} className="list-none rounded-2xl bg-obsidian p-3 space-y-1">
              <span className="w-7 h-7 rounded-full bg-vibePrimary text-[var(--vibe-on-primary)] text-xs font-extrabold flex items-center justify-center font-num">{n}</span>
              <p className="text-xs font-extrabold text-alabaster">{t}</p>
              <p className="text-[11px] text-pebble leading-snug">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {mySpots.length > 1 && (
        <div className="gamiz-card p-4">
          <label htmlFor="ps-spot" className={labelCls}>Atur untuk lapak</label>
          <select id="ps-spot" value={spot.id} onChange={(e) => setSpotId(e.target.value)} className={input}>
            {mySpots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <section className="gamiz-card p-5 space-y-4">
          <div>
            <h2 className="text-base font-extrabold text-alabaster flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-vibePrimary text-[var(--vibe-on-primary)] text-xs font-extrabold flex items-center justify-center font-num">1</span>
              Objek yang dipotret wisatawan
            </h2>
            <p className="text-xs text-pebble mt-1 leading-relaxed">Tulis nama objeknya, lalu unggah foto contohnya di sini. Wisatawan tidak mengunggah apa-apa, mereka cukup memotret objek aslinya di lapakmu.</p>
          </div>

          <ScanObjectEditor spot={spot} setSpots={setSpots} disabled={accountBlocked} idPrefix="ps" />
        </section>

        <form onSubmit={savePromo} className="gamiz-card p-5 space-y-4" noValidate>
          <div>
            <h2 className="text-base font-extrabold text-alabaster flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-vibePrimary text-[var(--vibe-on-primary)] text-xs font-extrabold flex items-center justify-center font-num">2</span>
              Voucer hadiah untuk wisatawan
            </h2>
            <p className="text-xs text-pebble mt-1 leading-relaxed">Voucer ini diberikan otomatis kalau wisatawan berhasil memotret objekmu. Kamu bebas menentukan nominalnya.</p>
          </div>

          <div>
            <label htmlFor="ps-title" className={labelCls}>Judul voucer</label>
            <input id="ps-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!promoErrs.title} aria-describedby={promoErrs.title ? "ps-title-err" : undefined} placeholder="Contoh: Diskon belanja oleh-oleh" className={input} />
            {promoErrs.title && <p id="ps-title-err" role="alert" className="mt-1 text-xs font-bold text-quotaFull">{promoErrs.title}</p>}
          </div>

          <MoneyField id="ps-amount" label="Potongan harga" value={amount} onChange={setAmount} presets={[5000, 10000, 15000, 20000, 25000]} help={`Boleh diketik sendiri, antara ${rupiah(DISCOUNT_MIN)} sampai ${rupiah(DISCOUNT_MAX)}.`} error={promoErrs.amount} />
          <MoneyField id="ps-min" label="Minimal belanja" value={minSpend} onChange={setMinSpend} presets={[0, 20000, 30000, 50000]} zeroLabel="Tanpa minimum" help="Belanja pengunjung harus sebesar ini supaya voucer boleh dipakai. Isi 0 kalau tanpa minimum." error={promoErrs.min} />

          <div aria-live="polite" className="rounded-2xl bg-obsidian p-3.5 text-xs text-pebble leading-relaxed">
            <p className="font-extrabold text-alabaster mb-0.5">Yang akan dilihat wisatawan</p>
            Voucer <b className="text-alabaster">{title.trim() || "(judul belum diisi)"}</b>, potongan <b className="font-num text-alabaster">{rupiah(amount)}</b>
            {minSpend > 0 ? <>, berlaku untuk belanja minimal <b className="font-num text-alabaster">{rupiah(minSpend)}</b>.</> : <>, tanpa minimal belanja.</>}
          </div>

          <button type="submit" disabled={promoBusy || accountBlocked} className="btn-tactile-primary w-full min-h-[52px] px-5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
            {promoBusy ? <Icon name="loader" size={18} weight="bold" motion="spin" /> : <Icon name="ticket" size={18} />}
            <span>{promoBusy ? "Menyimpan" : "Simpan voucer"}</span>
          </button>
          {promoMsg && <p role={promoMsg.ok ? "status" : "alert"} className={`text-sm font-bold ${promoMsg.ok ? "text-quotaSafe" : "text-quotaFull"}`}>{promoMsg.text}</p>}
        </form>
      </div>
    </div>
  );
}
