import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const primitiveTypes = new Set([
  "void",
  "bool",
  "int",
  "uint",
  "int8",
  "int16",
  "int32",
  "int64",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "float",
  "double",
  "string",
  "vec2",
  "vec3",
  "vec4",
  "int2",
  "int3",
  "nat2",
  "nat3",
  "quat",
  "array",
  "dictionary",
]);

const alwaysIncludeNamespaces = ["Controls", "Camera", "VehicleState", "NadeoServices"];
const defaultInstallDirNames = ["OpenplanetNext", "OpenplanetTurbo", "Openplanet4"];
const identRx = /^[A-Za-z_][A-Za-z0-9_]*$/;
const namespaceRx = /^[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*$/;

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortForAlternation(values) {
  return [...values].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a.localeCompare(b);
  });
}

function makeAlternation(values) {
  const sorted = sortForAlternation(values);
  if (sorted.length === 0) return "(?!)";
  return sorted.map(escapeRegex).join("|");
}

function chunkAlternation(values, maxChunkLength = 18000) {
  const sortedEscaped = sortForAlternation(values).map(escapeRegex);
  const chunks = [];
  let current = [];
  let currentLength = 0;

  for (const item of sortedEscaped) {
    const itemLength = item.length + (current.length > 0 ? 1 : 0);
    if (current.length > 0 && currentLength + itemLength > maxChunkLength) {
      chunks.push(current.join("|"));
      current = [item];
      currentLength = item.length;
      continue;
    }
    current.push(item);
    currentLength += itemLength;
  }

  if (current.length > 0) chunks.push(current.join("|"));
  return chunks;
}

function normalizeBool(value) {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return false;
}

