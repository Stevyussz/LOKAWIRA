// Kecerdasan Loka yg gak butuh model AI, dipakai server & aplikasi:
// - fakta praktis titik (jam, cara masuk, aturan, keramaian, acara, tetangga terdekat)
// - jawaban offline yg tetap nyambung kalo AI putus
// - saran pertanyaan, cek kelengkapan lapak buat pengelola, saran buat mitra dr angka dampak
import type { CulturalEvent, CulturalSpot, SpotImpact, SpotType } from "@/types/lokawira";
import { ENTRY_LABEL, TZ_LABEL, entryOf, hoursText, isCrowded, openState, tzOf } from "@/lib/spotRules";
import { occurrences } from "@/lib/eventRules";
import { distanceMeters, formatDistance } from "@/lib/geo";

export const DEFAULT_TARGET = "Produk atau karya di lapak ini";
export const DEFAULT_STORY_SUFFIX = "adalah mitra ekonomi sirkular LOKAWIRA.";

export const TYPE_WORD: Record<SpotType, string> = {
  PRIMARY_DEST: "cagar budaya",
  SANGGAR_SENI: "sanggar seni",
  UMKM_KULINER: "makan & minum",
  UMKM_KRIYA: "kriya & oleh-oleh",
};

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

// ---- maksud pertanyaan ----
export type LokaIntent = "HOURS" | "ENTRY" | "RULES" | "CROWD" | "EVENT" | "NEARBY" | "FACILITY" | "CONTACT" | "MISSION";
const INTENT_WORDS: [LokaIntent, string][] = [
  ["HOURS", "jam (buka|berapa|operasional)|buka (jam|kapan|sampai|hari)|kapan buka|tutup (jam|kapan|hari)|masih buka|sudah buka|lagi buka|hari apa (aja )?buka|opening|operasional"],
  ["ENTRY", "tiket|harga|bayar|biaya|gratis|htm|reservasi|pesan slot|booking|cara masuk|berapa.{0,15}masuk|masuk.{0,15}berapa"],
  ["RULES", "aturan|peraturan|dilarang|larangan|boleh|pakaian|berpakaian|baju|sopan|alas kaki|sepatu|sandal|drone|lampu kilat|flash"],
  ["CROWD", "ramai|rame|sepi|penuh|antre|antri|antrean|antrian|padat|kuota|sesak"],
  ["EVENT", "acara|pentas|pertunjukan|jadwal|festival|latihan|kelas|workshop|lokakarya|agenda"],
  ["NEARBY", "terdekat|dekat sini|sekitar sini|di sekitar|rekomendasi|ke ?mana lagi|tempat lain|lapak lain|habis ini|setelah ini|selanjutnya|makan di ?mana"],
  ["FACILITY", "fasilitas|parkir|parkiran|toilet|wc|kamar mandi|qris|kursi roda|difabel|disabilitas|tempat duduk|mushola|musala"],
  ["CONTACT", "kontak|hubungi|telepon|telpon|telp|whatsapp|wa|instagram|ig|nomor"],
  ["MISSION", "misi|petunjuk|scan|pindai|voucer|voucher|xp|hadiah|poin"],
];
// akhiran -nya boleh ("fasilitasnya", "tiketnya"), tapi "wa" gak boleh nyangkut di "wayang"
const INTENT_RX: [LokaIntent, RegExp][] = INTENT_WORDS.map(([i, w]) => [i, new RegExp(`\\b(?:${w})(?:nya)?\\b`)]);

export function detectIntents(question: string): LokaIntent[] {
  const q = ` ${question.toLowerCase()} `;
  return INTENT_RX.filter(([, rx]) => rx.test(q)).map(([i]) => i);
}

// ---- fakta praktis ----
export interface LokaWorld {
  now?: Date;
  // acara budaya (semua, nanti difilter per titik)
  events?: CulturalEvent[];
  // titik lain yg bisa dilihat wisatawan (buat rekomendasi terdekat)
  spots?: CulturalSpot[];
}

export function entryText(spot: CulturalSpot): string {
  const en = entryOf(spot);
  const base =
    en.mode === "TICKET"
      ? en.priceIdr !== undefined
        ? en.priceIdr === 0
          ? "Bertiket, gratis"
          : `Bertiket, ${rupiah(en.priceIdr)} per orang`
        : ENTRY_LABEL.TICKET
      : en.mode === "RESERVATION"
      ? "Gratis, pesan slot dulu di aplikasi"
      : "Bebas masuk, tanpa tiket";
  return en.note ? `${base}. ${en.note}` : base;
}

