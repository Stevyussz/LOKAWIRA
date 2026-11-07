"use client";

import React, { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import LocationPicker from "@/components/map/LocationPicker";
import { api, describeError } from "@/lib/api";
import { VIBE_HEX } from "@/lib/vibeColors";
import { VIBES } from "@/lib/enums";
import type { CulturalSpot, CulturalVibe, Region } from "@/types/lokawira";
import type { LatLng } from "@/lib/geo";

const FIELD = "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";
const LABEL = "block text-xs font-bold text-pebble mb-1.5";
const THEME_NAME: Record<CulturalVibe, string> = { majapahit: "Merah bata", sogan: "Cokelat sogan", bahari: "Hijau laut", tridatu: "Tridatu", ukiran: "Ukiran" };

interface Props {
  regions: Region[];
  spots: CulturalSpot[];
  onRegions: (r: Region[]) => void;
  onReload: () => void;
  onToast: (text: string, isError?: boolean) => void;
}

type Draft = { id?: string; name: string; label: string; theme: CulturalVibe; center: LatLng | null; radiusKm: number; status: "ACTIVE" | "DRAFT" };
const EMPTY: Draft = { name: "", label: "", theme: "majapahit", center: null, radiusKm: 10, status: "DRAFT" };

// kawasan budaya sbg data: pengelola pusat yg bikin & ngaktifin. Lapak masuk kawasan otomatis dr lokasinya
export default function RegionsPanel({ regions, spots, onRegions, onReload, onToast }: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const editing = !!draft.id;

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    spots.forEach((s) => s.regionId && s.status !== "ARCHIVED" && m.set(s.regionId, (m.get(s.regionId) ?? 0) + 1));
    return m;
  }, [spots]);
  // acuan peta stabil (gak ikut pin), biar peta gak dimuat ulang tiap pin digeser
  const anchorRegion = (draft.id && regions.find((r) => r.id === draft.id)) || regions[0];
  const anchor = useMemo(
    () => ({ name: anchorRegion ? `pusat kawasan ${anchorRegion.name}` : "Trowulan", coordinates: anchorRegion?.center ?? { lat: -7.5682, lng: 112.3987 } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchorRegion?.id]
  );
  const orphans = spots.filter((s) => !s.regionId && s.status !== "ARCHIVED");

  const edit = (r: Region) => {
    setDraft({ id: r.id, name: r.name, label: r.label, theme: r.theme, center: r.center, radiusKm: r.radiusKm, status: r.status });
    setErrors({});
    document.getElementById("rg-name")?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (draft.name.trim().length < 3) errs.name = "Nama kawasan minimal 3 huruf.";
    if (draft.label.trim().length < 3) errs.label = "Tulis lokasinya, misalnya desa/kecamatan dan kabupaten.";
    if (!draft.center) errs.center = "Taruh titik pusat kawasan di peta.";
    if (!Number.isFinite(draft.radiusKm) || draft.radiusKm < 1 || draft.radiusKm > 100) errs.radius = "Radius 1 sampai 100 km.";
    setErrors(errs);
    if (Object.keys(errs).length || !draft.center) return;
    setBusy(true);
    try {
      const body = { name: draft.name.trim(), label: draft.label.trim(), theme: draft.theme, center: draft.center, radiusKm: draft.radiusKm, status: draft.status };
      const res = draft.id ? await api.updateRegion(draft.id, body) : await api.createRegion(body);
      onRegions(res.regions);
      const extra = res.adopted ? ` ${res.adopted} lapak di luar kawasan ikut masuk dan siap ditinjau.` : "";
      onToast(`Kawasan ${body.name} ${draft.id ? "diperbarui" : "dibuat"}${body.status === "DRAFT" ? " sebagai draf (belum tampil ke wisatawan)" : ""}.${extra}`);
      if (res.adopted) onReload();
      setDraft(EMPTY);
    } catch (err) {
      onToast(describeError(err, "Kawasan gagal disimpan."), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <section className="lg:col-span-5 gamiz-card p-5 space-y-3" aria-labelledby="rg-list">
        <h2 id="rg-list" className="text-base font-extrabold text-alabaster">Kawasan budaya ({regions.length})</h2>
        <p className="text-xs text-pebble leading-relaxed">
          Wisatawan memilih kawasan di atas peta. Lapak mitra otomatis masuk kawasan yang radiusnya mencakup lokasi lapak. Kawasan draf belum tampil ke wisatawan, jadi titik-titiknya bisa disiapkan dulu.
        </p>
        {orphans.length > 0 && (
          <p role="status" className="text-xs font-bold text-quotaFull rounded-xl bg-obsidian p-3">
            {orphans.length} lapak di luar semua kawasan: {orphans.slice(0, 3).map((s) => `${s.name}${s.regionProposal ? ` (usul: ${s.regionProposal})` : ""}`).join("; ")}
            {orphans.length > 3 ? ", dan lainnya" : ""}. Buat kawasan yang mencakupnya.
          </p>
        )}
        <ul className="space-y-2.5">
          {regions.map((r) => (
            <li key={r.id} className="list-none rounded-2xl bg-obsidian p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span aria-hidden="true" className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: VIBE_HEX[r.theme].primary }} />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-alabaster truncate">{r.name}</p>
                  <p className="text-[11px] text-pebble truncate">{r.label} · radius <span className="font-num">{r.radiusKm}</span> km · <span className="font-num">{counts.get(r.id) ?? 0}</span> titik</p>
                  <span className={`inline-flex mt-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full ${r.status === "ACTIVE" ? "bg-basalt text-quotaSafe" : "bg-slateElev text-alabaster"}`}>
                    {r.status === "ACTIVE" ? "Aktif" : "Draf"}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => edit(r)} aria-label={`Ubah kawasan ${r.name}`} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs shrink-0">Ubah</button>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={submit} noValidate className="lg:col-span-7 gamiz-card p-5 space-y-4">
        <h2 className="text-base font-extrabold text-alabaster">{editing ? `Ubah kawasan ${draft.name}` : "Tambah kawasan baru"}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="rg-name" className={LABEL}>Nama kawasan</label>
            <input id="rg-name" type="text" maxLength={40} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Contoh: Tanjung Bumi" className={FIELD} aria-invalid={!!errors.name} />
            {errors.name && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="rg-label" className={LABEL}>Lokasi</label>
            <input id="rg-label" type="text" maxLength={80} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Contoh: Tanjung Bumi, Bangkalan" className={FIELD} aria-invalid={!!errors.label} />
            {errors.label && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{errors.label}</p>}
          </div>
        </div>

        <fieldset>
          <legend className={LABEL}>Palet warna</legend>
          <div className="flex flex-wrap gap-2">
            {VIBES.map((v) => (
              <label key={v} className={`min-h-[44px] px-3 rounded-xl border-2 text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-vibePrimary ${draft.theme === v ? "border-vibePrimary bg-[var(--vibe-surface-tint)] text-alabaster" : "border-stoneStrong bg-basalt text-pebble"}`}>
                <input type="radio" name="rg-theme" className="sr-only" checked={draft.theme === v} onChange={() => setDraft({ ...draft, theme: v })} />
                <span aria-hidden="true" className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: VIBE_HEX[v].primary }} />
                {THEME_NAME[v]}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-pebble">Beberapa kawasan boleh memakai palet yang sama.</p>
        </fieldset>

        <div>
          <LocationPicker spots={[]} fallbackCenter={anchor} value={draft.center} onChange={(c) => { setDraft({ ...draft, center: c }); setErrors((x) => ({ ...x, center: "" })); }} label="Titik pusat kawasan" />
          {errors.center && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{errors.center}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="rg-radius" className={LABEL}>Radius (km)</label>
            <input id="rg-radius" type="number" inputMode="decimal" min={1} max={100} step={0.5} value={draft.radiusKm} onChange={(e) => setDraft({ ...draft, radiusKm: Number(e.target.value) })} className={`${FIELD} font-num`} aria-invalid={!!errors.radius} />
            {errors.radius && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{errors.radius}</p>}
            <p className="mt-1 text-[11px] text-pebble">Lapak dalam jarak ini dari titik pusat masuk kawasan.</p>
          </div>
          <fieldset>
            <legend className={LABEL}>Status</legend>
            <div className="flex gap-2">
              {(["DRAFT", "ACTIVE"] as const).map((st) => (
                <label key={st} className={`flex-1 min-h-[48px] px-3 rounded-xl border-2 text-xs font-extrabold flex items-center justify-center cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-vibePrimary ${draft.status === st ? "border-vibePrimary bg-[var(--vibe-surface-tint)] text-alabaster" : "border-stoneStrong bg-basalt text-pebble"}`}>
                  <input type="radio" name="rg-status" className="sr-only" checked={draft.status === st} onChange={() => setDraft({ ...draft, status: st })} />
                  {st === "DRAFT" ? "Draf" : "Aktif"}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center gap-2 disabled:opacity-70">
            {busy ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Icon name="check" size={16} />}
            <span>{busy ? "Menyimpan" : editing ? "Simpan perubahan" : "Buat kawasan"}</span>
          </button>
          {editing && (
            <button type="button" onClick={() => { setDraft(EMPTY); setErrors({}); }} className="btn-tactile-secondary min-h-[48px] px-5 text-sm">Batal ubah</button>
          )}
        </div>
      </form>
    </div>
  );
}
