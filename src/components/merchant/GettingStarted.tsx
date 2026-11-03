"use client";

import React from "react";
import Icon from "@/components/ui/Icon";
import { DEFAULT_TARGET } from "@/components/merchant/ScanPromoPanel";
import type { CulturalSpot } from "@/types/lokawira";

export type MerchantMenu = "KASIR" | "LAPAK" | "SCAN";

interface Props {
  spots: CulturalSpot[];
  go: (m: MerchantMenu) => void;
}

// panduan langkah buat mitra baru, centang otomatis sesuai data
export default function GettingStarted({ spots, go }: Props) {
  const registered = spots.length > 0;
  const published = spots.some((s) => s.status === "PUBLISHED" || !s.status);
  const rejected = !published && spots.some((s) => s.status === "REJECTED");
  const scanReady = spots.some((s) => s.quest.targetObjectPrompt !== DEFAULT_TARGET && s.quest.targetObjectPrompt.trim().length >= 5 && (s.quest.referenceImages?.length ?? 0) > 0);

  const steps: { done: boolean; title: string; text: string; action?: { label: string; to: MerchantMenu } }[] = [
    {
      done: registered,
      title: "Daftarkan lapakmu",
      text: "Isi nama, lokasi di peta, dan objek yang akan dipotret wisatawan.",
      action: registered ? undefined : { label: "Daftarkan lapak", to: "LAPAK" },
    },
    {
      done: published,
      title: "Tunggu pengelola menyetujui",
      text: rejected
        ? "Lapakmu ditolak. Buka Lapak Saya untuk melihat alasannya, lalu perbaiki dan kirim ulang."
        : registered
        ? "Pengelola memeriksa lapakmu. Setelah disetujui, lapak tampil di peta wisatawan."
        : "Setelah lapak dikirim, pengelola memeriksanya dulu.",
      action: rejected ? { label: "Lihat alasannya", to: "LAPAK" } : undefined,
    },
    {
      done: scanReady,
      title: "Atur objek, foto contoh, dan voucer",
      text: "Tentukan benda yang dipotret wisatawan dan unggah foto contohnya. Atur juga potongan harga untuk mereka.",
      action: registered && !scanReady ? { label: "Atur sekarang", to: "SCAN" } : undefined,
    },
    {
      done: false,
      title: "Layani pengunjung di Kasir",
      text: "Saat pengunjung datang, minta kode dari layar HP-nya (LKW- atau KDR-) lalu ketik di tab Kasir.",
      action: { label: "Buka Kasir", to: "KASIR" },
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  // panduan terbuka cuma buat yg belum punya lapak atau lapaknya ditolak. Sisanya ringkas, langkah berikutnya tetap kelihatan di judul
  const startOpen = !registered || rejected;
  const next = steps.find((s, i) => !s.done && i < 3);

  return (
    <details open={startOpen} className="gamiz-card p-4 group">
      <summary className="cursor-pointer min-h-[44px] flex items-center justify-between gap-3 list-none">
        <span className="min-w-0">
          <span className="text-base font-extrabold text-alabaster block">Mulai di sini: 4 langkah</span>
          {next && <span className="text-xs font-bold text-quotaWarning block">Berikutnya: {next.title}</span>}
        </span>
        <span className="text-xs font-bold text-pebble font-num shrink-0">{doneCount} dari 3 siap</span>
      </summary>
      <ol className="mt-3 space-y-2.5">
        {steps.map((s, i) => (
          <li key={s.title} className="list-none rounded-2xl bg-obsidian p-3.5 flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-extrabold font-num ${s.done ? "bg-quotaSafe text-[var(--vibe-on-primary)]" : "bg-slateElev text-alabaster"}`}
            >
              {s.done ? <Icon name="check" size={16} weight="bold" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-alabaster">
                {s.title}
                {s.done && <span className="sr-only"> (sudah selesai)</span>}
              </p>
              <p className="text-xs text-pebble leading-snug mt-0.5">{s.text}</p>
              {s.action && (
                <button type="button" onClick={() => go(s.action!.to)} className="mt-2 btn-tactile-secondary min-h-[44px] px-4 text-xs">
                  {s.action.label}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
