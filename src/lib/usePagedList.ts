"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeError } from "@/lib/api";

interface Page<T> {
  items: T[];
  nextCursor?: string;
}

// daftar berhalaman dgn kursor: muat awal, "muat lebih banyak", dan muat ulang saat filter berubah
export function usePagedList<T>(fetchPage: (cursor?: string) => Promise<Page<T>>, deps: unknown[]) {
  const [items, setItems] = useState<T[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // nomor permintaan: jawaban lama (filter sudah ganti) dibuang
  const seq = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(async (cursor?: string) => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchRef.current(cursor);
      if (mine !== seq.current) return;
      setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
      setNext(page.nextCursor);
    } catch (err) {
      if (mine !== seq.current) return;
      setError(describeError(err, "Daftar gagal dimuat."));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setItems([]);
    setNext(undefined);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { items, setItems, hasMore: !!next, loading, error, loadMore: () => next && load(next), reload: () => load() };
}
