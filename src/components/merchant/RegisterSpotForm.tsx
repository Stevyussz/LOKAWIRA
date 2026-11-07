"use client";

import React, { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import LocationPicker from "@/components/map/LocationPicker";
import MoneyField from "@/components/merchant/MoneyField";
import { DISCOUNT_MAX, DISCOUNT_MIN } from "@/components/merchant/ScanPromoPanel";
import { MAX_REFERENCE_PHOTOS } from "@/components/merchant/ReferencePhotos";
import StagedPhotos, { Staged } from "@/components/merchant/StagedPhotos";
import { api, ApiError, DEMO_MODE, describeError } from "@/lib/api";
import type { LatLng } from "@/lib/geo";
import { matchRegion } from "@/lib/regionMatch";
import { useLokawira } from "@/components/layout/LokawiraProvider";
import ScheduleFields, { scheduleErrors, scheduleFrom, schedulePayload, type ScheduleValue } from "@/components/merchant/ScheduleFields";
import type { CulturalSpot, CulturalVibe, OpkCategory, SpotType } from "@/types/lokawira";

type LapakType = Exclude<SpotType, "PRIMARY_DEST">;
const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
const OPK_BY_TYPE: Record<LapakType, OpkCategory> = {
  SANGGAR_SENI: "Seni",
  UMKM_KULINER: "Pengetahuan Tradisional",
  UMKM_KRIYA: "Teknologi Tradisional",
};
const FACILITY_OPTIONS = ["Pembayaran QRIS", "Parkir", "Ramah kursi roda", "Tempat duduk", "Toilet"];
const input = "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";
const labelCls = "block text-xs font-bold text-pebble mb-1.5";

function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? <p id={id} role="alert" className="mt-1 text-xs font-bold text-quotaFull">{msg}</p> : null;
}
function StepHead({ n, title, hint }: { n: string; title: string; hint?: string }) {
  return (
    <div className="pt-1">
      <h3 className="text-sm font-extrabold text-alabaster flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-vibePrimary text-[var(--vibe-on-primary)] text-[11px] font-extrabold flex items-center justify-center font-num shrink-0">{n}</span>
        {title}
      </h3>
      {hint && <p className="text-[11px] text-pebble mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

interface Props {
  userId?: string;
  isAdmin: boolean;
  accountBlocked: boolean;
  activeVibe: CulturalVibe;
  spots: CulturalSpot[];
  setSpots: React.Dispatch<React.SetStateAction<CulturalSpot[]>>;
}

// formulir daftar lapak baru, dibagi langkah-langkah biar gampang diikuti
export default function RegisterSpotForm({ userId, isAdmin, accountBlocked, activeVibe, spots, setSpots }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<LapakType>("UMKM_KRIYA");
  // kawasan gak dipilih manual lagi: ditentukan dr lokasi pin (sama persis dgn hitungan server)
  const { regions, activeRegion } = useLokawira();
  const [proposal, setProposal] = useState("");
  const [address, setAddress] = useState("");
  const [story, setStory] = useState("");
  const [pin, setPin] = useState<LatLng | null>(null);
  const [riddle, setRiddle] = useState("");
  const [target, setTarget] = useState("");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [capacity, setCapacity] = useState(30);
  // lapak mitra bawaannya masuk bebas tanpa jam buka
  const [sched, setSched] = useState<ScheduleValue>(() => scheduleFrom(null, "UMKM_KRIYA"));
  const [voucherTitle, setVoucherTitle] = useState("Voucer kunjungan lapak");
  const [discount, setDiscount] = useState(15000);
  const [minSpend, setMinSpend] = useState(30000);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const regionSpots = useMemo(() => spots.filter((s) => s.regionId === activeRegion?.id), [spots, activeRegion?.id]);
  const detected = pin ? matchRegion(pin, regions) : null;

  const reset = () => {
    setName("");
    setAddress("");
    setStory("");
    setRiddle("");
    setTarget("");
    staged.forEach((s) => URL.revokeObjectURL(s.url));
    setStaged([]);
    setFacilities([]);
    setSched(scheduleFrom(null, "UMKM_KRIYA"));
    setPin(null);
    setProposal("");
    setErrors({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 3) errs.name = "Nama lapak minimal 3 huruf.";
    if (address.trim().length < 5) errs.address = "Isi alamat atau patokan agar wisatawan mudah menemukan.";
    if (!pin) errs.pin = "Taruh pin lokasi lapak di peta. Cari alamat, pakai lokasimu, atau ketuk peta.";
    if (riddle.trim().length < 10) errs.riddle = "Tulis petunjuk misi, minimal 10 huruf.";
    if (target.trim().length < 5) errs.target = "Tulis objek yang harus dipotret wisatawan, minimal 5 huruf.";
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 500) errs.capacity = "Kapasitas 1 sampai 500 orang.";
    if (voucherTitle.trim().length < 5) errs.vtitle = "Judul voucer minimal 5 huruf.";
    if (discount < DISCOUNT_MIN || discount > DISCOUNT_MAX) errs.discount = `Potongan harus antara ${rupiah(DISCOUNT_MIN)} dan ${rupiah(DISCOUNT_MAX)}.`;
    if (minSpend > 0 && minSpend < discount) errs.min = `Minimal belanja sebaiknya tidak lebih kecil dari potongan (${rupiah(discount)}).`;
    Object.assign(errs, scheduleErrors(sched, false));
    setErrors(errs);
    setMsg(null);
    if (Object.keys(errs).length > 0 || !pin) return;

    const nm = name.trim();
    const draft: CulturalSpot = {
      id: "draft", // diganti server
      name: nm,
      // server yg nentuin kawasan final; ini cuma perkiraan buat tampilan sebelum dibalas server
      regionName: detected ? `${detected.name}, ${detected.label}` : "Di luar kawasan",
      ...(detected ? {} : proposal.trim() ? { regionProposal: proposal.trim() } : {}),
      vibe: detected?.theme ?? activeRegion?.theme ?? activeVibe,
      spotType: type,
      opkCategory: OPK_BY_TYPE[type],
      coordinates: pin,
      address: address.trim(),
      facilities,
      ...(() => {
        const sp = schedulePayload(sched, false);
        return { entry: sp.entry, ...(sp.openingHours ? { openingHours: sp.openingHours } : {}) };
      })(),
      quota: { currentVisitors: 0, maxCapacity: capacity, estimatedWaitMinutes: 0, nextAvailableSlot: "Tersedia langsung" },
      quest: {
        riddleTitle: `Misi ${nm}`,
        riddleClue: riddle.trim(),
        targetObjectPrompt: target.trim(),
        verifiedLoreSource: "Keterangan mitra (belum diverifikasi pengelola)",
        loreNarrative: story.trim() || `${nm} adalah mitra ekonomi sirkular LOKAWIRA.`,
        rewardPoints: 100,
        voucherReward: { merchantName: nm, discountTitle: voucherTitle.trim(), discountAmount: discount, minimumSpend: minSpend },
      },
    };

    setBusy(true);
    try {
      const res = await api.addSpot(draft);
      setSpots(res.spots);
      let photoNote = "";
      if (staged.length > 0) {
        let ok = 0;
        for (const s of staged) {
          try {
            const up = await api.uploadReferenceImage(res.spot.id, s.blob);
            ok++;
            setSpots((prev) => prev.map((x) => (x.id === res.spot.id ? { ...x, quest: { ...x.quest, referenceImages: up.referenceImages } } : x)));
          } catch {
            break;
          }
        }
        if (ok < staged.length) photoNote = ` ${staged.length - ok} foto belum terunggah. Tambahkan lewat tab Promo & Scan.`;
      }
      setMsg({
        ok: true,
        text:
          (res.spot.status === "PENDING_REVIEW"
            ? `Lapak "${res.spot.name}" terkirim. Tampil di peta setelah pengelola menyetujui. Kamu bisa cek statusnya di daftar Lapak Saya.`
            : `Lapak "${res.spot.name}" tersimpan dan tampil di peta wisatawan.`) + photoNote,
      });
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.isOffline && DEMO_MODE) {
        setSpots((prev) => [{ ...draft, id: `local-${Date.now().toString(36)}`, ownerId: userId }, ...prev]);
        setMsg({ ok: true, text: `Lapak "${nm}" hanya muncul di perangkat ini (mode demo, server tidak terjangkau).` });
        reset();
      } else {
        setMsg({ ok: false, text: describeError(err, "Lapak gagal didaftarkan.") });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="gamiz-card p-5 space-y-5" noValidate>
      <div>
        <h2 className="text-base font-extrabold text-alabaster">Daftarkan lapak baru</h2>
        <p className="text-xs text-pebble mt-1 leading-relaxed">
          Isi lima bagian di bawah, dari atas ke bawah. {isAdmin ? "Lapak langsung tampil di peta." : "Setelah dikirim, pengelola memeriksa dulu sebelum lapakmu tampil di peta."}
        </p>
      </div>

      <StepHead n="1" title="Tentang lapak" />
      <div>
        <label htmlFor="lapak-name" className={labelCls}>Nama sanggar atau UMKM</label>
        <input id="lapak-name" type="text" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? "err-name" : undefined} placeholder="Contoh: Gerabah Bu Sari" className={input} />
        <FieldError id="err-name" msg={errors.name} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="lapak-type" className={labelCls}>Jenis usaha</label>
          <select id="lapak-type" value={type} onChange={(e) => setType(e.target.value as LapakType)} className={input}>
            <option value="UMKM_KRIYA">UMKM kriya &amp; oleh-oleh</option>
            <option value="UMKM_KULINER">UMKM makan &amp; minum</option>
            <option value="SANGGAR_SENI">Sanggar seni</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="lapak-story" className={labelCls}>Cerita singkat lapak (boleh dikosongkan)</label>
        <textarea id="lapak-story" rows={2} value={story} onChange={(e) => setStory(e.target.value)} placeholder="Contoh: Gerabah ini dibuat turun-temurun sejak 1980." className={`${input} py-3`} />
      </div>

      <StepHead n="2" title="Lokasi lapak di peta" hint="Cari alamat, atau tekan Pakai lokasiku sekarang kalau kamu sedang di lapak. Pin bisa digeser supaya pas." />
      <div>
        <LocationPicker spots={regionSpots} value={pin} onChange={(c) => { setPin(c); setErrors((x) => ({ ...x, pin: "" })); }} label="Lokasi lapak" />
        <FieldError id="err-pin" msg={errors.pin} />
        {pin && (
          detected ? (
            <p role="status" className="mt-2 text-xs text-alabaster rounded-xl bg-slateElev p-3">
              Lapakmu masuk kawasan <b>{detected.name}</b> ({detected.label}).
            </p>
          ) : (
            <div role="status" className="mt-2 rounded-xl bg-slateElev p-3 space-y-2">
              <p className="text-xs text-alabaster leading-relaxed">
                Lokasi ini di luar kawasan LOKAWIRA yang sudah ada. Lapakmu tetap bisa dikirim. Pengelola akan menambah kawasan baru atau menghubungimu sebelum lapak tampil di peta.
              </p>
              <label htmlFor="lapak-proposal" className={labelCls}>Usulkan nama kawasan (boleh dikosongkan)</label>
              <input id="lapak-proposal" type="text" maxLength={80} value={proposal} onChange={(e) => setProposal(e.target.value)} placeholder="Contoh: Kampung Batik Tanjung Bumi" className={input} />
            </div>
          )
        )}
      </div>
      <div>
        <label htmlFor="lapak-address" className={labelCls}>Alamat atau patokan</label>
        <input id="lapak-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} aria-invalid={!!errors.address} aria-describedby={errors.address ? "err-address" : undefined} placeholder="Contoh: Gang Prasasti No. 4, seberang kolam" className={input} />
        <FieldError id="err-address" msg={errors.address} />
      </div>

      <StepHead n="3" title="Misi untuk wisatawan" hint="Wisatawan datang, mengikuti petunjuk, lalu memotret objek yang kamu tentukan. Kalau cocok, mereka dapat voucer dan poin." />
      <div>
        <label htmlFor="lapak-riddle" className={labelCls}>Petunjuk menuju objek</label>
        <textarea id="lapak-riddle" rows={2} value={riddle} onChange={(e) => setRiddle(e.target.value)} aria-invalid={!!errors.riddle} aria-describedby={errors.riddle ? "err-riddle" : undefined} placeholder="Contoh: Cari tungku tanah liat di halaman belakang, dekat pohon mangga." className={`${input} py-3`} />
        <FieldError id="err-riddle" msg={errors.riddle} />
      </div>
      <div>
        <label htmlFor="lapak-target" className={labelCls}>Objek yang harus dipotret</label>
        <input id="lapak-target" type="text" value={target} onChange={(e) => setTarget(e.target.value)} aria-invalid={!!errors.target} aria-describedby={errors.target ? "err-target" : "help-target"} placeholder="Contoh: Tungku tanah liat" className={input} />
        <p id="help-target" className="mt-1.5 text-[11px] text-pebble leading-snug">Satu benda yang jelas dan khas di lapakmu.</p>
        <FieldError id="err-target" msg={errors.target} />
      </div>
      <div className="space-y-2">
        <p className={labelCls}>Foto contoh objek (disarankan, maksimal {MAX_REFERENCE_PHOTOS})</p>
        <StagedPhotos idPrefix="lapak" items={staged} onChange={setStaged} />
        <p className="text-[11px] text-pebble leading-snug">Foto satu objek, dari dekat, di tempat terang. Foto dikirim bersama lapak dan bisa ditambah lagi nanti di tab Promo &amp; Scan.</p>
      </div>

      <StepHead n="4" title="Fasilitas dan kapasitas" />
      <fieldset>
        <legend className={labelCls}>Fasilitas yang benar-benar ada</legend>
        <div className="flex flex-wrap gap-2">
          {FACILITY_OPTIONS.map((f) => {
            const on = facilities.includes(f);
            return (
              <label key={f} className={`min-h-[44px] px-3.5 rounded-xl border-2 text-xs font-extrabold inline-flex items-center cursor-pointer ${on ? "border-vibePrimary bg-[var(--vibe-surface-tint)] text-alabaster" : "border-stoneStrong bg-basalt text-pebble"}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => setFacilities((p) => (on ? p.filter((x) => x !== f) : [...p, f]))} />
                {f}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="max-w-[240px]">
        <label htmlFor="lapak-cap" className={labelCls}>Berapa orang bisa masuk sekaligus?</label>
        <input id="lapak-cap" type="number" inputMode="numeric" min={1} max={500} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} aria-invalid={!!errors.capacity} aria-describedby={errors.capacity ? "err-cap" : undefined} className={`${input} font-num`} />
        <FieldError id="err-cap" msg={errors.capacity} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-extrabold text-alabaster">Cara masuk dan jam buka</p>
        <ScheduleFields id="lapak-sched" value={sched} onChange={setSched} errors={errors} allowEvent={false} />
      </div>

      <StepHead n="5" title="Voucer hadiah" hint="Diberikan otomatis ke wisatawan yang berhasil memotret objekmu. Nominal bebas kamu tentukan dan bisa diubah kapan saja di tab Promo & Scan." />
      <div>
        <label htmlFor="lapak-vtitle" className={labelCls}>Judul voucer</label>
        <input id="lapak-vtitle" type="text" value={voucherTitle} onChange={(e) => setVoucherTitle(e.target.value)} aria-invalid={!!errors.vtitle} aria-describedby={errors.vtitle ? "err-vtitle" : undefined} className={input} />
        <FieldError id="err-vtitle" msg={errors.vtitle} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MoneyField id="lapak-disc" label="Potongan harga" value={discount} onChange={setDiscount} presets={[5000, 10000, 15000, 20000]} error={errors.discount} help={`Boleh diketik sendiri, ${rupiah(DISCOUNT_MIN)} sampai ${rupiah(DISCOUNT_MAX)}.`} />
        <MoneyField id="lapak-min" label="Minimal belanja" value={minSpend} onChange={setMinSpend} presets={[0, 20000, 30000, 50000]} zeroLabel="Tanpa minimum" error={errors.min} help="Isi 0 kalau tanpa minimum." />
      </div>

      <button type="submit" disabled={busy || accountBlocked} className="btn-tactile-primary w-full min-h-[52px] px-5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
        {busy ? <Icon name="loader" size={18} weight="bold" motion="spin" /> : <Icon name="plusCircle" size={18} />}
        <span>{busy ? "Menyimpan" : accountBlocked ? "Menunggu persetujuan pengelola" : isAdmin ? "Simpan lapak ke peta" : "Kirim lapak untuk ditinjau"}</span>
      </button>
      {Object.keys(errors).some((k) => errors[k]) && <p role="alert" className="text-xs font-bold text-quotaFull">Masih ada isian yang perlu diperbaiki. Lihat tulisan merah di atas.</p>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm font-bold ${msg.ok ? "text-quotaSafe" : "text-quotaFull"}`}>{msg.text}</p>}
    </form>
  );
}
