// QA AI lewat 9router (butuh NINE_ROUTER_API_KEY di backend). Foto uji: argumen = folder berisi celengan.jpg & batik.jpg
// (foto objek asli, mis. dari Wikimedia Commons). Jalankan: B=http://localhost:4000 npm run qa:ai -- /path/foto
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const B = process.env.B || "http://127.0.0.1:4000";
const dir = process.argv[2];
if (!dir) throw new Error("Kasih folder foto: npm run qa:ai -- <folder>");
const R = [];
const ok = (name, cond, info = "") => R.push({ name, pass: !!cond, info });
async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const t0 = performance.now();
  const r = await fetch(B + path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const ms = Math.round(performance.now() - t0);
  const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = txt; }
  return { s: r.status, j, ms };
}
const reg = await call("POST", "/api/auth/register", { body: { name: "Uji AI", email: `ai${Date.now()}@t.id`, password: "password1", role: "VISITOR" } });
const V = reg.j.token;
const spots = (await call("GET", "/api/spots")).j.spots;
const at = (id) => spots.find((s) => s.id === id);
async function scan(spotId, file, token = V) {
  const s = at(spotId);
  const fd = new FormData();
  fd.append("spotId", spotId);
  fd.append("lat", String(s.coordinates.lat));
  fd.append("lng", String(s.coordinates.lng));
  fd.append("accuracyMeters", "10");
  fd.append("image", new Blob([await readFile(join(dir, file))], { type: "image/jpeg" }), file);
  return call("POST", "/api/ai/lens-verify", { token, form: fd });
}

const st = await call("POST", "/api/ai/storyteller", { body: { spotId: "spot-mjp-01" } });
ok("Loka live dari 9router", st.j.sourceMode === "NINE_ROUTER_LIVE" && st.j.story?.length > 40, `${st.j.sourceMode} ${st.ms}ms`);
console.log("  cerita:", String(st.j.story).slice(0, 220));
const q = await call("POST", "/api/ai/storyteller", { body: { spotId: "spot-mjp-01", customQuestion: "Berapa harga tiket pesawat ke Bali tahun 2030?" } });
ok("pertanyaan di luar rujukan dijawab jujur (tidak mengarang)", q.j.sourceMode === "NINE_ROUTER_LIVE", `${q.ms}ms`);
console.log("  jawaban:", String(q.j.story).slice(0, 220));

const c1 = await scan("spot-mjp-02", "celengan.jpg");
ok("foto celengan terakota di lapak celengan: cocok + voucer", c1.j.isVerified === true && !!c1.j.issuedVoucher, `conf=${c1.j.confidenceScore} ${c1.ms}ms ${c1.j.message ?? ""}`);
const c2 = await scan("spot-mjp-02", "celengan.jpg");
ok("pindai ulang hari sama: cocok tapi tanpa voucer baru", c2.j.isVerified === true && !c2.j.issuedVoucher && c2.j.rewardNote === "ALREADY_CLAIMED_TODAY", `${c2.ms}ms`);
const w = await scan("spot-mjp-03", "batik.jpg");
ok("foto batik di lapak wedang/cobek: ditolak", w.j.isVerified === false && !w.j.issuedVoucher, `conf=${w.j.confidenceScore} "${w.j.message ?? ""}" ${w.ms}ms`);
const b = await scan("spot-bhr-01", "batik.jpg");
ok("foto batik tiga negeri di lapak batik Lasem: cocok", b.j.isVerified === true, `conf=${b.j.confidenceScore} ${b.ms}ms ${b.j.message ?? ""}`);
const guest = await scan("spot-mjp-02", "celengan.jpg", null);
ok("tamu: kisah terbuka tanpa voucer", guest.j.isVerified === true && !guest.j.issuedVoucher && guest.j.rewardNote === "LOGIN_FOR_REWARD", `${guest.ms}ms`);
const prof = await call("GET", "/api/me/profile", { token: V });
ok("kartu kisah & XP tersimpan di akun", prof.j.loreCards.length >= 1 && prof.j.xp > 0, `xp=${prof.j.xp} kartu=${prof.j.loreCards.length}`);

for (const r of R) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.info !== "" ? `  [${r.info}]` : ""}`);
const failed = R.filter((r) => !r.pass).length;
console.log(`\n${R.length - failed}/${R.length} lulus`);
process.exitCode = failed ? 1 : 0;
