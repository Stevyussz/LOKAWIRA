"use client";

import React, { useState } from "react";
import Icon from "@/components/ui/Icon";
import Loka from "@/components/brand/Loka";
import { api, describeError } from "@/lib/api";
import type { LokaMode } from "@/types/api";

const field = "w-full px-3.5 py-3 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";

const modeNote = (m: LokaMode) =>
  m === "AI" ? "Dirapikan Loka hanya dari tulisanmu. Periksa lagi sebelum dipakai." : "Loka sedang offline, jadi tulisanmu cuma dirapikan susunannya. Periksa lagi sebelum dipakai.";

// Loka bantu menulis Info tempat: mitra nulis bebas (poin juga boleh), Loka susun jadi deskripsi + peraturan
export function InfoHelper({ spotId, seed, onUse }: { spotId: string; seed: string; onUse: (r: { description: string; rules: string[] }) => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ description: string; rules: string[]; mode: LokaMode } | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const r = await api.lokaAssist({ task: "polish-info", spotId, notes });
      setResult({ description: r.description ?? "", rules: r.rules ?? [], mode: r.mode });
    } catch (e) {
      setErr(describeError(e, "Loka belum bisa membantu sekarang. Coba lagi sebentar."));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (!notes) setNotes(seed);
        }}
        className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-2"
      >
        <Loka variant="mark" size={22} mood="happy" />
        <span>Bantu tulis dengan Loka</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-slateElev p-3.5 space-y-3">
      <div className="flex items-start gap-2.5">
        <Loka variant="mark" size={28} mood={busy ? "think" : "happy"} />
        <div className="min-w-0">
          <label htmlFor={`loka-notes-${spotId}`} className="block text-xs font-extrabold text-alabaster">Ceritakan lapakmu dengan bebas</label>
          <p className="text-[11px] text-pebble leading-snug">Apa yang dijual atau bisa dilihat, hal unik, dan aturan di tempatmu. Poin-poin juga boleh. Loka tidak menambah fakta baru.</p>
        </div>
      </div>
      <textarea
        id={`loka-notes-${spotId}`}
        rows={4}
        maxLength={2000}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={"jual gerabah buatan sendiri, bisa coba bikin celengan 30 menit\n- lepas sepatu di pendapa\n- jangan sentuh gerabah yang masih basah"}
        className={field}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || notes.trim().length < 15} onClick={run} className="btn-tactile-primary min-h-[44px] px-4 text-xs inline-flex items-center gap-1.5 disabled:opacity-60">
          {busy ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Icon name="craft" size={16} />}
          <span>{busy ? "Merapikan" : "Rapikan"}</span>
        </button>
        <button type="button" onClick={() => { setOpen(false); setResult(null); setErr(null); }} className="btn-tactile-secondary min-h-[44px] px-4 text-xs">Tutup</button>
      </div>
      {err && <p role="alert" className="text-xs font-bold text-quotaFull">{err}</p>}
      {result && (
        <div role="status" className="rounded-xl bg-obsidian p-3 space-y-2">
          <p className="text-[11px] text-pebble">{modeNote(result.mode)}</p>
          {result.description && <p className="text-sm text-alabaster leading-relaxed">{result.description}</p>}
          {result.rules.length > 0 && (
            <ol className="list-decimal pl-5 text-sm text-alabaster space-y-0.5">
              {result.rules.map((r, i) => <li key={i}>{r}</li>)}
            </ol>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onUse({ description: result.description, rules: result.rules });
                setOpen(false);
                setResult(null);
              }}
              className="btn-tactile-primary min-h-[44px] px-4 text-xs inline-flex items-center gap-1.5"
            >
              <Icon name="check" size={16} />
              <span>Pakai hasil ini</span>
            </button>
            <button type="button" onClick={() => setResult(null)} className="btn-tactile-secondary min-h-[44px] px-4 text-xs">Buang</button>
          </div>
        </div>
      )}
    </div>
  );
}

// saran petunjuk misi: teka-teki yg gak nyebut nama objeknya. Mitra pilih satu, bisa diubah lagi
export function ClueHelper({ spotId, story, onPick }: { spotId: string; story: string; onPick: (clue: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ clues: string[]; mode: LokaMode } | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.lokaAssist({ task: "suggest-clue", spotId, story });
      setRes({ clues: r.clues ?? [], mode: r.mode });
    } catch (e) {
      setErr(describeError(e, "Loka belum bisa membantu sekarang. Coba lagi sebentar."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <button type="button" disabled={busy} onClick={run} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-2 disabled:opacity-60">
        {busy ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Loka variant="mark" size={22} mood="happy" />}
        <span>{res ? "Minta saran lain" : "Minta saran petunjuk ke Loka"}</span>
      </button>
      {err && <p role="alert" className="text-xs font-bold text-quotaFull">{err}</p>}
      {res && (
        <div role="status" className="space-y-1.5">
          <p className="text-[11px] text-pebble">
            {res.mode === "AI" ? "Pilih satu, lalu sesuaikan. Loka sengaja tidak menyebut nama objeknya." : "Loka sedang offline. Ini contoh pola petunjuk, sesuaikan dengan lapakmu."}
          </p>
          <ul className="space-y-1.5">
            {res.clues.map((c) => (
              <li key={c} className="list-none">
                <button type="button" onClick={() => onPick(c)} className="w-full min-h-[44px] text-left rounded-xl border border-stoneStrong bg-basalt px-3 py-2 text-xs text-alabaster hover:border-vibePrimary">
                  {c}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
