# 0080 Use Storyboard Lookbook As Beat Storyboard Appearance Authority

Date: 2026-08-16

Status: accepted

## Context

Beat Storyboards help directors, screenwriters, and collaborators align on
ordered narrative development before production camera coverage is authored.
The prior workflow mixed Storyboard and Production Lookbook guidance, described
Storyboard Lookbooks mainly as drawing language, omitted complete Prop context,
and did not clearly separate Scene Beat cardinality from the four-panel request
optimization.

Codex built-in GPT Image 2 now supports reference-guided generation outside
Renku-managed provider execution. It needs an exact saved request and reference
contract without becoming an Engines provider or moving creative prompt and
image interpretation into Core.

## Decision

The current Storyboard Lookbook is the sole appearance authority for every Beat
Storyboard request. A Storyboard Lookbook may define photorealistic, realistic,
illustrative, graphic, painterly, hand-drawn, abstract, or another deliberate
visual language. Skills add no default medium, realism, warmth, monochrome
treatment, finish, lighting treatment, grade, or Production Lookbook styling.

The agent workflow reads the complete Storyboard Lookbook and attaches one
exact usable Storyboard Lookbook Sheet to every request. Missing role or Sheet
readiness stops generation and routes to Lookbook authoring or Sheet
preparation. This remains an agent-workflow prerequisite: Core does not
auto-select a candidate, reject an incomplete request solely because the slot
is empty, parse prompts, or validate generated image contents.

Continuity references have separate roles:

- the Storyboard Lookbook Sheet controls rendering appearance;
- Character Sheets preserve canonical identity, silhouette, proportions,
  costume, hair, and distinguishing details;
- Location Sheets preserve canonical geography, landmarks, architecture, and
  recognizable set features; and
- Prop Sheets preserve canonical construction, geometry, scale, materials,
  markings, condition, and Beat-specific state.

Continuity subjects are re-rendered in the Storyboard Lookbook's visual
language. A realistic Production continuity sheet does not make a stylized
Storyboard realistic. Style-driven simplification is allowed only while the
subject remains unmistakably the same.

Scene Beat Designer authors the narrative-appropriate number of Beats without
a four-Beat cap or generation grouping. After an exact revision exists, Media
Producer partitions only the requested saved Beat images into consecutive
groups of at most four. Ten Beats therefore become image requests covering
4 + 4 + 2 without changing Beat identity, content, or order and without filler.

Each request produces one high-resolution full storyboard composite containing
one complete Project-ratio panel per Beat. Panels are not thumbnails and four
panels are not four provider output variants. The accepted Core composite
layout and agent-owned vision-guided crop workflow remain unchanged.

The Project has one image-generation setting: **Use Codex for image
generation**. It is on by default. With it on, the Scene Storyboard request is
an agent-external, saved, reviewed, and frozen `codex/gpt-image-2` request. Its
authored values contain only the exact prompt; selected images remain logical
references supplied to the built-in tool. Codex remains outside Engines and
has no invented structured size, quality, output-count, or input-fidelity
fields.

With the setting off, or when the user explicitly chooses Renku for the
request, Scene Storyboards use `fal-ai/openai/gpt-image-2/edit` because the
workflow requires image references. The purpose exposes no second model
recommendation. Core continues to fix managed quality to high.

Core adds `scenePropIds` to generic Scene and Shot generation facts, derived in
first-seen order from canonical Screenplay Scene references followed by active
Scene Beat `propIds`. The Scene Storyboard reference guide adds one exact
request-scoped Prop Sheet slot per id. CLI continues to return Core Generation
Context unchanged.

Agents gather narrative and continuity context, translate narrative fields into
concrete visible panel direction, author exact reference roles, and perform
visual review. Runtime keeps prompts and media opaque. Each approved request
has one bounded QA pass: generate once, analyze once, use the existing crop and
crop-inspection path, then accept useful images or report the issue and stop.
No automatic image edit, repair prompt, retry, or regeneration loop is added.

Beat Storyboards remain pre-production story-alignment artifacts. Shot Plans
remain director/cinematographer production-planning artifacts for deliberate
camera coverage, framing, optics, movement, focus, lighting intent, blocking,
and approximate duration.

## Consequences

- Storyboard appearance is predictable without restricting the range of valid
  Storyboard visual languages.
- Exact Character, Location, and Prop continuity can survive a change in
  rendering style without importing Production reference finish.
- Scene Beat design stays narratively correct while image requests retain the
  accepted cost optimization.
- Core exposes truthful factual context and request-scoped candidates without
  creative interpretation or automatic choice.
- CLI, Engines, the database schema, and the existing composite/crop
  implementation require no production changes. Studio changes only the copy
  on its existing image-generation setting.
- A later retry is a fresh reviewed request and usage/cost boundary, not an
  automatic continuation of visual QA.

This decision narrows Decisions 0035 and 0048 where they describe Production
Lookbook influence or Storyboard Lookbooks as necessarily drawing-oriented.
