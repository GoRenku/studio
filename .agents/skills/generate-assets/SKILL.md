---
name: generate-assets
description: Generate Renku Studio bundled UI asset sheets one at a time, especially Shot Design tile assets, using fal.ai provider helpers, a consistency reference image, agent vision for sheet review and slicing, ImageMagick manual crops, and one-by-one motion video previews. Use when the user says "$generate-assets", asks to generate app-included assets, asks to generate or slice Shot Design assets, or wants reviewed one-at-a-time asset generation in the Studio repo.
---

# Generate Assets

Use this skill in `/Users/keremk/Projects/aitinkerbox/studio` to generate
bundled Studio UI assets with review gates. The important rule: **the script
does not slice sheets**. You, the agent, inspect generated images with vision,
choose crop boxes, crop with ImageMagick, inspect the slices, and iterate.

## Shot Design Visual Direction

The approved Shot Design asset direction is **Pastel Mustard Lobby**. This direction
was chosen because it fits Renku Studio's product design system better than the
earlier pink-heavy palace reference:

- the app's light theme uses warm amber, golden, and parchment surfaces;
- the app's dark theme keeps amber as the primary identity color against neutral
  gray surfaces;
- a softened mustard/ochre reference gives the tiles a cinematic, architectural
  feeling without making the Studio UI read as overly pink or feminine;
- the tone should still feel pastel and gentle, closer to the first reference's
  softness than the saturated mustard blazer result.

Use this palette as the generation anchor:

| Role | Color | Hex | Notes |
|------|-------|-----|-------|
| Dominant | pastel ochre / antique gold | `#D6BE79` | architectural trim, wall warmth, upholstery, carpet, or lamp-glow family |
| Base | parchment cream | `#F1E8D6` | plaster, ceiling, marble, and broad neutral surfaces |
| Secondary | pale mint-sage | `#B8C8B6` | performer wardrobe, upholstery, painted panels, plants, or secondary room accents |
| Material accent | muted terracotta | `#C58D74` | tile, stone, wood warmth, and grounded architectural details |
| Small dramatic accent | softened oxblood | `#7D3A45` | curtains, chair fabric, narrow trim, props; use sparingly |
| Deep detail | warm ink | `#302A25` | shadows, dark wood, hair, hardware, and contrast lines |

Important color rules:

- Do not make blush, rose, or pink the dominant palette.
- Dusty rose-plaster warmth may appear as a subtle background temperature, but
  it should never define the room.
- Avoid bright warning-yellow. Prefer muted ochre, antique gold, mustard
  plaster, aged parchment, and warm hotel-lobby materials.
- Include enough warm ink, oxblood, wood, and shadow detail for tiles to read
  clearly in both light and dark Studio themes.
- Keep the source images in color. Studio applies black-and-white idle
  treatment, color hover treatment, and color selected treatment in CSS.

The preferred recurring character is closer to the first generated reference:
center-parted brown hair pinned into a neat low bun, soft oval face, understated
expression, and a cream dress with pale mint-sage paneling. Do not use the later
mustard blazer character. Keep wardrobe, hairstyle, and accessories locked:

- no jackets or blazers;
- no handbags;
- no jewelry or changing accessories;
- no hairstyle changes between panels;
- no historic-costume specifics, even though the silhouette may feel refined and
  theatrical.

## Shot Design Output Geometry

- The consistency reference is a `4:3` image.
- Each generated sheet is a `4:3` image.
- Each sheet contains exactly four separate `16:9` stills in a 2x2 arrangement.
- Final sliced stills in `generated/images/*.png` should be `16:9`.
- Motion previews should be generated from accepted `16:9` stills and should
  also use `16:9`.

This intentionally replaces the old square 3x3 sheet structure. The 2x2 sheet
structure increases the number of sheets, but gives every final UI tile the
right cinematic aspect ratio.

## Nano Banana Pro Reference Prompt Notes

When writing or revising prompts for `fal-ai/nano-banana-pro` and
`fal-ai/nano-banana-pro/edit`, follow these practices:

- Use supported aspect ratios deliberately: `4:3` for reference and sheets,
  `16:9` for final still crops and motion.
- Treat the consistency reference as a binding source for identity, wardrobe,
  palette, lighting, and production design.
- Put identity locks in concrete visual language: face shape, hair, wardrobe,
  accessories to exclude, and what must not change.
- Avoid asking the model to invent optional accessories; every accessory becomes
  a consistency risk.
- Keep sheet prompts simple and enumerable: exactly four cells, in reading
  order, with one intended visual concept per cell.
- Ask for no text, labels, numbers, logos, watermarks, crop marks, or UI
  controls in generated images.
- Inspect every result with vision. If identity, wardrobe, palette, or cell
  layout drifts, regenerate before slicing.

## Core Workflow

1. Read `references/shot-design-asset-map.md` when generating Shot Design assets.
2. Run status first to see what already exists:

```bash
node .agents/skills/generate-assets/scripts/generate-shot-design-asset.mjs status
```

3. Run the helper dry run when you need the planned sheet list:

```bash
node .agents/skills/generate-assets/scripts/generate-shot-design-asset.mjs
```

