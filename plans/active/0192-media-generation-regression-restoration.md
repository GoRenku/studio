# 0192 Media Generation Regression Restoration

Status: implemented
Date: 2026-08-25

Implementation verification: completed 2026-08-25. Ordinary build, typecheck,
lint, architecture, release-contract, Core, CLI, Engines, Studio, Studio Skills,
and prompt-editor desktop regression suites pass. The paid provider E2E suites
were restored but were not executed because no separate approval was given.

## Review Attention

- Restore the media-generation behavior that was unintentionally lost while
  Core Generation Specs/Runs were removed and provider execution moved into
  standalone Engines. This is a regression-restoration plan, not a return to
  the deleted Core-owned generation lifecycle.
- Keep Plan 0191's implemented deterministic domain context. Context continues
  to provide current Project facts and advisory candidate references; it does
  **not** become the prompt completion list and does not choose provider inputs.
- Add provider-neutral request-marker annotations `reviewLabel` and optional
  `promptMention`. Media Producer supplies the contextual label for each exact
  selected input; the exact provider Skill preserves that label and authors the
  model-native mention after placing inputs in the native request. Studio
  presents the exact opaque token; it never
  derives `@ImageN`, `Image 1`, or any other model syntax from provider/model
  names, field names, paths, or media order.
- Preserve the complete contents of the existing curated editorial prompt
  guidance while moving it into one organized Media Producer
  `references/prompt-guides/` hierarchy, together with the two restored guide
  registries and validators. Do not author new model guidance or expand guide
  coverage in this regression slice. Only path/link updates and mechanical
  edits needed to replace obsolete GenerationSpec/descriptor commands with the
  current review/live-schema workflow are allowed; the curated editorial
  advice, examples, source provenance, and review dates remain intact.
- Do **not** recreate checked-in provider schemas, provider/model field maps,
  defaults, bounds, pricing, model capability catalogs, or Studio presentation
  schemas. Add one read-only Engines/CLI input-schema inspection surface that
  returns the provider's current native schema from the existing live metadata
  loaders. Skills use it as current field authority.
- Change `image.create` from Project target to exact Shot Plan target. An
  accepted output is a generic Plan reference image stored at
  `scenes/<scene>/<NN>-shot-plan/reference-gxxx.<ext>` and shown in the selected
  Shot Plan's new Assets view next to its Shots view. It is not attached to a
  guessed Shot and is not placed in a generic Project library.
- Change `image.edit` attachment semantics. The `asset:<sourceAssetId>` target
  is both the edit source and the attachment-continuation source. Core resolves
  the source Asset's durable owner, type, and, when applicable, weak Shot Plan
  provenance; it creates a separate unselected candidate in the same product
  collection and canonical folder. CLI, Studio, Skills, titles, and paths never
  guess the destination.
- Add a Shot Plan-local Assets view. This is behavior beyond merely accepting
  `renku media import`, but it is required to meet the explicit discoverability
  requirement. It shows current Plan first-frame, last-frame, storyboard, and
  reference candidates resolved by exact `authoredFrom` Shot Plan id.
- Add a Beat-local Storyboard image candidate dialog. Core already projects all
  Storyboard candidates per Beat, but Studio currently renders only the selected
  image. Without this surface, an edited Beat image would be correctly owned and
  stored yet remain undiscoverable. The dialog reuses the existing
  `SceneStoryboardStatus` projection and focused Asset selection/discard rules.
- Edited results do not replace, discard, or automatically select the source.
  Existing selection state remains unchanged. The new candidate appears in the
  same Assets/candidate surface and can be selected through the existing
  focused selection command where that collection has selection semantics.
- Restore the six removed Studio prompt-editor snapshots, the paid provider E2E
  suites for Fal.ai, Replicate, WaveSpeed, and three ElevenLabs paths, and the
  purpose-specific forward-eval and prompt-guide validator coverage. Paid tests
  remain manual, test-specific opt-ins and must not run during implementation
  without separate user approval.
- Add Decision 0088 for exact request-reference annotations and source-derived
  image attachment continuation. Add concise update notices to Decisions 0046,
  0058, 0086, and 0087 rather than rewriting their historical bodies.
- No database schema or migration is planned. Urban Basilica and Big Fish are
  the only development databases and already use the current Asset ownership,
  type, file, and `authoredFromShotPlanId` records needed by this plan. If the
  implementation discovers that a listed current image type cannot be resolved
  without new durable state, stop and revise this plan before changing Drizzle
  schema.
- Plan 0190 (Pika) remains unimplemented and out of scope. This plan must leave
  the provider seam ready for it, but must not add Pika code, credentials,
  Settings, models, or tests.

## Summary

Plan 0189 correctly removed the Core-owned provider generation lifecycle and
made Engines a standalone provider-protocol package. Plan 0191 correctly
restored deterministic Project/domain context. The uncommitted refactor still
contains several unintended regressions around the seams that remain:

1. Studio invents `@ImageN`, `@VideoN`, and `@AudioN` completion tokens from
   the order of every selected request reference. That is wrong for models such
   as MiniMax H3, which uses `Image 1` without `@`, and it cannot represent
   implicit references that must not be mentioned in the prompt.
2. Provider Skills route several materially different models to generic
   operation guides. Much of the curated editorial knowledge and source
   provenance in Media Producer was shortened or disconnected.
3. Provider Skills are told to read a current native schema, but no public CLI
   command exposes the live schema that Engines already retrieves for Fal.ai,
   Replicate, and WaveSpeed.
4. Manual paid provider E2E tests were deleted instead of being adapted to the
   standalone `MediaEngine` contract.
5. Six prompt-editor visual snapshots were deleted.
6. `renku media import` rejects `image.create` and `image.edit` because the
   attachment registry has no current destination for either purpose.
7. The former purpose-specific forward evaluations and prompt-guide validators
   were reduced to broad structural checks that no longer protect editorial
   prompt quality, route semantics, or the complete media-purpose workflow.

The smallest architecture-correct repair keeps each fact with its owner:

- Core owns domain context, durable Asset relationships, source-derived image
  attachment continuation, canonical project-visible paths, and safe review /
  provenance projection.
- Media Producer owns exact reference selection, contextual review labels, and
  the restored curated editorial prompt guides. Provider Skills own exact
  provider-native request authorship, including provider-native mention tokens
  and technical operation guidance.
- Engines owns live provider input-schema retrieval, validation, execution, and
  local-file substitution.
- CLI remains a thin caller of Core and Engines.
- Studio renders only the exact selected request references and exact authored
  tokens, and projects Core-owned Shot Plan Assets without enforcing domain
  rules in React.

## Requirement Ledger

| ID | Requirement | Source | Owning boundary | Verification |
| --- | --- | --- | --- | --- |
| R1 | Keep Plan 0191 deterministic purpose/target context and advisory candidate references. | Accepted user direction; Decision 0087 | Core context projection | Existing 0191 tests plus regression cases in this plan |
| R2 | Build prompt completions only from exact references selected in the provider-native request, never from all context candidates or all Project Assets. | User | Provider Skill authorship; Core review projection; Studio editor | Core projection and Studio completion tests; Urban Basilica audit |
| R3 | Support exact provider-native mention strings, including non-`@` forms and references with no prompt mention. | User | Provider Skills and provider-neutral review envelope | Seedance, MiniMax, implicit-reference fixtures and snapshots |
| R4 | Do not introduce a hard-coded schema or provider/model field map in Core, Studio, CLI, or Skills indexes. | User; Decisions 0086/0087 | Engines live metadata; boundary guardrails | Import/static checks and Skill validator |
| R5 | Expose current provider input schemas through a bounded read-only Engines API and thin CLI command. | Necessary architecture seam | Engines; CLI delegation | Deterministic metadata tests and CLI tests |
| R6 | Preserve the existing curated editorial prompt guidance and provenance while moving it into a coherent modality/shared/model-family folder structure; add no missing-model guidance. | User | `studio-skills` Media Producer | Move-inventory checks, restored guide-registry validators, and forward evals |
| R7 | Keep model indexes limited to exact route id, human name, input modes, and guide path. | Decision 0087; user | Provider Skills | Structural validator |
| R8 | Restore explicit manual paid E2E coverage for Fal.ai, Replicate, WaveSpeed, and the three retained ElevenLabs paths. | User | Engines tests | Opt-in suite inventory; no paid default execution |
| R9 | Restore prompt-editor snapshots and cover exact-token completion, preview, and inspection behavior. | User | Studio shared request UI | Six restored snapshots plus focused component tests |
| R10 | Accept `image.create` as a generic Shot Plan reference-image purpose and store/show it beside the exact Shot Plan. | User | Core attachment/storage/projection; Studio Shot Plan view | Core path/ownership tests, route/component tests, Urban audit |
| R11 | Attach `image.edit` output as a separate candidate in the source Asset's exact current product collection without guessing or automatic selection. | User | Core source-derived continuation | Exhaustive current image-type matrix tests and no-write failures |
| R12 | Preserve every current image Asset type's canonical folder, generated filename stem, owner relationship, detail row, selection scope, and resource refresh behavior. | User; storage architecture | Core project-asset-files and focused domain persistence | Matrix tests and real database read-only audit |
| R13 | Restore purpose-specific Media Producer forward evaluations on the new context/review/validate/execute/import workflow. | User | `studio-skills` Media Producer evals | Eval inventory and release validation |
| R14 | Restore prompt-guide validators without reviving Generation Specs, checked-in descriptors, or obsolete CLI commands. | User | `studio-skills` scripts | Restored image/video validator commands and forbidden-language checks |
| R15 | Keep prompt and media contents opaque at runtime. | AGENTS.md; Decision 0041 | Core/Studio/Engines boundaries | No prompt-semantic validators; focused architecture review |
| R16 | Do not implement Pika or add database migration hardening for a customer fleet. | User | Scope boundary | Diff inspection |

## Context And Evidence

### Accepted architecture to preserve

- `docs/decisions/0086-use-skill-directed-provider-engines-and-asset-generation-provenance.md`
  assigns provider-native request authorship to Skills, provider protocols to
  standalone Engines, safe review/provenance to Core, and rendering to Studio.
- `docs/decisions/0087-use-deterministic-advisory-media-generation-context.md`
  and implemented Plan 0191 assign deterministic purpose/target context and
  advisory related-Asset suggestions to Core. Suggestions are evidence, not an
  allowlist or request selection.
- `docs/architecture/project-asset-storage-conventions.md` assigns every durable
  media folder and filename to
  `packages/core/src/server/project-asset-files/`. Callers pass durable ids and
  intent; they never construct or parse paths.
- `docs/decisions/0062-detach-shot-plans-from-generated-video-assets.md` and the
  current Asset model keep Plan production media Project-owned with weak
  `authoredFromShotPlanId`. This plan preserves that ownership and uses exact
  provenance for Plan image projection.
- `docs/decisions/0058-make-studio-image-editing-agent-owned.md` keeps image
  editing agent-owned, creates a separate unselected Asset, and preserves the
  source. Its independently selected attachment destination is superseded by
  the user's current same-place requirement.

### Current request-reference regression

`packages/studio/src/features/media-generation-request/media-generation-prompt-editor.tsx`
currently enumerates every `MediaGenerationReferenceView` by media kind and
constructs tokens such as `@Image1`. Core's
`packages/core/src/server/media-generation-review/local-media.ts` deduplicates
markers by Project-relative path and projects no authored label or token.

This produces three distinct errors:

- a MiniMax H3 request is displayed and completed with Seedance-style syntax;
- an implicitly consumed opening image appears as a prompt token even when the
  provider does not use a prompt mention for it; and
- the completion option title is a raw Project-relative path rather than the
  contextual role the agent chose.