export function crowdWord(spot: CulturalSpot): { word: "sepi" | "sedang" | "ramai"; pct: number } {
  const { currentVisitors, maxCapacity } = spot.quota;
  const pct = maxCapacity > 0 ? Math.round((currentVisitors / maxCapacity) * 100) : 0;
  return { word: isCrowded(spot) ? "ramai" : pct >= 50 ? "sedang" : "sepi", pct };
}

export function nextOccurrences(spot: CulturalSpot, events: CulturalEvent[] = [], now = new Date(), max = 2) {
  const tz = tzOf(spot);
  const to = new Date(now.getTime() + 30 * 86400000);
  return events
    .filter((e) => e.spotId === spot.id)
    .flatMap((e) => occurrences(e, now, to, tz).map((o) => ({ title: e.title, ...o })))
    .filter((o) => new Date(o.endsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, max);
}

export function nearbySpots(spot: CulturalSpot, spots: CulturalSpot[] = [], max = 3) {
  return spots
    .filter((s) => s.id !== spot.id && (s.status ?? "PUBLISHED") === "PUBLISHED" && (!spot.regionId || s.regionId === spot.regionId))
    .map((s) => ({ spot: s, meters: distanceMeters(spot.coordinates, s.coordinates) }))
    .filter((x) => x.meters <= 5000)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, max);
}

const when = (iso: string, spot: CulturalSpot) =>
  `${new Intl.DateTimeFormat("id-ID", { timeZone: tzOf(spot), weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))} ${TZ_LABEL[tzOf(spot)]}`;

// satu kalimat per jenis fakta. Sumbernya data lapak yg diisi pemilik/pengelola, bukan karangan
export function practicalFacts(spot: CulturalSpot, world: LokaWorld = {}): Record<LokaIntent, string> {
  const now = world.now ?? new Date();
  const os = openState(spot, now);
  const crowd = crowdWord(spot);
  const ev = nextOccurrences(spot, world.events, now);
  const near = nearbySpots(spot, world.spots);
  const r = spot.quest.voucherReward;
  return {
    HOURS: spot.event
      ? os.label
      : spot.openingHours
      ? `Jam buka ${hoursText(spot)}.${os.label ? ` Sekarang: ${os.label}.` : ""}`
      : "Tidak ada jam buka khusus yang tercatat, bisa dikunjungi kapan saja.",
    ENTRY: `Cara masuk: ${entryText(spot)}.`,
    RULES: spot.rules?.length ? `Peraturan pengunjung: ${spot.rules.join("; ")}.` : "Pemilik tidak mencatat peraturan khusus.",
    CROWD: `Saat ini terisi sekitar ${crowd.pct}% (${crowd.word}), ${spot.quota.currentVisitors} dari ${spot.quota.maxCapacity} orang.`,
    EVENT: ev.length
      ? `Acara berikutnya: ${ev.map((o) => `${o.title}, ${when(o.startsAt, spot)}`).join("; ")}.`
      : "Belum ada acara terjadwal dalam 30 hari ke depan.",
    NEARBY: near.length
      ? `Titik terdekat: ${near
          .map(({ spot: s, meters }) => `${s.name} (${TYPE_WORD[s.spotType]}, ${formatDistance(meters)}, ${openState(s, now).status === "CLOSED" ? "sedang tutup" : crowdWord(s).word})`)
          .join("; ")}.`
      : "Belum ada titik lain yang dekat di kawasan ini.",
    FACILITY: spot.facilities.length ? `Fasilitas: ${spot.facilities.join(", ")}.` : "Pemilik belum mencatat fasilitas.",
    CONTACT: spot.contact ? `Kontak: ${spot.contact}.` : "Pemilik belum mencantumkan kontak.",
    MISSION: `Misi "${spot.quest.riddleTitle}": ${spot.quest.riddleClue} Hadiah: +${spot.quest.rewardPoints} XP dan voucer ${r.discountTitle} (${rupiah(r.discountAmount)}, min. belanja ${rupiah(r.minimumSpend)}).`,
  };
}

