"use client";

import React, { useEffect, useRef, useState } from "react";
import { MotionConfig, motion } from "motion/react";
import Icon from "@/components/ui/Icon";
import { API_BASE, ApiError, api, DEMO_MODE, describeError } from "@/lib/api";
import { DEFAULT_TARGET } from "@/components/merchant/ScanObjectEditor";
import { fileToJpeg, shrinkToJpeg, ACCEPTED_IMAGE_TYPES } from "@/lib/image";
import {
  CulturalSpot,
  IssuedVoucher,
  LensVerificationResult,
  UnlockedLoreCard,
} from "@/types/lokawira";
import { CULTURAL_OBJECT_SAMPLES } from "@/lib/seedCulturalData";
import Link from "next/link";
import Loka from "@/components/brand/Loka";
import { LocationError, useLocation } from "@/components/layout/LocationProvider";
import { formatDistance } from "@/lib/geo";
import { motionReduced, useReducedMotionConfig } from "@/lib/motionPref";

interface ObjectLensScannerProps {
  isOpen: boolean;
  onClose: () => void;
  activeSpot: CulturalSpot | null;
  onScanVerified: (
    result: LensVerificationResult,
    newLoreCard: UnlockedLoreCard,
    newVoucher?: IssuedVoucher
  ) => void;
}

