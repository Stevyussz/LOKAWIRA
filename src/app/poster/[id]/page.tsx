"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import Loka from "@/components/brand/Loka";
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
        className="w-full max-w-[148mm] rounded-3xl bg-basalt border-4 border-vibePrimary p-6 sm:p-8 flex flex-col items-center text-center gap-4 print:border-[3mm] print:rounded-none print:max-w-none print:h-[200mm]"
      >
        <div className="flex items-center gap-2">
          <Loka variant="mark" size={40} />
          <span className="font-display text-lg font-extrabold text-vibePrimary">LOKAWIRA</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold text-alabaster leading-tight">{spot.name}</h1>
        {spot.highlight && <p className="text-base font-bold text-alabaster">{spot.highlight}</p>}
        <p className="text-sm text-pebble">Pindai dengan kamera HP untuk tahu isinya: kisah budaya, jadwal acara, dan voucer kunjungan.</p>
        {svg ? (
          <div role="img" aria-label={`Kode QR menuju ${spot.name}`} className="w-[60mm] h-[60mm] max-w-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <p role="status" className="text-sm text-pebble">Membuat kode QR</p>
        )}
        <p className="font-num text-[11px] text-pebble break-all">{url}</p>
        <p className="text-xs text-pebble">{spot.regionName}</p>
      </article>
    </main>
  );
}
