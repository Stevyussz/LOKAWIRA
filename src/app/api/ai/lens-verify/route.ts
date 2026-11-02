import { mockDisabled } from "@/lib/server/mockBackend";
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
    const body = await request.json();
    const { sampleId, spotId, customImageName } = body;
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

    return NextResponse.json(responsePayload);
  } catch {
    return NextResponse.json(
      { error: "Gagal memverifikasi objek budaya" },
      { status: 500 }
    );
  }
}
