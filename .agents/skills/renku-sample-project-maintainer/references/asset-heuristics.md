# Asset Heuristics

Use these heuristics when importing or repairing assets in the external Renku Studio development sample project.

These notes are not a manifest and not a product contract. Inspect the current sample database, asset folder, and Studio services before applying them.

## General Ownership Cues

- Folder names usually identify the owning domain object.
- `cast-member`, `cast`, character names, `portraits`, and `character-sheets` usually indicate cast-member assets.
- `visual-language`, `color`, `camera`, `lighting`, `texture`, and `production-design` usually indicate visual-language assets.
- `continuity`, `locations`, `props`, `costumes`, `vehicles`, and `symbols` usually indicate continuity reference assets.
- `sequence`, `scene`, and `clip` path segments usually indicate narrative-owned assets.
- Filenames with `selected`, `base`, `final`, or another clear canonical cue may be selected assets.
- Filenames with `alternate`, `variant`, `draft`, exploratory names, or unclear canonical status usually become takes.

When ownership or selection would materially change project meaning, ask the developer. When the only uncertainty is whether an asset is selected, prefer a take and explain that choice.

## Constantinople Cast-Member Examples

### Mehmed II

| Source pattern | Asset role | Default state |
| --- | --- | --- |
| `cast-member/member-1/character-sheets/character-sheet-16x9.png` | `character_sheet` | take |
| `cast-member/member-1/character-sheets/character-sheet-base.png` | `character_sheet` | select |
| `cast-member/member-1/character-sheets/character-sheet-campaign.png` | `character_sheet` | take |
| `cast-member/member-1/character-sheets/character-sheet-court.png` | `character_sheet` | take |
| `cast-member/member-1/portraits/full-body-9x16.png` | `portrait` | take |
| `cast-member/member-1/portraits/portrait-reference-1x1.png` | `portrait` | select |

### Constantine XI Palaiologos

| Source pattern | Asset role | Default state |
| --- | --- | --- |
| `cast-member/member-2/character-sheets/constantine-16x9.png` | `character_sheet` | select |
| `cast-member/member-2/character-sheets/constantine-9x16.png` | `character_sheet` | take |
| `cast-member/member-2/character-sheets/constantine-pose-gesture.png` | `pose_gesture_sheet` | take |
| `cast-member/member-2/portraits/constantine-9x16.jpg` | `portrait` | take |
| `cast-member/member-2/portraits/constantine-xi.png` | `portrait` | select |

## Constantinople Visual-Language Examples

| Source pattern | Attach to | Asset role | Default state |
| --- | --- | --- | --- |
| `visual-language/camera/slow-observational-camera-grammar/camera-grammar.png` | Slow observational camera grammar | `reference` | select |
| `visual-language/color/muted-earth-stone-bronze-and-textile-palette/color-palette-2.png` | Muted earth, stone, bronze, and textile palette | `reference` | take |
| `visual-language/color/muted-earth-stone-bronze-and-textile-palette/color-palette-landscape.png` | Muted earth, stone, bronze, and textile palette | `reference` | take |
| `visual-language/color/muted-earth-stone-bronze-and-textile-palette/color-palette-portrait.png` | Muted earth, stone, bronze, and textile palette | `reference` | take |
| `visual-language/color/muted-earth-stone-bronze-and-textile-palette/color-palette-selected.png` | Muted earth, stone, bronze, and textile palette | `reference` | select |
| `visual-language/lighting/practical-source-low-key-interiors/lighting-sheet.png` | Practical-source low-key interiors | `reference` | select |