The completion inventory cannot come from Plan 0191 context. Context may return
nine plausible Cast references while the agent intentionally sends two. Only
the exact provider-native request knows which two media inputs were selected,
their provider array order, and whether the selected model addresses them in
prompt text.

### Urban Basilica completion examples

These examples define the intended data flow; they are not hard-coded fixtures
inside Studio runtime code.

#### Urban Cast request

An Urban Cast context can return the Production Lookbook candidates plus Urban
Cast media—nine plausible candidates in the current project. Suppose the agent
selects only:

- `cast/urban/urban-character-sheet-2.png`, Asset `asset_5ucg8r3s`, reference
  name `Urban-main`; and
- `visual-language/lookbooks/production/imperial-wound.png`, the selected
  Production Lookbook sheet.

For Seedance, the selected request markers are authored as:

```json
{
  "$file": "cast/urban/urban-character-sheet-2.png",
  "mimeType": "image/png",
  "reviewLabel": "Urban — Main Character Sheet",
  "promptMention": "@Image1"
}
```

```json
{
  "$file": "visual-language/lookbooks/production/imperial-wound.png",
  "mimeType": "image/png",
  "reviewLabel": "Imperial Wound — Production Lookbook",
  "promptMention": "@Image2"
}
```

The References tab shows exactly two cards and the completion menu contains
exactly `@Image1` and `@Image2`. The other seven context suggestions never enter
the request view or completion inventory.

For MiniMax H3, the same deliberately selected files may instead carry
`promptMention: "Image 1"` and `promptMention: "Image 2"`. Studio inserts and
decorates those exact strings; it does not add `@` or remove the spaces.

#### Theodosian Walls request

The Location context can return Production Lookbook, Storyboard, Location Hero,
and two Location Sheet candidates. If the request selects only
`locations/theodosian-walls/theodosian-walls-establish-sheet-g0rn.png`, the
References tab and completion list contain only that marker's authored label and
optional token. Context relevance controls the agent's choices; it does not
become a bulk completion source.

#### Implicit opening image

If an image-to-video route consumes the exact opening frame through a native
field but the model does not address that input in prompt prose, the marker has
`reviewLabel: "Shot Plan 01 — Opening Frame"` and no `promptMention`. The image
remains visible in References and provenance, but it is absent from completion,
decoration, and hover-token lookup.

### Current editorial-guide regression

The new Fal Skill maps twenty routes to five generic operation guides such as
`image-create.md`, `video-image.md`, and `video-reference.md`. Those files mostly
say which native field to use and contain only a sentence or two of prompt
advice. They cannot replace the prior curated model guidance.

Useful source material remains in the uncommitted `studio-skills` tree and in
its `HEAD`, including:

- `skills/media-producer/references/image-models/gpt-image-2.md`;
- `skills/media-producer/references/video-generation/models/seedance-2.0/`;
- `skills/media-producer/references/video-generation/models/minimax-h3/`;
- current Kling and Veo research that is not necessarily on an active provider
  route; and
- model-neutral image prompt authoring, provider-visible prompting, output
  review, and video prompt-quality checklists.

For example, the former GPT Image 2 guide covers composition, viewpoint,
lighting, materials, palette, visible text, spatial relationships, people and
Prop staging, reference precedence, and source-preserving edit prompts. The
former Seedance storyboard guide covers continuous waypoint versus edited-shot
structure, camera and subject motion, secondary motion, geography, timing,
audio, reference precedence, storyboard artifact suppression, and common
failure repair. Those editorial facts must be retained and updated even though
native request fields and numeric constraints now come from live provider
metadata.

### Missing live-schema access

The standalone provider implementations already retrieve current native input
schemas:

- Fal.ai: `packages/engines/src/providers/fal-ai/metadata.ts`;
- Replicate: `packages/engines/src/providers/replicate/metadata.ts`; and
- WaveSpeed: `packages/engines/src/providers/wavespeed/metadata.ts`.

Those loaders are currently private implementation details used by `validate`.
The CLI exposes context, validate, preview, execute, and recover, but no way for
a Skill to inspect the schema before authoring a valid request. Telling a Skill
to “read the live schema” without an accessible command encourages guessed or
copied schemas. The repair is a raw provider-owned schema inspection seam, not a
new normalized catalog.

### Current storage and database evidence

The only two development databases already contain only current image Asset
types. A read-only audit found:

- Urban Basilica: Project Cover, Cast Profile, Character Sheet, Location Hero,
  Location Sheet, Prop Hero, Prop Sheet, Lookbook Image, Lookbook Sheet, Beat
  Storyboard, Shot image, Plan first frame, and Plan last frame Assets.
- Big Fish: Lookbook Image and Beat Storyboard Assets.

No database migration is needed to resolve these records. Current ownership is
stored in `asset_membership.owner_key`, Plan provenance is stored in
`asset.authored_from_shot_plan_id`, and files are stored in `asset_file`.

For example:

- Theodosian Walls establishing sheet `asset_e8k5wyty` is owned by
  `location:location_pvpc55we` and stored at
  `locations/theodosian-walls/theodosian-walls-establish-sheet-g0rn.png`.
- Beat edit source `asset_a782wjwd` is owned by
  `sceneBeat:scene_djkfgf9p:beat_006` and stored at
  `storyboards/01/08-iteration/beat-8-intact-walls-edited-candi.png`.
- Plan first frame `asset_n7gcee9j` is Project-owned, has
  `authoredFromShotPlanId: shot_plan_37a3r9yz`, and is stored at
  `scenes/02/01-shot-plan/first-frame-gqfq.png`.

These facts are sufficient for source-derived continuation. Paths are examples
and verification evidence only; implementation must not parse them.

## Product Decisions

### 1. Exact selected request markers own completion data

Extend the provider-neutral local media marker envelope to:

```ts
interface LocalMediaFile {
  $file: string;
  mimeType?: string;
  reviewLabel?: string;
  promptMention?: string;
}
```

The standalone Engines type keeps both presentation annotations optional so a
non-Studio caller can use local-file substitution without Renku UI metadata.
Renku review/provenance documents require a non-empty `reviewLabel` on every
local marker. `promptMention` remains optional because some provider operations
consume media implicitly or use no prompt-addressing syntax.

Rules:

- Media Producer hands off a `reviewLabel` for each deliberately selected file
  from its exact domain role/user intent. The provider Skill preserves that
  label and authors `promptMention` from the model guide plus native request
  order. Neither Skill reconstructs the label from a basename.
- `reviewLabel` and `promptMention` are opaque strings. Core validates only
  type, non-empty bounded length, absence of control characters, and uniqueness
  of non-empty `promptMention` values within one request.
- Core never requires the prompt to contain a `promptMention`, never rewrites a
  prompt, and never validates whether a token is “correct” for a model.
- Engines recognizes the complete marker as one local file, replaces the whole
  marker object with a validation URL or uploaded provider URL, and therefore
  never sends the annotations to the provider schema or API.
- Core preserves the annotations while translating Project-relative paths to
  absolute paths for Engines and while saving safe Project-relative provenance.
- Core projects one `MediaGenerationReferenceView` per marker occurrence in
  deterministic recursive request order. It does not deduplicate two request
  positions merely because they use the same file.
- Add `requestPointer` as a JSON Pointer identifying the marker occurrence.
  Studio uses it as stable identity; it is not shown as UI copy and does not
  interpret a provider field.
- The References tab shows every marker occurrence using `reviewLabel`.
- The completion/decorator inventory includes only references with a
  `promptMention`.
- Typing `@` opens filtered completion only when at least one exact token begins
  with `@`. Explicit CodeMirror completion (`Ctrl-Space` / `Cmd-Space` where the
  platform allows it) shows all exact tokens, including `Image 1`. Selecting an
  option inserts the authored string unchanged.
- Studio filters explicit completion by both exact token and `reviewLabel`.
  It does not attempt to infer a provider token grammar from the token text.

This keeps rich completion contextual without making Core context a hidden
selection mechanism or rebuilding provider/model schemas in React.

#### Exact storage and lifetime of completion data

There is no completion registry, completion table, provider/model completion
schema, or Project-wide cache. The two annotations live beside the exact local
file they describe and follow the existing review/provenance lifecycle:

| Stage | Exact location | Persistence |
| --- | --- | --- |
| Context/read | The Plan 0191 context response contains advisory Asset candidates only. It contains no `reviewLabel` or `promptMention` completion records. | Response only; it is not the completion source. |
| Authored review request | `<project-folder>/tmp/operations/media-generation/<request-name>.json`, inside each provider-native local-file marker under top-level `request`. Example: `/Users/keremk/renku-movies/urban-basilica/tmp/operations/media-generation/urban-cast-seedance-reference-video.json`, at JSON Pointer `/request/image_urls/0`. | Temporary Project file authored by the agent/provider Skill and passed explicitly with `generation ... --file`. The existing review-path boundary requires this folder and `.json`; this plan adds no filename allocator. |
| Preview/editor | `MediaGenerationPreviewResource.references[]`, projected by Core from the marker occurrences in the named review file. `requestPointer` identifies the occurrence; `reviewLabel` supplies meaningful UI copy; `promptMention` supplies completion when present. | In-memory/HTTP response only. Studio stores no second copy. |
| Engines validation/execution | The CLI resolves `$file` to an absolute local path in memory. Engines recognizes the whole annotated marker and replaces it with the provider upload/URL value before native schema validation and submission. | The annotations are never sent to or stored by the provider. |
| Returned provenance | `generation execute`/`recover` returns `provenance` containing the exact safe review document plus the provider receipt. Media Producer writes that exact value to a unique JSON file under `<project-folder>/tmp/operations/media-generation/`, for example `urban-cast-seedance-reference-video-provenance.json`, and passes that path to `renku media import --provenance`. | Temporary handoff file; no sidecar is created beside the generated image/video/audio. |
| Durable Asset | `<project-folder>/.renku/project.sqlite`, table `asset`, JSON column `generation_provenance` on the newly imported Asset row. The stored provenance contains the top-level `request`, including every marker's Project-relative `$file`, `reviewLabel`, and optional `promptMention`. | Durable Project data, using the existing column added by migration 0080; no new table, column, or migration. |
| Later Inspection | Core reads `asset.generation_provenance` from the same Asset row and reprojects `MediaGenerationPreviewResource.references[]` for the shared read-only Generation Request dialog. | No new stored completion data; Inspection is a projection of Asset provenance. |

The temporary review/provenance JSON files remain ordinary files under the
existing `tmp/operations/media-generation/` workspace until the agent/user
cleans temporary operation artifacts. The imported media file itself moves
through the existing Core attachment boundary to its canonical Asset path; the
completion annotations remain only in the Asset's provenance JSON, not in the
filename, `asset_file`, membership, or selection records.

### 2. Editorial model guides and native schemas stay separate

Move the retained Media Producer prompt-writing material into this exact tree:

```text
skills/media-producer/references/prompt-guides/
├── shared/
│   └── audio-and-voice.md
├── image/
│   ├── guide-registry.json
│   ├── shared/
│   │   ├── prompt-authoring.md
│   │   └── reference-visible-prompting.md
│   └── models/
│       ├── gpt-image-2/
│       │   └── index.md
│       ├── grok-imagine-image/
│       │   └── index.md
│       └── nano-banana/
│           └── index.md
└── video/
    ├── guide-registry.json
    ├── shared/
    │   ├── prompt-quality-checklist.md
    │   └── provider-visible-prompting.md
    └── models/
        ├── seedance-2.0/
        │   ├── index.md
        │   ├── endpoint-selection.md
        │   ├── text-only.md
        │   ├── first-frame.md
        │   ├── first-last-frame.md
        │   ├── reference.md
        │   ├── storyboard-reference.md
        │   └── native-audio.md
        ├── minimax-h3/
        │   ├── index.md
        │   ├── text-only.md
        │   ├── image-to-video.md
        │   └── reference.md
        ├── kling/
        │   └── index.md
        └── veo-3.1/
            └── first-last-frame-example.md
```

