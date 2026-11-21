"use client";

import { useEffect, useRef, useState } from "react";
import { distanceMeters, LatLng } from "@/lib/geo";
import { fetchRoute, TravelMode, WalkingRoute } from "@/lib/route";

// Rute dr posisi ke tujuan. Dihitung ulang jika tujuan ganti, mode transport berubah, atau bergeser > 40 m.
export function useWalkingRoute(
  from: LatLng | null,
  target: { id: string; coordinates: LatLng } | null,
  mode: TravelMode = "foot"
) {
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const last = useRef<{ id: string; from: LatLng; mode: TravelMode } | null>(null);
  const token = useRef(0);

  useEffect(() => {
    if (!from || !target) {
      last.current = null;
      token.current++;
      setRoute(null);
      setLoading(false);
      return;
    }
    const prev = last.current;
    if (prev && prev.id === target.id && prev.mode === mode && distanceMeters(prev.from, from) < 40) return;
    last.current = { id: target.id, from: { lat: from.lat, lng: from.lng }, mode };
    const t = ++token.current;
    setLoading(true);
    fetchRoute(from, target.coordinates, mode).then((r) => {
      if (t !== token.current) return;
      setRoute(r);
      setLoading(false);
    });
  }, [from, target, mode]);

  return { route, loading };
}
