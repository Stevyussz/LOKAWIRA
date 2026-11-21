// aturan titik yg dipake bareng server & aplikasi: cara masuk (gratis/pesan/tiket), jam buka, jadwal acara
import type { CulturalSpot, EntryMode, OpeningHours, SpotEntry, SpotEvent } from "@/types/lokawira";

export const ENTRY_LABEL: Record<EntryMode, string> = {
  FREE: "Masuk bebas",
  RESERVATION: "Gratis, pesan slot",
  TICKET: "Bertiket",
};

// data lama tanpa entry: cagar utama dianggap pakai pesan slot (perilaku lama), selain itu masuk bebas
export function entryOf(spot: Pick<CulturalSpot, "entry" | "spotType">): SpotEntry {
  return spot.entry ?? { mode: spot.spotType === "PRIMARY_DEST" ? "RESERVATION" : "FREE" };
}

export const needsBooking = (spot: Pick<CulturalSpot, "entry" | "spotType">) => entryOf(spot).mode !== "FREE";

export type IndoTz = "Asia/Jakarta" | "Asia/Makassar" | "Asia/Jayapura";
export const TZ_LABEL: Record<IndoTz, string> = { "Asia/Jakarta": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT" };

// zona waktu dr bujur (kira2 batas WIB/WITA/WIT), bisa ditimpa spot.timeZone
export function tzOf(spot: Pick<CulturalSpot, "timeZone" | "coordinates">): IndoTz {
  if (spot.timeZone) return spot.timeZone;
  const lng = spot.coordinates.lng;
  return lng < 114.6 ? "Asia/Jakarta" : lng < 126 ? "Asia/Makassar" : "Asia/Jayapura";
}

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const dot = (t: string) => t.replace(":", ".");

// hari (0 = Minggu) & menit sejak tengah malam di zona waktu titik
function localNow(tz: IndoTz, now: Date): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const hour = Number(get("hour")) % 24;
  return { day, minute: hour * 60 + Number(get("minute")) };
}

