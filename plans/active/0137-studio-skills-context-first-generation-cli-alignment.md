# 0137 Studio Skills Context-First Generation CLI Alignment

Status: complete

Date: 2026-07-13

## Summary

Complete the sister `studio-skills` repository's cutover to the context-first
generation and focused attachment contracts now implemented in Studio Core and
the CLI.

The current `studio` worktree replaces purpose-specific generation specs,
dependency planning, take authoring commands, route/input-mode abstractions,
recursive estimates, and broad media imports with:

- one generic `GenerationSpec` and direct provider endpoint;
- Core-owned purpose context, settings, guide placements, candidates, and
  notices;
- Engines-owned provider fields and schema validation;
- exact references assigned to actual provider media fields;
- pricing-only estimates and provider/model price-approval tokens;
- one-request runs followed by focused attachment or direct project-file reuse.

The sister worktree already contains a substantial first-pass rewrite and must
be treated as the implementation baseline, not reset or replaced. That rewrite
is incomplete. Current instructions still invoke deleted commands and flags,
name obsolete purposes, omit required `providerField` assignments from sample
specs, and describe removed route/input/dependency concepts. This plan closes
those gaps without adding compatibility language or moving runtime rules into
skills.

This plan supersedes only the Studio Skills closure claim in Plan `0136` and
`docs/architecture/reference/context-first-generation-caller-handoff.md`.
Plan `0136` remains the authority for the Core, Engines, CLI, Studio, migration,
and desktop compatibility work.

## Evidence From The Current Worktrees

The `studio` worktree currently exposes this generic CLI lifecycle:

```text
generation context
generation reference list
generation model list
generation validate
generation spec create
generation spec update
generation spec show
generation spec list
generation preview show
generation estimate
generation run
generation run show
```

The `studio-skills` worktree already renames several purposes and converts many
samples to `GenerationSpec`, but the following concrete gaps remain:

- `movie-director/SKILL.md` and
  `movie-director/references/workflow-playbooks.md` still call deleted
  `renku take authoring context` and teach the removed
  `sceneShotVideoTakeAuthoring` document;
- `movie-director` handoff text still preserves removed input-mode choices;
- `scene-shot-designer/SKILL.md` calls `lookbook.video-sheet` a Storyboard
  dependency, but Scene Storyboard context uses the non-blocking
  `visual-language/storyboard-lookbook-sheet` slot and purpose
  `lookbook.storyboard-sheet`;
- Cast Profile and Cast Voice references still pass removed `--target` flags to
  `generation model list`;
- `media-producer/references/reference-visible-image-prompting.md` still imports
  `shot.input`, which the focused media import handler no longer supports;
- Lookbook Designer still passes `--sections` and `--anchor` to `media import`,
  even though focused import now creates the Lookbook Image and returns its
  `ownerRecord.id`; placement is a separate
  `lookbook image set-placement` command;
- Casting Director still teaches unsupported
  `media import --purpose reference.image`;
- Seedance and Kling references still depend on Renku route ids, input modes,
  logical-input mapping, prepared-input order, and take authoring context;
- `prompt-quality-checklist.md` still asks about the active route/input mode and
  prepared inputs rather than the selected direct endpoint, model field
  descriptors, exact selections, and generated provider preview;
- every checked sample containing an included reference omits
  `providerField`, so the current Engines assembler reports that the reference
  is not assigned to a provider media field;
- several samples and prompt guides contradict their own chosen aspect ratio or
  hard-code a recommendation that must instead come from current context;
- the sister README still documents removed prompt-sheet fields and logical
  references;
- `future-purpose-sketches.md` keeps speculative, non-current purpose guidance
  inside an operational skill.

These are agent-facing correctness problems. For example, an agent following
the current Movie Director workflow cannot run the deleted `take authoring`
command. An agent copying the current first/last-frame sample reaches
`generation validate`, but its two included references have no provider field
and therefore fail before estimate. An agent following the Lookbook import
example successfully imports an image but silently gets no section placement,
because those media-import flags are no longer consumed.

## Context And Accepted Authority

Implementation is constrained by:

- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`;
- `docs/decisions/0047-use-context-first-provider-valid-generation.md`;
- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/studio-skills.md`;
- `docs/architecture/reference/context-first-generation-caller-handoff.md`;
- `docs/cli/commands.md`;
- `plans/active/0134-context-first-generation-simplification.md`;
- `plans/active/0136-studio-ui-compatibility-and-generation-backend-integration.md`;
- `packages/core/src/client/generation.ts` for the public generic contract;
- `packages/core/src/server/generation/purposes/*.ts` for current purpose
  settings and guide placement ids;
- `packages/cli/src/commands/generation-command-handlers.ts` for the exact CLI
  flags and command paths;
- `packages/cli/src/commands/media-import-command-handlers.ts` for focused
  attachment purposes;
- `$HOME/Projects/aitinkerbox/studio-skills` as the repository being remediated;
- `$HOME/renku-movies/urban-basilica` as realistic source data, used only
  through a disposable verification copy for mutating skill tests.

Creative prompts and media remain agent/user-owned and opaque to Studio
runtime validation. Skills may inspect creative artifacts and recommend prompt
changes, but must not describe those recommendations as Core schemas,
requirements, scoring, or automatic repair.

## Architecture Shape Gate

No Studio production code change is expected. This is an agent-contract and
skill-structure change across the sister repository plus current Studio
documentation.

### Ownership

- `packages/core` remains the only owner of purpose/target validity, fixed and
  recommended settings, stable guide placements, candidate eligibility, spec
  persistence, estimates, runs, provenance, and focused attachment rules.
- `packages/engines` remains the only owner of provider/model availability,
  provider field names, schemas, media cardinality, pricing, request assembly,
  and execution.
- `packages/cli` remains a thin parser/serializer over those contracts.
- `skills/media-producer` owns the agent workflow: read context, make creative
  choices, author an exact spec, preview it, obtain approval, inspect output,
  and call the current attachment command.
- Director, Casting, Production Design, Lookbook, and Scene Shot skills own
  context and specialist handoff only. They must not duplicate generation spec
  construction or provider rules.

### Intended Skill Layout

`skills/media-producer/SKILL.md` remains a concise public router. It contains
the universal order of operations, purpose routing, permission rules, and links
to focused references. It must not grow into a purpose registry, provider
catalog, or complete CLI manual.

The reusable lifecycle has one source of truth:

```text
skills/media-producer/references/workflow.md
```

Purpose and creative guidance stays focused:

```text
skills/media-producer/references/
  cast-character-sheets.md
  cast-profile.md
  cast-voice-sample.md
  location-sheet.md
  location-sheet-board-design.md
  lookbook-image.md
  lookbook-sheets.md
  scene-storyboard-sheet.md
  voice-over-profile-image.md
```

The current singular/obsolete files are renamed directly:

- `cast-character-sheet.md` -> `cast-character-sheets.md`;
- `location-environment-sheet.md` -> `location-sheet.md`;
- `lookbook-sheet.md` -> `lookbook-sheets.md`.

No re-export, duplicate file, alias link, or compatibility note preserves the
old paths.

Shot-specific guidance remains progressively disclosed:

```text
skills/media-producer/references/shot-video-take/
  index.md
  provider-visible-prompting.md
  prompt-quality-checklist.md
  kling/index.md
  seedance/index.md
  seedance/endpoint-selection.md
  seedance/*.md
```

`seedance/route-matrix.md` is renamed directly to
`seedance/endpoint-selection.md`. It may distinguish actual provider endpoints
and their returned field descriptors; it must not recreate Renku route or input
mode abstractions.

Samples remain examples of the public contract, not an alternate schema:

```text
skills/media-producer/samples/
skills/media-producer/samples/shot-video-take/
```

Every sample with an included reference names its actual example
`providerField`. Every model/value/reference combination must be derived from a
current model descriptor and be capable of passing current validation once its
placeholder ids and paths are replaced with real project values.

### Files Expected To Disappear Or Stay Deleted

- Keep the current worktree deletions of dependency-planning references and
  production-group samples. Do not restore them under new names.
- Delete `references/future-purpose-sketches.md`; move any still-current
  creative advice into the owning purpose reference and discard speculative
  runtime/purpose material.
- Delete or rename samples whose filename claims to be a Generation Preview
  payload when the file is actually a `GenerationSpec`. Do not preserve the old
  sample filename as an alias.

### Stop Conditions

Stop this implementation slice and open a separate Studio/Core/CLI design plan
if a required workflow has no current owning command. Do not compensate by:

- teaching a deleted command or ignored flag;
- telling the agent to write the database or canonical media folders;
- fabricating a receipt, asset id, asset-file id, provider field, guide slot,
  or provenance record;
- treating an unsupported focused attachment as generic `media import`;
- reintroducing take authoring, dependency plans, route ids, input modes,
  recursive estimates, or provider-field maps inside a skill;
- adding a broad skill-side purpose table that must be kept in sync with Core.

If a file starts combining the full lifecycle, all purpose rules, multiple
provider catalogs, import behavior, and creative QA, split it before continuing.

## Public Contracts To Teach

### Generic Generation Commands

Skills use the following current forms exactly:

```bash
renku generation context --purpose <purpose> --target <target> --json
renku generation reference list --media-kind <image|audio|video> --json
renku generation model list --purpose <purpose> --json
renku generation validate --file <spec-json> --json
renku generation spec create --file <spec-json> --json
renku generation spec update --spec <spec-id> --file <spec-json> --json
renku generation spec show --spec <spec-id> --json
renku generation spec list --purpose <purpose> --json
renku generation preview show --file <spec-json> --json
renku generation preview show --spec <spec-id> --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <approval-token> --json
renku generation run --spec <spec-id> --approval-token <approval-token> --simulate --json
renku generation run show --run <run-id> --json
```

`generation model list` has no target flag. `generation validate` is not under
`generation spec`. Preview accepts either `--file` or `--spec`, never both.
The approval token is taken from the current estimate and approves the
provider/model price derived from pricing inputs. A pricing-input change can
produce a new token; creative prompt or reference changes can leave the token
unchanged. Every request change still requires validation, a new Preview, a
fresh estimate review, and explicit live-run confirmation. Run performs
execution-readiness validation separately.

### Generic Spec And Reference Shape

Teach one public shape:

```json
{
  "purpose": "location.sheet",
  "target": { "kind": "location", "id": "location_sea_walls" },
  "model": { "provider": "fal-ai", "model": "openai/gpt-image-2" },
  "values": { "prompt": "..." },
  "references": [],
  "title": "Sea walls Location Sheet"
}
```

Every included reference contains:

- one exact `asset-file` identity or normalized project-relative
  `project-file` path;
- a stable context-returned slot placement or `{ "kind": "additional" }`;
- `included: true`;
- an actual `providerField` from the selected model descriptor.

Guide placement and provider field are orthogonal. A guide slot explains the
reference's product role; `providerField` explains where that exact file enters
the selected provider request. Skills preserve context-returned section, slot,
scope, and subject ids and never derive them from labels.

Fixed settings are Core-owned and need not be copied into authored `values`.
Recommended settings and the recommended model remain guidance until the user
or agent explicitly chooses and authors them. Untouched provider defaults stay
absent.

### Current Purposes And Targets

The skill routes only these current public purposes:

| Purpose | Target |
| --- | --- |
| `image.create` | `project` |
| `image.edit` | `asset:<asset-id>` |
| `lookbook.image` | `lookbook:<lookbook-id>` |
| `lookbook.video-sheet` | `lookbook:<lookbook-id>` |
| `lookbook.storyboard-sheet` | `lookbook:<lookbook-id>` |
| `cast.video-character-sheet` | `cast:<cast-member-id>` |
| `cast.storyboard-character-sheet` | `cast:<cast-member-id>` |
| `cast.profile` | `cast:<cast-member-id>` |
| `cast.voice-sample` | `cast:<cast-member-id>` |
| `scene.dialogue-audio` | `scene:<scene-id>:dialogue:<scene-dialogue-id>` |
| `location.sheet` | `location:<location-id>` |
| `location.hero` | `location:<location-id>` |
| `scene.storyboard-sheet` | `scene:<scene-id>` |
| `shot.video-take` | `take:<take-id>` |

The table is a routing aid in the public skill. Detailed settings, guide slots,
models, and field names always come from current context/model descriptors.

### Output Reuse And Attachment

Generation and attachment remain separate.

- A generated output that will only guide another request may be used as an
  exact `project-file` reference. Do not invent an asset/file identity for a
  generation output that has not been attached.
- An already registered project asset uses an exact `asset-file` reference from
  context or `generation reference list`.
- External/Codex files use exact normalized `project-file` references when they
  only need to guide a request. They carry no synthetic generation receipt.
