import { NextResponse } from "next/server";

// cek hidup. checkInRadiusMeters cuma ada kalo server mewajibkan jarak buat check-in (klien pake ini buat nahan tombol Check-In sblm tiba)
export async function GET() {
  const on = process.env.GEOFENCE_ENABLED === "true";
  return NextResponse.json({
    ok: true,
    version: "1.0.0",
    time: new Date().toISOString(),
    ...(on ? { checkInRadiusMeters: Number(process.env.GEOFENCE_RADIUS_METERS) || 100 } : {}),
  });
}
