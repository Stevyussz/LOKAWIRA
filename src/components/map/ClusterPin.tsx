"use client";

import React from "react";

interface ClusterPinProps {
  count: number;
  names: string[];
  hex: { primary: string };
  hasSelected: boolean;
  onZoom: () => void;
}

// Beberapa titik yg bertumpuk saat peta diperkecil: satu lingkaran berangka, diketuk = perbesar ke kumpulan itu
export default function ClusterPin({ count, names, hex, hasSelected, onZoom }: ClusterPinProps) {
  const d = count >= 10 ? 52 : count >= 5 ? 46 : 40;
  return (
    <button
      type="button"
      onClick={onZoom}
      aria-label={`${count} titik di sekitar sini${hasSelected ? ", termasuk titik pilihanmu" : ""}: ${names.slice(0, 3).join(", ")}${count > 3 ? ", dan lainnya" : ""}. Perbesar peta`}
      className="relative rounded-full flex items-center justify-center font-num font-extrabold text-sm shadow-lg hover:scale-110 before:absolute before:-inset-1 before:content-['']"
      style={{
        width: d,
        height: d,
        backgroundColor: hex.primary,
        color: "var(--vibe-on-primary)",
        border: "3px solid var(--bg-basalt-card)",
        transition: "transform 200ms",
      }}
    >
      <span aria-hidden="true" className="absolute inset-[-7px] rounded-full opacity-30" style={{ backgroundColor: hex.primary }} />
      {hasSelected && <span aria-hidden="true" className="absolute inset-[-11px] rounded-full border-[3px] border-alabaster" />}
      <span className="relative">{count}</span>
    </button>
  );
}
