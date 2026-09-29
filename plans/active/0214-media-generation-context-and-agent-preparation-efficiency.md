# 0214 Media Generation Context And Agent Preparation Efficiency

Status: implemented; agent-session evaluation pending
Date: 2026-09-28

## Summary

Reduce repeated context retrieval, oversized reference payloads, and mechanical
agent preparation in media-generation sessions. Extend the existing Core
generation-context projection and the sister repository's Media Producer
workflow; do not introduce a second context command or an agent orchestration
service.

This follows the local CLI improvements in plan 0213. The next useful gains are
in what the agent receives and how it uses it, rather than another startup
refactor. Codex generation and attachment authorization was changed separately
by the user and is accepted input to this plan, not a decision to reopen.

## Review Attention

- **Public contract change:** omit `generationProvenance` from reference
  candidates and every typed Asset position in the generation briefing:
  Lookbook media, subject Assets, Shot images, voice samples, and exact edit
  sources. This extends the initial proposal beyond reference collections so
  the same old instructions cannot reappear through target context. Preserve
  current creative documents, media identity, selection facts, and opaque voice
  identity. No compact/full mode or compatibility fields are added.
- **Creative boundary:** a previous generation recipe records what was
  requested, not what the resulting media contains or what the next generation
  should do. Agents use references for the current task's intended contribution;
  Core does not interpret prompts or resolve creative contradictions.
- **Duplicate removal is agreed:** remove repeated provenance and redundant
  context/guide/request reads. Do not replace them with semantic summaries or
  normalize the whole report into a new resource registry.
- **Verification-discovered correction:** the shared department Lookbook helper
  compared a selected Asset id with a placement id. Match `image.asset.id` so
  the existing selected-image contract returns its full Asset and provenance.
- **Existing accepted behavior:** Codex uses current direction/defaults without
  new generation consent; configuration is optional unless requested; automatic
  Preview is informational; generation authorizes focused attachment for all
  providers. Explicit preview-only, leave-unattached, and review requests still
  govern. External spending approval and host permissions remain unchanged.
- **No database or media changes:** no migration, data cleanup, media deletion,
  file move, Settings field, command, flag, route, provider policy, or diagnostic
  code is introduced. Stored provenance and the Inspector remain unchanged.
- **Cross-repository work:** update Studio contracts/docs/tests and focused
  `studio-skills` guidance/evals. Preserve the other thread's authorization edits.
  Plugin publication/installation is a separate delivery action, not a cache
  rewrite or new release system in this plan.
- **Assumptions:** capture current baseline revisions before implementation;
  neither audited session is a controlled before/after benchmark. Verify the
  actual loaded skill contents for any subsequent agent evaluation.

## Requirements And Non-Goals

| Requirement | Basis | Owner and acceptance evidence |
| --- | --- | --- |
| R1: Capture each needed context once per unchanged request state | Accepted session findings | Media Producer guidance; trace counts and saved outputs |
| R2: Omit previous generation recipes from default briefings, including edit sources, while retaining current guidance, media evidence, operational identity, and deliberate history access | User's reference-conflict clarification and request to revise this plan; Core ownership | Typed projection tests, role-specific agent evals, and same-project size comparison |
| R3: Avoid repeated guide reads, request dumps, and path mistakes | Accepted session findings | Focused skill examples and workflow evals |
| R4: Reuse applicable configuration templates and route discovery | Existing ADR 0091; observed successful hero reuse | Existing cache commands plus fresh-hit eval |
| R5: Preserve separately accepted authorization changes | Explicit user clarification | Source/loaded-skill audit and end-to-end workflow trace |
| R6: Distinguish command, tool, agent-turn, and between-turn time | Session investigation; honest verification | Recorded evaluation report with timing definitions |

Non-goals: speeding up the image provider; changing image quality or creative
review standards; universally parallelizing dependent outputs; adding a context
cache, freshness hash, durable preparation state, generic JSON filter, summary
LLM, new executable helper, provider schema, cache-key redesign, installation
mechanism, or new approval surface. Do not change import response shapes merely
because they also include provenance. Do not remove required reference-image
inspection to meet a call-count target.

