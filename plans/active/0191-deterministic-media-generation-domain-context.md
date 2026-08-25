# 0191 Deterministic Media Generation Domain Context

Status: complete
Date: 2026-08-24
Completed: 2026-08-25

## Review Attention

- Restore a Core-owned, deterministic media-generation context boundary. Every
  Media Producer request begins with `renku generation context --purpose
  <purpose> --target <target> --json`; Skills no longer discover Project facts,
  related subjects, Lookbooks, or relationship-derived media by assembling a
  sequence of unrelated commands.
- Add one new browser-safe public report,
  `MediaGenerationContextReport`, and one Core service entrypoint,
  `readMediaGenerationContext`. Reintroduce a bounded purpose registry only for
  target validation, output guidance, domain projection, and reference roles.
  It is not the deleted Generation Spec/Run/provider lifecycle under a new name.
- Preserve the current provider architecture. Do not restore checked-in or rich
  provider schemas, provider model catalogs, provider-neutral request fields,
  provider payload builders, price estimation, approval tokens, simulation,
  persisted Generation Specs/Runs, freezing, or Core-owned provider execution.
  Do not add a model-selection dialog, setup document, control descriptor,
  transient presentation schema, or provider-metadata projection for Studio.
  Provider Skills retain only their existing supported-model identity/name and
  input-mode guidance; the agent reads the selected provider for current native
  request facts and makes the request-scoped choice conversationally.
- Establish a Core design principle: **context is evidence, not permission**.
  Core deterministically supplies current facts, relationships, media
  suggestions, preferences, and gaps. It never turns them into an allowlist,
  requires the agent to use a returned reference, or blocks generation because
  suggested creative context is absent. The user/agent may ignore, supplement,
  or replace suggestions; the selected provider Skill maps the exact choices to
  provider-native fields.
- Restore more than the last deleted loose `facts` object. The new projection is
  typed and complete for the current target: Project story facts, current
  workflow policy, target facts/design, exact Scene/Beat/Shot/Shot Plan context,
  both relevant Lookbooks, Cast/Location/Prop relationships, dialogue/voice
  context, and exact relationship-derived AssetFiles.
- Correct two context surfaces that currently claim to provide data they do not:
  Cast/Location/Prop context must again return the Production Lookbook context,
  and `screenplay beats context --include-visual-references` must return actual
  deterministic visual-reference data instead of a note telling the agent to
  inspect assets manually. These corrections share the same low-level Core
  projectors; they do not create parallel relationship-discovery rules.
- Add exact Beat scoping for `scene.storyboard-sheet`: `--revision` identifies
  the source Scene Beats revision and repeatable `--beat` narrows the context to
  one reviewed batch. Without `--beat`, the exact revision's complete ordered
  Beat set is returned. If `--revision` is omitted, Core resolves the current
  active revision and reports an informational context gap when none exists.
- Improve context where the former projection was incomplete: Shot and Shot
  Plan contexts include Props as well as Cast and Locations; Shot images use
  Production Lookbook appearance context; and Shot Plan video contexts include
  covered Beat Storyboards, selected Shot images, same-plan auxiliary media,
  dialogue audio, and subject continuity candidates with distinct roles.
- Keep Preview and Inspection visually and contractually unchanged. Their
  References tab remains a quiet flat grid of the exact selected images using
  the shared `MediaCard`, with no filenames, Asset ids, domain slot labels, or
  candidate pickers. The review/provenance envelope remains provider, model,
  media kind, prompt, native request, and optional receipt only.
- No database schema, migration, Settings surface, HTTP route, or new Studio UI
  is required. Context is a fresh read projection and is not persisted, frozen,
  hashed, or copied into Asset provenance.
- Add Decision 0087 to narrow Decision 0086: provider-native authoring remains
  Skill-owned, but deterministic Project context and relationship-derived
  suggestions are Core-owned and explicitly advisory.
  Older ADR bodies remain historical and receive concise notices only.
- Plan 0189 remains complete historical evidence and is not reopened or edited.
  Plan 0190 may implement its standalone Pika protocol independently, but its
  Media Producer/provider-Skill adoption is not complete until this plan's
  deterministic context contract is available and consumed.

## Summary

Plan 0189 correctly removed a large provider-neutral runtime, but its deletion
boundary was too broad. It removed both provider machinery and Renku's only
purpose-to-domain context projection. Those are different responsibilities.

The provider machinery was replaceable: provider Skills can choose a model and
author its native request, while standalone Engines validate and execute that
request. The domain projection was not replaceable by prose. Only Core can
deterministically know that a Scene contains Urban, Constantine, Loukas, the
Imperial Council Chamber, and particular Props; that a Shot belongs to a Shot
Plan and Scene; that one Character Sheet belongs to Urban rather than another
Cast Member; that one Storyboard Lookbook Sheet is the accepted appearance
authority; or that a first-frame Asset was authored from the exact Shot Plan.

The intended boundary is therefore:

```text
Core: purpose + target -> current typed domain context + related media suggestions
                                  |
                                  v
Media Producer: user intent + exact candidate choices + creative prompt
                                  |
                                  v
Provider Skill: provider/model choice + native request field mapping
                                  |
                                  v
Preview -> Engines/Codex -> artifact review -> focused Core attachment
```

The smallest architecture-correct change is to extend the surviving
`MediaPurpose`/`MediaTarget` owner with a new read-only context projection. It
does not recreate a durable generation object, provider schema, provider field
map, or browser editor. It gives every agent the same current Project truth
before the creative/provider-specific steps begin.

## Requirement Ledger

| ID | Requirement | Source | Owner | Verification |
| --- | --- | --- | --- | --- |
| R1 | Every purpose-specific generation begins from one deterministic Core context read rather than Skill-directed discovery of relationships. | Explicit user request. | Core context service and CLI context command. | Core matrix tests, CLI integration tests, and Media Producer evals. |
| R2 | Restore all current purpose/target context: Project facts, target facts/design, Scene/Beat/Shot/Plan relationships, Lookbooks, continuity subjects, dialogue/voice facts, current Assets, and workflow policy. | Explicit user request and former context behavior. | Purpose-specific Core context builders. | Purpose-by-purpose contract tests and Urban Basilica audit. |
| R3 | Supply exact relationship-derived reference suggestions by existing owner/type/authored-from relationships, never by filename, prompt, tags alone, pixels, or Skill inference. The suggestions are not an allowlist. | Explicit user request; Core architecture; opaque-artifact rule. | Core reference-suggestion projector. | Same-owner, same-plan, unrelated-asset, unavailable-file, ordering, and non-exclusivity tests. |
| R4 | Establish “context is evidence, not permission” as a Core design principle. Preserve request-scoped user/agent choice: the agent may ignore, supplement, or replace suggestions, and canonical display selection is never generation selection. | Explicit user correction and Decisions 0049/0051 retained principle. | Core report semantics, architecture docs, and Media Producer workflow. | Contract tests, Skill evals with legitimate departures, and documentation review. |
| R5 | Keep provider-native request authoring, current provider facts, provider validation, uploads, execution, and recovery outside Core context. Add no model-selection dialog, setup document, rich control descriptor, transient presentation schema, or Studio provider-metadata projection. | Decision 0086 and explicit no-schema/no-dialog constraint. | Provider Skills and Engines. | Import/capability guards and absence of provider/model/setup fields in the context and Preview DTOs. |
| R6 | Restore advisory provider-neutral purpose output guidance and current per-media workflow policy without restoring model catalogs, provider controls, or creative enforcement. Provider Skills retain only supported-model identity/name and input-mode guidance; request fields and constraints come from the selected provider rather than duplicated definitions. | Former purpose context, current Settings architecture, and explicit user corrections. | Core purpose definitions, Project Settings policy resolver, Media Producer, and provider Skills. | Exact guidance/policy projection tests, Skill validation, and non-enforcement tests. |
| R7 | Let Scene Storyboard context describe an exact revision and optional ordered Beat batch so related subjects/references are calculated by Core. Missing creative context is reported, not used to prevent generation. | Existing Storyboard workflow and explicit determinism/information requirements. | Core Scene purpose builder and CLI flags. | Revision ownership, Beat membership/order, batch-context, and missing-context tests. |
| R8 | Give Shot and Shot Plan media complete context, including Props, covered Beats, selected Shot images, Beat Storyboards, dialogue audio, and same-plan auxiliary media. | Explicit “all context” request and current Shot Plan workflow. | Core Shot/Shot Plan purpose builders. | Shot/Plan relationship and same-plan filtering tests. |
| R9 | Repair current context reports that promise Lookbook/visual references but return `null` or a discovery note. | Current docs/contracts versus implementation evidence. | Existing department and Scene Beats context owners using shared projectors. | Focused context tests and CLI JSON checks. |
| R10 | Keep Preview/Inspection and the review/provenance envelope unchanged; selected references remain flat `MediaCard` images with no filenames or domain slot UI. | Explicit prior UI requirements. | No production UI changes; regression guard only. | Existing shared-dialog and screenshot tests remain green. |
| R11 | Keep context fresh and non-durable. Do not add a context snapshot, hash, generation id, lifecycle, database table, or migration. | Smallest useful scope and no-Spec architecture. | Core read projection and Skills. | Schema/diff inspection and absence-of-capability checks. |
| R12 | Update Media Producer, provider handoffs, specialist handoffs, samples, evals, and validation so context is mandatory and stale ad hoc discovery claims disappear. | Explicit user requirement that Skills not discover relationships. | `studio-skills`. | Skill validator plus focused forward evals. |
| R13 | Record the corrected ownership in current architecture/CLI docs and a new ADR without rewriting Plan 0189 or older ADR history. | Documentation rules and changed accepted direction. | Docs and Decision 0087. | Link/notices review and stale-contract search. |

