"use client";

import React from "react";
import MoneyField from "@/components/merchant/MoneyField";
import type { CulturalSpot, EntryMode, OpeningHours, SpotEntry, SpotEvent } from "@/types/lokawira";
import { entryOf } from "@/lib/spotRules";

// isian bareng buat form lapak/titik: cara masuk, jam buka, & (pengelola) jadwal acara
export interface ScheduleValue {
  mode: EntryMode;
  price: number;
  note: string;
  hoursOn: boolean;
  days: number[];
  open: string;
  close: string;
  eventOn: boolean;
  start: string; // datetime-local
  end: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function scheduleFrom(spot?: Pick<CulturalSpot, "entry" | "spotType" | "openingHours" | "event"> | null, spotType?: CulturalSpot["spotType"]): ScheduleValue {
  const en = spot ? entryOf(spot) : { mode: (spotType === "PRIMARY_DEST" ? "RESERVATION" : "FREE") as EntryMode };
  return {
    mode: en.mode,
    price: en.priceIdr ?? 0,
    note: en.note ?? "",
    hoursOn: !!spot?.openingHours,
    days: spot?.openingHours?.days ?? [1, 2, 3, 4, 5, 6, 0],
    open: spot?.openingHours?.open ?? "08:00",
    close: spot?.openingHours?.close ?? "17:00",
    eventOn: !!spot?.event,
    start: spot?.event ? toLocalInput(spot.event.startsAt) : "",
    end: spot?.event ? toLocalInput(spot.event.endsAt) : "",
  };
}

export function scheduleErrors(v: ScheduleValue, allowEvent: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.mode === "TICKET" && (!Number.isInteger(v.price) || v.price < 0 || v.price > 10_000_000)) e.price = "Harga tiket Rp0 sampai Rp10.000.000.";
  if (v.note.length > 140) e.note = "Keterangan maksimal 140 karakter.";
  if (v.hoursOn) {
    if (!v.days.length) e.days = "Pilih minimal satu hari buka.";
    if (!v.open || !v.close || v.open === v.close) e.hours = "Isi jam buka dan tutup (tidak boleh sama).";
  }
  if (allowEvent && v.eventOn) {
    const s = new Date(v.start).getTime();
    const t = new Date(v.end).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(t)) e.event = "Isi tanggal dan jam mulai serta selesai acara.";
    else if (t <= s) e.event = "Waktu selesai harus setelah waktu mulai.";
  }
  return e;
}

// bentuk yg dikirim ke server. null = hapus (buat PATCH)
export function schedulePayload(v: ScheduleValue, allowEvent: boolean): { entry: SpotEntry; openingHours: OpeningHours | null; event?: SpotEvent | null } {
  const entry: SpotEntry = { mode: v.mode, ...(v.mode === "TICKET" ? { priceIdr: v.price } : {}), ...(v.note.trim() ? { note: v.note.trim() } : {}) };
  const openingHours = v.hoursOn ? { days: v.days, open: v.open, close: v.close } : null;
  if (!allowEvent) return { entry, openingHours };
  return { entry, openingHours, event: v.eventOn ? { startsAt: new Date(v.start).toISOString(), endsAt: new Date(v.end).toISOString() } : null };
}

const DAYS: [number, string][] = [[1, "Sen"], [2, "Sel"], [3, "Rab"], [4, "Kam"], [5, "Jum"], [6, "Sab"], [0, "Min"]];
const MODES: { v: EntryMode; t: string; d: string }[] = [
  { v: "FREE", t: "Masuk bebas", d: "Tanpa tiket. Cocok untuk warung, toko, dan acara publik." },
  { v: "RESERVATION", t: "Gratis, pesan slot", d: "Tempat terbatas, pengunjung memesan jam masuk." },
  { v: "TICKET", t: "Bertiket", d: "Ada harga masuk. Pengunjung memesan jam lalu bayar di tempat." },
];
const field = "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";
const labelCls = "block text-xs font-bold text-pebble mb-1.5";
const err = (id: string, m?: string) => (m ? <p id={id} role="alert" className="mt-1 text-xs font-bold text-quotaFull">{m}</p> : null);

