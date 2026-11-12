import fs from "node:fs/promises";

// Local operator credentials must never be a prerequisite for a repository
// scan.  CI and other contributors can optionally supply a JSON file through
// this explicit variable, while this scanner always keeps its generic checks.
const configuredSecretFile = process.env.ASHA_SECRET_SCAN_CONFIG;
let configuredSecrets = [];
if (configuredSecretFile) {
  try {
    const configured = JSON.parse(
      await fs.readFile(configuredSecretFile, "utf8"),
    );
    configuredSecrets = [configured.api_key, configured.project_key].filter(
      (value) => typeof value === "string" && value.length > 0,
    );
  } catch (error) {
    console.error(
      `Could not read ASHA_SECRET_SCAN_CONFIG: ${error instanceof Error ? error.message : "invalid configuration"}`,
    );
    process.exitCode = 2;
  }
}
const secrets = [
  ...configuredSecrets,
  process.env.MAIRA_API_KEY,
  process.env.MAIRA_PROJECT_KEY,
  process.env.SUPABASE_SECRET_KEY,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.VAPID_PRIVATE_KEY,
].filter((value) => typeof value === "string" && value.length > 0);
const staged = process.argv.includes("--staged");
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "artifacts",
  "coverage",
  "node_modules",
]);

async function repositoryPaths(dir = ".") {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = dir === "." ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) paths.push(...(await repositoryPaths(path)));
    } else if (entry.isFile()) {
      paths.push(path);
    }
  }
  return paths;
}

// Scanning all source files is more conservative than relying on a local Git
// executable, and works in restricted CI runners. --staged remains accepted
// for hook compatibility; hooks receive the same safe whole-tree scan.
const paths = await repositoryPaths();
if (staged) console.error("secret-scan: scanning the full working tree");
const found = [];
for (const path of paths) {
  if (!/\.(js|mjs|json|html|css|md|yml|yaml|txt)$/.test(path)) continue;
  let text;
  try {
    text = await fs.readFile(path, "utf8");
  } catch {
    continue;
  }
  if (secrets.some((s) => text.includes(s))) found.push(path);
  if (
    /(?:vercel_blob_rw_|vcp_|sk-proj-|sb_secret_|AIza)[A-Za-z0-9_=-]{20,}/.test(
      text,
    )
  )
    found.push(path);
}
console.log(
  JSON.stringify({
    filesChecked: paths.length,
    secretFindings: [...new Set(found)],
  }),
);
if (found.length) process.exitCode = 1;