// ---- pencocokan kata (dipakai offline & cek dukungan jawaban AI) ----
const STOP = new Set([
  "yang", "dengan", "untuk", "dari", "pada", "atau", "dalam", "adalah", "kawasan", "tempat", "bagaimana", "kenapa", "mengapa", "apakah", "tentang",
  "sejarah", "cerita", "disini", "sini", "ini", "itu", "apa", "siapa", "kapan", "dimana", "mana", "berapa", "bisa", "dong", "nggak", "tidak", "saya", "kamu",
  "loka", "tolong", "cara", "orang", "banyak", "jelaskan", "ceritakan", "makna", "arti", "artinya", "maksud", "punya", "jadi", "juga", "sudah", "masih", "akan", "bikin", "buat",
]);
// imbuhan umum dibuang biar "pembuatan" ketemu "buat", "celengannya" ketemu "celengan"
function stem(w: string) {
  let s = w.replace(/(nya|lah|kah|pun)$/, "");
  s = s.replace(/(kan|an|i)$/, (m) => (s.length - m.length >= 4 ? "" : m));
  s = s.replace(/^(meng|meny|mem|men|me|peng|peny|pem|pen|pe|ber|be|ter|di|ke|se)/, (m) => (s.length - m.length >= 4 ? "" : m));
  return s;
}
export const keywords = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
    .map(stem)
    .filter((w) => w.length >= 3);

// angka (tahun, abad, jumlah) di teks: kalo jawaban AI nyebut angka yg gak ada di konteks = karangan
export const numbersIn = (t: string) => new Set((t.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(/[.,]/g, "")));
export function unsupportedNumbers(answer: string, context: string): string[] {
  const ctx = numbersIn(context);
  return [...numbersIn(answer)].filter((n) => !ctx.has(n));
}

// ---- jawaban offline ----
export interface LokaNoteLite {
  id: string;
  opkCategory: string;
  maestroSource: string;
  summary: string;
}
export interface OfflineAnswer {
  answer: string;
  answered: boolean;
  // label sumber yg dipakai
  references: string[];
}
export const PRACTICAL_SOURCE = "Data lapak di LOKAWIRA (diisi pemilik)";

// ambil kalimat rujukan yg nyambung sama pertanyaan (maks 3, urutan asli), biar jawaban offline gak kepanjangan
export function relevantSentences(text: string, qWords: Set<string>, max = 3): string {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z'"])/);
  const scored = sentences.map((t, i) => ({ t, i, hit: new Set(keywords(t).filter((w) => qWords.has(w))).size }));
  const keep = scored.filter((x) => x.hit > 0).sort((a, b) => b.hit - a.hit || a.i - b.i).slice(0, max).sort((a, b) => a.i - b.i);
  return (keep.length ? keep : scored.slice(0, 2)).map((x) => x.t).join(" ");
}

export function offlineAnswer(spot: CulturalSpot, question: string, notes: LokaNoteLite[], world: LokaWorld = {}): OfflineAnswer {
  const intents = detectIntents(question);
  const qWords = new Set(keywords(question));
  // dianggap nyambung kalo minimal separuh kata kunci pertanyaan ada di rujukan (satu kata umum kayak "gapura" belum cukup)
  const need = Math.max(1, Math.ceil(qWords.size / 2));
  const overlap = (t: string) => new Set(keywords(t).filter((w) => qWords.has(w))).size;
  // kata yg jarang muncul di rujukan lain lebih menentukan (mis. "segaran" vs "trowulan")
  const df = new Map<string, number>();
  for (const n of notes) for (const w of new Set(keywords(n.summary))) if (qWords.has(w)) df.set(w, (df.get(w) ?? 0) + 1);
  const weight = (t: string) => [...new Set(keywords(t).filter((w) => qWords.has(w)))].reduce((a, w) => a + 1 / (df.get(w) ?? 1), 0);
  const ranked = notes
    .map((n) => ({ n, hits: overlap(`${n.summary} ${n.maestroSource}`), w: weight(n.summary) }))
    .filter((x) => x.hits >= need)
    .sort((a, b) => b.w - a.w || b.hits - a.hits);
  const fromNotes = (): OfflineAnswer | null => {
    if (!ranked.length) return null;
    // dua rujukan sama kuat: tampilkan dua-duanya daripada menebak salah satu
    const top = ranked.filter((x, i) => i === 0 || (i === 1 && Math.abs(x.w - ranked[0].w) < 0.01));
    return {
      answer: top.map((x) => `${relevantSentences(x.n.summary, qWords)} (Sumber: ${x.n.maestroSource})`).join("\n\n"),
      answered: true,
      references: top.map((x) => x.n.maestroSource),
    };
  };

  if (intents.length) {
    // aturan yg gak dicatat pemilik tapi ada di rujukan budaya (mis. busana adat ke makam)
    if (intents[0] === "RULES" && !spot.rules?.length) {
      const n = fromNotes();
      if (n) return n;
    }
    const facts = practicalFacts(spot, world);
    const parts = intents.slice(0, 2).map((i) => facts[i]);
    // lagi ramai: tambahin rekomendasi titik terdekat
    if (intents.includes("CROWD") && isCrowded(spot) && !intents.includes("NEARBY")) parts.push(`Kalau ingin yang lebih lengang: ${facts.NEARBY.replace(/^Titik terdekat: /, "")}`);
    return { answer: parts.join(" "), answered: true, references: [PRACTICAL_SOURCE] };
  }
  const n = fromNotes();
  if (n) return n;
  if (qWords.size && overlap(`${spot.quest.loreNarrative} ${spot.description ?? ""}`) >= need)
    return { answer: spot.quest.loreNarrative, answered: true, references: [spot.quest.verifiedLoreSource] };
  return {
    answer: `Rujukan untuk pertanyaan itu belum ada di catatan Loka tentang ${spot.name}, jadi Loka tidak mau menebak. Coba tanyakan langsung ke pemilik atau pemandu di lokasi.`,
    answered: false,
    references: [],
  };
}

