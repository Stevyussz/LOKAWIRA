// hitung kemunculan acara berulang. Indonesia gak pake jam musim panas, jadi selisih zona waktu tetap
import type { CulturalEvent } from "@/types/lokawira";
import type { IndoTz } from "@/lib/spotRules";

const OFFSET_H: Record<IndoTz, number> = { "Asia/Jakarta": 7, "Asia/Makassar": 8, "Asia/Jayapura": 9 };
const DAY = 86400000;

// kemunculan acara yg (sebagian) jatuh di [from, to]. Maks 60 biar aman
export function occurrences(ev: Pick<CulturalEvent, "startsAt" | "endsAt" | "repeat">, from: Date, to: Date, tz: IndoTz): { startsAt: string; endsAt: string }[] {
  const start = new Date(ev.startsAt).getTime();
  const dur = new Date(ev.endsAt).getTime() - start;
  const out: { startsAt: string; endsAt: string }[] = [];
  const push = (t: number) => {
    if (t + dur >= from.getTime() && t <= to.getTime() && t >= start) out.push({ startsAt: new Date(t).toISOString(), endsAt: new Date(t + dur).toISOString() });
  };
  if (ev.repeat === "NONE") {
    push(start);
    return out;
  }
  if (ev.repeat === "WEEKLY") {
    // loncat langsung ke minggu sebelum "from" biar gak muter dr awal
    const skip = Math.max(0, Math.floor((from.getTime() - dur - start) / (7 * DAY)));
    for (let t = start + skip * 7 * DAY; t <= to.getTime() && out.length < 60; t += 7 * DAY) push(t);
    return out;
  }
  // MONTHLY_LAST: hari (Senin..Minggu) & jam setempat yg sama, di minggu terakhir tiap bulan
  const off = OFFSET_H[tz] * 3600000;
  const local = new Date(start + off); // dibaca pake getUTC* = waktu setempat
  const weekday = local.getUTCDay();
  const minuteOfDay = local.getUTCHours() * 60 + local.getUTCMinutes();
  const f = new Date(Math.max(from.getTime(), start) + off);
  let y = f.getUTCFullYear();
  let m = f.getUTCMonth() - 1; // mulai sebulan sebelumnya biar acara yg lagi berjalan ikut
  for (let i = 0; i < 16 && out.length < 60; i++, m++) {
    const lastDay = new Date(Date.UTC(y, m + 1, 0)); // hari terakhir bulan m
    const back = (lastDay.getUTCDay() - weekday + 7) % 7;
    const d = new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate() - back, 0, minuteOfDay));
    const t = d.getTime() - off;
    if (t > to.getTime()) break;
    push(t);
  }
  return out;
}

// teks pola buat ditampilin
export function repeatText(ev: Pick<CulturalEvent, "startsAt" | "repeat">, tz: IndoTz): string {
  if (ev.repeat === "NONE") return "Sekali";
  const day = new Intl.DateTimeFormat("id-ID", { timeZone: tz, weekday: "long" }).format(new Date(ev.startsAt));
  return ev.repeat === "WEEKLY" ? `Tiap ${day}` : `${day} terakhir tiap bulan`;
}
