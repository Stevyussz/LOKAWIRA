"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLokawira } from "@/components/layout/LokawiraProvider";
import { useAuth } from "@/components/layout/AuthProvider";
import RequireRole from "@/components/layout/RequireRole";
import EditSpotSheet from "@/components/merchant/EditSpotSheet";
import CashierPanel from "@/components/merchant/CashierPanel";
import GettingStarted, { MerchantMenu } from "@/components/merchant/GettingStarted";
import RegisterSpotForm from "@/components/merchant/RegisterSpotForm";
import ScanPromoPanel, { DEFAULT_TARGET } from "@/components/merchant/ScanPromoPanel";
import { SpotType } from "@/types/lokawira";
import Icon, { IconName } from "@/components/ui/Icon";
import { formatCoord } from "@/lib/geo";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

const TYPE_LABEL: Record<SpotType, string> = {
  PRIMARY_DEST: "Cagar budaya",
  SANGGAR_SENI: "Sanggar seni",
  UMKM_KULINER: "UMKM makan & minum",
  UMKM_KRIYA: "UMKM kriya & oleh-oleh",
};
const TYPE_ICON: Record<SpotType, IconName> = {
  PRIMARY_DEST: "heritage",
  SANGGAR_SENI: "sanggar",
  UMKM_KULINER: "food",
  UMKM_KRIYA: "umkm",
};