## Product Behavior

### The briefing is mandatory; following its suggestions is not

Before it selects a provider, authors a prompt, or writes a review document,
Media Producer runs:

```bash
renku generation context \
  --purpose <purpose> \
  --target <target> \
  --json
```

For an exact Scene Storyboard revision or reviewed Beat batch:

```bash
renku generation context \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --revision <scene-beats-revision-id> \
  --beat <beat-id> \
  --beat <beat-id> \
  --json
```

The response is one complete current projection for that purpose and target.
The agent does not have to know which Cast, Location, Prop, Lookbook, Scene,
Beat, Shot, Shot Plan, dialogue, voice, or Asset commands to call in order to
discover the applicable graph.

Media Producer must obtain this briefing so Renku consistently contributes its
Project knowledge. What the agent does with that knowledge remains a creative
decision. It may inspect the returned files, ignore a suggestion, choose a
different Project Asset, incorporate a user-supplied external reference, or use
no reference at all. Core does not judge creative suitability, require an
explanation field, or make the returned set exhaustive.

The boundary is factual: an agent must not claim that an unrelated Asset belongs
to a Cast Member or Shot Plan when Core says it does not. It may still decide
that the unrelated Asset is creatively useful and use it for that stated reason.
“Deterministic” applies to Renku's description of the Project graph, not to the
agent's creative conclusion.

### Context gaps are information, not generation blockers

An existing target remains readable when a Lookbook, design, active Scene Beats
revision, dialogue Take, or related media does not exist. The report returns
`null`, an empty collection, or a structured warning that identifies the gap.
It does not expose a readiness state and the context command never authorizes or
denies a subsequent generation.

Core fails only when it cannot truthfully construct the requested report: for
example, the target does not exist, the purpose/target identity is malformed, a
requested revision belongs to another Scene, or requested Beat ids do not exist
in that revision. Unsafe registered paths remain excluded from usable file
suggestions and are reported as warnings. These are query-integrity and file-
safety boundaries, not judgments about creative adequacy.

The agent decides whether a gap matters for the current intent. It may proceed,
ask the user, create the missing context through a focused workflow, or choose a
different source. No Core context validator chooses among those actions.

### Suggested-reference order is not selection or priority

Core returns deterministic ordering so repeated reads are stable:

1. reference suggestion groups follow the purpose matrix below;
2. Cast, Location, and Prop subject groups follow first appearance in the exact
   Scene/selected Beats, with duplicate ids removed without reordering;
3. Shot and covered-Beat groups follow authored order;
4. suggested files use newest Asset creation first, then Asset id, file role, and
   AssetFile id as stable tie-breakers.

No order conveys priority. Every suggested file contains
`isDisplaySelected` only as a factual canonical-display signal; it is never
copied into generation selection. One suggestion remains merely a suggestion.

### Context is current, not frozen

`readMediaGenerationContext` reads the current Project database and verifies
the current registered files every time. It creates no persisted snapshot and
does not enter review or provenance.

Media Producer reads context immediately before authoring. If the user changes
the target, revision, Beat batch, Lookbook, subject design, Asset set, or Shot
Plan before generation, the agent reruns the context command. Prompt-only edits
inside Preview do not require a new context read; the Skill still rereads the
review document and rebuilds the provider-native prompt field as already
required by Plan 0189.

### Model and input-mode choice remains conversational

The selected provider Skill supplies only the curated supported-model identity,
human name, and supported input modes needed by the agent. It does not define
controls, enums, defaults, numeric bounds, capability summaries, provider field
semantics, or a Studio presentation model. The agent reads the selected
provider's current operation facts through the existing provider workflow,
considers the user's direction and the Core briefing, and chooses one exact
model and input mode. It may explain alternatives or ask the user to choose in
ordinary conversation; the user may override the recommendation.

There is no Studio model picker and no second setup artifact. The agent writes
the one existing temporary review document only after making the choice. Live
provider validation remains the authority for the exact native request. Preview
and Inspection show the chosen model and exact request; they do not discover,
compare, recommend, or edit alternative models and input modes.

### Preview and Inspection remain request views

The generation context report is an agent-facing Core/CLI projection, not a new
Preview resource. The review document continues to contain only:

```ts
interface MediaGenerationReviewDocument {
  provider: string;
  model: string;
  mediaKind: 'image' | 'video' | 'audio';
  prompt: string | null;
  request: JsonValue;
}
```

The exact chosen local files appear recursively as `$file` markers inside the
native request. The shared Preview/Inspection References tab shows those exact
files as flat `MediaCard` images. It does not show the context suggestion set,
roles, filenames, Asset ids, or pickers. Context answers “what Renku knows
and can offer”; Preview answers “what this exact provider request will use.”

## Context And Evidence

### Current regression

The current production state has these gaps:

- `MediaGenerationReviewDocument` contains provider/model/mediaKind/prompt/
  request only. That is sufficient for request review but cannot identify a
  generation purpose or discover Project context.
- `MediaPurpose` and `MEDIA_PURPOSE_TARGET_KINDS` survive only because focused
  attachment still needs them. No Core command projects purpose context.
- `renku generation` exposes validate, Preview, execute, and recover but no
  context command.
- Media Producer says to read a purpose craft guide, then relies on independent
  domain commands and prose to discover references. Some sister Skills still
  mention the deleted `renku generation context`, proving the workflow contract
  is internally inconsistent.
- `readCastContext`, `readLocationContext`, and `readPropContext` return
  `activeLookbook: null` even though their public DTOs and CLI documentation say
  they return Production Lookbook context.
- `readSceneBeatsContext({ includeVisualReferences: true })` returns only the
  sentence “inspect project assets when visual review is requested.” That is
  precisely the non-deterministic discovery the user rejected.
- Current purpose guides contain stale claims such as “Context recommends...”
  even though no such context exists.

### Valuable former behavior

The deleted context implementation already proved several important rules:

