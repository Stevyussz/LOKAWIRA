import { awardXp, currentUser, mockDisabled, profileOf } from "@/lib/server/mockBackend";
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
    if (isUpload) {
      const form = await request.formData();
      const file = form.get("image");
      spotId = String(form.get("spotId") ?? "");
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
      ({ sampleId, spotId, customImageName } = await request.json());
    }
    const store = getLokawiraStore();

    const sample =
      CULTURAL_OBJECT_SAMPLES.find((s) => s.id === sampleId) ||
      CULTURAL_OBJECT_SAMPLES.find((s) => s.spotId === spotId) ||
      CULTURAL_OBJECT_SAMPLES[0];

    const spot =
      store.spots.find((s) => s.id === (spotId || sample.spotId)) ||
      store.spots[0];

    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const voucherCode = `LKW-${randomDigits}`;
    const issuedVoucher: IssuedVoucher = {
      code: voucherCode,
      signatureHash: `sha256:${Date.now().toString(16)}`,
      spotId: spot.id,
      merchantName: spot.quest.voucherReward.merchantName,
      discountTitle: spot.quest.voucherReward.discountTitle,
      discountAmount: spot.quest.voucherReward.discountAmount,
      minimumSpend: spot.quest.voucherReward.minimumSpend,
      expiresAt: "Berlaku 7 Hari (Sirkular UMKM)",
      status: "ACTIVE",
    };

    store.vouchers.unshift(issuedVoucher);

    const responsePayload: LensVerificationResult = {
      isVerified: true,
      confidenceScore: sample.confidence,
      detectedObjectName: customImageName
        ? `${sample.objectName} (${customImageName})`
        : sample.objectName,
      culturalStory: sample.storyResult,
      opkReference: sample.opkCategory,
      verifiedSource: sample.verifiedSource,
      awardedPoints: spot.quest.rewardPoints,
      issuedVoucher,
    };

    // user login: XP, voucer, dan kartu lore dicatat di akunnya oleh server
    const user = currentUser(request);
    if (user) {
      const prof = profileOf(user.id);
      prof.voucherCodes.add(issuedVoucher.code);
      awardXp(user.id, responsePayload.awardedPoints);
      prof.loreCards.unshift({
        id: `lore-${Date.now().toString(36)}`,
        spotId: spot.id,
        objectName: responsePayload.detectedObjectName,
        opkCategory: responsePayload.opkReference,
        verifiedSource: responsePayload.verifiedSource,
        story: responsePayload.culturalStory,
        unlockedAt: new Date().toISOString(),
        confidenceScore: responsePayload.confidenceScore,
      });
    }

    return NextResponse.json(responsePayload);
  } catch {
    return NextResponse.json(
      { error: "Gagal memverifikasi objek budaya" },
      { status: 500 }
    );
  }
}
