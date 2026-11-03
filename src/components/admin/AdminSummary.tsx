"use client";

import React from "react";
import Icon, { IconName } from "@/components/ui/Icon";

export type AdminTab = "APPROVAL" | "SPOTS" | "QUOTA" | "REWARDS" | "KNOWLEDGE";

interface Card {
  label: string;
  value: number;
  hint: string;
  icon: IconName;
  go: AdminTab;
  attention?: boolean;
}

// ringkasan di atas: yg butuh perhatian pengelola kelihatan dulu, tiap kartu bisa diketuk
export default function AdminSummary({ cards, onGo }: { cards: Card[]; onGo: (t: AdminTab) => void }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onGo(c.go)}
          className={`gamiz-card p-4 text-left space-y-1 min-h-[88px] ${c.attention && c.value > 0 ? "border-2 border-quotaWarning" : ""}`}
        >
          <span className="text-xs font-bold text-pebble flex items-center gap-1.5">
            <Icon name={c.icon} size={14} className="text-vibePrimary" />
            {c.label}
          </span>
          <span className={`font-num text-2xl font-extrabold block ${c.attention && c.value > 0 ? "text-quotaWarning" : "text-alabaster"}`}>{c.value}</span>
          <span className="text-[11px] text-pebble block leading-snug">{c.hint}</span>
        </button>
      ))}
    </div>
  );
}