- target kind and output media kind were purpose-owned;
- Project aspect ratio was resolved in Core;
- Scene context combined screenplay references and active Scene Beats;
- voice-over-only Cast Members were excluded from visual continuity suggestions;
- exact same-owner Character, Location, and Prop Sheets were candidates;
- Production and Storyboard Lookbook Sheets were role-scoped candidates;
- dialogue audio candidates were scoped to exact dialogue turns;
- Shot Plan auxiliary media was scoped to exact weak `authoredFrom` context;
- candidate lists did not choose a default; and
- unrelated Assets were excluded even when their filenames or media kinds
  looked plausible.

The old `GenerationContext` also carried provider model descriptors and was
assembled inside the deleted Spec/Run lifecycle. Restoring that type wholesale
would reverse the no-schema provider architecture. This plan retains the domain
rules and replaces the loose `facts: Record<string, JsonValue>` with typed
current domain projections, while leaving model/provider fields out.

### Urban Basilica evidence

The real Project demonstrates why the context graph cannot be left to agent
discovery:

- it currently contains 7 Cast Profiles, 10 Character Sheets, 9 Location
  Sheets, 2 Lookbook Sheets, 50 Beat Storyboard images, 5 dialogue audio Assets,
  a Shot image, first/last-frame Assets, and a Shot Plan video;
- Scene 02, “The First Patron,” references Constantine XI, Loukas Notaras,
  Urban, Narrator, and the Imperial Council Chamber;
- Narrator is voice-over-only and has no factual visual Character Sheet
  relationship for Core to suggest;
- Constantine, Loukas, and Urban each have owner-scoped Character Sheet
  candidates, while the chamber has two owner-scoped Location Sheets;
- the Project has distinct Production and Storyboard Lookbook Sheets; and
- Shot Plan `shot_plan_37a3r9yz` owns one Shot and has same-plan first frame,
  last frame, and final video Assets through weak `authoredFrom` context.

A generic “list assets” instruction cannot safely reconstruct those roles. The
database relationships already encode them; Core must project them once.

### Architecture options considered

| Option | Result | Decision |
| --- | --- | --- |
| Reuse current domain context commands unchanged | Avoids a new DTO, but leaves purpose routing, exact reference roles, cross-domain composition, workflow policy, and Shot/Plan context to agent discovery; several commands currently return incomplete data. | Rejected. |
| Extend the surviving `MediaPurpose`/`MediaTarget` owner with one read-only, provider-independent context projection | Restores deterministic Project value with one Core owner, reuses current domain/Asset projections, and leaves the provider-native runtime intact. | Chosen. |
| Restore the deleted `GenerationContext` and purpose modules wholesale | Restores familiar output but also revives provider model descriptors, schema-backed controls, model filtering, generic Specs/Runs concepts, and a loose untyped `facts` bag. | Rejected. |
| Put a purpose-to-command/reference recipe entirely in Media Producer | Requires every agent to reinterpret prose and independently query/filter relationships; Core cannot test or guarantee the result. | Rejected. |
| Add purpose/target/slots to Preview and Asset provenance | Would make context durable and visible but is unnecessary for deterministic pre-authoring context and conflicts with the accepted quiet flat References UI. | Rejected for this plan. |

## Public Contracts

### Core input and report

Add `packages/core/src/client/media-generation-context.ts` with these public
contracts. Nested domain values reuse current exported Core types; they are not
copied into parallel generation-specific records.

```ts
export interface ReadMediaGenerationContextInput {
  projectName?: string;
  homeDir?: string;
  purpose: MediaPurpose;
  target: MediaTarget;
  sceneStoryboardScope?: {
    sceneBeatsRevisionId?: string;
    beatIds: string[];
  };
}

export interface MediaGenerationContextReport {
  valid: true;
  project: MediaGenerationProjectContext;
  purpose: MediaPurpose;
  target: MediaTarget;
  outputMediaKind: MediaGenerationKind;
  workflowPolicy: GenerationWorkflowPolicy;
  outputGuidance: MediaGenerationOutputGuidance;
  targetContext: MediaGenerationTargetContext;
  visualLanguage: MediaGenerationLookbookContext[];
  suggestedReferences: MediaGenerationReferenceSuggestion[];
  warnings: DiagnosticIssue[];
  resourceKeys: string[];
}
```

`MediaGenerationProjectContext` contains exact current Project fields used by
generation: `projectName`, `id`, `projectFolder`, `title`, `aspectRatio`,
optional `logline`, `synopsis`, `premise`, `primaryGenre`, `secondaryGenres`,
`tones`, and `themes`, plus ordered current Project languages. It is built from
the existing Project Information and locale owners.

`sceneStoryboardScope` is accepted only for `scene.storyboard-sheet`. Empty
`beatIds` means every Beat in the exact resolved revision. If the revision id is
omitted, Core resolves the active Scene Beats revision. A non-Scene purpose,
foreign revision, or unknown Beat id is rejected because Core cannot truthfully
project that scope. Repeated ids and caller order carry no domain meaning: Core
deduplicates them and returns the selected Beats in canonical revision order.

### Typed target context

`MediaGenerationTargetContext` is a closed discriminated union:

```ts
export type MediaGenerationTargetContext =
  | { kind: 'project' }
  | { kind: 'asset'; asset: Asset }
  | MediaGenerationLookbookTargetContext
  | MediaGenerationCastTargetContext
  | MediaGenerationLocationTargetContext
  | MediaGenerationPropTargetContext
  | MediaGenerationSceneTargetContext
  | MediaGenerationShotTargetContext
  | MediaGenerationShotPlanTargetContext
  | MediaGenerationSceneDialogueTargetContext;
```

The variants contain these exact fields:

| Variant | Required fields |
| --- | --- |
| `lookbook` | `lookbook: Lookbook`, `selectedImageId`, all current `images: LookbookImage[]`, all current `sheets: LookbookSheet[]`, and current `sourceInspirationFolders` from the existing Lookbook resource. |
| `castMember` | `castMember: CastMember`, `activeDesign: CastDesignDocument \| null`, `activeDesignSummary`, exact screenplay `scenes`, and all current owner-scoped `assets: Asset[]`. |
| `location` | `location: Location`, `activeDesign: LocationDesignDocument \| null`, `activeDesignSummary`, exact screenplay `scenes`, and all current owner-scoped `assets`. |
| `prop` | `prop: Prop`, `activeDesign: PropDesignDocument \| null`, `activeDesignSummary`, exact screenplay `scenes`, and all current owner-scoped `assets`. |
| `scene` | `scene: Scene`, exact opaque `contextText`, resolved `sceneBeatsRevision: SceneBeatsRevision \| null`, canonical `selectedBeatIds`, ordered related `castMembers`, `locations`, `props`, and `dialogueTurns`. Related subject entries include their facts, active design, and current owner Assets. |
| `shot` | exact `shot: Shot`, containing `shotPlan: ShotPlan`, `coveredBeats`, and the complete `sceneContext` above. |
| `shotPlan` | exact `shotPlan: ShotPlan`, `coveredBeats`, and complete `sceneContext`. The plan's Shots retain their images and `selectedImageId` through the existing `ShotPlan` projection. |
| `sceneDialogue` | exact `scene`, `turn`, `plainText`, resolved speaker Cast Member or `null`, matching current Cast Voices/provider registrations, current setup, and prior audio Takes for that turn. |

The existing exported domain types remain the owners of their fields and
validation. The generation context module composes them; it does not create a
second Cast, Location, Prop, Lookbook, Scene Beats, Shot Plan, or dialogue model.

### Visual Language context

`MediaGenerationLookbookContext` contains:

```ts
interface MediaGenerationLookbookContext {
  kind: 'production' | 'storyboard';
  lookbook: Lookbook;
  selectedImageId: string | null;
  images: LookbookImage[];
  sheets: LookbookSheet[];
}
```

