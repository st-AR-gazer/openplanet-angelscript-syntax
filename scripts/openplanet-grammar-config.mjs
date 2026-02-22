import path from "node:path";

export const defaultInstallDirNames = ["OpenplanetNext", "OpenplanetTurbo", "Openplanet4"];

export const installDirEnvKeys = [
  "OPENPLANET_DIRS",
  "OPENPLANET_NEXT_DIR",
  "OPENPLANET_TURBO_DIR",
  "OPENPLANET4_DIR",
];

export const coreJsonFileName = "OpenplanetCore.json";
export const gameJsonFileRx = /^Openplanet(?!Core)[A-Za-z0-9_]*\.json$/i;
export const watchedMetadataFileRx = /^Openplanet(?:Core|(?!Core)[A-Za-z0-9_]*)\.json$|^Openplanet\.h$/i;

export const preprocessorDefineRegexFragments = [
  "FOREVER",
  "UNITED_FOREVER",
  "NATIONS_FOREVER",
  "MP3",
  "TURBO",
  "MP4",
  "MP40",
  "MP41",
  "TMNEXT",
  "LOGS",
  "HAS_DEV",
  "SERVER",
  "MANIA64",
  "MANIA32",
  "WINDOWS",
  "WINDOWS_WINE",
  "LINUX",
  "DEVELOPER",
  "SIG_OFFICIAL",
  "SIG_REGULAR",
  "SIG_SCHOOL",
  "SIG_DEVELOPER",
  "COMP_[A-Z0-9_]+",
];

export const callbackFunctionNames = [
  "Main",
  "Render",
  "RenderInterface",
  "RenderMenu",
  "RenderMenuMain",
  "RenderSettings",
  "RenderEarly",
  "Update",
  "OnDisabled",
  "OnEnabled",
  "OnDestroyed",
  "OnSettingsChanged",
  "OnSettingsSave",
  "OnSettingsLoad",
  "OnKeyPress",
  "OnMouseButton",
  "OnMouseMove",
  "OnMouseWheel",
  "OnLoadCallback",
];

export function parseArgs(argv) {
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

export function valueToList(value) {
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

export function normalizeBool(value) {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return false;
}

export function resolveUniquePaths(paths) {
  const seen = new Set();
  const result = [];
  for (const p of paths) {
    const resolved = path.resolve(p);
    const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(resolved);
  }
  return result;
}

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortForAlternation(values) {
  return [...values].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a.localeCompare(b);
  });
}

export function makeEscapedAlternation(values) {
  const sorted = sortForAlternation(values);
  if (sorted.length === 0) return "(?!)";
  return sorted.map(escapeRegex).join("|");
}

export function makeRegexFragmentAlternation(values) {
  const sorted = sortForAlternation(values);
  if (sorted.length === 0) return "(?!)";
  return sorted.join("|");
}

export function collectInstallDirsFromEnv() {
  return resolveUniquePaths(
    installDirEnvKeys.flatMap((envKey) => valueToList(process.env[envKey])),
  );
}
