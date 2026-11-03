"use client";

import React from "react";

const fmt = (n: number) => (Number.isFinite(n) && n > 0 ? n.toLocaleString("id-ID") : "");

interface MoneyFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  // pilihan cepat (opsional), user tetep bisa ngetik nominal sendiri
  presets?: number[];
  help?: string;
  error?: string;
  zeroLabel?: string;
}

// isian nominal rupiah: ketik bebas (titik ribuan otomatis) + tombol pilihan cepat
export default function MoneyField({ id, label, value, onChange, presets = [], help, error, zeroLabel }: MoneyFieldProps) {
  const describedBy = [help ? `${id}-help` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-pebble mb-1.5">{label}</label>
      <div className="relative">
        <span aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-pebble font-num">Rp</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={fmt(value)}
          placeholder="0"
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className="w-full min-h-[48px] pl-11 pr-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-base font-num font-bold text-alabaster placeholder:text-ashMuted"
        />
      </div>
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label={`Pilihan cepat ${label}`}>
          {presets.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={value === n}
              className={`min-h-[44px] px-3 rounded-xl border-2 text-xs font-extrabold font-num ${
                value === n ? "border-vibePrimary bg-[var(--vibe-surface-tint)] text-alabaster" : "border-stoneStrong bg-basalt text-pebble"
              }`}
            >
              {n === 0 && zeroLabel ? zeroLabel : `Rp${n.toLocaleString("id-ID")}`}
            </button>
          ))}
        </div>
      )}
      {help && <p id={`${id}-help`} className="mt-1.5 text-[11px] text-pebble leading-snug">{help}</p>}
      {error && <p id={`${id}-err`} role="alert" className="mt-1 text-xs font-bold text-quotaFull">{error}</p>}
    </div>
  );
}