The exact move inventory is:

| Current source in `studio-skills` | New location |
| --- | --- |
| `references/image-model-guide-registry.json` | `references/prompt-guides/image/guide-registry.json` |
| `references/image-models/gpt-image-2.md` | `references/prompt-guides/image/models/gpt-image-2/index.md` |
| `references/image-models/grok-imagine-image.md` | `references/prompt-guides/image/models/grok-imagine-image/index.md` |
| `references/image-models/nano-banana.md` | `references/prompt-guides/image/models/nano-banana/index.md` |
| `references/image-prompt-authoring.md` | `references/prompt-guides/image/shared/prompt-authoring.md` |
| `references/reference-visible-image-prompting.md` | `references/prompt-guides/image/shared/reference-visible-prompting.md` |
| `references/video-model-guide-registry.json` | `references/prompt-guides/video/guide-registry.json` |
| `references/video-generation/models/seedance-2.0/*` | `references/prompt-guides/video/models/seedance-2.0/*` |
| `references/video-generation/models/minimax-h3/*` | `references/prompt-guides/video/models/minimax-h3/*` |
| `references/video-generation/models/kling/index.md` | `references/prompt-guides/video/models/kling/index.md` |
| `references/video-generation/models/veo-3.1/first-last-frame-example.md` | `references/prompt-guides/video/models/veo-3.1/first-last-frame-example.md` |
| `references/video-generation/provider-visible-prompting.md` | `references/prompt-guides/video/shared/provider-visible-prompting.md` |
| `references/video-generation/prompt-quality-checklist.md` | `references/prompt-guides/video/shared/prompt-quality-checklist.md` |
| `references/video-generation/audio-and-voice.md` | `references/prompt-guides/shared/audio-and-voice.md` |

Move the files directly, update all Media Producer instructions, guide links,
registries, validators, eval references, samples, and release-package checks to
the new paths, and delete the old paths in the same change. Do not leave
duplicate copies, re-export/link stubs, or fallback lookup of the old layout.

`image-operation-routing.md`, `image-output-review.md`, purpose-specific
references such as `scene-storyboard-sheet.md`, and
`shot-plan-video/` remain at their current locations. They own workflow,
review, or purpose instructions rather than reusable prompt-authoring guidance.
Provider Skills also keep their current technical operation guides and
`supported-models.json` indexes in their own `references/` folders.

This slice does **not** create curated editorial guides for Replicate,
WaveSpeed, ElevenLabs, Z-Image, FLUX Kontext, MiniMax Speech, or any other model
without retained Media Producer material. It also does not promote the existing
Kling research or Veo example into registered guide coverage. Adding or
researching missing model guidance is a separate iteration.

The moved guide registries are routing indexes, not provider schemas. They
contain only the restored `provider`, `model`, and relative `guide` values,
updated to the new paths. They do
not contain fields, types, defaults, enums, bounds, file counts, pricing,
capabilities, Studio purposes, templates, or presentation metadata. Live native
request structure continues to come only from `renku generation schema show`
and `generation validate`.

Each provider Skill's supported-model index remains exactly:

```json
{
  "id": "provider-native-route-id",
  "name": "Human model name",
  "inputModes": ["reference-to-video"],
  "guide": "video-reference.md"
}
```

No new `promptGuide` field or parallel provider/model schema is added. Media
Producer resolves only the restored routes already listed in its two prior
guide registries; provider Skills resolve their own current technical guide
through the existing `guide` field.

### 3. Raw live input-schema inspection

Add this Engines public contract:

```ts
interface MediaProvider {
  // existing validate / execute / recover
  readInputSchema?(
    model: string,
    context: ProviderContext,
  ): Promise<JsonValue>;
}

interface MediaEngine {
  // existing validate / execute / recover
  readInputSchema(
    provider: string,
    model: string,
    context: ProviderContext,
  ): Promise<JsonValue>;
}
```

`createFalMediaProvider`, `createReplicateMediaProvider`, and
`createWaveSpeedMediaProvider` delegate to their existing live metadata loaders.
No second fetcher, normalized field descriptor, or checked-in cache is added.
ElevenLabs does not pretend that its adapter-owned SDK validation is a live JSON
Schema. Calling schema inspection on a registered provider without this
capability returns structured `ENGINE_INPUT_SCHEMA_UNAVAILABLE`.

Expose exactly:

```bash
renku generation schema show \
  --provider <provider-id> \
  --model <provider-native-model-id> \
  --json
```

The CLI resolves the provider credential through the existing Core-owned
credential resolver, creates the existing provider context/cache, calls
`MediaEngine.readInputSchema` once, and prints the returned JSON unchanged.
There is no Project purpose, target, normalized model record, schema persistence,
or Studio route. Provider Skills call this command before authoring unfamiliar
or changed native fields, then call normal `generation validate` on the exact
request.

### 4. `image.create` is a Shot Plan reference-image creation purpose

Change:

```ts
MEDIA_PURPOSE_TARGET_KINDS['image.create'] = 'shotPlan';
```

The generation context target becomes `shotPlan:<id>`. Core reuses the complete
Shot Plan context projector from Plan 0191 while keeping `image.create`'s generic
provider-neutral image output guidance. This gives the agent relevant Beats,
Shots, Lookbooks, continuity subjects, and related media without assigning a
more specific product purpose to the new reference image.

An accepted `image.create` import has this exact durable result:

| Concern | Contract |
| --- | --- |
| Import command | `renku media import --purpose image.create --target shotPlan:<shotPlanId> --source <project-relative-output> --provenance <json> [--title <title>]` |
| Source proof | Exact image generation provenance is required. |
| Asset owner | `{ kind: 'project' }`, preserving weak Plan authorship rather than Plan ownership |
| Asset type | `shot_plan_video_reference` |
| Authorship | `authoredFromShotPlanId = <shotPlanId>` |
| File destination | `{ kind: 'shotPlan.videoReferenceImage', shotPlanId, role: 'reference' }` |
| Durable folder | `scenes/<safe-scene-label>/<NN>-shot-plan/` |
| Generated filename | `reference-gxxx.<normalized-extension>` |
| Asset File role | `primary` |
| Default title | `Shot Plan Reference Image` when `--title` is absent |
| Selection | No automatic selection; Plan reference images are a multi-candidate collection |
| Studio location | Selected Shot Plan > Assets > Reference Images |
| Refresh | `studioShotPlanImageAssetsResourceKey(<shotPlanId>)` |

`shot-plan.video-reference` remains a focused purpose with its current Plan
video-reference output guidance. It and `image.create` deliberately attach to
the same current Plan reference-image collection; they are different authoring
intent, not compatibility aliases.

### 5. `image.edit` uses source-derived attachment continuation

The public command remains:

```bash
renku media import \
  --purpose image.edit \
  --target asset:<sourceAssetId> \
  --source <project-relative-output> \
  --provenance <json> \
  [--title <title>]
```

There is no second destination flag. Core performs these steps before any file
write:

1. Load the exact active source Asset and its owner membership.
2. Require `mediaKind === 'image'` and at least one current image Asset File.
3. Require the generation provenance request to contain at least one exact
   current source Asset File marker. This is envelope/reference validation, not
   prompt or image-content interpretation.
4. Resolve a continuation handler from the source Asset's current type.
5. Validate that the durable owner and any required detail/provenance record are
   coherent and still projectable in a current product surface.
6. Build the existing focused `ProjectAssetFileDestination`, owner, type,
   metadata, detail-row behavior, and resource keys.
7. Persist a separate generated Asset with the exact edit provenance.
8. Leave the source Asset and all selection rows unchanged.

The continuation copies source `title`, `oneLineSummary`, `referenceName`, and
`tags` unless the import supplies an explicit title or metadata override. Fixed
role destinations keep fixed stems. Destinations with semantic stems use the
durable `referenceName` when present, otherwise the durable source title. They
never parse the source basename.

Unsupported/unclassified image types, missing owners, stale Beat/Shot/Plan
relationships, discarded source files, absent source-reference provenance, and
wrong-media output fail with a structured error before allocation or copying.
There is no fallback to Project ownership or a generic folder.

### 6. Exact image-edit continuation and storage matrix

All currently supported durable image types are listed below. Adding another
current image type later requires one focused continuation handler, storage
destination, projection surface, and test; it must not fall through to a generic
branch.

| Source Asset type | Required durable relationship | New Asset owner/type | Existing destination reused | Exact generated storage | Same-place Studio surface |
| --- | --- | --- | --- | --- | --- |
| `project_cover` | Project membership | Project / `project_cover` | `project.cover` | `covers/cover-gxxx.<ext>` | Project Cover candidates |
| `cast_profile` | Cast Member membership | Same Cast Member / `cast_profile` | `cast.profile` | `cast/<cast-handle>/profile-gxxx.<ext>` | Same Cast Member Assets tab, Profile candidates |
| `character_sheet` | Cast Member membership | Same Cast Member / `character_sheet` | `cast.characterSheet` with source semantic metadata | `cast/<cast-handle>/<variation>-sheet-gxxx.<ext>` | Same Cast Member Assets tab, Character Sheets |
| `location_hero` | Location membership | Same Location / `location_hero` | `location.hero` | `locations/<location-handle>/hero-gxxx.<ext>` | Same Location Assets tab, Hero candidates |
| `location_sheet` | Location membership | Same Location / `location_sheet` | `location.sheet` with source semantic metadata | `locations/<location-handle>/<variation>-sheet-gxxx.<ext>` | Same Location Assets tab, Location Sheets |
| `prop_hero` | Prop membership | Same Prop / `prop_hero` | `prop.hero` | `props/<prop-handle>/hero-gxxx.<ext>` | Same Prop Assets tab, Hero candidates |
| `prop_sheet` | Prop membership | Same Prop / `prop_sheet` | `prop.sheet` with source semantic metadata | `props/<prop-handle>/<variation>-sheet-gxxx.<ext>` | Same Prop Assets tab, Prop Sheets |
| `lookbook_image` | Lookbook membership plus image detail row | Same Lookbook / `lookbook_image`; insert new ordered Lookbook Image detail row | `visualLanguage.lookbookImage` with source semantic metadata | `visual-language/lookbooks/<production-or-storyboard>/<semantic>-gxxx.<ext>` | Same Lookbook Assets tab, Images |
| `lookbook_sheet` | Lookbook membership plus sheet detail row | Same Lookbook / `lookbook_sheet`; insert new ordered Lookbook Sheet detail row | `visualLanguage.lookbookSheet` with source semantic metadata | `visual-language/lookbooks/<production-or-storyboard>/<semantic>-sheet-gxxx.<ext>` | Same Lookbook Assets tab, Sheets |
| `scene_storyboard_image` | Scene Beat membership whose Beat is projectable in a current Scene Beats revision | Same Scene Beat / `scene_storyboard_image` | `scene.storyboardImage`; allocate one new iteration folder for this edited candidate | `storyboards/<safe-scene-label>/<next-NN>-iteration/s<scene>-b<beat>-image-gxxx.<ext>` | Scene > Beats > same Beat > Manage Storyboard Images |
| `shot_image` | Shot membership and exact containing Shot Plan | Same Shot / `shot_image` | `shot.image` | `scenes/<safe-scene-label>/<NN>-shot-plan/shot-images/shot<shot>-gxxx.<ext>` | Same Shot image-candidate dialog in the Shot Plan |
| `shot_plan_video_first_frame` | Project membership plus valid `authoredFromShotPlanId` | Project / same type and same authored-from Plan | `shotPlan.videoReferenceImage`, role `first-frame` | `scenes/<safe-scene-label>/<NN>-shot-plan/first-frame-gxxx.<ext>` | Same Shot Plan Assets tab, First Frames |
| `shot_plan_video_last_frame` | Project membership plus valid `authoredFromShotPlanId` | Project / same type and same authored-from Plan | `shotPlan.videoReferenceImage`, role `last-frame` | `scenes/<safe-scene-label>/<NN>-shot-plan/last-frame-gxxx.<ext>` | Same Shot Plan Assets tab, Last Frames |
| `shot_plan_video_storyboard` | Project membership plus valid `authoredFromShotPlanId` | Project / same type and same authored-from Plan | `shotPlan.videoReferenceImage`, role `storyboard` | `scenes/<safe-scene-label>/<NN>-shot-plan/storyboard-gxxx.<ext>` | Same Shot Plan Assets tab, Storyboards |
| `shot_plan_video_reference` | Project membership plus valid `authoredFromShotPlanId` | Project / same type and same authored-from Plan | `shotPlan.videoReferenceImage`, role `reference` | `scenes/<safe-scene-label>/<NN>-shot-plan/reference-gxxx.<ext>` | Same Shot Plan Assets tab, Reference Images |

