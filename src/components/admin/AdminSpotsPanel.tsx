"use client";

import React, { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import EditSpotSheet from "@/components/merchant/EditSpotSheet";
import ScanObjectEditor, { DEFAULT_TARGET } from "@/components/merchant/ScanObjectEditor";
import AdminSpotForm from "@/components/admin/AdminSpotForm";
import { formatCoord } from "@/lib/geo";
import { REGIONS } from "@/lib/regions";
import type { CulturalSpot, CulturalVibe, SpotType } from "@/types/lokawira";

const SELECT = "min-h-[44px] px-3 rounded-xl bg-obsidian border border-stoneStrong text-xs font-bold text-alabaster";
const TYPE_LABEL: Record<SpotType, string> = {
  PRIMARY_DEST: "Cagar budaya",
  SANGGAR_SENI: "Sanggar seni",
  UMKM_KULINER: "Makan & minum",
  UMKM_KRIYA: "Kriya & oleh-oleh",
};
const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PUBLISHED: { text: "Tampil di peta", cls: "bg-basalt text-quotaSafe" },
  PENDING_REVIEW: { text: "Menunggu persetujuan", cls: "bg-slateElev text-alabaster" },
  REJECTED: { text: "Ditolak", cls: "bg-slateElev text-quotaFull" },
  ARCHIVED: { text: "Diarsipkan", cls: "bg-slateElev text-pebble" },
};

interface Props {
  spots: CulturalSpot[];
  setSpots: React.Dispatch<React.SetStateAction<CulturalSpot[]>>;
  defaultRegion: CulturalVibe;
  onToast: (text: string, isError?: boolean) => void;
  onReload: () => void;
}

// semua titik di peta: cari/saring, ubah, atur objek scan, dan tambah titik baru
export default function AdminSpotsPanel({ spots, setSpots, defaultRegion, onToast, onReload }: Props) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return spots.filter(
      (s) =>
        (!needle || s.name.toLowerCase().includes(needle) || s.address.toLowerCase().includes(needle)) &&
        (!region || s.vibe === region) &&
        (!type || s.spotType === type) &&
        (!status || (s.status ?? "PUBLISHED") === status)
    );
  }, [spots, q, region, type, status]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <section className="lg:col-span-5 gamiz-card p-5 space-y-3" aria-labelledby="asp-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="asp-title" className="text-base font-extrabold text-alabaster">
            Titik di peta <span className="font-num">({shown.length}{shown.length !== spots.length ? ` dari ${spots.length}` : ""})</span>
          </h2>
          <button type="button" onClick={onReload} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5">
            <Icon name="database" size={16} />
            <span>Muat ulang</span>
          </button>
        </div>

        <div className="space-y-2">
          <label htmlFor="asp-q" className="sr-only">Cari nama atau alamat</label>
          <input id="asp-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau alamat titik" className="w-full min-h-[48px] px-3.5 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted" />
          <div className="grid grid-cols-3 gap-2">
            <label className="sr-only" htmlFor="asp-region">Kawasan</label>
            <select id="asp-region" value={region} onChange={(e) => setRegion(e.target.value)} className={SELECT}>
              <option value="">Semua kawasan</option>
              {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.shortName}</option>)}
            </select>
            <label className="sr-only" htmlFor="asp-type">Jenis</label>
            <select id="asp-type" value={type} onChange={(e) => setType(e.target.value)} className={SELECT}>
              <option value="">Semua jenis</option>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="sr-only" htmlFor="asp-status">Status</label>
            <select id="asp-status" value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT}>
              <option value="">Semua status</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.text}</option>)}
            </select>
          </div>
        </div>

        {spots.length === 0 ? (
          <p className="text-sm text-pebble">Belum ada titik. Tambahkan yang pertama lewat formulir.</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-pebble">Tidak ada titik yang cocok dengan pencarian ini.</p>
        ) : (
          <ul className="space-y-2.5">
            {shown.map((sp) => {
              const st = STATUS_LABEL[sp.status ?? "PUBLISHED"] ?? STATUS_LABEL.PUBLISHED;
              const scanOk = sp.quest.targetObjectPrompt !== DEFAULT_TARGET && (sp.quest.referenceImages?.length ?? 0) > 0;
              return (
                <li key={sp.id} className="list-none bg-obsidian p-3.5 rounded-2xl space-y-1.5">
                  <span className="text-[11px] font-bold text-vibeSecondary">{sp.regionName} • {sp.opkCategory}</span>
                  <h3 className="text-sm font-extrabold text-alabaster">{sp.name}</h3>
                  <p className={`inline-flex text-[11px] font-extrabold px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</p>
                  <p className="text-[11px] text-pebble">{TYPE_LABEL[sp.spotType]} · <span className="font-num">{formatCoord(sp.coordinates)}</span></p>
                  <p className="text-[11px] text-pebble">Sumber: {sp.quest.verifiedLoreSource}</p>
                  <p className={`text-[11px] font-bold ${scanOk ? "text-quotaSafe" : "text-quotaWarning"}`}>
                    {scanOk ? `Objek scan siap (${sp.quest.referenceImages?.length} foto contoh)` : "Objek scan belum lengkap"}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" onClick={() => setEditingId(sp.id)} aria-label={`Ubah ${sp.name}`} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5">
                      <Icon name="craft" size={16} />
                      <span>Ubah</span>
                    </button>
                    <button type="button" onClick={() => setScanId(scanId === sp.id ? null : sp.id)} aria-expanded={scanId === sp.id} aria-label={`Objek dan foto ${sp.name}`} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5">
                      <Icon name="camera" size={16} />
                      <span>Objek &amp; foto</span>
                    </button>
                  </div>
                  {scanId === sp.id && (
                    <div className="pt-3 mt-2 border-t border-stoneSubtle">
                      <ScanObjectEditor spot={sp} setSpots={setSpots} idPrefix={`as-${sp.id}`} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="lg:col-span-7">
        <AdminSpotForm spots={spots} setSpots={setSpots} defaultRegion={defaultRegion} onToast={onToast} />
      </div>

      <EditSpotSheet
        spot={spots.find((s) => s.id === editingId) ?? null}
        allSpots={spots}
        isAdmin
        onClose={() => setEditingId(null)}
        onSpots={(list) => setSpots(list)}
      />
    </div>
  );
}
