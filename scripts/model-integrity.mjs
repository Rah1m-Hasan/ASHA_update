// Verifies the model weights and inference binaries that ship with the app.
//
// The repository already records the size and the SHA-256 of every local
// inference asset in two manifests (public/models/manifest.json and
// public/neuroface/vendor/manifest.json). Nothing checked them, so a
// truncated download or a swapped file would only have been noticed when the
// model behaved badly on a patient's device.
//
// This check runs at build/CI time rather than in the browser on purpose:
// hashing every model in the page would mean fetching about 45 MB a second
// time on a phone that is often on a slow connection. The Everyday model
// registry already verifies at run time, which is the trust boundary that
// matters there - a pack downloaded from outside the app.
//
//   node scripts/model-integrity.mjs        verify every asset
//   node scripts/model-integrity.mjs --json machine-readable output

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

/** The manifests that record the local inference assets. */
export const MANIFESTS = [
  // Every path is relative to public/.
  { file: "public/models/manifest.json", base: publicDir, key: "file" },
  // Every path is relative to public/neuroface/.
  { file: "public/neuroface/vendor/manifest.json", base: path.join(publicDir, "neuroface"), key: "path" },
  // Every path is relative to public/engine/. The ONNX Runtime WASM binary, which
  // used to be fetched from a CDN at run time and so was never checked here.
  { file: "public/engine/manifest.json", base: path.join(publicDir, "engine"), key: "path" },
];

export async function readManifests() {
  const out = [];
  for (const manifest of MANIFESTS) {
    const text = await readFile(path.join(root, manifest.file), "utf8");
    const parsed = JSON.parse(text);
    for (const entry of parsed.files ?? []) {
      const relative = entry[manifest.key];
      if (!relative) continue;
      out.push({
        manifest: manifest.file,
        path: path.join(manifest.base, relative),
        relative: path.relative(root, path.join(manifest.base, relative)),
        bytes: entry.bytes,
        sha256: entry.sha256,
      });
    }
  }
  return out;
}

/**
 * Checks every recorded asset.
 *
 * Returns one result per asset. A result is ok when the file is there, is the
 * recorded size and hashes to the recorded value.
 */
export async function verifyModels() {
  const results = [];
  for (const asset of await readManifests()) {
    let size = null;
    let digest = null;
    let error = null;
    try {
      const info = await stat(asset.path);
      size = info.size;
      digest = createHash("sha256")
        .update(await readFile(asset.path))
        .digest("hex");
    } catch (err) {
      error = err?.code === "ENOENT" ? "missing" : String(err?.message ?? err);
    }
    const ok =
      !error &&
      Number.isSafeInteger(asset.bytes) &&
      size === asset.bytes &&
      typeof asset.sha256 === "string" &&
      digest === asset.sha256;
    results.push({ ...asset, size, digest, error, ok });
  }
  return results;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const results = await verifyModels();
  const failed = results.filter((r) => !r.ok);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ checked: results.length, failed: failed.length, results }, null, 2));
  } else {
    for (const r of results) {
      console.log(
        `${r.ok ? "ok  " : "FAIL"} ${r.relative} ${r.ok ? `${r.size} bytes` : r.error ?? `size ${r.size} != ${r.bytes} or hash mismatch`}`,
      );
    }
    console.log(`\n${results.length - failed.length}/${results.length} inference assets match their pinned hash.`);
  }
  if (failed.length) {
    console.error(`${failed.length} inference asset(s) do not match the pinned hash.`);
    process.exit(1);
  }
}
