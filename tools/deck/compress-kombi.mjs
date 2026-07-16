// Repeatable compression pipeline for the deck's hero kombi model.
// Source: assets/Kombi 3d model/Meshy_AI_White_Toyota_Hiace_Pa_0626135819_texture.glb (~32 MB)
// Output: deck/assets/kombi.glb (target under 5 MB per SHOWCASE-DECK-PLAN.md S2 gate)
//
// Run from tools/deck:  node compress-kombi.mjs
//
// Pipeline: inspect for Meshy export defects (doubled meshes, degenerate
// primitives), dedup, prune unused nodes, weld vertices, resample animation,
// quantize + meshopt compress geometry, convert textures to WebP at 1024px.
// Meshy normals are checked by material doubleSided state and reported, not
// silently flipped; the deck lights both sides so a stray inverted face
// cannot go black on stage.

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  weld,
  resample,
  simplify,
  quantize,
  meshopt,
  textureCompress,
} from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { statSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(
  "../../assets/Kombi 3d model/Meshy_AI_White_Toyota_Hiace_Pa_0626135819_texture.glb",
);
const OUT = resolve("../../deck/assets/kombi.glb");

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptEncoder.ready;
io.registerDependencies({ "meshopt.encoder": MeshoptEncoder });

const doc = await io.read(SRC);

// --- Inspection for Meshy export defects, reported before transform ---
const root = doc.getRoot();
const meshes = root.listMeshes();
const seen = new Map();
for (const mesh of meshes) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const key = `${pos ? pos.getCount() : 0}:${prim.getIndices() ? prim.getIndices().getCount() : 0}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
}
const doubled = [...seen.entries()].filter(([, n]) => n > 1);
console.log(`meshes: ${meshes.length}, materials: ${root.listMaterials().length}, textures: ${root.listTextures().length}, animations: ${root.listAnimations().length}`);
if (doubled.length) {
  console.log(`possible doubled primitives (same vert/index counts): ${JSON.stringify(doubled)} — dedup pass will merge true duplicates`);
}
for (const mat of root.listMaterials()) {
  console.log(`material "${mat.getName()}": doubleSided=${mat.getDoubleSided()} metallic=${mat.getMetallicFactor()} roughness=${mat.getRoughnessFactor()}`);
  // Meshy exports sometimes carry inverted normals; render double sided so no
  // face can vanish, and let the deck lighting treat both sides equally.
  mat.setDoubleSided(true);
}

// --- Transform ---
await MeshoptSimplifier.ready;
await doc.transform(
  dedup(),
  prune(),
  weld(),
  resample(),
  // The hero is never closer than half a viewport; 60% of Meshy's dense mesh
  // is indistinguishable at deck scale and buys the 5 MB gate.
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.6, error: 0.001 }),
  quantize(),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  // Base colour carries the paint and glass; it keeps 1024. Normal and
  // metallic roughness read fine at 512 under the deck's flat key light.
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 82, slots: /baseColor/ }),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [512, 512], quality: 80, slots: /^(?!.*baseColor).*$/ }),
);

await io.write(OUT, doc);

const before = statSync(SRC).size;
const after = statSync(OUT).size;
console.log(`\n${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(2)} MB (${((after / before) * 100).toFixed(1)}%)`);
if (after > 5e6) {
  console.error("FAIL: output exceeds the 5 MB gate");
  process.exit(1);
}
console.log("PASS: under the 5 MB gate");
