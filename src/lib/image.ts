// kecilin gambar ke sisi terpanjang 1280 px (JPEG) sebelum dikirim ke server - hemat kuota & di bawah batas 5 MB
export const MAX_SIDE = 1280;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Drawable = HTMLVideoElement | ImageBitmap;

function sizeOf(src: Drawable): { w: number; h: number } {
  return src instanceof HTMLVideoElement ? { w: src.videoWidth, h: src.videoHeight } : { w: src.width, h: src.height };
}

export async function shrinkToJpeg(src: Drawable, quality = 0.85): Promise<Blob> {
  const { w, h } = sizeOf(src);
  if (!w || !h) throw new Error("Gambar belum siap. Coba lagi sebentar.");
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Peramban tidak bisa memproses gambar.");
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gambar gagal diproses."))), "image/jpeg", quality)
  );
}

// HP lemah kadang macet pas ngolah gambar besar: kasih batas waktu biar tombol gak muter selamanya
function withTimeout<T>(p: Promise<T>, ms = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Foto terlalu lama diproses. Coba foto yang lebih kecil atau ulangi.")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export async function fileToJpeg(file: File): Promise<Blob> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error("Format foto harus JPEG, PNG, atau WebP.");
  const bmp = await withTimeout(createImageBitmap(file));
  try {
    return await withTimeout(shrinkToJpeg(bmp));
  } finally {
    bmp.close();
  }
}
