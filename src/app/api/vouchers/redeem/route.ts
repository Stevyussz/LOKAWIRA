import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { ownsSpot, requireRole } from "@/lib/server/mockBackend";

export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  try {
    const body = await request.json();
    const rawCode = String(body.code || "").trim().toUpperCase();

    if (!rawCode) {
      return NextResponse.json(
        { error: "Masukkan 6 digit angka atau kode lengkap voucer (contoh: LKW-849201)." },
        { status: 400 }
      );
    }

    const store = getLokawiraStore();
    const normalizedCode = rawCode.startsWith("LKW-") ? rawCode : `LKW-${rawCode}`;

    const target = store.vouchers.find(
      (v) => v.code.toUpperCase() === normalizedCode || v.code.toUpperCase() === rawCode
    );

    if (!target) {
      return NextResponse.json(
        {
          error: `Kode voucer "${rawCode}" tidak ditemukan di registri aktif. Pastikan kode sesuai tiket wisatawan.`,
        },
        { status: 404 }
      );
    }

    if (!ownsSpot(auth.user, target.spotId)) {
      return NextResponse.json(
        { error: "Voucer ini berlaku di lapak lain, bukan lapak Anda.", code: "NOT_YOUR_VOUCHER" },
        { status: 403 }
      );
    }

    if (target.status === "REDEEMED") {
      return NextResponse.json(
        {
          error: `Kode voucer "${target.code}" sudah pernah ditebus sebelumnya (${target.redeemedAt}).`,
          code: "VOUCHER_ALREADY_REDEEMED",
        },
        { status: 409 }
      );
    }

    target.status = "REDEEMED";
    target.redeemedAt = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB";

    return NextResponse.json({
      redeemedVoucher: target,
      vouchers: store.vouchers,
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal memvalidasi voucer di kasir UMKM." },
      { status: 500 }
    );
  }
}
