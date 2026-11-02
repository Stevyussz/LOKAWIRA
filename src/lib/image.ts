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

export async function fileToJpeg(file: File): Promise<Blob> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error("Format foto harus JPEG, PNG, atau WebP.");
  const bmp = await createImageBitmap(file);
  try {
    return await shrinkToJpeg(bmp);
  } finally {
    bmp.close();
  }
}
