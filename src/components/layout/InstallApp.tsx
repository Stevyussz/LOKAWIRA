"use client";

import React from "react";
import Icon from "@/components/ui/Icon";
import { promptInstall, useInstallState } from "@/lib/pwa";

// baris "Pasang aplikasi" di Akun: Android/Chrome lewat tombol, iPhone dikasih langkah manual
export default function InstallApp() {
  const state = useInstallState();
  if (state === "installed" || state === "none") return null;
  return (
    <div className="rounded-2xl bg-slateElev p-3.5 flex items-center justify-between gap-3">
      <p className="text-xs text-alabaster leading-snug">
        <b>Pasang LOKAWIRA di layar utama.</b>{" "}
        {state === "ios" ? "Di Safari, ketuk tombol Bagikan lalu pilih “Tambah ke Layar Utama”." : "Buka lebih cepat, layar penuh seperti aplikasi."}
      </p>
      {state === "prompt" && (
        <button type="button" onClick={() => void promptInstall()} className="btn-tactile-primary min-h-[44px] px-3.5 text-xs shrink-0 inline-flex items-center gap-1.5">
          <Icon name="download" size={16} />
          <span>Pasang</span>
        </button>
      )}
    </div>
  );
}
