// paginasi sederhana utk server contoh: cursor = offset yg dibungkus base64 (buram buat klien, gak boleh dianggap angka)
export function pageOf<T>(items: T[], limitParam: string | null, cursorParam: string | null) {
  const limit = Math.max(1, Math.min(100, Number(limitParam) || 20));
  let offset = 0;
  if (cursorParam) {
    const n = Number(Buffer.from(cursorParam, "base64url").toString());
    if (Number.isInteger(n) && n >= 0) offset = n;
  }
  const slice = items.slice(offset, offset + limit);
  const end = offset + slice.length;
  return { slice, nextCursor: end < items.length ? Buffer.from(String(end)).toString("base64url") : undefined };
}
