"use client";

import Loka from "@/components/brand/Loka";
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useVibeHex } from "@/lib/vibeColors";
import Icon from "@/components/ui/Icon";
import { api, describeError } from "@/lib/api";
import { CulturalSpot } from "@/types/lokawira";
import type { LokaMode } from "@/types/api";
import { suggestQuestions } from "@/lib/loka";
import { useReducedMotionConfig } from "@/lib/motionPref";

// satu tanya-jawab di percakapan dgn Loka
interface Turn {
  q: string;
  a: string;
  mode: LokaMode;
  refs: string[];
  answered: boolean;
}

interface StoryTellerDockProps {
  selectedSpot: CulturalSpot | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenScanner: () => void;
  onSelectNearbyUmkm: () => void;
}

export default function StoryTellerDock({
  selectedSpot,
  isExpanded,
  onToggleExpand,
  onOpenScanner,
  onSelectNearbyUmkm,
}: StoryTellerDockProps) {
  const reducedMotion = useReducedMotionConfig();
  const vh = useVibeHex();
  const [narrative, setNarrative] = useState<string>("");
  const [displayedText, setDisplayedText] = useState<string>("");
  const [showRiddle, setShowRiddle] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [customQuery, setCustomQuery] = useState<string>("");
  const [showAskInput, setShowAskInput] = useState<boolean>(false);
  const [askError, setAskError] = useState<string | null>(null);
  // percakapan di titik ini (hilang kalo pindah titik) & saran pertanyaan berikutnya
  const [turns, setTurns] = useState<Turn[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const lastRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (!selectedSpot) return;
    setNarrative(selectedSpot.quest.loreNarrative);
    setTurns([]);
    setFollowUps(suggestQuestions(selectedSpot));
    setAskError(null);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [selectedSpot]);

  useEffect(() => {
    if (!narrative) {
      setDisplayedText("");
      return;
    }
    let idx = 0;
    setDisplayedText("");
    const timer = setInterval(() => {
      idx += 6;
      if (idx >= narrative.length) {
        setDisplayedText(narrative);
        clearInterval(timer);
      } else {
        setDisplayedText(narrative.slice(0, idx));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [narrative]);

  useEffect(() => {
    if (turns.length) lastRef.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion === "always" ? "auto" : "smooth" });
  }, [turns.length, reducedMotion]);

  if (!selectedSpot) return null;

  const handleToggleTts = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSpeaking((prev) => !prev);
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    // jawaban terakhir kalo lagi ngobrol, selain itu kisah + petunjuk misi
    const last = turns[turns.length - 1];
    const utterance = new SpeechSynthesisUtterance(last ? last.a : `${selectedSpot.name}. ${narrative}. Petunjuk misi: ${selectedSpot.quest.riddleClue}`);
    utterance.lang = "id-ID";
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || isLoadingAi) return;
    setIsLoadingAi(true);
    setAskError(null);
    try {
      const data = await api.askStoryteller({
        spotId: selectedSpot.id,
        customQuestion: q,
        history: turns.slice(-3).map((t) => ({ q: t.q, a: t.a })),
      });
      setTurns((prev) => [...prev, { q, a: data.answer ?? data.story, mode: data.sourceMode, refs: data.references ?? [], answered: data.answered !== false }].slice(-8));
      setFollowUps(data.followUps?.length ? data.followUps : []);
      setCustomQuery("");
    } catch (err) {
      setAskError(describeError(err, "Loka belum bisa dihubungi. Periksa koneksi lalu coba lagi."));
    } finally {
      setIsLoadingAi(false);
    }
  };
  const handleAskStoryteller = (e: React.FormEvent) => {
    e.preventDefault();
    ask(customQuery);
  };

  return (
    <MotionConfig reducedMotion={reducedMotion}>
    <AnimatePresence>
    {isExpanded && (
    <motion.aside
      key="story-dock"
      aria-label="Loka, pemandu AI"
      initial={{ opacity: 0, y: -14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      style={{ transformOrigin: "top left" }}
      className="fixed top-[132px] left-3 sm:left-5 z-20 w-[calc(100vw-1.5rem)] sm:w-[380px] max-h-[calc(100dvh-240px)] overflow-y-auto pointer-events-auto"
    >
      <div
        className="gamiz-card p-4"
      >
        {/* Compact Companion Header (Always Visible) */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            {/* avatar Loka */}
            <div className="w-11 h-11 rounded-2xl bg-slateElev flex items-center justify-center shrink-0">
              <Loka variant="mark" size={34} mood={isLoadingAi ? "think" : "happy"} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-vibePrimary">
                  Loka
                </span>
                <span className="text-[11px] text-pebble truncate">
                  • {selectedSpot.opkCategory}
                </span>
              </div>
              <h2 className="text-sm font-extrabold text-alabaster truncate">
                {selectedSpot.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleTts}
              aria-label={isSpeaking ? "Hentikan Suara" : "Putar Suara Kisah"}
              className={`min-h-[44px] min-w-[44px] rounded-2xl flex items-center justify-center transition-colors ${
                isSpeaking
                  ? "bg-vibePrimary text-[var(--vibe-on-primary)]"
                  : "bg-slateElev text-alabaster hover:bg-pumice"
              }`}
            >
              {isSpeaking ? (
                <span aria-hidden="true" className="flex items-end gap-[3px] h-5">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="audio-bar w-[3px] h-full rounded-full bg-current" style={{ animationDelay: `${i * 120}ms` }} />
                  ))}
                </span>
              ) : (
                <Icon name="speaker" size={20} motion="pop" />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Sembunyikan Cerita" : "Buka Cerita"}
              className="min-h-[44px] min-w-[44px] rounded-2xl bg-slateElev hover:bg-pumice text-alabaster flex items-center justify-center transition-colors"
            >
              {isExpanded ? (
                <Icon name="up" size={16} weight="bold" />
              ) : (
                <Icon name="down" size={16} weight="bold" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded Story & Riddle Content */}
        {isExpanded && (
          <div className="mt-3.5 space-y-3">
            <div className="bg-obsidian/80 rounded-2xl p-3.5">
              <motion.p
                key={narrative}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="font-serif text-xs sm:text-sm text-alabaster leading-relaxed"
              >
                &ldquo;{displayedText}&rdquo;
              </motion.p>

              <p className="mt-2 pt-2 border-t border-stoneSubtle text-[11px] text-pebble flex items-center gap-1.5">
                <Icon name="story" size={16} className="text-vibePrimary" motion="pop" />
                <span className="truncate">{selectedSpot.quest.verifiedLoreSource}</span>
              </p>
            </div>

            <AnimatePresence initial={false}>
              {showRiddle && (
                <motion.div
                  key="riddle"
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  className="overflow-hidden"
                >
              <div className="p-3.5 rounded-2xl bg-slateElev space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-vibeSecondary">
                    {selectedSpot.quest.riddleTitle}
                  </span>
                  <span className="font-num text-[11px] font-bold text-quotaSafe">
                    +Rp{selectedSpot.quest.voucherReward.discountAmount / 1000}rb
                  </span>
                </div>
                <p className="text-xs text-alabaster leading-relaxed">
                  {selectedSpot.quest.riddleClue}
                </p>
                <div className="pt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onOpenScanner}
                    className="btn-tactile-primary min-h-[44px] px-3.5 py-1.5 text-xs"
                  >
                    Scan Objek Sekarang
                  </button>
                  <button
                    type="button"
                    onClick={onSelectNearbyUmkm}
                    className="btn-tactile-secondary min-h-[44px] px-3 py-1.5 text-xs flex items-center gap-1.5"
                  >
                    <Icon name="umkm" size={16} className="text-vibePrimary" motion="pop" />
                    <span>Arahkan ke Mitra UMKM</span>
                  </button>
                </div>
              </div>
                </motion.div>
              )}
            </AnimatePresence>

            {turns.length > 0 && (
              <ol aria-label="Percakapan dengan Loka" aria-live="polite" className="space-y-2.5">
                {turns.map((t, i) => (
                  <li key={i} ref={i === turns.length - 1 ? lastRef : undefined} className="list-none space-y-1.5">
                    <p className="ml-8 rounded-2xl rounded-br-md bg-slateElev px-3 py-2 text-xs text-alabaster">
                      <span className="sr-only">Kamu: </span>
                      {t.q}
                    </p>
                    <div className="mr-4 rounded-2xl rounded-bl-md bg-obsidian/80 px-3 py-2.5 space-y-1.5">
                      <p className="text-xs sm:text-sm text-alabaster leading-relaxed">
                        <span className="sr-only">Loka: </span>
                        {t.a}
                      </p>
                      <p className="text-[11px] text-pebble leading-snug">
                        <span className={`font-extrabold ${t.mode === "AI" ? "text-vibePrimary" : "text-alabaster"}`}>
                          {t.mode === "AI" ? "Dirangkum Loka" : "Dari catatan tersimpan"}
                        </span>
                        {t.refs.length > 0 && <> · {t.refs.join("; ")}</>}
                      </p>
                      {!t.answered && (
                        <p className="text-[11px] text-pebble leading-snug">Pertanyaanmu dicatat untuk pengelola, supaya Loka bisa menjawabnya nanti.</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <AnimatePresence initial={false}>
              {showAskInput && (
                <motion.div
                  key="ask"
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  className="overflow-hidden -mx-1 px-1 pb-1"
                >
                  {followUps.length > 0 && (
                    <ul aria-label="Saran pertanyaan" className="flex flex-wrap gap-1.5 mb-2">
                      {followUps.map((f) => (
                        <li key={f} className="list-none">
                          <button
                            type="button"
                            disabled={isLoadingAi}
                            onClick={() => ask(f)}
                            className="min-h-[36px] px-3 py-1.5 rounded-full border border-stoneStrong bg-basalt text-[11px] font-bold text-alabaster text-left hover:border-vibePrimary disabled:opacity-60"
                          >
                            {f}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form onSubmit={handleAskStoryteller} className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      maxLength={300}
                      value={customQuery}
                      onChange={(e) => setCustomQuery(e.target.value)}
                      aria-label="Pertanyaan untuk Loka"
                      placeholder="Tanya sejarah, jam buka, aturan..."
                      className="flex-1 min-w-0 min-h-[44px] px-3 py-1.5 rounded-xl bg-obsidian border border-stoneStrong text-xs text-alabaster placeholder:text-ashMuted"
                    />
                    <button
                      type="submit"
                      disabled={isLoadingAi}
                      aria-label={isLoadingAi ? "Loka sedang menjawab" : "Kirim pertanyaan"}
                      className="btn-tactile-primary min-h-[44px] min-w-[72px] px-3.5 py-1.5 text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-70"
                    >
                      {isLoadingAi ? (
                        <Icon name="loader" size={16} weight="bold" motion="spin" />
                      ) : (
                        "Kirim"
                      )}
                    </button>
                  </form>
                  {isLoadingAi && (
                    <p role="status" className="mt-2 text-[11px] text-pebble">Loka sedang mencari di catatan…</p>
                  )}
                  {askError && (
                    <p role="alert" className="mt-2 text-xs font-bold text-quotaFull">
                      {askError}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRiddle((prev) => !prev)}
                aria-expanded={showRiddle}
                className="btn-tactile-secondary flex-1 min-h-[44px] px-3 py-1.5 text-xs flex items-center justify-center gap-1.5"
              >
                <Icon name="guide" size={16} className="text-vibePrimary" motion="pop" />
                <span>{showRiddle ? "Tutup Petunjuk" : "Petunjuk Misi"}</span>
                <Icon
                  name="down"
                  size={14}
                  weight="bold"
                  className={`text-pebble transition-transform duration-200 ${showRiddle ? "rotate-180" : ""}`}
                />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAskInput((prev) => !prev);
                  setAskError(null);
                }}
                aria-expanded={showAskInput}
                className="min-h-[44px] px-3 py-1.5 rounded-2xl bg-obsidian/70 hover:bg-slateElev text-pebble hover:text-alabaster text-xs font-bold flex items-center gap-1.5"
              >
                <Icon name="search" size={16} className="text-vibePrimary" motion="pop" />
                <span>Tanya Loka</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.aside>
    )}
    </AnimatePresence>
    </MotionConfig>
  );
}