function fmtEvent(iso: string, tz: IndoTz): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("id-ID", { timeZone: tz, day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("id-ID", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${date}, ${time}`;
}

export type OpenStatus = "ALWAYS" | "OPEN" | "CLOSED" | "UPCOMING" | "ENDED";

// status buka sekarang + teks pendek buat kartu ("Buka · tutup 22.00 WIB")
export function openState(spot: Pick<CulturalSpot, "openingHours" | "event" | "timeZone" | "coordinates">, now = new Date()): { status: OpenStatus; label: string } {
  const tz = tzOf(spot);
  const zone = TZ_LABEL[tz];
  if (spot.event) {
    const s = new Date(spot.event.startsAt).getTime();
    const e = new Date(spot.event.endsAt).getTime();
    const t = now.getTime();
    if (t < s) return { status: "UPCOMING", label: `Acara mulai ${fmtEvent(spot.event.startsAt, tz)} ${zone}` };
    if (t > e) return { status: "ENDED", label: "Acara sudah selesai" };
    return { status: "OPEN", label: `Acara berlangsung · sampai ${fmtEvent(spot.event.endsAt, tz)} ${zone}` };
  }
  const h = spot.openingHours;
  if (!h) return { status: "ALWAYS", label: "" };
  const { day, minute } = localNow(tz, now);
  const o = mins(h.open);
  const c = mins(h.close);
  const overnight = c <= o; // mis. 18.00-02.00
  const days = h.days.length ? h.days : [0, 1, 2, 3, 4, 5, 6];
  const openToday = days.includes(day);
  const openYesterday = days.includes((day + 6) % 7);
  const isOpen = overnight
    ? (openToday && minute >= o) || (openYesterday && minute < c)
    : openToday && minute >= o && minute < c;
  if (isOpen) return { status: "OPEN", label: `Buka · tutup ${dot(h.close)} ${zone}` };
  // kapan buka lagi
  for (let i = 0; i < 7; i++) {
    const d = (day + i) % 7;
    if (!days.includes(d)) continue;
    if (i === 0 && minute >= o) continue;
    const when = i === 0 ? "" : i === 1 ? "besok " : `${DAY_NAMES[d]} `;
    return { status: "CLOSED", label: `Tutup · buka ${when}${dot(h.open)} ${zone}` };
  }
  return { status: "CLOSED", label: "Tutup" };
}

// teks jam buka lengkap buat panel info ("Sen–Sab, 08.00–17.00 WIB")
export function hoursText(spot: Pick<CulturalSpot, "openingHours" | "timeZone" | "coordinates">): string {
  const h = spot.openingHours;
  if (!h) return "Setiap saat";
  const days = h.days.length ? [...h.days].sort() : [0, 1, 2, 3, 4, 5, 6];
  const dayText = days.length === 7 ? "Setiap hari" : days.map((d) => DAY_NAMES[d]).join(", ");
  return `${dayText}, ${dot(h.open)}–${dot(h.close)} ${TZ_LABEL[tzOf(spot)]}`;
}

// ---- validasi (server) ----
export function parseEntry(v: unknown): SpotEntry | string {
  const e = v as Partial<SpotEntry> | null;
  if (!e || !["FREE", "RESERVATION", "TICKET"].includes(String(e.mode))) return "Cara masuk tidak valid.";
  const out: SpotEntry = { mode: e.mode as EntryMode };
  if (out.mode === "TICKET") {
    const price = Number(e.priceIdr);
    if (!Number.isInteger(price) || price < 0 || price > 10_000_000) return "Harga tiket harus Rp0 sampai Rp10.000.000.";
    out.priceIdr = price;
  }
  const note = String(e.note ?? "").trim();
  if (note.length > 140) return "Keterangan tiket maksimal 140 karakter.";
  if (note) out.note = note;
  return out;
}

export function parseHours(v: unknown): OpeningHours | string {
  const h = v as Partial<OpeningHours> | null;
  if (!h || !HHMM.test(String(h.open)) || !HHMM.test(String(h.close))) return "Jam buka harus berformat JJ:MM.";
  if (h.open === h.close) return "Jam buka dan tutup tidak boleh sama.";
  const days = Array.isArray(h.days) ? [...new Set(h.days.map(Number))] : [];
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return "Hari buka tidak valid.";
  return { open: String(h.open), close: String(h.close), days: days.sort() };
}

export function parseEvent(v: unknown): SpotEvent | string {
  const e = v as Partial<SpotEvent> | null;
  const s = new Date(String(e?.startsAt ?? "")).getTime();
  const t = new Date(String(e?.endsAt ?? "")).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(t)) return "Tanggal acara tidak valid.";
  if (t <= s) return "Waktu selesai acara harus setelah waktu mulai.";
  if (t - s > 31 * 24 * 3600 * 1000) return "Acara maksimal 31 hari. Untuk tempat tetap, pakai jam buka.";
  return { startsAt: new Date(s).toISOString(), endsAt: new Date(t).toISOString() };
}

// pengalihan antrean (voucer UMKM) cuma aktif kalo tempat terisi >= 85%
export const CROWDED_RATIO = 0.85;
export const isCrowded = (spot: Pick<CulturalSpot, "quota">) =>
  spot.quota.maxCapacity > 0 && spot.quota.currentVisitors / spot.quota.maxCapacity >= CROWDED_RATIO;

// batas isian sheet Info
export const INFO_LIMITS = { description: 400, rules: 8, ruleLength: 120, contact: 80, gallery: 6, caption: 80 } as const;
export type SpotInfo = { description?: string; rules?: string[]; contact?: string };

// info tempat dr body PATCH/POST. Field yg gak dikirim = gak diubah; "" / [] = hapus (jadi undefined)
export function parseInfo(b: { description?: unknown; rules?: unknown; contact?: unknown }): Partial<Record<keyof SpotInfo, unknown>> | string {
  const out: Partial<Record<keyof SpotInfo, unknown>> = {};
  if (b.description !== undefined) {
    const d = String(b.description ?? "").trim();
    if (d.length > INFO_LIMITS.description) return `Deskripsi maksimal ${INFO_LIMITS.description} karakter.`;
    out.description = d || undefined;
  }
  if (b.rules !== undefined) {
    if (b.rules !== null && (!Array.isArray(b.rules) || b.rules.some((x) => typeof x !== "string"))) return "Daftar peraturan tidak valid.";
    const list = ((b.rules ?? []) as string[]).map((x) => x.trim()).filter(Boolean);
    if (list.length > INFO_LIMITS.rules) return `Peraturan maksimal ${INFO_LIMITS.rules} butir.`;
    if (list.some((x) => x.length > INFO_LIMITS.ruleLength)) return `Satu butir peraturan maksimal ${INFO_LIMITS.ruleLength} karakter.`;
    out.rules = list.length ? list : undefined;
  }
  if (b.contact !== undefined) {
    const c = String(b.contact ?? "").trim();
    if (c.length > INFO_LIMITS.contact) return `Kontak maksimal ${INFO_LIMITS.contact} karakter.`;
    out.contact = c || undefined;
  }
  return out;
}

// pasang hasil parseInfo ke titik: undefined = hapus field-nya
export function applyInfo(spot: CulturalSpot, info: Partial<Record<keyof SpotInfo, unknown>>) {
  for (const k of Object.keys(info) as (keyof SpotInfo)[]) {
    if (info[k] === undefined) delete spot[k];
    else (spot as unknown as Record<string, unknown>)[k] = info[k];
  }
}

// Teks budaya & prompt objek pindaian: jika mitra mengubah ini, titik kembali ditinjau ulang pengelola
export function storyChanged(a: CulturalSpot, b: CulturalSpot) {
  return (
    a.quest.loreNarrative !== b.quest.loreNarrative ||
    a.quest.riddleClue !== b.quest.riddleClue ||
    a.quest.riddleTitle !== b.quest.riddleTitle ||
    a.quest.targetObjectPrompt !== b.quest.targetObjectPrompt
  );
}

const DEFAULT_SLOTS = ["09:00", "11:00", "14:00", "16:00"];

// Normalisasi slot waktu (mis. "14:30" / "14.30" / "14:30 wib" -> "14:30 WIB"), namun tetap pertahankan teks bebas seperti kode uji
export function normalizeSlot(raw: string, spot?: Pick<CulturalSpot, "coordinates">): string {
  const clean = String(raw || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!clean) return "";
  const tz = spot ? TZ_LABEL[tzOf(spot)] : "WIB";
  const m = clean.match(/^(\d{1,2})[:.](\d{2})(?:\s*(WIB|WITA|WIT))?$/i);
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      const zone = (m[3] ?? tz).toUpperCase();
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")} ${zone}`;
    }
  }
  return clean;
}

