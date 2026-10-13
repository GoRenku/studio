# 0115 Use Project Generation Lanes As Agent Defaults

Date: 2026-10-12

Status: accepted

Updates [ADR 0074](0074-use-core-owned-project-workflow-settings.md) and
[ADR 0103](0103-show-keyed-providers-as-agent-defaults.md).

## Context

Project Settings held one provider per output media kind and no model. Image
creation and image editing shared one Image setting, and the Media Producer
Skill overrode it for edits. Nothing let the user confirm the provider and
model before a generation, and "Show Generation Previews" only drove the
retired Visualize path.

## Decision

- A **generation lane** is one group of generation defaults. The boundary is
  generating new media versus editing existing media; operation variants such
  as image-to-video do not get their own lanes. Studio ships four lanes:
  Image Generation (`image`), Image Editing (`imageEdit`), Video Generation
  (`video`) and Audio Generation (`audio`). Video Editing is added when video
  editing ships; `video.edit` stays in `video` until then.
- Core owns `GenerationLane`, `GENERATION_LANES` and
  `MEDIA_PURPOSE_GENERATION_LANES`. Every lane listing in Studio, Codex and
  the CLI is driven by them; no layer switches on lane names.
- Project Settings version 7 gives each lane `provider`, `model`,
  `chooseRouteBeforeGenerating`, `askBeforeGenerating`,
  `runGenerationsConcurrently` and `maxConcurrentGenerations`. `model` is
  null (the Skill's recommendation for the provider) or `{ key, name }`, a
  Skill model guide key and its display name. Core validates only that
  envelope; it never interprets a key.
- `displayPreview` is removed. A one-way Drizzle data migration converts v6
  documents: it adds Image Editing (Fal.ai, Ask on), `model: null` and
  `chooseRouteBeforeGenerating: true` on every lane.
- `updateGenerationLaneSettings` is the focused writer used by the CLI
  (`renku settings generation set`), the Route Chooser and the generation
  review. Changing the provider without a model clears the model.
- `GenerationWorkflowPolicy` resolves by lane and carries `lane`, `provider`,
  `model`, `chooseRouteBeforeGenerating`, `askBeforeGenerating` and the
  concurrency limit.
- "Choose Provider and Model Each Time" defaults on. The Route Chooser
  (Codex) or one short question (other harnesses) runs before authoring; its
  "Don't ask again" box turns the lane setting off.
- The keyless host provider is named once in Core
  (`HOST_GENERATION_PROVIDER`, "Codex (built-in)") and offered in Image
  Generation and Image Editing.

## Consequences

- Settings are the single source of truth for generation defaults and
  interruptions; Skills never override them silently.
- An unset or missing default opens the chooser even when Choose is off, and
  the agent says why.
- Projects need the v7 migration before they open.
