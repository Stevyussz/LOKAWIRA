"use client";

import React, { useMemo } from "react";
import Sheet from "@/components/ui/Sheet";
import Icon from "@/components/ui/Icon";
import Loka from "@/components/brand/Loka";
import { downloadIcs } from "@/lib/ics";
import { trackOnce } from "@/lib/track";
import { entryOf, ENTRY_LABEL, tzOf, TZ_LABEL } from "@/lib/spotRules";
import { repeatText } from "@/lib/eventRules";
import type { CulturalSpot, EventOccurrence } from "@/types/lokawira";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  regionName: string;
  occurrences: EventOccurrence[] | null; // null = masih dimuat
  error: string | null;
  onRetry: () => void;
  spots: CulturalSpot[];
  onShowOnMap: (spot: CulturalSpot) => void;
}

// agenda budaya: acara 30 hari ke depan di kawasan, dikelompokkan per hari
export default function AgendaSheet({ isOpen, onClose, regionName, occurrences, error, onRetry, spots, onShowOnMap }: Props) {
  const byId = useMemo(() => new Map(spots.map((s) => [s.id, s])), [spots]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: EventOccurrence[] }[] = [];
    const now = new Date();
    for (const o of occurrences ?? []) {
      const s = byId.get(o.spotId);
      const tz = s ? tzOf(s) : "Asia/Jakarta";
      const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
      const key = fmt(new Date(o.startsAt));
      const today = fmt(now);
      const tomorrow = fmt(new Date(now.getTime() + 86400000));
      const label =
        new Date(o.startsAt) <= now ? "Sedang berlangsung" : key === today ? "Hari ini" : key === tomorrow ? "Besok" : new Intl.DateTimeFormat("id-ID", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(o.startsAt));
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(o);
      else out.push({ key: `${label}-${key}`, label, items: [o] });
    }
    return out;
  }, [occurrences, byId]);

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id="agenda-title" className="font-display text-xl min-[380px]:text-2xl font-extrabold text-alabaster leading-tight">Agenda budaya</h2>
        <p className="text-xs text-pebble mt-1">Acara 30 hari ke depan di {regionName}. Tekan Ingatkan aku supaya tidak terlewat.</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Tutup agenda" className="btn-tactile-secondary min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0">
        <Icon name="close" size={18} weight="bold" />
      </button>
    </div>
  );

  return (
    <Sheet isOpen={isOpen} onClose={onClose} titleId="agenda-title" header={header}>
      {error ? (
        <div role="alert" className="py-8 text-center space-y-3">
          <p className="text-sm font-bold text-quotaFull">{error}</p>
          <button type="button" onClick={onRetry} className="btn-tactile-secondary min-h-[44px] px-4 text-xs">Coba lagi</button>
        </div>
      ) : occurrences === null ? (
        <p role="status" className="py-8 text-center text-sm text-pebble">Memuat agenda</p>
      ) : groups.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <div className="flex justify-center"><Loka size={72} mood="think" /></div>
          <p className="text-base font-extrabold text-alabaster">Belum ada acara terjadwal</p>
          <p className="text-sm text-pebble">Sanggar dan lapak di kawasan ini belum mengisi jadwal. Coba kawasan lain, atau jelajahi titiknya di peta.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label} className="space-y-2.5">
              <h3 className="text-xs font-extrabold text-vibePrimary capitalize">{g.label}</h3>
              <ul className="space-y-2.5">
                {g.items.map((o) => {
                  const s = byId.get(o.spotId);
                  const tz = s ? tzOf(s) : "Asia/Jakarta";
                  const t = (iso: string) => new Intl.DateTimeFormat("id-ID", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
                  const en = s ? entryOf(s) : null;
                  return (
                    <li key={`${o.eventId}-${o.startsAt}`} className="list-none rounded-2xl bg-slateElev p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <span className="font-num text-sm font-extrabold text-alabaster shrink-0 w-[92px]">
                          {t(o.startsAt)}–{t(o.endsAt)}
                          <span className="block text-[11px] font-bold text-pebble">{TZ_LABEL[tz]}</span>
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-alabaster leading-snug">{o.title}</p>
                          <p className="text-xs text-pebble mt-0.5">{o.spotName}</p>
                          <p className="text-[11px] text-pebble mt-0.5">
                            {repeatText(o, tz)}
                            {en ? ` · ${en.mode === "TICKET" && en.priceIdr ? `Tiket Rp${en.priceIdr.toLocaleString("id-ID")}` : ENTRY_LABEL[en.mode]}` : ""}
                          </p>
                        </div>
                      </div>
                      {o.description && <p className="text-xs text-alabaster leading-relaxed">{o.description}</p>}
                      <div className="flex flex-wrap gap-2">
                        {s && (
                          <button type="button" onClick={() => onShowOnMap(s)} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5" aria-label={`Lihat ${o.spotName} di peta`}>
                            <Icon name="pin" size={16} />
                            <span>Lihat di peta</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            trackOnce("REMINDER_SAVED", o.spotId);
                            downloadIcs({ title: o.title, description: o.description, place: `${o.spotName}${s ? `, ${s.address}` : ""}`, startsAt: o.startsAt, endsAt: o.endsAt, url: `${window.location.origin}/?titik=${o.spotId}` });
                          }}
                          className="btn-tactile-primary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5"
                          aria-label={`Ingatkan aku: ${o.title}`}
                        >
                          <Icon name="calendar" size={16} />
                          <span>Ingatkan aku</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}
