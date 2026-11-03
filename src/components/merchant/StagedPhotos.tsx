"use client";

import React, { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { MAX_REFERENCE_PHOTOS } from "@/components/merchant/ReferencePhotos";
import { fileToJpeg } from "@/lib/image";

export interface Staged {
  id: string;
  blob: Blob;
  url: string;
}

interface Props {
  idPrefix: string;
  items: Staged[];
  onChange: (items: Staged[]) => void;
}

// foto contoh yg dipilih sebelum lapak dibuat (diunggah setelah lapak tersimpan)
export default function StagedPhotos({ idPrefix, items, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState("");
  const latest = useRef(items);
  latest.current = items;
  // bersihin URL pratinjau pas komponen ditutup
  useEffect(() => () => latest.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  const add = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_REFERENCE_PHOTOS - items.length;
    const next: Staged[] = [];
    setError("");
    try {
      for (const f of Array.from(files).slice(0, room)) {
        const blob = await fileToJpeg(f);
        next.push({ id: `${Date.now()}-${next.length}`, blob, url: URL.createObjectURL(blob) });
      }
      onChange([...items, ...next]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Foto gagal diproses.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const full = items.length >= MAX_REFERENCE_PHOTOS;
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
          {items.map((s, i) => (
            <li key={s.id} className="list-none relative aspect-square rounded-xl overflow-hidden border border-stoneSubtle bg-obsidian">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={`Foto contoh ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                aria-label={`Hapus foto contoh ${i + 1}`}
                onClick={() => {
                  URL.revokeObjectURL(s.url);
                  onChange(items.filter((x) => x.id !== s.id));
                }}
                className="absolute top-1 right-1 min-w-[44px] min-h-[44px] -m-1.5 rounded-full flex items-center justify-center"
              >
                <span className="w-7 h-7 rounded-full bg-basalt text-quotaFull flex items-center justify-center shadow-sm"><Icon name="close" size={14} weight="bold" /></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={fileRef} id={`${idPrefix}-photos`} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => add(e.target.files)} disabled={full} />
      <label htmlFor={`${idPrefix}-photos`} className={`btn-tactile-secondary min-h-[48px] px-4 text-sm inline-flex items-center justify-center gap-2 cursor-pointer ${full ? "opacity-60 pointer-events-none" : ""}`}>
        <Icon name="camera" size={18} className="text-vibePrimary" />
        <span>{full ? "Foto sudah penuh" : "Tambah foto contoh"}</span>
      </label>
      {error && <p role="alert" className="text-xs font-bold text-quotaFull">{error}</p>}
    </div>
  );
}