function resolveUniquePaths(paths) {
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

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function dirExists(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function stripCppComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
}

function collectSymbolsFromCoreJson(core, out) {
  for (const group of [core.functions, core.enums, core.props, core.funcdefs, core.classes]) {
    for (const item of group || []) {
      if (item?.ns && namespaceRx.test(item.ns)) out.namespaces.add(item.ns);
    }
  }

  for (const cls of core.classes || []) {
    if (!cls?.name || !identRx.test(cls.name)) continue;
    if (primitiveTypes.has(cls.name)) continue;
    out.types.add(cls.name);
  }

  for (const fn of core.functions || []) {
    if (!fn?.name || !identRx.test(fn.name)) continue;
    if (fn.ns && namespaceRx.test(fn.ns)) continue;
    out.globalFunctions.add(fn.name);
  }
}

function collectSymbolsFromGameJson(gameJson, out) {
  if (!gameJson?.ns || typeof gameJson.ns !== "object") return;
  for (const [topNs, classes] of Object.entries(gameJson.ns)) {
    if (namespaceRx.test(topNs)) out.namespaces.add(topNs);
    if (!classes || typeof classes !== "object") continue;
    for (const className of Object.keys(classes)) {
      if (!identRx.test(className)) continue;
      if (primitiveTypes.has(className)) continue;
      out.types.add(className);
    }
  }
}

function collectSymbolsFromHeader(headerText, out) {
  const text = stripCppComments(headerText);

  const namespaceDeclRx = /\bnamespace\s+([A-Za-z_][A-Za-z0-9_:]*)\s*\{/g;
  let match;
  while ((match = namespaceDeclRx.exec(text)) !== null) {
    if (namespaceRx.test(match[1])) out.namespaces.add(match[1]);
  }

  const usingNamespaceRx = /\busing\s+namespace\s+([A-Za-z_][A-Za-z0-9_:]*)\s*;/g;
  while ((match = usingNamespaceRx.exec(text)) !== null) {
    if (namespaceRx.test(match[1])) out.namespaces.add(match[1]);
  }

  const typeDeclRx = /\b(?:class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
  while ((match = typeDeclRx.exec(text)) !== null) {
    const typeName = match[1];
    if (!identRx.test(typeName) || primitiveTypes.has(typeName)) continue;
    out.types.add(typeName);
  }

  const enumClassRx = /\benum\s+class\s+([A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)\b/g;
  while ((match = enumClassRx.exec(text)) !== null) {
    for (const segment of match[1].split("::")) {
      if (!identRx.test(segment) || primitiveTypes.has(segment)) continue;
      out.types.add(segment);
    }
  }
}

function discoverInstallDataFiles(installDir, includeHeaders) {
  const coreJsonPaths = [];
  const gameJsonPaths = [];
  const headerPaths = [];

  for (const entry of fs.readdirSync(installDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name === "OpenplanetCore.json") {
      coreJsonPaths.push(path.join(installDir, entry.name));
      continue;
    }
    if (/^Openplanet(?!Core)[A-Za-z0-9_]*\.json$/i.test(entry.name)) {
      gameJsonPaths.push(path.join(installDir, entry.name));
    }
  }

  if (includeHeaders) {
    const headerPath = path.join(installDir, "Openplanet.h");
    if (fileExists(headerPath)) headerPaths.push(headerPath);
  }

  return { coreJsonPaths, gameJsonPaths, headerPaths };
}

function ensureExistingFiles(paths, label) {
  for (const filePath of paths) {
    if (!fileExists(filePath)) {
      throw new Error(`${label} file not found: ${filePath}`);
    }
  }
}

function resolveSourcePaths(args) {
  const includeHeaders = normalizeBool(args["include-headers"]);

  const explicitCorePaths = resolveUniquePaths(valueToList(args.core));
  const explicitGamePaths = resolveUniquePaths([...valueToList(args.game), ...valueToList(args.next)]);
  const explicitHeaderPaths = resolveUniquePaths(valueToList(args.header));
  const explicitInstallDirs = resolveUniquePaths([
    ...valueToList(args["openplanet-dir"]),
    ...valueToList(args["openplanet-dirs"]),
  ]);

  const envInstallDirs = resolveUniquePaths([
    ...valueToList(process.env.OPENPLANET_DIRS),
    ...valueToList(process.env.OPENPLANET_NEXT_DIR),
    ...valueToList(process.env.OPENPLANET_TURBO_DIR),
    ...valueToList(process.env.OPENPLANET4_DIR),
  ]);

  const defaultInstallDirs = resolveUniquePaths(
    defaultInstallDirNames.map((name) => path.join(os.homedir(), name)),
  );

  const hasExplicitFiles =
    explicitCorePaths.length > 0 || explicitGamePaths.length > 0 || explicitHeaderPaths.length > 0;

  let installDirs = [];
  if (explicitInstallDirs.length > 0) installDirs = explicitInstallDirs;
  else if (hasExplicitFiles) installDirs = [];
  else if (envInstallDirs.length > 0) installDirs = envInstallDirs;
  else installDirs = defaultInstallDirs;

  installDirs = installDirs.filter((dirPath) => dirExists(dirPath));

  const coreJsonPaths = new Set(explicitCorePaths);
  const gameJsonPaths = new Set(explicitGamePaths);
  const headerPaths = new Set(explicitHeaderPaths);

  for (const installDir of installDirs) {
    const discovered = discoverInstallDataFiles(installDir, includeHeaders);
    for (const p of discovered.coreJsonPaths) coreJsonPaths.add(path.resolve(p));
    for (const p of discovered.gameJsonPaths) gameJsonPaths.add(path.resolve(p));
    for (const p of discovered.headerPaths) headerPaths.add(path.resolve(p));
  }

  const resolved = {
    includeHeaders,
    installDirs,
    coreJsonPaths: resolveUniquePaths([...coreJsonPaths]),
    gameJsonPaths: resolveUniquePaths([...gameJsonPaths]),
    headerPaths: resolveUniquePaths([...headerPaths]),
  };

  ensureExistingFiles(resolved.coreJsonPaths, "Core JSON");
  ensureExistingFiles(resolved.gameJsonPaths, "Game JSON");
  ensureExistingFiles(resolved.headerPaths, "Header");

  if (resolved.coreJsonPaths.length === 0 && resolved.gameJsonPaths.length === 0) {
    throw new Error(
      "No Openplanet JSON sources found. Provide --openplanet-dir/--openplanet-dirs or explicit --core/--game paths.",
    );
  }

  return resolved;
}

function collectSymbolsFromSources(sourcePaths) {
  const out = {
    namespaces: new Set(alwaysIncludeNamespaces),
    types: new Set(),
    globalFunctions: new Set(),
  };

  for (const corePath of sourcePaths.coreJsonPaths) {
    collectSymbolsFromCoreJson(readJson(corePath), out);
  }

  for (const gamePath of sourcePaths.gameJsonPaths) {
    collectSymbolsFromGameJson(readJson(gamePath), out);
  }

  for (const headerPath of sourcePaths.headerPaths) {
    collectSymbolsFromHeader(fs.readFileSync(headerPath, "utf8"), out);
  }

  return out;
}

function walkPatterns(root, cb) {
  if (Array.isArray(root)) {
    for (const item of root) walkPatterns(item, cb);
    return;
  }
  if (!root || typeof root !== "object") return;
  if (typeof root.name === "string" && typeof root.match === "string") cb(root);
  for (const value of Object.values(root)) walkPatterns(value, cb);
}

function findPatternByName(grammar, name) {
  let found = null;
  walkPatterns(grammar.repository, (pattern) => {
    if (pattern.name !== name) return;
    if (found !== null) {
      throw new Error(`Expected a single pattern named "${name}", found multiple.`);
    }
    found = pattern;
  });
  if (!found) throw new Error(`Pattern "${name}" not found in grammar.`);
  return found;
}

function setNamespaceMatches(grammar, namespaceAlternation) {
  findPatternByName(grammar, "meta.function.definition.builtin.angelscript").match =
    String.raw`\b(?:\b(?:private|protected|shared|external|abstract|mixin|final|override)\b\s+)*(const\s+)?(${namespaceAlternation})\s*::\s*([A-Za-z_]\w*)(?:\s*<\s*([A-Za-z_]\w*(?:\s*::\s*[A-Za-z_]\w*)*)\s*(?:[@&]+)?\s*>)?(?:\s*\[\])*(?:\s*[@&]+)?\s+([A-Za-z_]\w*)\s*(?=\()`;

  findPatternByName(grammar, "meta.variable.definition.const.builtin.angelscript").match =
    String.raw`\b(const)\s+(${namespaceAlternation})\s*::\s*([A-Za-z_]\w*)(?:\s*<\s*([A-Za-z_]\w*(?:\s*::\s*[A-Za-z_]\w*)*)\s*(?:[@&]+)?\s*>)?(?:\s*\[\])*(?:\s*[@&]+)?(?:\s*(?:in|out|inout)\b)?\s+([A-Za-z_]\w*)\b(?=\s*(?:=|;|,|\)|\]|\}))`;

  findPatternByName(grammar, "meta.variable.definition.builtin.angelscript").match =
    String.raw`\b(${namespaceAlternation})\s*::\s*([A-Za-z_]\w*)(?:\s*<\s*([A-Za-z_]\w*(?:\s*::\s*[A-Za-z_]\w*)*)\s*(?:[@&]+)?\s*>)?(?:\s*\[\])*(?:\s*[@&]+)?(?:\s*(?:in|out|inout)\b)?\s+([A-Za-z_]\w*)\b(?=\s*(?:=|;|,|\)|\]|\}))`;

  findPatternByName(grammar, "meta.function.reference.wrapper.builtin.angelscript").match =
    String.raw`\b(${namespaceAlternation})\s*::\s*([A-Za-z_]\w*)\b`;

  findPatternByName(grammar, "meta.function.reference.builtin.angelscript").match =
    String.raw`\b(startnew)\s*\(\s*(?!(?:CoroutineFunc|CoroutineFuncUserdata)\b)(${namespaceAlternation})\s*::\s*([A-Za-z_]\w*)\b`;

  findPatternByName(grammar, "meta.scope-resolution.function-call.builtin.angelscript").match =
    String.raw`\b(${namespaceAlternation})\s*::\s*([A-Za-z_]\w*)\b(?=\s*\()`;

  findPatternByName(grammar, "meta.scope-resolution.member.builtin.angelscript").match =
    String.raw`\b(${namespaceAlternation})\s*::\s*([A-Za-z_]\w*)\b(?!\s*\()`;
}

function upsertDeepBuiltinScopePatterns(grammar, namespaceAlternation) {
  const patterns = grammar.repository.memberAccess.patterns;
  const functionName = "meta.scope-resolution.function-call.deep-builtin.angelscript";
  const memberName = "meta.scope-resolution.member.deep-builtin.angelscript";
  const functionPattern = {
    name: functionName,
    match: String.raw`\b(${namespaceAlternation})\s*::\s*([A-Za-z_]\w*)\s*::\s*([A-Za-z_]\w*)\b(?=\s*\()`,
    captures: {
      1: { name: "support.namespace.builtin.angelscript" },
      2: { name: "entity.name.type.angelscript" },
      3: { name: "entity.name.function.angelscript" },
    },
  };
  const memberPattern = {
    name: memberName,
    match: String.raw`\b(${namespaceAlternation})\s*::\s*([A-Za-z_]\w*)\s*::\s*([A-Za-z_]\w*)\b(?!\s*\()`,
    captures: {
      1: { name: "support.namespace.builtin.angelscript" },
      2: { name: "entity.name.type.angelscript" },
      3: { name: "constant.other.enum-member.angelscript" },
    },
  };

  const existingFunctionIndex = patterns.findIndex((p) => p.name === functionName);
  if (existingFunctionIndex >= 0) patterns.splice(existingFunctionIndex, 1);
  const existingMemberIndex = patterns.findIndex((p) => p.name === memberName);
  if (existingMemberIndex >= 0) patterns.splice(existingMemberIndex, 1);

  const singleBuiltinFunctionIndex = patterns.findIndex(
    (p) => p.name === "meta.scope-resolution.function-call.builtin.angelscript",
  );
  const insertIndex = singleBuiltinFunctionIndex >= 0 ? singleBuiltinFunctionIndex : 0;
  patterns.splice(insertIndex, 0, functionPattern, memberPattern);
}

function upsertKnownTypePatterns(grammar, typeChunks) {
  const patterns = grammar.repository.types.patterns;
  const name = "support.type.openplanet.angelscript";
  const keptPatterns = patterns.filter((p) => p.name !== name);
  patterns.length = 0;
  patterns.push(...keptPatterns);

  const referenceIndex = patterns.findIndex((p) => p.name === "storage.modifier.reference.angelscript");
  const insertAt = referenceIndex >= 0 ? referenceIndex : patterns.length;
  const generated = typeChunks.map((chunk) => ({
    name,
    match: String.raw`\b(?:${chunk})\b`,
  }));
  patterns.splice(insertAt, 0, ...generated);
}

function upsertBuiltinGlobalFunctions(grammar, globalFunctionAlternation) {
  const patterns = grammar.repository.functionCalls.patterns;
  const name = "support.function.builtin.openplanet.angelscript";
  const existingIndex = patterns.findIndex((p) => p.name === name);
  const pattern = {
    name,
    match: String.raw`\b(?:${globalFunctionAlternation})\b(?=\s*\()`,
  };

  if (existingIndex >= 0) {
    patterns[existingIndex] = pattern;
    return;
  }

  const genericCallIndex = patterns.findIndex((p) => p.name === "entity.name.function.angelscript");
  const insertIndex = genericCallIndex >= 0 ? genericCallIndex : patterns.length;
  patterns.splice(insertIndex, 0, pattern);
}

function upsertOpenplanetVariableDefinitionPatterns(grammar, typeChunks) {
  const patterns = grammar.repository.declarations.patterns;

  const isOpenplanetVarPattern = (p) =>
    typeof p?.name === "string" &&
    (p.name.startsWith("meta.variable.definition.openplanet.angelscript") ||
      p.name.startsWith("meta.variable.definition.const.openplanet.angelscript"));

  for (let i = patterns.length - 1; i >= 0; i--) {
    if (isOpenplanetVarPattern(patterns[i])) patterns.splice(i, 1);
  }

  const constPatterns = typeChunks.map((chunk, i) => ({
    name: `meta.variable.definition.const.openplanet.angelscript.${i}`,
    match: String.raw`\b(const)\s+(${chunk})(?:\s*<\s*([A-Za-z_]\w*(?:\s*::\s*[A-Za-z_]\w*)*)\s*(?:[@&]+)?\s*>)?(?:\s*\[\])*(?:\s*[@&]+)?(?:\s*(?:in|out|inout)\b)?\s+([A-Za-z_]\w*)\b(?=\s*(?:=|;|,|\)|\]|\}))`,
    captures: {
      1: { name: "storage.modifier.angelscript" },
      2: { name: "support.type.openplanet.angelscript" },
      3: { name: "entity.name.type.angelscript" },
      4: { name: "variable.other.constant.angelscript" },
    },
  }));

  const nonConstPatterns = typeChunks.map((chunk, i) => ({
    name: `meta.variable.definition.openplanet.angelscript.${i}`,
    match: String.raw`\b(?!return\b|if\b|for\b|while\b|switch\b|case\b|break\b|continue\b|else\b|new\b|delete\b)(${chunk})(?:\s*<\s*([A-Za-z_]\w*(?:\s*::\s*[A-Za-z_]\w*)*)\s*(?:[@&]+)?\s*>)?(?:\s*\[\])*(?:\s*[@&]+)?(?:\s*(?:in|out|inout)\b)?\s+([A-Za-z_]\w*)\b(?=\s*(?:=|;|,|\)|\]|\}))`,
    captures: {
      1: { name: "support.type.openplanet.angelscript" },
      2: { name: "entity.name.type.angelscript" },
      3: { name: "variable.other.readwrite.angelscript" },
    },
  }));

  const constIndex = patterns.findIndex((p) => p.name === "meta.variable.definition.const.angelscript");
  const insertConstAt = constIndex >= 0 ? constIndex : patterns.length;
  patterns.splice(insertConstAt, 0, ...constPatterns);

  const varIndex = patterns.findIndex((p) => p.name === "meta.variable.definition.angelscript");
  const insertVarAt = varIndex >= 0 ? varIndex : patterns.length;
  patterns.splice(insertVarAt, 0, ...nonConstPatterns);
}

function updateConstructorCallPattern(grammar) {
  findPatternByName(grammar, "meta.constructor.call.angelscript").match =
    String.raw`(?<=\bnew\s)(?!(?:CoroutineFunc|CoroutineFuncUserdata)\b)([A-Z][A-Za-z0-9_]*)\b(?=\s*\()`;
}

function moveIncludeAfter(patterns, includeToMove, includeAfter) {
  const moveIndex = patterns.findIndex((pattern) => pattern?.include === includeToMove);
  if (moveIndex < 0) return;

  const afterIndex = patterns.findIndex((pattern) => pattern?.include === includeAfter);
  if (afterIndex < 0 || moveIndex === afterIndex + 1) return;

  const [entry] = patterns.splice(moveIndex, 1);
  const nextAfterIndex = patterns.findIndex((pattern) => pattern?.include === includeAfter);
  const insertIndex = nextAfterIndex >= 0 ? nextAfterIndex + 1 : patterns.length;
  patterns.splice(insertIndex, 0, entry);
}

function stabilizeFunctionAndTypeScopes(grammar) {
  if (Array.isArray(grammar.patterns)) {
    moveIncludeAfter(grammar.patterns, "#types", "#functionCalls");
  }

  const typeIdentifierPatterns = grammar?.repository?.typeIdentifiers?.patterns;
  if (Array.isArray(typeIdentifierPatterns) && typeIdentifierPatterns.length > 0) {
    const primaryTypeIdentifierPattern = typeIdentifierPatterns[0];
    if (
      primaryTypeIdentifierPattern &&
      primaryTypeIdentifierPattern.name === "entity.name.type.angelscript"
    ) {
      primaryTypeIdentifierPattern.match =
        String.raw`\b[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9_]*\b(?!\s*\()`;
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const grammarPath =
    args.grammar || path.join(repoRoot, "syntaxes", "openplanet-angelscript.tmLanguage.json");

  const sourcePaths = resolveSourcePaths(args);
  const grammar = readJson(grammarPath);
  const { namespaces, types, globalFunctions } = collectSymbolsFromSources(sourcePaths);

  const namespaceAlternation = makeAlternation(namespaces);
  const typeChunks = chunkAlternation(types);
  const globalFunctionAlternation = makeAlternation(globalFunctions);

  setNamespaceMatches(grammar, namespaceAlternation);
  upsertDeepBuiltinScopePatterns(grammar, namespaceAlternation);
  upsertKnownTypePatterns(grammar, typeChunks);
  upsertBuiltinGlobalFunctions(grammar, globalFunctionAlternation);
  upsertOpenplanetVariableDefinitionPatterns(grammar, typeChunks);
  updateConstructorCallPattern(grammar);
  stabilizeFunctionAndTypeScopes(grammar);

  fs.writeFileSync(grammarPath, `${JSON.stringify(grammar, null, 2)}\n`, "utf8");

  console.log(`Updated grammar: ${grammarPath}`);
  console.log(`Install dirs: ${sourcePaths.installDirs.length}`);
  console.log(`Core JSON files: ${sourcePaths.coreJsonPaths.length}`);
  console.log(`Game JSON files: ${sourcePaths.gameJsonPaths.length}`);
  console.log(`Header files: ${sourcePaths.headerPaths.length}`);
  console.log(`Namespaces: ${namespaces.size}`);
  console.log(`Types: ${types.size} (${typeChunks.length} chunk(s))`);
  console.log(`Global built-in functions: ${globalFunctions.size}`);
}

main();
