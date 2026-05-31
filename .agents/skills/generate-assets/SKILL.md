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

The approved Shot Design asset direction for still sheets is **Pastel Mustard
Lobby**. This direction was chosen because it fits Renku Studio's product design
system better than the earlier pink-heavy palace reference:

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
- Motion previews should be generated from accepted dedicated `16:9` start
  frames and should preserve that framing.

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

## Subject Perspective Shot Grammar

Use precise cinematography definitions for the subject perspective sheet:

- **Over-the-shoulder**: a close dialogue setup. A blurred foreground shoulder
  and back of head frame the subject across a table or conversational distance.
  The subject should usually be in close-up or medium close-up, not a tiny
  full-body figure across the room. For the bundled Shot Design assets, use
  another woman as the foreground figure, not a man.
- **Over-the-hip**: similar to over-the-shoulder, but the foreground shape is a
  character's hip/waist/side. It often works when one character is standing and
  the other is sitting, kneeling, or lower in frame, creating an uneven-terrain
  or power-imbalance feeling. The focused subject remains visible beyond the
  hip foreground. For the bundled Shot Design assets, use a standing woman as
  the foreground figure, not a man.
- **Point of view**: show what the character sees. Do not show the subject
  whose POV it is: no face, dress, hands, or body of the main woman. The camera
  is the subject's eyes. The viewed people or important scene detail should be
  sharp and readable, not dreamy or blurred. For this bundled sheet, use women
  as viewed characters and avoid men.
- **Insert**: isolate an important scene detail, object, or small action that
  directs attention. It is not a portrait of the subject.

## Camera Angle And Height Grammar

Use precise cinematography definitions for the angle sheets:

- **Reaction shot**: a close or medium-close shot of the subject responding to
  something off-camera. It is about the subject's response and eyeline, not a
  new camera height.
- **Eye level**: the camera lens is at the subject's eye height. The view feels
  neutral and straight-on, with no obvious looking up or down.
- **Low angle**: the camera is below the subject's eye line and looks upward.
  The subject and architecture should feel taller or more imposing. Include
  ceiling or upper architecture when useful to make the upward angle clear.
- **High angle**: the camera is above the subject and looks down obliquely. The
  subject should feel smaller within the room or floor pattern. This is not a
  straight-down overhead shot.
- **Overhead**: a true top-down or bird's-eye view from above. The floor pattern
  should dominate and the walls should have minimal perspective.
- **Shoulder level**: the camera sits around shoulder height, slightly below eye
  level. It frames upper torso/shoulders with a grounded feeling.
- **Hip level**: the camera is placed near the subject's waist or hip height.
  This is a camera-height shot, not an over-the-hip foreground framing.
- **Knee level**: the camera is near knee height. It emphasizes legs, lower
  wardrobe, floor pattern, and rising vertical architecture. It is low, but not
  ground level.

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
11. Generate motion previews from dedicated motion start frames, not from sheet
    cells. Movement UI tiles can describe the concept, but the video model needs
    a clean first frame that is composed specifically for animation.

Generate exactly one motion start frame first:

```bash
node .agents/skills/generate-assets/scripts/generate-shot-design-asset.mjs motion-frame --asset movement-pan --yes
```

Motion start frames use a separate **Pastel Garden Hotel Exterior** direction.
This exterior direction applies only to motion previews, because lobby motion
clips read too much like a travel or hotel-booking product. Use a real exterior
filming location: elegant European hotel, manor, or villa facade, garden path,
terrace, hedges, fountain, stone steps, veranda, balcony, arched windows,
shutters, and planted foreground layers. Do not show lobby interiors, reception
desks, check-in counters, luggage, guests, tourism signage, street storefronts,
film sets, soundstages, visible crew, cameras, lights, set flats, floor tape, or
behind-the-scenes production language.

Inspect the returned `16:9` PNG with vision. Accept it only if it is a useful
first frame for the requested camera move: consistent character identity,
wardrobe when a subject is required, palette, and exterior location; enough
architecture, garden depth, and off-screen space for the motion to read; no
explanatory blur unless the asset is a swish/whip movement.

After `movement-pan` has been accepted, use
`generated/images/movement-pan.png` as the binding exterior location reference
for the other movement start frames. Keep the same hotel facade, garden,
fountain, terrace, paths, hedges, color, and time of day while changing only the
camera height/framing needed to demonstrate each movement.

Motion starts from the accepted start frame:

```text
packages/studio/src/features/movie-studio/scenes/shot-design-assets/generated/images/<motion-asset-id>.png
```

Then generate exactly one motion preview:

```bash
node .agents/skills/generate-assets/scripts/generate-shot-design-asset.mjs motion --asset movement-pan --yes
```

12. Inspect the MP4 before generating the next motion preview.

## Non-Negotiables

- Do not run all sheets in one shot.
- Do not run all motion videos in one shot.
- Do not use ordinary movement sheet cells as motion-video source frames unless
  the user explicitly accepts that specific frame as a start frame.
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
- `motion-frame --asset <motion-id> --yes`: generate one dedicated `16:9`
  first-frame PNG in `generated/images/<motion-id>.png` for a motion asset.
- `motion --asset <motion-id> --yes`: generate one MP4 from an accepted motion
  start frame in `generated/images/<motion-id>.png`. The default is a
  small-UI-friendly `4s` clip at `480p`; use `--duration <1-15>` or
  `--resolution 720p` only when the user explicitly asks.

The helper writes `generated/manifest.json`. It never crops a sheet.