## Context And Evidence

Accepted boundaries:

- `docs/decisions/0087-use-deterministic-advisory-media-generation-context.md`:
  Core owns the deterministic briefing; suggestions are advisory.
- `docs/decisions/0086-use-skill-directed-provider-engines-and-asset-generation-provenance.md`:
  provider execution and stored provenance have separate owners.
- `docs/decisions/0091-cache-generation-configuration-visualizations-for-24-hours.md`:
  reuse fresh templates; preserve request isolation and refresh rules.
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`: no runtime
  semantic interpretation, rewriting, or validation of creative content.
- `docs/architecture/media-generation.md`,
  `docs/architecture/reference/media-generation.md`,
  `docs/architecture/coding-practices.md`, and
  `docs/architecture/naming-guidelines.md`.
- Plan 0213 and `docs/architecture/cli-performance.md` remain the implementation
  record for startup work. This follow-up does not close its unrelated pending
  artifact, Windows, or desktop acceptance gates.
- The current sister `skills/media-producer/SKILL.md`, `references/workflow.md`,
  `references/image-output-review.md`, and
  `references/inline-generation-configuration.md` contain the separately
  accepted authorization changes. Older Studio prose that implies mandatory
  Codex consent must be reconciled with that accepted direction, not used to
  restore the pauses.

Observed sessions:

| Evidence | Foundry: `01a0e85a-76e8-7d63-98d0-f22e049518fc` | Workroom: `01a0e897-86d2-7b11-8579-3d35b0ac8fb4` |
| --- | --- | --- |
| Agent-turn total | 608.363 seconds | 527.561 seconds |
| Recorded shell duration total | 10.508 seconds | 14.421 seconds |
| First-turn command output before truncation | 501,524 characters | 658,975 characters |
| Generation | Two concurrent requests, about 260 seconds until both complete | Sequential tool intervals 50.150 and 43.129 seconds |
| Skill evidence | Did not contain 0213 efficiency guidance | Read the efficiency guidance, but still duplicated work |

Workroom fetched sheet and hero contexts twice initially. It printed full
Lookbook/reference collections, then printed narrower subsets and a large
top-level difference. Its later fresh hero context was legitimate: importing
the sheet changed reference state. It reused the configuration template for the
hero. A wrong working directory caused `CLI165`; a cache write required host
permission and succeeded through the normal authorized retry.

The saved Workroom sheet context was 114,622 characters when serialized with
Python's default `json.dumps` settings; provenance values occupied
71,486 characters across 22 occurrences. These are character counts, not tokens
or transfer bytes. Repeat measurements on a stable baseline rather than using
these numbers as an exact future fixture.

### Current Guidance, Visible Evidence, And Previous Recipes

These are distinct inputs. Current creative documents describe intended design;
reference media supplies visible or audible evidence; stored provenance records
an earlier request. None should be silently substituted for another. Current
user direction can deliberately change a reference trait without changing the
durable design document or requiring another confirmation.

| Existing workflow | Reference contribution | Previous instructions to exclude from the default briefing |
| --- | --- | --- |
| Character sheet to helmetless character variant | Identity, build, costume details that should remain | A source prompt requiring a helmet or hidden hair |
| Imperial Wound Lookbook to Location hero | Palette, materials, lighting, atmosphere | Its actual sheet-generation recipe asks for a header, seven swatches, and four panels |
| Location sheet to hero | Spatial and architectural evidence | Sheet layout, plan, labels, and claims about features the output may not contain |
| Production sheet to storyboard sheet | Identity, costume, geography | Photorealistic rendering when the new request requires a drawn medium |
| Neighboring Shot or first frame to another Shot or last frame | Continuity of subjects and setting | Earlier framing, camera angle, action, or initial pose |
| Voice sample to new dialogue | Voice identity and vocal qualities | Earlier spoken words and performance instructions |
| Exact image/video edit | Source artifact and the current requested change | Earlier instructions that required the trait now being changed |

The helmet case is the user's example; the Lookbook recipe is present in the
saved Workroom context. The Workroom sheet review also records requested closed
shutters versus visible lattice, inconsistent table orientation, and changed
lighting. These observations demonstrate why a source prompt cannot be treated
as a factual description of the output. Other rows trace existing reference
roles, not observed generation failures.

Retrieve a selected Asset's history deliberately for a request to inspect the
original prompt, reuse generation settings, revise that prompt, or diagnose a
previous result. Read the necessary history once; do not fetch the entire
reference graph. History remains evidence to inspect or revise, not an automatic
instruction for the next output. Reusing a recipe does not promise identical
media. Ordinary edits need the source and current edit instruction, with no
blanket provenance exception.

Retain current descriptions and design documents verbatim. The agent applies
explicit current direction and identifies what each reference contributes;
it asks only when a material creative choice remains unresolved. Do not add
runtime conflict detection, prompt filtering, creative validation, new reference
role fields, or automatic design-document updates.

## Existing Owners And Chosen Approach

`packages/core/src/client/media-generation-context.ts` defines the report.
`server/media-generation-context/context.ts` assembles it through the existing
purpose registry. `reference-suggestions.ts` repeats Asset provenance into each
AssetFile candidate. `visual-language-context.ts` includes full Lookbook media
Assets; `purposes/lookbook.ts` also embeds those collections directly.

`visual-language-context.ts` additionally serves department commands through
`readDepartmentProductionLookbookContext`. That consumer must retain its full
`DepartmentLookbookContext`; shrinking generation context must not silently
change department resources or Studio's Lookbook Inspector.

Options considered:

1. **Keep contracts unchanged, improve skills only:** removes duplicate calls
   but still transfers and exposes historical provenance on every briefing.
2. **Narrow the existing projection:** chosen. Keep current nesting and
   identity/relationship fields; omit prior Asset generation recipes at Core's
   typed generation boundary. Pair this with explicit agent call sequences.
3. **Add compact mode, normalized resource registry, or context service:**
   rejected. These introduce parallel contracts and caller coordination beyond
   the measured need.

## Architecture Shape Gate

| File/module | Planned responsibility |
| --- | --- |
| `packages/core/src/client/media-generation-context.ts` | Existing report and candidate contracts; scoped reference Asset shape and Lookbook media types described below |
| `packages/core/src/server/media-generation-context/reference-assets.ts` (new) | Small typed, non-mutating Asset and Lookbook media projections; no I/O, dispatch, or recursive arbitrary-object traversal |
| `.../reference-suggestions.ts` | Existing sorting, file availability, selection facts and warnings; omit provenance; accept only the Asset fields this projection needs |
| `.../visual-language-context.ts` | Shared resource read remains local; generation path projects reference assets, department path retains full selected image |
| `.../purposes/lookbook.ts` | Apply the same Lookbook media projection to target and visual-language collections |
| `.../scene-context.ts` | Project subject Assets and Cast Voice samples only at the generation boundary; retain current design and Scene content |
| `.../purposes/asset.ts` and `.../purposes/cast.ts` | Project exact edit source and direct Cast Voice samples without changing resource or attachment contracts |
| `.../shot-context.ts` (new) | Bounded typed Shot/Shot Plan projection of image collections, reused by `purposes/shot.ts` and `purposes/shot-plan.ts` |
| `.../context.test.ts` and `.../reference-assets.test.ts` (new) | Report behavior and focused projection preservation tests |
| `packages/cli/src/commands/generation/context.ts` | Remains thin: parse scope, call Core, return the report |
| Sister `skills/media-producer/` | Task-local capture/read/refresh sequence and focused workflow evals |

Public entrypoints remain `ProjectDataService.readMediaGenerationContext`, its
existing Core server export, and `renku generation context`. The existing
`purpose-registry.ts` retains dispatch; no new dispatcher is needed.
`server/media-generation-context/index.ts` remains an export-only entrypoint.
The new projection module implements a real response boundary, not a facade.
No existing file is deleted or broadly reorganized; reference payloads shrink.

Stop if implementation needs a CLI-local sanitizer, a provider switch, a
recursive omit-by-key walker, a mirrored full/compact service, a change to
stored Asset shape, or modifications to unrelated domain resource contracts.
Do not place every purpose's transformation into one new report-rewriting
function. Keep creative contents opaque and unchanged.

## Contracts

In `client/media-generation-context.ts`:

- Add `MediaGenerationAsset = Omit<Asset, 'generationProvenance'>`.
  This is a generation-briefing projection, not a rename of `Asset` or a
  compatibility alias. Every other Asset field, including files, origin,
  `authoredFrom`, locale, tags, summaries, and timestamps, remains unchanged.
- Add `MediaGenerationLookbookImage = Omit<LookbookImage, 'asset'> &
  { asset: MediaGenerationAsset }` and
  `MediaGenerationLookbookSheet = Omit<LookbookSheet, 'asset'> &
  { asset: MediaGenerationAsset }`. Preserve placement ids, Lookbook
  identity, sections, point anchors, and every non-Asset field.
- Use those collections in `MediaGenerationLookbookContext.images/sheets` and
  the `kind: 'lookbook'` target variant. Preserve the complete Lookbook definition
  and `selectedImageId`.
- Remove `MediaGenerationReferenceCandidate.generationProvenance`; preserve
  every other candidate property, role, grouping, ordering, and warning.
- Use `MediaGenerationAsset[]` in `MediaGenerationSubjectDetails.assets` and
  `MediaGenerationAsset` in the `kind: 'asset'` target. This covers direct
  subjects, related Scene subjects, and exact image/video edit sources.
- Add `MediaGenerationCastVoice = Omit<CastVoice, 'sample'> &
  { sample: MediaGenerationAsset }`; use it for direct Cast voices and
  `MediaGenerationSceneContext.castVoicesByCastMemberId`. Preserve
  `voiceIdentity` verbatim, name, purpose, default selection, and every other
  voice field. Do not extract provider identity by parsing old request bodies.
- Add `MediaGenerationShot = Omit<Shot, 'images'> &
  { images: MediaGenerationAsset[] }` and
  `MediaGenerationShotPlan = Omit<ShotPlan, 'shots'> &
  { shots: MediaGenerationShot[] }`; use these in Shot and Shot Plan target
  variants. Preserve authored Shot briefs, coverage, selected image ids, and
  ordering. Dialogue takes, auxiliary images, and previs reference candidates
  follow the same candidate omission rule.

Use actual object projection, not a TypeScript-only cast: JSON must omit the
field. `createReferenceSuggestion` can accept the scoped reference Asset shape;
full Assets remain structurally sufficient inputs. Do not change the domain
`Asset`, `LookbookImage`, `LookbookSheet`, `CastVoice`, `Shot`, `ShotPlan`, or
department contracts. Omit the entire provenance envelope, including provider,
model, prompt, request, and receipt; do not invent a partial history summary.
Opaque documents and `voiceIdentity` are not recursively scrubbed by key name.

No replacement provenance lookup API is required. Existing
`renku asset list --project <project-name> --owner <owner> --json` returns full
Assets in `AssetPage.items`. Capture the relevant owner page, find the exact
Asset id locally, and inspect only its provenance; follow `nextCursor` only if
needed, keeping listing filters unchanged. This is an owner-scoped read, not a
new single-Asset CLI command. Existing domain resources remain available for
their supported owners, including `renku cast voice show` for a specific voice.
The stored-provenance Inspector remains unchanged. Do not fetch history
automatically to compensate for its absence in the briefing, dump all owner
recipes, or query the database directly from a Skill. Verify the deliberate
retrieval examples through these existing paths before completion.

## Implementation Slices

### 1. Preserve authorization work and record the baseline

Record Studio and sister repository revisions and existing uncommitted changes.
Identify the other thread's authorization edits; retain them and avoid duplicate
implementation. Record a read-only current Workroom sheet context and Foundry
context outside durable project state. Use an unchanged project between each
before/after payload comparison.

### 2. Narrow Core generation projections

Implement the Contracts section in the named owners. Keep the full Lookbook
resource read reusable inside `visual-language-context.ts` so department output
still receives a full selected Asset. Apply reference projection before returning
generation Lookbook collections; preserve the existing file checks and warnings.
Apply the same Asset omission at the named subject, voice, edit-source, and
Shot owners. Keep small voice projection logic with the shared Asset projection;
keep Shot/Shot Plan traversal in `shot-context.ts`. Do not rewrite arbitrary
report JSON after assembly. Trace shared projector consumers and preserve full
domain resource responses rather than propagating narrowed types outside the
generation boundary.
Update current callers and fixtures directly, without legacy response handling.

### 3. Make the agent preparation sequence explicit

Edit these sister files narrowly:

- `skills/media-producer/SKILL.md`: concise entry rule and link to the sequence.
- `references/workflow.md`: authoritative capture/reuse/refresh sequence.
- `references/location-sheet.md`: dependent sheet-to-hero example.
- `references/model-guides/shared/reference-inputs.md`: authoritative distinction
  between current guidance, artifact evidence, and previous recipes; role-specific
  examples from the table above, without copying provider guides.
- `references/image-operation-routing.md`: exact edits use the source artifact
  and current edit instruction; retrieve history only for a task that needs it.
- `references/inline-generation-configuration.md`: reuse within the current
  authorization policy, without a new Codex configuration requirement.
- `skills/production-designer/references/media-and-scene-beats-handoff.md`:
  carry known identities and specialist direction; avoid duplicate media context.

Required sequence:

1. Resolve the requested Project once, respecting each command's targeting
   capability. Set subsequent shell calls' working directory to the returned
   absolute Project folder. Use project-relative `tmp/` paths consistently.
2. Capture the first successful generation-context stdout directly to a
   request-specific file under `tmp/scratch/`. Do not invoke the same command
   again just to save its output. Check success before consuming it; do not read
   a partial file after a failed command.
3. Inspect identity, policy, guidance, warnings, target/design facts, relevant
   creative Lookbook definitions, and reference metadata from that file in
   bounded sections. Do not print the whole response followed by those same
   sections. Do not generate broad whole-object differences to discover a few
   fields. Bounded display is not permission to skip relevant creative context.
   Inspect chosen media and state its intended contribution in the authored
   request where useful. Do not import its prior recipe as new instructions.
   Follow the deliberate history-retrieval cases above when the task needs them.
4. Reuse within unchanged preparation. Refresh for a changed target/scope,
   relevant user edit, imported/replaced reference, changed Lookbook/design,
   changed policy, known external mutation, or uncertain intervening state.
   This is task-local reasoning, not a persistent cache or timestamp heuristic.
5. If a hero will consume a newly generated sheet, prepare the sheet first,
   inspect and attach under current authorization, then fetch hero context once
   with the new reference. Do not prefetch hero context that must be replaced.
   Independent requests may still run concurrently within current limits.
6. Read each relevant guide once per unchanged workflow; reread when a changed
   operation/provider or missing context requires it. Do not embed copies of
   the guide into another skill to achieve this.
7. Read the final request once after any permitted Preview edits and immediately
   before execution. Use those exact values for execution and provenance;
   eliminate the initial `cat` plus identical second read. Do not reuse a
   pre-Preview in-memory prompt when the file could have changed.
8. For external configuration, or explicitly requested Codex configuration,
   reuse fresh templates and selected-route discovery under existing cache
   rules. Recover denied writes through the host permission flow; no bypass or
   speculative global permission changes. Use mutation reports to confirm
   returned attachment/selection state.

### 4. Verify the loaded workflow and document the result

Extend `skills/media-producer/evals/forward-test-cases.md` with the verification
journeys below. Record source and actually loaded guide hashes/paths in the
evaluation evidence, not in new runtime telemetry or a plugin-version gate.
Use the existing plugin delivery workflow when an update is separately run;
never patch installed cache files as implementation. A source-only eval is not
an executed agent-session result.

## Tests And Guardrails

Core owns the projection matrix:

- Non-null and null provenance are omitted from scoped reference Assets and
  candidates; every retained field is equal to its original value.
- Multiple AssetFiles, Lookbook placement sections/points, display/workflow
  selection facts, ordering, empty collections, and missing-file warnings retain
  current behavior. Existing invalid identity/scope tests remain authoritative.
- Cover Lookbook, Cast, Location, Prop, Scene, Shot, Shot Plan, and exact
  image/video edit targets at their typed Asset positions. Include direct and
  Scene Cast Voice samples; prove opaque voice identity and authored Shot briefs
  remain intact while Asset provenance is absent. Project targets retain their
  current empty target shape.
- Reading compact generation context does not mutate shared resource objects or
  stored provenance. Department selected images and Inspector inputs still have
  full provenance. Reuse existing department/resource tests for this assertion.
- Exact creative strings and Lookbook documents survive byte-for-byte values;
  no semantic summarization or content-based filtering is added.

CLI tests retain scope parsing and Core delegation; one representative integration
assertion proves the serialized response matches the new public contract. Do not
repeat Core's matrix in CLI or React. Existing import-boundary checks suffice;
do not add source-text tests that freeze helper names or function inventories.

Agent eval journeys:

1. **Dependent Location sheet and hero, Codex defaults:** one sheet context,
   then one hero context after sheet attachment; no redundant settings read,
   no unsolicited configuration/consent/attachment pause; inspect outputs and
   preserve source-sheet linkage and exact provenance.
2. **User requests Preview before generation and leave-unattached:** honor both
   directions, read edited prompt once, and do not attach. A necessary review
   pause is not a performance failure.
3. **External provider, unchanged route, fresh template:** reuse the existing
   template/discovery, retain native validation and required spending approval.
   A fixture can exercise setup without paid execution.
4. **Relevant state changes during preparation:** refresh once and use the new
   reference/policy; never trade correctness for a rigid maximum call count.
5. **Project-relative paths and host denial:** commands use the resolved Project
   directory; denied cache writes use the authorized retry without an unchanged
   denial loop. Do not create a production fault-injection framework.
6. **Reference role and changed trait:** fixture-based agent cases cover the
   helmetless character, Lookbook-to-hero, Location sheet discrepancy,
   production-to-storyboard medium change, neighboring Shot/first-to-last-frame,
   new dialogue from a voice sample, and exact image/video edits. Confirm the
   agent uses current direction and appropriate artifact evidence, without
   retrieving or forwarding earlier recipes by default. Do not assert creative
   correctness through runtime prompt-string tests or require extra approval
   when current direction already resolves the change.
7. **Deliberate history use:** inspect an original prompt, reuse its settings,
   revise it, and diagnose a previous result through the existing resource
   access. Fetch only necessary selected history once; preserve it unchanged
   in storage, apply current changes to a new request, and do not promise exact
   reproduction. Verify generated output attachments still retain their own
   exact provenance, including Cast Voice sample attachment validation.

## Documentation

Update `docs/architecture/media-generation.md`,
`docs/architecture/reference/media-generation.md`, `docs/cli/commands.md`,
`docs/architecture/reference/studio-skills.md`, and
`docs/architecture/cli-performance.md` only where contracts or measured workflows
change. Document the default briefing's omission across all typed Asset positions,
preserved operational identities, and existing deliberate history access.
Distinguish current creative guidance, media evidence, and stored request history.
Reconcile
current authorization prose with the user's already accepted change, preserving
external spending and explicit review instructions.

ADR 0087 already defines context as non-durable advisory evidence, not a
provenance record; this projection narrowing implements that boundary and needs
no new ADR. Do not rewrite historical ADR reasoning. Any authorization ADR work
already owned by the other thread stays there; coordinate current documentation
without creating a competing decision or release process.

## Final Verification

Run sequentially from Studio, avoiding concurrent suites that share temporary
directory cleanup:

```bash
pnpm build
pnpm test:core
pnpm test:cli
pnpm test:integration
pnpm check
node --test scripts/performance/*.test.mjs
git diff --check
```

Run `pnpm test` and `git diff --check` from `../studio-skills`. No dependency
installation is required. Inspect the diff and all materially changed modules;
confirm the registry and indices remain thin and the new projector is bounded.

On read-only Urban Basilica before/after context captures, record serialized
UTF-8 bytes separately from characters, total output, and retained-field
equality. Target at least 50% smaller Workroom sheet context on the captured
baseline; if project contents have changed, regenerate both baseline and updated
reports against the same state. Do not truncate creative data to hit a metric.
Report failure to meet the target rather than broadening the projection silently.

Perform a desktop check of an existing Asset's provenance Inspector and of
Preview reference display; verify preserved prompts/references and no console
errors. Do not test mobile layouts. Do not alter real media for read-only checks.

For the agent eval, record loaded skill evidence, request dependencies, number
of context invocations, repeated file reads, command output size, CLI process
time, image-tool intervals, total agent-turn time, and between-turn gaps. Do not
attribute all residual agent time to model reasoning or claim provider speedup.
Use fixture outputs for deterministic orchestration checks. A live generation
comparison, when authorized, must record actual settings and outcomes; absent
that run, label live latency unverified rather than declaring an agent eval
complete. Publishing plugins or running paid generation is not implicit in
this planning task.

## Implementation Evidence (2026-09-28)

- Baselines: Studio `927466413bc63889714ebdfd666870c6acb8bbad`, Skills
  `2079d6fcf19f6f24784a407ab8147e6ec7295551`; no pre-existing changes apart
  from this plan. Authorization changes were already in the Skills baseline.
- Same-state Workroom `location.sheet`: 136,343 to 43,506 UTF-8 bytes (68.1%
  smaller); 136,265 to 43,496 Unicode characters. Parsed retained fields match
  exactly, and built CLI serialization equals Core output. Captures are local
  `/tmp/0214-baseline.json`, `/tmp/0214-after.json`, and `/tmp/0214-cli-after.json`.
- Existing owner-scoped Asset listing returns original prompts, including a
  second page using the returned cursor. Core tests cover voice identity,
  exact edits, Scene voices, Shot collections, shared-object preservation,
  multi-file references, and department selected-image provenance.
- Validation: workspace build, `pnpm check`, 103 CLI tests, 104 integration
  tests, 12 performance-harness tests, and sister `pnpm test` pass. The final
  Core run passed 489 of 490 tests; the unrelated project-reference test hit
  its five-second timeout under concurrent build load and passed in isolation
  (both tests in that file, 2.26 seconds). An initial performance probe lost its
  temporary report while integration cleanup was running; all 12 passed when
  rerun after integration. Neither issue required changing production behavior,
  timeouts, or the test harness. Logs are `/tmp/0214-*.log`.
- Chrome desktop verification opened the Workroom hero Inspector and delivered
  its existing request to Preview. Both retain the original prompt and two exact
  reference images; captured console errors were empty. No media was generated
  or changed, and Preview was closed without editing.
- Source Skill SHA-256:
  `533a84f911613b5b40f077d619c5df3bb01958253d676e167f9ba6c3b50f7882`.
  The currently exposed installed Skill under
  `renku-local/renku/0.1.0+codex.20260902154804/skills/media-producer/SKILL.md`
  has SHA-256 `a4c03573b00c1fa247e0e0543c421e820da380058267378c7e95fa865207a044`.
  It was not modified. Source validation is not a loaded-agent evaluation.
- The seven forward journeys are authored. Executing them in a fresh agent
  harness with fixture tool outputs, and a live timing comparison, remain
  unverified. This repository's existing Skill checks validate sources and
  contracts; they do not execute those conversational journeys. No new eval
  platform, plugin publication, installation, or paid generation was introduced.

## Completion Checklist

### Review Area

- [x] Confirm R1–R6 and the revised generation-briefing omission are accepted;
      duplicate removal is already agreed.
- [x] Preserve the other thread's authorization edits and document their status.
- [x] Confirm no provider, cache, permission, or release redesign entered scope.
- [x] Confirm module shape matches the Architecture Shape Gate.

### Architecture And Contracts

- [x] Define generation Asset, Lookbook media, Cast Voice, Shot, and Shot Plan
      projections at the existing generation contract boundary.
- [x] Remove candidate provenance from actual JSON, without null placeholders.
- [x] Preserve all other reference metadata, warnings, order, and creative text.
- [x] Omit recipes from subject Assets, Shot images, voice samples, and exact
      edit targets while preserving all other target facts and creative text.
- [x] Preserve opaque voice identity, default selection, and dialogue ranges.
- [x] Keep domain Asset/resource, department, attachment, and Inspector contracts intact.
- [x] Verify documented owner-scoped Asset listing, exact-id local extraction,
      pagination when needed, and specific Cast Voice history access.
- [x] Keep CLI delegation, purpose dispatch, diagnostics, and entrypoints intact.
- [x] Add no compatibility path, schema migration, or durable preparation state.

### Implementation Slices And Agent Surfaces

- [x] Record baseline revisions, project state, and payload measurements.
- [x] Implement focused projections for candidates, both Lookbook paths,
      subjects, direct/Scene voices, Shots/Shot Plans, and exact edit sources.
- [x] Preserve full department Lookbook projection without duplicated queries.
- [x] Document first-call capture with successful-output handling and one cwd.
- [x] Document bounded local inspection and relevant-state refresh conditions.
- [x] Document each reference's intended contribution, current direction over
      earlier recipes, and deliberate history use without semantic filtering.
- [x] Document sheet-before-dependent-hero context timing.
- [x] Remove repeated guide/request dumps from the prescribed workflow.
- [x] Preserve exact final prompt execution/provenance and image inspection.
- [x] Preserve fresh-template reuse and normal host permission recovery.
- [x] Verify accepted Codex defaults, optional configuration, informational
      Preview, and authorized attachment without additional consent gates.
- [x] Preserve explicit review/leave-unattached direction and external approval.

### Tests And Guardrails

- [x] Test omitted provenance, retained fields, multi-file references, and empty
      collections at the Core projection boundary.
- [x] Verify every typed target Asset position and unchanged department resources.
- [x] Prove no mutation of stored/shared provenance and unchanged creative text.
- [x] Verify CLI serialization without duplicating Core tests.
- [ ] Add and execute deterministic workflow evals for all seven named journeys,
      including each named reference-role case and intentional history use.
- [x] Verify current generation/voice attachments preserve exact new provenance.
- [ ] Record loaded skill identity and distinguish live from fixture evidence.

### Documentation And Final Verification

- [x] Update current generation/CLI/skill/performance documentation consistently.
- [x] Keep 0213's historical results and unrelated pending gates unchanged.
- [x] Run Studio and sister checks sequentially and inspect both complete diffs.
- [x] Measure same-state payload reduction and document any unmet target.
- [x] Verify desktop Inspector and Preview retain full intended behavior.
- [x] Record timing categories and avoid unsupported live speedup claims.
- [x] Inspect large modified files, bounded projectors, registry, and indices;
      no checklist item may be satisfied through an unreviewable implementation.
- [ ] Mark complete only when all required checks have evidence; report any
      unrun live evaluation or delivery action separately.
