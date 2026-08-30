# 0088 Use Exact Request References And Source-Derived Image Continuation

> **Decision 0089 update:** `video.edit` extends the source-derived pattern to
> every active registered video Asset. It is media-kind-wide rather than a type
> allowlist and creates a separate unselected sibling Asset with
> `edited-video-gxxx` storage.

Date: 2026-08-25

Status: accepted

## Context

Provider schemas and prompt syntax belong to standalone Engines and provider
Skills, while Core owns Project relationships and canonical attachment storage.
After generation was removed from Core, Studio was deriving reference mention
tokens from media kinds, and `image.edit` no longer had a truthful way to put an
accepted edit beside its source. Generic `image.create` also needs a concrete
product surface instead of becoming an unfindable Project-wide Asset.

## Decision

Every local-media occurrence in a reviewed provider request carries a required
`reviewLabel` and an optional exact `promptMention`. Core preserves occurrence
order and JSON Pointer identity, including repeated use of the same file. Studio
shows only these exact request references. It completes and decorates only
authored `promptMention` values: typed `@` opens matching `@` tokens, while
explicit editor completion exposes non-`@` tokens. Neither Core nor Studio
derives provider syntax or copies provider schemas.

Engines exposes the provider's existing live input-schema loader through
`MediaEngine.readInputSchema`; the CLI presents the raw result through
`renku generation schema show --provider <provider> --model <model> --json`.
Provider Skills use this technical schema together with retained editorial
prompt guides. No model-specific schema is stored in Core, Studio, or Skills.

`image.create` targets one exact Shot Plan. Its accepted output is a
Project-owned `shot_plan_video_reference` Asset, weakly authored from that Plan,
stored as `scenes/<scene-folder>/<NN>-shot-plan/reference-gxxx.<ext>`, and shown
in that Shot Plan's Assets tab under Reference Images.

`image.edit` accepts only an exact current image Asset whose current file occurs
in the saved request provenance. Core derives the destination from the source's
durable type and relationships. The edit creates a separate unselected
candidate, preserves the source and its selection, and reuses existing
destination and persistence owners:

| Source type | Destination and exact generated storage |
| --- | --- |
| `project_cover` | Project Covers — `covers/cover-gxxx.<ext>` |
| `cast_profile` | same Cast — `cast/<handle>/profile-gxxx.<ext>` |
| `character_sheet` | same Cast — `cast/<handle>/<semantic>-sheet-gxxx.<ext>` |
| `location_hero` | same Location — `locations/<handle>/hero-gxxx.<ext>` |
| `location_sheet` | same Location — `locations/<handle>/<semantic>-sheet-gxxx.<ext>` |
| `prop_hero` | same Prop — `props/<handle>/hero-gxxx.<ext>` |
| `prop_sheet` | same Prop — `props/<handle>/<semantic>-sheet-gxxx.<ext>` |
| `lookbook_image` | same Lookbook and new image detail row — `visual-language/lookbooks/<kind>/<semantic>-gxxx.<ext>` |
| `lookbook_sheet` | same Lookbook and new sheet detail row — `visual-language/lookbooks/<kind>/<semantic>-sheet-gxxx.<ext>` |
| `scene_storyboard_image` | same active Beat, new iteration — `storyboards/<scene>/<iteration>/s<scene>-b<beat>-image-gxxx.<ext>` |
| `shot_image` | same Shot and Plan — `scenes/<scene>/<NN>-shot-plan/shot-images/shot<shot>-gxxx.<ext>` |
| `shot_plan_video_first_frame` | same authored Plan — `scenes/<scene>/<NN>-shot-plan/first-frame-gxxx.<ext>` |
| `shot_plan_video_last_frame` | same authored Plan — `scenes/<scene>/<NN>-shot-plan/last-frame-gxxx.<ext>` |
| `shot_plan_video_storyboard` | same authored Plan — `scenes/<scene>/<NN>-shot-plan/storyboard-gxxx.<ext>` |
| `shot_plan_video_reference` | same authored Plan — `scenes/<scene>/<NN>-shot-plan/reference-gxxx.<ext>` |

Unknown image types and stale or mismatched owner/detail relationships fail
before persistence. There is no destination flag, path inference, owner guess,
generic Project attachment fallback, or automatic selection.

Studio adds a Shot Plan Assets projection grouped as First Frames, Last Frames,
Storyboards, and Reference Images. Beat Storyboard candidates are managed from
the selected Beat through the existing MediaCard collection dialog. Both
surfaces reuse existing preview, request inspection, selection, Trash, and
resource-refresh contracts.

## Consequences

- Provider/model additions do not require Core or Studio schema changes.
- Editorial prompt quality remains in retained model guides, independently of
  live technical schema validation.
- Every accepted image is findable at the product surface that owns its source
  or Shot Plan context.
- Paid provider E2E suites remain manual, test-specific opt-ins and never run as
  part of normal build, test, check, or release commands.

## Verification

Unit and integration tests cover annotated marker occurrence projection, exact
completion tokens, schema delegation, every current continuation type and
canonical path family, source-selection preservation, focused Plan/Beat
selection and discard, route contracts, six prompt-editor visual baselines,
Skills guide registries/validators, and disabled-by-default provider E2E suites.