- Import only through a currently supported focused purpose. Pass `--receipt`
  only for the exact output of a matching Renku purpose/target run.
- If a desired durable destination has no focused current CLI attachment,
  report the capability gap. Do not fall back to `reference.image`,
  `shot.input`, or ignored flags.

Supported single-file media imports are:

```text
lookbook.image
lookbook.video-sheet
lookbook.storyboard-sheet
cast.video-character-sheet
cast.storyboard-character-sheet
cast.profile
location.sheet
location.hero
shot.video-take
```

Scene Storyboard images use the separate grouped/single-shot focused form with
`--shot-list` plus `--file`, or one `--shots` id plus `--source`.

Lookbook Image placement is explicitly two-step:

1. `media import --purpose lookbook.image` creates the image and returns
   `ownerRecord.id`;
2. `lookbook image set-placement --image <ownerRecord.id> --sections ...`
   applies section/point placement.

Cast Voice sample output remains attached through the current Cast Voice
command owned by Casting, not generic `media import`.

## Implementation Slices

### Slice 1: Preserve And Inventory The Sister Worktree

Before editing:

- record `git status --short`, `git diff --stat`, and the complete diff in
  `studio-skills`;
- treat all current modified, deleted, and untracked files as user work;
- preserve unrelated `sample-prompt.md` and `sample-prompt-2.md` files;
- classify every current generation command, purpose, flag, spec field,
  reference placement, and provider term against the Studio worktree contract;
- produce a file-by-file keep/rewrite/rename/delete inventory before applying
  the first patch.

Exit: the implementation can explain the disposition of every current
`studio-skills` generation-related change without resetting or overwriting it.

### Slice 2: Rewrite The Universal Media Producer Lifecycle

Update:

- `skills/media-producer/SKILL.md`;
- `skills/media-producer/references/workflow.md`;
- `skills/media-producer/references/reference-visible-image-prompting.md`.

Work:

- teach context -> model descriptors -> exact spec -> validate -> preview ->
  persist/update -> estimate -> approve -> run -> inspect -> focused attach;
- show draft preview with `--file` and saved preview with `--spec`;
- explain pricing-only approval tokens, fresh review after request changes, and
  simulation;
- teach `asset-file` versus `project-file` without inventing attachment;
- require `providerField` for every included reference;
- remove `shot.input`, dependency, route/input-mode, and synthetic provenance
  language;
- keep permission and Studio-notification recovery guidance;
- keep `SKILL.md` concise and link detailed behavior to references.

Exit: an agent can execute the generic lifecycle without consulting obsolete
commands or duplicating Core/Engines rules.

### Slice 3: Align Purpose References And Directly Rename Obsolete Files

Rename and update the purpose references named in the Architecture Shape Gate.
Also update:

- `cast-profile.md`;
- `cast-voice-sample.md`;
- `character-images.md`;
- `location-sheet-board-design.md`;
- `lookbook-image.md`;
- `scene-storyboard-sheet.md`;
- `voice-over-profile-image.md`.

Work:

- remove `--target` from model-list examples;
- distinguish `cast.video-character-sheet` from
  `cast.storyboard-character-sheet`;
- distinguish `lookbook.video-sheet` from `lookbook.storyboard-sheet`;
- teach `location.sheet` and `location.hero` with current source slot behavior;
- replace hard-coded aspect ratios/quality with context-driven authored choices
  where the setting is not fixed;
- ensure Location Sheet prompt examples do not contradict their selected
  aspect-ratio value;
- keep Scene Storyboard generation on the fixed 2x2/at-most-four-panel
  composite, exact Storyboard Lookbook Sheet guide, agent vision review,
  per-image crop inspection, and focused attachment;
- preserve Cast Voice's separate durable attachment command;
- remove the speculative future-purpose file after moving only current useful
  creative advice.

Exit: every purpose reference describes a current purpose, target, guide, and
attachment path and does not claim creative guidance is runtime validation.

### Slice 4: Replace Shot Route/Input/Authoring Guidance

Update:

- `references/shot-video-take/index.md`;
- `references/shot-video-take/provider-visible-prompting.md`;
- `references/shot-video-take/prompt-quality-checklist.md`;
- `references/shot-video-take/kling/index.md`;
- every retained `references/shot-video-take/seedance/*.md` file;
- rename `seedance/route-matrix.md` to
  `seedance/endpoint-selection.md`.