function MerchantPosContent() {
  const searchParams = useSearchParams();
  const { user, logout, recheck } = useAuth();
  const { activeVibe, spots, setSpots, vouchers, setVouchers, refreshServerData } = useLokawira();

  const isAdmin = user?.role === "ADMIN";
  // mitra baru/ditolak belum boleh mengelola lapak (server juga menolak)
  const accountBlocked = user?.role === "MERCHANT" && !!user.status && user.status !== "ACTIVE";
  const [rechecking, setRechecking] = useState(false);
  // mitra cuma mengurus lapak miliknya - Pengelola melihat semuanya
  const mySpots = useMemo(
    () => (isAdmin ? spots : spots.filter((s) => s.ownerId === user?.id)),
    [spots, user?.id, isAdmin]
  );
  const mySpotIds = useMemo(() => new Set(mySpots.map((s) => s.id)), [mySpots]);
  const myVouchers = useMemo(() => vouchers.filter((v) => mySpotIds.has(v.spotId)), [vouchers, mySpotIds]);
  const active = myVouchers.filter((v) => v.status === "ACTIVE");
  const redeemed = myVouchers.filter((v) => v.status === "REDEEMED");
  const redeemedValue = redeemed.reduce((a, v) => a + v.discountAmount, 0);

  const [menu, setMenu] = useState<MerchantMenu>("KASIR");
  const [editingId, setEditingId] = useState<string | null>(null);
  const initialCode = (searchParams.get("code") ?? "").toUpperCase();
  useEffect(() => {
    if (initialCode) setMenu("KASIR");
  }, [initialCode]);

  const noLapak = mySpots.length === 0;
  // mitra baru yg belum punya lapak langsung diarahkan ke pendaftaran
  useEffect(() => {
    if (noLapak && !isAdmin && !initialCode) setMenu("LAPAK");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs: { id: MerchantMenu; label: string; icon: IconName; hint: string }[] = [
    { id: "KASIR", label: "Kasir", icon: "qr", hint: "Tukar voucer & cek kehadiran" },
    { id: "LAPAK", label: "Lapak Saya", icon: "pin", hint: "Daftar & ubah lapak" },
    { id: "SCAN", label: "Promo & Scan", icon: "ticket", hint: "Objek, foto, voucer" },
  ];

  return (
    <div className="min-h-screen flex flex-col pb-16">
      <main className="flex-1 max-w-[1160px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Header ringkas */}
        <header className="gamiz-card px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-lg sm:text-xl font-extrabold text-alabaster leading-tight">Dasbor Mitra</h1>
            <p className="text-xs text-pebble truncate">
              {user?.name}
              {isAdmin ? " · tampilan pengelola (semua lapak)" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5">
              <Icon name="back" size={16} weight="bold" />
              <span>Peta</span>
            </Link>
            <button type="button" onClick={() => logout()} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5">
              <Icon name="signOut" size={16} />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {accountBlocked && (
          <div role="status" className="gamiz-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-2 border-quotaWarning">
            <span className="w-11 h-11 rounded-2xl bg-slateElev text-vibePrimary flex items-center justify-center shrink-0">
              <Icon name={user?.status === "REJECTED" ? "alert" : "shield"} size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-alabaster">
                {user?.status === "REJECTED" ? "Pendaftaran mitramu ditolak" : "Akun mitramu menunggu persetujuan"}
              </p>
              <p className="text-xs text-pebble">
                {user?.status === "REJECTED"
                  ? `${user?.statusReason ? `Alasan: ${user.statusReason}. ` : ""}Hubungi pengelola kawasan untuk mengajukan ulang. Kamu belum bisa menambah atau mengubah lapak.`
                  : "Pengelola sedang memeriksa pendaftaranmu. Setelah disetujui, kamu bisa mendaftarkan lapak dan menerima voucer."}
              </p>
            </div>
            <button
              type="button"
              disabled={rechecking}
              onClick={async () => {
                setRechecking(true);
                await recheck({ silent: true });
                setRechecking(false);
              }}
              className="btn-tactile-secondary min-h-[44px] px-4 text-xs inline-flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-70"
            >
              {rechecking ? <Icon name="loader" size={16} weight="bold" motion="spin" /> : <Icon name="check" size={16} />}
              <span>Periksa status</span>
            </button>
          </div>
        )}

        {!isAdmin && <GettingStarted spots={mySpots} go={setMenu} />}

        {/* Ringkasan */}
        <div tabIndex={0} role="group" aria-label="Ringkasan lapak (geser dengan panah keyboard)" className="flex sm:grid sm:grid-cols-3 gap-3 overflow-x-auto scroll-hide snap-x scroll-px-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="gamiz-card p-4 min-w-[200px] sm:min-w-0 snap-start shrink-0 sm:shrink">
            <span className="text-xs font-bold text-pebble block">Voucer belum dipakai</span>
            <p className="font-num text-2xl font-extrabold text-vibePrimary mt-1">{active.length}</p>
          </div>
          <div className="gamiz-card p-4 min-w-[200px] sm:min-w-0 snap-start shrink-0 sm:shrink">
            <span className="text-xs font-bold text-pebble block">Sudah dipakai</span>
            <p className="font-num text-2xl font-extrabold text-quotaSafe mt-1">{redeemed.length}</p>
            <span className="text-xs text-pebble font-num">Senilai {rupiah(redeemedValue)}</span>
          </div>
          <div className="gamiz-card p-4 min-w-[200px] sm:min-w-0 snap-start shrink-0 sm:shrink">
            <span className="text-xs font-bold text-pebble block">{isAdmin ? "Semua lapak" : "Lapak saya"}</span>
            <p className="font-num text-2xl font-extrabold text-vibeSecondary mt-1">{mySpots.length}</p>
          </div>
        </div>

        {/* Tab */}
        <div role="tablist" aria-label="Menu dasbor mitra" className="gamiz-card p-1.5 grid grid-cols-3 gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={menu === t.id}
              onClick={() => setMenu(t.id)}
              className={`min-h-[64px] px-1.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-colors text-center leading-tight ${
                menu === t.id ? "bg-vibePrimary text-[var(--vibe-on-primary)]" : "text-pebble hover:text-alabaster"
              }`}
            >
              <Icon name={t.icon} size={20} />
              <span className="text-[13px] sm:text-sm font-extrabold">{t.label}</span>
              <span className={`hidden sm:block text-[11px] font-bold ${menu === t.id ? "opacity-90" : "opacity-80"}`}>{t.hint}</span>
            </button>
          ))}
        </div>

        {menu === "KASIR" && (
          <CashierPanel myVouchers={myVouchers} setVouchers={setVouchers} noLapak={noLapak} onGoRegister={() => setMenu("LAPAK")} initialCode={initialCode} />
        )}

        {menu === "SCAN" && <ScanPromoPanel mySpots={mySpots} setSpots={setSpots} accountBlocked={accountBlocked} onGoRegister={() => setMenu("LAPAK")} />}

        {menu === "LAPAK" && (
          <div className="space-y-5">
            <section className="gamiz-card p-5 space-y-3">
              <h2 className="text-base font-extrabold text-alabaster">{isAdmin ? "Semua lapak" : "Lapak saya"} ({mySpots.length})</h2>
              {noLapak ? (
                <p className="text-sm text-pebble">Belum ada lapak. Isi formulir di bawah untuk mendaftarkan yang pertama.</p>
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mySpots.map((s) => {
                    const scanOk = s.quest.targetObjectPrompt !== DEFAULT_TARGET && (s.quest.referenceImages?.length ?? 0) > 0;
                    return (
                      <li key={s.id} className="list-none rounded-2xl border border-stoneSubtle bg-basalt p-3.5 flex items-start gap-3">
                        <span className="w-11 h-11 rounded-2xl bg-slateElev text-vibePrimary flex items-center justify-center shrink-0">
                          <Icon name={TYPE_ICON[s.spotType]} size={24} />
                        </span>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-extrabold text-alabaster leading-snug">{s.name}</p>
                          {s.status === "PENDING_REVIEW" ? (
                            <p className="inline-flex text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slateElev text-alabaster">Menunggu dicek pengelola</p>
                          ) : s.status === "REJECTED" ? (
                            <>
                              <p className="inline-flex text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slateElev text-quotaFull">Ditolak pengelola</p>
                              {s.statusReason && <p className="text-[11px] text-pebble">Alasan: {s.statusReason}. Ubah lapak, lalu kirim ulang.</p>}
                            </>
                          ) : (
                            <p className="inline-flex text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-quotaSafe/15 text-quotaSafe">Tampil di peta</p>
                          )}
                          <p className="text-[11px] text-pebble">{TYPE_LABEL[s.spotType]} · {s.regionName}</p>
                          <p className="font-num text-[11px] text-pebble">{formatCoord(s.coordinates)}</p>
                          <p className="font-num text-[11px] font-bold text-quotaSafe">Voucer {rupiah(s.quest.voucherReward.discountAmount)} · min. {rupiah(s.quest.voucherReward.minimumSpend)}</p>
                          {!scanOk && (
                            <p className="text-[11px] font-bold text-quotaWarning">
                              Objek scan belum lengkap.{" "}
                              <button type="button" onClick={() => setMenu("SCAN")} className="underline min-h-[44px] font-extrabold">Lengkapi</button>
                            </p>
                          )}
                          <button type="button" disabled={accountBlocked} onClick={() => setEditingId(s.id)} aria-label={`Ubah ${s.name}`} className="mt-1.5 btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5 disabled:opacity-60">
                            <Icon name="craft" size={16} />
                            <span>Ubah</span>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <EditSpotSheet
              spot={mySpots.find((s) => s.id === editingId) ?? null}
              allSpots={spots}
              isAdmin={isAdmin}
              onClose={() => setEditingId(null)}
              onSpots={setSpots}
            />

            <RegisterSpotForm userId={user?.id} isAdmin={isAdmin} accountBlocked={accountBlocked} activeVibe={activeVibe} spots={spots} setSpots={setSpots} />
          </div>
        )}

        <p className="text-[11px] text-pebble">
          <button type="button" onClick={() => refreshServerData()} className="underline min-h-[44px] font-bold">Muat ulang data dari server</button>
        </p>
      </main>
    </div>
  );
}

export default function MerchantPosPage() {
  return (
    <RequireRole roles={["MERCHANT", "ADMIN"]}>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-6"><p className="text-sm text-pebble">Memuat dasbor mitra</p></div>}>
        <MerchantPosContent />
      </Suspense>
    </RequireRole>
  );
}
