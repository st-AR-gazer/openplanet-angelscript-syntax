import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeBool, parseArgs } from "./openplanet-grammar-config.mjs";
import { applyStaticGrammarMetadata } from "./openplanet-grammar-static.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function main() {
  const args = parseArgs(process.argv.slice(2));
  const checkOnly = normalizeBool(args.check);
  const grammarPath =
    args.grammar || path.join(repoRoot, "syntaxes", "openplanet-angelscript.tmLanguage.json");

  const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf8"));
  const changed = applyStaticGrammarMetadata(grammar);

  if (!changed) {
    console.log("Static grammar metadata is up to date.");
    return;
  }

  if (checkOnly) {
    console.error("Static grammar metadata is out of date. Run: npm run sync:static-grammar");
    process.exit(1);
  }

  fs.writeFileSync(grammarPath, `${JSON.stringify(grammar, null, 2)}\n`, "utf8");
  console.log(`Updated static grammar metadata: ${grammarPath}`);
}

main();