Concrete result: editing the Theodosian Walls establishing sheet remains owned
by Location `location_pvpc55we`, receives a new collision-safe file under
`locations/theodosian-walls/` with the Location Sheet stem, and immediately
appears in the Theodosian Walls Assets tab. It never becomes a Project-level
reference and no code infers `theodosian-walls` from the input path.

### 7. Shot Plan Assets view

Add a secondary `Shots` / `Assets` line-tab bar inside the selected Shot Plan
detail page:

- `Shots` preserves the current Shot rail, Shot brief, and Manage Images flow
  without layout or behavior changes.
- `Assets` shows image candidates authored from that exact Shot Plan, grouped in
  this stable order: First Frames, Last Frames, Storyboards, Reference Images.
- Empty groups remain absent; if all groups are empty, show a quiet empty state.
- Cards reuse `MediaCard`, image preview, generation request inspection, and the
  existing discard confirmation behavior. No raw filenames or ids are shown as
  invented card copy.
- The projection returns Asset title and exact browser-ready files. React does
  not filter by type, parse paths, or infer Plan membership.
- New `image.create` results appear in Reference Images. Edited Plan inputs
  appear in the group matching the source type.
- This plan does not add generate/edit buttons to Studio. Generation and edit
  execution remain agent-owned.

The existing Scene-level `Generations` tab remains video-only and unchanged.
Plan images belong beside the selected Shot Plan because that is where the user
finds the Shots and their Plan production inputs.

### 8. Beat Storyboard candidate visibility

The Scene Beats surface currently displays only
`storyboardImagesByBeatId[beat.id]`, the selected Storyboard image, even though
Core's existing `SceneStoryboardStatus` already returns every
`scene_storyboard_image` candidate and `selectedImageId` for every Beat.

Add a `Manage Storyboard Images` shadcn Button to the selected Beat detail aside
and a focused candidate dialog:

- place the always-visible outline Button directly below the selected Beat's
  number/title block and before its Description fields in
  `scene-beats-tab.tsx`; clicking it sets the dialog open for that exact
  `selectedBeat.id`. The existing inspect icon on the Beat card continues to
  preview only the selected image and does not become a second dialog launcher;
- load the active Scene Beats revision's existing `SceneStoryboardStatus`;
- select the exact Beat entry by durable `beatId` and pass its candidates to the
  existing `MediaCardCollectionDialog` as `MediaCardCollectionItem[]`. The
  existing collection dialog owns the shadcn `Dialog`, loading/error/empty
  states, scrolling, `MediaCardGrid`, and `MediaCard` rendering; the new Beat
  file is only a controller/data adapter, not a new dialog or card design;
- always use `MediaCardCollectionDialog`, including when the Beat has exactly
  one candidate. Do not copy the Shot dialog's one-item shortcut to a bare
  `ImagePreviewDialog`, because this surface must expose selection, inspection,
  and candidate management consistently;
- configure each existing `MediaCard` with the Scene resource's Project aspect
  ratio, `contain` image fit, the existing image-preview activation, the
  existing Generation Request inspector corner action, the existing `choose`
  selection control, and the existing Trash confirmation/delete action for
  unselected candidates. As in `ShotImageCandidatesDialog`, the selected card
  has no delete action;
- mark the current `selectedImageId` without changing it on dialog open;
- select a candidate through Core's existing `selectAsset` command with target
  `{ kind: 'sceneBeat', sceneId, beatId }`, wrapped by the focused
  `selectSceneStoryboardImageCandidate` command that first validates the active
  revision/Beat relationship;
- discard a candidate through focused
  `discardSceneStoryboardImageCandidate`, which validates the same exact
  context before delegating to the existing Asset discard owner;
- refresh the Scene Beats and exact Beat resource keys after either mutation;
- keep all visible candidate actions and states within the established
  `MediaCard`, `MediaCardCollectionDialog`, `ImagePreviewDialog`, and
  `useGenerationRequestInspectorDialog` contracts; and
- show no raw path, Asset id, or invented filename label.

The dialog title is the selected Beat title; its description is `Select the
storyboard image shown for this Beat.` This is the same composition pattern as
`shot-image-candidates-dialog.tsx`: selection and Trash actions live on cards,
clicking the media opens the existing image preview, and the inspect action
opens the shared read-only Generation Request dialog. No Generate/Edit action,
candidate detail panel, custom carousel, or new media-card variant is added.

The Studio routes are:

```text
GET    /studio-api/projects/:projectName/screenplay/scenes/:sceneId/scene-beats/:sceneBeatsRevisionId/storyboard-images
POST   /studio-api/projects/:projectName/screenplay/scenes/:sceneId/scene-beats/:sceneBeatsRevisionId/beats/:beatId/selected-image/:assetId
DELETE /studio-api/projects/:projectName/screenplay/scenes/:sceneId/scene-beats/:sceneBeatsRevisionId/beats/:beatId/images/:assetId
```

The GET route delegates to existing `readSceneStoryboardStatus`. Mutation
routes call the two focused Core commands once. Core requires the supplied
revision to be the Scene's active Scene Beats revision, requires the Beat to
exist in that revision, validates the candidate's exact Scene Beat owner/type,
and then delegates to existing selection/discard persistence. No new storage or
projection model is added.

### 9. Restored provider E2E policy

Restore and rewrite these retained test paths against the new architecture:

| Test file | Exact opt-in | Credential | Behavior |
| --- | --- | --- | --- |
| `packages/engines/tests/e2e/fal.e2e.test.ts` | `RUN_FAL_TEST=1` | `FAL_KEY` | `MediaEngine.validate` + bounded image execute/download |
| `packages/engines/tests/e2e/replicate.e2e.test.ts` | `RUN_REPLICATE_TEST=1` | `REPLICATE_API_TOKEN` | live schema validation + bounded image execute/download |
| `packages/engines/tests/e2e/wavespeed.e2e.test.ts` | `RUN_WAVESPEED_TEST=1` | `WAVESPEED_API_KEY` | live schema validation + bounded image execute/poll/download |
| `packages/engines/tests/e2e/elevenlabs.e2e.test.ts` | `RUN_ELEVENLABS_TEST=1` | `ELEVENLABS_API_KEY` | direct retained provider TTS/music scenarios through the new provider contract |
| `packages/engines/tests/e2e/elevenlabs-voice-samples.e2e.test.ts` | `RUN_ELEVENLABS_VOICE_SAMPLE_TEST=1` | `ELEVENLABS_API_KEY` | provider voice sample retrieval |
| `packages/engines/tests/e2e/elevenlabs-media-engine.e2e.test.ts` | `RUN_ELEVENLABS_MEDIA_ENGINE_TEST=1` | `ELEVENLABS_API_KEY` | paid TTS through registered `MediaEngine`, replacing the obsolete Generation Runner scenario |

Every suite calls
`packages/engines/tests/e2e/provider-test-credentials.ts`. A credential in the
environment is insufficient without the matching test-specific flag. Tests do
not import Core, read `~/.config/renku`, or use production saved-credential
resolution. The ordinary root test/check/release commands either exclude the
E2E config or see all suites skipped. `pnpm test:e2e` still requires the
operator's explicit flag. Implementation verification does not run a paid test;
the user must separately approve each live execution.

OpenAI, Qwen, Vercel AI Gateway, old schema-helper, and obsolete unified-provider
E2E files remain deleted because those capabilities were intentionally removed.

### 10. Restored forward-eval and validator coverage

Do not restore obsolete `*-spec.json`, checked-in model descriptors, or
`generation model list`. Restore the two prompt-guide routing registries because
they point to retained editorial documents and contain no provider schema.
Restore the behavioral coverage on the current workflow:

```text
generation context
  -> exact reference selection
  -> provider Skill + live schema inspection
  -> review document
  -> generation validate
  -> generation preview show
  -> conversational approval
  -> generation execute/recover
  -> output inspection
  -> media import --provenance
```

Media Producer forward evals must again cover every current purpose family:

- `image.create`, `image.edit`, and `project.cover`;
- Cast Character Sheet, Cast Profile, and Cast Voice Sample;
- Location Sheet and Hero;
- Prop Sheet and Hero;
- Production Lookbook Image and Video Sheet;
- Storyboard Lookbook Sheet;
- Scene Storyboard Sheet, batching, cropping, import, and selection;
- Shot image candidate creation and non-automatic promotion;
- Shot Plan video first frame, last frame, storyboard, generic reference, and
  final video;
- Scene Dialogue Audio;
- Codex-present, Codex-absent, explicit provider override, external import,
  interrupted provider recovery, Preview edit, output inspection, and selection
  behavior; and
- deliberate departure from advisory context suggestions.

Restore the important prior editorial scenarios rather than reducing them to
one-line bullets: source-preserving edit, create-versus-edit routing, multi-turn
Storyboard correction, Provider edit route not choosing Studio purpose,
reference precedence, continuous waypoint versus edited storyboard video,
dialogue/native audio, first-and-last frames, dense versus single-Beat canvas
use, Prop interaction, character/location/look continuity, visible failure
repair, and user override.

The restored/current validators own five separable checks:

1. `scripts/validate-media-generation-skills.mjs` keeps package/frontmatter,
   route-index shape, current review envelopes, required workflow commands, and
   forbidden obsolete concepts.
2. Restore `skills/media-producer/scripts/validate-image-prompt-guides.mjs` at
   its prior path. Adapt only its obsolete GenerationSpec/model-catalog checks:
   it validates the restored image guide registry, that every existing registry
   route resolves to its existing guide, that those guides retain applicability
   and source provenance, and that the current workflow no longer cites
   obsolete commands or checked-in schemas. It does not require editorial
   coverage for provider/model routes absent from the restored registry.
3. Restore `skills/media-producer/scripts/validate-video-prompt-guides.mjs` at
   its prior path with the same bounded adaptation for the restored Seedance and
   MiniMax registry. It also proves inactive Kling/Veo research stays
   unregistered and that Seedance `@ImageN` and MiniMax `Image N` guidance remain
   distinct.
4. `scripts/validate-media-purpose-evals.mjs` validates an explicit current
   purpose coverage manifest against eval case ids and verifies required
   cross-cutting workflow cases. The manifest names stable product purposes and
   eval ids, not private implementation functions.
5. The release-contract test invokes the structural validator, both restored
   prompt-guide validators, and the purpose-eval validator, and confirms the
   retained Media Producer guides/registries plus provider Skill files are
   packaged.

