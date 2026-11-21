"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrCodeSvgProps {
  value: string;
  size?: number;
  label?: string;
  className?: string;
}

// Render QR code nyata memakai `qrcode` (SVG matrix dalam warna tinta & kertas lontar, tanpa #000000/#FFFFFF)
export default function QrCodeSvg({ value, size = 112, label, className = "" }: QrCodeSvgProps) {
  const [svgMarkup, setSvgMarkup] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, {
      type: "svg",
      margin: 1,
      width: size,
      errorCorrectionLevel: "M",
      color: {
        dark: "#2A2433",
        light: "#FFFAEE",
      },
    })
      .then((raw) => {
        if (!cancelled) setSvgMarkup(raw);
      })
      .catch(() => {
        if (!cancelled) setSvgMarkup("");
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!svgMarkup) {
    return (
      <div
        role="img"
        aria-label={label ?? `Kode QR ${value}`}
        style={{ width: size, height: size }}
        className={`rounded-lg bg-[#FFFAEE] border border-stoneSubtle flex items-center justify-center text-[10px] font-num font-bold text-[#2A2433] ${className}`}
      >
        {value.slice(-6)}
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={label ?? `Kode QR ${value}`}
      style={{ width: size, height: size }}
      className={`rounded-lg overflow-hidden bg-[#FFFAEE] p-1 border border-stoneSubtle shrink-0 [&>svg]:w-full [&>svg]:h-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}