export default function ObjectLensScanner({
  isOpen,
  onClose,
  activeSpot,
  onScanVerified,
}: ObjectLensScannerProps) {
  const reducedMotion = useReducedMotionConfig();
  const [selectedSampleId, setSelectedSampleId] = useState<string>(
    CULTURAL_OBJECT_SAMPLES[0].id
  );
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraNotice, setCameraNotice] = useState<string>(
    DEMO_MODE
      ? "Sampel artefak siap dipindai (Cocok untuk pengujian di laptop maupun ponsel)"
      : "Tekan Buka Kamera atau Unggah Foto, lalu bidik objek yang dicari."
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<LensVerificationResult | null>(null);
  const { position: userPosition, getFix } = useLocation();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const voucherRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  // jarak terang voucer menuju tab Tas pas user menekan "Simpan ke Tas"
  const [flight, setFlight] = useState<{ x: number; y: number } | null>(null);

  // pratinjau foto yg dipilih
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!uploadedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(uploadedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadedFile]);

  useEffect(() => {
    if (!isOpen) return;
    setScanResult(null);
    setScanError(null);
    setFlight(null);
    if (activeSpot) {
      const matchingSample = CULTURAL_OBJECT_SAMPLES.find(
        (s) => s.spotId === activeSpot.id
      );
      if (matchingSample) {
        setSelectedSampleId(matchingSample.id);
      }
    }
  }, [isOpen, activeSpot]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen && videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      setCameraActive(false);
    }
  }, [isOpen]);

  // hasil scan hrs langsung terlihat, bkn tersembunyi di bawah liptaan layar
  useEffect(() => {
    if (!scanResult) return;
    const reduce = motionReduced();
    resultRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }, [scanResult]);

  if (!isOpen) return null;

  const currentSample =
    CULTURAL_OBJECT_SAMPLES.find((s) => s.id === selectedSampleId) ||
    CULTURAL_OBJECT_SAMPLES[0];

  const handleStartCamera = async () => {
    if (cameraActive && videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      setCameraActive(false);
      setCameraNotice(DEMO_MODE ? "Kamera dimatikan. Menggunakan Sampel Artefak Kurasi." : "Kamera dimatikan. Buka lagi atau unggah foto dari galeri.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraNotice(DEMO_MODE ? "WebRTC tidak tersedia. Mode Sampel Kurasi tetap aktif." : "Kamera tidak tersedia di perangkat ini. Pakai Unggah Foto untuk memilih foto dari galeri.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setCameraNotice("Kamera Aktif: Arahkan bidik ke artefak atau kriya budaya.");
    } catch {
      setCameraNotice(
        DEMO_MODE
          ? "Izin kamera tidak tersedia di perangkat ini. Mode Sampel Kurasi aktif."
          : "Izin kamera ditolak atau tidak tersedia. Pakai Unggah Foto untuk memilih foto dari galeri."
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setScanError("Format foto harus JPEG, PNG, atau WebP.");
      return;
    }
    setScanError(null);
    setScanResult(null);
    setUploadedFile(file);
    setCameraNotice(`Foto terpilih: ${file.name}`);
  };

  const handleExecuteScan = async () => {
    setIsScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const spotId = activeSpot?.id || currentSample.spotId;
      let data: LensVerificationResult;
      // foto beneran (kamera atau unggahan) dikirim sbg gambar. Sampel kurasi cuma buat mode demo
      const video = videoRef.current;
      // coba dulu tanpa lokasi (geofence server bisa mati). Kalo server minta bukti lokasi, baca sekali lalu ulangi
      const send = async (blob: Blob) => {
        const fresh = userPosition && Date.now() - userPosition.at < 20000 ? userPosition : null;
        try {
          return await api.verifyLensImage(spotId, blob, fresh ? { lat: fresh.lat, lng: fresh.lng, accuracyMeters: fresh.accuracy } : undefined);
        } catch (err) {
          if (!(err instanceof ApiError) || err.code !== "LOCATION_REQUIRED") throw err;
          const fix = await getFix();
          return await api.verifyLensImage(spotId, blob, { lat: fix.lat, lng: fix.lng, accuracyMeters: fix.accuracy });
        }
      };
      if (cameraActive && video && video.videoWidth > 0) {
        data = await send(await shrinkToJpeg(video));
      } else if (cameraActive) {
        setScanError("Kamera masih menyiapkan gambar. Tunggu sebentar lalu tekan Pindai lagi.");
        return;
      } else if (uploadedFile) {
        data = await send(await fileToJpeg(uploadedFile));
      } else if (DEMO_MODE) {
        data = await api.verifyLens({ sampleId: currentSample.id, spotId });
      } else {
        setScanError("Ambil foto dengan kamera atau pilih dari galeri dulu.");
        return;
      }
      // objek gak dikenali: tanpa kartu, voucer, atau XP
      if (!data.isVerified) {
        setScanError(data.message || "Objek belum dikenali. Coba foto lebih dekat, terang, dan fokus ke satu objek.");
        return;
      }
      setScanResult(data);

      const newLore: UnlockedLoreCard = {
        id: `lore-${Date.now().toString(36)}`,
        spotId,
        objectName: data.detectedObjectName,
        opkCategory: data.opkReference,
        verifiedSource: data.verifiedSource,
        story: data.culturalStory,
        unlockedAt: "Baru saja dibuka",
        confidenceScore: data.confidenceScore,
      };

      onScanVerified(data, newLore, data.issuedVoucher);
    } catch (err) {
      if (err instanceof LocationError) {
        setScanError(err.reason === "declined" ? "Memindai di titik ini butuh lokasimu untuk memastikan kamu ada di sana. Izinkan lokasi lalu coba lagi." : err.message);
      } else if (err instanceof ApiError && err.code === "OUT_OF_RANGE") {
        const d = Number(err.details?.distanceMeters);
        const r = Number(err.details?.radiusMeters) || 100;
        setScanError(
          Number.isFinite(d)
            ? `Kamu sekitar ${formatDistance(d)} dari ${activeSpot?.name ?? "titik ini"}. Dekati sampai kurang dari ${r} m untuk memindai objeknya.`
            : "Kamu belum cukup dekat dengan titik ini untuk memindai."
        );
      } else if (err instanceof ApiError && err.code === "LOCATION_TOO_INACCURATE") {
        setScanError("Sinyal GPS kurang tepat. Pindah ke area terbuka lalu coba lagi.");
      } else {
        setScanError(describeError(err, err instanceof Error ? err.message : "Terjadi kesalahan saat memindai objek budaya."));
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveToBag = () => {
    const el = voucherRef.current;
    const target = document.querySelector<HTMLElement>('[data-nav-id="WALLET"]');
    if (!el || !target) {
      onClose();
      return;
    }
    const a = el.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    setFlight({
      x: t.left + t.width / 2 - (a.left + a.width / 2),
      y: t.top + t.height / 2 - (a.top + a.height / 2),
    });
    window.setTimeout(onClose, 700);
  };

  // apa yg harus dicari wisatawan: objek dari mitra/pengelola + foto contohnya
  const targetText =
    activeSpot && activeSpot.quest.targetObjectPrompt.trim() && activeSpot.quest.targetObjectPrompt !== DEFAULT_TARGET
      ? activeSpot.quest.targetObjectPrompt
      : "objek khas di lokasi ini";
  const refs = activeSpot?.quest.referenceImages ?? [];
  const hasSource = cameraActive || !!uploadedFile || DEMO_MODE;

  const reticleColor = scanResult
    ? "var(--quota-safe)"
    : isScanning
    ? "var(--vibe-accent)"
    : "var(--vibe-on-primary)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lens-scanner-title"
      className="fixed inset-0 z-50 bg-alabaster/60 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <MotionConfig reducedMotion={reducedMotion}>
      <div className="gamiz-card w-full max-w-2xl my-auto p-5 sm:p-6 space-y-5">
        {/* Clean Gamiz Modal Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-vibePrimary">
              {activeSpot ? activeSpot.name.split("&")[0].trim() : "Pemindai objek"}
            </span>
            <h2
              id="lens-scanner-title"
              className="text-lg sm:text-xl font-extrabold text-alabaster"
            >
              Pindai objek, dapat hadiah
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Pemindai Kamera (Escape)"
            className="btn-tactile-secondary min-h-[44px] px-3.5 py-1.5 text-xs flex items-center gap-1.5"
          >
            <Icon name="close" size={16} weight="bold" />
            <span>Tutup</span>
          </button>
        </div>

        {/* bidik AR: lensa gelap biar retikel & laser terabca jelas (kontras tinggi) */}
        <div className="relative w-full h-64 rounded-3xl bg-alabaster overflow-hidden text-[var(--vibe-on-primary)]">
          {!cameraActive && previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Foto yang akan dipindai" className="absolute inset-0 w-full h-full object-cover opacity-90" />
          )}
          {cameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
          ) : null}

          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, var(--vibe-surface-tint) 0%, transparent 68%)",
            }}
          />

          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 text-[11px] font-extrabold">
            <span className="px-2.5 py-1 rounded-full bg-[rgba(255,248,236,0.14)] truncate">
              {DEMO_MODE ? currentSample.opkCategory : activeSpot?.opkCategory ?? "Objek budaya"}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-[rgba(255,248,236,0.14)] shrink-0">
              {cameraActive ? "Kamera aktif" : uploadedFile ? "Foto dipilih" : DEMO_MODE ? "Mode sampel" : "Belum ada foto"}
            </span>
          </div>

          {!scanResult && !isScanning && !previewUrl && (
            <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center opacity-25">
              <Icon name="scan" size={72} weight="duotone" />
            </div>
          )}

          <motion.svg
            key={`${selectedSampleId}-${scanResult ? "ok" : "idle"}`}
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-x-8 top-14 bottom-[72px] w-[calc(100%-4rem)] h-[calc(100%-8.5rem)]"
            fill="none"
            stroke={reticleColor}
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ scale: 1.3, opacity: 0 }}
            animate={isScanning ? { scale: [1, 1.04, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
            transition={
              isScanning
                ? { repeat: Infinity, duration: 1.1, ease: "easeInOut" }
                : { type: "spring", stiffness: 320, damping: 16 }
            }
          >
            <path d="M0 16V6a6 6 0 0 1 6-6h10" vectorEffect="non-scaling-stroke" />
            <path d="M84 0h10a6 6 0 0 1 6 6v10" vectorEffect="non-scaling-stroke" />
            <path d="M0 84v10a6 6 0 0 0 6 6h10" vectorEffect="non-scaling-stroke" />
            <path d="M100 84v10a6 6 0 0 1-6 6H84" vectorEffect="non-scaling-stroke" />
          </motion.svg>

          {isScanning && (
            <div
              aria-hidden="true"
              className="absolute left-10 right-10 h-0.5 bg-[var(--vibe-accent)] animate-scanline pointer-events-none"
              style={{ boxShadow: "0 0 14px var(--vibe-accent)" }}
            />
          )}

          <div className="absolute inset-x-0 bottom-0 px-4 pb-3 pt-8 bg-gradient-to-t from-alabaster to-transparent">
            {DEMO_MODE ? (
              <>
                <p className="text-sm font-extrabold leading-snug">{currentSample.objectName}</p>
                <p className="text-[11px] opacity-80 mt-0.5 line-clamp-2">{currentSample.visualClue}</p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-bold opacity-80">Cari dan foto:</p>
                <p className="text-sm font-extrabold leading-snug">{targetText}</p>
              </>
            )}
          </div>
        </div>
        <p aria-live="polite" className="text-[11px] text-pebble -mt-2">{cameraNotice}</p>

        {!DEMO_MODE && (
          <div className="rounded-2xl bg-obsidian p-4 space-y-3">
            <p className="text-xs font-extrabold text-alabaster">Cara memindai</p>
            <ol className="space-y-1.5 text-xs text-pebble leading-snug list-decimal pl-5">
              <li>Temukan <b className="text-alabaster">{targetText}</b> di lokasi.{activeSpot?.quest.riddleClue ? <> Petunjuk: {activeSpot.quest.riddleClue}</> : null}</li>
              <li>Tekan Buka Kamera atau Unggah Foto, lalu bidik satu objek itu dari dekat di tempat terang.</li>
              <li>Tekan Pindai. Kalau cocok, kamu dapat kartu kisah, XP, dan voucer.</li>
            </ol>
            {refs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-pebble">Contoh objek yang dicari</p>
                <ul className="flex gap-2 overflow-x-auto scroll-hide">
                  {refs.map((img, i) => (
                    <li key={img.id} className="list-none shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-stoneSubtle">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${API_BASE}${img.url}`} alt={`Contoh objek ${i + 1}`} className="w-full h-full object-cover" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Sample Pills & Camera Switch */}
        <div className="bg-obsidian rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-pebble">
              {DEMO_MODE ? "Pilih Sampel Objek (Uji Tanpa Kamera):" : "Ambil foto objeknya:"}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartCamera}
                className="min-h-[44px] px-3 py-1.5 rounded-xl bg-basalt hover:bg-slateElev text-alabaster text-xs font-semibold flex items-center gap-1.5"
              >
                <Icon name="camera" size={16} className="text-vibePrimary" motion="pop" />
                <span>{cameraActive ? "Matikan Kamera" : "Buka Kamera"}</span>
              </button>

              <label className="min-h-[44px] px-3 py-1.5 rounded-xl bg-basalt hover:bg-slateElev text-alabaster text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                <Icon name="upload" size={14} weight="bold" className="text-vibeSecondary" />
                <span>Unggah Foto</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {uploadedFile && (
            <p className="text-[11px] text-pebble flex items-center gap-2">
              <span className="truncate">Foto: {uploadedFile.name}</span>
              <button type="button" onClick={() => { setUploadedFile(null); setCameraNotice("Foto dilepas."); }} className="min-h-[44px] px-2 font-extrabold text-vibePrimary underline underline-offset-2 shrink-0">
                Lepas
              </button>
            </p>
          )}

          {DEMO_MODE && (
          <div className="flex flex-wrap gap-1.5">
            {CULTURAL_OBJECT_SAMPLES.map((sample) => {
              const isSelected = sample.id === selectedSampleId;
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => {
                    setSelectedSampleId(sample.id);
                    setScanResult(null);
                  }}
                  aria-pressed={isSelected}
                  className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-vibePrimary text-[var(--vibe-on-primary)]"
                      : "bg-basalt text-pebble hover:text-alabaster"
                  }`}
                >
                  {sample.label}
                </button>
              );
            })}
          </div>
          )}
        </div>

        {/* Primary Tactile Scan CTA */}
        <button
          type="button"
          disabled={isScanning || !hasSource}
          aria-describedby={!hasSource ? "scan-need-photo" : undefined}
          onClick={handleExecuteScan}
          className="btn-tactile-primary w-full min-h-[52px] px-6 py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isScanning ? (
            <>
              <Icon name="loader" size={20} weight="bold" motion="spin" />
              <span>Memverifikasi Objek Budaya...</span>
            </>
          ) : (
            <>
              <Icon name="scan" size={20} motion="pop" />
              <span>{DEMO_MODE ? "Pindai & Klaim Hadiah Sekarang" : "Pindai sekarang"}</span>
            </>
          )}
        </button>
        {!hasSource && (
          <p id="scan-need-photo" className="text-[11px] text-pebble text-center -mt-3">Ambil foto dulu supaya tombol Pindai aktif.</p>
        )}

        {scanError && (
          <div role="alert" className="p-4 rounded-2xl bg-obsidian border border-quotaFull text-xs text-alabaster">
            {scanError}
          </div>
        )}

        {/* rantai hadiah: Lore Card muncul, voucer trsobek dr bawahnya, lalu terbang ke tab Tas */}
        {scanResult && (
          <motion.div
            ref={resultRef}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="rounded-3xl bg-slateElev"
          >
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 12, delay: 0.25 }}
                    className="inline-flex"
                  >
                    <Loka variant="mark" size={40} mood="cheer" motion="hop" />
                  </motion.span>
                  <div>
                    <span className="text-xs font-bold text-quotaSafe block">
                      Kartu Koleksi Terbuka ({Math.round(scanResult.confidenceScore * 100)}% Akurat)
                    </span>
                    <h3 className="text-base font-extrabold text-alabaster">
                      {scanResult.detectedObjectName}
                    </h3>
                  </div>
                </div>
                {scanResult.awardedPoints > 0 && (
                  <span className="font-num text-xs font-extrabold px-3 py-1.5 rounded-full bg-obsidian text-vibeSecondary">
                    +{scanResult.awardedPoints} XP
                  </span>
                )}
              </div>

              <div className="bg-obsidian rounded-2xl p-4">
                <p className="font-serif text-sm text-alabaster leading-relaxed">
                  {scanResult.culturalStory}
                </p>
                <p className="text-[11px] text-pebble mt-2">
                  Sumber: {scanResult.verifiedSource}
                </p>
              </div>
            </div>

            {/* kenapa gak ada voucer: tamu (perlu akun) atau udah ambil hari ini */}
            {!scanResult.issuedVoucher && scanResult.rewardNote && (
              <div className="rounded-2xl bg-obsidian p-4 space-y-2.5">
                <p className="text-sm text-alabaster leading-relaxed">
                  {scanResult.rewardNote === "LOGIN_FOR_REWARD"
                    ? "Kisahnya sudah tersimpan di perangkat ini. Masuk atau daftar untuk mendapat XP dan voucer belanja dari lapak ini."
                    : "Kamu sudah mengambil voucer dan XP di titik ini hari ini. Kisahnya tetap bisa dibaca kapan saja. Datang lagi besok untuk hadiah berikutnya."}
                </p>
                {scanResult.rewardNote === "LOGIN_FOR_REWARD" && (
                  <Link href="/masuk" className="btn-tactile-secondary min-h-[44px] px-4 text-xs inline-flex items-center gap-1.5">
                    <Icon name="user" size={16} />
                    <span>Masuk atau daftar</span>
                  </Link>
                )}
              </div>
            )}

            {scanResult.issuedVoucher && (
              <>
                <div
                  aria-hidden="true"
                  className="mx-5 border-t-2 border-dotted border-[var(--border-stone-strong)]"
                />
                <motion.div
                  ref={voucherRef}
                  initial={{ opacity: 0, y: -14, rotate: -3 }}
                  animate={
                    flight
                      ? { x: flight.x, y: flight.y, scale: 0.18, rotate: 14, opacity: 0.25 }
                      : { opacity: 1, y: 0, rotate: 0, x: 0, scale: 1 }
                  }
                  transition={
                    flight
                      ? { duration: 0.65, ease: [0.5, 0, 0.75, 0] }
                      : { type: "spring", stiffness: 240, damping: 14, delay: 0.7 }
                  }
                  className="relative z-10 perforated-ticket m-4 mt-4 p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-vibePrimary">
                      <Icon name="voucher" size={18} className="text-vibePrimary" />
                      <span>Voucer UMKM Berhasil Diklaim</span>
                    </div>
                    <p className="text-sm font-extrabold text-alabaster mt-0.5">
                      {scanResult.issuedVoucher.merchantName}
                    </p>
                    <p className="text-xs text-pebble">
                      {scanResult.issuedVoucher.discountTitle}
                    </p>
                  </div>

                  <div className="bg-obsidian px-4 py-2.5 rounded-2xl text-right">
                    <span className="font-num text-sm font-extrabold text-vibeSecondary block">
                      {scanResult.issuedVoucher.code}
                    </span>
                    <span className="font-num text-xs font-bold text-quotaSafe">
                      Diskon Rp
                      {scanResult.issuedVoucher.discountAmount.toLocaleString("id-ID")}
                    </span>
                  </div>
                </motion.div>
              </>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 px-5 pb-5">
              {scanResult.issuedVoucher && (
                <p className="text-[11px] text-pebble mr-auto max-w-[16rem]">
                  Tunjukkan kode voucer ini ke kasir lapak untuk ditukar.
                </p>
              )}
              <button
                type="button"
                onClick={handleSaveToBag}
                disabled={!!flight}
                className="btn-tactile-primary min-h-[44px] px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-70"
              >
                <Icon name="bag" size={18} />
                <span>{scanResult.issuedVoucher ? "Simpan ke Tas" : "Selesai"}</span>
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </MotionConfig>
    </div>
  );
}
