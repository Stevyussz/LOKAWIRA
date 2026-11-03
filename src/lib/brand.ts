// gambar latar halaman masuk/daftar. Taruh file di folder public (mis. public/auth-bg.jpg) lalu isi
// NEXT_PUBLIC_AUTH_BG=/auth-bg.jpg di env. Kosong = latar lontar polos (tanpa gambar)
export const AUTH_BG: string | null = process.env.NEXT_PUBLIC_AUTH_BG || null;
