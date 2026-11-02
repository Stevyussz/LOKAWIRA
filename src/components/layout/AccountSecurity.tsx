"use client";

import React, { useState } from "react";
import Icon from "@/components/ui/Icon";
import { api, describeError } from "@/lib/api";
import { useAuth } from "@/components/layout/AuthProvider";

const field =
  "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";
const label = "block text-xs font-bold text-pebble mb-1.5";

type Panel = "password" | "delete" | null;

// ganti kata sandi & hapus akun (UU PDP: pengguna berhak menghapus datanya)
export default function AccountSecurity({ onDone }: { onDone: () => void }) {
  const { replaceToken, clearSession } = useAuth();
  const [open, setOpen] = useState<Panel>(null);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [delPw, setDelPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const toggle = (p: Panel) => {
    setOpen((o) => (o === p ? null : p));
    setMsg(null);
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!cur) return setMsg({ ok: false, text: "Isi kata sandi lamamu." });
    if (next.length < 8) return setMsg({ ok: false, text: "Kata sandi baru minimal 8 karakter." });
    setBusy(true);
    try {
      const res = await api.changePassword({ currentPassword: cur, newPassword: next });
      replaceToken(res.token);
      setCur("");
      setNext("");
      setMsg({ ok: true, text: "Kata sandi diganti. Perangkat lain perlu masuk ulang." });
    } catch (err) {
      setMsg({ ok: false, text: describeError(err, "Kata sandi gagal diganti.") });
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!delPw) return setMsg({ ok: false, text: "Isi kata sandi untuk konfirmasi." });
    setBusy(true);
    try {
      await api.deleteAccount({ password: delPw });
      clearSession();
      onDone();
    } catch (err) {
      setMsg({ ok: false, text: describeError(err, "Akun gagal dihapus.") });
      setBusy(false);
    }
  };

  const trigger = (p: Exclude<Panel, null>, text: string, danger = false) => (
    <button
      type="button"
      onClick={() => toggle(p)}
      aria-expanded={open === p}
      aria-controls={`acct-panel-${p}`}
      className={`btn-tactile-secondary w-full min-h-[48px] px-4 text-sm flex items-center justify-between gap-2 ${danger ? "text-quotaFull" : ""}`}
    >
      <span>{text}</span>
      <Icon name={open === p ? "up" : "down"} size={16} weight="bold" />
    </button>
  );

  return (
    <div className="space-y-2.5">
      {trigger("password", "Ganti kata sandi")}
      {open === "password" && (
        <form id="acct-panel-password" onSubmit={changePw} className="rounded-2xl bg-slateElev p-4 space-y-3" noValidate>
          <div>
            <label htmlFor="acct-cur" className={label}>Kata sandi lama</label>
            <input id="acct-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="acct-new" className={label}>Kata sandi baru</label>
            <input id="acct-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={field} />
            <p className="text-[11px] text-pebble mt-1">Minimal 8 karakter.</p>
          </div>
          <button type="submit" disabled={busy} className="btn-tactile-primary w-full min-h-[48px] px-4 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
            {busy && <Icon name="loader" size={16} weight="bold" motion="spin" />}
            <span>Simpan kata sandi</span>
          </button>
        </form>
      )}

      {trigger("delete", "Hapus akun", true)}
      {open === "delete" && (
        <form id="acct-panel-delete" onSubmit={removeAccount} className="rounded-2xl bg-slateElev p-4 space-y-3" noValidate>
          <p className="text-xs text-alabaster leading-relaxed">
            Akun dan data kunjunganmu dihapus permanen. Titik milik mitra diarsipkan, bukan dihapus mentah. Tindakan ini tidak bisa dibatalkan.
          </p>
          <div>
            <label htmlFor="acct-del" className={label}>Kata sandi untuk konfirmasi</label>
            <input id="acct-del" type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} className={field} />
          </div>
          <button type="submit" disabled={busy} className="w-full min-h-[48px] rounded-xl bg-quotaFull text-[var(--vibe-on-primary)] text-sm font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-70">
            {busy && <Icon name="loader" size={16} weight="bold" motion="spin" />}
            <span>Hapus akunku selamanya</span>
          </button>
        </form>
      )}

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm font-bold ${msg.ok ? "text-quotaSafe" : "text-quotaFull"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