Validators may verify required guide sections and source presence. They must not
score prompt prose, require creative phrases, inspect media contents, or treat
one template as the only good prompt. Editorial quality is protected by
reviewable guides and forward evals, not runtime semantic validation.

## Architecture Shape Gate

### Owning packages and public entrypoints

#### Engines

- Public entrypoint: `packages/engines/src/index.ts` remains a thin export list.
- Public contracts: `packages/engines/src/media/contracts.ts` adds optional
  marker annotations and `readInputSchema`.
- Engine dispatch: `packages/engines/src/media/engine.ts` delegates schema reads
  to the exact registered provider and owns only the unsupported-capability
  error.
- Provider modules: Fal.ai, Replicate, and WaveSpeed each expose their existing
  metadata loader through `readInputSchema`. The metadata modules remain the
  single retrieval/cache owners.
- Local file substitution: `packages/engines/src/media/local-files.ts`
  recognizes annotated markers and replaces the whole object before provider
  validation/upload.

#### Core

- Review public contract:
  `packages/core/src/client/media-generation-review.ts` adds
  `reviewLabel`, optional `promptMention`, and `requestPointer` to
  `MediaGenerationReferenceView`.
- Review implementation:
  `packages/core/src/server/media-generation-review/local-media.ts` owns safe
  annotation validation, marker occurrence traversal, path translation, and
  reference projection. It remains provider-neutral.
- Attachment public entrypoint:
  `attachGenerationMedia` remains the ProjectDataService command used by the
  CLI. It delegates `image.create` through the bounded normal destination
  registry and delegates `image.edit` immediately to the focused continuation
  module.
- New internal module:
  `packages/core/src/server/image-edit-attachments/` owns source-derived edit
  continuation:
  - `source.ts` loads and validates the exact source Asset/files/provenance
    relationship;
  - `continuation-registry.ts` maps the closed current image Asset-type set to
    focused handlers;
  - `subject-continuations.ts` owns Cover, Cast, Location, and Prop mappings;
  - `lookbook-continuations.ts` owns Lookbook detail-row continuation;
  - `scene-continuations.ts` owns Beat Storyboard and Shot image continuation;
  - `shot-plan-continuations.ts` owns the four weak-authored Plan image roles;
  - `attachment.ts` coordinates one validated continuation with the existing
    persistence boundary; and
  - `index.ts` exports only `attachImageEditMedia` and its input/report types.
- Existing storage owner:
  `packages/core/src/server/project-asset-files/` remains the sole path and file
  owner. No new path allocator is added outside its existing destination
  modules.
- New Shot Plan image-assets module:
  `packages/core/src/server/shot-plan-image-assets/` contains
  `projection.ts`, `discard.ts`, and thin `index.ts`. Projection resolves only
  the four Plan image types by exact Project owner and
  `authoredFromShotPlanId`; discard validates the same exact Plan relationship
  before delegating to the existing Asset discard owner.
- Public service contract:
  `ProjectDataService.readShotPlanImageAssets({ projectName, shotPlanId })`
  returns `ShotPlanImageAssets`, and
  `ProjectDataService.discardShotPlanImageAsset({ projectName, shotPlanId,
  assetId })` owns focused removal eligibility.
- Existing Scene Beats ownership gains
  `packages/core/src/server/scene-beats/storyboard-image-candidates.ts`. It owns
  `selectSceneStoryboardImageCandidate` and
  `discardSceneStoryboardImageCandidate`, validates active revision/Beat and
  exact Asset ownership/type, then delegates to existing Asset selection/trash.
  It does not duplicate `SceneStoryboardStatus` projection or Asset persistence.

#### CLI

- `packages/cli/src/commands/generation/command.ts` registers
  `['schema', 'show']` beside the existing focused handlers.
- New `packages/cli/src/commands/generation/schema.ts` parses provider/model,
  creates the existing provider context, calls Engines once, and returns raw
  JSON.
- `packages/cli/src/commands/media-import-command-handlers.ts` remains a thin
  document/flag parser and calls Core's existing attachment service. It does not
  contain type/owner/path continuation logic.

#### Studio

- Shared request UI remains under
  `packages/studio/src/features/media-generation-request/`. Token completion,
  decoration, preview, and reference cards consume the exact Core projection.
- Shot Plan Assets files live with the Shot Plan feature:
  - `shot-plans/shot-plan-image-assets-tab.tsx` renders the four groups;
  - `shot-plans/use-shot-plan-image-assets.ts` owns loading and resource refresh;
  - `shot-plans/shot-plan-detail-page.tsx` owns only the local Shots/Assets tab
    selection and composes the existing/new views.
- `StudioSelection` adds optional `shotPlanTab: 'shots' | 'assets'` only when
  `sceneTab === 'shotPlans'` and `shotPlanId` is present. The route query uses
  `shotPlanTab=assets`; `shots` is the default and is omitted. Selecting Assets
  clears `shotId`, while selecting a Shot returns to the Shots tab.
- Service contracts live in
  `packages/studio/src/services/studio-shot-plan-image-assets-contracts.ts` and
  `studio-shot-plan-image-assets-api.ts`.
- Server route:
  `GET /studio-api/projects/:projectName/screenplay/shot-plans/:shotPlanId/image-assets`
  in `packages/studio/server/routes/shot-plan-image-assets.ts` calls Core once
  and serializes browser URLs. No domain filtering occurs in the route.
- Focused removal uses
  `DELETE /studio-api/projects/:projectName/screenplay/shot-plans/:shotPlanId/image-assets/:assetId`
  in the same route module and calls `discardShotPlanImageAsset`; the HTTP layer
  does not assume that every Project-owned image belongs to the Plan.
- Beat Storyboard candidate UI stays in the existing Scene Beats feature:
  - `scenes/beat-storyboard-image-candidates-dialog.tsx` adapts one Beat's
    `SceneStoryboardStatus` entry into existing `MediaCardCollectionItem`
    contracts and composes `MediaCardCollectionDialog`; it owns no dialog shell,
    grid, card visual, preview, inspector, or confirmation primitive;
  - `scenes/use-beat-storyboard-image-candidates.ts` owns status loading and
    exact resource refresh; and
  - `scenes/scene-beats-tab.tsx` owns only the selected Beat button/open state
    and dialog composition. The Button is directly below the selected Beat
    heading in the existing right detail aside.
- `packages/studio/server/routes/scene-storyboard-images.ts` owns the three thin
  routes named in Product Decision 8. Service contracts live in
  `studio-scene-storyboard-images-contracts.ts` and
  `studio-scene-storyboard-images-api.ts`.

#### Studio Skills

- Every provider Skill keeps its current `references/supported-models.json` and
  technical operation guides in its current `references/` folder. This plan
  does not create a new provider `references/models/` hierarchy.
- Media Producer owns Studio purpose workflow, context/reference selection,
  contextual `reviewLabel` values, and the reorganized
  `references/prompt-guides/` hierarchy. The hierarchy owns shared
  prompt-authoring guidance, model-family folders, and the image/video guide
  registries; Media Producer also owns Codex built-in guidance, output
  inspection, attachment, and cross-provider routing. It does not duplicate
  provider-native field schemas.
- The structural and purpose-eval validators live at repository `scripts/`.
  The image/video prompt-guide validators return to their established
  `skills/media-producer/scripts/` paths; the release-contract test invokes all
  four explicitly.

### Bounded production registries

Two Core runtime registries are justified (separate from the restored static
Media Producer guide-routing JSON files):

1. The existing generation attachment builder registry remains the closed map
   from `MediaPurpose` to normal focused destinations. Add `image.create` only.
2. The new image-edit continuation registry is the closed map from durable
   current image Asset type to a continuation handler. It is necessary because
   edit destination is derived from source type, not from a caller-supplied
   purpose. The registry returns a typed destination/owner/persistence plan and
   performs no file writes itself.

Do not combine these registries, add a generic `asset type -> arbitrary patch`
API, or make one handler switch on owner, type, path, purpose, and UI surface.

### Existing files that must remain thin or shrink

- `packages/core/src/server/generation/attachments.ts` gains two shallow
  delegation branches and must not absorb continuation cases.
- `packages/core/src/server/generation/attachment-destinations.ts` adds the
  single `image.create` builder and no image-edit owner switch.
- `packages/cli/src/commands/generation/command.ts` remains a handler registry,
  not a schema renderer.
- `packages/studio/src/features/media-generation-request/media-generation-prompt-editor.tsx`
  stops deriving tokens and only adapts projected references to editor mention
  objects.
- `shot-plan-detail-page.tsx` composes tabs; it does not fetch/filter Assets or
  duplicate the existing Shot layout.
- All `index.ts` files are thin exports only.

### Forbidden implementation shapes

Stop and revise before implementation continues if any of these appears:

- provider/model `if` or `switch` logic in Core, CLI, Studio, or Media Producer;
- checked-in JSON Schema, generated descriptor, field/default/limit catalog, or
  normalized presentation control contract;
- token derivation from provider id, model id, native field name, media kind,
  request position, filename, or Project context order;
- Core validation that requires the prompt to mention a token or judges prompt
  or media contents;
- CLI/route/React code deciding an image edit's owner, asset type, path, Beat,
  Shot, Plan, or Lookbook detail behavior;
- path parsing to recover identity or naming an edited destination from the
  source basename;
- a generic fallback that attaches an unknown edited image to Project;
- a Beat candidate route that trusts URL ids without resolving the exact
  current Scene Beats revision and Beat through Core;
- automatic replacement, discard, or selection of the source image;
- a new database column/table without first revising and re-approving this plan;
- a monolithic edit attachment function that performs source lookup, all type
  dispatch, path allocation, persistence, selection, and report formatting;
- paid provider tests included in default test/check/release execution; or
- Pika implementation hidden in the provider-seam changes.

## Public Contracts

### Review marker and reference view

```ts
interface LocalMediaFile {
  $file: string;
  mimeType?: string;
  reviewLabel?: string;
  promptMention?: string;
}

interface MediaGenerationReferenceView {
  requestPointer: string;
  kind: 'image' | 'video' | 'audio';
  projectRelativePath: ProjectRelativePath;
  reviewLabel: string;
  promptMention?: string;
  browserUrl?: string;
  available: boolean;
}
```

Renku review documents require `reviewLabel`; Engines standalone marker callers
do not. No provider/model fields are added.

### Engines schema inspection

- `MediaProvider.readInputSchema?(model, context)`
- `MediaEngine.readInputSchema(provider, model, context)`
- `ENGINE_INPUT_SCHEMA_UNAVAILABLE`
- `renku generation schema show --provider --model --json`

### Media targets and attachments

- `MEDIA_PURPOSE_TARGET_KINDS['image.create']` changes from `project` to
  `shotPlan` with no alias or old-target fallback.
- `image.create` resolves to the existing Plan reference-image storage
  destination and exact weak authorship.
- `image.edit` target remains `asset`; the target is no longer checked against a
  separately chosen destination because no such destination is accepted.
- `AttachGenerationMediaInput` remains the external service input. Internal
  `attachImageEditMedia` returns the same `GenerationMediaAttachmentReport`
  shape.

### Shot Plan image projection

```ts
interface ShotPlanImageAssetGroup {
  role: 'first-frame' | 'last-frame' | 'storyboard' | 'reference';
  assets: Asset[];
}

interface ShotPlanImageAssets {
  shotPlan: { id: string; sceneId: string; title: string };
  groups: ShotPlanImageAssetGroup[];
  resourceKeys: string[];
}
```

Core returns only non-empty groups in the fixed role order. The Studio HTTP
response converts each Asset File to the existing browser-file contract without
changing membership or grouping.

`StudioSelection` adds:

```ts
type ShotPlanDetailTab = 'shots' | 'assets';

// On the existing Scene selection branch:
shotPlanTab?: ShotPlanDetailTab;
```

