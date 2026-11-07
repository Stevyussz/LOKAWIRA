"use client";

import React, { useEffect, useState } from "react";
import { MotionChoice, MotionReason, readChoice, setChoice, useMotion } from "@/lib/motionPref";

const OPTIONS: { value: MotionChoice; label: string }[] = [
  { value: "auto", label: "Otomatis" },
  { value: "full", label: "Penuh" },
  { value: "lite", label: "Hemat" },
];

const TIER_LABEL = { full: "penuh", lite: "hemat", reduce: "dikurangi" } as const;

// alasan pakai bahasa awam, biar pengguna tau kenapa animasinya ilang
const REASON: Record<MotionReason, string> = {
  choice: "",
  "os-reduce": "pengaturan “kurangi animasi” di HP-mu menyala (sering ikut aktif saat mode hemat baterai)",
  "low-memory": "RAM HP ini sekitar 3 GB ke bawah",
  "low-cores": "prosesor HP ini tergolong ringan",
  "save-data": "mode hemat data di HP-mu menyala",
  "slow-net": "jaringan sedang lambat",
  "low-fps": "layar sempat tersendat saat dibuka",
  none: "",
};

export default function MotionSetting() {
  const { tier, reason } = useMotion();
  const [choice, setLocal] = useState<MotionChoice>("auto");
  useEffect(() => setLocal(readChoice()), [tier]);

  const pick = (v: MotionChoice) => {
    setLocal(v);
    setChoice(v);
  };

  const why = choice === "auto" && REASON[reason] ? ` karena ${REASON[reason]}` : "";

  return (
    <fieldset className="rounded-2xl bg-slateElev p-3.5 space-y-2.5">
      <legend className="sr-only">Animasi</legend>
      <div className="flex items-center justify-between gap-3">
        <p aria-hidden="true" className="text-xs font-extrabold text-alabaster">Animasi</p>
        <div className="flex gap-1 rounded-xl bg-obsidian p-1">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`min-h-[40px] px-3 rounded-lg text-xs font-extrabold flex items-center cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-vibePrimary ${
                choice === o.value ? "bg-vibePrimary text-[var(--vibe-on-primary)]" : "text-pebble"
              }`}
            >
              <input type="radio" name="motion-choice" value={o.value} checked={choice === o.value} onChange={() => pick(o.value)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
      </div>
      <p role="status" className="text-[11px] text-pebble leading-snug">
        Sekarang: <b className="text-alabaster">{TIER_LABEL[tier]}</b>
        {why}.
        {choice === "auto" && tier !== "full" ? " Pilih Penuh kalau ingin tetap ada animasi." : ""}
        {choice === "full" ? " Kalau terasa berat, pilih Hemat." : ""}
      </p>
    </fieldset>
  );
}