// Daftar slot jam masuk dinamis berdasarkan jam buka titik (atau fallback yang dinormalkan)
export function availableSlotsFor(spot: Pick<CulturalSpot, "openingHours" | "quota" | "coordinates">): string[] {
  const tz = TZ_LABEL[tzOf(spot)];
  const next = spot.quota.nextAvailableSlot ? normalizeSlot(spot.quota.nextAvailableSlot, spot) : "";
  const out: string[] = [];
  const push = (s: string) => {
    if (s && !out.includes(s)) out.push(s);
  };
  if (next) push(next);

  const open = spot.openingHours?.open ?? "08:00";
  const close = spot.openingHours?.close ?? "17:00";
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
  };
  const openMin = toMin(open);
  const closeMin = toMin(close);
  if (Number.isFinite(openMin) && Number.isFinite(closeMin) && closeMin > openMin + 60) {
    const start = Math.ceil((openMin + 30) / 30) * 30;
    const step = closeMin - start > 360 ? 120 : 60;
    for (let m = start; m <= closeMin - 30 && out.length < 4; m += step) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      push(`${hh}:${mm} ${tz}`);
    }
  }
  for (const fallback of DEFAULT_SLOTS) {
    if (out.length >= 3) break;
    push(`${fallback} ${tz}`);
  }
  return out;
}