`shotPlanTab` is valid only with `sceneTab: 'shotPlans'` and `shotPlanId`.
Invalid URL combinations fail through the current route-state error behavior;
there is no permissive fallback that silently changes the selected domain item.

Scene Storyboard candidate mutations add:

```ts
ProjectDataService.selectSceneStoryboardImageCandidate({
  projectName,
  sceneId,
  sceneBeatsRevisionId,
  beatId,
  assetId,
});

ProjectDataService.discardSceneStoryboardImageCandidate({
  projectName,
  sceneId,
  sceneBeatsRevisionId,
  beatId,
  assetId,
});
```

Both return the existing structured selection/discard report families with
exact Scene/Revision/Beat resource keys. They add no parallel mutation DTO for
the same durable operation.

### Structured diagnostics

Use `ProjectDataError` at Core boundaries and existing CLI serialization. Add:

| Code | Condition |
| --- | --- |
| `CORE_MEDIA_GENERATION_REFERENCE_LABEL_INVALID` | Missing/invalid Renku review `reviewLabel` |
| `CORE_MEDIA_GENERATION_REFERENCE_MENTION_INVALID` | Invalid bounded/control-character `promptMention` |
| `CORE_MEDIA_GENERATION_REFERENCE_MENTION_DUPLICATE` | Two request marker occurrences use the same non-empty prompt token |
| `CORE_IMAGE_EDIT_SOURCE_INVALID` | Target missing, discarded, non-image, or without an active image file |
| `CORE_IMAGE_EDIT_SOURCE_REFERENCE_MISSING` | Provenance request does not include an exact current file from the source Asset |
| `CORE_IMAGE_EDIT_CONTINUATION_UNSUPPORTED` | Source image type has no current same-place continuation handler |
| `CORE_IMAGE_EDIT_OWNER_INVALID` | Source type and durable owner/detail relationship disagree |
| `CORE_IMAGE_EDIT_SURFACE_UNAVAILABLE` | Source Beat, Shot, or Plan no longer resolves to a current product surface |
| `CORE_SHOT_PLAN_IMAGE_ASSETS_NOT_FOUND` | Exact Shot Plan cannot be resolved for projection |
| `CORE_SCENE_STORYBOARD_CANDIDATE_CONTEXT_INVALID` | Scene Beats revision is not active, Beat is absent, or candidate is not owned by that exact Beat |

Engines adds only `ENGINE_INPUT_SCHEMA_UNAVAILABLE`. CLI uses the existing
structured unknown/missing-flag diagnostics and does not invent parallel domain
codes.

## Implementation Slices

### Slice 1: Exact request-reference annotations and Engines substitution

Files:

- `packages/engines/src/media/contracts.ts`
- `packages/engines/src/media/local-files.ts`
- `packages/engines/src/media/local-files.test.ts`
- `packages/core/src/client/media-generation-review.ts`
- `packages/core/src/server/media-generation-review/local-media.ts`
- `packages/core/src/server/media-generation-review/preview.test.ts`
- `packages/core/src/server/media-generation-review/document.test.ts`

Work:

- accept optional standalone marker annotations;
- replace the entire annotated marker before provider validation/upload;
- require and safely project Renku `reviewLabel`;
- preserve optional exact `promptMention` and marker occurrence order;
- add JSON Pointer identity and stop path deduplication;
- validate annotation envelope only; and
- preserve annotations through absolute-path execution translation and safe
  provenance persistence.

### Slice 2: Exact-token Studio prompt completion and visual regression tests

Files:

- `packages/studio/src/features/media-generation-request/media-generation-prompt-editor.tsx`
- `media-generation-prompt-mentions.ts`
- `media-generation-prompt-reference-completion.ts`
- `media-generation-prompt-reference-preview.ts`
- `media-generation-reference-card.tsx`
- their focused tests
- `packages/studio/e2e/tests/regression/prompt-editor.regression.spec.ts` and
  its six existing snapshot paths
- `packages/studio/e2e/fixtures/studio-e2e-generation-preview.ts`

Work:

- remove media-kind counters and derived `@...` values;
- use only projected `promptMention` values for completion/decorations;
- use `reviewLabel` for option/card accessibility and visible meaningful copy;
- support typed `@` discovery and explicit completion for non-`@` tokens;
- prove references without mentions remain visible but non-completable;
- prove Preview and Inspection reuse the same behavior; and
- restore light/dark normal, completion, and preview snapshots at the accepted
  desktop viewport.

### Slice 3: Live provider input-schema inspection

Files:

- `packages/engines/src/media/contracts.ts`
- `packages/engines/src/media/engine.ts`
- Fal.ai, Replicate, and WaveSpeed provider `index.ts` / metadata tests
- `packages/engines/src/shared/errors.ts`
- `packages/cli/src/commands/generation/schema.ts`
- `packages/cli/src/commands/generation/command.ts`
- focused Engine/CLI tests and CLI docs

Work:

- expose existing loaders without duplicating retrieval;
- return exact raw provider JSON;
- fail closed for providers without schema inspection;
- resolve credentials/cache through the existing CLI context; and
- add package-boundary tests proving Core and Studio do not import or normalize
  provider schemas.

### Slice 4: Preserve and reorganize existing editorial prompt guides

Studio-skills files:

- new owning folder `skills/media-producer/references/prompt-guides/` with the
  exact `shared/`, `image/`, and `video/` tree in Product Decision 2
- every old source path in the exact move inventory
- Media Producer `SKILL.md`, purpose/workflow references, evals, samples, and
  release checks that link to moved guidance
- restored `skills/media-producer/scripts/validate-image-prompt-guides.mjs`
  and `validate-video-prompt-guides.mjs`, adapted to the current workflow

Work:

- restore the two deleted guide registries from `HEAD` directly into
  `prompt-guides/image/guide-registry.json` and
  `prompt-guides/video/guide-registry.json`;
- move every retained editorial guide through the exact source/destination
  inventory and remove the old paths in the same change;
- preserve every guide's editorial body, examples, source URLs, confidence, and
  review date;
- make only mechanical workflow edits required by the removal of
  GenerationSpec/descriptor/providerPayload concepts;
- update every relative Markdown link, registry guide path, Skill instruction,
  eval/sample reference, validator fixture, and release-package assertion to
  the new hierarchy;
- keep current provider-Skill technical guides and supported-model indexes
  unchanged except where they must instruct the provider Skill to preserve an
  authored `reviewLabel` and add the exact `promptMention`;
- add no new model/provider guide coverage, prose, registry entry, or guide
  index field; and
- keep inactive Kling research and the Veo example packaged under their model
  folders but unregistered; and
- leave `image-operation-routing.md`, `image-output-review.md`, all
  purpose-specific references, and `shot-plan-video/` in place.

### Slice 5: `image.create` Shot Plan attachment and context

Files:

- `packages/core/src/client/media-attachments.ts`
- `packages/core/src/server/media-generation-context/purpose-registry.ts`
- `packages/core/src/server/media-generation-context/purposes/project.ts`
- `packages/core/src/server/media-generation-context/purposes/shot-plan.ts`
- `packages/core/src/server/generation/attachment-destinations.ts`
- `packages/core/src/server/generation/attachments.ts`
- Core/CLI context and attachment tests
- Media Producer workflow/evals/samples

Work:

- change the exact target kind to Shot Plan and update all callers directly;
- reuse the Plan context projector without making `image.create` a focused
  first/last/storyboard purpose;
- attach as Project-owned `shot_plan_video_reference` with exact authored-from
  Plan and canonical `reference-gxxx` storage;
- require exact image provenance and preserve non-selection; and
- emit the Shot Plan image-assets resource key.

### Slice 6: Core source-derived image-edit continuation

Files:

- new `packages/core/src/server/image-edit-attachments/` module named in the
  Architecture Shape Gate
- narrow delegation in `generation/attachments.ts`
- existing focused destination/persistence functions as reuse targets
- exhaustive `image-edit-attachments/*.test.ts`

Work:

- validate source Asset/file/provenance relationship before writes;
- implement every matrix row through focused handlers;
- reuse normal destination and detail-row persistence rather than duplicating
  paths or SQL;
- allocate one new Storyboard iteration for a Beat edit;
- preserve metadata and source selection state;
- emit exact existing/new resource keys; and
- prove every failure rolls back or occurs before the write set begins.

### Slice 7: Shot Plan image-assets projection and Studio surface

Files:

- new Core `shot-plan-image-assets/` module and client contract
- `project-data-service-contracts.ts` and focused service wiring
- new Studio route, response adapter, service API/contracts, hook, and Assets
  tab named in the Architecture Shape Gate
- `shot-plan-detail-page.tsx`
- Core `StudioSelection`, Studio route parsing/serialization, and selection
  tests for `shotPlanTab`
- coordination resource-key docs/tests

Work:

- query exact Project-owned image types by `authoredFromShotPlanId`;
- group in fixed role order in Core;
- add the exact route and browser URLs;
- add Shots/Assets tabs while preserving current Shots layout;
- reuse `MediaCard`, preview, inspection, and discard behavior; and
- validate focused Plan-image discard in Core before generic Asset removal; and
- refresh only the exact selected Shot Plan Assets projection after attachment
  or discard.

### Slice 8: Beat Storyboard image candidate surface

Files:

- `packages/studio/server/routes/scene-storyboard-images.ts` and route tests
- `packages/core/src/server/scene-beats/storyboard-image-candidates.ts` and
  focused service tests/wiring
- `packages/studio/src/services/studio-scene-storyboard-images-contracts.ts`
- `packages/studio/src/services/studio-scene-storyboard-images-api.ts`
- `packages/studio/src/features/movie-studio/scenes/beat-storyboard-image-candidates-dialog.tsx`
- `packages/studio/src/features/movie-studio/scenes/use-beat-storyboard-image-candidates.ts`
- `packages/studio/src/features/movie-studio/scenes/scene-beats-tab.tsx`
- focused component/selection/discard tests

Work:

- expose the existing Core `SceneStoryboardStatus` to Studio;
- add focused Core active-revision/Beat/candidate validation before mutation;
- list all candidates for the selected Beat and mark the current selection;
- delegate from the focused commands to existing Core Asset selection/discard,
  and adapt candidates to the existing `MediaCardCollectionDialog`,
  `MediaCard`, image preview, Generation Request inspector, selection, and
  Trash-action contracts in Studio;
- launch from the exact selected-Beat aside Button and use the MediaCard
  collection dialog even for one candidate;
- refresh exact Scene/Revision/Beat resources; and
- prove an unselected `image.edit` result is visible without replacing the
  current selected Storyboard image.

### Slice 9: Restore manual provider E2E suites

Files:

- the six E2E files and retained small fixtures listed above
- `packages/engines/tests/e2e/provider-test-credentials.ts`
- `packages/engines/tests/e2e/README.md`
- `packages/engines/vitest.e2e.config.ts`
- package scripts/release exclusions

Work:

- port retained provider scenarios to `MediaProvider` / `MediaEngine`;
- rename the obsolete ElevenLabs Generation Runner file to the current engine
  scenario;
- keep test-specific flags and explicit environment credentials;
- keep output counts/durations small and clean temporary artifacts; and
- verify default commands do not perform network or paid execution.

### Slice 10: Restore current-architecture validators and forward evals

Files:

- `scripts/validate-media-generation-skills.mjs`
- restored `skills/media-producer/scripts/validate-image-prompt-guides.mjs`
- restored `skills/media-producer/scripts/validate-video-prompt-guides.mjs`
- new `scripts/validate-media-purpose-evals.mjs`
- `skills/media-producer/evals/` current files and a stable purpose coverage
  manifest
- current review samples, provider Skill indexes/guides, package/release tests

Work:

- restore detailed prior scenarios on the new workflow;
- validate all current purpose families and cross-cutting cases;
- validate the restored image/video guide registries, guide applicability, and
  existing sources without semantically scoring prompts or requiring new model
  coverage;
- validate no schema facts enter supported-model indexes;
- validate exact-token Seedance/MiniMax cases and implicit references; and
- keep obsolete Spec/model-list concepts forbidden.

### Slice 11: ADR and current documentation alignment

Files:

- new `docs/decisions/0088-use-exact-request-references-and-source-derived-image-continuation.md`
- update notices in Decisions 0046, 0058, 0086, and 0087
- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/project-asset-storage-conventions.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/studio-skills.md`
- `docs/architecture/reference/studio-coordination-events.md`
- `docs/cli/commands.md`
- current workflow docs and both repository READMEs where they enumerate the
  generation flow

Work:

- document exact completion ownership and schema separation;
- document `image.create` Shot Plan target/storage/surface;
- document source-derived edit continuation and full storage matrix;
- document Shot Plan Assets projection/resource key;
- document manual paid E2E policy and current validators; and
- leave historical plans unchanged.

## Tests And Guardrails

### Engines behavior

- annotated marker recognition accepts only `$file`, optional MIME type, and the
  two named annotations; malformed annotation types fail clearly;
- validation substitution replaces the entire object, so no annotation key
  reaches provider JSON Schema validation;
- upload substitution sends bytes/MIME/path but not UI annotations;
- schema read delegates once to the exact registered provider and existing
  metadata cache;
- Fal.ai, Replicate, and WaveSpeed schema reads return deterministic fixture
  JSON in unit tests;
- ElevenLabs schema read returns `ENGINE_INPUT_SCHEMA_UNAVAILABLE`;
- standalone public consumer compiles against the extended contract; and
- package architecture checks still prove no workspace dependencies.

### Core review/provenance behavior

- every marker occurrence is retained in recursive request order;
- repeated file paths at different request pointers remain separate;
- exact `reviewLabel` and optional `promptMention` survive Preview, prompt
  update, execution path translation, provenance, and Inspection;
- duplicate non-empty prompt mentions fail without reading prompt text;
- a missing mention is valid and still projects a Reference card;
- unsafe/missing file behavior remains unchanged;
- no context candidate enters review unless it exists in the request; and
- prompt text is never checked for mention presence or model syntax.

### Studio prompt behavior

- Seedance `@Image1` and `@Audio1` complete and decorate exactly;
- MiniMax `Image 1` and `Audio 1` complete through explicit completion and
  decorate exactly;
- mixed punctuation/space tokens are inserted unchanged;
- an implicit reference is visible in References but absent from completion;
- completion filters on meaningful review label;
- duplicate file markers use stable `requestPointer` keys;
- Preview prompt updates preserve request annotations;
- Inspection is read-only but uses identical decoration/reference cards; and
- six restored light/dark normal/completion/preview snapshots match the accepted
  desktop composition.

### `image.create` behavior

- Project target now fails with the existing target diagnostic and no fallback;
- exact Shot Plan target returns relevant Plan 0191 context;
- import creates Project-owned `shot_plan_video_reference` with exact
  `authoredFromShotPlanId`;
- path is the exact Plan root plus `reference-gxxx.<ext>`;
- no Shot membership or automatic selection is created;
- wrong media/provenance/Plan fails before file write; and
- Studio projection groups the result under Reference Images for only that Plan.

### `image.edit` matrix behavior

For every row in the storage matrix, test:

- exact valid source owner/type/file resolution;
- exact destination kind and canonical path/stem;
- new Asset retains source type and same owner/Plan authorship;
- source metadata defaults/explicit overrides;
- required Lookbook detail row and ordering;
- Beat Storyboard new iteration allocation and same Beat owner;
- Shot membership and containing Plan validation;
- weak Plan provenance for all four Plan image roles;
- source and selection rows remain unchanged;
- new candidate is unselected;
- exact resource keys refresh the current product surface;
- provenance request contains an exact source Asset File;
- wrong source reference, owner mismatch, stale relationship, unknown image
  type, and non-image target fail before a durable file appears; and
- a forced persistence failure rolls back copied files and inserted rows.

Architecture tests must protect import boundaries and runtime behavior. They
must not list private handler function names or inspect source text for current
helper names.

### Shot Plan Assets behavior

- projection excludes Project images from another Plan;
- projection excludes Plan videos and unrelated Project images;
- fixed group order is preserved and empty groups are omitted;
- trashed/discarded assets/files are absent;
- route delegates once and returns safe browser URLs;
- focused discard rejects another Plan's or another Project collection's Asset;
- Shots tab retains current Shot rail/detail/manage-image behavior;
- `shotPlanTab=assets` round-trips through Studio selection/URL state and an
  invalid combination fails explicitly;
- Assets tab uses shadcn/local UI controls and `MediaCard` only;
- image preview, request inspection, and discard refresh work; and
- Scene-level Generations tab remains video-only and unchanged.

### Beat Storyboard candidate behavior

- opening Manage Storyboard Images does not change selection;
- only candidates owned by the exact Scene Beat are shown;
- the current candidate is marked from `selectedImageId`;
- an edited unselected candidate appears beside the source candidate;
- select uses exact Scene Beat owner and refreshes Beat/Revision/Scene resources;
- select/discard reject a stale revision or Asset from another Beat;
- preview and Generation Request inspection use the exact candidate Asset; and
- existing Scene Beats cards continue to display the selected Storyboard image.

### Skills behavior and release guardrails

- every current provider-Skill model route still resolves to its existing
  packaged technical guide;
- every route in the restored Media Producer image/video guide registries
  resolves to the corresponding moved curated guide under
  `references/prompt-guides/`;
- the existing curated guides retain their editorial guidance, applicability,
  sources, confidence where present, and review date; no new model editorial
  content is required in this plan;
- Seedance and MiniMax reference syntax cases remain distinct;
- current provider technical guides are not deleted or replaced by newly
  authored editorial guides;
- indexes contain exactly `id`, `name`, `inputModes`, `guide`;
- Media Producer guide registries contain only their restored
  `provider`/`model`/`guide` routing records;
- no checked-in schema/default/bound/price fields are introduced;
- every current MediaPurpose is covered by a forward eval id;
- previous high-value editorial/routing scenarios remain represented;
- current review samples cover image, video, audio, Codex, annotated references,
  and an implicit reference;
- `GenerationSpec`, model-list descriptors, providerField, and obsolete samples
  remain forbidden; and
- release packaging includes provider guides and validator/eval manifests.

### Paid-test safety

- every paid suite is skipped when its exact `RUN_*` value is absent or not
  `1`, even when a credential exists;
- opting in without the matching credential fails before a provider call;
- tests never read Core configuration or the Renku credential file;
- root `pnpm test`, `pnpm check`, and release contract tests perform no paid
  calls; and
- no live paid suite is run as part of this plan without a separate explicit
  user approval.

## Documentation

### Decision 0088

Decision 0088 records:

- Core context is advisory evidence; exact provider request markers own review
  and completion inventory;
- Media Producer owns the restored curated editorial prompt guides; Provider
  Skills own exact model tokens and native request authorship;
- Engines owns live schema inspection and strips presentation annotations before
  provider validation/execution;
- `image.create` is exact Shot Plan-scoped generic reference creation;
- `image.edit` attachment destination is derived by Core from the source Asset;
- edited output is a separate unselected same-place candidate; and
- no schema normalization, path guessing, prompt semantic validation, or
  destination fallback is accepted.

### Existing decision notices

- Decision 0046: `image.create` remains generic creation but is no longer an
  unattached Project-scoped result; Decision 0088 places it in an exact Shot
  Plan reference collection.
- Decision 0058: agent-owned edit, inspection, acceptance, separate candidate,
  and unchanged selection remain; independently selected attachment destination
  is replaced by source-derived same-place continuation.
- Decision 0086: provider/Skill/Core ownership remains; exact marker
  annotations and raw schema inspection clarify the seam.
- Decision 0087: deterministic context remains advisory; `image.create` now
  uses exact Shot Plan context, and exact request markers—not suggestions—drive
  Preview completion.

### Architecture and CLI docs

Update current documents to include the exact command, DTOs, storage paths,
continuation matrix, Shot Plan Assets UI, and manual E2E policy. Do not edit old
plans merely to make historical wording match the new decision.

## Final Verification

### Focused commands

Run unpaid deterministic verification only:

```bash
pnpm build:core
pnpm test:core
pnpm test:engines
pnpm test:cli
pnpm test:studio
pnpm test:typecheck:studio
pnpm lint:studio
pnpm --dir packages/studio exec playwright test \
  e2e/tests/regression/prompt-editor.regression.spec.ts
