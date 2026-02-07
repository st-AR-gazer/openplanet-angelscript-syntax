# Change Log

All notable changes to the "openplanet-angelscript-syntax" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.2.0] - 2026-02-07

- Semantic color taxonomy v1 (dark preset): concept-based full-scope highlighting palette
- Generate built-in namespace/type/function highlighting from `OpenplanetCore.json` + `OpenplanetNext.json`
- Add deep scope-resolution highlighting for symbols like `Namespace::Type::Member`
- Merge symbols from `%USERPROFILE%/OpenplanetNext`, `%USERPROFILE%/OpenplanetTurbo`, and `%USERPROFILE%/Openplanet4`
- Add optional header fallback source parsing via `--include-headers` / `--header`
- Add watch mode to auto-regenerate grammar when Openplanet metadata files change
- Refresh symbols automatically once per VS Code session startup
- Add manual refresh command and optional status bar refresh button
- Reserve red for invalid/incorrect code (for example invalid preprocessor); keep control keywords non-red
- Make numeric literals muted green instead of orange/red
- Align variable/namespace/string colors closer to VS Code Dark+ defaults (variables `#9CDCFE`, namespaces `#4EC9B0`, strings `#CE9178`)
- Move enum member accent to a namespace-adjacent green/teal (`constant.other.enum-member.angelscript`) to better distinguish from variables
- Keep control keywords in a distinct keyword-blue (no red; not styled like Openplanet API functions)
- Tweak constant hue (`constant.language`, `CAPS`, `const`) to further separate from variables while keeping bold emphasis
- Distinguish Openplanet/game-provided types (`support.type.openplanet.angelscript`) from user-defined types
- Treat `throw(...)` as a built-in Openplanet API function (amber) rather than a control keyword
- Fix PascalCase identifiers in expression context being mis-scoped as types (for example `Counter++`)
- Fix `::` scope-resolution heuristics so PascalCase namespaces are not mis-scoped as types (for example `DemoNs::g_NamespaceValue`, `DemoNs::CoroutineInNs()`)
- Ensure `startnew(...)` is consistently scoped as a built-in Openplanet API function (bold) even with `Namespace::Func` arguments

## [0.1.0] - 2026-02-05

- Initial release
