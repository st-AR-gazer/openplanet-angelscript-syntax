import {
  callbackFunctionNames,
  makeEscapedAlternation,
  makeRegexFragmentAlternation,
  preprocessorDefineRegexFragments,
} from "./openplanet-grammar-config.mjs";

function findPatternByName(patterns, name) {
  const pattern = (patterns || []).find((entry) => entry?.name === name);
  if (!pattern) throw new Error(`Pattern "${name}" not found.`);
  return pattern;
}

function buildSingleInvalidDirectiveRegex(directiveAlternation, defineAlternation) {
  return String.raw`^\s*#\s*(${directiveAlternation})\b(?=[^\n]*\b(?!(?:${defineAlternation})\b)[A-Za-z_]\w*\b)(?![^\n]*\b(?!(?:${defineAlternation})\b)[A-Za-z_]\w*\b[^\n]*\b(?!(?:${defineAlternation})\b)[A-Za-z_]\w*\b)`;
}

function buildCallbackRegex(callbackAlternation) {
  return String.raw`\b(?:\b(?:private|protected|shared|external|abstract|mixin|final|override)\b\s+)*((?:const\s+)?(?:[A-Za-z_]\w*(?:\s*<[^>]*>)?(?:\s*::\s*[A-Za-z_]\w*)?)(?:\s*\[\])*(?:\s*[@&]+)?)\s+(${callbackAlternation})\s*(?=\()`;
}

export function applyStaticGrammarMetadata(grammar) {
  const defineAlternation = makeRegexFragmentAlternation(preprocessorDefineRegexFragments);
  const callbackAlternation = makeEscapedAlternation(callbackFunctionNames);

  const ifSingleInvalidBegin = buildSingleInvalidDirectiveRegex("if|elif", defineAlternation);
  const defineSingleInvalidBegin = buildSingleInvalidDirectiveRegex("define|undef", defineAlternation);
  const defineMatch = String.raw`\b(?:${defineAlternation})\b`;
  const callbackMatch = buildCallbackRegex(callbackAlternation);

  const preprocessorPatterns = grammar?.repository?.preprocessor?.patterns;
  const preprocessorDefinesPatterns = grammar?.repository?.preprocessorDefines?.patterns;
  const preprocessorDefinesWarningPatterns = grammar?.repository?.preprocessorDefinesWarning?.patterns;
  const declarationPatterns = grammar?.repository?.declarations?.patterns;

  if (!Array.isArray(preprocessorPatterns)) {
    throw new Error("Grammar preprocessor patterns are missing.");
  }
  if (!Array.isArray(preprocessorDefinesPatterns) || !Array.isArray(preprocessorDefinesWarningPatterns)) {
    throw new Error("Grammar preprocessor define patterns are missing.");
  }
  if (!Array.isArray(declarationPatterns)) {
    throw new Error("Grammar declaration patterns are missing.");
  }

  const ifSingleInvalidPattern = findPatternByName(
    preprocessorPatterns,
    "meta.preprocessor.if.single-invalid.angelscript",
  );
  const defineSingleInvalidPattern = findPatternByName(
    preprocessorPatterns,
    "meta.preprocessor.define.single-invalid.angelscript",
  );
  const definePattern = findPatternByName(
    preprocessorDefinesPatterns,
    "constant.other.preprocessor.define.angelscript",
  );
  const defineWarningPattern = findPatternByName(
    preprocessorDefinesWarningPatterns,
    "constant.other.preprocessor.define.angelscript",
  );
  const callbackPattern = findPatternByName(
    declarationPatterns,
    "meta.function.definition.callback.angelscript",
  );

  let changed = false;
  if (ifSingleInvalidPattern.begin !== ifSingleInvalidBegin) {
    ifSingleInvalidPattern.begin = ifSingleInvalidBegin;
    changed = true;
  }
  if (defineSingleInvalidPattern.begin !== defineSingleInvalidBegin) {
    defineSingleInvalidPattern.begin = defineSingleInvalidBegin;
    changed = true;
  }
  if (definePattern.match !== defineMatch) {
    definePattern.match = defineMatch;
    changed = true;
  }
  if (defineWarningPattern.match !== defineMatch) {
    defineWarningPattern.match = defineMatch;
    changed = true;
  }
  if (callbackPattern.match !== callbackMatch) {
    callbackPattern.match = callbackMatch;
    changed = true;
  }

  return changed;
}