```

In `studio-skills`:

```bash
pnpm test
node scripts/validate-media-generation-skills.mjs
node skills/media-producer/scripts/validate-image-prompt-guides.mjs
node skills/media-producer/scripts/validate-video-prompt-guides.mjs
node scripts/validate-media-purpose-evals.mjs
```

Then run repository-wide unpaid verification because the change crosses public
Core/Engines/CLI/Studio/Skill contracts:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Do not run any `RUN_*` provider suite without a new explicit approval.

### Real-project read-only and local attachment verification

Use Urban Basilica for realistic, unpaid verification:

1. Read `generation context` for Urban Cast and confirm it returns all relevant
   advisory candidates without selecting them.
2. Open a local review fixture selecting only Urban Character Sheet and Imperial
   Wound Lookbook. Confirm References/completion contain exactly those two and
   exact Seedance or MiniMax token forms.
3. Confirm an implicit opening-frame marker remains visible without a completion
   token.
4. Import a local fixture output through `image.create` to an exact Shot Plan in
   a disposable/test project copy; confirm the Asset is Project-owned, weakly
   authored from that Plan, stored as `reference-gxxx`, and shown under that
   Plan's Assets > Reference Images.
5. Import a local fixture edit of the Theodosian Walls establishing sheet in a
   disposable/test project copy; confirm the result remains Location-owned,
   stays in `locations/theodosian-walls/`, appears in that Location's Assets
   tab, and does not change the selected sheet.
6. Exercise Beat Storyboard, Shot image, and Plan first-frame edit continuations
   in test fixtures because they cover the nontrivial iteration/Shot/weak-Plan
   branches. Confirm the edited Beat candidate is visible in Manage Storyboard
   Images while the previous selected image remains on the Beat card.

Do not mutate the real Urban Basilica or Big Fish databases merely to prove the
plan. Use their current data read-only and perform writes in fixture/disposable
copies.

### Architecture-shape review

- inspect `git diff --stat` and the complete diffs in both `studio` and
  `studio-skills`;
- inspect every new/heavily modified file named by the Architecture Shape Gate;
- confirm `generation/attachments.ts`, CLI `generation/command.ts`, and Shot
  Plan detail composition remain thin;
- confirm edit type cases are split across focused continuation modules;
- confirm `project-asset-files/` remains the only durable path owner;
- confirm Engines schema reads reuse existing metadata loaders;
- confirm no provider/model field/token logic entered Core, Studio, or CLI;
- confirm provider indexes contain no schema facts;
- confirm no new god file, catch-all helper, broad dispatcher, re-export stub,
  compatibility alias, or hidden Pika work was added;
- confirm current user-facing Shots behavior and Scene Generations video surface
  did not regress; and
- confirm no checklist item was satisfied by accepting unreviewable code
  structure.

## Completion Checklist

### Review Area

- [x] Confirm Plan 0191 context remains implemented and advisory.
- [x] Confirm exact request markers—not context candidates—own reference
      completion.
- [x] Confirm the existing model-specific editorial prompt guidance is
      preserved without newly authored model guidance or expanded route scope.
- [x] Confirm no provider/model schema or field map was reintroduced.
- [x] Confirm `image.create` results are visible beside the exact Shot Plan.
- [x] Confirm every current `image.edit` output appears in the source Asset's
      same current product collection.
- [x] Confirm source Assets and selections remain unchanged after edit import.
- [x] Confirm the implementation preserves accepted architecture boundaries.
- [x] Confirm centralized ownership did not become a monolithic implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, or god file was added.
- [x] Confirm Plan 0190/Pika and database fleet hardening remained out of scope.

### Architecture And Contracts

- [x] Add optional Engines marker annotations without making Studio metadata a
      requirement for standalone callers.
- [x] Require meaningful labels in Renku review/provenance markers.
- [x] Add exact marker occurrence identity and preserve request order.
- [x] Add `MediaProvider.readInputSchema?` and
      `MediaEngine.readInputSchema` deliberately.
- [x] Add `ENGINE_INPUT_SCHEMA_UNAVAILABLE` and Core structured diagnostics.
- [x] Add `generation schema show --provider --model --json` as a thin command.
- [x] Change `image.create` target directly to `shotPlan` with no alias/fallback.
- [x] Add exact `image.create` destination/type/owner/authorship/storage.
- [x] Add source-derived `image.edit` continuation with no destination flag.
- [x] Add `ShotPlanImageAssets` and
      `ProjectDataService.readShotPlanImageAssets`.
- [x] Add focused `ProjectDataService.discardShotPlanImageAsset` eligibility.
- [x] Add focused Scene Storyboard candidate select/discard commands that own
      active revision and Beat eligibility.
- [x] Add the exact Shot Plan image-assets route and resource key.
- [x] Add exact `shotPlanTab` Studio selection/URL state.
- [x] Keep package-boundary diagnostics structured.
- [x] Keep durable business rules in Core and provider facts in Engines/Skills.
- [x] Keep `project-asset-files/` as the only durable path allocator/writer.
- [x] Add no database schema/migration unless this plan is revised and
      re-approved.

### Reference Completion And Review

- [x] Store `reviewLabel`/optional `promptMention` only inside exact `$file`
      markers in Project review JSON and durable Asset `generation_provenance`;
      add no completion registry, table, cache, sidecar, or provider/model map.
- [x] Verify the Urban Basilica concrete review path and JSON Pointer example,
      Preview-only projection, execution stripping, provenance handoff file,
      and `.renku/project.sqlite` Asset persistence lifecycle.
- [x] Strip `reviewLabel`/`promptMention` before provider validation/upload.
- [x] Preserve annotations through Preview, prompt update, execution translation,
      provenance, and Inspection.
- [x] Stop deduplicating distinct marker occurrences by file path.
- [x] Show every request reference with its meaningful review label.
- [x] Include only references with `promptMention` in completion/decorations.
- [x] Insert Seedance, MiniMax, and other exact tokens unchanged.
- [x] Support explicit completion for tokens that do not start with `@`.
- [x] Keep implicit references visible but non-completable.
- [x] Never inspect prompt text to judge token correctness or presence.
- [x] Restore Preview/Inspection shared rendering behavior.

### Provider Schema And Editorial Guides

- [x] Reuse Fal.ai's existing live input-schema loader.
- [x] Reuse Replicate's existing live input-schema loader.
- [x] Reuse WaveSpeed's existing live input-schema loader.
- [x] Fail explicitly for ElevenLabs or another provider without live schema
      inspection.
- [x] Inventory prior curated image/video/audio model guidance and sources.
- [x] Create the exact `references/prompt-guides/` shared/image/video hierarchy
      from Product Decision 2.
- [x] Restore the image/video guide registries under their new modality folders
      with only their prior route entries and updated guide paths.
- [x] Move the three existing image-model guides into one folder per model
      family with `index.md` as the family guide.
- [x] Move every existing Seedance and MiniMax guide into the corresponding
      video model-family folder without changing its editorial contents.
- [x] Move inactive Kling research and the Veo example into their video model
      folders without registering them as supported guide coverage.
- [x] Move existing image/video shared prompt-authoring guidance to the exact
      `shared/` destinations; keep workflow/output-review/purpose references
      outside the prompt-guide hierarchy.
- [x] Preserve Codex GPT Image editorial guidance in the existing shared GPT
      Image 2 guide.
- [x] Preserve exact Seedance and MiniMax mention differences.
- [x] Preserve source URLs, confidence where appropriate, and review dates.
- [x] Limit guide edits to mechanical replacement of obsolete generation
      workflow terminology; author no new model editorial content.
- [x] Keep model indexes exactly `id/name/inputModes/guide`.
- [x] Keep current provider technical guides and add no new `promptGuide` index
      field or provider `references/models/` hierarchy.
- [x] Update every Media Producer link, registry path, validator, eval/sample
      reference, and release-package assertion to the new paths.
- [x] Delete the old guide paths directly with no duplicate files, lookup
      fallback, re-export/link stub, or compatibility alias.
- [x] Restore and adapt the prior image/video prompt-guide validators at their
      original paths.
- [x] Copy no live schema/default/bound/price catalog into Skills.

### Image Create And Shot Plan Assets

- [x] Reuse full Plan 0191 context for Shot-Plan-scoped `image.create`.
- [x] Require exact image provenance for `image.create` attachment.
- [x] Persist Project owner, `shot_plan_video_reference` type, and exact
      `authoredFromShotPlanId`.
- [x] Allocate `scenes/<scene>/<NN>-shot-plan/reference-gxxx.<ext>` only through
      the existing destination.
- [x] Leave Plan reference selection unset.
- [x] Add the Shot Plan-local Shots/Assets tabs.
- [x] Round-trip `shotPlanTab=assets` and reject invalid route combinations.
- [x] Preserve the complete existing Shots rail/detail/manage-images behavior.
- [x] Group Plan images as First Frames, Last Frames, Storyboards, Reference
      Images in Core.
- [x] Reuse `MediaCard`, preview, inspection, and discard behavior.
- [x] Validate Plan-image discard in Core rather than trusting a Project owner
      supplied by the route.
- [x] Keep the Scene Generations tab video-only and unchanged.

### Image Edit Continuation

- [x] Validate the exact target Asset, owner, current image file, and provenance
      source marker before writing.
- [x] Implement Project Cover continuation.
- [x] Implement Cast Profile and Character Sheet continuations.
- [x] Implement Location Hero and Sheet continuations.
- [x] Implement Prop Hero and Sheet continuations.
- [x] Implement Lookbook Image and Sheet continuations with new detail rows.
- [x] Implement Beat Storyboard continuation with a new iteration folder.
- [x] Add Manage Storyboard Images so edited Beat candidates are discoverable
      without changing the current selection.
- [x] Launch Manage Storyboard Images from the outline Button directly below
      the selected Beat heading in the existing right detail aside.
- [x] Render every candidate count through the existing
      `MediaCardCollectionDialog`/`MediaCardGrid`/`MediaCard` contracts, with no
      one-item preview shortcut or new card/dialog design.
- [x] Reuse existing image preview, Generation Request inspector, choose,
      selected-state, and Trash confirmation card behavior.
- [x] Implement Shot image continuation with exact containing Plan.
- [x] Implement Plan first-frame, last-frame, storyboard, and reference
      continuations with exact weak authorship.
- [x] Preserve source metadata by default and accept explicit overrides.
- [x] Reuse existing destination modules and collision-safe naming.
- [x] Preserve source Asset, files, membership, and selection.
- [x] Create the edit result as a separate unselected generated Asset.
- [x] Fail unknown/unclassified image types without a Project fallback.
- [x] Fail stale/mismatched owner relationships before allocation/copy.
- [x] Roll back copied files and rows on persistence failure.

### Provider E2E Tests

- [x] Restore Fal.ai E2E against `MediaEngine`.
- [x] Restore Replicate E2E against `MediaEngine`.
- [x] Restore WaveSpeed E2E against `MediaEngine`.
- [x] Restore direct ElevenLabs generation E2E scenarios.
- [x] Restore ElevenLabs provider voice-sample E2E.
- [x] Add the renamed ElevenLabs registered-MediaEngine paid scenario.
- [x] Keep exact test-specific `RUN_*` flags and environment credentials.
- [x] Keep E2E tests independent from Core credential storage.
- [x] Confirm default tests/check/release cannot make paid calls.
- [x] Do not run a paid test without separate explicit user approval.
- [x] Keep intentionally removed OpenAI/Qwen/Vercel E2E files deleted.

### Forward Evals And Validators

- [x] Restore detailed forward evals for every current MediaPurpose family.
- [x] Restore image create/edit routing and source-preserving edit scenarios.
- [x] Restore purpose-specific Cast/Location/Prop/Lookbook/Storyboard/Shot cases.
- [x] Restore Shot Plan first/last/storyboard/reference/final-video cases.
- [x] Restore Cast Voice and Scene Dialogue Audio cases.
- [x] Restore Preview edit, provider recovery, output review, import, and
      selection cases.
- [x] Restore deliberate departure from context suggestions.
- [x] Add exact Seedance/MiniMax/implicit-reference cases.
- [x] Restore the image and video prompt-guide
      applicability/editorial/source validators at their prior Media Producer
      paths and adapt only obsolete workflow checks.
- [x] Add stable current-purpose eval coverage manifest/validator.
- [x] Keep validators structural/editorial-coverage oriented, not creative
      semantic scorers.
- [x] Keep obsolete Spec/model-list/providerField concepts forbidden.
- [x] Update release contract/package coverage.

### Tests And Guardrails

- [x] Add/update Engines annotated-marker and schema-read tests.
- [x] Add/update Core review/provenance occurrence/annotation tests.
- [x] Add/update Studio exact-token completion/decorator/reference tests.
- [x] Restore all six prompt-editor desktop snapshots.
- [x] Add exhaustive Core image-edit matrix tests.
- [x] Add no-write and rollback tests for every invalid continuation family.
- [x] Add `image.create` context/attachment/path/ownership tests.
- [x] Add Shot Plan Assets projection/service/route/component tests.
- [x] Add Beat Storyboard candidate status/route/dialog/selection/discard tests.
- [x] Add/update import-boundary tests for Core/Studio/CLI schema separation.
- [x] Avoid architecture tests that name private helpers or implementation
      inventories.
- [x] Run the shape-review checks listed in Final Verification.

### Documentation

- [x] Add Decision 0088.
- [x] Add update notices to Decisions 0046, 0058, 0086, and 0087.
- [x] Update current media-generation architecture docs.
- [x] Update exact project storage matrix and Shot Plan image surface docs.
- [x] Update Studio Skills ownership/guide docs.
- [x] Update coordination event/resource-key docs.
- [x] Update CLI command docs with `generation schema show` and changed targets.
- [x] Update current workflow/release docs and READMEs.
- [x] Do not edit historical plans merely for naming sweeps.

### Final Verification

- [x] Run focused Core, Engines, CLI, Studio, and Skill tests.
- [x] Run Studio desktop snapshot verification only; do not add mobile work.
- [x] Run Studio's unpaid root build/test/lint/check commands and the
      studio-skills root test/validator commands.
- [x] Perform Urban Basilica read-only context/completion/storage audit.
- [x] Perform attachment writes only in fixtures or disposable project copies.
- [x] Confirm no live paid test was executed without separate approval.
- [x] Review `git diff --stat` and complete diffs in both repositories.
- [x] Inspect all large/heavily modified files.
- [x] Confirm `index.ts` files remain thin entrypoints.
- [x] Confirm no new god file, broad dispatcher, catch-all helper, schema catalog,
      compatibility shim, or Pika implementation exists.
- [x] Confirm no checklist item is satisfied by accepting unreviewable code
      structure.
- [x] Only then mark the plan complete.