4. If the user asks for only the consistency reference:

- If `reference/consistency-sheet.png` already exists, inspect it with vision and
  show it to the user. Do not regenerate unless the user asks for a replacement.
- If the existing reference is the earlier pink-heavy palace direction or the
  later saturated mustard blazer direction, treat it as unapproved for future
  sheets. Ask the user whether to replace it with the approved Pastel Mustard
  Lobby direction before generating any sheet.
- If it is missing, generate it:

```bash
node .agents/skills/generate-assets/scripts/generate-shot-design-asset.mjs reference --yes
```

If the user explicitly asks to replace the existing reference, run:

```bash
node .agents/skills/generate-assets/scripts/generate-shot-design-asset.mjs reference --yes --force
```

Then inspect it with vision, show it to the user, and stop for approval.

5. If the user asks for a sheet by number, by name, or as "the first/next sheet":

- Check whether `reference/consistency-sheet.png` exists.
- If the reference is missing, generate only the reference, inspect it with
  vision, show it to the user, and stop for approval before generating the
  requested sheet.
- If the reference exists but has not been approved in the current conversation,
  inspect it with vision, show it to the user, and ask whether to use it or
  regenerate it.
- After approval, generate exactly one requested sheet.

Examples:

```bash
node .agents/skills/generate-assets/scripts/generate-shot-design-asset.mjs sheet --number 1 --yes
node .agents/skills/generate-assets/scripts/generate-shot-design-asset.mjs sheet --name shot-size-close --yes
```

6. Inspect the returned sheet with vision. If it is not consistent or useful,
   regenerate that sheet before slicing. If the sheet is usable, proceed
   directly to manual slicing without waiting for another user approval.
7. Use vision to identify each usable tile image block. Crop manually with ImageMagick. Example:

```bash
magick packages/studio/src/features/movie-studio/scenes/shot-design-assets/generated/sheets/sheet-001.png -crop 800x450+40+60 +repage packages/studio/src/features/movie-studio/scenes/shot-design-assets/generated/images/shot-size-extreme-close-up.png
```

8. Inspect every cropped PNG with vision. Adjust the crop and rerun `magick` until the tile is clean. Crop around image content; exclude gutters, labels, borders, and sheet background.
9. Show the user the generated sheet and slices after slicing. Do not wait for
   approval between a usable sheet and its slices.
10. Repeat sheet generation, vision slicing, and review one sheet at a time.
11. Generate motion only after the matching sliced still exists and has been
    accepted. Motion starts from:

```text
packages/studio/src/features/movie-studio/scenes/shot-design-assets/generated/images/<motion-asset-id>.png
```

If the still is missing, use the sheet map to find which sheet contains that
asset, generate/slice that sheet first, inspect the slice, and stop for approval.
Then generate exactly one motion preview:

```bash
node .agents/skills/generate-assets/scripts/generate-shot-design-asset.mjs motion --asset movement-pan --yes
```

12. Inspect the MP4 before generating the next motion preview.

## Non-Negotiables

- Do not run all sheets in one shot.
- Do not run all motion videos in one shot.
- Do not generate a new consistency reference if one already exists unless the
  user asks to replace it.
- Do not proceed from a newly generated consistency reference to a sheet until
  the user has inspected and approved the reference.
- After the consistency reference is approved, do not stop for approval between
  a usable generated sheet and manual slicing. Slice immediately unless visual
  inspection finds a problem that requires regeneration.
- Do not implement or use automatic grid slicing, border detection, OCR,
  estimated equal-cell coordinates, rough quadrants, or crop metadata generated
  by a script.
- Do not copy the user's screenshot or exact source imagery. It is only a
  consistency example.
- Do not pass `FAL_KEY` on the command line. The helper reads the project root
  `.env` and `.env.local`.
- Do not call a paid provider command without `--yes`.

## Vision-Guided Cropping

Treat cropping like storyboard/location slicing in the media producer workflow:

- Use vision on the actual returned sheet.
- Choose crop boxes for this specific image.
- Crop only visual tile content.
- Inspect every crop after ImageMagick writes it.
- If a cell is malformed, tell the user and regenerate the sheet or cell source;
  do not rescue it with clever code.

The manifest may record output paths and provider request ids, but do not store
crop boxes as app state. Crop mechanics are an agent-side build detail.

## Helper Script

Use `scripts/generate-shot-design-asset.mjs` for provider calls only:

- `plan` or no command: print planned sheets and costs.
- `status`: print whether the reference, sheets, slices, and motion files exist.
- `reference --yes`: generate `reference/consistency-sheet.png`.
- `reference --yes --force`: replace an existing rejected reference after the
  user explicitly approves regeneration.
- `sheet --number <1-14> --yes`: generate one 2x2 sheet using the consistency
  reference through `fal-ai/nano-banana-pro/edit`.
- `sheet --name <sheet-name> --yes`: same as `--number`, using the stable sheet
  names from `references/shot-design-asset-map.md`.
- `motion --asset <motion-id> --yes`: generate one MP4 from an accepted sliced
  still in `generated/images/<motion-id>.png`.

The helper writes `generated/manifest.json`. It never crops a sheet.
