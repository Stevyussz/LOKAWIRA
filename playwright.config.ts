import { defineConfig } from "@playwright/test";

// Suite QA end-to-end. Jalankan: npm run test:e2e (otomatis build + start di port 3210).
// NEXT_PUBLIC_DEMO_MODE itu ditanam saat build, jadi build-nya sengaja dibikin ulang di sini dgn env demo.
// Hentikan `npm run dev` dulu: build ini nulis ke folder .next yg sama.
// Server contoh in-memory dipakai bareng semua tes, jadi tes dibikin saling bebas (email unik) dan jalan berurutan.
const PORT = Number(process.env.QA_PORT ?? 3210);
const BASE = process.env.QA_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  // QA_URL diisi = tes ke server yg sudah jalan (mis staging), selain itu jalanin build lokal
  webServer: process.env.QA_URL
    ? undefined
    : {
        command: `npx next build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/api/spots`,
        reuseExistingServer: false,
        timeout: 300_000,
        env: {
          NEXT_PUBLIC_DEMO_MODE: "true",
          GEOFENCE_ENABLED: "true",
          GEOFENCE_RADIUS_METERS: "100",
        },
      },
});