Purpose builders include only the relevant Lookbook kinds named in the matrix.
The complete Lookbook document is returned, not a lossy stringified summary.
Lookbook media is also projected into reference suggestions when it has a
concrete role. Text and media remain separate: prose can inform the prompt,
while an agent that wants the provider to see an image chooses an exact file
from the suggestions or another safe source.

### Output guidance

Provider-independent, app-owned purpose guidance is restored without model
descriptors or enforcement semantics:

```ts
interface MediaGenerationOutputGuidance {
  aspectRatio: { value: string; rationale: string } | null;
  quality: { value: 'medium' | 'high'; rationale: string } | null;
}
```

`project` aspect-ratio guidance is resolved to the current effective Project
ratio before returning the report. A selected provider Skill considers this
guidance when its exact native operation supports it, but may depart because of
user direction, creative judgment, provider constraints, or the needs of the
specific request. The report does not require a compatible route, demand an
override explanation, or reject the result. The context contains no provider/
model recommendation, field name, enum list, bounds, slider metadata, input
mode, or provider default.

| Purpose | Suggested aspect ratio | Suggested quality |
| --- | --- | --- |
| `image.create`, `image.edit`, `cast.voice-sample`, `scene.dialogue-audio`, all Shot Plan video purposes | none | none |
| `project.cover` | `16:9` | `medium` |
| `lookbook.image` | current Project ratio | `medium` |
| `lookbook.video-sheet`, `lookbook.storyboard-sheet` | `4:3` | `high` |
| `cast.character-sheet`, `location.sheet`, `prop.sheet` | `16:9` | `high` |
| `cast.profile` | `1:1` | `medium` |
| `location.hero`, `prop.hero` | `16:9` | `medium` |
| `scene.storyboard-sheet` | none | `high` |
| `shot.image` | current Project ratio | `high` |

### Reference roles and candidates

```ts
export type MediaGenerationReferenceRole =
  | 'source-image'
  | 'appearance'
  | 'continuity'
  | 'shot-image'
  | 'beat-storyboard'
  | 'first-frame'
  | 'last-frame'
  | 'video-storyboard'
  | 'video-reference'
  | 'dialogue-audio';

export interface MediaGenerationReferenceSuggestion {
  id: string;
  role: MediaGenerationReferenceRole;
  subject?: { kind: string; id: string };
  candidates: MediaGenerationReferenceCandidate[];
}

export interface MediaGenerationReferenceCandidate {
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
  owner: AssetOwner;
  assetType: string;
  fileRole: string;
  mediaKind: MediaGenerationKind;
  mimeType: string | null;
  title: string;
  oneLineSummary: string | null;
  referenceName: string | null;
  tags: string[];
  generationProvenance: MediaGenerationProvenance | null;
  authoredFrom: { kind: 'shotPlan'; id: string } | null;
  isDisplaySelected: boolean;
  available: boolean;
}
```

Suggestion identity is the tuple `id + subject`; repeated subject roles
therefore do not need dynamic ids. Relationship derivation uses only current
explicit domain facts: Asset membership owner, Asset type, file media kind/role,
Asset lifecycle/discard state, exact Lookbook sheet membership, exact dialogue
Take link, exact Shot selection, exact Beat ownership, or exact `authoredFrom`
Shot Plan id.
`tags`, titles, summaries, reference names, filenames, prompt text, and pixels
are returned as context but never determine relationship membership.

The Core suggestion projector resolves the registered Project-relative file
safely. A missing or escaped file remains represented with `available: false`
and a warning so the stale registration is visible. This does not stop the
agent from proceeding with other context or from using another safe file.

### Purpose context and reference matrix

| Purpose | Deterministic target/domain context | Related reference suggestions |
| --- | --- | --- |
| `image.create` | Project story facts, policy. No attempt to dump all Project subjects/media because the purpose has no narrower domain relationship. | None; user-named Project files remain Additional References. |
| `image.edit` | Exact source Asset and every current file. | The exact target Asset's image files described with the `source-image` role. The agent may add or replace creative inputs while the target identity remains factual. |
| `project.cover` | Project story facts and complete Production Lookbook context. | Production Lookbook Sheets and selected/current Production Lookbook images described as appearance sources. No Cast/Location/Prop enumeration until the user names a subject. |
| `lookbook.image` | Exact target Lookbook definition, placements, source inspirations, selected image, existing images/sheets, Project facts. | Same-Lookbook accepted images as style anchors and same-kind Lookbook Sheets as continuity sources. |
| `lookbook.video-sheet` | Exact Production Lookbook and Project facts. | Target-Lookbook images as appearance sources and existing Production Sheets as continuity. Target kind mismatch is a query-identity error. |
| `lookbook.storyboard-sheet` | Exact Storyboard Lookbook and Project facts. | Target-Lookbook images as appearance sources and existing Storyboard Sheets as continuity. Target kind mismatch is a query-identity error. |
| `cast.character-sheet` | Exact Cast facts, active Cast Design, appearances, owner Assets, Project facts, complete Production and Storyboard Lookbooks. | Production and Storyboard appearance sources plus same-Cast Character Sheets as continuity. Both appearance alternatives are returned because production-versus-storyboard rendering remains user/agent intent. |
| `cast.profile` | Exact Cast facts/design/appearances/assets, voice-over status, Project facts, Production Lookbook context. | Same-Cast Character Sheets as continuity sources; an empty group remains informative for a first sheet or voice-over symbolic imagery. |
| `cast.voice-sample` | Exact Cast facts/design voice guidance, Project language, current Cast Voices/provider registrations, and current sample Assets. | No relationship-derived media suggestion. Voice registration/identity is structured target context rather than a media-reference guess. |
| `scene.dialogue-audio` | Exact Scene and dialogue turn, opaque spoken text, speaker relationship, Cast facts, registered voices, current setup and prior Takes, Project language/policy. | No relationship-derived media suggestion; exact Cast Voice choices are structured context. |
| `location.sheet` | Exact Location facts, active Location Design, appearances, owner Assets, Project facts, complete Production and Storyboard Lookbooks. | Production and Storyboard appearance sources plus same-Location Sheets as continuity. |
| `location.hero` | Exact Location facts/design/appearances/assets, Project facts, Production Lookbook context. | Same-Location Sheets as source/continuity context. |
| `prop.sheet` | Exact Prop facts, active Prop Design, appearances, owner Assets, Project facts, complete Production and Storyboard Lookbooks. | Production and Storyboard appearance sources plus same-Prop Sheets as continuity. |
| `prop.hero` | Exact Prop facts/design/appearances/assets, Project facts, Production Lookbook context. | Same-Prop Sheets as source/continuity context. |
| `scene.storyboard-sheet` | Exact Scene text; resolved Scene Beats revision and ordered selected Beat batch when present; Beat/Scene-related Cast, Locations, Props, dialogue turns; active designs/assets; complete Storyboard Lookbook when present. | Storyboard Lookbook Sheets as appearance sources; exact Character/Location/Prop continuity per related visual subject; prior selected Beat Storyboards as continuity. Voice-over-only Cast Members do not appear as visually related subjects. Missing groups remain empty and informational. |
| `shot.image` | Exact Shot, containing Plan, coverage/covered Beats, complete Scene context, related subject designs/assets, Production Lookbook when present. | Production Lookbook appearance, Character/Location/Prop continuity, covered Beat Storyboards, and selected sibling Shot images. Missing groups remain empty and informational. |
| `shot-plan.video-first-frame` | Exact Plan/Shots/coverage/Scene/subjects plus Production Lookbook when present. | Appearance, Character/Location/Prop continuity, covered Beat Storyboards, and selected Shot images. |
| `shot-plan.video-last-frame` | Same complete Plan context. | Same related media as first frame plus a same-Plan first-frame source when present. |
| `shot-plan.video-storyboard` | Same complete Plan context. | Appearance and subject continuity, covered Beat Storyboards, selected Shot images, and same-Plan prior video storyboards. |
| `shot-plan.video-reference` | Same complete Plan context. | Appearance and subject continuity, covered Beat Storyboards, selected Shot images, and same-Plan prior video references. |
| `shot-plan.video-generation` | Exact Plan/Shots/coverage/Scene/subjects, Production Lookbook when present, dialogue turns/Takes, and all same-plan auxiliary Assets. | First frame, last frame, video storyboard, video reference, Character/Location/Prop continuity, selected Shot images, covered Beat Storyboards, Production appearance, and exact dialogue audio. The agent chooses any combination supported by the selected native operation and may use other creatively relevant sources. |

