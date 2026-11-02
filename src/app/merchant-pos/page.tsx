"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLokawira } from "@/components/layout/LokawiraProvider";
import { useAuth } from "@/components/layout/AuthProvider";
import RequireRole from "@/components/layout/RequireRole";
import LocationPicker from "@/components/map/LocationPicker";
import EditSpotSheet from "@/components/merchant/EditSpotSheet";
import { CulturalSpot, CulturalVibe, IssuedVoucher, OpkCategory, SpotType } from "@/types/lokawira";
import Icon, { IconName } from "@/components/ui/Icon";
import { api, ApiError, DEMO_MODE, describeError } from "@/lib/api";
import { LatLng, distanceMeters, formatCoord } from "@/lib/geo";
import { REGIONS } from "@/lib/regions";

type Menu = "REDEEM_POS" | "MANAGE_CHECKPOINT" | "CREATE_PROMO";
type LapakType = Exclude<SpotType, "PRIMARY_DEST">;

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
const OPK_BY_TYPE: Record<LapakType, OpkCategory> = {
  SANGGAR_SENI: "Seni Pertunjukan",
  UMKM_KULINER: "Pengetahuan Tradisional",
  UMKM_KRIYA: "Teknologi Tradisional & Kriya",
};
const FACILITY_OPTIONS = ["Pembayaran QRIS", "Parkir", "Ramah kursi roda", "Tempat duduk", "Toilet"];

const input =
  "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";
const labelCls = "block text-xs font-bold text-pebble mb-1.5";

