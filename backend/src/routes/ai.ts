import type { FastifyInstance } from "fastify";
import type { CulturalSpot, IssuedVoucher, LensVerificationResult, OpkCategory, UnlockedLoreCard } from "@/types/lokawira";
import { aiConfigured, chatJson, generateCulturalStoryAndValidation, VISION_MODELS } from "@/lib/nineRouterClient";
import { buildContext, pickNotes, type LoreNote } from "@/lib/server/loreContext";
import { OPK_VALUES } from "@/lib/enums";
import { pool, tx } from "../db.js";
import { addXp, bad, claimOnce, fail, findVisibleSpot, getEntity, listEntities, newId, profileOf, rateLimit, saveEntity, sha, uniqueCode, voucherSignature } from "../core.js";
import { bodyOf, currentUser, requireRoles } from "../http.js";
import { geofence } from "../geofence.js";
import { IMAGE_TYPES, imageSignatureMatches } from "./spots.js";
import { assertOpen } from "./economy.js";

const MIN_CONFIDENCE = 0.65;
const SCAN_TIMEOUT_MS = Number(process.env.NINE_ROUTER_SCAN_TIMEOUT_MS) || 30000;

type AiVerdict = { isVerified: boolean; confidence: number; objectName: string; message?: string };

// verifikasi foto ke model multimodal lewat 9router. Model cuma menilai cocok/enggak, kisahnya tetep dr narasi kurasi (anti halusinasi)
async function verifyWithAi(spot: CulturalSpot, image: { type: string; data: Buffer }): Promise<AiVerdict | "UNAVAILABLE"> {
  if (!aiConfigured()) return "UNAVAILABLE";
  const refs = await Promise.all(
    (spot.quest.referenceImages ?? []).slice(0, 3).map(async (ref) => {
      const r = await pool.query<{ file_data: Buffer; mime_type: string }>("SELECT file_data,mime_type FROM entities WHERE kind='reference-image' AND id=$1", [ref.id]);
      const x = r.rows[0];
      return x ? { type: "image_url", image_url: { url: `data:${x.mime_type};base64,${x.file_data.toString("base64")}` } } : null;
    })
  );
  const refParts = refs.filter((x): x is NonNullable<typeof x> => x !== null);
  const prompt = [
    `Objek yang harus dipotret wisatawan di "${spot.name}": ${spot.quest.targetObjectPrompt}.`,
    "Gambar PERTAMA adalah foto wisatawan." + (refParts.length ? ` ${refParts.length} gambar berikutnya adalah foto contoh resmi dari pemilik lapak sebagai pembanding.` : ""),
    "Nilai HANYA apakah objek di foto wisatawan sama jenisnya dengan objek yang diminta. Abaikan latar, tempat, atau etalase: lokasi wisatawan sudah dicek GPS oleh sistem.",
    "Tolak bila objeknya berbeda, tidak terlihat jelas, atau foto jelas-jelas memotret layar HP/monitor.",
    'Balas HANYA JSON: {"isVerified": boolean, "confidenceScore": number 0..1, "detectedObjectName": string singkat bahasa Indonesia, "message": string singkat bila tidak cocok}.',
    "Jika ragu, isVerified false.",
  ].join("\n");
  try {
    const { json: j } = await chatJson(
      [
        { role: "system", content: "Anda verifikator objek budaya yang konservatif. Jangan mengarang. Jawab JSON saja." },
        { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${image.type};base64,${image.data.toString("base64")}` } }, ...refParts] },
      ],
      { models: VISION_MODELS, timeoutMs: SCAN_TIMEOUT_MS, perModelMs: 15000 }
    );
    const confidence = Math.max(0, Math.min(1, Number(j.confidenceScore) || 0));
    return {
      isVerified: j.isVerified === true && confidence >= MIN_CONFIDENCE,
      confidence,
      objectName: String(j.detectedObjectName ?? "").trim().slice(0, 80),
      message: typeof j.message === "string" ? j.message.trim().slice(0, 200) : undefined,
    };
  } catch (cause) {
    console.warn("Verifikasi AI gagal:", (cause as Error).message);
    return "UNAVAILABLE";
  }
}

export default async function aiRoutes(app: FastifyInstance) {
  app.post("/api/ai/storyteller", async (request) => {
    const b = bodyOf(request);
    const user = currentUser(request);
    await rateLimit(pool, `story:${user?.id ?? sha(request.ip)}`, 40, 600, "Loka butuh jeda sebentar. Coba lagi beberapa menit lagi.");
    const row = await findVisibleSpot(pool, user, b.spotId);
    if (!row) fail(404, "Titik lokasi tidak ditemukan.");
    const spot = row.payload;
    const question = typeof b.customQuestion === "string" ? b.customQuestion.trim().slice(0, 300) : "";
    const notes = pickNotes(spot, (await listEntities<LoreNote>(pool, "ai-note")).map((x) => x.payload), question);
    const top = notes[0];
    const result = await generateCulturalStoryAndValidation({
      spotName: spot.name,
      opkCategory: spot.opkCategory,
      verifiedLoreSource: spot.quest.verifiedLoreSource,
      riddleClue: spot.quest.riddleClue,
      context: buildContext(spot, notes),
      loreNarrative: question
        ? top
          ? `Soal "${question}": menurut ${top.maestroSource}, ${top.summary} ${spot.quest.loreNarrative}`
          : `Soal "${question}": rujukan khususnya belum ada di Pengetahuan Loka. Yang tercatat dari ${spot.quest.verifiedLoreSource}: ${spot.quest.loreNarrative}`
        : spot.quest.loreNarrative,
      userQueryOrImageBase64: question || undefined,
      mode: "STORYTELLER",
    });
    return {
      spotId: spot.id,
      spotName: spot.name,
      opkCategory: spot.opkCategory,
      verifiedSource: spot.quest.verifiedLoreSource,
      references: [spot.quest.verifiedLoreSource, ...notes.map((n) => n.maestroSource)].filter((v, i, a) => a.indexOf(v) === i),
      riddleTitle: spot.quest.riddleTitle,
      ...result,
    };
  });

  // pindai objek: foto wajib (JPEG/PNG/WebP asli), titik buka, dekat (kalo geofence nyala). Hadiah cuma akun, sekali/titik/hari WIB
  app.post("/api/ai/lens-verify", async (request) => {
    if (!request.isMultipart()) bad("Kirim foto objek sebagai multipart/form-data (field image).");
    const fields: Record<string, string> = {};
    let image: { type: string; data: Buffer } | null = null;
    try {
      for await (const part of request.parts()) {
        if (part.type === "file") {
          const data = await part.toBuffer();
          if (part.fieldname === "image" && !image) image = { type: part.mimetype, data };
        } else fields[part.fieldname] = String(part.value ?? "");
      }
    } catch {
      fail(413, "Foto lebih dari 5 MB.", "IMAGE_TOO_LARGE");
    }
    if (!image) bad("Foto belum dilampirkan.");
    if (!IMAGE_TYPES.has(image.type)) fail(415, "Format foto harus JPEG, PNG, atau WebP.", "IMAGE_TYPE_UNSUPPORTED");
    if (!imageSignatureMatches(image.type, image.data)) fail(415, "Isi foto tidak sesuai dengan format berkasnya.", "IMAGE_TYPE_UNSUPPORTED");

    const user = currentUser(request);
    const row = await findVisibleSpot(pool, user, fields.spotId);
    if (!row) fail(404, "Titik lokasi tidak ditemukan.", "NOT_FOUND");
    const spot = row.payload;
    geofence({ lat: fields.lat, lng: fields.lng, accuracyMeters: fields.accuracyMeters }, spot, "memindai objek");
    assertOpen(spot);
    // tiap pindai = panggilan AI berbayar: dibatasi per akun / per IP
    await rateLimit(pool, `scan:${user?.id ?? sha(request.ip)}`, 20, 600, "Terlalu banyak pemindaian. Tunggu beberapa menit lalu coba lagi.");

    const base = { opkReference: spot.opkCategory as OpkCategory, verifiedSource: spot.quest.verifiedLoreSource };
    if (image.data.length < 8 * 1024) {
      return { ...base, isVerified: false, confidenceScore: 0.1, detectedObjectName: "", culturalStory: "", awardedPoints: 0, message: "Foto terlalu kecil atau buram. Coba foto lebih dekat, terang, dan fokus ke satu objek." } satisfies LensVerificationResult;
    }
    const verdict = await verifyWithAi(spot, image);
    if (verdict === "UNAVAILABLE") {
      return { ...base, isVerified: false, confidenceScore: 0, detectedObjectName: "", culturalStory: "", awardedPoints: 0, message: "Pemeriksa foto sedang tidak tersedia. Coba lagi sebentar." } satisfies LensVerificationResult;
    }
    if (!verdict.isVerified) {
      return {
        ...base,
        isVerified: false,
        confidenceScore: verdict.confidence,
        detectedObjectName: verdict.objectName,
        culturalStory: "",
        awardedPoints: 0,
        message: verdict.message || `Objek belum cocok dengan misi (${spot.quest.targetObjectPrompt}). Coba foto lebih dekat dan jelas.`,
      } satisfies LensVerificationResult;
    }

    const objectName = verdict.objectName || spot.quest.targetObjectPrompt;
    const story = spot.quest.loreNarrative;
    if (!user) {
      return { ...base, isVerified: true, confidenceScore: verdict.confidence, detectedObjectName: objectName, culturalStory: story, awardedPoints: 0, rewardNote: "LOGIN_FOR_REWARD" } satisfies LensVerificationResult;
    }
    return tx(async (c) => {
      const first = await claimOnce(c, user.id, spot.id, "SCAN");
      let issuedVoucher: IssuedVoucher | undefined;
      if (first) {
        const code = await uniqueCode(c, "voucher", "LKW", "code");
        const r = spot.quest.voucherReward;
        issuedVoucher = {
          code,
          signatureHash: voucherSignature(code, spot.id),
          spotId: spot.id,
          merchantName: r.merchantName,
          discountTitle: r.discountTitle,
          discountAmount: r.discountAmount,
          minimumSpend: r.minimumSpend,
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          issuedAt: new Date().toISOString(),
          status: "ACTIVE",
        };
        await c.query("INSERT INTO entities(id,kind,owner_id,payload) VALUES($1,'voucher',$2,$3)", [code, user.id, JSON.stringify(issuedVoucher)]);
        await addXp(c, user.id, spot.quest.rewardPoints);
      }
      // kartu kisah disimpan sekali per titik+objek
      const prof = await profileOf(c, user.id);
      if (!prof.lore_cards.some((x) => x.spotId === spot.id && x.objectName === objectName)) {
        const card: UnlockedLoreCard = { id: newId("lore"), spotId: spot.id, objectName, opkCategory: spot.opkCategory, verifiedSource: spot.quest.verifiedLoreSource, story, unlockedAt: new Date().toISOString(), confidenceScore: verdict.confidence };
        await c.query("UPDATE profiles SET lore_cards=$1 WHERE user_id=$2", [JSON.stringify([card, ...prof.lore_cards].slice(0, 200)), user.id]);
      }
      return {
        ...base,
        isVerified: true,
        confidenceScore: verdict.confidence,
        detectedObjectName: objectName,
        culturalStory: story,
        awardedPoints: first ? spot.quest.rewardPoints : 0,
        issuedVoucher,
        rewardNote: first ? undefined : "ALREADY_CLAIMED_TODAY",
      } satisfies LensVerificationResult;
    });
  });

  // Pengetahuan Loka (rujukan budaya buat AI): cuma pengelola
  const noteList = async () => (await listEntities<LoreNote & { updatedAt: string }>(pool, "ai-note")).map((x) => x.payload);
  const parseNote = (b: Record<string, unknown>, partial: boolean) => {
    const out: Partial<LoreNote> = {};
    if (!partial || b.opkCategory !== undefined) {
      if (!OPK_VALUES.includes(b.opkCategory as OpkCategory)) bad("Kategori OPK tidak valid.");
      out.opkCategory = b.opkCategory as string;
    }
    if (!partial || b.maestroSource !== undefined) {
      const v = String(b.maestroSource ?? "").trim();
      if (v.length < 5 || v.length > 160) bad("Sumber 5 sampai 160 huruf.");
      out.maestroSource = v;
    }
    if (!partial || b.summary !== undefined) {
      const v = String(b.summary ?? "").trim();
      if (v.length < 20 || v.length > 2000) bad("Ringkasan 20 sampai 2.000 huruf.");
      out.summary = v;
    }
    return out;
  };
  app.post("/api/ai-notes", async (request, reply) => {
    requireRoles(request, ["ADMIN"]);
    const note = { ...(parseNote(bodyOf(request), false) as LoreNote), id: newId("rag"), updatedAt: new Date().toISOString() };
    await saveEntity(pool, "ai-note", note.id, note);
    return reply.code(201).send({ aiTrainingNotes: await noteList() });
  });
  app.patch<{ Params: { id: string } }>("/api/ai-notes/:id", async (request) => {
    requireRoles(request, ["ADMIN"]);
    const row = await getEntity<LoreNote & { updatedAt: string }>(pool, "ai-note", request.params.id);
    if (!row) fail(404, "Rujukan tidak ditemukan.");
    Object.assign(row.payload, parseNote(bodyOf(request), true), { updatedAt: new Date().toISOString() });
    await saveEntity(pool, "ai-note", row.id, row.payload);
    return { aiTrainingNotes: await noteList() };
  });
  app.delete<{ Params: { id: string } }>("/api/ai-notes/:id", async (request) => {
    requireRoles(request, ["ADMIN"]);
    const r = await pool.query("DELETE FROM entities WHERE kind='ai-note' AND id=$1", [request.params.id]);
    if (!r.rowCount) fail(404, "Rujukan tidak ditemukan.");
    return { aiTrainingNotes: await noteList() };
  });
}
