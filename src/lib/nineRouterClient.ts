const NINE_ROUTER_BASE_URL = process.env.NINE_ROUTER_BASE_URL || "https://api.9router.local/v1";
const NINE_ROUTER_API_KEY = process.env.NINE_ROUTER_API_KEY || "";
// model reasoning kadang >3 dtk; bisa diatur, default 8 dtk (lewat itu pakai narasi kurasi)
const NINE_ROUTER_TIMEOUT_MS = Number(process.env.NINE_ROUTER_TIMEOUT_MS) || 8000;

// isi balasan model kadang dibungkus ```json ... ```; ambil objek JSON-nya aja
export function parseModelJson(content: unknown): Record<string, unknown> {
  const text = String(content ?? "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Balasan model bukan JSON");
  return JSON.parse(text.slice(start, end + 1));
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NINE_ROUTER_TIMEOUT_MS);

    const response = await fetch(`${NINE_ROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NINE_ROUTER_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.NINE_ROUTER_MODEL || "gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
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
        ],
      }),
    });

    clearTimeout(timeout);
    if (!response.ok) throw new Error(`9router status: ${response.status}`);
    const data = await response.json();
    const parsed = parseModelJson(data?.choices?.[0]?.message?.content);
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
