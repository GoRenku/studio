# Shot Design Asset Map

Use this reference for `$generate-assets` Shot Design asset work.

## Output Root

```text
packages/studio/src/features/movie-studio/scenes/shot-design-assets/generated/
```

Expected files:

```text
reference/consistency-sheet.png
sheets/sheet-001.png
sheets/sheet-002.png
sheets/sheet-003.png
sheets/sheet-004.png
sheets/sheet-005.png
sheets/sheet-006.png
sheets/sheet-007.png
sheets/sheet-008.png
sheets/sheet-009.png
sheets/sheet-010.png
sheets/sheet-011.png
sheets/sheet-012.png
sheets/sheet-013.png
sheets/sheet-014.png
images/<asset-id>.png
motion/<asset-id>.mp4
manifest.json
```

## Consistency Reference

Use this file as the shared origin for all sheets. If it already exists, inspect
and reuse it unless the user explicitly asks to regenerate it. If a requested
sheet needs the reference and the reference is missing, generate the reference
first, inspect it with vision, show it to the user, and stop for approval before
continuing to the sheet.

Generate only the reference with:

```bash
node .agents/skills/generate-assets/scripts/generate-shot-design-asset.mjs reference --yes
```

If the existing reference is the earlier pink-heavy palace direction and the
user explicitly approves replacing it, regenerate with:

```bash
node .agents/skills/generate-assets/scripts/generate-shot-design-asset.mjs reference --yes --force
```

The reference must lock:

- one original unnamed female performer;
- the preferred character direction from the first reference: center-parted
  brown hair pinned into a neat low bun, soft oval face, understated expression,
  and cream dress with pale mint-sage paneling;
- no jacket, blazer, bag, jewelry, changing accessories, or hairstyle drift;
- Pastel Mustard Lobby interiors: European hotel lobby, corridor, room corner,
  patterned floor, and architectural details;
- pastel ochre / antique gold, parchment cream, pale mint-sage, muted
  terracotta, sparing softened oxblood, and warm ink palette;
- soft frontal light and gentle contrast;
- centered, formal, production-designed framing.

All sheet generations use this reference image as `image_urls` input.

## Approved Palette: Pastel Mustard Lobby

Use **Pastel Mustard Lobby** as the standing Shot Design asset direction. It
keeps the app-aligned mustard/amber identity, but softens the palette toward the
pastel reference the user preferred. It was chosen because it aligns with Renku
Studio's warm amber/golden/parchment design system: light mode uses warm cream
and amber surfaces, while dark mode keeps amber as the identity accent against
neutral gray panels.

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Dominant | pastel ochre / antique gold | `#D6BE79` | walls, trim, upholstery, carpet, or warm lamp glow |
| Base | parchment cream | `#F1E8D6` | plaster, marble, ceiling, and broad neutral surfaces |
| Secondary | pale mint-sage | `#B8C8B6` | performer wardrobe, upholstery, painted panels, plants, or secondary accents |
| Material accent | muted terracotta | `#C58D74` | tile, stone, wood warmth, and architectural grounding |
| Small dramatic accent | softened oxblood | `#7D3A45` | curtains, chair fabric, trim, and props; use sparingly |
| Deep detail | warm ink | `#302A25` | shadows, dark wood, hair, hardware, and contrast details |

The generated tiles must work inside both Studio themes:

- in light mode, the assets should sit naturally on parchment and amber UI
  surfaces without becoming flat yellow-on-cream blocks;
- in dark mode, the pastel ochre and parchment should keep the warm Renku
  identity alive against neutral gray panels;
- include enough warm ink, oxblood, wood, shadow, and sage contrast for small
  tile crops to remain readable.

Dusty rose-plaster warmth may appear subtly in backgrounds to preserve the
softness of the first reference, but blush, rose, and pink must not dominate the
palette.

## Output Geometry

The output geometry is part of the asset contract:

- the consistency reference is generated as `4:3`;
- each sheet is generated as `4:3`;
- each sheet contains exactly four separate `16:9` stills in a 2x2 arrangement;
- final sliced stills in `images/<asset-id>.png` are `16:9`;
- motion previews are generated from accepted `16:9` stills and use `16:9`.

The 4:3 sheet may include parchment gutters or margins around the four 16:9
stills. Do not stretch cells into squares. Do not return to the old square 3x3
sheet structure.

## Nano Banana Pro Reference Practices

Use the provider deliberately:

- `fal-ai/nano-banana-pro` and `fal-ai/nano-banana-pro/edit` support explicit
  aspect ratios such as `4:3` and `16:9`; set them instead of relying on
  defaults.
