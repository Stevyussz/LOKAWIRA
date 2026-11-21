"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import Loka from "@/components/brand/Loka";
import { NusantaraCornerFrame, NusantaraPatternStrip, PrasastiSeal, RegionCoverBanner } from "@/components/brand/NusantaraOrnaments";
import Icon from "@/components/ui/Icon";
import { useLokawira } from "@/components/layout/LokawiraProvider";

// poster A5 utk dipasang di depan sanggar/lapak: orang yg cuma lewat bisa pindai pakai kamera HP biasa
// & langsung liat isinya (kisah, acara, voucer). Gak perlu pasang aplikasi dulu
export default function PosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { spots, dataStatus } = useLokawira();
  const spot = spots.find((s) => s.id === id);
  const [svg, setSvg] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    const link = `${window.location.origin}/?titik=${encodeURIComponent(id)}`;
    setUrl(link);
    QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#2A2433", light: "#FFFAEE" } }).then(setSvg).catch(() => setSvg(""));
  }, [id]);

  if (!spot) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p role="status" className="text-sm text-pebble">{dataStatus === "loading" ? "Memuat lapak" : "Lapak tidak ditemukan atau belum bisa diakses."}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 flex flex-col items-center gap-4 print:p-0">
      <div className="print:hidden flex flex-wrap gap-2 justify-center">
        <button type="button" onClick={() => window.print()} className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center gap-2">
          <Icon name="download" size={18} />
          <span>Cetak atau simpan PDF</span>
        </button>
        <Link href="/merchant-pos" className="btn-tactile-secondary min-h-[48px] px-5 text-sm inline-flex items-center gap-2">
          <Icon name="back" size={18} />
          <span>Kembali ke dasbor</span>
        </Link>
      </div>
      {spot.status && spot.status !== "PUBLISHED" && (
        <p role="status" className="print:hidden text-xs font-bold text-quotaFull text-center max-w-md">
          Lapak ini belum tampil di peta. Poster tetap bisa dicetak, tapi baru berguna setelah pengelola menerbitkannya.
        </p>
      )}

      <article
        aria-label={`Poster ${spot.name}`}
        data-vibe={spot.vibe}
        className="relative w-full max-w-[148mm] rounded-3xl bg-basalt border-4 border-vibePrimary overflow-hidden print:border-[3mm] print:rounded-none print:max-w-none print:h-[200mm] flex flex-col justify-between"
      >
        <NusantaraPatternStrip vibe={spot.vibe} height={10} />
        <div className="relative flex-1 p-5 sm:p-7 flex flex-col items-center text-center gap-3.5 justify-center">
          <NusantaraCornerFrame size={26} />
          <div className="relative z-10 w-full">
            <RegionCoverBanner
              vibe={spot.vibe}
              compact
              eyebrow={spot.opkCategory}
              title={spot.name}
              subtitle={spot.highlight || spot.regionName}
            />
          </div>
          <div className="relative z-10 flex items-center justify-center gap-3 pt-1">
            <Loka variant="mark" size={38} />
            <span className="font-display text-lg font-extrabold text-vibePrimary tracking-wide">LOKAWIRA</span>
            <PrasastiSeal size={36} />
          </div>
          <p className="relative z-10 text-sm text-pebble max-w-sm">
            Pindai QR ini dengan kamera HP untuk membuka kisah budaya, jadwal acara, dan voucer kunjungan.
          </p>
          {svg ? (
            <div
              role="img"
              aria-label={`Kode QR menuju ${spot.name}`}
              className="relative z-10 w-[56mm] h-[56mm] max-w-full rounded-2xl border-2 border-stoneSubtle bg-[#FFFAEE] p-2 [&>svg]:w-full [&>svg]:h-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <p role="status" className="text-sm text-pebble">Membuat kode QR</p>
          )}
          <div className="relative z-10 space-y-0.5">
            <p className="font-num text-[11px] text-pebble break-all">{url}</p>
            <p className="text-xs font-bold text-alabaster">{spot.regionName}</p>
          </div>
        </div>
        <NusantaraPatternStrip vibe={spot.vibe} height={10} />
      </article>
    </main>
  );
}
