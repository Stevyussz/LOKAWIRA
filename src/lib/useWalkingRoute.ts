"use client";

import { useEffect, useRef, useState } from "react";
import { distanceMeters, LatLng } from "@/lib/geo";
import { fetchWalkingRoute, WalkingRoute } from "@/lib/route";

// rute jalan kaki dr posisi ke tujuan. Dihitung ulang kalo tujuan ganti atau user bergeser > 40 m dr titik hitung terakhir
export function useWalkingRoute(from: LatLng | null, target: { id: string; coordinates: LatLng } | null) {
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const last = useRef<{ id: string; from: LatLng } | null>(null);
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
    if (prev && prev.id === target.id && distanceMeters(prev.from, from) < 40) return;
    last.current = { id: target.id, from: { lat: from.lat, lng: from.lng } };
    const t = ++token.current;
    setLoading(true);
    fetchWalkingRoute(from, target.coordinates).then((r) => {
      if (t !== token.current) return;
      setRoute(r);
      setLoading(false);
    });
  }, [from, target]);

  return { route, loading };
}
