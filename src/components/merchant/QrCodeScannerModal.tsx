"use client";

import React, { useEffect, useRef, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import Icon from "@/components/ui/Icon";

interface BarcodeResult {
  rawValue?: string;
}

interface BarcodeDetectorInstance {
  detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
}

interface QrCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export default function QrCodeScannerModal({ isOpen, onClose, onDetected }: QrCodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setCameraReady(false);

    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector) {
      setError("Peramban ini belum mendukung pemindaian QR otomatis lewat kamera. Gunakan kolom ketik kode di layar kasir.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Kamera tidak tersedia di perangkat ini.");
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let timerId: number | null = null;
    const detector = new Detector({ formats: ["qr_code"] });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          if (videoRef.current.readyState >= 2) {
            try {
              const hits = await detector.detect(videoRef.current);
              const hit = hits.find((h) => h.rawValue && h.rawValue.trim().length > 0);
              if (hit?.rawValue) {
                onDetected(hit.rawValue.trim());
                onClose();
                return;
              }
            } catch {
              // Abaikan frame yang gagal didekode
            }
          }
          if (!cancelled) timerId = window.setTimeout(tick, 250);
        };
        timerId = window.setTimeout(tick, 350);
      })
      .catch(() => {
        if (!cancelled) setError("Izin kamera ditolak atau kamera sedang dipakai aplikasi lain.");
      });

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [isOpen, onClose, onDetected]);

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 id="qr-scanner-title" className="text-lg font-extrabold text-alabaster">
          Pindai QR Pengunjung
        </h2>
        <p className="text-xs text-pebble mt-0.5">Arahkan kamera ke kode QR voucer LKW- atau bukti hadir KDR-.</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup Pemindai QR"
        className="btn-tactile-secondary min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <Icon name="close" size={18} weight="bold" />
      </button>
    </div>
  );

  return (
    <Sheet isOpen={isOpen} onClose={onClose} titleId="qr-scanner-title" header={header} maxWidthClass="sm:max-w-lg">
      <div className="space-y-4 pt-1">
        {error ? (
          <div role="alert" className="rounded-2xl bg-obsidian p-4 flex items-start gap-3">
            <Icon name="alert" size={22} className="text-quotaFull shrink-0 mt-0.5" />
            <p className="text-sm text-alabaster leading-relaxed">{error}</p>
          </div>
        ) : (
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-alabaster">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-[var(--vibe-accent)]"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-obsidian/80 text-sm font-bold text-alabaster">
                Menyalakan kamera...
              </div>
            )}
          </div>
        )}
        <button type="button" onClick={onClose} className="btn-tactile-secondary w-full min-h-[48px] text-sm">
          Tutup &amp; ketik manual
        </button>
      </div>
    </Sheet>
  );
}