## Structured Diagnostics

Add these Core codes through `@gorenku/studio-diagnostics`-compatible
`ProjectDataError` boundaries:

- `CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND`: the exact target does not
  exist or is discarded;
- `CORE_MEDIA_GENERATION_CONTEXT_SCOPE_INVALID`: Scene Storyboard revision/
  Beat scope names a foreign revision or an unknown Beat;
- `CORE_MEDIA_GENERATION_CONTEXT_GAP`: a normally useful related source such as
  an active Scene Beats revision, Lookbook, design, or media group is absent;
  returned as an informational warning and never as generation authorization;
- `CORE_MEDIA_GENERATION_CONTEXT_REFERENCE_FILE_UNAVAILABLE`: a registered
  suggested file is missing, unsafe, outside the Project, or has unsupported
  media metadata; returned with the exact suggestion location.

Reuse current `CORE_GENERATION_TARGET_INVALID` for a purpose/target-kind or
Lookbook-kind mismatch because the surviving attachment boundary already owns
that stable invariant. Reuse current CLI codes `CLI024` and `CLI147` for purpose
and target parsing. CLI flag-shape errors use the existing structured command
helpers; CLI does not invent semantic duplicates of Core diagnostics.

Do not create a severity taxonomy for creative adequacy. Empty related-media
groups are valid; use `CORE_MEDIA_GENERATION_CONTEXT_GAP` only when naming the
missing source materially helps the agent understand the briefing. Do not add
diagnostics that recognize the deleted Generation Context/Spec shape.

## Architecture Shape Gate

### Owning package and public entrypoints

`packages/core` owns purpose/target/domain projection and the derivation of
relationship-based suggestions. It does not own creative-reference permission.

- Browser-safe types live in
  `packages/core/src/client/media-generation-context.ts` and are exported from
  the existing thin client package entrypoint.
- The one server entrypoint is
  `readMediaGenerationContext(input): Promise<MediaGenerationContextReport>`
  from `packages/core/src/server/media-generation-context/index.ts`.
- `ProjectDataService.readMediaGenerationContext` exposes that entrypoint to
  CLI and future adapters.
- `renku generation context` is the only new CLI command. It parses flags,
  calls Core once, and serializes the report.
- No Studio server route or React service/component is added in this plan.

### Intended Core module layout

```text
packages/core/src/server/media-generation-context/
  index.ts                       thin public module entrypoint
  context.ts                     validates identity, composes common report
  purpose-registry.ts            bounded MediaPurpose -> purpose builder map
  project-context.ts             Project story/locale/workflow projection
  visual-language-context.ts     complete Production/Storyboard Lookbook reads
  scene-context.ts               Scene/revision/Beat/subject/dialogue composition
  reference-suggestions.ts       exact related AssetFiles and availability
  purposes/
    project.ts                   image.create and project.cover
    asset.ts                     image.edit
    lookbook.ts                  lookbook image and sheet purposes
    cast.ts                      Character Sheet/Profile/Voice Sample
    location.ts                  Location Sheet/Hero
    prop.ts                      Prop Sheet/Hero
    scene.ts                     Scene Storyboard
    shot.ts                      Shot image
    shot-plan.ts                 five Shot Plan video purposes
    scene-dialogue.ts            exact dialogue audio context
```

`index.ts` contains exports only. `context.ts` may coordinate common Project
facts, workflow policy, builder lookup, warnings, and final serialization; it
must not contain purpose branches. `purpose-registry.ts` contains the typed map
and completeness check only; it must not query SQLite or build DTOs. Domain
branches live in the matching `purposes/*` module and reuse the shared Project,
Scene, Visual Language, and suggestion projectors.

### Existing owners reused or changed

- `packages/core/src/client/media-attachments.ts` remains the sole public owner
  of `MediaPurpose`, `MediaTarget`, and purpose-to-target identity. Add the
  exact purpose-to-output-media-kind map beside the target-kind map; do not
  duplicate either map in the context registry.
- Existing Project Information, locale, Lookbook resource, Cast/Location/Prop
  design, Screenplay/Scene, Scene Beats, Shot Plan, Asset, selected-Asset,
  dialogue workspace, and Project Settings readers remain the data owners.
- `packages/core/src/server/resources/project-lookbooks.ts` may expose a focused
  session-level Lookbook projection used by its current resource and the new
  context module. Do not make the generation module reconstruct Lookbook
  records independently.
- `readCastContext`, `readLocationContext`, and `readPropContext` consume the
  shared Production Lookbook projector instead of maintaining their current
  `null` placeholders.
- `readSceneBeatsContext` consumes the shared Scene/reference projectors for
  `includeVisualReferences`; it does not call the public generation context
  command recursively and does not duplicate purpose rules.
- `packages/core/src/server/generation/*` remains focused attachment code. Do
  not put new read context beside attachment persistence merely because the
  old deleted modules used that folder.

### CLI layout

```text
packages/cli/src/commands/
  media-purpose.ts               shared purpose/target flag parser
  generation/
    command.ts                   thin registry and command help
    context.ts                   parse scope, delegate once, return report
    validate.ts
    preview.ts
    execute.ts
    recover.ts
```

Rename the inaccurately named
`generation-purpose-command-registry.ts` directly to `media-purpose.ts` and
update Media Import plus generation context imports. Add no re-export or alias.
The generation command handler list remains a small bounded command registry;
it does not branch on purpose.

### Sister Skill ownership

`studio-skills/skills/media-producer/SKILL.md` owns the mandatory ordering:
context first, then creative selection, then provider handoff. Purpose craft
guides explain how to use returned roles and inspect exact media, but they no
longer own relationship discovery or purpose settings and do not claim missing
Core fields. They retain creative judgment over whether to use, supplement, or
depart from the suggestions.

Provider Skills receive an already chosen set of exact Project-relative files
and map them to native fields. They do not query Cast, Location, Prop, Lookbook,
Scene, Shot, or Shot Plan state. Their supported-model guidance remains limited
to model identity/name and input modes. They obtain current request fields and
constraints from the provider instead of copying them into another Skill,
Core, Studio, or temporary presentation definition.

### Explicitly forbidden code shape

- no restoration of the old `GenerationContext`, `GenerationPurposeDescriptor`,
  `GenerationSpec`, `GenerationRun`, model-descriptor, provider-field, pricing,
  estimate, approval, freeze, or simulation modules;
- no provider/model ids, provider native fields, schema interpretation, model
  switches, or request transforms in Core purpose builders;
- no model-selection/setup dialog, setup document, model-option DTO, rich
  control descriptor, transient form schema, provider metadata normalizer for
  Studio, or live provider-schema fetch from React/Core;
- no copied provider enums, defaults, numeric bounds, descriptions, or
  capability summaries in Skill indexes or review documents;
- no purpose/target/context fields added to the review/provenance envelope;
- no React/HTTP/CLI-local reconstruction of Project relationships;
- no one-file switch covering all purposes and querying every domain;
- no `facts: Record<string, JsonValue>` escape hatch in the new public report;
- no inference from filenames, paths, tags, titles, summaries, prompt text,
  provenance prompt contents, or media pixels;
