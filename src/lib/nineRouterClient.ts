const NINE_ROUTER_BASE_URL = (process.env.NINE_ROUTER_BASE_URL || "https://api.9router.local/v1").replace(/\/$/, "");
const NINE_ROUTER_API_KEY = process.env.NINE_ROUTER_API_KEY || "";
// batas waktu total satu jawaban Loka; lewat itu Loka jawab dr data tercatat (offline)
export const TEXT_TIMEOUT_MS = Number(process.env.NINE_ROUTER_TIMEOUT_MS) || 15000;
// kalo model pertama belum jawab sekian ms, model berikutnya ikut dijalankan barengan (yg duluan jawab dipakai)
const HEDGE_MS = Number(process.env.NINE_ROUTER_HEDGE_MS) || 2500;
// daftar model dipisah koma
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

// catatan kesehatan model (di memori proses): rata2 waktu jawab & kapan terakhir gagal.
// Model yg cepat & sehat dicoba duluan, yg baru gagal ditaruh paling belakang
const stats = new Map<string, { ms: number; failedAt: number }>();
function remember(model: string, ms: number | null) {
  const s = stats.get(model) ?? { ms: 0, failedAt: 0 };
  if (ms === null) s.failedAt = Date.now();
  else s.ms = s.ms ? Math.round(s.ms * 0.6 + ms * 0.4) : ms;
  stats.set(model, s);
}
export function orderModels(models: string[], now = Date.now()): string[] {
  const score = (m: string, i: number) => {
    const s = stats.get(m);
    const recentFail = s && now - s.failedAt < 60_000 ? 1e9 : 0;
    // yg belum pernah dipakai: pertahankan urutan di konfigurasi
    return recentFail + (s?.ms || 4000 + i);
  };
  return models.map((m, i) => ({ m, v: score(m, i) })).sort((a, b) => a.v - b.v).map((x) => x.m);
}
export const modelHealth = () => Object.fromEntries(stats);

// panggilan chat ke 9router (non-streaming). Model dijalankan bertahap: tiap HEDGE_MS model berikutnya ikut jalan,
// atau langsung kalo yg sebelumnya gagal. Jawaban valid pertama dipakai, sisanya dibatalkan.
export async function chatJson(
  messages: unknown[],
  opts: { models?: string[]; timeoutMs?: number; hedgeMs?: number; validate?: (j: Record<string, unknown>) => boolean } = {}
): Promise<{ json: Record<string, unknown>; model: string; ms: number }> {
  if (!NINE_ROUTER_API_KEY) throw new Error("NINE_ROUTER_API_KEY kosong");
  const models = orderModels(opts.models ?? TEXT_MODELS);
  const hedge = opts.hedgeMs ?? HEDGE_MS;
  const t0 = Date.now();
  const controllers: AbortController[] = [];
  return new Promise((resolve, reject) => {
    let next = 0;
    let running = 0;
    let done = false;
    let last: unknown = new Error("tanpa model");
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      done = true;
      clearTimeout(deadline);
      clearTimeout(hedgeTimer);
      controllers.forEach((c) => c.abort());
    };
    const deadline = setTimeout(() => {
      if (done) return;
      finish();
      reject(new Error(`tenggat ${opts.timeoutMs ?? TEXT_TIMEOUT_MS}ms habis`));
    }, opts.timeoutMs ?? TEXT_TIMEOUT_MS);
    const launch = () => {
      if (done || next >= models.length) return;
      const model = models[next++];
      const controller = new AbortController();
      controllers.push(controller);
      running++;
      const started = Date.now();
      clearTimeout(hedgeTimer);
      hedgeTimer = setTimeout(launch, hedge);
      fetch(`${NINE_ROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${NINE_ROUTER_API_KEY}` },
        signal: controller.signal,
        body: JSON.stringify({ model, stream: false, response_format: { type: "json_object" }, messages }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`${model}: HTTP ${res.status}`);
          const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
          const json = parseModelJson(data.choices?.[0]?.message?.content);
          if (opts.validate && !opts.validate(json)) throw new Error(`${model}: isi jawaban tidak sesuai format`);
          remember(model, Date.now() - started);
          if (done) return;
          finish();
          resolve({ json, model, ms: Date.now() - t0 });
        })
        .catch((cause) => {
          if (!controller.signal.aborted) remember(model, null);
          last = cause;
          running--;
          if (done) return;
          // gagal: langsung coba model berikutnya. Semua habis & gak ada yg jalan = nyerah
          if (next < models.length) launch();
          else if (running === 0) {
            finish();
            reject(last);
          }
        });
    };
    launch();
  });
}
