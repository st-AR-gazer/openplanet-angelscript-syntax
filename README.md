# Openplanet AngelScript Syntax

Syntax highlighting and language configuration for Openplanet-flavored AngelScript (`.as`). This extension is grammar-only and is intended to work alongside my language server (not released yet).

Features
- Openplanet preprocessor directives and define validation
- Setting and SettingsTab attributes
- Callbacks, built-in namespaces, and dependency plugins (Controls, Camera, VehicleState, NadeoServices)
- Icons:: helpers, enums, handles, and Openplanet types

Language ID
- `openplanet-angelscript`

If `.as` files do not pick up the language automatically, add this to your VS Code `settings.json`:

```json
{
  "files.associations": {
    "*.as": "openplanet-angelscript"
  }
}
```
