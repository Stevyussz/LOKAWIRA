"use client";

import React, { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import { API_BASE } from "@/lib/api";
import { ENTRY_LABEL, entryOf, hoursText, needsBooking, openState, tzOf } from "@/lib/spotRules";
import type { CulturalSpot, EventOccurrence, SpotType } from "@/types/lokawira";

const TYPE_LABEL: Record<SpotType, string> = {
  PRIMARY_DEST: "Cagar budaya",
  SANGGAR_SENI: "Sanggar seni",
  UMKM_KULINER: "Makan & minum",
  UMKM_KRIYA: "Kriya & oleh-oleh",
};
const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

interface Props {
  spot: CulturalSpot | null;
  isOpen: boolean;
  onClose: () => void;
  // acara terdekat di titik ini (dr Agenda), kalo ada
  nextEvent?: EventOccurrence;
  onGuide: (spot: CulturalSpot) => void;
  onTicket: (spot: CulturalSpot) => void;
  onAgenda: () => void;
}

// galeri foto tempat: geser (scroll-snap), tombol kiri/kanan buat keyboard & layar lebar
function Gallery({ spot }: { spot: CulturalSpot }) {
  const items = spot.gallery ?? [];
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [spot.id]);

  if (items.length === 0) return null;
  const go = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(items.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  return (
    <section aria-label={`Galeri foto ${spot.name}`} aria-roledescription="carousel" className="space-y-2">
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
          className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl bg-obsidian [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((img, i) => (
            <div key={img.id} role="group" aria-roledescription="slide" aria-label={`Foto ${i + 1} dari ${items.length}`} className="snap-center shrink-0 w-full">
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${API_BASE}${img.url}`}
                alt={img.caption || `Foto ${spot.name} ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                className="w-full aspect-[4/3] object-cover"
              />
              {img.caption && <figcaption className="px-3 py-2 text-xs text-pebble">{img.caption}</figcaption>}
            </figure>
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label="Foto sebelumnya"
              className="absolute left-1.5 top-[calc(50%-22px)] min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center disabled:opacity-0"
            >
              <span className="w-8 h-8 rounded-full bg-basalt/90 text-alabaster flex items-center justify-center shadow-sm">
                <Icon name="back" size={16} weight="bold" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === items.length - 1}
              aria-label="Foto berikutnya"
              className="absolute right-1.5 top-[calc(50%-22px)] min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center disabled:opacity-0"
            >
              <span className="w-8 h-8 rounded-full bg-basalt/90 text-alabaster flex items-center justify-center shadow-sm">
                <Icon name="next" size={16} weight="bold" />
              </span>
            </button>
          </>
        )}
      </div>
      {items.length > 1 && (
        <p className="text-[11px] font-bold text-pebble text-center" aria-live="polite">
          <span className="font-num">{index + 1}</span> / <span className="font-num">{items.length}</span>
        </p>
      )}
    </section>
  );
}

// baris fakta: ikon + label (dt) + isi (dd). div cuma boleh berisi dt/dd, jadi ikonnya ditaruh di dlm dt
function Fact({ icon, label, children }: { icon: React.ComponentProps<typeof Icon>["name"]; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[18px_1fr] gap-x-3 py-2.5">
      <dt className="contents">
        <Icon name={icon} size={18} className="text-vibePrimary row-span-2 mt-0.5" />
        <span className="text-[11px] font-bold text-pebble">{label}</span>
      </dt>
      <dd className="col-start-2 min-w-0 text-sm text-alabaster leading-snug break-words">{children}</dd>
    </div>
  );
}

// sheet Info tempat: deskripsi, galeri, peraturan, cara masuk, jam, acara, alamat, fasilitas, kontak
export default function SpotInfoSheet({ spot, isOpen, onClose, nextEvent, onGuide, onTicket, onAgenda }: Props) {
  if (!spot) return null;
  const en = entryOf(spot);
  const os = openState(spot);
  const booking = needsBooking(spot);
  const about = spot.description || spot.highlight;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${spot.coordinates.lat},${spot.coordinates.lng}`;
  const tz = tzOf(spot);
  const entryText =
    en.mode === "TICKET"
      ? en.priceIdr !== undefined
        ? en.priceIdr === 0
          ? "Bertiket, gratis"
          : `Bertiket, ${rupiah(en.priceIdr)} per orang`
        : ENTRY_LABEL.TICKET
      : en.mode === "RESERVATION"
      ? "Gratis, pesan slot dulu"
      : "Bebas masuk, tanpa tiket";

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold text-vibePrimary">
          {TYPE_LABEL[spot.spotType]} · {spot.opkCategory}
        </p>
        <h2 id="spot-info-title" className="font-display text-xl font-extrabold text-alabaster leading-tight">
          {spot.name}
        </h2>
        <p className="text-xs text-pebble mt-0.5">{spot.regionName}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Tutup info" className="btn-tactile-secondary min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0">
        <Icon name="close" size={18} weight="bold" />
      </button>
    </div>
  );

  return (
    <Sheet isOpen={isOpen} onClose={onClose} titleId="spot-info-title" header={header} maxWidthClass="sm:max-w-xl">
      <div className="space-y-5 pt-1 pb-2">
        <Gallery spot={spot} />

        {about && <p className="text-sm text-alabaster leading-relaxed">{about}</p>}

        {spot.rules && spot.rules.length > 0 && (
          <section aria-labelledby="spot-info-rules" className="rounded-2xl bg-[var(--vibe-surface-tint)] p-3.5 space-y-2">
            <h3 id="spot-info-rules" className="text-xs font-extrabold text-alabaster flex items-center gap-2">
              <Icon name="shield" size={16} className="text-vibePrimary" />
              Peraturan pengunjung
            </h3>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-alabaster leading-snug marker:font-num marker:text-pebble">
              {spot.rules.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
          </section>
        )}

        <dl className="divide-y divide-stoneSubtle">
          <Fact icon="ticket" label="Cara masuk">
            {entryText}
            {en.note && <span className="block text-xs text-pebble mt-0.5">{en.note}</span>}
          </Fact>
          <Fact icon="calendar" label="Jam buka">
            {spot.event ? os.label : hoursText(spot)}
            {os.label && !spot.event && (
              <span className={`block text-xs font-bold mt-0.5 ${os.status === "OPEN" ? "text-quotaSafe" : "text-quotaFull"}`}>{os.label}</span>
            )}
          </Fact>
          {nextEvent && (
            <Fact icon="sanggar" label="Acara berikutnya">
              <button type="button" onClick={onAgenda} className="text-left underline underline-offset-2 decoration-vibePrimary min-h-[24px]">
                <b>{nextEvent.title}</b>,{" "}
                {new Intl.DateTimeFormat("id-ID", { timeZone: tz, weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(nextEvent.startsAt))}
              </button>
            </Fact>
          )}
          <Fact icon="pin" label="Alamat">
            {spot.address}
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block text-xs font-extrabold text-vibePrimary underline underline-offset-2 mt-0.5 min-h-[24px]">
              Buka di Google Maps
            </a>
          </Fact>
          {spot.facilities.length > 0 && (
            <Fact icon="check" label="Fasilitas">
              <span className="flex flex-wrap gap-1.5 mt-1">
                {spot.facilities.map((f) => (
                  <span key={f} className="px-2.5 py-1 rounded-full bg-obsidian text-[11px] font-extrabold text-alabaster">
                    {f}
                  </span>
                ))}
              </span>
            </Fact>
          )}
          {spot.contact && (
            <Fact icon="user" label="Kontak">
              {spot.contact}
            </Fact>
          )}
          <Fact icon="story" label="Misi di sini">
            {spot.quest.riddleTitle} · <span className="font-num">+{spot.quest.rewardPoints}</span> XP
            <span className="block text-xs text-pebble mt-0.5">Sumber kisah: {spot.quest.verifiedLoreSource}</span>
          </Fact>
        </dl>

        <div className={`grid gap-2 ${booking ? "grid-cols-2" : "grid-cols-1"}`}>
          <button type="button" onClick={() => onGuide(spot)} className="btn-tactile-primary min-h-[48px] px-4 text-sm flex items-center justify-center gap-2">
            <Icon name="compass" size={20} />
            <span>Pandu aku</span>
          </button>
          {booking && (
            <button type="button" onClick={() => onTicket(spot)} className="btn-tactile-secondary min-h-[48px] px-4 text-sm flex items-center justify-center gap-2">
              <Icon name="ticket" size={20} className="text-vibePrimary" />
              <span>{en.mode === "RESERVATION" ? "Pesan slot" : "Pesan tiket"}</span>
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
