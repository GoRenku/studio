# 0215 Direct Readable Generation Briefings

Status: source implementation complete; independent agent evaluation pending
Date: 2026-09-29

## Summary

Make `renku generation context` directly useful to agents and people across
every current generation purpose. Consolidate repeated facts in the existing
Core report and provide readable CLI output by default, retaining `--json` for
structured consumption. Remove the need to write Python extraction code merely
to read a briefing. Preserve all current creative context and media alternatives.

This is a follow-up to implemented plans 0213 and 0214 and the subsequent
Media Producer instruction improvements. It changes representation, not which
creative context a purpose receives. Purpose-based context pruning is explicitly
excluded, including pruning visual design from audio requests.

## Review Attention

- **Public contract changes:** `MediaGenerationContextReport` gains one `assets`
  collection; nested media become identity references and reference candidates
  retain only file identity and relationship-specific facts. Duplicate Lookbook,
  target Shot, and derived design-summary payloads are consolidated as specified
  below. Update current consumers directly; no compatibility fields or modes.
- **Shared consumer:** Scene Beat authoring already uses the same reference
  projections. Its optional `visualReferences` now exposes `assets` so the
  changed identity references resolve. Department creative context is unchanged.
- **CLI behavior change:** `generation context` without `--json` returns readable
  text. With `--json` it returns the consolidated Core report. Other generation
  commands keep their current output behavior. Skills choose a format before
  invoking the command.
- **Observed-session follow-up:** a closed stdout consumer now produces
  `CLI_OUTPUT_CLOSED` and exit status 1, in the requested diagnostic format,
  instead of an unhandled EPIPE stack. This is CLI process I/O handling only.
  Skills separate large reads, recover from first-call capture, and skip
  duplicate department/Settings reads for media-only work.
- **Preservation boundary:** retain full authored documents, Scenes, Beat scope,
  Shot coverage, all currently returned media alternatives, opaque voice identity,
  exact edit sources, selection distinctions, warnings, and workflow policy.
  No purpose-based pruning, semantic summarization, text truncation, reference
  ranking, or new generation restrictions.
- **New diagnostic:** `CORE_MEDIA_GENERATION_CONTEXT_INCONSISTENT_MEDIA` reports
  an internal projection inconsistency if the same Asset identity is collected
  with conflicting facts. Do not silently choose one copy or merge conflicting
  metadata. Missing creative material continues to use existing nonblocking gaps.
- **No durable effects:** no database/schema migration, Project cleanup, media
  move/deletion, Settings, routes, provider execution changes, or cache redesign.
  Stored provenance, Preview, Inspector, generation authorization, and attachment
  semantics remain intact. Source-level duplicate fields and the Location Python
  example are removed; no user files are removed.
- **Scope beyond 0214:** that plan deliberately avoided report normalization.
  This user-requested follow-up now permits bounded media consolidation inside
  the existing report, not a general resource graph, persistent registry, or new
  context service. Leave the implemented plan as historical evidence.
- **Delivery:** coordinate Studio runtime and sister `studio-skills` source
  changes. Publication/installation uses the existing release workflow and is
  separate from implementation; do not edit installed plugin caches.
- **Assumptions:** live Urban Basilica examples do not cover every populated
  purpose. Complete fixture coverage is required. Byte savings are evidence of
  payload reduction, not proof of token savings or agent latency improvement.

## Requirement Ledger

| Requirement | Source | Owner and verification |
| --- | --- | --- |
| Read the briefing directly without custom extraction | Explicit user request following the session audit | Core report, CLI text rendering, skill workflow; representative agent preparation evals |
| Readable output and JSON | Explicit user acceptance of text for readability/token efficiency | CLI context output selection; text/JSON information parity and measurements |
| Evaluate format choice without adding roundtrips | Explicit user request after format-risk discussion | Sister-repository behavioral eval cases, fixtures, transcript scoring, and release evidence |
| Generalize across generation types | Explicit user correction | Existing exhaustive Core purpose registry and all target variants; purpose matrix tests |
| Preserve functionality; no purpose-based pruning | Explicit user constraint | Core fact-preservation tests and complete text rendering |
| Remove duplicated context and redundant workflow reads | Accepted audit findings | Core consolidation, shared skill instructions; call/output accounting |
| Keep creative contents opaque and domain rules in Core | AGENTS.md and decisions 0041/0087 | Typed projections, import boundaries, no semantic filtering |
| Preserve reference choice and selection distinctions | Decisions 0087/0089 and current contracts | Core relationship assertions, voice/take/edit-source fixtures |
| Preserve Preview, provenance, authorization, and attachment | Current product rules and prior explicit user direction | Existing boundaries untouched; focused workflow regressions |

