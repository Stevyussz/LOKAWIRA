"use client";

import React, { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { api, describeError } from "@/lib/api";
import type { AiTrainingNote } from "@/types/api";
import type { OpkCategory } from "@/types/lokawira";

const FIELD = "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";
const LABEL = "block text-xs font-bold text-pebble mb-1.5";
const OPK: OpkCategory[] = ["Tradisi Lisan", "Pengetahuan Tradisional", "Teknologi Tradisional & Kriya", "Seni Pertunjukan", "Adat Istiadat & Ritus", "Cagar Budaya"];

interface Props {
  onToast: (text: string, isError?: boolean) => void;
}

// basis pengetahuan Loka: fakta budaya dari sumber resmi, dipakai Loka saat bercerita (biar tidak mengarang)
export default function KnowledgePanel({ onToast }: Props) {
  const [notes, setNotes] = useState<AiTrainingNote[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [opk, setOpk] = useState<OpkCategory>("Tradisi Lisan");
  const [source, setSource] = useState("");
  const [summary, setSummary] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoadErr("");
    api
      .getSnapshot()
      .then((d) => setNotes(d.aiTrainingNotes))
      .catch((e) => {
        setNotes([]);
        setLoadErr(describeError(e, "Daftar rujukan gagal dimuat."));
      });
  };
  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (source.trim().length < 5) errs.source = "Tulis nama sumber atau narasumbernya, minimal 5 huruf.";
    if (summary.trim().length < 20) errs.summary = "Tulis ringkasan faktanya, minimal 20 huruf.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await api.addAiNote({ opkCategory: opk, maestroSource: source.trim(), summary: summary.trim() });
      setNotes(res.aiTrainingNotes);
      onToast(`Rujukan "${opk}" dari ${source.trim()} tersimpan. Loka memakainya untuk bercerita.`);
      setSource("");
      setSummary("");
    } catch (err) {
      onToast(describeError(err, "Rujukan gagal disimpan ke server."), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <form onSubmit={submit} className="lg:col-span-6 gamiz-card p-5 space-y-4" noValidate>
        <div>
          <h2 className="text-base font-extrabold text-alabaster">Tambah rujukan untuk Loka</h2>
          <p className="text-xs text-pebble mt-1 leading-relaxed">
            Loka bercerita berdasarkan fakta yang kamu masukkan di sini, supaya tidak mengarang. Tulis fakta budaya dari sumber yang bisa dipertanggungjawabkan, seperti dinas kebudayaan atau maestro setempat.
          </p>
        </div>
        <div>
          <label htmlFor="kp-opk" className={LABEL}>Kategori budaya (OPK)</label>
          <select id="kp-opk" value={opk} onChange={(e) => setOpk(e.target.value as OpkCategory)} className={FIELD}>
            {OPK.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <p className="mt-1.5 text-[11px] text-pebble">OPK = Objek Pemajuan Kebudayaan (UU No. 5 Tahun 2017).</p>
        </div>
        <div>
          <label htmlFor="kp-source" className={LABEL}>Sumber atau narasumber</label>
          <input id="kp-source" type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Contoh: PPKD Kabupaten Mojokerto, Mbah Suroso" className={FIELD} aria-invalid={!!errors.source} />
          {errors.source && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{errors.source}</p>}
        </div>
        <div>
          <label htmlFor="kp-summary" className={LABEL}>Ringkasan fakta budaya</label>
          <textarea id="kp-summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Contoh: Celengan terakota Majapahit dibuat dengan teknik cetak tangan, dibakar pada suhu rendah." className={`${FIELD} py-3`} aria-invalid={!!errors.summary} />
          {errors.summary && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{errors.summary}</p>}
        </div>
        <button type="submit" disabled={busy} className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center gap-2 disabled:opacity-70">
          {busy ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Icon name="seal" size={16} />}
          <span>{busy ? "Menyimpan" : "Simpan rujukan"}</span>
        </button>
      </form>

      <section className="lg:col-span-6 gamiz-card p-5 space-y-3" aria-labelledby="kp-list">
        <h3 id="kp-list" className="text-base font-extrabold text-alabaster">Rujukan yang sudah ada ({notes?.length ?? 0})</h3>
        {loadErr && (
          <div role="alert" className="space-y-2">
            <p className="text-sm font-bold text-quotaFull">{loadErr}</p>
            <button type="button" onClick={load} className="btn-tactile-secondary min-h-[44px] px-4 text-xs">Coba lagi</button>
          </div>
        )}
        {notes === null ? (
          <p role="status" className="text-sm text-pebble">Memuat</p>
        ) : notes.length === 0 && !loadErr ? (
          <p className="text-sm text-pebble">Belum ada rujukan. Tambahkan yang pertama lewat formulir.</p>
        ) : (
          <ul className="space-y-2.5">
            {notes.map((n) => (
              <li key={n.id} className="list-none p-4 rounded-2xl bg-obsidian space-y-1">
                <span className="text-xs font-bold text-vibePrimary block">{n.opkCategory} • {n.maestroSource}</span>
                <p className="text-xs text-alabaster leading-relaxed">{n.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
