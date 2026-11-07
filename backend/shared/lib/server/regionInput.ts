import { inIndonesia } from "@/lib/geo";
import { VIBES } from "@/lib/enums";
import type { CulturalVibe, Region } from "@/types/lokawira";

// validasi isian kawasan. partial = PATCH (field yg gak dikirim gak dicek)
export function parseRegion(body: Record<string, unknown>, base: Partial<Region>, partial: boolean): Region | string {
  const out = { ...base } as Region;
  const has = (k: string) => body[k] !== undefined;
  if (!partial || has("name")) {
    const v = String(body.name ?? "").trim();
    if (v.length < 3 || v.length > 40) return "Nama kawasan 3 sampai 40 karakter.";
    out.name = v;
  }
  if (!partial || has("label")) {
    const v = String(body.label ?? "").trim();
    if (v.length < 3 || v.length > 80) return "Lokasi kawasan (desa/kecamatan, kabupaten) 3 sampai 80 karakter.";
    out.label = v;
  }
  if (!partial || has("theme")) {
    if (!VIBES.includes(body.theme as CulturalVibe)) return "Palet warna tidak valid.";
    out.theme = body.theme as CulturalVibe;
  }
  if (!partial || has("center")) {
    const c = body.center as { lat?: unknown; lng?: unknown } | undefined;
    const lat = Number(c?.lat);
    const lng = Number(c?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Titik pusat kawasan wajib diisi.";
    if (!inIndonesia({ lat, lng })) return "Titik pusat harus di wilayah Indonesia.";
    out.center = { lat, lng };
  }
  if (!partial || has("radiusKm")) {
    const r = Number(body.radiusKm);
    if (!Number.isFinite(r) || r < 1 || r > 100) return "Radius kawasan 1 sampai 100 km.";
    out.radiusKm = Math.round(r * 10) / 10;
  }
  if (!partial || has("status")) {
    const st = body.status ?? "DRAFT";
    if (st !== "ACTIVE" && st !== "DRAFT") return "Status kawasan tidak valid.";
    out.status = st;
  }
  return out;
}