- no automatic reference choice, canonical-selection reuse, first-candidate
  fallback, reference allowlist, or creative-readiness gate;
- no context database table, migration, snapshot, cache, hash, stale-state
  service, or compatibility reader; and
- no source-text architecture test listing private builder/helper names.

### Stop conditions

Stop and revise the implementation before continuing if:

- `context.ts` gains any purpose-specific branch;
- `purpose-registry.ts` starts querying Project data or mapping provider fields;
- a purpose module fetches provider metadata or authors prompt/request JSON;
- another layer reconstructs factual Project relationships instead of consuming
  Core context;
- the new context DTO duplicates a complete existing domain type rather than
  embedding it;
- Scene relationship logic is copied separately into Scene Storyboard, Shot,
  and Shot Plan builders instead of sharing `scene-context.ts`;
- department/Scene Beats context repairs implement another lookbook/reference
  rule rather than consuming the shared projector;
- any `index.ts` contains business logic; or
- a checklist item can pass only by accepting a broad dispatcher or god file.

## Implementation Slices

### 1. Record the corrected decision and lock the public identity maps

- Add Decision 0087 with the exact ownership split in this plan.
- Add concise notices to Decisions 0025, 0047, 0049, 0051, 0069, 0080, and 0086
  without rewriting their historical bodies.
- Add `MEDIA_PURPOSE_OUTPUT_MEDIA_KINDS` beside the surviving target-kind map in
  `media-attachments.ts` and cover both public maps with one completeness test.
- Add the browser-safe context DTOs and exact diagnostic codes.

### 2. Build shared current Project/domain projectors

- Implement Project story/locale/workflow projection from current owners.
- Extract/reuse a session-level complete Lookbook resource projection.
- Implement exact current AssetFile suggestion projection with owner/type/
  authored-from filters, selection facts, stable ordering, and safe file
  availability.
- Implement one Scene context projector that resolves canonical screenplay
  text, Scene references, exact revision/Beat scope, related subject facts and
  designs, dialogue turns, and voice-over visual exclusion.
- Reuse existing Shot Plan coverage and dialogue workspace projections rather
  than reproducing their validation.

### 3. Implement bounded purpose builders

- Add the nine domain-grouped purpose modules in the Architecture Shape Gate.
- Encode the exact output guidance and reference-role matrix above.
- Make the registry exhaustive over the public `MediaPurpose` map and free of
  query/build logic.
- Compose informational context/file warnings without judging creative
  readiness or validating prompt/media contents.
- Add `readMediaGenerationContext` to ProjectDataService and its generation
  wiring.

### 4. Restore the CLI context command

- Add `generation context` to the existing generation command registry.
- Parse `--purpose`, `--target`, optional `--revision`, and repeatable `--beat`.
- Rename the shared purpose/target parser directly and update Media Import.
- Update root help, examples, repeated-flag validation, and unknown-command
  suggestions.
- Keep the handler one-delegation thin and emit no resource-change event for a
  read.

### 5. Repair existing context projections through shared owners

- Populate the Production Lookbook context in Cast, Location, and Prop context
  reports using the shared Lookbook projection.
- Replace `SceneBeatsContextReport.visualReferences?: { note: string }` with
  actual visual-language and subject reference suggestions when
  `includeVisualReferences` is requested.
- Keep the default Scene Beats context lightweight when that flag is absent.
- Update DTOs and focused callers directly; add no old note field or fallback.

### 6. Make Media Producer consume Core context

- Update the Media Producer main workflow so `generation context` supplies the
  first briefing for every purpose, while stating that its suggestions are
  non-exhaustive and non-binding.
- Replace the broad prose-only purpose routing with a complete purpose-to-guide
  index that tells the agent which craft guide to read after Core returns the
  context.
- Rewrite each purpose guide to consume `targetContext`, `visualLanguage`,
  `outputGuidance`, `workflowPolicy`, `suggestedReferences`, and `warnings`
  rather than claim it can discover or reconstruct those values.
- Update Scene Storyboard to rerun context with exact revision/Beat batch and
  begin from the returned related subjects and suggestions without treating
  them as the only creative sources it may use.
- Update Shot Image and Shot Plan video handoffs to use the exact target and
  complete returned context; remove stale `--authored-from-shot-plan` and
  Project-target instructions.
- Update Cast/Production Design/Movie Director/Shot Planner handoff references
  that mention the deleted or incomplete context contract.
- Keep provider Skills provider-only: exact request mapping, validation, and
  execution after Media Producer makes request-scoped choices.

### 7. Update current docs and remove stale claims

- Update current architecture, compact reference, CLI commands, frontend
  boundary, and Studio Skills references.
- Update the sister Skills README's obsolete Spec/model-descriptor/estimate/run
  description.
- Mark Plan 0190's product Skill adoption as dependent on Plan 0191 without
  changing its standalone Engines protocol design.
- Search current docs/Skills for stale claims that context is absent, purpose
  guides own relationship discovery, suggestions form an allowlist, Shot Plan
  media targets Project, or context still returns provider model descriptors.

## Tests And Guardrails

### Core owning-layer behavior

- Public purpose identity tests prove every `MediaPurpose` has exactly one
  target kind and output media kind, and every purpose resolves through the
  context registry.
- Target tests cover correct resolution, wrong target kind, missing/discarded
  target, wrong Lookbook kind, and exact dialogue-turn resolution.
- Project tests cover effective aspect ratio, story fields, ordered languages,
  and exact image/video/audio workflow policy.
- Output-guidance tests cover the complete advisory matrix without asserting
  private builder names or enforcement.
- Cast/Location/Prop tests prove exact facts, active design, screenplay
  appearances, complete owner Assets, Production/Storyboard Lookbook context,
  same-owner relationship filtering, no default selection, and voice-over
  behavior.
- Lookbook tests prove complete definitions/images/sheets/source inspirations,
  exact kind checks, same-Lookbook relationship filtering, and selected-image
  facts without request selection.
- Scene tests cover screenplay-reference plus Beat relationship composition,
  canonical first-appearance ordering, exact revision/Beat scoping, Props,
  voice-over visual exclusion, dialogue-turn filtering, and unrelated-subject
  exclusion.
- Scene Storyboard tests prove Storyboard appearance and subject-scoped
  Character/Location/Prop suggestions, selected prior Beat images, informative
  gaps, continued readability with missing creative context, and no prompt/media
  interpretation.
- Shot tests prove containing Plan/Scene/covered Beats, Props, Production
  appearance, selected/sibling Shot images, and Beat Storyboards.
- Shot Plan tests cover all five purpose variants, same-plan `authoredFrom`
  filtering, auxiliary role separation, selected Shot images, covered Beat
  Storyboards, dialogue audio, subject continuity, stale weak context, and no
  reverse ownership.
- AssetFile tests cover missing file, traversal/symlink escape, unsupported media
  metadata, multi-file Assets, deterministic order, and visible unavailable
  candidates.
- Advisory-context tests prove empty suggestion groups and missing Lookbooks/
  designs/active revisions do not authorize or prevent generation.
- Existing department and Scene Beats context tests prove Production Lookbook
  and requested visual references are actual data, not null/note placeholders.

### CLI adapter tests

- Registry tests prove `generation context` is available beside validate,
  Preview, execute, and recover.
- Handler tests prove exact flag parsing, one Core delegation, JSON
  serialization, no provider call, and no resource-change event.
- Scope tests cover repeated `--beat` deduplication/canonical ordering, omitted
  revision/active resolution, invalid scope translation, and rejection of scope
  flags for other purposes because those flags cannot describe those target
  projections.
- One CLI integration builds a Scene with Cast, Location, Prop, Storyboard
  Lookbook Sheet, same-owner continuity media, and an unrelated Asset, then
  proves the output contains only the exact related context.