- `fal-ai/nano-banana-pro/edit` accepts `image_urls`; use the approved
  consistency reference as the binding source for every sheet.
- The reference prompt must make identity and wardrobe locks concrete: face
  shape, hairstyle, dress, excluded accessories, and excluded wardrobe changes.
- Avoid invented optional accessories. They create inconsistency across sheets.
- Keep sheet prompts simple: exactly four cells, reading order, one intended
  visual concept per cell.
- Inspect reference and sheet outputs with vision before slicing. Regenerate if
  the model changes face, hairstyle, dress, accessories, palette, or 2x2 layout.

## Visual Direction

Use a custom, Renku-owned visual language:

- pastel European hotel lobby / theatrical interior / stylized studio set;
- centered compositions, clean geometry, and readable staging;
- soft frontal light, polished production design, and gentle contrast;
- one recurring generic female cast subject, not based on a real person;
- preferred recurring character: center-parted brown hair in a neat low bun,
  cream dress with pale mint-sage paneling, no jacket, no bag, no jewelry, and
  no changing accessories;
- timeless wardrobe with no historic-costume specifics;
- no current project references, no named characters, and no copied stills from
  the user's screenshot.

Do not ask for a named filmmaker's exact style. Describe the underlying
qualities instead: symmetrical composition, pastel mustard-lobby palette,
miniature-like set precision, refined cinematic staging, parchment and pastel
ochre surfaces, pale mint-sage secondary accents, muted terracotta material
warmth, sparing softened oxblood details, dusty rose-plaster warmth only as a
subtle background temperature, and warm ink contrast.

Avoid making blush, rose, or pink the dominant palette. Avoid bright
warning-yellow. Prefer pastel ochre, antique gold, aged parchment, pale
mint-sage, muted terracotta, and warm hotel-lobby materials.

Source files should be color. Studio applies black-and-white idle treatment,
color hover treatment, and color selected treatment in CSS.

## Provider Parameters

Consistency reference model:

```text
fal-ai/nano-banana-pro
```

Consistency payload:

```json
{
  "prompt": "...",
  "num_images": 1,
  "enable_web_search": false,
  "resolution": "2K",
  "aspect_ratio": "4:3",
  "output_format": "png",
  "sync_mode": false,
  "limit_generations": true
}
```

Sheet model:

```text
fal-ai/nano-banana-pro/edit
```

Sheet payload:

```json
{
  "prompt": "...",
  "image_urls": ["<uploaded consistency-sheet.png URL>"],
  "num_images": 1,
  "enable_web_search": false,
  "resolution": "2K",
  "aspect_ratio": "4:3",
  "output_format": "png",
  "sync_mode": false,
  "limit_generations": true
}
```

Motion model:

```text
fal-ai/xai/grok-imagine-video/image-to-video
```

Motion payload:

```json
{
  "prompt": "...",
  "image_url": "<uploaded accepted sliced tile URL>",
  "duration": 4,
  "aspect_ratio": "16:9",
  "resolution": "720p"
}
```

Expected provider cost estimate:

- consistency reference: about `$0.15`;
- each image sheet: about `$0.15`;
- each 4-second motion preview: about `$0.20`.

## Sheet Calls

Each sheet is one separate provider call. Generate and review one at a time. A
sheet can be requested by number or by stable name. Each sheet is a 4:3 canvas
with exactly four 16:9 stills in a 2x2 arrangement.