function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} role="alert" className="mt-1 text-xs font-bold text-quotaFull">
      {msg}
    </p>
  ) : null;
}

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

  const [menu, setMenu] = useState<Menu>("REDEEM_POS");

  // Kasir
  const [code, setCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemFeedback, setRedeemFeedback] = useState<{ type: "SUCCESS" | "ERROR"; message: string; voucher?: IssuedVoucher } | null>(null);

  useEffect(() => {
    const c = searchParams.get("code");
    if (c) setCode(c.toUpperCase());
  }, [searchParams]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = code.trim();
    if (!raw) {
      setRedeemFeedback({ type: "ERROR", message: "Masukkan kode voucer wisatawan (contoh: LKW-849201)." });
      return;
    }
    setIsRedeeming(true);
    setRedeemFeedback(null);
    try {
      const data = await api.redeemVoucher(raw);
      if (Array.isArray(data.vouchers)) setVouchers(data.vouchers);
      setRedeemFeedback({
        type: "SUCCESS",
        message: `Voucer ${data.redeemedVoucher.code} sah. Potongan ${rupiah(data.redeemedVoucher.discountAmount)} tercatat di lapak.`,
        voucher: data.redeemedVoucher,
      });
      setCode("");
    } catch (err) {
      // penolakan server (gak ada, udh ditebus, bkn lapakmu) gak boleh dittimpa data lokal
      if (err instanceof ApiError && err.isOffline && DEMO_MODE) {
        const norm = raw.toUpperCase().startsWith("LKW-") ? raw.toUpperCase() : `LKW-${raw.toUpperCase()}`;
        const local = myVouchers.find((v) => v.code.toUpperCase() === norm);
        if (local && local.status === "ACTIVE") {
          const updated: IssuedVoucher = { ...local, status: "REDEEMED", redeemedAt: "Baru saja ditebus" };
          setVouchers((prev) => prev.map((v) => (v.code === local.code ? updated : v)));
          setRedeemFeedback({
            type: "SUCCESS",
            message: `Voucer ${updated.code} dicatat di perangkat ini saja (mode demo, server tidak terjangkau).`,
            voucher: updated,
          });
          setCode("");
          return;
        }
      }
      setRedeemFeedback({ type: "ERROR", message: describeError(err, "Gagal memvalidasi voucer di kasir.") });
    } finally {
      setIsRedeeming(false);
    }
  };

  // Daftarkan lapak
  const [lapakName, setLapakName] = useState("");
  const [lapakType, setLapakType] = useState<LapakType>("UMKM_KRIYA");
  const [lapakRegion, setLapakRegion] = useState<CulturalVibe>(activeVibe);
  const [lapakAddress, setLapakAddress] = useState("");
  const [lapakRiddle, setLapakRiddle] = useState("");
  const [lapakStory, setLapakStory] = useState("");
  const [lapakFacilities, setLapakFacilities] = useState<string[]>([]);
  const [lapakCapacity, setLapakCapacity] = useState(30);
  const [lapakDiscount, setLapakDiscount] = useState(15000);
  const [lapakMinSpend, setLapakMinSpend] = useState(30000);
  const [lapakPin, setLapakPin] = useState<LatLng | null>(null);
  const [lapakErrors, setLapakErrors] = useState<Record<string, string>>({});
  const [lapakBusy, setLapakBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lapakMsg, setLapakMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const regionSpots = useMemo(() => spots.filter((s) => s.vibe === lapakRegion), [spots, lapakRegion]);

  const resetLapakForm = () => {
    setLapakName("");
    setLapakAddress("");
    setLapakRiddle("");
    setLapakStory("");
    setLapakFacilities([]);
    setLapakPin(null);
    setLapakErrors({});
  };

  const handleRegisterLapak = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (lapakName.trim().length < 3) errs.name = "Nama lapak minimal 3 karakter.";
    if (lapakAddress.trim().length < 5) errs.address = "Isi alamat atau patokan agar wisatawan mudah menemukan.";
    if (lapakRiddle.trim().length < 10) errs.riddle = "Tulis petunjuk misi (minimal 10 karakter).";
    if (!lapakPin) errs.pin = "Taruh pin lokasi lapak di peta.";
    if (!Number.isFinite(lapakCapacity) || lapakCapacity < 1 || lapakCapacity > 500) errs.capacity = "Kapasitas 1 sampai 500 orang.";
    setLapakErrors(errs);
    setLapakMsg(null);
    if (Object.keys(errs).length > 0 || !lapakPin) return;

    const region = REGIONS.find((r) => r.id === lapakRegion)!;
    const name = lapakName.trim();
    const draft: CulturalSpot = {
      id: "draft", // diganti server
      name,
      regionName: `${region.shortName}, ${region.regionLabel}`,
      vibe: lapakRegion,
      spotType: lapakType,
      opkCategory: OPK_BY_TYPE[lapakType],
      coordinates: lapakPin,
      address: lapakAddress.trim(),
      facilities: lapakFacilities,
      quota: { currentVisitors: 0, maxCapacity: lapakCapacity, estimatedWaitMinutes: 0, nextAvailableSlot: "Tersedia langsung" },
      quest: {
        riddleTitle: `Misi ${name}`,
        riddleClue: lapakRiddle.trim(),
        targetObjectPrompt: "Produk atau karya di lapak ini",
        verifiedLoreSource: "Keterangan mitra (belum diverifikasi pengelola)",
        loreNarrative: lapakStory.trim() || `${name} adalah mitra ekonomi sirkular LOKAWIRA.`,
        rewardPoints: 100,
        voucherReward: {
          merchantName: name,
          discountTitle: "Voucer kunjungan lapak",
          discountAmount: lapakDiscount,
          minimumSpend: lapakMinSpend,
        },
      },
    };

    setLapakBusy(true);
    try {
      const res = await api.addSpot(draft);
      setSpots(res.spots);
      setLapakMsg({ ok: true, text: res.spot.status === "PENDING_REVIEW" ? `Lapak "${res.spot.name}" terkirim. Tampil di peta setelah pengelola menyetujui.` : `Lapak "${res.spot.name}" tersimpan dan tampil di peta wisatawan.` });
      resetLapakForm();
    } catch (err) {
      if (err instanceof ApiError && err.isOffline && DEMO_MODE) {
        const local = { ...draft, id: `local-${Date.now().toString(36)}`, ownerId: user?.id };
        setSpots((prev) => [local, ...prev]);
        setLapakMsg({ ok: true, text: `Lapak "${name}" hanya muncul di perangkat ini (mode demo, server tidak terjangkau).` });
        resetLapakForm();
      } else {
        setLapakMsg({ ok: false, text: describeError(err, "Lapak gagal didaftarkan.") });
      }
    } finally {
      setLapakBusy(false);
    }
  };

  // Verifikasi kehadiran
  const [visitCode, setVisitCode] = useState("");
  const [visitBusy, setVisitBusy] = useState(false);
  const [visitMsg, setVisitMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleVerifyVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitCode.trim()) {
      setVisitMsg({ ok: false, text: "Masukkan kode kehadiran dari layar pengunjung (contoh: KDR-123456)." });
      return;
    }
    setVisitBusy(true);
    setVisitMsg(null);
    try {
      const res = await api.verifyCheckIn({ code: visitCode.trim() });
      setVisitMsg({ ok: true, text: `Kehadiran di ${res.spotName} terverifikasi. Hadiah misi pengunjung: +${res.awardedPoints} XP.` });
      setVisitCode("");
    } catch (err) {
      setVisitMsg({ ok: false, text: describeError(err, "Kode tidak bisa diverifikasi.") });
    } finally {
      setVisitBusy(false);
    }
  };

  // Promo voucer
  const [promoSpotId, setPromoSpotId] = useState("");
  const promoSpot = mySpots.find((s) => s.id === promoSpotId) ?? mySpots[0] ?? null;
  const [promoTitle, setPromoTitle] = useState("");
  const [promoAmount, setPromoAmount] = useState(15000);
  const [promoMin, setPromoMin] = useState(30000);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);

  // isi form dr promo yg lg berlaku di lapak terpilih
  useEffect(() => {
    if (!promoSpot) return;
    const r = promoSpot.quest.voucherReward;
    setPromoTitle(r.discountTitle);
    setPromoAmount(r.discountAmount);
    setPromoMin(r.minimumSpend);
    setPromoMsg(null);
    setPromoErr(null);
  }, [promoSpot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoSpot) return;
    if (promoTitle.trim().length < 5) {
      setPromoErr("Judul promo minimal 5 karakter.");
      return;
    }
    setPromoErr(null);
    setPromoBusy(true);
    setPromoMsg(null);
    try {
      const res = await api.updatePromo({
        spotId: promoSpot.id,
        discountTitle: promoTitle.trim(),
        discountAmount: promoAmount,
        minimumSpend: promoMin,
      });
      setSpots(res.spots);
      setPromoMsg({ ok: true, text: `Promo ${promoSpot.name} diperbarui. Wisatawan yang memindai objek di lapak ini akan mendapat voucer ${rupiah(promoAmount)}.` });
    } catch (err) {
      setPromoMsg({ ok: false, text: describeError(err, "Promo gagal disimpan.") });
    } finally {
      setPromoBusy(false);
    }
  };

  const noLapak = mySpots.length === 0;

  const tabs: { id: Menu; label: string; icon: IconName }[] = [
    { id: "REDEEM_POS", label: "Kasir", icon: "qr" },
    { id: "MANAGE_CHECKPOINT", label: "Lapak & Misi", icon: "pin" },
    { id: "CREATE_PROMO", label: "Promo Voucer", icon: "ticket" },
  ];

  const emptyLapak = (
    <div className="gamiz-card p-6 text-center space-y-3">
      <div className="mx-auto w-14 h-14 rounded-3xl bg-slateElev flex items-center justify-center text-vibePrimary">
        <Icon name="umkm" size={30} />
      </div>
      <p className="text-base font-extrabold text-alabaster">Belum ada lapak</p>
      <p className="text-sm text-pebble max-w-sm mx-auto">Daftarkan lapakmu dulu di tab Lapak &amp; Misi, supaya muncul di peta dan bisa menerima voucer.</p>
      <button type="button" onClick={() => setMenu("MANAGE_CHECKPOINT")} className="btn-tactile-primary min-h-[48px] px-5 text-sm">
        Daftarkan lapak
      </button>
    </div>
  );

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

        {/* Ringkasan */}
        <div tabIndex={0} role="group" aria-label="Ringkasan lapak (geser dengan panah keyboard)" className="flex sm:grid sm:grid-cols-3 gap-3 overflow-x-auto scroll-hide snap-x scroll-px-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="gamiz-card p-4 min-w-[200px] sm:min-w-0 snap-start shrink-0 sm:shrink">
            <span className="text-xs font-bold text-pebble block">Voucer siap tebus</span>
            <p className="font-num text-2xl font-extrabold text-vibePrimary mt-1">{active.length}</p>
          </div>
          <div className="gamiz-card p-4 min-w-[200px] sm:min-w-0 snap-start shrink-0 sm:shrink">
            <span className="text-xs font-bold text-pebble block">Sudah ditebus</span>
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
              className={`min-h-[56px] px-1.5 rounded-2xl text-[12px] sm:text-sm font-extrabold flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 transition-colors text-center leading-tight ${
                menu === t.id ? "bg-vibePrimary text-[var(--vibe-on-primary)]" : "text-pebble hover:text-alabaster"
              }`}
            >
              <Icon name={t.icon} size={18} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* KASIR */}
        {menu === "REDEEM_POS" &&
          (noLapak ? (
            emptyLapak
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <section className="lg:col-span-7 gamiz-card p-5 space-y-4">
                <h2 className="text-base font-extrabold text-alabaster">Validasi voucer wisatawan</h2>
                <form onSubmit={handleRedeem} className="space-y-3" noValidate>
                  <div>
                    <label htmlFor="pos-code" className={labelCls}>Kode voucer</label>
                    <input
                      id="pos-code"
                      type="text"
                      autoComplete="off"
                      autoCapitalize="characters"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.toUpperCase());
                        setRedeemFeedback(null);
                      }}
                      placeholder="LKW-849201"
                      className={`${input} min-h-[56px] font-num text-xl font-extrabold tracking-wider`}
                    />
                  </div>
                  <button type="submit" disabled={isRedeeming} className="btn-tactile-primary w-full min-h-[54px] px-6 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
                    {isRedeeming ? <Icon name="loader" size={20} weight="bold" motion="spin" /> : <Icon name="shield" size={20} />}
                    <span>{isRedeeming ? "Memvalidasi" : "Validasi & tukarkan diskon"}</span>
                  </button>
                </form>

                {redeemFeedback && (
                  <div role="status" aria-live="polite" className={`p-4 rounded-2xl border-2 text-sm bg-obsidian ${redeemFeedback.type === "SUCCESS" ? "border-quotaSafe" : "border-quotaFull"}`}>
                    <div className="flex items-start gap-2.5">
                      <Icon name={redeemFeedback.type === "SUCCESS" ? "check" : "alert"} size={20} className={`mt-0.5 shrink-0 ${redeemFeedback.type === "SUCCESS" ? "text-quotaSafe" : "text-quotaFull"}`} />
                      <div>
                        <p className="font-bold text-alabaster">{redeemFeedback.message}</p>
                        {redeemFeedback.voucher && <p className="text-xs text-pebble mt-1">Lapak: {redeemFeedback.voucher.merchantName}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="lg:col-span-5 gamiz-card p-5 space-y-3">
                <h2 className="text-sm font-extrabold text-alabaster">Voucer untuk lapakmu ({myVouchers.length})</h2>
                {myVouchers.length === 0 ? (
                  <p className="text-sm text-pebble">Belum ada voucer. Voucer muncul setelah wisatawan memindai objek atau menyelesaikan misi di lapakmu.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {myVouchers.map((v) => (
                      <li key={v.code} className="list-none rounded-2xl border border-stoneSubtle bg-basalt p-3.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className={`font-num text-sm font-extrabold block ${v.status === "ACTIVE" ? "text-quotaSafe" : "text-pebble"}`}>{v.code}</span>
                          <p className="text-xs font-bold text-alabaster mt-0.5 truncate">{v.merchantName}</p>
                          <p className="font-num text-[11px] text-vibeSecondary">-{rupiah(v.discountAmount)}</p>
                        </div>
                        {v.status === "ACTIVE" ? (
                          <button type="button" onClick={() => { setCode(v.code); setRedeemFeedback(null); }} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs">
                            Pilih
                          </button>
                        ) : (
                          <span className="text-[11px] font-bold text-pebble">Ditebus</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ))}

        {/* LAPAK & MISI */}
        {menu === "MANAGE_CHECKPOINT" && (
          <div className="space-y-5">
            <section className="gamiz-card p-5 space-y-3">
              <h2 className="text-base font-extrabold text-alabaster">{isAdmin ? "Semua lapak" : "Lapak saya"} ({mySpots.length})</h2>
              {noLapak ? (
                <p className="text-sm text-pebble">Belum ada lapak. Daftarkan yang pertama di bawah.</p>
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mySpots.map((s) => (
                    <li key={s.id} className="list-none rounded-2xl border border-stoneSubtle bg-basalt p-3.5 flex items-start gap-3">
                      <span className="w-11 h-11 rounded-2xl bg-slateElev text-vibePrimary flex items-center justify-center shrink-0">
                        <Icon name={TYPE_ICON[s.spotType]} size={24} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-alabaster leading-snug">{s.name}</p>
                        {s.status === "PENDING_REVIEW" && <p className="mt-0.5 inline-flex text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slateElev text-alabaster">Menunggu review pengelola</p>}
                        {s.status === "REJECTED" && (
                          <>
                            <p className="mt-0.5 inline-flex text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slateElev text-quotaFull">Ditolak pengelola</p>
                            {s.statusReason && <p className="text-[11px] text-pebble">Alasan: {s.statusReason}</p>}
                          </>
                        )}
                        <p className="text-[11px] text-pebble">{TYPE_LABEL[s.spotType]} · {s.regionName}</p>
                        <p className="font-num text-[11px] text-pebble mt-0.5">{formatCoord(s.coordinates)}</p>
                        <p className="font-num text-[11px] font-bold text-quotaSafe mt-0.5">Promo {rupiah(s.quest.voucherReward.discountAmount)} · min. {rupiah(s.quest.voucherReward.minimumSpend)}</p>
                        <button type="button" disabled={accountBlocked} onClick={() => setEditingId(s.id)} aria-label={`Ubah ${s.name}`} className="mt-2 btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5 disabled:opacity-60">
                          <Icon name="craft" size={16} />
                          <span>Ubah</span>
                        </button>
                      </div>
                    </li>
                  ))}
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              <form onSubmit={handleRegisterLapak} className="gamiz-card p-5 space-y-4" noValidate>
                <h2 className="text-base font-extrabold text-alabaster">Daftarkan lapak baru</h2>

                <div>
                  <label htmlFor="lapak-name" className={labelCls}>Nama sanggar atau UMKM</label>
                  <input id="lapak-name" type="text" value={lapakName} onChange={(e) => setLapakName(e.target.value)} aria-invalid={!!lapakErrors.name} aria-describedby={lapakErrors.name ? "err-name" : undefined} placeholder="Contoh: Gerabah Bu Sari" className={input} />
                  <FieldError id="err-name" msg={lapakErrors.name} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="lapak-type" className={labelCls}>Kategori</label>
                    <select id="lapak-type" value={lapakType} onChange={(e) => setLapakType(e.target.value as LapakType)} className={input}>
                      <option value="UMKM_KRIYA">UMKM kriya &amp; oleh-oleh</option>
                      <option value="UMKM_KULINER">UMKM makan &amp; minum</option>
                      <option value="SANGGAR_SENI">Sanggar seni</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="lapak-region" className={labelCls}>Kawasan</label>
                    <select id="lapak-region" value={lapakRegion} onChange={(e) => { setLapakRegion(e.target.value as CulturalVibe); setLapakPin(null); }} className={input}>
                      {REGIONS.map((r) => (
                        <option key={r.id} value={r.id}>{r.shortName} · {r.regionLabel}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <span className={labelCls}>Lokasi di peta</span>
                  <LocationPicker spots={regionSpots} value={lapakPin} onChange={(c) => { setLapakPin(c); setLapakErrors((e) => ({ ...e, pin: "" })); }} label="Lokasi lapak" />
                  <FieldError id="err-pin" msg={lapakErrors.pin} />
                </div>

                <div>
                  <label htmlFor="lapak-address" className={labelCls}>Alamat atau patokan</label>
                  <input id="lapak-address" type="text" value={lapakAddress} onChange={(e) => setLapakAddress(e.target.value)} aria-invalid={!!lapakErrors.address} aria-describedby={lapakErrors.address ? "err-address" : undefined} placeholder="Contoh: Gang Prasasti No. 4, seberang kolam" className={input} />
                  <FieldError id="err-address" msg={lapakErrors.address} />
                </div>

                <div>
                  <label htmlFor="lapak-riddle" className={labelCls}>Petunjuk misi untuk wisatawan</label>
                  <textarea id="lapak-riddle" rows={2} value={lapakRiddle} onChange={(e) => setLapakRiddle(e.target.value)} aria-invalid={!!lapakErrors.riddle} aria-describedby={lapakErrors.riddle ? "err-riddle" : undefined} placeholder="Contoh: Cari tungku tanah liat di halaman dan pindai teksturnya." className={`${input} py-3`} />
                  <FieldError id="err-riddle" msg={lapakErrors.riddle} />
                </div>

                <div>
                  <label htmlFor="lapak-story" className={labelCls}>Cerita singkat lapak (opsional)</label>
                  <textarea id="lapak-story" rows={2} value={lapakStory} onChange={(e) => setLapakStory(e.target.value)} className={`${input} py-3`} />
                </div>

                <fieldset>
                  <legend className={labelCls}>Fasilitas yang benar-benar ada</legend>
                  <div className="flex flex-wrap gap-2">
                    {FACILITY_OPTIONS.map((f) => {
                      const on = lapakFacilities.includes(f);
                      return (
                        <label key={f} className={`min-h-[44px] px-3.5 rounded-xl border-2 text-xs font-extrabold inline-flex items-center cursor-pointer ${on ? "border-vibePrimary bg-[var(--vibe-surface-tint)] text-alabaster" : "border-stoneStrong bg-basalt text-pebble"}`}>
                          <input type="checkbox" className="sr-only" checked={on} onChange={() => setLapakFacilities((p) => (on ? p.filter((x) => x !== f) : [...p, f]))} />
                          {f}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="lapak-cap" className={labelCls}>Kapasitas sekaligus</label>
                    <input id="lapak-cap" type="number" inputMode="numeric" min={1} max={500} value={lapakCapacity} onChange={(e) => setLapakCapacity(Number(e.target.value))} aria-invalid={!!lapakErrors.capacity} aria-describedby={lapakErrors.capacity ? "err-cap" : undefined} className={`${input} font-num`} />
                    <FieldError id="err-cap" msg={lapakErrors.capacity} />
                  </div>
                  <div>
                    <label htmlFor="lapak-disc" className={labelCls}>Diskon wisatawan</label>
                    <select id="lapak-disc" value={lapakDiscount} onChange={(e) => setLapakDiscount(Number(e.target.value))} className={`${input} font-num`}>
                      {[5000, 10000, 15000, 20000, 25000].map((n) => <option key={n} value={n}>{rupiah(n)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="lapak-min" className={labelCls}>Min. belanja</label>
                    <select id="lapak-min" value={lapakMinSpend} onChange={(e) => setLapakMinSpend(Number(e.target.value))} className={`${input} font-num`}>
                      {[0, 20000, 30000, 50000].map((n) => <option key={n} value={n}>{n === 0 ? "Tanpa minimum" : rupiah(n)}</option>)}
                    </select>
                  </div>
                </div>

                <button type="submit" disabled={lapakBusy || accountBlocked} className="btn-tactile-primary w-full min-h-[52px] px-5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
                  {lapakBusy ? <Icon name="loader" size={18} weight="bold" motion="spin" /> : <Icon name="plusCircle" size={18} />}
                  <span>{lapakBusy ? "Menyimpan" : accountBlocked ? "Menunggu persetujuan pengelola" : isAdmin ? "Simpan lapak ke peta" : "Kirim lapak untuk ditinjau"}</span>
                </button>

                {lapakMsg && (
                  <p role={lapakMsg.ok ? "status" : "alert"} className={`text-sm font-bold ${lapakMsg.ok ? "text-quotaSafe" : "text-quotaFull"}`}>
                    {lapakMsg.text}
                  </p>
                )}
              </form>

              <form onSubmit={handleVerifyVisit} className="gamiz-card p-5 space-y-4" noValidate>
                <h2 className="text-base font-extrabold text-alabaster">Verifikasi kehadiran pengunjung</h2>
                <p className="text-xs text-pebble leading-relaxed">
                  Setelah check-in, pengunjung melihat kode kehadiran di layarnya. Minta kodenya, verifikasi di sini, dan
                  server mencatat hadiah misinya. Tiap kode hanya berlaku sekali.
                </p>
                <div>
                  <label htmlFor="visit-code" className={labelCls}>Kode kehadiran</label>
                  <input id="visit-code" type="text" autoComplete="off" autoCapitalize="characters" value={visitCode} onChange={(e) => { setVisitCode(e.target.value.toUpperCase()); setVisitMsg(null); }} placeholder="KDR-123456" className={`${input} font-num text-base font-extrabold tracking-wider`} />
                </div>
                <button type="submit" disabled={visitBusy || noLapak} className="btn-tactile-secondary w-full min-h-[48px] px-5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
                  {visitBusy ? <Icon name="loader" size={18} weight="bold" motion="spin" /> : <Icon name="seal" size={18} className="text-vibeSecondary" />}
                  <span>{visitBusy ? "Memverifikasi" : "Verifikasi kehadiran"}</span>
                </button>
                {noLapak && <p className="text-xs text-pebble">Daftarkan lapak dulu untuk memverifikasi pengunjung.</p>}
                {visitMsg && (
                  <p role={visitMsg.ok ? "status" : "alert"} className={`text-sm font-bold ${visitMsg.ok ? "text-quotaSafe" : "text-quotaFull"}`}>
                    {visitMsg.text}
                  </p>
                )}
              </form>
            </div>
          </div>
        )}

        {/* PROMO */}
        {menu === "CREATE_PROMO" &&
          (noLapak || !promoSpot ? (
            emptyLapak
          ) : (
            <form onSubmit={handleSavePromo} className="gamiz-card p-5 max-w-xl space-y-4" noValidate>
              <div>
                <h2 className="text-base font-extrabold text-alabaster">Promo voucer Object Scanner</h2>
                <p className="text-xs text-pebble mt-1 leading-relaxed">
                  Voucer ini diberikan otomatis kepada wisatawan yang memindai objek di lapakmu. Mengubahnya tidak menerbitkan
                  voucer baru, hanya mengatur promo yang berlaku.
                </p>
              </div>

              {mySpots.length > 1 && (
                <div>
                  <label htmlFor="promo-spot" className={labelCls}>Lapak</label>
                  <select id="promo-spot" value={promoSpot.id} onChange={(e) => setPromoSpotId(e.target.value)} className={input}>
                    {mySpots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="promo-title" className={labelCls}>Judul promo</label>
                <input id="promo-title" type="text" value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} aria-invalid={!!promoErr} aria-describedby={promoErr ? "err-promo" : undefined} className={input} />
                <FieldError id="err-promo" msg={promoErr ?? undefined} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="promo-amount" className={labelCls}>Nominal diskon</label>
                  <select id="promo-amount" value={promoAmount} onChange={(e) => setPromoAmount(Number(e.target.value))} className={`${input} font-num`}>
                    {[5000, 10000, 15000, 20000, 25000].map((n) => <option key={n} value={n}>{rupiah(n)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="promo-min" className={labelCls}>Min. belanja</label>
                  <select id="promo-min" value={promoMin} onChange={(e) => setPromoMin(Number(e.target.value))} className={`${input} font-num`}>
                    {[0, 20000, 30000, 50000].map((n) => <option key={n} value={n}>{n === 0 ? "Tanpa minimum" : rupiah(n)}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={promoBusy} className="btn-tactile-primary w-full min-h-[52px] px-5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
                {promoBusy ? <Icon name="loader" size={18} weight="bold" motion="spin" /> : <Icon name="ticket" size={18} />}
                <span>{promoBusy ? "Menyimpan" : "Simpan promo"}</span>
              </button>

              {promoMsg && (
                <p role={promoMsg.ok ? "status" : "alert"} className={`text-sm font-bold ${promoMsg.ok ? "text-quotaSafe" : "text-quotaFull"}`}>
                  {promoMsg.text}
                </p>
              )}
            </form>
          ))}

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
