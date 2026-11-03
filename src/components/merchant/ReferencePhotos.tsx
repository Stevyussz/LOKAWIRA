"use client";

import React, { useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { API_BASE, api, describeError } from "@/lib/api";
import { fileToJpeg } from "@/lib/image";
import type { ReferenceImage } from "@/types/lokawira";

export const MAX_REFERENCE_PHOTOS = 5;

interface Props {
  spotId: string;
  images: ReferenceImage[];
  // dipanggil dgn daftar foto terbaru stlh unggah/hapus berhasil
  onImages: (images: ReferenceImage[]) => void;
  disabled?: boolean;
}

// foto contoh objek yg dipindai wisatawan. AI membandingkan foto wisatawan dgn foto-foto ini
export default function ReferencePhotos({ spotId, images, onImages, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const room = MAX_REFERENCE_PHOTOS - images.length;

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    let latest = images;
    let sent = 0;
    try {
      for (const f of Array.from(files).slice(0, room)) {
        const blob = await fileToJpeg(f);
        const res = await api.uploadReferenceImage(spotId, blob);
        latest = res.referenceImages;
        sent++;
      }
      onImages(latest);
      if (files.length > room) setMsg({ ok: false, text: `Hanya ${room} foto yang muat. Maksimal ${MAX_REFERENCE_PHOTOS} foto per lapak.` });
      else setMsg({ ok: true, text: `${sent} foto tersimpan.` });
    } catch (err) {
      if (sent > 0) onImages(latest);
      setMsg({ ok: false, text: err instanceof Error && !("kind" in err) ? err.message : describeError(err, "Foto gagal diunggah. Coba lagi.") });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (img: ReferenceImage, n: number) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.deleteReferenceImage(spotId, img.id);
      onImages(res.referenceImages);
      setMsg({ ok: true, text: `Foto ${n} dihapus.` });
    } catch (err) {
      setMsg({ ok: false, text: describeError(err, "Foto gagal dihapus.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {images.length === 0 ? (
        <p className="text-xs text-pebble rounded-xl bg-obsidian p-3 leading-relaxed">
          Belum ada foto contoh. Tambahkan 1 sampai 5 foto objeknya supaya aplikasi bisa mengenali saat wisatawan memotret.
        </p>
      ) : (
        <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
          {images.map((img, i) => (
            <li key={img.id} className="list-none relative aspect-square rounded-xl overflow-hidden border border-stoneSubtle bg-obsidian">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${API_BASE}${img.url}`} alt={`Foto contoh ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => remove(img, i + 1)}
                disabled={busy || disabled}
                aria-label={`Hapus foto contoh ${i + 1}`}
                className="absolute top-1 right-1 min-w-[44px] min-h-[44px] -m-1.5 rounded-full flex items-center justify-center"
              >
                <span className="w-7 h-7 rounded-full bg-basalt text-quotaFull flex items-center justify-center shadow-sm"><Icon name="close" size={14} weight="bold" /></span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input ref={fileRef} id={`ref-${spotId}`} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => pick(e.target.files)} disabled={busy || disabled || room <= 0} />
      <label
        htmlFor={`ref-${spotId}`}
        className={`btn-tactile-secondary min-h-[48px] px-4 text-sm inline-flex items-center justify-center gap-2 cursor-pointer ${busy || disabled || room <= 0 ? "opacity-60 pointer-events-none" : ""}`}
      >
        {busy ? <Icon name="loader" size={18} weight="bold" motion="spin" /> : <Icon name="camera" size={18} className="text-vibePrimary" />}
        <span>{busy ? "Mengunggah" : room <= 0 ? "Foto sudah penuh" : "Tambah foto contoh"}</span>
      </label>
      <p className="text-[11px] text-pebble leading-snug">
        Tips: foto satu objek saja, dari dekat, di tempat terang, dan dari 2 sampai 3 sisi. Maksimal {MAX_REFERENCE_PHOTOS} foto, tiap foto di bawah 5 MB (otomatis dikecilkan).
      </p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs font-bold ${msg.ok ? "text-quotaSafe" : "text-quotaFull"}`}>{msg.text}</p>}
    </div>
  );
}