- One Shot Plan integration proves current Plan-target parsing and same-plan
  auxiliary candidates.

### Architecture guardrails

- Core architecture tests protect that context imports no Engines package,
  provider SDK/client, provider catalog/schema, Studio, or CLI module.
- CLI import tests protect that generation context and Media Import use Core
  contracts and do not import database/query modules.
- Studio architecture tests remain unchanged and continue to prohibit server/
  database/provider imports in React.
- Public contract tests prove review/provenance shapes did not gain purpose,
  target, suggestion, candidate, or context fields.
- Database/schema tests prove no migration or context persistence was added.
- Capability scans protect the absence of Spec/Run/estimate/approval/freeze/
  simulation APIs without freezing private implementation names.
- Complexity/shape review inspects every purpose module and the registry; do not
  add source-text tests that enumerate private functions.

### Skill tests and evals

- Extend `validate-media-generation-skills.mjs` to require `generation context`
  in Media Producer and a complete purpose guide index.
- Add forward evals proving Media Producer does not start provider selection or
  authoring before context.
- Add model-choice evals proving the agent uses only the provider Skill's
  supported identity/name/input-mode guidance, reads current operation facts
  from the selected provider, and does not author a setup document or invoke a
  Studio model picker.
- Add Scene Storyboard evals with several Cast/Location/Prop Assets proving it
  understands the returned exact subject relationships and Beat scope without
  treating the suggested media as an allowlist.
- Add Shot Image and Shot Plan video evals proving Production appearance,
  subject continuity, Beat/Shot imagery, auxiliary roles, and dialogue audio are
  used deliberately rather than rediscovered.
- Add evals for missing context, unrelated same-media Assets, a sole suggestion,
  unavailable files, a user-supplied outside reference, a reasoned decision to
  ignore a suggestion, and provider limitations that justify departing from
  output guidance.
- Keep visual/media quality evaluation agent-owned; no runtime test parses
  prompts or inspects pixels for semantic correctness.

## Documentation And ADR Effects

Add:

- `docs/decisions/0087-use-core-owned-deterministic-media-generation-context.md`.

The decision states:

- **Context is evidence, not permission:** Core reports what Renku knows and
  suggests related media, but context never becomes an allowlist, creative
  validator, readiness gate, or generation authorization;
- Core owns purpose/target context, deterministic domain relationships,
  advisory output guidance, related-media roles, and current workflow policy;
- Media Producer owns request-scoped choice and creative prompt synthesis and
  may ignore, supplement, or replace Core suggestions;
- provider Skills own supported-model identity/name/input-mode guidance and
  native request authoring from current provider facts; model/input choice is
  agent/user-owned and conversational, with no Studio picker;
- Engines own provider validation/execution; and
- Preview/provenance remain exact request views without persisted context.

Add concise notices near the top of:

- Decision 0025: the old shared lifecycle remains superseded, but a new bounded
  read-only purpose context registry is accepted by 0087;
- Decision 0047: context-first now means Core-projected domain context followed
  by Skill-authored provider-native requests;
- Decisions 0049 and 0051: request-scoped choice remains agent/user-owned, while
  non-persisted typed relationship suggestions are restored for deterministic
  context without limiting other choices;
- Decision 0069: weak Shot Plan context is projected directly from a Shot Plan
  target and current related media;
- Decision 0080: Storyboard Lookbook appearance authority is delivered through
  Core context; and
- Decision 0086: only provider/native request responsibilities moved to Skills;
  Project relationship discovery did not.

Update current documents:

- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/layers-of-responsibility.md`;
- `docs/architecture/core-design-principles.md`;
- `docs/architecture/frontend.md` only where its already-stated context boundary
  needs the concrete command/contract;
- `docs/architecture/reference/studio-skills.md`;
- `docs/cli/commands.md`; and
- current product workflow language that assigns reference discovery to Skills.

Add an explicit principle to `docs/architecture/core-design-principles.md`:
deterministic context informs agents but does not constrain creative decisions.
Any hard rejection must trace to a separate integrity, security, authorization,
or provider-contract invariant owned by the operation that needs it; missing or
unused creative context is not such an invariant.

Do not edit Plan 0189. Do not rewrite the historical bodies of old ADRs. Do not
edit completed/historical plans merely to replace old names.

## Final Verification

Run focused verification first:

```bash
pnpm --dir packages/core test
pnpm --dir packages/cli test
pnpm --dir packages/studio test
pnpm --dir /Users/keremk/Projects/aitinkerbox/studio-skills test:media-generation
```

Run representative read-only CLI checks against Urban Basilica:

```bash
renku generation context --purpose cast.character-sheet --target cast:cast_pccfdknw --json
renku generation context --purpose scene.storyboard-sheet --target scene:scene_zp6ysnpy --revision <active-revision-id> --json
renku generation context --purpose shot.image --target shot:<scene-02-shot-id> --json
renku generation context --purpose shot-plan.video-generation --target shot-plan:shot_plan_37a3r9yz --json
```

Inspect those reports to confirm:

- Constantine context contains exact Cast Design/appearances/assets and both
  relevant Lookbook roles;
- Scene 02 includes Constantine, Loukas, Urban, and the Imperial Council
  Chamber, omits Narrator from visual relationship suggestions, and contains no
  unrelated subject media in those suggestions;
- Shot context includes its Plan, Scene, Props when related, covered Beats,
  Production appearance, and exact current imagery; and
- Shot Plan video context separates first frame, last frame, Shot image, Beat
  Storyboard, continuity, appearance, and dialogue roles and filters auxiliary
  media to the exact Plan.

Then run repository-wide verification:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Manual checks:

1. Execute a dry agent walkthrough for one Cast Character Sheet, one Scene
   Storyboard Beat batch, one Shot image, and one Shot Plan video without making
   a paid generation call.
2. Confirm each workflow begins with the Core context command and needs no
   separate discovery loop for Project relationships.
3. Exercise one generation walkthrough that ignores a suggested reference and
   one that adds a user-supplied reference. Confirm both can continue and the
   agent still distinguishes those choices from factual Project relationships.
4. Open an existing Preview and generated-Asset Inspection in desktop Chrome.
   Confirm the prior shared dialog remains pixel-identical: Prompt margins,
   rich read-only Configuration controls, flat `MediaCard` References, no
   filenames, no slot labels, and no new context UI.
5. Confirm ordinary provider validate/execute/recover and external Media Import
   still work without a context payload in the request/provenance envelope.
6. Inspect `git diff --stat`, the complete diff in both repositories, and every
   new/large context module. Confirm `index.ts` files are thin, the registry has
   no domain logic, shared Scene/reference projection is not copied into purpose
   files, and no provider/schema/lifecycle machinery returned.

## Completion Checklist

### Review Area

- [x] Confirm every requirement in R1-R13 has an implementation owner, test,
      documentation effect, and completed checklist item.
- [x] Confirm Plan 0189 was not reopened or edited.
- [x] Confirm Plan 0190's provider protocol seam remains unchanged and its Skill
      adoption recognizes Plan 0191 as a prerequisite.
- [x] Confirm no adjacent Settings, credential, provider, paid-generation,
      provenance, or Studio UI behavior was added.
- [x] Confirm the implementation preserves accepted architecture boundaries.
- [x] Confirm centralized Core ownership did not become a monolithic
      implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, or god file was added.

### Architecture And Public Contracts

- [x] Add `MediaGenerationContextReport` and every named nested public type with
      the exact fields and closed unions in this plan.
- [x] Keep `MediaPurpose`/`MediaTarget` in their current Core client owner.
- [x] Add one exhaustive purpose-to-output-media-kind map beside the target map.
- [x] Add `ReadMediaGenerationContextInput` and the exact Scene Storyboard scope.
- [x] Add `ProjectDataService.readMediaGenerationContext` and one thin server
      entrypoint.
- [x] Implement the bounded purpose registry without query/build/provider logic.
- [x] Keep the review/provenance envelope byte-for-byte unchanged in shape.
- [x] Add the exact structured Core diagnostics and reuse current CLI/target
      diagnostics where specified.
- [x] Keep durable business rules in Core and provider-native rules in Engines/
      provider Skills.
- [x] Keep context advisory: add no creative allowlist, readiness gate,
      generation authorization, or requirement to justify a departure.
- [x] Add no database schema, migration, context snapshot, hash, cache, or
      lifecycle state.
- [x] Add no compatibility alias, old context reader, re-export stub, or fallback.

### Shared Core Projections

- [x] Project exact story metadata, effective aspect ratio, languages, and
      current per-media workflow policy.
- [x] Reuse/extract one complete session-level Production/Storyboard Lookbook
      projection.
- [x] Reuse current Cast, Location, Prop, design, Screenplay, Scene Beats, Shot
      Plan, Asset, selection, and dialogue owners instead of duplicating models.
- [x] Implement one shared Scene/revision/Beat/subject/dialogue context projector.
- [x] Combine Scene-level and exact selected-Beat relationships in canonical
      order and omit voice-over-only Cast from visual relationship suggestions.
- [x] Implement exact AssetFile relationship derivation from owner/type/
      authored-from relationships only, without treating the result as
      exhaustive.
- [x] Preserve candidate metadata, display-selection fact, provenance, and file
      availability without choosing a generation selection.
- [x] Implement deterministic suggestion/candidate ordering with no priority
      or permission semantics.
- [x] Return informative context/file warnings without creative-readiness state.

### Purpose Builders

- [x] Implement Project and source-Asset purpose contexts.
- [x] Implement Lookbook image/video-sheet/storyboard-sheet contexts and exact
      kind validation.
- [x] Implement Cast Character Sheet/Profile/Voice Sample contexts.
- [x] Implement Location Sheet/Hero contexts.
- [x] Implement Prop Sheet/Hero contexts.
- [x] Implement Scene Storyboard exact revision/Beat batch context.
- [x] Implement Shot Image context with Plan/Scene/Props/covered Beats and
      Production appearance.
- [x] Implement all five Shot Plan video contexts with distinct same-plan,
      Shot/Beat, subject, appearance, and dialogue roles.
- [x] Implement exact Scene Dialogue Audio turn/speaker/voice/prior-Take context.
- [x] Apply the complete output-guidance matrix without provider/model fields.
- [x] Apply the complete advisory reference-role matrix without prompt/media
      inspection or creative enforcement.

### CLI

- [x] Add `renku generation context` with purpose, target, revision, and
      repeatable Beat flags.
- [x] Rename the shared purpose/target parser directly to `media-purpose.ts` and
      update all callers without an alias.
- [x] Keep the context handler to parse/delegate/serialize responsibilities.
- [x] Update command help, examples, unknown-command suggestions, and repeated
      flag handling.
- [x] Emit no mutation/resource event for context reads.

### Existing Context Surfaces

- [x] Populate Production Lookbook context in Cast context reports.
- [x] Populate Production Lookbook context in Location context reports.
- [x] Populate Production Lookbook context in Prop context reports.
- [x] Replace the Scene Beats visual-reference note with actual shared
      visual-language and subject suggestion data when requested.
- [x] Keep default Scene Beats context free of the optional heavy visual payload.
- [x] Delete the obsolete note-only DTO shape directly.

### Skills And Agent Workflow

- [x] Make `generation context` the first Media Producer briefing while making
      its suggestions explicitly non-binding and non-exhaustive.
- [x] Add a complete purpose-to-craft-guide index.
- [x] Update every current purpose guide to consume the typed context fields.
- [x] Remove ad hoc relationship/candidate discovery and stale context/model
      claims from Media Producer.
- [x] Keep model/input-mode choice conversational: add no Studio selector,
      setup document, model-option DTO, control descriptor, or provider
      presentation schema.
- [x] Keep provider Skill model guidance to identity/name/input modes and read
      the selected operation's current request facts from the provider rather
      than duplicating controls, enums, defaults, or bounds.
- [x] Teach Media Producer that it may ignore, supplement, or replace suggested
      references using user direction, creative judgment, or provider needs.
- [x] Update Scene Storyboard to request exact revision/Beat batch context.
- [x] Update Shot Image to receive and consider Production appearance and
      complete subject context without making either mandatory.
- [x] Update Shot Plan handoffs to target `shot-plan:<id>` and remove stale
      `--authored-from-shot-plan`/Project-target instructions.
- [x] Update Cast, Production Design, Movie Director, and Shot Planner handoffs.
- [x] Keep provider Skills free of Project relationship discovery.
- [x] Update the sister Skills README and validation script.

### Tests And Guardrails

- [x] Cover public purpose/target/output identity exhaustively at Core runtime.
- [x] Cover every output-guidance row.
- [x] Cover target resolution and exact Scene Storyboard scope failures.
- [x] Cover Project, Lookbook, Cast, Location, Prop, Scene, Shot, Shot Plan, and
      dialogue target contexts at the owning layer.
- [x] Cover same-owner, same-Lookbook, same-Beat, same-Shot, and same-Plan
      relationship derivation and unrelated-Asset non-membership.
- [x] Cover missing creative context as information and unsafe files as warnings,
      with no context-owned generation blocker.
- [x] Cover one-candidate-without-selection and display-selection separation.
- [x] Cover legitimate use of an unrelated or user-supplied reference and a
      reasoned decision to ignore a Core suggestion.
- [x] Cover restored department Lookbook and Scene Beats visual context.
- [x] Add thin CLI delegation, flag, JSON, and representative integration tests.
- [x] Add import/capability guardrails that prohibit Engines/provider/schema/
      lifecycle dependencies in Core context.
- [x] Prove review/provenance public shapes and Preview UI remain unchanged.
- [x] Add Skill validation and focused positive/negative forward evals.
- [x] Keep complete edge-case matrices at Core; do not duplicate them in CLI or
      Skills tests.
- [x] Add no architecture source-text needles for private names or inventories.

### Documentation And ADRs

- [x] Add Decision 0087 with the accepted ownership split.
- [x] Add concise discoverability notices to Decisions 0025, 0047, 0049, 0051,
      0069, 0080, and 0086 without rewriting history.
- [x] Update current media-generation architecture and compact reference docs.
- [x] Update layers, Core principles, frontend boundary, Studio Skills, and CLI
      command docs.
- [x] State “context is evidence, not permission” explicitly in Core design
      principles and Decision 0087.
- [x] Update current product workflow language where it assigns discovery to
      Skills.
- [x] Update sister Skill docs/samples/evals and remove stale command claims.
- [x] Do not edit historical/completed plans merely for a naming sweep.

### Final Verification

- [x] Run focused Core, CLI, Studio, and sister Skill tests.
- [x] Run the four representative Urban Basilica context commands read-only.
- [x] Inspect the returned Scene 02, Cast, Shot, and Shot Plan relationship/
      suggestion sets against the real Project database and files.
- [x] Run dry agent walkthroughs for Cast Sheet, Scene Storyboard, Shot Image,
      and Shot Plan Video without paid generation.
- [x] Verify existing Preview and Inspection desktop surfaces have no visual or
      contract regression.
- [x] Run `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check`.
- [x] Review `git diff --stat` and complete diffs in Studio and Studio Skills.
- [x] Inspect every new or heavily modified context module for size,
      responsibility, and duplicated relationship logic.
- [x] Confirm `index.ts` files remain thin entrypoints.
- [x] Confirm no new provider schema, model catalog, provider field mapping,
      Spec/Run, estimate, approval, freeze, simulation, persistence, or UI
      machinery exists.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [x] Only then mark Plan 0191 complete.
