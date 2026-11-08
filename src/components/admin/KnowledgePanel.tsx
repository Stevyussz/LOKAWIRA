"use client";

import React, { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { api, describeError } from "@/lib/api";
import type { AiTrainingNote, LokaGapGroup, LokaMode } from "@/types/api";
import type { OpkCategory } from "@/types/lokawira";

const FIELD = "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";
const LABEL = "block text-xs font-bold text-pebble mb-1.5";
// urutan resmi UU 5/2017, Cagar Budaya (UU 11/2010) paling akhir
const OPK: OpkCategory[] = ["Tradisi Lisan", "Manuskrip", "Adat Istiadat", "Ritus", "Pengetahuan Tradisional", "Teknologi Tradisional", "Seni", "Bahasa", "Permainan Rakyat", "Olahraga Tradisional", "Cagar Budaya"];

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
  // id rujukan yg lagi diedit (null = form buat nambah baru), dan id yg lagi minta konfirmasi hapus
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // pertanyaan wisatawan yg lagi dijawab lewat form (dr daftar "belum terjawab")
  const [answering, setAnswering] = useState<LokaGapGroup | null>(null);
  // dinaikkan biar daftar pertanyaan dimuat ulang
  const [gapsKey, setGapsKey] = useState(0);

  const answerGap = (g: LokaGapGroup) => {
    setEditingId(null);
    setAnswering(g);
    if (OPK.includes(g.opkCategory as OpkCategory)) setOpk(g.opkCategory as OpkCategory);
    setErrors({});
    document.getElementById("kp-source")?.scrollIntoView({ block: "center", behavior: "smooth" });
    document.getElementById("kp-source")?.focus({ preventScroll: true });
  };

  const startEdit = (n: AiTrainingNote) => {
    setEditingId(n.id);
    setConfirmId(null);
    setOpk(n.opkCategory as OpkCategory);
    setSource(n.maestroSource);
    setSummary(n.summary);
    setErrors({});
    document.getElementById("kp-source")?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setSource("");
    setSummary("");
    setErrors({});
  };
  const remove = async (n: AiTrainingNote) => {
    setBusy(true);
    try {
      const res = await api.deleteAiNote(n.id);
      setNotes(res.aiTrainingNotes);
      setConfirmId(null);
      if (editingId === n.id) cancelEdit();
      onToast(`Rujukan dari ${n.maestroSource} dihapus. Loka tidak memakainya lagi.`);
    } catch (err) {
      onToast(describeError(err, "Rujukan gagal dihapus."), true);
    } finally {
      setBusy(false);
    }
  };

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
      const payload = { opkCategory: opk, maestroSource: source.trim(), summary: summary.trim() };
      const res = editingId ? await api.updateAiNote(editingId, payload) : await api.addAiNote(payload);
      setNotes(res.aiTrainingNotes);
      onToast(editingId ? `Rujukan dari ${source.trim()} diperbarui.` : `Rujukan "${opk}" dari ${source.trim()} tersimpan. Loka memakainya untuk bercerita.`);
      setEditingId(null);
      setSource("");
      setSummary("");
      // rujukan ini ditulis buat menjawab pertanyaan wisatawan: tandai pertanyaannya beres
      if (answering && !editingId) {
        await api.resolveLokaGap(answering.spotId).catch(() => {});
        setGapsKey((k) => k + 1);
      }
      setAnswering(null);
    } catch (err) {
      onToast(describeError(err, "Rujukan gagal disimpan ke server."), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <form onSubmit={submit} className="lg:col-span-6 gamiz-card p-5 space-y-4" noValidate>
        <div>
          <h2 className="text-base font-extrabold text-alabaster">{editingId ? "Ubah rujukan" : "Tambah rujukan untuk Loka"}</h2>
          {answering && !editingId && (
            <p className="mt-2 rounded-xl bg-slateElev p-2.5 text-xs text-alabaster">
              Untuk menjawab pertanyaan di <b>{answering.spotName}</b>: &ldquo;{answering.samples[0]}&rdquo;{" "}
              <button type="button" onClick={() => setAnswering(null)} className="underline font-bold min-h-[24px]">Batal</button>
            </p>
          )}
          <p className="text-xs text-pebble mt-1 leading-relaxed">
            Loka bercerita berdasarkan fakta yang kamu masukkan di sini, supaya tidak mengarang. Tulis fakta budaya dari sumber yang bisa dipertanggungjawabkan, seperti dinas kebudayaan atau maestro setempat.
          </p>
        </div>
        <div>
          <label htmlFor="kp-opk" className={LABEL}>Kategori budaya (OPK)</label>
          <select id="kp-opk" value={opk} onChange={(e) => setOpk(e.target.value as OpkCategory)} className={FIELD}>
            {OPK.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <p className="mt-1.5 text-[11px] text-pebble">OPK = Objek Pemajuan Kebudayaan (UU No. 5 Tahun 2017). Cagar Budaya diatur terpisah di UU No. 11 Tahun 2010.</p>
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
          <p className="mt-1.5 text-[11px] text-pebble leading-relaxed">
            Supaya Loka bisa memakainya: satu rujukan untuk satu topik, sebut nama tempat atau bendanya, lalu apa, kapan, dan bagaimana. Tulis angka dan nama persis seperti di sumber.
          </p>
        </div>
        <button type="submit" disabled={busy} className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center gap-2 disabled:opacity-70">
          {busy ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Icon name="seal" size={16} />}
          <span>{busy ? "Menyimpan" : editingId ? "Simpan perubahan" : "Simpan rujukan"}</span>
        </button>
        {editingId && (
          <button type="button" onClick={cancelEdit} className="btn-tactile-secondary min-h-[48px] px-5 text-sm ml-2">Batal ubah</button>
        )}
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
                <div className="flex flex-wrap items-center gap-2 pt-1.5">
                  {confirmId === n.id ? (
                    <>
                      <span className="text-xs font-bold text-quotaFull">Hapus rujukan ini?</span>
                      <button type="button" disabled={busy} onClick={() => remove(n)} className="btn-tactile-secondary min-h-[44px] px-4 text-xs disabled:opacity-70">Ya, hapus</button>
                      <button type="button" onClick={() => setConfirmId(null)} className="btn-tactile-secondary min-h-[44px] px-4 text-xs">Batal</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => startEdit(n)} aria-label={`Ubah rujukan dari ${n.maestroSource}`} className="btn-tactile-secondary min-h-[44px] px-4 text-xs">Ubah</button>
                      <button type="button" onClick={() => setConfirmId(n.id)} aria-label={`Hapus rujukan dari ${n.maestroSource}`} className="btn-tactile-secondary min-h-[44px] px-4 text-xs">Hapus</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <GapsCard key={gapsKey} onAnswer={answerGap} onToast={onToast} />
      <ExtractCard onSaved={setNotes} onToast={onToast} />
    </div>
    </div>
  );
}

// pertanyaan wisatawan yg belum bisa dijawab Loka: petunjuk rujukan apa yg perlu ditambah
function GapsCard({ onAnswer, onToast }: { onAnswer: (g: LokaGapGroup) => void; onToast: Props["onToast"] }) {
  const [gaps, setGaps] = useState<LokaGapGroup[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => {
    setErr("");
    api
      .lokaGaps()
      .then((r) => setGaps(r.gaps))
      .catch((e) => {
        setGaps([]);
        setErr(describeError(e, "Daftar pertanyaan gagal dimuat."));
      });
  };
  useEffect(load, []);
  const resolve = async (g: LokaGapGroup) => {
    setBusy(g.spotId);
    try {
      setGaps((await api.resolveLokaGap(g.spotId)).gaps);
      onToast(`Pertanyaan di ${g.spotName} ditandai sudah ditangani.`);
    } catch (e) {
      onToast(describeError(e, "Gagal menandai."), true);
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="gamiz-card p-5 space-y-3" aria-labelledby="kp-gaps">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id="kp-gaps" className="text-base font-extrabold text-alabaster">Pertanyaan yang belum bisa dijawab Loka</h3>
          <p className="text-xs text-pebble mt-1">Dikumpulkan tanpa nama penanya. Tambahkan rujukan supaya Loka bisa menjawabnya.</p>
        </div>
        <button type="button" onClick={load} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5 shrink-0">
          <Icon name="database" size={16} />
          <span>Muat ulang</span>
        </button>
      </div>
      {err && <p role="alert" className="text-sm font-bold text-quotaFull">{err}</p>}
      {gaps === null ? (
        <p role="status" className="text-sm text-pebble">Memuat</p>
      ) : gaps.length === 0 && !err ? (
        <p className="text-sm text-pebble">Belum ada. Semua pertanyaan wisatawan sejauh ini terjawab dari rujukan.</p>
      ) : (
        <ul className="space-y-2.5">
          {gaps.map((g) => (
            <li key={g.spotId} className="list-none rounded-2xl bg-obsidian p-3.5 space-y-2">
              <p className="text-sm font-extrabold text-alabaster">
                {g.spotName} <span className="font-num text-xs font-bold text-pebble">· {g.count} pertanyaan</span>
              </p>
              <ul className="space-y-1">
                {g.samples.map((q) => (
                  <li key={q} className="list-none text-xs text-alabaster leading-snug">&ldquo;{q}&rdquo;</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onAnswer(g)} className="btn-tactile-primary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5">
                  <Icon name="plus" size={16} />
                  <span>Tulis rujukan</span>
                </button>
                <button type="button" disabled={busy === g.spotId} onClick={() => resolve(g)} aria-label={`Tandai pertanyaan di ${g.spotName} sudah ditangani`} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs disabled:opacity-60">
                  Sudah ditangani
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// tempel teks dr sumber resmi -> Loka pecah jadi draf rujukan -> pengelola pilih & simpan
function ExtractCard({ onSaved, onToast }: { onSaved: (n: AiTrainingNote[]) => void; onToast: Props["onToast"] }) {
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [opk, setOpk] = useState<OpkCategory>("Tradisi Lisan");
  const [busy, setBusy] = useState<"extract" | "save" | null>(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<LokaMode | null>(null);
  const [drafts, setDrafts] = useState<{ opkCategory: string; summary: string; pick: boolean }[]>([]);

  const extract = async () => {
    setErr("");
    if (text.trim().length < 40) return setErr("Tempel teks sumber minimal satu paragraf.");
    setBusy("extract");
    try {
      const r = await api.extractNotes({ text, opkCategory: opk });
      setMode(r.mode);
      setDrafts(r.drafts.map((d) => ({ ...d, pick: true })));
    } catch (e) {
      setErr(describeError(e, "Loka belum bisa memecah teks ini."));
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    setErr("");
    if (source.trim().length < 5) return setErr("Tulis nama sumbernya dulu, minimal 5 huruf.");
    const chosen = drafts.filter((d) => d.pick && d.summary.trim().length >= 20);
    if (!chosen.length) return setErr("Pilih minimal satu draf.");
    setBusy("save");
    try {
      let last: AiTrainingNote[] | null = null;
      for (const d of chosen) last = (await api.addAiNote({ opkCategory: d.opkCategory as OpkCategory, maestroSource: source.trim(), summary: d.summary.trim() })).aiTrainingNotes;
      if (last) onSaved(last);
      onToast(`${chosen.length} rujukan dari ${source.trim()} tersimpan.`);
      setDrafts([]);
      setText("");
      setMode(null);
    } catch (e) {
      onToast(describeError(e, "Sebagian rujukan gagal disimpan."), true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="gamiz-card p-5 space-y-3" aria-labelledby="kp-extract">
      <div>
        <h3 id="kp-extract" className="text-base font-extrabold text-alabaster">Ambil rujukan dari teks sumber</h3>
        <p className="text-xs text-pebble mt-1 leading-relaxed">Tempel teks dari dokumen resmi, misalnya PPKD atau kajian dinas. Loka memecahnya jadi beberapa catatan memakai kata-kata dari teks itu. Kamu memilih mana yang disimpan.</p>
      </div>
      <div>
        <label htmlFor="kx-text" className={LABEL}>Teks sumber</label>
        <textarea id="kx-text" rows={5} maxLength={8000} value={text} onChange={(e) => setText(e.target.value)} className={`${FIELD} py-3`} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="kx-source" className={LABEL}>Nama sumber</label>
          <input id="kx-source" type="text" maxLength={160} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Contoh: PPKD Kota Yogyakarta 2018" className={FIELD} />
        </div>
        <div>
          <label htmlFor="kx-opk" className={LABEL}>Kategori bawaan</label>
          <select id="kx-opk" value={opk} onChange={(e) => setOpk(e.target.value as OpkCategory)} className={FIELD}>
            {OPK.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <button type="button" disabled={busy !== null} onClick={extract} className="btn-tactile-secondary min-h-[48px] px-5 text-sm inline-flex items-center gap-2 disabled:opacity-60">
        {busy === "extract" ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Icon name="guide" size={16} />}
        <span>{busy === "extract" ? "Memecah teks" : "Pecah jadi draf rujukan"}</span>
      </button>
      {err && <p role="alert" className="text-xs font-bold text-quotaFull">{err}</p>}
      {drafts.length > 0 && (
        <div className="space-y-2.5" role="group" aria-label="Draf rujukan">
          <p role="status" className="text-[11px] text-pebble">
            {mode === "AI" ? "Draf dari Loka. Tiap draf sudah dicek memakai kata dan angka dari teksmu, tapi tetap baca sebelum menyimpan." : "Loka sedang offline, jadi teks dipotong per beberapa kalimat. Rapikan sebelum menyimpan."}
          </p>
          {drafts.map((d, i) => (
            <div key={i} className="rounded-2xl bg-obsidian p-3 space-y-2">
              <label className="flex items-center gap-2 min-h-[44px] text-xs font-bold text-alabaster cursor-pointer">
                <input type="checkbox" checked={d.pick} onChange={(e) => setDrafts((p) => p.map((x, j) => (j === i ? { ...x, pick: e.target.checked } : x)))} className="w-5 h-5 accent-[var(--vibe-primary)]" />
                Simpan draf {i + 1} · {d.opkCategory}
              </label>
              <label htmlFor={`kx-d-${i}`} className="sr-only">Isi draf {i + 1}</label>
              <textarea id={`kx-d-${i}`} rows={3} maxLength={2000} value={d.summary} onChange={(e) => setDrafts((p) => p.map((x, j) => (j === i ? { ...x, summary: e.target.value } : x)))} className={`${FIELD} py-2.5 text-xs`} />
            </div>
          ))}
          <button type="button" disabled={busy !== null} onClick={save} className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center gap-2 disabled:opacity-60">
            {busy === "save" ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Icon name="seal" size={16} />}
            <span>Simpan {drafts.filter((d) => d.pick).length} rujukan</span>
          </button>
        </div>
      )}
    </section>
  );
}
