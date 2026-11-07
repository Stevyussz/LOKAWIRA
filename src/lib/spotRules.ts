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
