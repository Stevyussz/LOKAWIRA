import type { Map as MLMap, StyleSpecification } from "maplibre-gl";
import { VIBE_MAP_PALETTE, type VibeMapPalette } from "@/lib/spotMeta";
import type { CulturalVibe } from "@/types/lokawira";

// Gaya dasar: OpenFreeMap (data OpenStreetMap, tanpa kunci API). Bisa diganti via NEXT_PUBLIC_MAP_STYLE_URL
const BASE_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/liberty";

type AnyLayer = { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> };

let cachedBase: Promise<StyleSpecification> | null = null;

function fetchBaseStyle(): Promise<StyleSpecification> {
  if (!cachedBase) {
    cachedBase = fetch(BASE_STYLE_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`style ${r.status}`);
        return r.json() as Promise<StyleSpecification>;
      })
      .catch((e) => {
        cachedBase = null;
        throw e;
      });
  }
  return cachedBase;
}

function cloneStyle(s: StyleSpecification): StyleSpecification {
  return typeof structuredClone === "function" ? structuredClone(s) : (JSON.parse(JSON.stringify(s)) as StyleSpecification);
}

function paletteFor(vibe?: CulturalVibe): VibeMapPalette {
  return (vibe ? VIBE_MAP_PALETTE[vibe] : undefined) ?? VIBE_MAP_PALETTE.majapahit;
}

export function loadLontarStyle(vibe: CulturalVibe = "majapahit"): Promise<StyleSpecification> {
  return fetchBaseStyle().then((base) => recolor(cloneStyle(base), vibe));
}

function recolor(style: StyleSpecification, vibe: CulturalVibe): StyleSpecification {
  const c = paletteFor(vibe);
  for (const layer of style.layers as unknown as AnyLayer[]) {
    const id = layer.id;
    const paint = (layer.paint ??= {});
    if (layer.type === "background") paint["background-color"] = c.land;
    else if (layer.type === "raster") paint["raster-opacity"] = 0;
    else if (layer.type === "fill") {
      delete paint["fill-pattern"];
      if (/water/.test(id)) paint["fill-color"] = c.water;
      else if (/park|wood|forest|grass|landcover|meadow|garden|farm|scrub|cemetery|pitch/.test(id)) paint["fill-color"] = c.park;
      else if (/building/.test(id)) {
        paint["fill-color"] = c.block;
        paint["fill-outline-color"] = c.roadEdge;
      } else if (/landuse|residential|industrial|commercial|retail|school|hospital/.test(id)) paint["fill-color"] = c.block;
    } else if (layer.type === "fill-extrusion") {
      paint["fill-extrusion-color"] = c.block;
    } else if (layer.type === "line") {
      if (/waterway|water/.test(id)) paint["line-color"] = c.waterDeep;
      else if (/casing|bridge_.*_casing|tunnel_.*_casing/.test(id)) paint["line-color"] = c.roadEdge;
      else if (/road|street|motorway|trunk|primary|secondary|tertiary|minor|service|path|track|bridge|tunnel|link/.test(id)) {
        paint["line-color"] = /path|track|footway|pedestrian/.test(id) ? c.roadEdge : c.road;
      } else if (/boundary/.test(id)) paint["line-color"] = c.roadEdge;
    } else if (layer.type === "symbol") {
      paint["text-color"] = c.text;
      paint["text-halo-color"] = c.halo;
      paint["text-halo-width"] = 1.4;
    }
  }
  return style;
}

function safePaint(map: MLMap, layerId: string, prop: string, val: unknown) {
  try {
    if (map.getLayer(layerId)) map.setPaintProperty(layerId, prop, val);
  } catch {
    // Beberapa layer ekspresif tidak menerima string statis; lewati dengan aman
  }
}

export function applyVibeToMap(map: MLMap, vibe: CulturalVibe): void {
  const style = map.getStyle();
  if (!style?.layers) return;
  const c = paletteFor(vibe);

  for (const layer of style.layers) {
    const id = layer.id;
    if (layer.type === "background") safePaint(map, id, "background-color", c.land);
    else if (layer.type === "fill") {
      if (id === "zone-fill") safePaint(map, id, "fill-color", c.primary);
      else if (/water/.test(id)) safePaint(map, id, "fill-color", c.water);
      else if (/park|wood|forest|grass|landcover|meadow|garden|farm|scrub|cemetery|pitch/.test(id)) safePaint(map, id, "fill-color", c.park);
      else if (/building/.test(id)) {
        safePaint(map, id, "fill-color", c.block);
        safePaint(map, id, "fill-outline-color", c.roadEdge);
      } else if (/landuse|residential|industrial|commercial|retail|school|hospital/.test(id)) safePaint(map, id, "fill-color", c.block);
    } else if (layer.type === "fill-extrusion") {
      safePaint(map, id, "fill-extrusion-color", c.block);
    } else if (layer.type === "line") {
      if (id === "zone-line" || id === "route-road" || id === "route-straight") safePaint(map, id, "line-color", c.primary);
      else if (id === "redirect-casing" || id === "route-casing" || id === "trail-casing") safePaint(map, id, "line-color", c.road);
      else if (id === "redirect-line") safePaint(map, id, "line-color", c.safe);
      else if (id === "trail-line") safePaint(map, id, "line-color", c.umkm);
      else if (/waterway|water/.test(id)) safePaint(map, id, "line-color", c.waterDeep);
      else if (/casing|bridge_.*_casing|tunnel_.*_casing/.test(id)) safePaint(map, id, "line-color", c.roadEdge);
      else if (/road|street|motorway|trunk|primary|secondary|tertiary|minor|service|path|track|bridge|tunnel|link/.test(id)) {
        safePaint(map, id, "line-color", /path|track|footway|pedestrian/.test(id) ? c.roadEdge : c.road);
      } else if (/boundary/.test(id)) safePaint(map, id, "line-color", c.roadEdge);
    } else if (layer.type === "circle" && id === "redirect-end") {
      safePaint(map, id, "circle-color", c.road);
      safePaint(map, id, "circle-stroke-color", c.safe);
    } else if (layer.type === "symbol") {
      safePaint(map, id, "text-color", c.text);
      safePaint(map, id, "text-halo-color", c.halo);
    }
  }
}
