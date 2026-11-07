"use client";

import React, { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import LocationPicker from "@/components/map/LocationPicker";
import MoneyField from "@/components/merchant/MoneyField";
import StagedPhotos, { Staged } from "@/components/merchant/StagedPhotos";
import { MAX_REFERENCE_PHOTOS } from "@/components/merchant/ReferencePhotos";
import { api, describeError } from "@/lib/api";
import type { LatLng } from "@/lib/geo";
import { matchRegion } from "@/lib/regionMatch";
import { useLokawira } from "@/components/layout/LokawiraProvider";
import type { CulturalSpot, CulturalVibe, OpkCategory, SpotType } from "@/types/lokawira";
import ScheduleFields, { scheduleErrors, scheduleFrom, schedulePayload, type ScheduleValue } from "@/components/merchant/ScheduleFields";

const FIELD = "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";
const LABEL = "block text-xs font-bold text-pebble mb-1.5";
const OPK_OPTIONS: OpkCategory[] = ["Cagar Budaya", "Tradisi Lisan", "Manuskrip", "Adat Istiadat", "Ritus", "Pengetahuan Tradisional", "Teknologi Tradisional", "Seni", "Bahasa", "Permainan Rakyat", "Olahraga Tradisional"];
const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

function Err({ msg }: { msg?: string }) {
  return msg ? <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{msg}</p> : null;
}
function Head({ n, title, hint }: { n: string; title: string; hint?: string }) {
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
  spots: CulturalSpot[];
  setSpots: React.Dispatch<React.SetStateAction<CulturalSpot[]>>;
  defaultRegion: CulturalVibe;
  onToast: (text: string, isError?: boolean) => void;
}

// pengelola menambah titik resmi (cagar, sanggar, UMKM). Langsung tampil di peta
export default function AdminSpotForm({ spots, setSpots, defaultRegion, onToast }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<SpotType>("PRIMARY_DEST");
  // kawasan cuma buat mindahin peta; kawasan titik final ditentukan dr lokasi pin
  const { regions } = useLokawira();
  const [region, setRegion] = useState<string>(() => regions.find((r) => r.theme === defaultRegion)?.id ?? regions[0]?.id ?? "");
  const [opk, setOpk] = useState<OpkCategory>("Cagar Budaya");
  const [address, setAddress] = useState("");
  const [source, setSource] = useState("");
  const [story, setStory] = useState("");
  const [riddle, setRiddle] = useState("");
  const [target, setTarget] = useState("");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [capacity, setCapacity] = useState(150);
  const [sched, setSched] = useState<ScheduleValue>(() => scheduleFrom(null, "PRIMARY_DEST"));
  const [xp, setXp] = useState(150);
  const [vTitle, setVTitle] = useState("Voucer kunjungan");
  const [discount, setDiscount] = useState(10000);
  const [minSpend, setMinSpend] = useState(20000);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const regionSpots = useMemo(() => spots.filter((x) => x.regionId === region), [spots, region]);
  const detected = pin ? matchRegion(pin, regions) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 3) errs.name = "Nama minimal 3 huruf.";
    if (!pin) errs.pin = "Taruh pin lokasi di peta. Cari alamat, pakai lokasimu, atau ketuk peta.";
    else if (!matchRegion(pin, regions)) errs.pin = "Lokasi ini di luar semua kawasan. Buat atau perluas kawasan dulu di tab Kawasan.";
    if (address.trim().length < 5) errs.address = "Isi alamat atau patokan.";
    if (source.trim().length < 5) errs.source = "Sumber rujukan wajib diisi supaya cerita Loka bisa dipertanggungjawabkan.";
    if (story.trim().length < 20) errs.story = "Narasi minimal 20 huruf.";
    if (riddle.trim().length < 10) errs.riddle = "Tulis teka-teki misi, minimal 10 huruf.";
    if (target.trim().length < 5) errs.target = "Tulis objek yang harus dipotret wisatawan, minimal 5 huruf.";
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 5000) errs.capacity = "Kapasitas 1 sampai 5.000 orang.";
    if (!Number.isFinite(xp) || xp < 0 || xp > 1000) errs.xp = "Hadiah XP 0 sampai 1.000.";
    if (vTitle.trim().length < 5) errs.vtitle = "Judul voucer minimal 5 huruf.";
    if (discount < 1000 || discount > 100000) errs.discount = `Potongan harus antara ${rupiah(1000)} dan ${rupiah(100000)}.`;
    Object.assign(errs, scheduleErrors(sched, true));
    setErrors(errs);
    if (Object.keys(errs).length > 0 || !pin) return;

    const nm = name.trim();
    const draft: CulturalSpot = {
      id: "draft",
      name: nm,
      regionName: detected ? `${detected.name}, ${detected.label}` : "",
      vibe: detected?.theme ?? defaultRegion,
      spotType: type,
      opkCategory: opk,
      coordinates: pin,
      address: address.trim(),
      facilities: [],
      ...(() => {
        const sp = schedulePayload(sched, true);
        return { entry: sp.entry, ...(sp.openingHours ? { openingHours: sp.openingHours } : {}), ...(sp.event ? { event: sp.event } : {}) };
      })(),
      quota: { currentVisitors: 0, maxCapacity: capacity, estimatedWaitMinutes: 0, nextAvailableSlot: "Tersedia langsung" },
      quest: {
        riddleTitle: `Misi ${nm}`,
        riddleClue: riddle.trim(),
        targetObjectPrompt: target.trim(),
        verifiedLoreSource: source.trim(),
        loreNarrative: story.trim(),
        rewardPoints: xp,
        voucherReward: { merchantName: nm, discountTitle: vTitle.trim(), discountAmount: discount, minimumSpend: minSpend },
      },
    };
    setBusy(true);
    try {
      const res = await api.addSpot(draft);
      setSpots(res.spots);
      let miss = 0;
      for (const s of staged) {
        try {
          const up = await api.uploadReferenceImage(res.spot.id, s.blob);
          setSpots((prev) => prev.map((x) => (x.id === res.spot.id ? { ...x, quest: { ...x.quest, referenceImages: up.referenceImages } } : x)));
        } catch {
          miss++;
        }
      }
      onToast(`Titik "${res.spot.name}" tersimpan dan tampil di peta wisatawan.${miss ? ` ${miss} foto belum terunggah, tambahkan lewat tombol Objek & foto di daftar titik.` : ""}`, miss > 0);
      staged.forEach((s) => URL.revokeObjectURL(s.url));
      setStaged([]);
      setName(""); setAddress(""); setSource(""); setStory(""); setRiddle(""); setTarget(""); setPin(null); setErrors({}); setSched(scheduleFrom(null, "PRIMARY_DEST"));
    } catch (err) {
      onToast(describeError(err, "Titik gagal disimpan."), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="gamiz-card p-5 space-y-5" noValidate>
      <div>
        <h2 className="text-base font-extrabold text-alabaster">Tambah titik baru</h2>
        <p className="text-xs text-pebble mt-1 leading-relaxed">Untuk cagar budaya, sanggar, atau UMKM resmi. Titik dari pengelola langsung tampil di peta tanpa antre persetujuan. Isi lima bagian dari atas ke bawah.</p>
      </div>

      <Head n="1" title="Tentang titik" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor="ns-name" className={LABEL}>Nama titik</label>
          <input id="ns-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Candi Bajang Ratu" className={FIELD} />
          <Err msg={errors.name} />
        </div>
        <div>
          <label htmlFor="ns-type" className={LABEL}>Jenis</label>
          <select id="ns-type" value={type} onChange={(e) => setType(e.target.value as SpotType)} className={FIELD}>
            <option value="PRIMARY_DEST">Cagar budaya utama</option>
            <option value="SANGGAR_SENI">Sanggar seni</option>
            <option value="UMKM_KULINER">UMKM makan &amp; minum</option>
            <option value="UMKM_KRIYA">UMKM kriya &amp; oleh-oleh</option>
          </select>
        </div>
        <div>
          <label htmlFor="ns-region" className={LABEL}>Tampilkan peta kawasan</label>
          <select id="ns-region" value={region} onChange={(e) => { setRegion(e.target.value); setPin(null); }} className={FIELD}>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.label}{r.status === "DRAFT" ? " (draf)" : ""}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ns-opk" className={LABEL}>Kategori budaya (OPK)</label>
          <select id="ns-opk" value={opk} onChange={(e) => setOpk(e.target.value as OpkCategory)} className={FIELD}>
            {OPK_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <p className="mt-1.5 text-[11px] text-pebble leading-snug">OPK = Objek Pemajuan Kebudayaan (UU No. 5 Tahun 2017). Pilih yang paling dekat.</p>
        </div>
      </div>

      <Head n="2" title="Lokasi di peta" hint="Cari alamat, atau tekan Pakai lokasiku sekarang kalau kamu sedang di sana. Pin bisa digeser supaya pas." />
      <div>
        <LocationPicker spots={regionSpots} value={pin} onChange={(c) => { setPin(c); setErrors((x) => ({ ...x, pin: "" })); }} label="Lokasi titik" />
        <Err msg={errors.pin} />
        {pin && detected && (
          <p role="status" className="mt-2 text-xs text-alabaster rounded-xl bg-slateElev p-3">
            Titik ini masuk kawasan <b>{detected.name}</b> ({detected.label}){detected.status === "DRAFT" ? ", masih draf: titik tampil setelah kawasan diaktifkan" : ""}.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="ns-address" className={LABEL}>Alamat atau patokan</label>
        <input id="ns-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={FIELD} />
        <Err msg={errors.address} />
      </div>

      <Head n="3" title="Cerita untuk Loka" hint="Loka hanya boleh bercerita dari sumber yang jelas. Isi dengan data yang sudah kamu verifikasi." />
      <div>
        <label htmlFor="ns-source" className={LABEL}>Sumber rujukan terverifikasi</label>
        <input id="ns-source" type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Contoh: PPKD Kabupaten Mojokerto" className={FIELD} />
        <Err msg={errors.source} />
      </div>
      <div>
        <label htmlFor="ns-story" className={LABEL}>Narasi Loka</label>
        <textarea id="ns-story" rows={3} value={story} onChange={(e) => setStory(e.target.value)} placeholder="Ceritakan sejarah dan keunikan tempat ini dengan bahasa sederhana." className={`${FIELD} py-3`} />
        <Err msg={errors.story} />
      </div>

      <Head n="4" title="Misi untuk wisatawan" hint="Wisatawan mengikuti petunjuk, lalu memotret objek yang kamu tentukan. Kalau cocok, mereka dapat XP dan voucer." />
      <div>
        <label htmlFor="ns-riddle" className={LABEL}>Teka-teki atau petunjuk misi</label>
        <textarea id="ns-riddle" rows={2} value={riddle} onChange={(e) => setRiddle(e.target.value)} className={`${FIELD} py-3`} />
        <Err msg={errors.riddle} />
      </div>
      <div>
        <label htmlFor="ns-target" className={LABEL}>Objek yang harus dipotret</label>
        <input id="ns-target" type="text" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Contoh: Gapura bata merah" className={FIELD} />
        <Err msg={errors.target} />
      </div>
      <div className="space-y-2">
        <p className={LABEL}>Foto contoh objek (disarankan, maksimal {MAX_REFERENCE_PHOTOS})</p>
        <StagedPhotos idPrefix="ns" items={staged} onChange={setStaged} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-extrabold text-alabaster">Cara masuk dan jadwal</p>
        <ScheduleFields id="ns-sched" value={sched} onChange={setSched} errors={errors} allowEvent />
      </div>

      <Head n="5" title="Kapasitas dan hadiah" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="ns-cap" className={LABEL}>Kapasitas pengunjung sekaligus</label>
          <input id="ns-cap" type="number" inputMode="numeric" min={1} max={5000} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={`${FIELD} font-num`} />
          <Err msg={errors.capacity} />
        </div>
        <div>
          <label htmlFor="ns-xp" className={LABEL}>Hadiah misi (XP)</label>
          <input id="ns-xp" type="number" inputMode="numeric" min={0} max={1000} value={xp} onChange={(e) => setXp(Number(e.target.value))} className={`${FIELD} font-num`} />
          <p className="mt-1.5 text-[11px] text-pebble">0 sampai 1.000. Biasanya 100 sampai 200.</p>
          <Err msg={errors.xp} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ns-vtitle" className={LABEL}>Judul voucer hadiah</label>
          <input id="ns-vtitle" type="text" value={vTitle} onChange={(e) => setVTitle(e.target.value)} className={FIELD} />
          <Err msg={errors.vtitle} />
        </div>
        <MoneyField id="ns-disc" label="Potongan harga" value={discount} onChange={setDiscount} presets={[5000, 10000, 15000, 20000]} error={errors.discount} />
        <MoneyField id="ns-min" label="Minimal belanja" value={minSpend} onChange={setMinSpend} presets={[0, 20000, 30000, 50000]} zeroLabel="Tanpa minimum" />
      </div>

      <button type="submit" disabled={busy} className="btn-tactile-primary w-full min-h-[52px] px-5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
        {busy ? <Icon name="loader" size={18} weight="bold" motion="spin" /> : <Icon name="plusCircle" size={18} />}
        <span>{busy ? "Menyimpan" : "Simpan titik ke peta"}</span>
      </button>
      {Object.values(errors).some(Boolean) && <p role="alert" className="text-xs font-bold text-quotaFull">Masih ada isian yang perlu diperbaiki. Lihat tulisan merah di atas.</p>}
    </form>
  );
}