// saran pertanyaan yg pasti bisa dijawab dr data titik
export function suggestQuestions(spot: CulturalSpot, world: LokaWorld = {}): string[] {
  const out: string[] = [];
  const target = spot.quest.targetObjectPrompt && spot.quest.targetObjectPrompt !== DEFAULT_TARGET ? spot.quest.targetObjectPrompt.split(/ atau |,/)[0].trim() : "";
  if (target && target.length <= 40) out.push(`Apa cerita di balik ${target}?`);
  out.push(spot.openingHours || spot.event ? "Buka sampai jam berapa?" : "Bagaimana cara masuknya?");
  if (spot.rules?.length) out.push("Ada aturan apa di sini?");
  if (nextOccurrences(spot, world.events, world.now).length) out.push("Ada acara apa minggu ini?");
  out.push(isCrowded(spot) ? "Lagi ramai, ada tempat lain di dekat sini?" : "Tempat menarik di dekat sini?");
  if (!out.some((q) => q.startsWith("Ada aturan")) && spot.facilities.length) out.push("Fasilitasnya apa saja?");
  return out.slice(0, 4);
}

// ---- cek kelengkapan pengajuan (buat pengelola) ----
export type CheckLevel = "BLOCK" | "WARN" | "INFO";
export interface SpotCheck {
  level: CheckLevel;
  text: string;
}
const GENERIC_TARGET_WORDS = new Set(["produk", "karya", "lapak", "objek", "benda", "khas", "atau", "dan", "yang", "dari", "untuk"]);

// kata kunci objek yg kebocoran di petunjuk misi (teka-tekinya jadi gak ada tantangannya)
export function leakedWords(clue: string, target: string): string[] {
  const cw = new Set(keywords(clue));
  return [...new Set(keywords(target).filter((w) => !GENERIC_TARGET_WORDS.has(w) && cw.has(w)))];
}

