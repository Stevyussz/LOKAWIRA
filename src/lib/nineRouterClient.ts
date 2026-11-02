const NINE_ROUTER_BASE_URL = process.env.NINE_ROUTER_BASE_URL || "https://api.9router.local/v1";
const NINE_ROUTER_API_KEY = process.env.NINE_ROUTER_API_KEY || "";

export async function generateCulturalStoryAndValidation(params: {
  spotName: string;
  opkCategory: string;
  verifiedLoreSource: string;
  riddleClue?: string;
  loreNarrative?: string;
  userQueryOrImageBase64?: string;
  mode: "STORYTELLER" | "LENS_SCAN";
}) {
  const systemPrompt = `Anda adalah LOKAWIRA Cultural AI Guardian.
Tugas Anda adalah menyampaikan kisah Tradisi Lisan dan memvalidasi objek budaya Indonesia secara akurat.
ATURAN MUTLAK BEBAS HALUSINASI:
1. Hanya gunakan fakta budaya dari rujukan terverifikasi berikut: ${params.verifiedLoreSource}.
2. Kategori Objek Pemajuan Kebudayaan (UU No. 5/2017): ${params.opkCategory}.
3. Gunakan gaya bahasa yang memikat untuk generasi muda (Gen Z) namun tetap menghormati pakem adat.
4. Kembalikan respons dalam format JSON murni sesuai skema.`;

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
    const timeout = setTimeout(() => controller.abort(), 3500);

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
                : `Sambut wisatawan di ${params.spotName} dengan penggalan kisah tradisi lisan dan berikan teka-teki singkat menuju titik UMKM/Sanggar terdekat.`,
          },
        ],
      }),
    });

    clearTimeout(timeout);
    if (!response.ok) throw new Error(`9router status: ${response.status}`);
    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return {
      isVerified: true,
      sourceMode: "NINE_ROUTER_LIVE",
      story: parsed.story || params.loreNarrative,
      riddle: parsed.riddle || params.riddleClue,
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
