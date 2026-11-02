"use client";

import React, { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import LocationPicker from "@/components/map/LocationPicker";
import { api, ApiError, DEMO_MODE, describeError } from "@/lib/api";
import type { LatLng } from "@/lib/geo";
import type { CulturalSpot } from "@/types/lokawira";

const FACILITY_OPTIONS = ["Pembayaran QRIS", "Parkir", "Ramah kursi roda", "Tempat duduk", "Toilet"];
const input =
  "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";
const labelCls = "block text-xs font-bold text-pebble mb-1.5";

interface Props {
  spot: CulturalSpot | null;
  allSpots: CulturalSpot[];
  isAdmin: boolean;
  onClose: () => void;
  // dipanggil dgn daftar titik terbaru stlh simpan/arsip berhasil
  onSpots: (spots: CulturalSpot[]) => void;
}

// ubah data lapak atau arsipkan (soft delete) - arsip butuh 2 langkah biar gak kepencet
export default function EditSpotSheet({ spot, allSpots, isAdmin, onClose, onSpots }: Props) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [clue, setClue] = useState("");
  const [story, setStory] = useState("");
  const [facilities, setFacilities] = useState<string[]>([]);
  const [capacity, setCapacity] = useState(30);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"save" | "archive" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!spot) return;
    setName(spot.name);
    setAddress(spot.address);
    setClue(spot.quest.riddleClue);
    setStory(spot.quest.loreNarrative);
    setFacilities(spot.facilities);
    setCapacity(spot.quota.maxCapacity);
    setPin(spot.coordinates);
    setErrors({});
    setMsg(null);
    setConfirming(false);
  }, [spot]);

  const sameRegion = useMemo(
    () => allSpots.filter((s) => s.vibe === spot?.vibe && s.id !== spot?.id),
    [allSpots, spot]
  );

  if (!spot) return null;
  const canArchive = isAdmin || spot.spotType !== "PRIMARY_DEST";

  const applyLocal = (patch: (s: CulturalSpot) => CulturalSpot | null) =>
    onSpots(allSpots.map((s) => (s.id === spot.id ? patch(s) : s)).filter((s): s is CulturalSpot => s !== null));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 3) errs.name = "Nama minimal 3 karakter.";
    if (address.trim().length < 5) errs.address = "Isi alamat atau patokan.";
    if (clue.trim().length < 10) errs.clue = "Petunjuk misi minimal 10 karakter.";
    if (!pin) errs.pin = "Taruh pin lokasi di peta.";
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 500) errs.capacity = "Kapasitas 1 sampai 500 orang.";
    setErrors(errs);
    setMsg(null);
    if (Object.keys(errs).length > 0 || !pin) return;

    setBusy("save");
    try {
      const res = await api.updateSpot(spot.id, {
        name: name.trim(),
        address: address.trim(),
        facilities,
        coordinates: pin,
        quota: { maxCapacity: capacity },
        quest: { riddleClue: clue.trim(), loreNarrative: story.trim() },
      });
      onSpots(res.spots);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.isOffline && DEMO_MODE) {
        applyLocal((s) => ({
          ...s,
          name: name.trim(),
          address: address.trim(),
          facilities,
          coordinates: pin,
          quota: { ...s.quota, maxCapacity: capacity, currentVisitors: Math.min(s.quota.currentVisitors, capacity) },
          quest: { ...s.quest, riddleClue: clue.trim(), loreNarrative: story.trim() },
        }));
        onClose();
      } else {
        setMsg(describeError(err, "Perubahan gagal disimpan."));
      }
    } finally {
      setBusy(null);
    }
  };

  const archive = async () => {
    setBusy("archive");
    setMsg(null);
    try {
      const res = await api.deleteSpot(spot.id);
      onSpots(res.spots);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.isOffline && DEMO_MODE) {
        applyLocal(() => null);
        onClose();
      } else {
        setMsg(describeError(err, "Lapak gagal diarsipkan."));
        setConfirming(false);
      }
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <div className="flex items-start justify-between gap-3">
      <h2 id="edit-spot-title" className="font-display text-xl font-extrabold text-alabaster leading-tight">
        Ubah lapak
      </h2>
      <button type="button" onClick={onClose} aria-label="Tutup" className="btn-tactile-secondary min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0">
        <Icon name="close" size={18} weight="bold" />
      </button>
    </div>
  );

  return (
    <Sheet isOpen onClose={onClose} titleId="edit-spot-title" header={header} maxWidthClass="sm:max-w-xl">
      <form onSubmit={save} className="space-y-4 pt-1" noValidate>
        <div>
          <label htmlFor="edit-name" className={labelCls}>Nama</label>
          <input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? "edit-err-name" : undefined} className={input} />
          {errors.name && <p id="edit-err-name" role="alert" className="mt-1 text-xs font-bold text-quotaFull">{errors.name}</p>}
        </div>
        <div>
          <span className={labelCls}>Lokasi di peta</span>
          <LocationPicker spots={sameRegion} value={pin} onChange={(c) => { setPin(c); setErrors((x) => ({ ...x, pin: "" })); }} label="Lokasi lapak" />
          {errors.pin && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{errors.pin}</p>}
        </div>
        <div>
          <label htmlFor="edit-address" className={labelCls}>Alamat atau patokan</label>
          <input id="edit-address" value={address} onChange={(e) => setAddress(e.target.value)} aria-invalid={!!errors.address} aria-describedby={errors.address ? "edit-err-address" : undefined} className={input} />
          {errors.address && <p id="edit-err-address" role="alert" className="mt-1 text-xs font-bold text-quotaFull">{errors.address}</p>}
        </div>
        <div>
          <label htmlFor="edit-clue" className={labelCls}>Petunjuk misi</label>
          <textarea id="edit-clue" rows={2} value={clue} onChange={(e) => setClue(e.target.value)} aria-invalid={!!errors.clue} aria-describedby={errors.clue ? "edit-err-clue" : undefined} className={`${input} py-3`} />
          {errors.clue && <p id="edit-err-clue" role="alert" className="mt-1 text-xs font-bold text-quotaFull">{errors.clue}</p>}
        </div>
        <div>
          <label htmlFor="edit-story" className={labelCls}>Cerita singkat</label>
          <textarea id="edit-story" rows={2} value={story} onChange={(e) => setStory(e.target.value)} className={`${input} py-3`} />
        </div>
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
        <div>
          <label htmlFor="edit-cap" className={labelCls}>Kapasitas sekaligus</label>
          <input id="edit-cap" type="number" inputMode="numeric" min={1} max={500} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} aria-invalid={!!errors.capacity} aria-describedby={errors.capacity ? "edit-err-cap" : undefined} className={`${input} font-num`} />
          {errors.capacity && <p id="edit-err-cap" role="alert" className="mt-1 text-xs font-bold text-quotaFull">{errors.capacity}</p>}
        </div>

        {!isAdmin && (name.trim() !== spot.name || (pin && (pin.lat !== spot.coordinates.lat || pin.lng !== spot.coordinates.lng))) && (
          <p role="status" className="text-xs text-pebble rounded-xl bg-slateElev p-3">
            Mengubah nama atau lokasi membuat lapak ditinjau ulang pengelola. Selama itu lapak tidak tampil di peta wisatawan.
          </p>
        )}

        <button type="submit" disabled={busy !== null} className="btn-tactile-primary w-full min-h-[52px] px-5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
          {busy === "save" ? <Icon name="loader" size={18} weight="bold" motion="spin" /> : <Icon name="check" size={18} />}
          <span>{busy === "save" ? "Menyimpan" : "Simpan perubahan"}</span>
        </button>

        {msg && <p role="alert" className="text-sm font-bold text-quotaFull">{msg}</p>}

        {canArchive && (
          <div className="border-t border-stoneSubtle pt-4 space-y-2.5">
            {confirming ? (
              <>
                <p role="alert" className="text-sm text-alabaster font-bold">
                  Arsipkan &ldquo;{spot.name}&rdquo;? Lapak hilang dari peta wisatawan. Riwayat voucer dan tiket tetap tersimpan.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button type="button" onClick={() => setConfirming(false)} disabled={busy !== null} className="btn-tactile-secondary min-h-[48px] text-sm">Batal</button>
                  <button type="button" onClick={archive} disabled={busy !== null} className="min-h-[48px] rounded-xl bg-quotaFull text-[var(--vibe-on-primary)] text-sm font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-70">
                    {busy === "archive" && <Icon name="loader" size={16} weight="bold" motion="spin" />}
                    <span>Ya, arsipkan</span>
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="btn-tactile-secondary w-full min-h-[48px] text-sm text-quotaFull">
                Arsipkan lapak ini
              </button>
            )}
          </div>
        )}
      </form>
    </Sheet>
  );
}