## Context And Evidence

### Accepted constraints and current owners

- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`.
- Decisions 0086, 0087, 0088, and 0089: skill-directed execution, advisory Core
  context, exact authored references, and dialogue dependency selection.
- `docs/architecture/media-generation.md`,
  `docs/architecture/reference/media-generation.md`,
  `docs/architecture/reference/studio-skills.md`, and `docs/cli/commands.md`.
- `docs/architecture/coding-practices.md`, `naming-guidelines.md`,
  and `data-model-and-storage.md`; package-boundary diagnostics follow
  `@gorenku/studio-diagnostics` and the current repository rules.
- `docs/product/workflows.md` supplies filmmaking workflow context, not a
  replacement generation contract. Current accepted architecture governs the
  concrete purpose/target behavior.
- Plans 0213/0214 are the implemented baseline; no startup/cache redesign is
  reopened. Current Media Producer efficiency guidance already includes direct
  Project resolution, selected-provider discovery, current-request provenance,
  and correct selection verification. Preserve and integrate those changes.
- Core's `client/media-generation-context.ts` and
  `server/media-generation-context/` own the read-only report. The service
  wiring exposes `readMediaGenerationContext`; the CLI context handler delegates
  directly. No Studio UI consumer of this report was found in the investigation.
- `generation/command.ts` currently writes JSON for every generation result,
  even without `--json`; the context handler has no readable renderer today.
- Sister skills live at `../studio-skills/skills/`, not the installed cache.

### Measured examples

Read-only investigation against current Urban Basilica returned approximately:

| Purpose | Pretty JSON bytes |
| --- | ---: |
| `cast.character-sheet` | 92,645 |
| `cast.voice-sample` | 41,264 |
| `location.sheet` | 61,285 |
| `scene.storyboard-sheet` | 106,937 |
| `shot-plan.dialogue-audio` | 104,471 |
| `shot-plan.video-generation` | 153,422 |
| `lookbook.video-sheet` | 67,064 |
| `image.edit` | 4,987 |

The Lookbook report contains an identical 21,131-byte compact object in both
target and visual-language context. Cast Design summaries repeat authored
extracts; the measured character summary is about 4.3 KB. Voice sample Assets
repeat in subject assets and Cast Voices. Shot builders return a target Shot
both separately and in its owning plan. Reference candidates repeat Asset/File
facts already present elsewhere.

Suggestions are not the complete media inventory: the measured character-sheet
report has two Assets outside suggestions; video has thirteen. Those must remain.
The live sampled Shot Plan has no Shots and sampled Scene has no Props; use
populated fixtures for those cases rather than claiming live coverage.

The audited session `01a0ec53-4454-77f1-bf17-5f8d403584be` took 8m30s, with about
3m13s in image generation, 51 shell commands, and about 260,000 characters of
text tool output including wrappers. It provides workflow evidence, not a
controlled benchmark. The new plan must measure preparation separately from
provider time and user pauses.

### Implementation direction

Refactor the existing Core report and format it in CLI, reusing purpose builders,
scope rules, diagnostics, and service ownership. This replaces the current
Location-specific extraction workaround with directly consumable output.

Documentation contains one contradictory sentence: the media-generation
reference says candidates preserve provenance after describing its omission.
Correct current documentation to reflect 0214; do not reintroduce recipes.

## Product Behavior And Non-Goals

The normal agent path is one successful current briefing read, visual/audio
inspection of chosen references, request preparation, required Preview and
authorization, execution, inspection, and focused attachment. Reading context
does not select references or authorize provider spending.

Both output formats carry the same information. The readable form reduces JSON
syntax and repeated labels; it is not an AI-authored summary. Missing material
remains visible through empty state or existing diagnostics. All existing
ordering and scope semantics remain. A later relevant mutation still requires
fresh context; a new Hero consuming an attached sheet still reads its briefing
after attachment.

### Choose the format once

The CLI default and the agent's format choice are separate concerns. The shared
skill rule is: **read generation context once; use text for direct briefing
consumption, or request JSON from the start when the next operation processes
the report in code. These are alternatives, not successive workflow steps.**

Choose by the immediate operation, not by purpose, media kind, or perceived task
complexity. A video briefing can be read as text; a character-sheet workflow
can legitimately request JSON to construct file markers programmatically. Do not
make agents walk an elaborate decision checklist or predict every later need.
Purpose guides inherit this rule instead of prescribing contradictory formats.
Examples with actual structured processing use `--json`; ordinary briefing
examples omit it. JSON itself does not require a Python extraction step.

Both presentations include the exact identities, paths, roles, availability,
selection distinctions, and creative content needed for normal preparation.
Neither is a partial report requiring a second call to obtain omitted facts.
Agents may save explicitly requested output using ordinary shell redirection;
reuse such a file when it already supplies the required format and remains current.

Fetching JSON after text solely because normal preparation cannot use the
readable output is an evaluation failure to investigate, not an intended path.
A user-directed change in the next operation may justify a different format;
a relevant Project mutation may require fresh context regardless of format.
Do not ban those legitimate reads or conceal them in the measurements.

Explicit non-goals: purpose-based pruning; dropping unselected alternatives;
removing voice data from visual requests or visual data from audio requests;
rewriting/summarizing or truncating creative text; changing reference eligibility,
approval, generation, provider, or attachment behavior.

## Contracts

### Existing public entrypoints

Retain `readMediaGenerationContext(ReadMediaGenerationContextInput)` and the
`ProjectDataService` method. Inputs, purpose/target parsing, `--revision`, and
repeated `--beat` behavior are unchanged.

```text
renku generation context --purpose <purpose> --target <target>
renku generation context --purpose <purpose> --target <target> --json
```

`--project` continues to work as today. Without `--json`, render readable text
regardless of TTY or redirection; do not silently switch formats when piped.
`--json` emits one JSON document without headings or progress text. Existing
structured error serialization and exit status remain unchanged.

### Consolidated Core report

Retain `MediaGenerationContextReport` and its existing top-level identity,
policy, guidance, target, visual-language, suggestion, warning, and resource-key
fields. Add `assets: MediaGenerationAsset[]` as the sole source of complete
Asset/File facts in this report. This collection is request-local and non-durable.

`MediaGenerationAsset` remains `Omit<Asset, 'generationProvenance'>`. Preserve
every other Asset field and every AssetFile field, including file role, media
kind, MIME, dimensions, duration, size/hash, paths, and identity. This plan does
not discard metadata merely because an example workflow does not use it.

Build the collection from the union of every currently embedded Asset and every
suggested candidate's source Asset, including candidates whose Assets currently
exist only in suggestions. Keep distinct Asset/File identities even if paths,
hashes, or bytes match. Repeated references to the same Asset share its complete
facts; first encounter in deterministic existing traversal order fixes collection
order, not creative priority. Never overwrite conflicting repeated projections;
return the named structured consistency error with affected Asset identity.

Register the complete source Asset before applying any candidate file subset.
For example, an edit source can expose only image files as edit candidates while
retaining its other registered files in the inventory. Do not register that
filtered clone as a second, conflicting full Asset. Candidate-only sources now
receive the same complete provenance-free Asset representation as other sources;
this may add metadata for those sources while removing repeated copies elsewhere.

Replace nested complete Assets with these explicit identity fields:

| Current context position | New report position |
| --- | --- |
| Subject `assets` | `assetIds: string[]`, preserving membership/order |
| Cast Voice `sample` | `sampleAssetId: string`; all other CastVoice fields unchanged |
| Lookbook image/sheet `asset` | `assetId: string`; preserve placement id, sections, points, and every other field |
| Shot `images` | `imageAssetIds: string[]`; retain `selectedImageId` and all other Shot fields |
| Exact edit target `asset` | `assetId: string`; complete Asset in report `assets` |

Update the existing `MediaGenerationCastVoice`, `MediaGenerationLookbookImage`,
`MediaGenerationLookbookSheet`, `MediaGenerationShot`, and
`MediaGenerationShotPlan` types directly to these shapes. No parallel legacy
types or alias fields. Existing full domain resources keep their own contracts.

Keep `MediaGenerationReferenceSuggestion` group `id`, `role`, `subject`, and
candidate ordering. Change `MediaGenerationReferenceCandidate` to:

```ts
interface MediaGenerationReferenceCandidate {
  assetId: string;
  assetFileId: string;
  dialogueTurnRange?: DialogueTurnRange;
  isDisplaySelected: boolean;
  isWorkflowSelected: boolean;
  available: boolean;
}
```

All removed candidate fields resolve exactly through `assets` and its `files`;
candidate `mediaKind` resolves to the File's media kind, not the Asset's. Keep
selection and turn-range facts on each candidate relationship, not as global
Asset attributes. A file can appear under multiple roles/subjects with distinct
relationship facts. Availability checks and unsupported-file warnings retain
their current behavior. An Asset outside suggestions is not newly classified
as available or selected. Every referenced Asset/File must resolve in the report.

### Other exact duplication

- In `MediaGenerationSubjectDetails`, replace `activeDesignSummary` with
  `activeDesignId: string | null`. Preserve the full `activeDesign` unchanged.
  The current summary id is the only independent fact; its other values are
  deterministic extracts of that document. Verify this for Cast, Location, and
  Prop before deleting those generation-only summary projections. Department
  resource summaries and their producers remain when used outside generation.
- Lookbook target context becomes `{ kind: 'lookbook', lookbookId: string,
  sourceInspirationFolders: InspirationFolderWithResolvedPath[] }`; the single
  matching `visualLanguage` entry contains its complete definition, placements,
  selection, and sheet references. Do not lose source folder contents/paths.
- Shot target context becomes `{ kind: 'shot', shotId: string, shotPlan:
  MediaGenerationShotPlan, coveredBeats: ShotPlanCoveredBeat[], sceneContext:
  MediaGenerationSceneContext }`. The target Shot exists once in `shotPlan.shots`.
- Preserve `scene`, `contextText`, `dialogueTurns`, full revision data, selected
  Beat ids, and covered-Beat structures. They provide distinct structured and
  textual views or scope facts; this plan does not reinterpret them as redundant
  creative material. No general recursive deduplicator for documents or strings.

### Readable CLI presentation

Use a pure CLI renderer `renderMediaGenerationContext(report): string`. Its
sections, in order, are Generation, Project, Workflow Policy, Output Guidance,
Target Context, Visual Language, Reference Suggestions, Media, Warnings, and
Resource Keys. Sections retain explicit null/empty states where those convey
missing context. Structural headings are CLI copy, not new Core prose.

Render complete creative strings verbatim, including Unicode, line breaks,
quotes, and Markdown. Do not wrap, trim, summarize, escape into one-line JSON,
parse Markdown semantically, or truncate them. Render opaque structured values
such as voice identity as complete JSON when that preserves their types better
than prose. Presentation must not interpret provider-owned identity contents.

Use labeled nested values for typed documents and metadata. Preserve array
order, duplicate authored array values, false, zero, null, and empty collections.
Use JSON quoting for scalar values whose whitespace or emptiness would otherwise
be ambiguous. This is presentation, not a new machine-parsable text protocol.

Media entries show full Asset metadata once and all File records beneath it.
Reference entries identify the Asset/File and their relationship flags; the
renderer may repeat a short title/path to keep a role immediately actionable,
but must not expand the full Asset/document for each relationship. Membership
ids and explicit headings let the reader connect sections without constructing
joins in Python. Print all alternatives, not only suggested/selected records.
Do not invent media roles, summary text, priority, or attachment advice.

The renderer only formats the already resolved Core report. It must not read
the filesystem/database, call other commands, check availability, infer owner
relationships, choose providers, or suppress information based on purpose.

## Architecture Shape Gate

| Module/file | Responsibility and planned shape |
| --- | --- |
| `core/src/client/media-generation-context.ts` | Existing bounded public context types; change directly, no separate briefing DTO |
| `core/src/server/media-generation-context/context.ts` | Thin read orchestration, report assembly and existing validation |
| `.../purpose-registry.ts` and `.../purposes/*.ts` | Existing exhaustive purpose dispatch; domain-specific membership and scope stay here |
| `.../reference-assets.ts` | Typed Asset/Voice/Lookbook projection and request-local Asset collection; no storage or provider rules |
| `.../reference-suggestions.ts` | Candidate relationships, availability and current warning semantics; no embedded Asset copies |
| `.../scene-context.ts`, `shot-context.ts`, `visual-language-context.ts` | Typed subject/document/voice/Shot/Lookbook projections using shared Asset collection |
| `.../index.ts` | Existing thin public entrypoint only |
| `cli/src/commands/generation/context.ts` | Parse flags and call Core; no domain projection |
| `cli/src/commands/generation/context-output/index.ts` | Thin public renderer entrypoint/composition |
| `.../context-output/sections.ts` | Ordered report sections and typed identity associations for presentation |
| `.../context-output/media.ts` | Media and suggestion presentation without full-object re-expansion |
| `.../context-output/values.ts` | Lossless labeled scalar/array/object presentation, no semantic inspection |
| `cli/src/commands/generation/command.ts` | Route context result to text/JSON output once; preserve other command output |

Use the existing bounded command registry. A single exact context-path output
branch is sufficient; do not add a global CLI output framework or refactor every
command. Core's purpose builders receive the request-local Asset collector;
they register typed Assets while projecting identities. Do not first serialize
the old report and then recursively filter its JSON.

`reference-suggestions.ts` shrinks by removing repeated candidate metadata;
purpose builders stop constructing duplicate Lookbook/Shot/summary payloads.
The existing reference-assets module owns the bounded collection; do not build
a generic resource registry, cache, or graph traversal framework.

Stop implementation and revise the slice if an adapter needs new domain
selection logic; collecting an Asset loses an owner/placement association;
summary removal loses a non-derived fact; a renderer suppresses fields to meet
a size target; or a file/function starts combining purpose routing, persistence,
provider execution, and formatting. Keep complexity/nesting within repository
guidance. Passing tests does not excuse a monolithic renderer or Core module.

## Implementation Slices

### 1. Establish preservation and measurement fixtures

Capture same-state reports from the baseline revision in temporary evaluation
storage, with exact purpose/target/revision/Beat inputs and runtime/skill versions.
Use Urban Basilica for read-only examples and isolated Core fixtures for missing
cases. Build a fact inventory from domain fixtures, not a permanent old-report
parser or compatibility adapter. Record authored documents, complete Asset/File
facts, ordered memberships, relationship flags, voice identities, scope, policy,
warnings, and resource keys. No generation or Project mutation is needed.

### 2. Consolidate Core projections

Change the named public types, Asset collection, all purpose builders, service
contract consumers, and focused tests together. Preserve existing purpose maps
and purpose-specific context breadth. Remove generation-only summary calls and
duplicate structures; do not remove domain resource summaries. Add structured
consistency handling at the Core collection boundary. Existing provenance
omission remains exhaustive, including edit sources and voice samples.

### 3. Add readable context output

Implement the pure renderer in the bounded CLI folder. Wire only generation
context output selection; no second Core call, stderr-to-stdout conversion,
generic result wrapper, or duplicate printing. Test the real command in both
formats. Keep JSON as structured report serialization, not a reconstruction
from rendered prose. Record text/JSON sizes on identical reports.

### 4. Update the shared agent workflow across purposes

In `../studio-skills/skills/media-producer/`:

- Change `SKILL.md` and `references/workflow.md` to teach the single shared
  format-choice rule above. Readable output is the ordinary direct-reading path,
  not a mandatory first step before JSON or a universal format for all agents.
  Optional capture uses one successful call and a unique file under `tmp/scratch`.
  Do not routinely read both formats or dump the report followed by subsets.
- Remove the Python inspection block from `references/location-sheet.md`.
  Replace it with direct briefing consumption and current identity/role guidance.
- Update `cast-character-sheets.md`, `cast-profile.md`, `cast-voice-sample.md`,
  `location-sheet.md`, `prop-sheet.md`, `lookbook-image.md`, `lookbook-sheets.md`,
  `project-cover.md`, `scene-storyboard-sheet.md`, `shot-image.md`,
  `shot-plan-dialogue-audio.md`, `video-reference-continuity.md`,
  `image-operation-routing.md`, and `shot-plan-video/` references wherever they
  consume the changed contract. Keep creative/model research intact.
- Update `references/model-guides/shared/reference-inputs.md` and forward evals
  to follow the single media inventory and relationship facts without fetching
  previous recipes. Deliberate history access remains possible through existing
  domain reads.
- Check specialist handoffs in casting-director, production-designer,
  lookbook-designer, scene-beat-designer, shot-planner, blender-shot-planner, and
  movie-director. Retain department-context reads needed for authoring; do not
  add them to media-only preparation or duplicate Media Producer's briefing.
- Retain direct Project reuse, selected-provider-only discovery, Codex direct
  model-guide resolution, and exact current-request provenance. Cross-provider
  discovery remains valid for requested configuration/choice.
- Retain post-Preview request reading, exact execution/provenance values, media
  inspection, and correct attachment verification. `media import` confirms
  attachment; when confirming display selection use the existing Asset listing's
  `selectedAssetId` once, not guessed Asset flags or another department briefing.
- Retain one sheet briefing and a fresh dependent Hero briefing after attachment;
  refresh after other relevant mutations. No blanket command-count limit.
- Add `evals/generation-context/forward-test-cases.md` and
  `evals/generation-context/fixtures.json` with the behavioral scenarios and
  scoring below. Link them from the existing `evals/forward-test-cases.md`.
  Fixtures contain synthetic current-contract reports generated from populated
  Core fixtures, including raw documents and exact media relationships, plus
  the corresponding CLI text outputs. Do not use unrelated historical recipes
  or private Project content as checked-in evaluation inputs.

Update only references affected by the contract/workflow. Do not sweep historical
plans or provider research. No new Python scripts or plugin dependencies.

### 5. Document, verify, and measure

Complete the tests and documentation below, then perform a bounded preparation
evaluation for character, Location, audio, and video contexts. Use explicit
preparation-only evaluation inputs; no paid/image execution or durable attachment
is needed to verify discovery and briefing consumption. A later real user run
measures end-to-end performance. Report tested gains and limits separately.

## Tests And Guardrails

### Core: complete behavior coverage at the owner

Use all 22 existing purposes through the existing registry and target families:
Project cover; generic Shot Plan image creation; image/video editing; three
Lookbook purposes; Cast sheet/profile/voice; Location sheet/Hero; Prop sheet/Hero;
Scene storyboard; Shot image; five Shot Plan video purposes; dialogue audio.

Assert the following against current intended facts, not source-text needles:

- Complete authored designs and Lookbook definitions are unchanged. Summary
  extracts remain represented in the full document and design identity survives.
- Every previously provided Asset/File is present, including unsuggested media,
  multiple files, nonmedia files in inventories, different Assets sharing a
  path/hash, and candidates previously present only in suggestions.
- Every reference resolves; duplicate Asset identities appear once; conflicting
  projections fail with the structured diagnostic. Multiple roles/subjects and
  candidate order survive independently.
- Display-selected imagery, default Cast Voices, and workflow-selected dialogue
  Takes retain their distinct meanings. Preserve alternate voices, opaque voice
  identity, exact turn ranges, overlapping selected Takes, and sample associations.
- Lookbook placement ids/annotations/selection/source folders survive. Target
  Shot identity, other Shots, full plan, selected images, coverage, Beat revision,
  selected subset, canonical order, screenplay context, and dialogue survive.
- Empty context, missing creative documents, unsupported media metadata, missing
  files, invalid targets, and invalid scope retain current outcomes. Do not turn
  creative gaps into blockers or unsafe paths into valid references.
- Historical generation recipes remain absent throughout this report. Full
  domain resources and stored provenance retain them; Preview/Inspector inputs
  remain unchanged.

### CLI: formatting and delegation

- One Core call; default text versus `--json`; unchanged output for other
  generation subcommands; unchanged structured error/exit behavior.
- All report sections and union variants render, including empty/null states.
  Test multiline Unicode/Markdown, quotes, leading/trailing whitespace, false,
  zero, empty strings, and opaque nested voice identity without text loss.
- Media inventory and relationships are directly usable without full-object
  repetition; every candidate's exact file path can be located in the text.
- Pure rendering imports no database, filesystem availability, provider, or
  generation execution capabilities. Reuse stable import-boundary guards;
  never test private helper names or a source-text command inventory.
- One representative real CLI integration proves both formats derive from the
  same Core report. Do not duplicate the complete Core invalid matrix here.

### Skills and performance

Write executable-in-conversation behavioral scenarios in the sister repository's
`skills/media-producer/evals/generation-context/forward-test-cases.md`, using
`fixtures.json` as the controlled read responses. Each case specifies a natural
user task, initial state, permitted preparation-only tools, expected observable
behavior, and failure criteria. Keep the scoring rubric separate from the task
prompt so it does not tell the evaluated agent which flag to choose. Use the
existing manual forward-evaluation workflow.

| Case id | Task and fixture | Expected observable behavior |
| --- | --- | --- |
| `briefing-character-direct` | Prepare a character sheet from current design, an existing sheet, and a Lookbook | Direct text read suffices; exact files/roles, complete design and alternatives remain usable without a JSON reread |
| `briefing-character-structured` | Prepare the same request with an explicitly requested script constructing native reference markers | JSON chosen on the first call; script consumes exact ids/paths; no preliminary text call |
| `briefing-location-dependent` | Prepare a sheet, then a Hero after a supplied successful attachment event | One sheet context and one fresh dependent Hero context; second call reflects changed state, not a format conversion |
| `briefing-dialogue-direct` | Prepare multi-speaker dialogue with default and alternate voices | Direct text supports exact dialogue, speaker mapping, opaque identity and sample choice; no guessed voice id or dropped alternative |
| `briefing-dialogue-structured` | Programmatically map the same speakers to explicitly chosen voice samples | JSON from the start; preserve exact identity values, speaker order and references |
| `briefing-video-dependencies` | Prepare video using multiple selected dialogue Takes, overlapping ranges, first/last frames and an unselected alternative | Preserve workflow versus display selection, ranges and distinct files; complexity alone does not force a second format read |
| `briefing-edit-exact-source` | Prepare an edit with similar titles, multiple source files and a different display-selected Asset | Use exact requested source identity/file; no inference from title or display selection and no format reread to find missing identity |
| `briefing-large-complete` | Read a populated Scene/Shot/Prop/Lookbook briefing with multiline Unicode text, empty values and many alternatives | No truncation or semantic pruning; no Python required just to understand text; distinguish harness output limits from CLI omissions |
| `briefing-explicit-json` | User explicitly requests a JSON briefing for downstream tooling | Honor JSON directly without also printing text |
| `briefing-state-change` | User changes a design or selected dependency after a briefing | Refresh affected context and use the new facts; do not reuse stale output to meet a call-count goal |
| `briefing-next-operation-change` | After direct reading, user explicitly adds structured export work | A justified JSON request is allowed; record changed intent rather than scoring every second read as waste |

Run the direct and structured variants against the same underlying fixture facts.
Include absent creative context and unavailable candidate files without turning
them into new blockers. The large case complements the existing purpose coverage;
it does not replace per-purpose preservation tests in Core.

For each run record the task/fixture and runtime/skill revisions, first format,
context invocations and their reasons, report rereads, custom extraction/parsing
code, tool-output bytes/tokens where measurable, preparation time, and correctness
of the prepared request's identities/roles/dependencies. Score these separately:

- **Correctness:** all required current creative context and exact relationship
  facts are used or remain accessible; no invented identifiers, lost alternatives,
  wrong selection semantics, or stale dependencies.
- **Format choice:** direct consumption is possible without extraction; explicit
  programmatic work requests JSON immediately. Respect explicit user format choice.
- **Roundtrips:** no routine text-then-JSON sequence, duplicate guide-driven calls,
  schema fishing, or second call to obtain facts missing from one presentation.
  Legitimate scope/state/intent changes are classified separately.
- **Workflow integrity:** retained Preview, authorization, provider selection,
  inspection and attachment rules; eval runs stop before generation or mutation.

Use representative repeated runs when an observed difference could be agent
variance, with a stated fixed run count rather than an open-ended optimization
loop. Compare the baseline and new workflow on the same tasks and facts. A
smaller response does not pass if preparation introduces extra context reads or
loses exact values. Fix demonstrated skill/renderer defects and rerun affected
cases before claiming readiness; do not impose a universal ban on JSON or reads.
Record failures and unresolved harness limitations explicitly. Automated fixture,
link, or Markdown validation is not evidence that an agent passes these cases.

Measure baseline JSON, consolidated JSON, and readable text on identical facts.
Record UTF-8 bytes and tokenizer counts only when the same identified tokenizer
is already available; do not label characters as tokens or add a dependency just
for this measurement. Measure command latency, tool-output volume, number of
preparation calls, and time to a prepared request separately. Keep provider time
and user pauses separate. No hard percentage promise or padding/omission to
satisfy a size target. Investigate regressions rather than hiding them.

## Documentation And Decision Effects

Update accepted current architecture and CLI references named above, plus
`docs/architecture/cli-performance.md` with measured results and methodology.
Record the changed representation and default CLI output in a new decision
`docs/decisions/0104-use-consolidated-readable-generation-context.md` during
implementation, after confirming the number remains free. Add a concise notice
to decision 0087 linking the representation refinement; preserve its original
reasoning and advisory-context decision. If that number is taken, resolve the
next number before writing rather than replacing another decision.

Document the readable output as a human/agent presentation, not a parsing API;
document `--json` as the exact machine contract. Show examples for character,
Location, video, audio, and editing, not only the motivating Location task.
Record Studio/skill revision requirements for normal coordinated delivery;
do not build compatibility readers or a new release system.

## Final Verification

From Studio run `pnpm build`, `pnpm test:core`, `pnpm test:cli`, and `pnpm check`.
Run `pnpm --filter @gorenku/studio-core test:integration` and
`pnpm --filter @gorenku/studio-cli test:integration` using their existing package
test partitions. From `../studio-skills` run `pnpm test:media-generation`.
Do not install dependencies or apply formatters to unrelated files.

Read current Urban Basilica reports without changing Project data. Compare
same-state evidence and both outputs for representative purposes, with populated
fixtures filling the observed Shot/Prop gaps. Inspect default output in a desktop
terminal and through redirected/captured stdout, including a large report; no
mobile or Studio UI redesign testing is introduced. Verify existing shared
Preview/Inspector tests still pass if touched transitively.

Inspect the complete diff and `git diff --stat` in both repositories, all large
or heavily modified files, module responsibilities, index files, imports, and
dispatcher shape. Confirm no formatting churn, compatibility fields, semantic
pruning, lost creative values, duplicate runtime representations, or installed
cache edits. Do not claim performance improvement without reporting measurements.

## Implementation Evidence — 2026-09-29

Core, CLI, current consumers, sister Skills, synthetic eval fixtures and accepted
documentation are implemented. See `docs/architecture/cli-performance.md` for
same-state preservation evidence, payload measurements, command timings and test
counts. The shared Scene Beat consumer addition is recorded in Review Attention.

Independent agent trials have not run. Their first-format choice, reread count,
prepared-request correctness and timing remain open acceptance items below;
automated fixture validation is recorded separately. No tokenizer counts are
claimed. Studio and plugin distribution have not been released or installed.

## Completion Checklist

### Authorized live-session follow-up, 2026-09-29

- [x] Correct first-call capture, aggregate tool limits, text/JSON choice and
      complete inventory instructions at the skill entry point.
- [x] Make Cast Design retrieval conditional on actual design authoring.
- [x] Handle closed stdout at the CLI process boundary with structured failure;
      test readable/JSON failure and a normally consumed response.
- [x] Add eval cases for aggregate clipping, captured-output recovery and
      current layout versus existing design guidance.
- [x] Run the user-authorized Codex Character Sheet workflow against Mara,
      inspect outputs, correct ruler failures, and attach the final candidate
      with the exact executed request. This test adds one candidate Asset to
      Urban Basilica; it does not alter Cast facts or Settings.
- [x] Record call counts, outputs, timings, visual failures and test limitations
      in sister `studio-skills/skills/media-producer/evals/generation-context/
      runs/2026-09-29-mara.md`.
- [x] Verify the narrow CLI/skill changes with build, checks, unit/integration
      tests, skill validation and final diff review.

This operator-led run does not close the independent multi-purpose evaluation
gates below. No controlled general agent speedup or release is claimed.

### Review And Scope

- [x] Confirm the explicit JSON/default-output changes and bounded media
      consolidation are the accepted implementation scope.
- [x] Preserve every requirement in the ledger; exclude purpose-based pruning,
      Settings/cache/provider/authorization changes and durable data effects.
- [x] Capture baseline Studio/skill revisions and same-state evaluation inputs.
- [x] Keep plans 0213/0214 as implementation history; no automatic review loop.

### Architecture And Contracts

- [x] Update the existing report/types and service callers directly.
- [x] Add the request-local complete Asset inventory and preserve every File field.
- [x] Replace nested Assets with the named identity fields; retain all memberships.
- [x] Preserve candidate role/scope/selection/availability/range facts and order.
- [x] Retain complete designs with design ids, one target Lookbook, and one target Shot.
- [x] Add Core-owned structured consistency handling without creative validation.
- [x] Keep full resources, stored provenance, Preview, and Inspector intact.
- [x] Confirm the final module layout matches the Architecture Shape Gate, with
      thin indexes and no broad dispatcher, generic graph, or monolithic renderer.

### Implementation And Agent Surfaces

- [x] Complete the preservation fixtures before replacing projections.
- [x] Update every current purpose builder through shared typed projection owners.
- [x] Implement readable CLI sections and lossless value/media rendering.
- [x] Route default context output to text and `--json` to one report serialization.
- [x] Preserve all other generation command output and structured errors.
- [x] Remove the Location Python workaround and routine extraction instructions.
- [x] Teach one pre-call text/JSON choice rule; remove conflicting format guidance
      while preserving examples that genuinely process structured output.
- [x] Update each named purpose-guide family and specialist handoff consumer.
- [x] Preserve direct Project/provider resolution and current-request provenance.
- [x] Preserve Preview, authorization, inspection, attachment/selection verification,
      and dependency-aware refresh behavior.

### Tests And Measurement

- [x] Cover all 22 purposes and all target union variants with meaningful fixtures.
- [x] Prove full creative fact and Asset/File preservation, including unsuggested media.
- [x] Cover duplicate identities, multiple roles/files, conflicting facts, and gaps.
- [x] Cover voice identity/defaults, dialogue Take selection/ranges, and exact edits.
- [x] Cover Lookbook annotations, Shot membership, Beat scope/order, and coverage.
- [x] Verify text completeness and JSON parity without duplicating Core test matrices.
- [x] Verify renderer purity and stable import boundaries without private-name tests.
- [ ] Run representative preparation evals and separate them from static validation.
- [x] Write and link the sister-repository format-choice cases and synthetic fixtures.
- [ ] Run direct/structured character and dialogue pairs, dependent Hero, video,
      exact edit, large output, explicit JSON, and legitimate refresh/change cases.
- [ ] Record first format, reread reasons, extraction code, correctness, output
      volume and timing; fix unnecessary roundtrips or exact-value regressions.
- [ ] Record comparable payload/token measurements and preparation timings honestly.

### Documentation And Final Verification

- [x] Update architecture, CLI, performance, skill references, and forward evals.
- [x] Add the representation ADR and concise decision-0087 notice; preserve history.
- [x] Run Studio build, Core/CLI tests, checks, affected integrations, and skill validation.
- [x] Inspect large terminal and redirected outputs; use fixtures for live-data gaps.
- [x] Inspect full diffs/stats and heavily modified files in both repositories.
- [x] Confirm no checklist item relies on unreviewable structure or context pruning.
- [x] Report release/installation status accurately; do not edit plugin caches.
- [ ] Mark implemented only after all required work and evidence are complete.
