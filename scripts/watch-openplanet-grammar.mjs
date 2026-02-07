import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultInstallDirNames = ["OpenplanetNext", "OpenplanetTurbo", "Openplanet4"];
const watchedFileRx = /^Openplanet(?:Core|Next|Turbo|4)?\.json$|^Openplanet\.h$/i;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const next = argv[i + 1];

    let value;
    if (inlineValue !== undefined) {
      value = inlineValue;
    } else if (next && !next.startsWith("--")) {
      value = next;
      i++;
    } else {
      value = "true";
    }

    if (args[key] === undefined) args[key] = value;
    else if (Array.isArray(args[key])) args[key].push(value);
    else args[key] = [args[key], value];
  }
  return args;
}

function valueToList(value) {
  if (value === undefined || value === null) return [];
  const values = Array.isArray(value) ? value : [value];
  const out = [];
  for (const raw of values) {
    if (raw === undefined || raw === null) continue;
    for (const chunk of String(raw).split(/[;\r\n]/g)) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      out.push(trimmed);
    }
  }
  return out;
}

function normalizeBool(value) {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return false;
}

function resolveInstallDirs(args) {
  const explicit = valueToList(args["openplanet-dirs"]);
  const single = valueToList(args["openplanet-dir"]);
  const env = valueToList(process.env.OPENPLANET_DIRS);
  const base = explicit.length > 0 || single.length > 0 ? [...explicit, ...single] : env;
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
      if (!watchedFileRx.test(filename)) return;
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