Work:

- begin with `generation context --purpose shot.video-take --target take:<id>`;
- treat Shot, Lookbook, Cast, Location, dialogue, and Additional Reference
  placements as guidance, not dependencies;
- choose a direct provider/model endpoint from current descriptors;
- assign each exact included file to a real provider media field;
- use generated provider preview/token order as evidence when provider-visible
  prompt tokens matter;
- replace references to take authoring context, prepared inputs, route ids,
  input modes, logical mapping, production groups, and Core-generated automatic
  mappings;
- retain provider-specific creative prompt advice only when it follows from the
  actual selected endpoint and preview;
- retain agent-owned storyboard/motion-sheet inspection and artifact
  suppression as creative QA, never as Studio validation.

Exit: Shot guidance can author and validate one direct provider request from
current context without reconstructing the deleted generation planner.

### Slice 5: Correct Specialist Handoffs

Update:

- `skills/movie-director/SKILL.md`;
- `skills/movie-director/references/department-map.md`;
- `skills/movie-director/references/specialist-handoff-checklists.md`;
- `skills/movie-director/references/workflow-playbooks.md`;
- `skills/movie-director/references/cli-coverage-and-gaps.md` if its coverage
  claims are stale;
- `skills/casting-director/references/cast-media-handoff.md`;
- `skills/production-designer/references/media-and-shot-list-handoff.md`;
- `skills/scene-shot-designer/SKILL.md`;
- `skills/scene-shot-designer/references/scene-shot-list-json-contract.md`;
- affected Lookbook Designer instructions and references.

Work:

- remove all `take authoring` and `sceneShotVideoTakeAuthoring` handoffs;
- preserve user choices for actual provider/model, authored values, exact
  references, cost, and approval—not removed route/input-mode choices;
- hand Shot Video Take work to Media Producer with purpose, exact `take:<id>`,
  current context, and user intent;
- correct Scene Storyboard guidance to the non-blocking
  `lookbook.storyboard-sheet` candidate and never call it a generated
  dependency;
- remove unsupported `reference.image` imports and state the current capability
  gap when durable generic Cast reference attachment is requested;
- change Lookbook image workflows to focused import followed by
  `lookbook image set-placement` using returned `ownerRecord.id`;
- leave actual Lookbook placement rules in Lookbook-owned commands, not Media
  Producer.

Exit: coordinating skills pass intent and durable ids to Media Producer and do
not contain a second generation implementation.

### Slice 6: Rebuild Samples As Executable Contract Examples

Audit every JSON file under `skills/media-producer/samples` and
`samples/shot-video-take`.

Required corrections:

- add a valid example `providerField` to every included reference;
- use `project-file` for an unattached prior output and `asset-file` only when
  the example explicitly assumes a registered asset/file;
- keep media fields out of `values`;
- use actual direct endpoint ids and actual field names from current model
  descriptors;
- omit provider defaults unless deliberately authored;
- omit Core-fixed settings unless the example is intentionally demonstrating
  the accepted fixed value;
- make prompt wording consistent with the selected aspect ratio and purpose;
- add explicit examples for both split Character Sheet purposes and both split
  Lookbook Sheet purposes, or document why a shared structural example is
  sufficient;
- rename files that are specs but currently use `generation-preview` in the
  filename;
- keep Scene Storyboard import samples on the current
  `sceneStoryboardImagesImport` document;
- remove old production-group/input samples and do not add replacements for
  deleted concepts.

Add or update Media Producer eval cases for:

1. a context-driven `location.sheet` spec;
2. a `lookbook.storyboard-sheet` followed by Scene Storyboard generation and
   agent-owned split/import;
3. a direct `shot.video-take` request with exact guide placements and provider
   fields;
4. an `image.create` output reused as a `project-file` reference;
5. an external/Codex file used without a synthetic receipt;
6. a Lookbook Image focused import followed by separate placement.

Exit: examples reinforce the current public contract and fail visibly when an
agent omits provider assignment or uses an obsolete command.

### Slice 7: Skill Metadata And Cross-Repository Documentation

Work:

- add `skills/media-producer/agents/openai.yaml` using the Skill Creator's
  deterministic metadata generator;
- verify existing `agents/openai.yaml` files still match any changed skill
  descriptions/default prompts and regenerate only stale files;
