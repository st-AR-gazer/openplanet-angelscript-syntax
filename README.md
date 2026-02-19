# Openplanet AngelScript Syntax

Syntax highlighting and language configuration for Openplanet-flavored AngelScript (`.as`). This extension is grammar-only and is intended to work alongside my language server (not released yet).

Features
- Openplanet preprocessor directives and define validation
- Setting and SettingsTab attributes
- Callbacks, built-in namespaces, and dependency plugins (Controls, Camera, VehicleState, NadeoServices)
- Icons:: helpers, enums, handles, and Openplanet types
- Data-driven built-in namespace/type/function highlighting generated from your local Openplanet JSON metadata
- Per-session automatic symbol refresh on VS Code startup, plus manual refresh command/button
- Secondary snippet language scope: `angelscript_snippet`
- Semantic-token scope mappings in the extension manifest for consistent semantic coloring
- Function/type color consistency improvements (function-call scopes now win over broad type fallback scopes)

Semantic Color Taxonomy v1 (Dark)
- Dark-theme focused, concept-driven, opinionated, and accessibility-aware.
- Variables use a light blue; constants use a slightly deeper blue and are bolded.
- Openplanet built-in API functions use amber/gold (for example `GetApp`), distinct from regular function calls.
- Namespaces stay green, with built-in namespaces bolded.
- User-defined type names use violet; Openplanet/game-provided types use a bluer violet; primitive/container types use lavender.
- Enum members use a teal-green accent (namespace-adjacent); constants stay bold blue.
- Control keywords are keyword-blue (non-red, non-amber); operators/directives follow the same family; storage modifiers are warm yellow.
- Red is reserved for incorrect/invalid code (for example invalid preprocessor statements).
- Comments are muted italic gray; strings are warm brown; numbers are muted green.

Language ID
- `openplanet-angelscript`
- `angelscript_snippet` (for snippet/code-block markdown scope usage)

If `.as` files do not pick up the language automatically, add this to your VS Code `settings.json`:

```json
{
  "files.associations": {
    "*.as": "openplanet-angelscript"
  }
}
```

Regenerate Data-Driven Symbols
- `npm run generate:openplanet-grammar`
- By default this reads:
  - `%USERPROFILE%/OpenplanetNext/*.json`
  - `%USERPROFILE%/OpenplanetTurbo/*.json`
  - `%USERPROFILE%/Openplanet4/*.json`
- It automatically merges symbols from all detected installs.
- Optional header fallback (only needed when JSON metadata is missing symbols):
  - `node scripts/generate-openplanet-grammar.mjs --include-headers true`
- Override source paths when needed:
  - `node scripts/generate-openplanet-grammar.mjs --openplanet-dir "D:/OpenplanetNext"`
- `node scripts/generate-openplanet-grammar.mjs --openplanet-dirs "D:/OpenplanetNext;D:/OpenplanetTurbo;D:/Openplanet4"`
- `node scripts/generate-openplanet-grammar.mjs --core "D:/OpenplanetNext/OpenplanetCore.json" --game "D:/OpenplanetNext/OpenplanetNext.json" --header "D:/OpenplanetNext/Openplanet.h"`

Session Refresh
- On VS Code session start, the extension refreshes symbol metadata once by default.
- Manual refresh command: `Openplanet AngelScript: Refresh Syntax Symbols`
- Status bar button: `OP Symbols` (toggle in settings)
- Settings:
  - `openplanetAngelscript.refreshSymbolsOnSessionStart`
  - `openplanetAngelscript.showRefreshButton`
  - `openplanetAngelscript.includeHeaderFallback`
  - `openplanetAngelscript.sourceDirs`

Auto-Refresh
- `npm run watch:openplanet-grammar`
- Watches `%USERPROFILE%/OpenplanetNext`, `%USERPROFILE%/OpenplanetTurbo`, and `%USERPROFILE%/Openplanet4`.
- Regenerates grammar when `Openplanet*.json` or `Openplanet.h` changes.
- Include header fallback while watching:
  - `node scripts/watch-openplanet-grammar.mjs --include-headers true`
