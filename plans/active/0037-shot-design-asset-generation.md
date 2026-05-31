# 0037 Shot Design Asset Generation

Date: 2026-05-30

Status: implemented

Companion to `0036-shot-design-tabs.md`.

## Outcome

The reusable asset-generation workflow has been created as a project-local
Codex skill:

```text
.agents/skills/generate-assets/
```

Use it by asking for `$generate-assets`. The skill now owns the generation and
QA procedure for Shot Design app-included assets:

- generate a consistency reference image;
- generate one 3x3 sheet at a time;
- inspect each returned sheet with agent vision;
- manually crop accepted cells with ImageMagick from vision-selected crop boxes;
- inspect every cropped tile;
- generate one motion preview at a time after the matching still is accepted;
- keep provider calls and manifest bookkeeping in the bundled helper script.

The helper script intentionally does **not** slice sheets:

```text
.agents/skills/generate-assets/scripts/generate-shot-design-asset.mjs
```

The generation map, model choices, provider parameters, visual direction, sheet
contents, motion ids, and review gates live in:

```text
.agents/skills/generate-assets/references/shot-design-asset-map.md
```

## Boundary

This plan no longer tracks the actual content-generation run. That work is an
operator/agent workflow executed with `$generate-assets`, not an app code task.

The generated assets should land under:

```text
packages/studio/src/features/movie-studio/scenes/shot-design-assets/generated/
```

Expected generated outputs:

```text
reference/consistency-sheet.png
sheets/sheet-001.png ... sheet-006.png
images/<asset-id>.png
motion/<motion-asset-id>.mp4
manifest.json
```

## App Work

The remaining application implementation belongs to `0036-shot-design-tabs.md`,
not this generation workflow plan. In particular:

- wire approved generated assets into `shot-design-vocabulary.ts`;
- implement the option tile image treatment: black-and-white idle, color on
  hover, color when selected;
- build the Shot Design tabs and persistence flow described in `0036`.

## Completed Checklist

- [x] Create the project-local `$generate-assets` skill.
- [x] Add a helper script for provider calls and manifest bookkeeping.
- [x] Keep slicing outside the helper script.
- [x] Document that agent vision must choose crop boxes for each returned sheet.
- [x] Document one-at-a-time reference, sheet, and motion generation.
- [x] Document the consistency reference flow for character, palette,
      environment, lighting, and framing consistency.
- [x] Validate the skill with `quick_validate.py`.

## Notes

- Do not pass `FAL_KEY` on the command line; the helper reads the project root
  `.env` and `.env.local`.
- Do not reintroduce a root `scripts/generate-shot-design-assets.mjs` workflow.
- Do not add automatic grid slicing, crop detection, OCR, or a reusable crop-plan
  format. Cropping is an agent-side visual QA step.
