import type { StyleSpecification } from "maplibre-gl";

// gaya dasar: OpenFreeMap (data OpenStreetMap, tanpa kunci API). Bisa diganti ke penyedia/self-host lewat env
const BASE_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/liberty";

// warna lontar (WebGL gak bisa baca var CSS, jadi disalin di sini)
const C = {
  land: "#F4ECD6",
  block: "#EADFC2",
  park: "#D3E3BB",
  water: "#B9DADC",
  waterDeep: "#A3CDD1",
  road: "#FFFAEE",
  roadEdge: "#DFD0AB",
  minor: "#F9F1DD",
  text: "#574E63",
  halo: "#FFFAEE",
};

type AnyLayer = { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> };

let cached: Promise<StyleSpecification> | null = null;

export function loadLontarStyle(): Promise<StyleSpecification> {
  if (!cached) {
    cached = fetch(BASE_STYLE_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`style ${r.status}`);
        return r.json() as Promise<StyleSpecification>;
      })
      .then(recolor)
      .catch((e) => {
        cached = null;
        throw e;
      });
  }
  return cached;
}

function recolor(style: StyleSpecification): StyleSpecification {
  for (const layer of style.layers as unknown as AnyLayer[]) {
    const id = layer.id;
    const paint = (layer.paint ??= {});
    if (layer.type === "background") paint["background-color"] = C.land;
    else if (layer.type === "raster") paint["raster-opacity"] = 0;
    else if (layer.type === "fill") {
      delete paint["fill-pattern"];
      if (/water/.test(id)) paint["fill-color"] = C.water;
      else if (/park|wood|forest|grass|landcover|meadow|garden|farm|scrub|cemetery|pitch/.test(id)) paint["fill-color"] = C.park;
      else if (/building/.test(id)) {
        paint["fill-color"] = C.block;
        paint["fill-outline-color"] = C.roadEdge;
      } else if (/landuse|residential|industrial|commercial|retail|school|hospital/.test(id)) paint["fill-color"] = C.block;
    } else if (layer.type === "fill-extrusion") {
      paint["fill-extrusion-color"] = C.block;
    } else if (layer.type === "line") {
      if (/waterway|water/.test(id)) paint["line-color"] = C.waterDeep;
      else if (/casing|bridge_.*_casing|tunnel_.*_casing/.test(id)) paint["line-color"] = C.roadEdge;
      else if (/road|street|motorway|trunk|primary|secondary|tertiary|minor|service|path|track|bridge|tunnel|link/.test(id)) {
        paint["line-color"] = /path|track|footway|pedestrian/.test(id) ? C.roadEdge : C.road;
      } else if (/boundary/.test(id)) paint["line-color"] = C.roadEdge;
    } else if (layer.type === "symbol") {
      paint["text-color"] = C.text;
      paint["text-halo-color"] = C.halo;
      paint["text-halo-width"] = 1.4;
    }
  }
  return style;
}
