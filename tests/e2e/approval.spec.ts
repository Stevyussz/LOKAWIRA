import { test, expect } from "@playwright/test";
import { apiLogin, bearer, uniq } from "./helpers";

test("alur persetujuan mitra dan review titik (API)", async ({ request }) => {
  const admin = await apiLogin(request, "admin@lokawira.demo");
  const email = `${uniq("mitra")}@uji.id`;

  const reg = await request.post("/api/auth/register", { data: { name: "Mitra Uji", email, password: "rahasia123", role: "MERCHANT" } });
  const { token, user } = await reg.json();
  expect(user.status).toBe("PENDING");

  // belum disetujui: tidak boleh menambah titik
  const base = (await (await request.get("/api/spots")).json()).spots[0];
  const draft = { ...base, name: "Lapak Uji Review", spotType: "UMKM_KRIYA", coordinates: { lat: base.coordinates.lat + 0.001, lng: base.coordinates.lng + 0.001 } };
  const blocked = await request.post("/api/spots", { headers: bearer(token), data: { action: "ADD_SPOT", spot: draft } });
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).code).toBe("ACCOUNT_NOT_APPROVED");

  // mitra tidak boleh membuka endpoint pengelola
  expect((await request.get("/api/admin/merchants", { headers: bearer(token) })).status()).toBe(403);

  const approve = await request.post(`/api/admin/merchants/${user.id}/approve`, { headers: bearer(admin), data: {} });
  expect((await approve.json()).merchant.status).toBe("ACTIVE");

  const added = await request.post("/api/spots", { headers: bearer(token), data: { action: "ADD_SPOT", spot: draft } });
  const spot = (await added.json()).spot;
  expect(spot.status).toBe("PENDING_REVIEW");
  const publicIds = (await (await request.get("/api/spots")).json()).spots.map((s: { id: string }) => s.id);
  expect(publicIds).not.toContain(spot.id);

  const reject = await request.post(`/api/admin/spots/${spot.id}/review`, { headers: bearer(admin), data: { decision: "REJECT", reason: "Pin tidak sesuai" } });
  expect((await reject.json()).spot.statusReason).toBe("Pin tidak sesuai");

  const publish = await request.post(`/api/admin/spots/${spot.id}/review`, { headers: bearer(admin), data: { decision: "PUBLISH" } });
  expect((await publish.json()).spot.status).toBe("PUBLISHED");
  const after = (await (await request.get("/api/spots")).json()).spots.map((s: { id: string }) => s.id);
  expect(after).toContain(spot.id);

  // mitra tidak boleh me-review titiknya sendiri
  expect((await request.post(`/api/admin/spots/${spot.id}/review`, { headers: bearer(token), data: { decision: "PUBLISH" } })).status()).toBe(403);

  // edit nama oleh mitra mengembalikan titik ke antrean review, lalu arsipkan
  const patch = await request.patch(`/api/spots/${spot.id}`, { headers: bearer(token), data: { name: "Lapak Uji Diganti" } });
  expect((await patch.json()).spot.status).toBe("PENDING_REVIEW");
  const del = await request.delete(`/api/spots/${spot.id}`, { headers: bearer(token) });
  expect(del.ok()).toBeTruthy();
});
