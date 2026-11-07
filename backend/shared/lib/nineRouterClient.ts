const NINE_ROUTER_BASE_URL = (process.env.NINE_ROUTER_BASE_URL || "https://api.9router.local/v1").replace(/\/$/, "");
const NINE_ROUTER_API_KEY = process.env.NINE_ROUTER_API_KEY || "";
// batas waktu total cerita Loka; lewat itu pakai narasi kurasi
const NINE_ROUTER_TIMEOUT_MS = Number(process.env.NINE_ROUTER_TIMEOUT_MS) || 12000;
const PER_MODEL_MS = Number(process.env.NINE_ROUTER_PER_MODEL_MS) || 6000;
// daftar model dipisah koma: kalo penyedia pertama putus/error, langsung coba berikutnya
const modelList = (v?: string) => (v || "gemini-2.5-flash").split(",").map((m) => m.trim()).filter(Boolean);
export const TEXT_MODELS = modelList(process.env.NINE_ROUTER_MODEL);
export const VISION_MODELS = modelList(process.env.NINE_ROUTER_VISION_MODEL || process.env.NINE_ROUTER_MODEL);
export const aiConfigured = () => !!NINE_ROUTER_API_KEY;

// isi balasan model kadang dibungkus ```json ... ```; ambil objek JSON-nya aja
export function parseModelJson(content: unknown): Record<string, unknown> {
  const text = String(content ?? "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Balasan model bukan JSON");
  return JSON.parse(text.slice(start, end + 1));
}

// satu panggilan chat ke 9router (non-streaming; 9router defaultnya SSE). Coba model satu2 sampai tenggat total habis.
// Balikin objek JSON dr model + nama model yg berhasil
export async function chatJson(messages: unknown[], opts: { models?: string[]; timeoutMs?: number; perModelMs?: number } = {}): Promise<{ json: Record<string, unknown>; model: string }> {
  if (!NINE_ROUTER_API_KEY) throw new Error("NINE_ROUTER_API_KEY kosong");
  const deadline = Date.now() + (opts.timeoutMs ?? NINE_ROUTER_TIMEOUT_MS);
  let last: unknown = new Error("tanpa model");
  for (const model of opts.models ?? TEXT_MODELS) {
    const left = deadline - Date.now();
    if (left < 500) break;
    const controller = new AbortController();
    // tiap model dibatasi sendiri biar satu model lambat gak ngabisin jatah model cadangan
    const timer = setTimeout(() => controller.abort(), Math.min(left, opts.perModelMs ?? PER_MODEL_MS));
    try {
      const res = await fetch(`${NINE_ROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${NINE_ROUTER_API_KEY}` },
        signal: controller.signal,
        body: JSON.stringify({ model, stream: false, response_format: { type: "json_object" }, messages }),
      });
      if (!res.ok) throw new Error(`${model}: HTTP ${res.status}`);
      const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
      return { json: parseModelJson(data.choices?.[0]?.message?.content), model };
    } catch (cause) {
      last = cause;
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}

export async function generateCulturalStoryAndValidation(params: {
  spotName: string;
  opkCategory: string;
  verifiedLoreSource: string;
  riddleClue?: string;
  loreNarrative?: string;
  // rujukan terkurasi [R0], [R1].. : satu2nya bahan fakta yg boleh dipakai model
  context?: string;
  userQueryOrImageBase64?: string;
  mode: "STORYTELLER" | "LENS_SCAN";
}) {
  const systemPrompt = `Anda adalah LOKAWIRA Cultural AI Guardian.
Tugas Anda adalah menyampaikan kisah Tradisi Lisan dan memvalidasi objek budaya Indonesia secara akurat.
ATURAN MUTLAK BEBAS HALUSINASI:
1. Fakta budaya HANYA boleh diambil dari RUJUKAN di bawah. Jangan menambah nama, tahun, angka, tokoh, atau peristiwa yang tidak tertulis di rujukan.
2. Jika pertanyaan wisatawan tidak terjawab oleh rujukan, katakan terus terang bahwa rujukannya belum tersedia, lalu ceritakan yang ada di rujukan.
3. Kategori budaya: ${params.opkCategory}. Sumber utama: ${params.verifiedLoreSource}.
4. Gaya bahasa memikat untuk generasi muda, tetap menghormati pakem adat. Bahasa Indonesia, maksimal 90 kata untuk story.
5. Kembalikan JSON murni: {"story": string, "riddle": string}. riddle = teka-teki singkat menuju titik misi berikutnya.

RUJUKAN:
${params.context || `[R0] ${params.loreNarrative || params.verifiedLoreSource}`}`;

  if (!NINE_ROUTER_API_KEY) {
    return {
      isVerified: true,
      sourceMode: "CURATED_RAG_FALLBACK",
      story:
        params.loreNarrative ||
        `Di balik ${params.spotName}, tersimpan warisan ${params.opkCategory} yang dijaga turun-temurun oleh komunitas lokal (${params.verifiedLoreSource}).`,
      riddle:
        params.riddleClue ||
        "Temukan bengkel perajin atau seduhan kuliner warisan di titik berpendar berikutnya untuk membuka lencana dan voucer diskon!",
    };
  }

  try {
    const { json: parsed } = await chatJson([
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          params.mode === "LENS_SCAN"
            ? `Verifikasi pemindaian objek budaya di ${params.spotName} dan berikan narasi singkat beserta pengesahan voucer UMKM.`
            : params.userQueryOrImageBase64
            ? `Wisatawan di ${params.spotName} bertanya: "${params.userQueryOrImageBase64}". Jawab hanya berdasarkan RUJUKAN, lalu beri teka-teki singkat.`
            : `Sambut wisatawan di ${params.spotName} dengan penggalan kisah tradisi lisan dan berikan teka-teki singkat menuju titik UMKM/Sanggar terdekat.`,
      },
    ]);
    const story = typeof parsed.story === "string" ? parsed.story.trim() : "";
    if (!story) throw new Error("Cerita kosong");
    return {
      isVerified: true,
      sourceMode: "NINE_ROUTER_LIVE",
      story: story.slice(0, 1200),
      riddle: (typeof parsed.riddle === "string" && parsed.riddle.trim()) || params.riddleClue,
    };
  } catch {
    return {
      isVerified: true,
      sourceMode: "CURATED_RAG_FALLBACK",
      story:
        params.loreNarrative ||
        `Di balik ${params.spotName}, tersimpan warisan ${params.opkCategory} yang dijaga turun-temurun oleh komunitas lokal (${params.verifiedLoreSource}).`,
      riddle:
        params.riddleClue ||
        "Temukan bengkel perajin atau seduhan kuliner warisan di titik berpendar berikutnya untuk membuka lencana dan voucer diskon!",
    };
  }
}
