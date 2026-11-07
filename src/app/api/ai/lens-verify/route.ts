import crypto from "node:crypto";
import { awardXp, claimOnce, currentUser, mockDisabled, profileOf, visibleSpots } from "@/lib/server/mockBackend";
import { geofenceCheck } from "@/lib/server/geofence";
import { openState } from "@/lib/spotRules";
import { NextRequest, NextResponse } from "next/server";
import {
  CULTURAL_OBJECT_SAMPLES,
  getLokawiraStore,
} from "@/lib/seedCulturalData";
import { IssuedVoucher, LensVerificationResult } from "@/types/lokawira";

export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  try {
    const isUpload = (request.headers.get("content-type") ?? "").includes("multipart/form-data");
    let sampleId: string | undefined;
    let spotId: string | undefined;
    let customImageName: string | undefined;
    // bukti lokasi (dipake kalo geofence nyala): upload lewat field form, demo lewat JSON
    let where: { lat?: unknown; lng?: unknown; accuracyMeters?: unknown } = {};
    if (isUpload) {
      const form = await request.formData();
      const file = form.get("image");
      spotId = String(form.get("spotId") ?? "");
      where = { lat: form.get("lat"), lng: form.get("lng"), accuracyMeters: form.get("accuracyMeters") };
      if (!(file instanceof File)) return NextResponse.json({ error: "Foto belum dilampirkan." }, { status: 400 });
      if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Foto lebih dari 5 MB.", code: "IMAGE_TOO_LARGE" }, { status: 413 });
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        return NextResponse.json({ error: "Format foto harus JPEG, PNG, atau WebP.", code: "IMAGE_TYPE_UNSUPPORTED" }, { status: 415 });
      }
      // server cth gak punya model AI: foto yg terlalu kecil dianggap gak dikenali (biar kasus gagalnya bisa dicoba)
      if (file.size < 8 * 1024) {
        const miss: LensVerificationResult = {
          isVerified: false,
          confidenceScore: 0.12,
          detectedObjectName: "",
          culturalStory: "",
          opkReference: "Cagar Budaya",
          verifiedSource: "",
          awardedPoints: 0,
          message: "Objek belum dikenali. Coba foto lebih dekat, terang, dan fokus ke satu objek.",
        };
        return NextResponse.json(miss);
      }
    } else {
      const j = await request.json();
      ({ sampleId, spotId, customImageName } = j);
      where = { lat: j.lat, lng: j.lng, accuracyMeters: j.accuracyMeters };
    }
    const store = getLokawiraStore();

    const sample =
      CULTURAL_OBJECT_SAMPLES.find((s) => s.id === sampleId) ||
      CULTURAL_OBJECT_SAMPLES.find((s) => s.spotId === spotId) ||
      CULTURAL_OBJECT_SAMPLES[0];

    const user = currentUser(request);
    // cuma titik yg keliatan buat dia; id salah = 404, bkn diem2 pake titik pertama
    const spot = visibleSpots(user).find((s) => s.id === (spotId || sample.spotId));
    if (!spot) return NextResponse.json({ error: "Titik lokasi tidak ditemukan.", code: "NOT_FOUND" }, { status: 404 });

    // scan cuma sah kalo orangnya beneran di lokasi (geofence mati = dilewati)
    const outside = geofenceCheck(where, spot, "memindai objek");
    if (outside) return outside;
    // tutup / acara belum mulai: objeknya gak bisa didatangi, hadiah gak sah
    const os = openState(spot);
    if (os.status === "CLOSED" || os.status === "UPCOMING" || os.status === "ENDED") {
      return NextResponse.json({ error: `${spot.name} sedang tidak buka. ${os.label}.`, code: "CLOSED_NOW" }, { status: 409 });
    }

    // hadiah (XP + voucer) cuma buat akun, sekali per titik per hari. Tamu tetep dapet kisahnya.
    // Tanpa batas ini, pindai ulang = voucer baru terus (dipanen)
    const first = user ? claimOnce(user.id, spot.id, "SCAN") : false;
    let issuedVoucher: IssuedVoucher | undefined;
    if (first) {
      let code = "";
      do code = `LKW-${crypto.randomInt(100000, 999999)}`;
      while (store.vouchers.some((v) => v.code === code));
      issuedVoucher = {
        code,
        signatureHash: `sha256:${crypto.randomBytes(8).toString("hex")}`,
        spotId: spot.id,
        merchantName: spot.quest.voucherReward.merchantName,
        discountTitle: spot.quest.voucherReward.discountTitle,
        discountAmount: spot.quest.voucherReward.discountAmount,
        minimumSpend: spot.quest.voucherReward.minimumSpend,
        // berlaku 7 hari (ISO, dicek kasir)
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        issuedAt: new Date().toISOString(),
        status: "ACTIVE",
      };
      store.vouchers.unshift(issuedVoucher);
    }

    const responsePayload: LensVerificationResult = {
      isVerified: true,
      confidenceScore: sample.confidence,
      detectedObjectName: customImageName
        ? `${sample.objectName} (${customImageName})`
        : sample.objectName,
      culturalStory: sample.storyResult,
      opkReference: sample.opkCategory,
      verifiedSource: sample.verifiedSource,
      awardedPoints: first ? spot.quest.rewardPoints : 0,
      issuedVoucher,
      rewardNote: !user ? "LOGIN_FOR_REWARD" : first ? undefined : "ALREADY_CLAIMED_TODAY",
    };

    // user login: XP, voucer, dan kartu lore dicatat di akunnya oleh server. Kartu kisah yg sama gak dobel
    if (user) {
      const prof = profileOf(user.id);
      if (issuedVoucher) prof.voucherCodes.add(issuedVoucher.code);
      awardXp(user.id, responsePayload.awardedPoints);
      if (!prof.loreCards.some((c) => c.spotId === spot.id && c.objectName === responsePayload.detectedObjectName)) {
        prof.loreCards.unshift({
          id: `lore-${crypto.randomBytes(4).toString("hex")}`,
          spotId: spot.id,
          objectName: responsePayload.detectedObjectName,
          opkCategory: responsePayload.opkReference,
          verifiedSource: responsePayload.verifiedSource,
          story: responsePayload.culturalStory,
          unlockedAt: new Date().toISOString(),
          confidenceScore: responsePayload.confidenceScore,
        });
      }
    }

    return NextResponse.json(responsePayload);
  } catch {
    return NextResponse.json(
      { error: "Gagal memverifikasi objek budaya" },
      { status: 500 }
    );
  }
}
