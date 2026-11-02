"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence, MotionConfig, motion, useDragControls } from "motion/react";

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  // id elemen judul di dlm header, utk aria-labelledby
  titleId: string;
  // bagian atas yg gak ikut menggluir (judul, tab)
  header?: React.ReactNode;
  children: React.ReactNode;
  // kelas lebar maksimmum panel di layar lebar
  maxWidthClass?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Lembar bawah besrama (dompet, papan antrean, reservasi)
export default function Sheet({
  isOpen,
  onClose,
  titleId,
  header,
  children,
  maxWidthClass = "sm:max-w-2xl",
}: SheetProps) {
  const controls = useDragControls();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 40);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {isOpen && (
          <div key="sheet" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 bg-alabaster/55"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onPointerDown={onClose}
            />

            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              drag="y"
              dragControls={controls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 700) onClose();
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: "spring", stiffness: 420, damping: 42, mass: 0.9 }}
              className={`relative w-full ${maxWidthClass} max-h-[92dvh] flex flex-col bg-basalt rounded-t-[28px] sm:rounded-[28px] border border-stoneSubtle shadow-[0_-18px_40px_-18px_rgba(74,52,28,0.5)] outline-none`}
            >
              <div
                onPointerDown={(e) => controls.start(e)}
                className="touch-none cursor-grab active:cursor-grabbing pt-3 pb-2 flex justify-center shrink-0"
                aria-hidden="true"
              >
                <span className="w-11 h-1.5 rounded-full bg-[var(--map-road-edge)]" />
              </div>

              {header && <div className="shrink-0 px-5 pb-3">{header}</div>}

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {children}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
