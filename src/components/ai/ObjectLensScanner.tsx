"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MotionConfig, motion } from "motion/react";
import Icon from "@/components/ui/Icon";
import { api, describeError } from "@/lib/api";
import {
  CulturalSpot,
  IssuedVoucher,
  LensVerificationResult,
  UnlockedLoreCard,
} from "@/types/lokawira";
import { CULTURAL_OBJECT_SAMPLES } from "@/lib/seedCulturalData";

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
  const [selectedSampleId, setSelectedSampleId] = useState<string>(
    CULTURAL_OBJECT_SAMPLES[0].id
  );
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraNotice, setCameraNotice] = useState<string>(
    "Sampel artefak siap dipindai (Cocok untuk pengujian di laptop maupun ponsel)"
  );
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<LensVerificationResult | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const voucherRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  // jarak terang voucer menuju tab Tas pas user menekan "Simpan ke Tas"
  const [flight, setFlight] = useState<{ x: number; y: number } | null>(null);

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
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
      setCameraNotice("Kamera dimatikan. Menggunakan Sampel Artefak Kurasi.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraNotice("WebRTC tidak tersedia. Mode Sampel Kurasi tetap aktif.");
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
        "Izin kamera tidak tersedia di perangkat ini. Mode Sampel Kurasi aktif."
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      setCameraNotice(`Foto terpilih: ${file.name}`);
    }
  };

  const handleExecuteScan = async () => {
    setIsScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const data: LensVerificationResult = await api.verifyLens({
        sampleId: currentSample.id,
        spotId: activeSpot?.id || currentSample.spotId,
        customImageName: uploadedFileName || undefined,
      });
      setScanResult(data);

      const newLore: UnlockedLoreCard = {
        id: `lore-${Date.now().toString(36)}`,
        spotId: activeSpot?.id || currentSample.spotId,
        objectName: data.detectedObjectName,
        opkCategory: data.opkReference,
        verifiedSource: data.verifiedSource,
        story: data.culturalStory,
        unlockedAt: "Baru saja dibuka",
        confidenceScore: data.confidenceScore,
      };

      onScanVerified(data, newLore, data.issuedVoucher);
    } catch (err) {
      setScanError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memindai objek budaya."
      );
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
      <MotionConfig reducedMotion="user">
      <div className="gamiz-card w-full max-w-2xl my-auto p-5 sm:p-6 space-y-5">
        {/* Clean Gamiz Modal Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-vibePrimary">
              Object Lens AR Scanner
            </span>
            <h2
              id="lens-scanner-title"
              className="text-lg sm:text-xl font-extrabold text-alabaster"
            >
              Pindai Artefak &amp; Buka Hadiah Voucer
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
              {currentSample.opkCategory}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-[rgba(255,248,236,0.14)] shrink-0">
              {cameraActive ? "Kamera aktif" : "Mode sampel"}
            </span>
          </div>

          {!scanResult && !isScanning && (
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
            <p className="text-sm font-extrabold leading-snug">{currentSample.objectName}</p>
            <p className="text-[11px] opacity-80 mt-0.5 line-clamp-2">{currentSample.visualClue}</p>
          </div>
        </div>
        <p aria-live="polite" className="text-[11px] text-pebble -mt-2">{cameraNotice}</p>

        {/* Sample Pills & Camera Switch */}
        <div className="bg-obsidian rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-pebble">
              Pilih Sampel Objek (Uji Tanpa Kamera):
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
        </div>

        {/* Primary Tactile Scan CTA */}
        <button
          type="button"
          disabled={isScanning}
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
              <span>Pindai &amp; Klaim Hadiah Sekarang</span>
            </>
          )}
        </button>

        {scanError && (
          <div className="p-4 rounded-2xl bg-obsidian border border-quotaFull text-xs text-alabaster">
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
                    <Icon name="check" size={28} className="text-quotaSafe" />
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
                <span className="font-num text-xs font-extrabold px-3 py-1.5 rounded-full bg-obsidian text-vibeSecondary">
                  +{scanResult.awardedPoints} XP
                </span>
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
              <Link
                href="/merchant-pos"
                className="btn-tactile-secondary min-h-[44px] px-4 py-2 text-xs flex items-center gap-1.5"
              >
                <span>Tukar di Kasir UMKM</span>
              </Link>
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
