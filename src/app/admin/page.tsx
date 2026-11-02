"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLokawira } from "@/components/layout/LokawiraProvider";
import { CulturalSpot, CulturalVibe, OpkCategory, SpotType } from "@/types/lokawira";
import Icon from "@/components/ui/Icon";
import { api, ApiError, DEMO_MODE, describeError } from "@/lib/api";
import { useAuth } from "@/components/layout/AuthProvider";
import ApprovalQueue from "@/components/admin/ApprovalQueue";
import RequireRole from "@/components/layout/RequireRole";
import LocationPicker from "@/components/map/LocationPicker";
import { LatLng, formatCoord } from "@/lib/geo";
import { REGIONS } from "@/lib/regions";

const FIELD =
  "w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-sm text-alabaster placeholder:text-ashMuted";

function AdminContent() {
  const { user, logout } = useAuth();
  const { activeVibe, spots, setSpots, vouchers, reservations, setReservations, refreshServerData } = useLokawira();

  const [activePillar, setActivePillar] = useState<"P0_P1" | "P4" | "P2" | "P3" | "APPROVAL">(
    "P4"
  );
  const [approvalCount, setApprovalCount] = useState(0);
  const [adminToast, setAdminToast] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState(false);
  const toast = (text: string, isError = false) => {
    setToastIsError(isError);
    setAdminToast(text);
  };

  const [opkCategory, setOpkCategory] = useState<OpkCategory>("Tradisi Lisan");
  const [maestroSource, setMaestroSource] = useState<string>(
    "PPKD Provinsi & Maestro Tradisi Lisan Setempat"
  );
  const [loreSummary, setLoreSummary] = useState<string>(
    "Dokumentasi pakem sejarah lisan dan teknik kriya untuk mencegah halusinasi AI Storyteller."
  );
  const [trainingLogs, setTrainingLogs] = useState<
    { id: string; opkCategory: string; maestroSource: string; summary: string }[]
  >(
    !DEMO_MODE
      ? []
      : [
    {
      id: "rag-init-1",
      opkCategory: "Teknologi Tradisional & Kriya",
      maestroSource: "PPKD Kabupaten Mojokerto & Mbah Suroso",
      summary:
        "Teknik kosod bata merah dan sejarah celengan terakota Majapahit abad ke-14.",
    },
    {
      id: "rag-init-2",
      opkCategory: "Pengetahuan Tradisional",
      maestroSource: "Yayasan Lasem Heritage & Mbah Putri Sekar",
      summary:
        "Rahasia mineral air sumur kapur Lasem pada pewarnaan merah Batik Tiga Negeri.",
    },
  ]
  );

  // catatan RAG berasal dr server; data cth cuma muncul di mode demo
  useEffect(() => {
    api
      .getSnapshot()
      .then((d) => setTrainingLogs(d.aiTrainingNotes))
      .catch(() => {});
  }, []);

  const handleUpdateQuota = async (spotId: string, newVisitors: number) => {
    setSpots((prev) =>
      prev.map((s) => {
        if (s.id !== spotId) return s;
        const clamped = Math.max(0, Math.min(s.quota.maxCapacity, newVisitors));
        const ratio = clamped / s.quota.maxCapacity;
        return {
          ...s,
          quota: {
            ...s.quota,
            currentVisitors: clamped,
            estimatedWaitMinutes: ratio >= 0.85 ? 35 : ratio >= 0.6 ? 15 : 0,
          },
        };
      })
    );

    try {
      await api.updateQuota({ spotId, currentVisitors: newVisitors });
      toast("Kapasitas pengunjung diperbarui dan tersimpan di server.");
    } catch (err) {
      // jgn mengaku tersimpan kalo server gak mennerimanya
      toast(
        err instanceof ApiError && err.isOffline && DEMO_MODE
          ? "Server tidak terjangkau. Kapasitas hanya berubah di perangkat ini (mode demo)."
          : describeError(err, "Kapasitas gagal disimpan ke server."),
        true
      );
    }
  };

  const handleVerifyTicket = async (ticketId: string) => {
    try {
      const res = await api.checkInTicket({ ticketId });
      setReservations(res.reservations);
      toast(`E-Ticket ${ticketId} ditandai masuk lokasi dan tersimpan di server.`);
    } catch (err) {
      toast(describeError(err, "E-Ticket gagal diverifikasi."), true);
    }
  };

  // P0 & P1: tambah titik budaya
  const OPK_OPTIONS: OpkCategory[] = ["Cagar Budaya", "Tradisi Lisan", "Pengetahuan Tradisional", "Teknologi Tradisional & Kriya", "Seni Pertunjukan", "Adat Istiadat & Ritus"];
  const [nsName, setNsName] = useState("");
  const [nsType, setNsType] = useState<SpotType>("PRIMARY_DEST");
  const [nsRegion, setNsRegion] = useState<CulturalVibe>(activeVibe);
  const [nsOpk, setNsOpk] = useState<OpkCategory>("Cagar Budaya");
  const [nsAddress, setNsAddress] = useState("");
  const [nsSource, setNsSource] = useState("");
  const [nsStory, setNsStory] = useState("");
  const [nsRiddle, setNsRiddle] = useState("");
  const [nsCapacity, setNsCapacity] = useState(150);
  const [nsXp, setNsXp] = useState(150);
  const [nsPin, setNsPin] = useState<LatLng | null>(null);
  const [nsErrors, setNsErrors] = useState<Record<string, string>>({});
  const [nsBusy, setNsBusy] = useState(false);
  const regionSpots = spots.filter((x) => x.vibe === nsRegion);

  const handleAddSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (nsName.trim().length < 3) errs.name = "Nama minimal 3 karakter.";
    if (nsAddress.trim().length < 5) errs.address = "Isi alamat atau patokan.";
    if (nsSource.trim().length < 5) errs.source = "Sumber rujukan wajib diisi agar cerita bisa dipertanggungjawabkan.";
    if (nsStory.trim().length < 20) errs.story = "Narasi minimal 20 karakter.";
    if (nsRiddle.trim().length < 10) errs.riddle = "Tulis teka-teki misi (minimal 10 karakter).";
    if (!nsPin) errs.pin = "Taruh pin lokasi di peta.";
    if (!Number.isFinite(nsCapacity) || nsCapacity < 1 || nsCapacity > 5000) errs.capacity = "Kapasitas 1 sampai 5000.";
    setNsErrors(errs);
    if (Object.keys(errs).length > 0 || !nsPin) return;

    const region = REGIONS.find((r) => r.id === nsRegion)!;
    const draft: CulturalSpot = {
      id: "draft",
      name: nsName.trim(),
      regionName: `${region.shortName}, ${region.regionLabel}`,
      vibe: nsRegion,
      spotType: nsType,
      opkCategory: nsOpk,
      coordinates: nsPin,
      address: nsAddress.trim(),
      facilities: [],
      quota: { currentVisitors: 0, maxCapacity: nsCapacity, estimatedWaitMinutes: 0, nextAvailableSlot: "Tersedia langsung" },
      quest: {
        riddleTitle: `Misi ${nsName.trim()}`,
        riddleClue: nsRiddle.trim(),
        targetObjectPrompt: "Objek budaya di titik ini",
        verifiedLoreSource: nsSource.trim(),
        loreNarrative: nsStory.trim(),
        rewardPoints: nsXp,
        voucherReward: { merchantName: nsName.trim(), discountTitle: "Voucer kunjungan", discountAmount: 10000, minimumSpend: 20000 },
      },
    };
    setNsBusy(true);
    try {
      const res = await api.addSpot(draft);
      setSpots(res.spots);
      toast(`Titik "${res.spot.name}" tersimpan di server dan tampil di peta wisatawan.`);
      setNsName(""); setNsAddress(""); setNsSource(""); setNsStory(""); setNsRiddle(""); setNsPin(null); setNsErrors({});
    } catch (err) {
      toast(describeError(err, "Titik gagal disimpan."), true);
    } finally {
      setNsBusy(false);
    }
  };

  const handleReload = async () => {
    try {
      await refreshServerData();
      toast("Data dimuat ulang dari server.");
    } catch (err) {
      toast(describeError(err, "Gagal memuat ulang data."), true);
    }
  };

  // P2: ekonomi misi
  const [eco, setEco] = useState<Record<string, { xp: number; amount: number }>>({});
  const [ecoBusy, setEcoBusy] = useState<string | null>(null);
  const handleSaveEco = async (sp: CulturalSpot) => {
    const e = eco[sp.id];
    if (!e) return;
    setEcoBusy(sp.id);
    try {
      const res = await api.updatePromo({
        spotId: sp.id,
        discountTitle: sp.quest.voucherReward.discountTitle,
        discountAmount: e.amount,
        minimumSpend: sp.quest.voucherReward.minimumSpend,
        rewardPoints: e.xp,
      });
      setSpots(res.spots);
      setEco((p) => { const n = { ...p }; delete n[sp.id]; return n; });
      toast(`Hadiah misi ${sp.name} tersimpan di server.`);
    } catch (err) {
      toast(describeError(err, "Hadiah misi gagal disimpan."), true);
    } finally {
      setEcoBusy(null);
    }
  };

  const handleAddAiTrainingData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maestroSource.trim() || !loreSummary.trim()) return;

    try {
      const res = await api.addAiNote({
        opkCategory,
        maestroSource: maestroSource.trim(),
        summary: loreSummary.trim(),
      });
      setTrainingLogs(res.aiTrainingNotes);
      toast(`Data RAG "${opkCategory}" (${maestroSource.trim()}) tersimpan di server.`);
    } catch (err) {
      toast(describeError(err, "Data RAG gagal disimpan ke server."), true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-16">
      <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <header className="gamiz-card px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-lg sm:text-xl font-extrabold text-alabaster leading-tight">Dasbor Pengelola</h1>
            <p className="text-xs text-pebble truncate">{user?.name}</p>
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

        {adminToast && (
          <div
            role="status"
            aria-live="polite"
            className={`p-4 rounded-2xl bg-slateElev border-2 flex items-center justify-between gap-2 text-xs font-bold text-alabaster ${toastIsError ? "border-quotaFull" : "border-quotaSafe"}`}
          >
            <div className="flex items-center gap-2">
              <Icon name={toastIsError ? "alert" : "check"} size={16} className={`${toastIsError ? "text-quotaFull" : "text-quotaSafe"} shrink-0`} />
              <span>{adminToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setAdminToast(null)}
              className="min-h-[44px] px-3 py-1 rounded-xl bg-obsidian text-pebble hover:text-alabaster"
            >
              Tutup
            </button>
          </div>
        )}

        {/* 4 Clean Gamiz Pillar Tabs */}
        <div
          role="tablist"
          aria-label="Pilar Manajemen Admin"
          className="gamiz-card p-2 grid grid-cols-2 lg:grid-cols-5 gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activePillar === "P4"}
            onClick={() => setActivePillar("P4")}
            className={`min-h-[52px] px-3 py-2 rounded-2xl text-xs font-extrabold text-center leading-tight flex items-center justify-center gap-2 transition-all ${
              activePillar === "P4"
                ? "bg-vibePrimary text-[var(--vibe-on-primary)]"
                : "text-pebble hover:text-alabaster"
            }`}
          >
            <Icon name="users" size={16} />
            <span>1. Kuota &amp; E-Ticket (P4)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activePillar === "P0_P1"}
            onClick={() => setActivePillar("P0_P1")}
            className={`min-h-[52px] px-3 py-2 rounded-2xl text-xs font-extrabold text-center leading-tight flex items-center justify-center gap-2 transition-all ${
              activePillar === "P0_P1"
                ? "bg-vibePrimary text-[var(--vibe-on-primary)]"
                : "text-pebble hover:text-alabaster"
            }`}
          >
            <Icon name="pin" size={16} />
            <span>2. Lokasi Peta (P0 &amp; P1)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activePillar === "P2"}
            onClick={() => setActivePillar("P2")}
            className={`min-h-[52px] px-3 py-2 rounded-2xl text-xs font-extrabold text-center leading-tight flex items-center justify-center gap-2 transition-all ${
              activePillar === "P2"
                ? "bg-vibePrimary text-[var(--vibe-on-primary)]"
                : "text-pebble hover:text-alabaster"
            }`}
          >
            <Icon name="ticket" size={16} />
            <span>3. Distribusi Voucer (P2)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activePillar === "P3"}
            onClick={() => setActivePillar("P3")}
            className={`min-h-[52px] px-3 py-2 rounded-2xl text-xs font-extrabold text-center leading-tight flex items-center justify-center gap-2 transition-all ${
              activePillar === "P3"
                ? "bg-vibePrimary text-[var(--vibe-on-primary)]"
                : "text-pebble hover:text-alabaster"
            }`}
          >
            <Icon name="guide" size={16} />
            <span>4. Database OPK &amp; AI (P3)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePillar === "APPROVAL"}
            onClick={() => setActivePillar("APPROVAL")}
            className={`col-span-2 lg:col-span-1 min-h-[52px] px-3 py-2 rounded-2xl text-xs font-extrabold text-center leading-tight flex items-center justify-center gap-2 transition-all ${
              activePillar === "APPROVAL"
                ? "bg-vibePrimary text-[var(--vibe-on-primary)]"
                : "text-pebble hover:text-alabaster"
            }`}
          >
            <Icon name="seal" size={16} />
            <span>5. Persetujuan{approvalCount > 0 ? <> (<span className="font-num">{approvalCount}</span>)</> : null}</span>
          </button>
        </div>

        <div hidden={activePillar !== "APPROVAL"}>
          <ApprovalQueue spots={spots} onSpots={setSpots} onToast={toast} onCount={setApprovalCount} />
        </div>

        {/* P4: QUOTA & TICKETS */}
        {activePillar === "P4" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 gamiz-card p-6 space-y-4">
              <h2 className="text-base font-extrabold text-alabaster">
                Monitor Kepadatan Wisata &amp; Simulasi Pengalih Antrean
              </h2>
              <div className="space-y-3">
                {spots.map((spot) => {
                  const ratio =
                    spot.quota.currentVisitors / spot.quota.maxCapacity;
                  const isFull = ratio >= 0.85;
                  return (
                    <div
                      key={spot.id}
                      className="p-4 rounded-2xl bg-obsidian space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-bold text-[var(--vibe-primary-lip)]">
                            {spot.regionName}
                          </span>
                          <h3 className="text-sm font-extrabold text-alabaster">
                            {spot.name}
                          </h3>
                        </div>
                        <span
                          className={`font-num text-xs font-extrabold px-3 py-1 rounded-full ${
                            isFull
                              ? "bg-basalt text-quotaFull"
                              : "bg-basalt text-quotaSafe"
                          }`}
                        >
                          {spot.quota.currentVisitors}/{spot.quota.maxCapacity} (
                          {Math.round(ratio * 100)}%)
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQuota(
                              spot.id,
                              Math.floor(spot.quota.maxCapacity * 0.45)
                            )
                          }
                          className="btn-tactile-secondary min-h-[44px] px-3.5 py-1.5 text-xs"
                        >
                          Set Lengang (45%)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQuota(
                              spot.id,
                              Math.floor(spot.quota.maxCapacity * 0.95)
                            )
                          }
                          className="btn-tactile-primary min-h-[44px] px-3.5 py-1.5 text-xs"
                        >
                          Simulasi Padat (95% - Picu Redirect)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="lg:col-span-5 gamiz-card p-6 space-y-3">
              <h2 className="text-base font-extrabold text-alabaster">
                Verifikasi E-Ticket Masuk ({reservations.length})
              </h2>
              <div className="space-y-2.5">
                {reservations.map((res) => (
                  <div
                    key={res.ticketId}
                    className="p-4 rounded-2xl bg-obsidian flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-num text-xs font-bold text-vibeSecondary block">
                        {res.ticketId} • {res.scheduledSlot}
                      </span>
                      <p className="text-xs font-extrabold text-alabaster mt-0.5">
                        {res.visitorName} ({res.partySize} orang)
                      </p>
                      <p className="text-[11px] text-pebble">{res.spotName}</p>
                    </div>
                    {res.status === "CONFIRMED" ? (
                      <button
                        type="button"
                        onClick={() => handleVerifyTicket(res.ticketId)}
                        className="btn-tactile-primary min-h-[44px] px-3.5 py-1.5 text-xs"
                      >
                        Check-In
                      </button>
                    ) : (
                      <span className="font-num text-xs text-quotaSafe font-bold">
                        SELESAI
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* P0 & P1: MAP LOCATIONS */}
        {activePillar === "P0_P1" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <section className="lg:col-span-5 gamiz-card p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-extrabold text-alabaster">Titik di peta ({spots.length})</h2>
                <button type="button" onClick={handleReload} className="btn-tactile-secondary min-h-[44px] px-3.5 text-xs inline-flex items-center gap-1.5">
                  <Icon name="database" size={16} />
                  <span>Muat ulang dari server</span>
                </button>
              </div>
              {spots.length === 0 ? (
                <p className="text-sm text-pebble">Belum ada titik. Tambahkan yang pertama lewat formulir.</p>
              ) : (
                <ul className="space-y-2.5">
                  {spots.map((sp) => (
                    <li key={sp.id} className="list-none bg-obsidian p-3.5 rounded-2xl">
                      <span className="text-[11px] font-bold text-vibeSecondary">{sp.regionName} • {sp.opkCategory}</span>
                      <h3 className="text-sm font-extrabold text-alabaster mt-0.5">{sp.name}</h3>
                      <p className="font-num text-[11px] text-pebble mt-0.5">{formatCoord(sp.coordinates)}</p>
                      <p className="text-[11px] text-pebble">Sumber: {sp.quest.verifiedLoreSource}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <form onSubmit={handleAddSpot} className="lg:col-span-7 gamiz-card p-5 space-y-4" noValidate>
              <h2 className="text-base font-extrabold text-alabaster">Tambah titik budaya, sanggar, atau UMKM</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="ns-name" className="block text-xs font-bold text-pebble mb-1.5">Nama titik</label>
                  <input id="ns-name" type="text" value={nsName} onChange={(e) => setNsName(e.target.value)} className={FIELD} />
                  {nsErrors.name && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{nsErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="ns-type" className="block text-xs font-bold text-pebble mb-1.5">Jenis</label>
                  <select id="ns-type" value={nsType} onChange={(e) => setNsType(e.target.value as SpotType)} className={FIELD}>
                    <option value="PRIMARY_DEST">Cagar budaya utama</option>
                    <option value="SANGGAR_SENI">Sanggar seni</option>
                    <option value="UMKM_KULINER">UMKM makan &amp; minum</option>
                    <option value="UMKM_KRIYA">UMKM kriya &amp; oleh-oleh</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ns-region" className="block text-xs font-bold text-pebble mb-1.5">Kawasan</label>
                  <select id="ns-region" value={nsRegion} onChange={(e) => { setNsRegion(e.target.value as CulturalVibe); setNsPin(null); }} className={FIELD}>
                    {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.shortName} · {r.regionLabel}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="ns-opk" className="block text-xs font-bold text-pebble mb-1.5">Kategori OPK</label>
                  <select id="ns-opk" value={nsOpk} onChange={(e) => setNsOpk(e.target.value as OpkCategory)} className={FIELD}>
                    {OPK_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-pebble mb-1.5">Lokasi di peta</span>
                <LocationPicker spots={regionSpots} value={nsPin} onChange={(c) => { setNsPin(c); setNsErrors((x) => ({ ...x, pin: "" })); }} label="Lokasi titik" />
                {nsErrors.pin && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{nsErrors.pin}</p>}
              </div>

              <div>
                <label htmlFor="ns-address" className="block text-xs font-bold text-pebble mb-1.5">Alamat atau patokan</label>
                <input id="ns-address" type="text" value={nsAddress} onChange={(e) => setNsAddress(e.target.value)} className={FIELD} />
                {nsErrors.address && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{nsErrors.address}</p>}
              </div>
              <div>
                <label htmlFor="ns-source" className="block text-xs font-bold text-pebble mb-1.5">Sumber rujukan terverifikasi</label>
                <input id="ns-source" type="text" value={nsSource} onChange={(e) => setNsSource(e.target.value)} placeholder="Contoh: PPKD Kabupaten Mojokerto" className={FIELD} />
                {nsErrors.source && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{nsErrors.source}</p>}
              </div>
              <div>
                <label htmlFor="ns-story" className="block text-xs font-bold text-pebble mb-1.5">Narasi Ki Narada</label>
                <textarea id="ns-story" rows={3} value={nsStory} onChange={(e) => setNsStory(e.target.value)} className={`${FIELD} py-3`} />
                {nsErrors.story && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{nsErrors.story}</p>}
              </div>
              <div>
                <label htmlFor="ns-riddle" className="block text-xs font-bold text-pebble mb-1.5">Teka-teki misi</label>
                <textarea id="ns-riddle" rows={2} value={nsRiddle} onChange={(e) => setNsRiddle(e.target.value)} className={`${FIELD} py-3`} />
                {nsErrors.riddle && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{nsErrors.riddle}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ns-cap" className="block text-xs font-bold text-pebble mb-1.5">Kapasitas</label>
                  <input id="ns-cap" type="number" inputMode="numeric" min={1} value={nsCapacity} onChange={(e) => setNsCapacity(Number(e.target.value))} className={`${FIELD} font-num`} />
                  {nsErrors.capacity && <p role="alert" className="mt-1 text-xs font-bold text-quotaFull">{nsErrors.capacity}</p>}
                </div>
                <div>
                  <label htmlFor="ns-xp" className="block text-xs font-bold text-pebble mb-1.5">Hadiah misi (XP)</label>
                  <select id="ns-xp" value={nsXp} onChange={(e) => setNsXp(Number(e.target.value))} className={`${FIELD} font-num`}>
                    {[50, 100, 150, 200, 300].map((n) => <option key={n} value={n}>{n} XP</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={nsBusy} className="btn-tactile-primary w-full min-h-[52px] px-5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
                {nsBusy ? <Icon name="loader" size={18} weight="bold" motion="spin" /> : <Icon name="plusCircle" size={18} />}
                <span>{nsBusy ? "Menyimpan" : "Simpan titik ke peta"}</span>
              </button>
            </form>
          </div>
        )}

        {/* P2: VOUCHERS */}
        {activePillar === "P2" && (
          <>
          <section className="gamiz-card p-5 space-y-3">
            <h2 className="text-base font-extrabold text-alabaster">Atur hadiah misi per titik</h2>
            <p className="text-xs text-pebble">XP misi dan nominal voucer hasil scan. Perubahan berlaku untuk wisatawan berikutnya.</p>
            <ul className="space-y-2.5">
              {spots.map((sp) => {
                const e = eco[sp.id];
                const xp = e?.xp ?? sp.quest.rewardPoints;
                const amount = e?.amount ?? sp.quest.voucherReward.discountAmount;
                return (
                  <li key={sp.id} className="list-none bg-obsidian p-3.5 rounded-2xl grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 sm:items-end">
                    <p className="text-sm font-extrabold text-alabaster">{sp.name}</p>
                    <div>
                      <label htmlFor={`eco-xp-${sp.id}`} className="block text-[11px] font-bold text-pebble mb-1">XP misi</label>
                      <input id={`eco-xp-${sp.id}`} type="number" inputMode="numeric" min={0} max={1000} value={xp} onChange={(ev) => setEco((p) => ({ ...p, [sp.id]: { xp: Number(ev.target.value), amount } }))} className={`${FIELD} font-num sm:w-28`} />
                    </div>
                    <div>
                      <label htmlFor={`eco-amt-${sp.id}`} className="block text-[11px] font-bold text-pebble mb-1">Voucer</label>
                      <select id={`eco-amt-${sp.id}`} value={amount} onChange={(ev) => setEco((p) => ({ ...p, [sp.id]: { xp, amount: Number(ev.target.value) } }))} className={`${FIELD} font-num sm:w-36`}>
                        {[5000, 10000, 15000, 20000, 25000].map((n) => <option key={n} value={n}>Rp{n.toLocaleString("id-ID")}</option>)}
                      </select>
                    </div>
                    <button type="button" disabled={!e || ecoBusy === sp.id} onClick={() => handleSaveEco(sp)} className="btn-tactile-primary min-h-[48px] px-4 text-xs disabled:opacity-50">
                      {ecoBusy === sp.id ? "Menyimpan" : "Simpan"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="gamiz-card p-6 space-y-4">
            <h2 className="text-base font-extrabold text-alabaster">
              Distribusi Tiket Voucer UMKM ({vouchers.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {vouchers.map((v) => (
                <div
                  key={v.code}
                  className="perforated-ticket p-4 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="font-num text-xs font-bold text-vibePrimary block">
                      {v.code} • {v.status}
                    </span>
                    <p className="text-sm font-extrabold text-alabaster mt-0.5">
                      {v.merchantName}
                    </p>
                    <p className="text-xs text-pebble">{v.discountTitle}</p>
                  </div>
                  <span className="font-num text-sm font-extrabold text-quotaSafe">
                    Rp{v.discountAmount.toLocaleString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          </section>
          </>
        )}

        {/* P3: AI & OPK DATABASE */}
        {activePillar === "P3" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleAddAiTrainingData}
              className="lg:col-span-6 gamiz-card p-6 space-y-4"
            >
              <h2 className="text-base font-extrabold text-alabaster">
                Tambah Rujukan OPK untuk AI StoryTeller
              </h2>

              <div>
                <label
                  htmlFor="admin-opk-select"
                  className="block text-xs font-bold text-pebble mb-1.5"
                >
                  Kategori OPK (UU No. 5/2017)
                </label>
                <select
                  id="admin-opk-select"
                  value={opkCategory}
                  onChange={(e) => setOpkCategory(e.target.value as OpkCategory)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-xs text-alabaster"
                >
                  <option value="Tradisi Lisan">Tradisi Lisan</option>
                  <option value="Pengetahuan Tradisional">Pengetahuan Tradisional</option>
                  <option value="Teknologi Tradisional & Kriya">
                    Teknologi Tradisional &amp; Kriya
                  </option>
                  <option value="Seni Pertunjukan">Seni Pertunjukan</option>
                  <option value="Adat Istiadat & Ritus">Adat Istiadat &amp; Ritus</option>
                  <option value="Cagar Budaya">Cagar Budaya</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="admin-maestro-input"
                  className="block text-xs font-bold text-pebble mb-1.5"
                >
                  Sumber PPKD / Maestro
                </label>
                <input
                  id="admin-maestro-input"
                  type="text"
                  value={maestroSource}
                  onChange={(e) => setMaestroSource(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-obsidian border border-stoneStrong text-xs text-alabaster"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-summary-input"
                  className="block text-xs font-bold text-pebble mb-1.5"
                >
                  Ringkasan Fakta Budaya
                </label>
                <textarea
                  id="admin-summary-input"
                  rows={3}
                  value={loreSummary}
                  onChange={(e) => setLoreSummary(e.target.value)}
                  className="w-full p-3 rounded-xl bg-obsidian border border-stoneStrong text-xs text-alabaster"
                />
              </div>

              <button
                type="submit"
                className="btn-tactile-primary min-h-[48px] px-5 py-2.5 text-xs flex items-center gap-2"
              >
                <Icon name="seal" size={16} />
                <span>Simpan ke Basis Pengetahuan AI</span>
              </button>
            </form>

            <section className="lg:col-span-6 gamiz-card p-6 space-y-3">
              <h3 className="text-base font-extrabold text-alabaster">
                Rujukan RAG Terdaftar ({trainingLogs.length})
              </h3>
              <div className="space-y-2.5">
                {trainingLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl bg-obsidian space-y-1"
                  >
                    <span className="text-xs font-bold text-vibePrimary block">
                      {log.opkCategory} • {log.maestroSource}
                    </span>
                    <p className="text-xs text-alabaster leading-relaxed">
                      {log.summary}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <RequireRole roles={["ADMIN"]}>
      <AdminContent />
    </RequireRole>
  );
}