export default function ScheduleFields({ id, value, onChange, errors, allowEvent }: { id: string; value: ScheduleValue; onChange: (v: ScheduleValue) => void; errors: Record<string, string>; allowEvent: boolean }) {
  const set = (p: Partial<ScheduleValue>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className={labelCls}>Cara masuk</legend>
        {MODES.map((m) => (
          <label key={m.v} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-vibePrimary ${value.mode === m.v ? "border-vibePrimary bg-[var(--vibe-surface-tint)]" : "border-stoneStrong bg-basalt"}`}>
            <input type="radio" name={`${id}-mode`} value={m.v} checked={value.mode === m.v} onChange={() => set({ mode: m.v })} className="mt-1 accent-[var(--vibe-primary)]" />
            <span>
              <span className="block text-sm font-extrabold text-alabaster">{m.t}</span>
              <span className="block text-xs text-pebble">{m.d}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {value.mode === "TICKET" && (
        <div className="space-y-3">
          <MoneyField id={`${id}-price`} label="Harga tiket per orang" value={value.price} onChange={(n) => set({ price: n })} error={errors.price} zeroLabel="Gratis" />
          <div>
            <label htmlFor={`${id}-note`} className={labelCls}>Cara beli (opsional)</label>
            <input id={`${id}-note`} type="text" maxLength={140} value={value.note} onChange={(e) => set({ note: e.target.value })} placeholder="Contoh: Bayar di loket, bisa QRIS" className={field} />
            {err(`${id}-err-note`, errors.note)}
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <label className="flex items-center gap-2.5 text-sm font-extrabold text-alabaster min-h-[44px] cursor-pointer">
          <input type="checkbox" checked={value.hoursOn} onChange={(e) => set({ hoursOn: e.target.checked })} className="w-5 h-5 accent-[var(--vibe-primary)]" />
          Punya jam buka
        </label>
        <p className="text-xs text-pebble -mt-1">Kalau tidak dicentang, dianggap buka setiap saat. Di luar jam buka, pengunjung tidak bisa check-in atau memindai.</p>
        {value.hoursOn && (
          <div className="space-y-3 pl-1">
            <fieldset>
              <legend className={labelCls}>Hari buka</legend>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map(([d, t]) => {
                  const on = value.days.includes(d);
                  return (
                    <label key={d} className={`min-w-[48px] min-h-[44px] px-2.5 rounded-xl border-2 text-xs font-extrabold flex items-center justify-center cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-vibePrimary ${on ? "border-vibePrimary bg-[var(--vibe-surface-tint)] text-alabaster" : "border-stoneStrong bg-basalt text-pebble"}`}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => set({ days: on ? value.days.filter((x) => x !== d) : [...value.days, d] })} />
                      {t}
                    </label>
                  );
                })}
              </div>
              {err(`${id}-err-days`, errors.days)}
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${id}-open`} className={labelCls}>Buka</label>
                <input id={`${id}-open`} type="time" value={value.open} onChange={(e) => set({ open: e.target.value })} className={`${field} font-num`} />
              </div>
              <div>
                <label htmlFor={`${id}-close`} className={labelCls}>Tutup</label>
                <input id={`${id}-close`} type="time" value={value.close} onChange={(e) => set({ close: e.target.value })} className={`${field} font-num`} />
              </div>
            </div>
            <p className="text-xs text-pebble">Jam tutup lebih awal dari jam buka berarti buka sampai lewat tengah malam.</p>
            {err(`${id}-err-hours`, errors.hours)}
          </div>
        )}
      </div>

      {allowEvent && (
        <div className="space-y-2.5">
          <label className="flex items-center gap-2.5 text-sm font-extrabold text-alabaster min-h-[44px] cursor-pointer">
            <input type="checkbox" checked={value.eventOn} onChange={(e) => set({ eventOn: e.target.checked })} className="w-5 h-5 accent-[var(--vibe-primary)]" />
            Ini acara dengan tanggal tertentu
          </label>
          <p className="text-xs text-pebble -mt-1">Misalnya pentas atau festival. Setelah acara selesai, titik otomatis hilang dari peta wisatawan.</p>
          {value.eventOn && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${id}-start`} className={labelCls}>Mulai</label>
                <input id={`${id}-start`} type="datetime-local" value={value.start} onChange={(e) => set({ start: e.target.value })} className={`${field} font-num`} />
              </div>
              <div>
                <label htmlFor={`${id}-end`} className={labelCls}>Selesai</label>
                <input id={`${id}-end`} type="datetime-local" value={value.end} onChange={(e) => set({ end: e.target.value })} className={`${field} font-num`} />
              </div>
              <div className="sm:col-span-2">{err(`${id}-err-event`, errors.event)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