- update the sister `README.md` Media Producer section to describe generic
  `GenerationSpec`, context/model descriptors, exact references, preview,
  approval token, and focused attachment;
- update `docs/architecture/reference/studio-skills.md` in Studio when the final
  skill workflow changes its handoff wording;
- change the Studio caller-handoff document's Skills resolution evidence only
  after this plan's verification passes;
- add a cross-reference from Plan `0136`'s Skills checklist/closure note to
  Plan `0137` instead of leaving the earlier incomplete alignment as sole
  evidence;
- do not edit historical plans merely to replace old names.

Exit: discovery metadata, README, current architecture docs, and active-plan
evidence all describe the same current workflow.

## Tests And Guardrails

### Static Contract Audit

- scan all current skill instructions, references, samples, evals, README, and
  metadata for deleted commands, purposes, ignored flags, route/input-mode
  abstractions, dependency-planning language, and obsolete sample keys;
- scan links from every touched `SKILL.md` and reference file and confirm each
  target exists after direct renames/deletions;
- parse every JSON sample with `jq`;
- confirm every included sample reference has a non-empty `providerField`;
- confirm sample media fields are represented by `references[]`, not
  `values`;
- keep scans focused on stable public CLI/contract names; do not add committed
  tests that freeze private helper, class, or function names.

### Skill Validation

Run the Skill Creator validator for every touched skill directory, including at
minimum:

```bash
python /Users/keremk/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/media-producer
python /Users/keremk/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/movie-director
python /Users/keremk/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/casting-director
python /Users/keremk/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/production-designer
python /Users/keremk/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/scene-shot-designer
python /Users/keremk/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/lookbook-designer
```

### CLI Contract Smoke Tests

Use a disposable copy of `urban-basilica`. Do not mutate the user's real
project and do not make a paid provider call.

- read representative purpose contexts and model descriptors;
- author temporary specs outside the skill repository with real copied-project
  ids and exact files;
- run `generation validate`, `spec create`, `preview show`, `estimate`, and
  `run --simulate` for representative image and Shot requests;
- verify changing a pricing input changes the approval token while a
  creative-only change can preserve it;
- verify every request change is revalidated and reviewed even when the price
  token remains unchanged;
- verify an included reference without `providerField` fails with the expected
  structured diagnostic;
- verify Lookbook Image import returns `ownerRecord.id`, then use that id with
  `lookbook image set-placement`;
- verify Scene Storyboard focused attachment accepts the grouped document and
  rejects mismatched Shot/Shot List state before writing;
- verify unsupported `reference.image` and `shot.input` are not taught as
  working paths.

Run the focused Studio CLI suite from the Studio root:

```bash
pnpm test:cli
```

Any sandbox-only failure must be distinguished from a contract failure and
reported with the exact command/output. It is not permission to skip the
real-project smoke tests.

### Forward Tests

After the instruction rewrite, use fresh subagents with minimal context and a
separate disposable project copy per case. Give each agent the skill path and a
normal user request; do not provide the expected fix or stale-term checklist.

Forward-test at least:

- “Create a Location Sheet, show me the preview, and stop before paid
  generation”;
- “Use this existing generated project file as a storyboard reference for this
  Take, estimate the final video, and stop for approval”;
- “Import this external Lookbook image under Thesis and beside this Texture
  point”;
- “Create missing storyboard images for these four saved Shots”;
- “Use this external cast reference in a generation request without pretending
  it has Renku provenance.”

Review command traces and generated specs, not only the prose answer. A forward
test fails if the agent invokes a deleted command, passes an ignored flag,
omits provider assignment, invents attachment/provenance, uses the wrong
Lookbook Sheet type, or runs paid generation.

## Documentation

Current documentation changes expected during implementation:

- `$HOME/Projects/aitinkerbox/studio-skills/README.md`;
- `$HOME/Projects/aitinkerbox/studio-skills/skills/**` files named in the
  implementation slices;
- `docs/architecture/reference/studio-skills.md`;
- `docs/architecture/reference/context-first-generation-caller-handoff.md`;
- the current Plan `0136` Skills closure cross-reference.

`docs/cli/commands.md` remains the CLI authority. Update it only if the
implementation audit finds that the current documented public CLI differs from
the implemented handler; do not duplicate its full command reference inside
skills.

## Final Verification

