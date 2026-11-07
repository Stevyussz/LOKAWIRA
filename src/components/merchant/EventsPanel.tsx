"use client";

import React, { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { api, describeError } from "@/lib/api";
import { repeatText } from "@/lib/eventRules";
import { tzOf } from "@/lib/spotRules";
import type { CulturalEvent, CulturalSpot, EventRepeat } from "@/types/lokawira";

const FIELD = "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";
const LABEL = "block text-xs font-bold text-pebble mb-1.5";
const REPEATS: { v: EventRepeat; t: string }[] = [
  { v: "NONE", t: "Sekali saja" },
  { v: "WEEKLY", t: "Tiap minggu" },
  { v: "MONTHLY_LAST", t: "Minggu terakhir tiap bulan" },
];

// acara di lapak mitra (pentas, latihan terbuka, kelas). Tampil di Agenda wisatawan & kartu titik
export default function EventsPanel({ mySpots, accountBlocked }: { mySpots: CulturalSpot[]; accountBlocked: boolean }) {
  const [events, setEvents] = useState<CulturalEvent[] | null>(null);
  const [spotId, setSpotId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("19:00");
  const [end, setEnd] = useState("21:00");
  const [repeat, setRepeat] = useState<EventRepeat>("WEEKLY");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .listEvents({ days: 1 })
      .then((r) => setEvents(r.events ?? []))
      .catch((e) => {
        setEvents([]);
        setMsg({ ok: false, text: describeError(e, "Daftar acara gagal dimuat.") });
      });
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!spotId && mySpots[0]) setSpotId(mySpots[0].id);
  }, [mySpots, spotId]);

  if (mySpots.length === 0) return null;
  const spot = mySpots.find((s) => s.id === spotId) ?? mySpots[0];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (title.trim().length < 3) return setMsg({ ok: false, text: "Tulis nama acara, minimal 3 huruf." });
    if (!date) return setMsg({ ok: false, text: "Pilih tanggal acara (untuk acara rutin: tanggal pertamanya)." });
    // jam yg diketik = waktu setempat lapak; ubah ke ISO pakai selisih zona waktunya
    const off = { "Asia/Jakarta": "+07:00", "Asia/Makassar": "+08:00", "Asia/Jayapura": "+09:00" }[tzOf(spot)];
    const startsAt = new Date(`${date}T${start}:00${off}`);
    let endsAt = new Date(`${date}T${end}:00${off}`);
    if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86400000); // lewat tengah malam
    setBusy(true);
    try {
      const r = await api.createEvent({ spotId: spot.id, title: title.trim(), description: desc.trim() || undefined, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), repeat });
      setEvents(r.events ?? []);
      setMsg({ ok: true, text: `Acara "${title.trim()}" tampil di Agenda wisatawan.` });
      setTitle("");
      setDesc("");
    } catch (err) {
      setMsg({ ok: false, text: describeError(err, "Acara gagal disimpan.") });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (ev: CulturalEvent) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.deleteEvent(ev.id);
      setEvents(r.events ?? []);
      setMsg({ ok: true, text: `Acara "${ev.title}" dihapus.` });
    } catch (err) {
      setMsg({ ok: false, text: describeError(err, "Acara gagal dihapus.") });
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id: string) => mySpots.find((s) => s.id === id)?.name ?? "";
  const fmt = (ev: CulturalEvent) => {
    const s = mySpots.find((x) => x.id === ev.spotId);
    const tz = s ? tzOf(s) : "Asia/Jakarta";
    const t = (iso: string) => new Intl.DateTimeFormat("id-ID", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
    const d = new Intl.DateTimeFormat("id-ID", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(ev.startsAt));
    return `${ev.repeat === "NONE" ? d : repeatText(ev, tz)}, ${t(ev.startsAt)}–${t(ev.endsAt)}`;
  };

  return (
    <section className="gamiz-card p-5 space-y-4" aria-labelledby="ev-title">
      <div>
        <h2 id="ev-title" className="text-base font-extrabold text-alabaster">Acara di lapakmu</h2>
        <p className="text-xs text-pebble mt-1 leading-relaxed">
          Pentas, latihan terbuka, kelas, atau pasar. Acara tampil di Agenda wisatawan dan di kartu lapakmu, supaya orang yang lewat tahu ada yang bisa ditonton atau diikuti.
        </p>
      </div>

      {events === null ? (
        <p role="status" className="text-sm text-pebble">Memuat acara</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-pebble">Belum ada acara. Tambahkan yang pertama di bawah.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li key={ev.id} className="list-none rounded-2xl bg-obsidian p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-alabaster truncate">{ev.title}</p>
                <p className="text-[11px] text-pebble">{fmt(ev)} · {nameOf(ev.spotId)}</p>
              </div>
              <button type="button" disabled={busy || accountBlocked} onClick={() => remove(ev)} aria-label={`Hapus acara ${ev.title}`} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs shrink-0 disabled:opacity-60">Hapus</button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} noValidate className="space-y-3 border-t border-stoneSubtle pt-4">
        {mySpots.length > 1 && (
          <div>
            <label htmlFor="ev-spot" className={LABEL}>Lapak</label>
            <select id="ev-spot" value={spot.id} onChange={(e) => setSpotId(e.target.value)} className={FIELD}>
              {mySpots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="ev-name" className={LABEL}>Nama acara</label>
          <input id="ev-name" type="text" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Latihan terbuka Can Macanan Kadduk" className={FIELD} />
        </div>
        <div>
          <label htmlFor="ev-desc" className={LABEL}>Keterangan singkat (boleh dikosongkan)</label>
          <input id="ev-desc" type="text" maxLength={300} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Contoh: Gratis, boleh menonton dan berfoto." className={FIELD} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="ev-date" className={LABEL}>Tanggal</label>
            <input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${FIELD} font-num`} />
          </div>
          <div>
            <label htmlFor="ev-start" className={LABEL}>Mulai</label>
            <input id="ev-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${FIELD} font-num`} />
          </div>
          <div>
            <label htmlFor="ev-end" className={LABEL}>Selesai</label>
            <input id="ev-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${FIELD} font-num`} />
          </div>
        </div>
        <fieldset>
          <legend className={LABEL}>Diulang</legend>
          <div className="flex flex-wrap gap-2">
            {REPEATS.map((r) => (
              <label key={r.v} className={`min-h-[44px] px-3.5 rounded-xl border-2 text-xs font-extrabold inline-flex items-center cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-vibePrimary ${repeat === r.v ? "border-vibePrimary bg-[var(--vibe-surface-tint)] text-alabaster" : "border-stoneStrong bg-basalt text-pebble"}`}>
                <input type="radio" name="ev-repeat" className="sr-only" checked={repeat === r.v} onChange={() => setRepeat(r.v)} />
                {r.t}
              </label>
            ))}
          </div>
        </fieldset>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs font-bold ${msg.ok ? "text-quotaSafe" : "text-quotaFull"}`}>{msg.text}</p>}
        <button type="submit" disabled={busy || accountBlocked} className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center gap-2 disabled:opacity-70">
          <Icon name="calendar" size={16} />
          <span>{busy ? "Menyimpan" : "Tambah acara"}</span>
        </button>
      </form>
    </section>
  );
}
