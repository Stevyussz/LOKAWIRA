"use client";

import React, { useState } from "react";
import Icon from "@/components/ui/Icon";
import MoneyField from "@/components/merchant/MoneyField";
import { api, describeError } from "@/lib/api";
import type { CulturalSpot } from "@/types/lokawira";

interface Props {
  spots: CulturalSpot[];
  setSpots: React.Dispatch<React.SetStateAction<CulturalSpot[]>>;
  onToast: (text: string, isError?: boolean) => void;
}

type Draft = { xp: number; amount: number; min: number };

// XP misi dan voucer hadiah per titik. Nominal bebas diketik
export default function RewardsPanel({ spots, setSpots, onToast }: Props) {
  const live = spots.filter((s) => (s.status ?? "PUBLISHED") === "PUBLISHED");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const cur = (sp: CulturalSpot): Draft => drafts[sp.id] ?? { xp: sp.quest.rewardPoints, amount: sp.quest.voucherReward.discountAmount, min: sp.quest.voucherReward.minimumSpend };
  const patch = (sp: CulturalSpot, p: Partial<Draft>) => setDrafts((d) => ({ ...d, [sp.id]: { ...cur(sp), ...p } }));

  const save = async (sp: CulturalSpot) => {
    const d = drafts[sp.id];
    if (!d) return;
    if (d.amount < 1000 || d.amount > 100000) {
      setErrs((e) => ({ ...e, [sp.id]: "Potongan harus antara Rp1.000 dan Rp100.000." }));
      return;
    }
    if (!Number.isFinite(d.xp) || d.xp < 0 || d.xp > 1000) {
      setErrs((e) => ({ ...e, [sp.id]: "XP misi 0 sampai 1.000." }));
      return;
    }
    setErrs((e) => ({ ...e, [sp.id]: "" }));
    setBusy(sp.id);
    try {
      const res = await api.updatePromo({ spotId: sp.id, discountTitle: sp.quest.voucherReward.discountTitle, discountAmount: d.amount, minimumSpend: d.min, rewardPoints: d.xp });
      setSpots(res.spots);
      setDrafts((p) => {
        const n = { ...p };
        delete n[sp.id];
        return n;
      });
      onToast(`Hadiah ${sp.name} tersimpan. Berlaku untuk wisatawan berikutnya.`);
    } catch (err) {
      onToast(describeError(err, "Hadiah gagal disimpan."), true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="gamiz-card p-5 space-y-3" aria-labelledby="rw-title">
      <div>
        <h2 id="rw-title" className="text-base font-extrabold text-alabaster">Hadiah misi per titik</h2>
        <p className="text-xs text-pebble mt-1 leading-relaxed">
          Atur XP yang didapat wisatawan dan voucer dari hasil memotret objek. Nominal boleh diketik bebas. Perubahan berlaku untuk wisatawan berikutnya, voucer yang sudah terbit tidak berubah. Mitra mengatur voucer lapaknya sendiri, tapi XP hanya bisa diubah di sini.
        </p>
      </div>
      {live.length === 0 ? (
        <p className="text-sm text-pebble">Belum ada titik yang tampil di peta.</p>
      ) : (
        <ul className="space-y-3">
          {live.map((sp) => {
            const d = cur(sp);
            const dirty = !!drafts[sp.id];
            return (
              <li key={sp.id} className="list-none bg-obsidian p-4 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-extrabold text-alabaster">{sp.name}</p>
                  <p className="text-[11px] text-pebble">{sp.quest.voucherReward.discountTitle}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor={`rw-xp-${sp.id}`} className="block text-xs font-bold text-pebble mb-1.5">XP misi</label>
                    <input id={`rw-xp-${sp.id}`} type="number" inputMode="numeric" min={0} max={1000} value={d.xp} onChange={(e) => patch(sp, { xp: Number(e.target.value) })} className="w-full min-h-[48px] px-3.5 rounded-xl bg-basalt border border-stoneStrong text-base font-num font-bold text-alabaster" />
                  </div>
                  <MoneyField id={`rw-amt-${sp.id}`} label="Potongan voucer" value={d.amount} onChange={(n) => patch(sp, { amount: n })} presets={[5000, 10000, 15000, 20000]} />
                  <MoneyField id={`rw-min-${sp.id}`} label="Minimal belanja" value={d.min} onChange={(n) => patch(sp, { min: n })} presets={[0, 20000, 30000]} zeroLabel="Tanpa minimum" />
                </div>
                {errs[sp.id] && <p role="alert" className="text-xs font-bold text-quotaFull">{errs[sp.id]}</p>}
                <button type="button" disabled={!dirty || busy === sp.id} onClick={() => save(sp)} aria-label={`Simpan hadiah ${sp.name}`} className="btn-tactile-primary min-h-[48px] px-5 text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
                  {busy === sp.id ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Icon name="check" size={16} />}
                  <span>{busy === sp.id ? "Menyimpan" : dirty ? "Simpan perubahan" : "Belum ada perubahan"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