From `studio-skills`:

```bash
git status --short
git diff --check
git diff --stat
git diff
find skills/media-producer/samples -name '*.json' -print0 | xargs -0 -n1 jq empty
```

Then:

- run every Skill Creator validation command above;
- run the disposable-project CLI smoke matrix and record the exact results;
- run the fresh-agent forward tests and inspect traces/specs;
- run `pnpm test:cli` from Studio;
- inspect both repositories' complete diffs;
- confirm unrelated existing sister-repo changes and untracked sample prompts
  remain untouched;
- confirm `SKILL.md` remains a thin router and no single reference became a
  lifecycle/purpose/provider catch-all;
- confirm no deleted command, purpose, ignored flag, route/input-mode contract,
  dependency planner, or compatibility path remains in current operational
  guidance;
- confirm current `index.md` files remain focused navigation entrypoints;
- confirm all renamed/deleted reference links resolve with no compatibility
  duplicate;
- confirm all current docs and active-plan evidence describe the final verified
  contract.

## Implementation Verification Record

Verification completed on 2026-07-13:

- preserved the sister repository's staged baseline and the unrelated
  `sample-prompt.md` and `sample-prompt-2.md` files;
- parsed every JSON sample and assembled all 17 `GenerationSpec` samples
  successfully against the current Engines model descriptors;
- validated `media-producer`, `movie-director`, `casting-director`,
  `production-designer`, `scene-shot-designer`, and `lookbook-designer` with
  the Skill Creator validator;
- checked every touched Markdown link and scanned current instructions for the
  deleted command, purpose, route/input, dependency, and renamed-file terms;
- built the current CLI and used isolated Renku home/storage roots for all
  mutating smoke tests;
- validated, persisted, estimated, and simulated an `image.create` request
  without a provider call;
- confirmed a creative-only prompt change preserved its price token, while a
  `quality` pricing change changed the estimate from `$0.158` to `$0.04` and
  produced a different token;
- confirmed an included reference without `providerField` failed with
  `ENGINE_GENERATION_PAYLOAD_INVALID` before execution;
- confirmed `generation preview show` reached the Studio delivery boundary and
  returned `CLI144` because no Studio instance was running for the isolated
  project, then confirmed the durable saved spec through `generation spec
  show` without recreating it;
- imported an external Lookbook Image into a copied `urban-basilica` database,
  captured `ownerRecord.id`, and successfully applied Thesis plus Texture-point
  placement in a separate command;
- confirmed a mismatched grouped Scene Storyboard attachment failed with
  `CORE_GENERATION_STORYBOARD_ATTACHMENT_INVALID`, then successfully attached
  two valid Shot images from the matching grouped document;
- ran `pnpm test:cli`: 10 files and 31 tests passed;
- completed fresh-agent forward tests for Location Sheet Preview, Shot Video
  Take storyboard reference estimation, external Lookbook placement, external
  Cast reference use, and Scene Storyboard generation; the first storyboard
  trace exposed blocking wording, which was corrected and rerun against the
  non-blocking contract;
- ran `git diff --check` in both repositories and reviewed the complete
  implementation diff and the largest touched instruction files.

The smoke tests also exposed a stale sentence in ADR `0047` that described
exact-request token invalidation. The ADR now matches the already implemented,
tested pricing-only token contract and separate execution-readiness validation.

## Completion Checklist

### Review Area

- [x] Preserve and inventory all existing `studio-skills` worktree changes
      before editing.
- [x] Preserve unrelated untracked `sample-prompt.md` and
      `sample-prompt-2.md`.
- [x] Confirm the implementation preserves Core, Engines, CLI, and Skill
      ownership boundaries.
- [x] Confirm centralized Media Producer guidance did not become a monolithic
      `SKILL.md` or catch-all reference.
- [x] Confirm the final file layout matches the Architecture Shape Gate.
- [x] Stop and open a separate owning-layer plan for any genuinely missing Core
      or CLI capability.

### Architecture And Contracts

- [x] Teach only the current generic generation command inventory.
- [x] Remove target flags from `generation model list` examples.
- [x] Use `generation validate`, not the removed nested validate command.
- [x] Teach draft and saved Preview forms accurately.
- [x] Teach pricing-only approval-token behavior, fresh request review, and
      simulation.
