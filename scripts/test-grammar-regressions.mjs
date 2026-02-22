import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  callbackFunctionNames,
  gameJsonFileRx,
  watchedMetadataFileRx,
} from "./openplanet-grammar-config.mjs";
import { applyStaticGrammarMetadata } from "./openplanet-grammar-static.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function findPatternByName(patterns, name) {
  const pattern = (patterns || []).find((entry) => entry?.name === name);
  assert.ok(pattern, `Missing grammar pattern "${name}".`);
  return pattern;
}

function findPatternByNameByMatcher(patterns, name, matcher, label) {
  const pattern = (patterns || []).find(
    (entry) => entry?.name === name && typeof entry?.match === "string" && matcher(entry.match),
  );
  assert.ok(pattern, `Missing grammar pattern "${name}" for ${label}.`);
  return pattern;
}

function expectMatches(regexSource, sample, label) {
  const rx = new RegExp(regexSource);
  assert.ok(rx.test(sample), `Expected ${label} regex to match "${sample}".`);
}

function expectNotMatches(regexSource, sample, label) {
  const rx = new RegExp(regexSource);
  assert.ok(!rx.test(sample), `Expected ${label} regex not to match "${sample}".`);
}

function main() {
  const grammarPath = path.join(repoRoot, "syntaxes", "openplanet-angelscript.tmLanguage.json");
  const languageConfigPath = path.join(repoRoot, "language-configuration.json");
  const packagePath = path.join(repoRoot, "package.json");

  const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf8"));
  const languageConfig = JSON.parse(fs.readFileSync(languageConfigPath, "utf8"));
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

  const staticSyncClone = JSON.parse(JSON.stringify(grammar));
  const staticChanged = applyStaticGrammarMetadata(staticSyncClone);
  assert.equal(
    staticChanged,
    false,
    "Grammar static metadata is stale. Run `npm run sync:static-grammar`.",
  );

  const nStringPattern = findPatternByName(
    grammar.repository.strings.patterns,
    "string.quoted.double.prefixed.n.angelscript",
  );
  const fStringPattern = findPatternByName(
    grammar.repository.strings.patterns,
    "string.quoted.double.prefixed.f.angelscript",
  );
  expectMatches(nStringPattern.begin, 'n"hello"', "prefixed n-string");
  expectMatches(fStringPattern.begin, 'f"hello"', "prefixed f-string");
  expectNotMatches(nStringPattern.begin, 'fn"hello"', "prefixed n-string");

  const binaryPattern = findPatternByName(
    grammar.repository.numbers.patterns,
    "constant.numeric.binary.angelscript",
  );
  const scientificPattern = findPatternByNameByMatcher(
    grammar.repository.numbers.patterns,
    "constant.numeric.float.angelscript",
    (matchSource) => new RegExp(matchSource).test("1e3"),
    "scientific numbers",
  );
  const integerPattern = findPatternByName(
    grammar.repository.numbers.patterns,
    "constant.numeric.integer.angelscript",
  );
  expectMatches(binaryPattern.match, "0b1010u", "binary numeric");
  expectMatches(scientificPattern.match, "1e3", "scientific numeric");
  expectMatches(integerPattern.match, "1_000ul", "integer suffix numeric");

  const definePattern = findPatternByName(
    grammar.repository.preprocessorDefines.patterns,
    "constant.other.preprocessor.define.angelscript",
  );
  expectMatches(definePattern.match, "TMNEXT", "preprocessor define");
  expectMatches(definePattern.match, "COMP_MY_PLUGIN", "preprocessor define");
  expectNotMatches(definePattern.match, "UNKNOWN_DEFINE", "preprocessor define");

  const callbackPattern = findPatternByName(
    grammar.repository.declarations.patterns,
    "meta.function.definition.callback.angelscript",
  );
  for (const callbackName of callbackFunctionNames) {
    expectMatches(callbackPattern.match, `void ${callbackName}(`, "callback function");
  }

  const hasNStringAutoClose = languageConfig.autoClosingPairs.some((pair) => pair.open === 'n"');
  const hasFStringAutoClose = languageConfig.autoClosingPairs.some((pair) => pair.open === 'f"');
  assert.ok(hasNStringAutoClose, 'Missing language autoClose pair for n".');
  assert.ok(hasFStringAutoClose, 'Missing language autoClose pair for f".');

  const openplanetScopes = packageJson.contributes.semanticTokenScopes.find(
    (entry) => entry.language === "openplanet-angelscript",
  );
  assert.ok(openplanetScopes, "Missing semantic token scopes for openplanet-angelscript.");
  assert.ok(
    openplanetScopes.scopes.string.includes("string.quoted.double.prefixed.n.angelscript"),
    "Missing semantic token scope for prefixed n-strings.",
  );
  assert.ok(
    openplanetScopes.scopes.string.includes("string.quoted.double.prefixed.f.angelscript"),
    "Missing semantic token scope for prefixed f-strings.",
  );
  assert.ok(
    openplanetScopes.scopes.number.includes("constant.numeric.binary.angelscript"),
    "Missing semantic token scope for binary numbers.",
  );

  assert.ok(watchedMetadataFileRx.test("OpenplanetCore.json"), "Watcher regex should match core json.");
  assert.ok(watchedMetadataFileRx.test("OpenplanetNext.json"), "Watcher regex should match game json.");
  assert.ok(watchedMetadataFileRx.test("OpenplanetAnyPlugin.json"), "Watcher regex should match plugin json.");
  assert.ok(!watchedMetadataFileRx.test("OpenplanetCoreExperimental.json"), "Watcher regex drifted.");
  assert.ok(watchedMetadataFileRx.test("Openplanet.h"), "Watcher regex should match header.");

  assert.ok(gameJsonFileRx.test("OpenplanetNext.json"), "Generator game regex should match game json.");
  assert.ok(!gameJsonFileRx.test("OpenplanetCore.json"), "Generator game regex should exclude core json.");

  console.log("Grammar regression checks passed.");
}

main();