| Sheet | Name | Command | Output | Cells |
|-------|------|---------|--------|-------|
| 1 | `shot-size-close` | `sheet --name shot-size-close --yes` or `sheet --number 1 --yes` | `sheets/sheet-001.png` | `shot-size-extreme-close-up`, `shot-size-close-up`, `shot-size-medium-close-up`, `shot-size-medium-shot` |
| 2 | `shot-size-wide` | `sheet --name shot-size-wide --yes` or `sheet --number 2 --yes` | `sheets/sheet-002.png` | `shot-size-medium-full-shot`, `shot-size-full-shot`, `shot-size-wide-shot`, `shot-size-extreme-wide-shot` |
| 3 | `subject-grouping` | `sheet --name subject-grouping --yes` or `sheet --number 3 --yes` | `sheets/sheet-003.png` | `subject-single`, `subject-two-shot`, `subject-three-shot`, `subject-group` |
| 4 | `subject-perspective` | `sheet --name subject-perspective --yes` or `sheet --number 4 --yes` | `sheets/sheet-004.png` | `subject-over-the-shoulder`, `subject-over-the-hip`, `subject-point-of-view`, `subject-insert` |
| 5 | `angle-basic` | `sheet --name angle-basic --yes` or `sheet --number 5 --yes` | `sheets/sheet-005.png` | `subject-reaction`, `angle-eye-level`, `angle-low-angle`, `angle-high-angle` |
| 6 | `angle-height` | `sheet --name angle-height --yes` or `sheet --number 6 --yes` | `sheets/sheet-006.png` | `angle-overhead`, `angle-shoulder-level`, `angle-hip-level`, `angle-knee-level` |
| 7 | `movement-foundation` | `sheet --name movement-foundation --yes` or `sheet --number 7 --yes` | `sheets/sheet-007.png` | `angle-ground-level`, `movement-static`, `movement-pan`, `movement-tilt` |
| 8 | `movement-dynamic` | `sheet --name movement-dynamic --yes` or `sheet --number 8 --yes` | `sheets/sheet-008.png` | `movement-swish-pan`, `movement-swish-tilt`, `movement-tracking`, `movement-push-in` |
| 9 | `movement-rig-basic` | `sheet --name movement-rig-basic --yes` or `sheet --number 9 --yes` | `sheets/sheet-009.png` | `movement-pull-out`, `movement-zoom`, `rig-sticks`, `rig-hand-held` |
| 10 | `rig-mobile` | `sheet --name rig-mobile --yes` or `sheet --number 10 --yes` | `sheets/sheet-010.png` | `rig-gimbal`, `rig-slider`, `rig-jib`, `rig-drone` |
| 11 | `rig-elevated-lens` | `sheet --name rig-elevated-lens --yes` or `sheet --number 11 --yes` | `sheets/sheet-011.png` | `rig-dolly`, `rig-steadicam`, `rig-crane`, `lens-ultra-wide` |
| 12 | `lens-field` | `sheet --name lens-field --yes` or `sheet --number 12 --yes` | `sheets/sheet-012.png` | `lens-wide`, `lens-normal`, `lens-short-tele`, `lens-tele` |
| 13 | `focus-depth` | `sheet --name focus-depth --yes` or `sheet --number 13 --yes` | `sheets/sheet-013.png` | `lens-macro`, `focus-deep-focus`, `focus-shallow-focus`, `focus-rack-focus` |
| 14 | `focus-special` | `sheet --name focus-special --yes` or `sheet --number 14 --yes` | `sheets/sheet-014.png` | `focus-tilt-shift`, filler ignored, filler ignored, filler ignored |

## Motion Calls

Run after the still PNG exists and has been visually accepted. The still is the
agent-cropped output at `images/<motion-asset-id>.png`; it is created by slicing
the sheet listed in the source sheet column below. If that image file does not
exist, do not run motion generation yet.

| Motion asset | Source sheet | Command | Input | Output |
|--------------|--------------|---------|-------|--------|
| `movement-pan` | `movement-foundation` | `motion --asset movement-pan --yes` | `images/movement-pan.png` | `motion/movement-pan.mp4` |
| `movement-tilt` | `movement-foundation` | `motion --asset movement-tilt --yes` | `images/movement-tilt.png` | `motion/movement-tilt.mp4` |
| `movement-swish-pan` | `movement-dynamic` | `motion --asset movement-swish-pan --yes` | `images/movement-swish-pan.png` | `motion/movement-swish-pan.mp4` |
| `movement-swish-tilt` | `movement-dynamic` | `motion --asset movement-swish-tilt --yes` | `images/movement-swish-tilt.png` | `motion/movement-swish-tilt.mp4` |
| `movement-tracking` | `movement-dynamic` | `motion --asset movement-tracking --yes` | `images/movement-tracking.png` | `motion/movement-tracking.mp4` |
| `movement-push-in` | `movement-dynamic` | `motion --asset movement-push-in --yes` | `images/movement-push-in.png` | `motion/movement-push-in.mp4` |
| `movement-pull-out` | `movement-rig-basic` | `motion --asset movement-pull-out --yes` | `images/movement-pull-out.png` | `motion/movement-pull-out.mp4` |
| `movement-zoom` | `movement-rig-basic` | `motion --asset movement-zoom --yes` | `images/movement-zoom.png` | `motion/movement-zoom.mp4` |
| `focus-rack-focus` | `focus-depth` | `motion --asset focus-rack-focus --yes` | `images/focus-rack-focus.png` | `motion/focus-rack-focus.mp4` |