- [x] Require an actual `providerField` for every included exact reference.
- [x] Keep guide placement independent from provider assignment.
- [x] Keep fixed settings Core-owned, recommendations explicitly authored, and
      untouched provider defaults absent.
- [x] Teach `asset-file` and `project-file` identities without inventing asset
      registration.
- [x] Teach only supported focused attachment purposes.
- [x] Keep Cast Voice and Scene Storyboard focused attachment workflows owned
      by their current commands.
- [x] Remove every take-authoring, dependency-plan, recursive-estimate,
      route-id, input-mode, and logical-input compatibility concept.

### Media Producer Implementation

- [x] Keep `SKILL.md` concise and route details to focused references.
- [x] Make `references/workflow.md` the single reusable lifecycle authority.
- [x] Directly rename Character Sheet, Location Sheet, and Lookbook Sheet
      references with no aliases.
- [x] Directly rename Seedance route selection to endpoint selection.
- [x] Delete speculative future-purpose instructions after preserving only
      current creative guidance.
- [x] Preserve agent-owned creative inspection without presenting it as
      runtime validation.
- [x] Preserve Scene Storyboard agent vision, crop selection, crop inspection,
      and focused attachment.
- [x] Preserve paid-generation approval and Studio-notification recovery rules.

### Specialist Handoffs

- [x] Remove `renku take authoring` and
      `sceneShotVideoTakeAuthoring` from Movie Director.
- [x] Pass `shot.video-take`, exact `take:<id>`, current context, and user intent
      to Media Producer.
- [x] Replace removed input-mode preservation with actual endpoint/value/
      reference preservation.
- [x] Correct Scene Shot Designer to `lookbook.storyboard-sheet` guidance.
- [x] Remove unsupported `reference.image` and `shot.input` import advice.
- [x] Split Lookbook Image import from Lookbook placement using returned
      `ownerRecord.id`.
- [x] Keep coordinating skills free of spec builders and provider maps.

### Samples And Evals

- [x] Parse every JSON sample successfully.
- [x] Add `providerField` to every included sample reference.
- [x] Keep file-backed provider fields out of `values`.
- [x] Use real current provider endpoint and field names in examples.
- [x] Make sample prompts/settings internally consistent.
- [x] Cover both Character Sheet and both Lookbook Sheet purposes deliberately.
- [x] Rename spec files that incorrectly claim to be Preview payloads.
- [x] Keep obsolete dependency/input/production-group samples deleted.
- [x] Add the six current-contract eval scenarios.

### Skill Metadata

- [x] Add generated `agents/openai.yaml` metadata for Media Producer.
- [x] Validate every touched skill with `quick_validate.py`.
- [x] Regenerate existing metadata only when it is stale after instruction
      changes.
- [x] Confirm metadata triggers describe current purposes and workflows.

### Tests And Guardrails

- [x] Complete the static public-contract audit without adding private-name
      architecture needles.
- [x] Check every touched Markdown link after renames/deletions.
- [x] Run disposable-project context/model/validate/preview/estimate/simulate
      smoke tests.
- [x] Prove pricing-input changes can change approval tokens while
      creative-only changes can preserve them.
- [x] Prove missing provider assignment fails before run.
- [x] Prove Lookbook import and placement are separate successful commands.
- [x] Prove Scene Storyboard grouped attachment validates Shot ownership.
- [x] Run `pnpm test:cli`.
- [x] Complete fresh-agent forward tests and inspect their traces/specs.

### Documentation

- [x] Update the sister README's Media Producer description.
- [x] Update current Studio Skills architecture documentation.
- [x] Correct caller-handoff Skills resolution evidence only after verification.
- [x] Cross-reference this plan from Plan `0136`'s Skills closure evidence.
- [x] Leave historical plans unchanged except for explicit current closure
      documentation.

### Final Verification

- [x] Run `git diff --check` in both repositories.
- [x] Review `git diff --stat` and the complete diff in both repositories.
- [x] Inspect every newly large or heavily modified skill/reference file.
- [x] Confirm current `index.md` files remain navigation entrypoints.
- [x] Confirm no compatibility file, duplicate reference, broad dispatcher, or
      skill-side runtime registry was added.
- [x] Confirm no checklist item was satisfied by retaining obsolete guidance or
      accepting unreviewable skill structure.
- [x] Only then mark this plan complete and update the Plan `0136` Skills
      closure cross-reference.
