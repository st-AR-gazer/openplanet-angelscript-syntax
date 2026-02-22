import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectInstallDirsFromEnv,
  defaultInstallDirNames,
  normalizeBool,
  parseArgs,
  resolveUniquePaths,
  valueToList,
  watchedMetadataFileRx,
} from "./openplanet-grammar-config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveInstallDirs(args) {
  const explicit = resolveUniquePaths([
    ...valueToList(args["openplanet-dirs"]),
    ...valueToList(args["openplanet-dir"]),
  ]);
  const env = collectInstallDirsFromEnv();
  const base = explicit.length > 0 ? explicit : env;
  const dirs =
    base.length > 0
      ? base
      : defaultInstallDirNames.map((name) => path.join(os.homedir(), name));

  const existing = [];
  const seen = new Set();
  for (const dir of dirs) {
    const resolved = path.resolve(dir);
    const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      if (fs.statSync(resolved).isDirectory()) existing.push(resolved);
    } catch { }
  }
  return existing;
}

function buildGeneratorArgs({ includeHeaders, installDirs }) {
  const args = [path.join(__dirname, "generate-openplanet-grammar.mjs")];
  if (installDirs.length > 0) {
    args.push("--openplanet-dirs", installDirs.join(";"));
  }
  if (includeHeaders) {
    args.push("--include-headers", "true");
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const includeHeaders = normalizeBool(args["include-headers"]);
  const installDirs = resolveInstallDirs(args);
  if (installDirs.length === 0) {
    console.error("No Openplanet install directories found to watch.");
    process.exit(1);
  }

  const generatorArgs = buildGeneratorArgs({ includeHeaders, installDirs });
  let pending = false;
  let timer = null;
  let running = false;

  function runGenerator(reason) {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    console.log(`[watch] regenerating (${reason})`);

    const child = spawn(process.execPath, generatorArgs, {
      stdio: "inherit",
      cwd: path.resolve(__dirname, ".."),
    });
    child.on("exit", (code) => {
      running = false;
      if (code !== 0) {
        console.error(`[watch] generator failed with exit code ${code}`);
      }
      if (pending) {
        pending = false;
        runGenerator("queued change");
      }
    });
  }

  function schedule(reason) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => runGenerator(reason), 1200);
  }

  const watchers = installDirs.map((dir) =>
    fs.watch(dir, { persistent: true }, (_eventType, filename) => {
      if (!filename) return;
      if (!watchedMetadataFileRx.test(filename)) return;
      schedule(`${path.basename(dir)}/${filename}`);
    }),
  );

  console.log("[watch] directories:");
  for (const dir of installDirs) console.log(`  - ${dir}`);
  console.log(`[watch] include headers: ${includeHeaders ? "yes" : "no"}`);

  runGenerator("startup");

  process.on("SIGINT", () => {
    for (const watcher of watchers) watcher.close();
    process.exit(0);
  });
}

main();
