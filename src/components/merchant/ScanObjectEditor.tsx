"use client";

import React, { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import ReferencePhotos from "@/components/merchant/ReferencePhotos";
import { api, describeError } from "@/lib/api";
import type { CulturalSpot } from "@/types/lokawira";

const input = "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";
const labelCls = "block text-xs font-bold text-pebble mb-1.5";
// teks bawaan saat lapak didaftarkan tanpa nama objek. Dianggap "belum diatur"
export const DEFAULT_TARGET = "Produk atau karya di lapak ini";

interface Props {
  spot: CulturalSpot;
  setSpots: React.Dispatch<React.SetStateAction<CulturalSpot[]>>;
  disabled?: boolean;
  // id unik biar beberapa editor di satu halaman gak bentrok
  idPrefix?: string;
}

// nama objek yg dipotret wisatawan + foto contohnya (dipakai di dasbor mitra dan pengelola)
export default function ScanObjectEditor({ spot, setSpots, disabled, idPrefix = "so" }: Props) {
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setTarget(spot.quest.targetObjectPrompt === DEFAULT_TARGET ? "" : spot.quest.targetObjectPrompt);
    setMsg(null);
    setErr("");
  }, [spot.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const images = spot.quest.referenceImages ?? [];
  const targetReady = spot.quest.targetObjectPrompt !== DEFAULT_TARGET && spot.quest.targetObjectPrompt.trim().length >= 5;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (target.trim().length < 5) {
      setErr("Tulis nama objeknya, minimal 5 huruf. Contoh: Tungku tanah liat di halaman depan.");
      return;
    }
    setErr("");
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.updateSpot(spot.id, { quest: { targetObjectPrompt: target.trim() } });
      setSpots(res.spots);
      setMsg({ ok: true, text: "Objek tersimpan. Wisatawan akan diminta memotret objek ini." });
    } catch (e2) {
      setMsg({ ok: false, text: describeError(e2, "Objek gagal disimpan.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="space-y-3" noValidate>
        <div>
          <label htmlFor={`${idPrefix}-target`} className={labelCls}>Nama atau ciri objek</label>
          <input id={`${idPrefix}-target`} type="text" value={target} onChange={(e) => setTarget(e.target.value)} aria-invalid={!!err} aria-describedby={err ? `${idPrefix}-err` : `${idPrefix}-help`} placeholder="Contoh: Tungku tanah liat di halaman depan" className={input} />
          <p id={`${idPrefix}-help`} className="mt-1.5 text-[11px] text-pebble leading-snug">Tulis yang jelas dan khas, jangan terlalu umum. &quot;Batik tulis motif kawung&quot; lebih baik daripada &quot;kain&quot;.</p>
          {err && <p id={`${idPrefix}-err`} role="alert" className="mt-1 text-xs font-bold text-quotaFull">{err}</p>}
        </div>
        <button type="submit" disabled={busy || disabled} className="btn-tactile-secondary min-h-[48px] px-5 text-sm inline-flex items-center gap-2 disabled:opacity-70">
          {busy ? <Icon name="loader" size={18} weight="bold" motion="spin" /> : <Icon name="check" size={18} />}
          <span>{busy ? "Menyimpan" : "Simpan objek"}</span>
        </button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs font-bold ${msg.ok ? "text-quotaSafe" : "text-quotaFull"}`}>{msg.text}</p>}
      </form>

      <div className="pt-2 border-t border-stoneSubtle space-y-2">
        <p className="text-xs font-extrabold text-alabaster">Foto contoh objek ({images.length}/5)</p>
        <ReferencePhotos
          spotId={spot.id}
          images={images}
          disabled={disabled}
          onImages={(imgs) => setSpots((prev) => prev.map((s) => (s.id === spot.id ? { ...s, quest: { ...s.quest, referenceImages: imgs } } : s)))}
        />
      </div>
      <p className={`text-[11px] font-bold ${targetReady && images.length > 0 ? "text-quotaSafe" : "text-quotaWarning"}`}>
        {targetReady && images.length > 0 ? "Siap. Objek dan foto contoh sudah ada." : "Belum lengkap: isi nama objek dan tambahkan minimal 1 foto contoh."}
      </p>
    </div>
  );
}