export function spotChecks(spot: CulturalSpot): SpotCheck[] {
  const out: SpotCheck[] = [];
  const q = spot.quest;
  if (!spot.regionId) out.push({ level: "BLOCK", text: "Titik di luar semua kawasan. Buat atau perluas kawasan dulu sebelum menerbitkan." });
  if (!q.targetObjectPrompt || q.targetObjectPrompt === DEFAULT_TARGET) out.push({ level: "BLOCK", text: "Objek yang harus dipotret belum diisi. Scan Objek tidak bisa dinilai." });
  if (!(q.referenceImages?.length ?? 0)) out.push({ level: "WARN", text: "Belum ada foto contoh objek. AI menilai foto wisatawan tanpa pembanding." });
  const leak = leakedWords(q.riddleClue, q.targetObjectPrompt ?? "");
  if (leak.length) out.push({ level: "WARN", text: `Petunjuk misi menyebut langsung nama objek (${leak.join(", ")}). Teka-tekinya jadi terlalu mudah.` });
  if (q.riddleClue.trim().length < 25) out.push({ level: "WARN", text: "Petunjuk misi sangat pendek. Wisatawan mungkin bingung mencari objeknya." });
  if (!q.loreNarrative.trim() || q.loreNarrative.endsWith(DEFAULT_STORY_SUFFIX)) out.push({ level: "WARN", text: "Cerita masih teks bawaan. Loka tidak punya bahan untuk bercerita tentang lapak ini." });
  else if (/\b(abad|tahun)\b|\b1[0-9]{3}\b/i.test(q.loreNarrative) && /belum diverifikasi/i.test(q.verifiedLoreSource))
    out.push({ level: "WARN", text: "Cerita menyebut tahun atau abad, tapi sumbernya masih keterangan mitra. Minta sumber sebelum diterbitkan." });
  const v = q.voucherReward;
  if (v.minimumSpend > 0 && v.discountAmount >= v.minimumSpend) out.push({ level: "WARN", text: "Potongan voucer sama atau lebih besar dari minimal belanja. Mitra bisa rugi." });
  if (!spot.description) out.push({ level: "INFO", text: "Info tempat (deskripsi singkat) belum diisi. Tidak wajib, tapi membantu wisatawan." });
  if (!(spot.gallery?.length ?? 0)) out.push({ level: "INFO", text: "Galeri foto tempat masih kosong." });
  const order: Record<CheckLevel, number> = { BLOCK: 0, WARN: 1, INFO: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

// ---- saran buat mitra ----
export type TipAction = "EDIT" | "SCAN" | "EVENT" | "POSTER" | "CASHIER";
export interface MerchantTip {
  spotId: string;
  title: string;
  text: string;
  action?: TipAction;
}

export function merchantTips(spot: CulturalSpot, impact?: SpotImpact): MerchantTip[] {
  const out: MerchantTip[] = [];
  const add = (title: string, text: string, action?: TipAction) => out.push({ spotId: spot.id, title, text, action });
  const q = spot.quest;
  if (!q.targetObjectPrompt || q.targetObjectPrompt === DEFAULT_TARGET || !(q.referenceImages?.length ?? 0))
    add("Lengkapi objek scan", "Tulis benda yang harus dipotret dan unggah 2–3 foto contoh. Tanpa itu, wisatawan tidak bisa menyelesaikan misi di lapakmu.", "SCAN");
  if (!spot.description || !(spot.gallery?.length ?? 0))
    add("Isi Info tempat", "Deskripsi singkat dan beberapa foto membuat orang yakin mampir. Loka bisa membantu merapikan tulisanmu.", "EDIT");
  if (!spot.highlight) add("Tulis alasan mampir", "Satu kalimat di kartu lapak dan poster QR, misalnya hal yang hanya ada di tempatmu.", "EDIT");
  if (impact) {
    if (impact.qrOpens === 0) add("Pasang poster QR", "Belum ada yang memindai poster lapakmu bulan ini. Cetak poster dan pasang di tempat yang terlihat dari jalan.", "POSTER");
    else if (impact.qrOpens >= 5 && impact.checkIns < impact.qrOpens * 0.2)
      add("Banyak yang lihat, sedikit yang datang", `${impact.qrOpens} orang memindai poster, tapi baru ${impact.checkIns} yang check-in. Coba tulis promo atau jam buka di "Kenapa layak mampir".`, "EDIT");
    if (impact.vouchersIssued >= 3 && impact.vouchersRedeemed < impact.vouchersIssued * 0.3)
      add("Voucer jarang ditukar", `${impact.vouchersIssued} voucer terbit, ${impact.vouchersRedeemed} ditukar. Ingatkan pembeli menunjukkan voucer di kasir, atau turunkan minimal belanja.`, "CASHIER");
    if (impact.checkIns >= 3 && impact.checkInsVerified < impact.checkIns * 0.5)
      add("Verifikasi check-in", `${impact.checkIns - impact.checkInsVerified} check-in belum kamu verifikasi. Verifikasi di Kasir supaya angka dampakmu kuat saat ditunjukkan ke sponsor.`, "CASHIER");
    if (impact.upcomingEvents === 0) add("Buat agenda", "Belum ada acara 30 hari ke depan. Acara rutin seperti latihan terbuka atau kelas singkat memberi orang alasan datang.", "EVENT");
  }
  return out;
}
