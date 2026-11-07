// pemformat waktu yg ngerti dua bentuk: ISO 8601 (dari backend beneran) & teks lama ("Berlaku 7 Hari")
const ISO = /^\d{4}-\d{2}-\d{2}(T|$)/;

const tz = "Asia/Jakarta";
const dateFmt = new Intl.DateTimeFormat("id-ID", { timeZone: tz, day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("id-ID", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });

function parse(v: string): Date | null {
  if (!ISO.test(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "2 Nov 2026, 17.30 WIB" kalo ISO, kalo bukan ISO ditampilin apa adanya
export function formatWhen(v?: string | null): string {
  if (!v) return "";
  const d = parse(v);
  return d ? `${dateFmt.format(d)}, ${timeFmt.format(d)} WIB` : v;
}

// voucer lewat masa berlaku (cuma kalo ISO; teks lama dianggap masih berlaku)
export function isExpired(v?: string | null): boolean {
  if (!v) return false;
  const d = parse(v);
  return !!d && d.getTime() < Date.now();
}

// buat masa berlaku voucer: null = gak kadaluarsa
export function formatExpiry(v?: string | null): string {
  if (v === null || v === undefined || v === "") return "Tanpa batas waktu";
  const d = parse(v);
  return d ? `Berlaku s.d. ${dateFmt.format(d)}` : v;
}
