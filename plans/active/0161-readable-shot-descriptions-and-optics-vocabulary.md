# 0161 Readable Shot Descriptions And Optics Vocabulary

Status: proposed
Date: 2026-07-28

## Summary

The current Shot detail proves that the data exists but is not yet shaped for a
director to read quickly:

- `Shot.description` is one dense paragraph even though the field already
  supports exact opaque Markdown;
- Cast Members and Locations appear as ordinary names instead of the
  screenplay's existing `@handle` references;
- Markdown headings are available, but the Shot-writing skill does not ask for
  a compact section structure;
- Markdown strong text is not given the Shot-specific amber emphasis needed to
  make authored camera choices scannable;
- the Optics card renders `focalLengthMm: 24` as `Lens 24 mm` and the arbitrary
  string `depthOfField: "Deep"` as `Depth Deep`;
- Optics focus targets and Lighting intent repeat Cast names as undifferentiated
  prose.

The smallest useful response is to extend the owners that already exist:

1. keep `Shot.description` as one exact opaque Markdown string;
2. teach `shot-planner` to author a small set of optional Markdown sections,
   canonical `@handle` references, and bold Markdown around material
   cinematography terms;
3. reuse the Scene narrative resource's existing Cast/Location handle and label
   maps to present known Shot mentions without another Core report, route, or
   fetch;
4. align known Shot mentions with Generation Preview's established mint `@`
   mention language while keeping screenplay entities and request-scoped media
   references as separate feature contracts;
5. add Shot-specific presentation extensions to the existing read-only
   CodeMirror surface;
6. narrow only `ShotBrief.optics.depthOfField` to a deliberate two-value
   vocabulary and give every Optics chip complete director-facing copy;
7. update the real `urban-basilica` Shot through the existing focused CLI before
   enabling the stricter Core validator.

This plan does not add a rich-document schema, a second description field,
browser authoring, prompt generation, runtime prose interpretation, or a
database migration.

## Requirement Ledger

| Id | Accepted requirement | Source | Product behavior | Owner and verification |
| --- | --- | --- | --- | --- |
| R1 | A Shot description must be easy for a director to scan instead of being one dense paragraph. | User request and supplied Description screenshot | Agent-authored Markdown uses a small set of relevant `##` sections with blank-line separation. | `studio-skills/skills/shot-planner/references/shot-writing-guidelines.md`; real-project desktop inspection and skill eval |
| R2 | Cast Members and Locations in descriptions should use `@` mentions. | User request | The skill writes canonical screenplay `@handle` tokens; known tokens receive a human-readable read-only presentation. | Existing Scene narrative handle/label maps, Studio mention presentation, skill samples/evals |
| R3 | Known cinematography language such as Establishing Shot should be visually easy to spot. | User request | The skill wraps material terms in `**strong Markdown**`; the Shot description theme renders strong content in amber. | Shot-specific CodeMirror theme and Studio tests |
| R4 | Description structure and styling must remain useful as source context for later video-prompt authoring. | User request | The description remains one exact, self-contained, model-neutral Markdown string containing the authored creative choices. | Existing `Shot.description` contract; round-trip and copy tests |
| R5 | The Optics card must use deliberate cinematography vocabulary and complete labels. | User request and live card | `24` renders as `24mm lens`; `depthOfField` accepts only `shallow` or `deep` and renders as `Shallow Focus` or `Deep Focus`; focus target renders as `Focus on …`. | Core Shot brief contract and labels; Studio card tests |
| R6 | Cast references inside Optics and Lighting cards need visible emphasis, but the cards do not need a full Markdown document renderer. | User request | Known `@handle` references render as bold human-readable mentions inside Optics intent, focus target, and Lighting intent. | Feature-local inline mention presentation and UI tests |
| R7 | The skill must use the conventions rather than Studio deriving them from prose. | User request and Decision 0041 | Skill guidance, samples, and evals author headings, strong terminology, canonical handles, and exact brief values. Studio only presents authored syntax. | Sister-project skill diff and evals |
| R8 | Cinema terminology must be research-backed. | User request | The accepted vocabulary distinguishes focal length, depth of field, focus target, and focus transition. | Research evidence below and the new ADR |
| R9 | Runtime code must not semantically validate, rewrite, repair, or compare creative prose. | `AGENTS.md` and Decision 0041 | No required headings, term scanning, prose-to-brief derivation, completeness scoring, or automatic repair. | Core tests, UI tests, architecture review |
| R10 | Existing architecture and current work must be preserved. | Repository rules and dirty worktree | Reuse current contracts and controls; settle overlap with plan 0160 before implementation; touch no unrelated working-tree files. | Diff review and final architecture gate |
| R11 | Shot `@` mentions should feel consistent with the established Generation Preview prompt-reference treatment without conflating screenplay entities with media references. | User follow-up and current Generation Request editor | Both editors use one mint known-mention color, exact-token matching, presentation-only enrichment, and literal unknown text; each feature retains its own identity data and interactions. | Shared visual token, unchanged prompt-editor behavior, Shot description tests, desktop comparison |

Every planned contract, file, test, data correction, and documentation change
below maps to one or more ledger entries. No future prompt-builder behavior is
included merely because the description may later become input to that
workflow.

## Product Behavior

### Director-facing description structure

`Shot.description` remains one exact Markdown string. The `shot-planner` skill
authors a compact subset of the following headings and omits any section for
which the Shot has no meaningful choice:

```md
## Intent

## Composition & Blocking

## Camera & Optics

## Lighting

## Sound

## End Condition
```

The headings are an authoring convention, not a schema. They have the following
director-facing meanings:

- **Intent** — the dramatic or visual reason for the Shot;
- **Composition & Blocking** — opening frame, visible subjects, spatial
  relationship, and performance/action;
- **Camera & Optics** — framing progression, angle, camera or optical movement,
  lens intent, focal length, focus behavior, and continuity constraints when
  those choices are actually known;
- **Lighting** — material source, direction, quality, contrast, color, or
  time-of-day intent;
- **Sound** — dialogue, voice-over, ambience, or an important synchronization
  cue when sound materially defines the Shot;
- **End Condition** — the visible, performative, or camera condition that ends
  the Shot.

This is not a mandatory six-heading form. A simple Shot may need only Intent,
Composition & Blocking, Camera & Optics, and End Condition. The agent must not
add empty headings, repeat the same sentence under several headings, or invent
choices to fill the format.

Within the authored Markdown:

- Cast Members and Locations use their exact existing screenplay handles, such
  as `@urban`, `@constantine-xi-palaiologos`, `@loukas-notaras`, and
  `@imperial-council-chamber`;
- material known cinematography terms use strong Markdown, for example
  `**Establishing Shot**`, `**Wide Shot**`, `**Eye-Level**`,
  `**24mm lens**`, `**Deep Focus**`, and `**Zoom**`;
- prose remains natural and temporal inside each section;
- only choices actually made by the user or agent are included;
- the description remains self-contained rather than becoming a list of brief
  field names.

Studio does not require any heading, count terms, search for the examples above,
or reject a different valid creative structure.

### Read-only rich presentation

The existing `ShotDescriptionViewer` remains a read-only `CodeMirrorEditor`.
It gains Shot-owned presentation extensions:

- Markdown headings keep the existing amber heading treatment;
- content inside Markdown strong delimiters renders with the primary amber text
  color and strong weight;
- known Cast/Location `@handle` ranges are resolved from the already-loaded
  Scene narrative resource;
- a known handle is displayed as a bold, quiet inline mention using the
  meaningful entity label while the underlying CodeMirror document retains the
  exact authored handle;
- the visible label keeps the `@` prefix, for example
  `@Constantine XI Palaiologos`;
- unknown mention-like text remains exact ordinary text and produces no warning,
  error, fallback guess, or automatic repair;
- there is no completion menu because this surface is read-only;
- there is no hover image, click navigation, or entity mutation in this slice.

The mention replacement is presentation-only. Text selection and copy must
return the exact stored Markdown—including the canonical handles and Markdown
delimiters—not a reconstructed label string.

### Relationship to Generation Preview prompt mentions

Generation Preview already establishes the visual and behavioral baseline for
known `@` syntax. The Shot description follows its stable principles without
reusing its media-reference contract:

| Surface | Source token and identity | Presentation | Interaction |
| --- | --- | --- | --- |
| Generation Preview prompt | Request-scoped Core `promptMention`, such as `@Reference1`, attached to a selected image reference | Exact token remains visible in mint; the reference label and image appear in its rich preview | Completion while editable; hover/caret preview in editable and read-only states |
| Shot description | Project screenplay handle, such as `@constantine-xi-palaiologos`, resolved from the existing Cast/Location maps | Director-readable `@Constantine XI Palaiologos` appears in the same mint mention color while the exact canonical handle remains the document source | Read-only presentation only; no completion, hover card, or navigation in this slice |
| Optics and Lighting cards | The same screenplay handle source | Director-readable label receives the requested bold treatment inside ordinary card prose | Non-interactive |

The common convention is:

- only exact known source tokens receive mention presentation;
- unknown or detached mention-like text stays literal and ordinary;
- authored strings remain exact and opaque;
- editor decorations use CodeMirror document offsets;
- mention presentation never selects, attaches, routes, validates, or rewrites
  the referenced thing.

The difference is deliberate. `@Reference1` is an allocated generation-input
token whose useful context is the referenced image, so Generation Preview keeps
its completion and rich image preview. A Shot handle identifies a screenplay
entity and may be long or slug-like, so the read-only Shot surface presents its
meaningful label directly. The two features share a semantic color token only;
they do not share DTOs, parsers, CodeMirror extensions, completion, preview, or
validation code.

### Glanceable Optics vocabulary

The current `ShotBrief` remains the brief contract. Only the depth value becomes
closed:

```ts
export type ShotDepthOfField = 'shallow' | 'deep';

export interface ShotBrief {
  durationSeconds?: number;
  framing?: {
    start?: string;
    end?: string;
  };
  camera?: {
    angle?: string;
  };
  motion?: {
    movement?: string;
  };
  optics?: {
    intent?: string;
    focalLengthMm?: number;
    depthOfField?: ShotDepthOfField;
    focusTarget?: string;
  };
  lighting?: {
    intent?: string;
  };
}
```

Core exports this exact label map:

```ts
export const SHOT_DEPTH_OF_FIELD_LABELS: Record<
  ShotDepthOfField,
  string
> = {
  shallow: 'Shallow Focus',
  deep: 'Deep Focus',
};
```

Card copy is complete rather than assembled from vague field fragments:

| Stored fact | Visible copy |
| --- | --- |
| `focalLengthMm: 24` | `24mm lens` |
| `depthOfField: "shallow"` | `Shallow Focus` |
| `depthOfField: "deep"` | `Deep Focus` |
| `focusTarget: "@urban"` | `Focus on @Urban` |

`focalLengthMm` remains a positive number in JSON. The author never embeds
`mm`, `lens`, or a lens category in that numeric field. This plan does not infer
`wide`, `normal`, or `telephoto` from the number because focal length's field of
view also depends on the capture format. If that production fact later matters,
it needs a separate product decision rather than a hidden assumption.

The depth choice is optional. The agent omits it when neither accepted value
accurately describes the Shot and expresses any more specific choice in
`optics.intent`. `rack-focus` is not a depth-of-field value; it is a focus
transition and must not be written into this field.

### Optics and Lighting mention emphasis

`optics.intent`, `optics.focusTarget`, and `lighting.intent` remain exact
freeform brief strings. They are not upgraded into Markdown documents.

When a string contains a known canonical `@handle`, the card replaces that
range for presentation with `@` plus the meaningful entity label and applies a
strong text weight. The rest of the sentence keeps the existing text-led card
treatment.

Unknown `@` text remains literal. The card does not validate whether every named
person or place uses a handle, scan ordinary names, or compare the mention with
the Shot description.

### Real sample correction

Before Core starts rejecting arbitrary `depthOfField` strings, update the
current `urban-basilica` Shot through the existing focused CLI:

```text
project: urban-basilica
scene: scene_zp6ysnpy
shot plan: shot_plan_37a3r9yz
shot: shot_tymef5sr
title: Urban Before the Empire
```

The implementation authors one temporary current `kind: "shot"` document,
validates it, runs `renku shot-plan shot update`, and reads the exact plan back.
The updated document:

- retains the current title;
- converts the dense paragraph into the accepted relevant Markdown sections;
- uses the exact current Cast and Location handles;
- bolds material camera and optics terms;
- retains the full current creative content rather than shortening away staging,
  narration, lighting, or the ending condition;
- changes only `brief.optics.depthOfField` from `"Deep"` to `"deep"`;
- changes Optics focus target and Lighting intent names to exact `@handle`
  references;
- preserves the remaining Framing, Camera, Motion, Optics intent, focal length,
  and Lighting choices unless the user separately revises them.

This is a one-time pre-customer data correction. No runtime alias for `"Deep"`,
fallback parser, compatibility diagnostic, or dual accepted shape survives.

The exact target content for this current Shot is:

```md
## Intent

Make @urban feel small against the last grandeur of Byzantium while
@constantine-xi-palaiologos and @loukas-notaras hold the established side of
the power imbalance.

## Composition & Blocking

Begin in a grand, balanced **Establishing Shot** of
@imperial-council-chamber. @urban stands alone on one side of the scarred
council table, made small by the room as he prepares to present the unfurled
charcoal cannon drawing. @constantine-xi-palaiologos and @loukas-notaras
occupy the opposite side together, composed and confident; they remain mostly
ambivalent and give @urban only intermittent attention while he gathers
himself.

Icons, maps, unpaid ledgers, worn wood, soot-dulled gold, and cold stone reveal
a magnificent room depleted by empire.

## Camera & Optics

Hold an **Eye-Level** view on a **24mm lens** with **Deep Focus** so the
chamber's scale and the unequal power triangle remain legible. Make a slow
**Zoom** from the overall **Establishing Shot** to a **Wide Shot** containing
only @urban, @constantine-xi-palaiologos, and @loukas-notaras around the table.

## Lighting

Cold daylight from the tall windows fills the chamber in concentrated shafts
and soft pools that nearly spotlight @urban, @constantine-xi-palaiologos, and
@loukas-notaras while the surrounding room remains dim.

## Sound

@narrator's full voice-over plays throughout: “By then, Byzantium was less an
empire than a magnificent city with debts, memories, and enemies. Constantine
could recognize genius. Recognition was cheaper than bronze.”

## End Condition

End before @urban begins his spoken pitch.
```

Its target brief remains:

```json
{
  "framing": {
    "start": "establishing-shot",
    "end": "wide-shot"
  },
  "camera": {
    "angle": "eye-level"
  },
  "motion": {
    "movement": "zoom"
  },
  "optics": {
    "intent": "Preserve the chamber's monumental scale at the start, then tighten onto the unequal power triangle around the table",
    "focalLengthMm": 24,
    "depthOfField": "deep",
    "focusTarget": "@urban, @constantine-xi-palaiologos, and @loukas-notaras"
  },
  "lighting": {
    "intent": "Cold daylight from the windows fills the chamber in three concentrated pools that nearly spotlight @urban, @constantine-xi-palaiologos, and @loukas-notaras against the dim room"
  }
}
```

This exact worked example is implementation input, not a new runtime template
or required wording for other Shots.

## Explicit Non-Goals

This plan does not:

- add browser Shot authoring or an editable description editor;
- add Markdown toolbar controls;
- add mention completion, insertion, click navigation, preview images, or
  mention mutation;
- create a durable mention array, entity relationship table, or second
  description representation;
- reuse Generation Preview `promptMention`, `GenerationPromptReferenceMention`,
  reference-allocation, completion, or image-preview contracts for screenplay
  entities;
- require or validate a heading template;
- automatically bold known words or infer terms from prose;
- infer brief fields from descriptions or descriptions from brief fields;
- semantically compare the description with the brief;
- validate whether a description has the right Cast, Location, shot size,
  angle, movement, lighting, sound, or ending;
- generate or revise a final video prompt;
- add aperture, T-stop, sensor/film format, focus distance, hyperfocal distance,
  near/far focus limits, lens make/model, or anamorphic metadata;
- redesign the accepted Framing, Camera, or Motion catalogs;
- relocate the existing `rack-focus` movement value in this slice;
- add a database column, table, Drizzle migration, server route, Core resource,
  CLI command, or package dependency;
- preserve `"Deep"`, `"Deep Focus"`, or another old/freeform depth value as an
  accepted runtime input;
- test or optimize mobile behavior.

## Context And Evidence

### Accepted repository constraints

- `AGENTS.md` and
  `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md` allow
  presentation-only tokenization while forbidding runtime interpretation,
  repair, scoring, or semantic validation of creative text.
- `docs/decisions/0061-use-mutable-copy-and-freeze-shot-plans.md` establishes
  `Shot.description` as opaque text and `Shot.brief` as strict JSON.
- `docs/decisions/0063-use-thin-shot-documents-and-shot-owned-images.md`
  establishes the thin Shot document and current Framing/Camera/Motion/Optics/
  Lighting brief groups. This plan narrows its statement that custom
  non-empty brief language is valid only for `optics.depthOfField`; a new ADR
  must record that narrowing.
- `docs/architecture/data-model-and-storage.md` names exact opaque Markdown
  description text and strict AJV-validated brief JSON as the current model.
- `docs/architecture/reference/project-storage-boundaries.md` explicitly allows
  Shot descriptions as the SQLite `TEXT` exception.
- `docs/architecture/reference/front-end-guidelines.md` and
  `docs/product/design-guidelines.md` require feature-owned behavior, local
  shadcn controls, and deliberate amber presentation.
- Plans 0151, 0156, and 0157 established the domain-neutral CodeMirror control,
  Shot authoring/skill contract, and current Shot Plans Studio UI.
- Plan 0160 and the current dirty worktree touch several Shot Plan and shared
  media files. Implementation must settle that work first and preserve it.

### Current implementation findings

- `packages/core/src/client/shot-plans.ts` defines
  `optics.depthOfField?: string`.
- `packages/core/src/client/shot-plan-json-schemas.ts` accepts any non-empty
  depth string.
- `packages/studio/src/features/movie-studio/shot-plans/shot-brief-grid.tsx`
  currently emits `Lens {n} mm`, `Depth {value}`, and `Focus {target}`.
- `packages/studio/src/features/movie-studio/shot-plans/shot-description-viewer.tsx`
  already uses the local `CodeMirrorEditor`, Markdown language support, line
  wrapping, and `markdownCodeEditorTheme`.
- `packages/studio/src/ui/markdown-code-editor-theme.ts` already styles
  headings amber but styles strong text with ordinary foreground.
- `packages/studio/src/features/generation-request-editor` has a separate,
  feature-owned prompt-reference mention system. It preserves exact
  `@ReferenceN` text, decorates known references in mint, and provides
  completion plus image preview from request-scoped reference metadata. It
  establishes the visual convention but must not become the Shot
  entity-mention owner.
- `prompt-theme.ts` currently hard-codes the same mint value in its mention
  token and completion-token styles. A second feature using that convention
  needs one domain-neutral theme token rather than another copied color literal.
- `SceneNarrativeResource` already exposes `castMemberLabels`,
  `castMemberHandles`, `locationLabels`, and `locationHandles`.
- `scene-narrative-tab.tsx` already resolves `@handle` references for screenplay
  presentation. Its pure entity-resolution logic is the existing structure to
  extract and reuse.
- `ScenePanel` already loads the Scene narrative resource before rendering the
  Shot Plan detail. No second request is needed.
- the `shot-planner` skill currently asks for one self-contained temporal idea
  and explicitly says its list is not a section template. Its samples are
  paragraph-only and use `"Deep"` or `"Shallow Focus"` as arbitrary depth
  strings.

### Real `urban-basilica` evidence

A read-only query of
`/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite` found:

- one current Shot row;
- `shot_tymef5sr` contains the exact dense paragraph shown in the supplied
  screenshot;
- the Shot uses `focalLengthMm: 24`;
- the only persisted depth value is `"Deep"`;
- its focus target and Lighting intent use ordinary Cast names;
- the current canonical handles are
  `urban`, `constantine-xi-palaiologos`, `loukas-notaras`, `narrator`, and
  `imperial-council-chamber`.

Because the current validator still accepts `"deep"` as a non-empty string, the
sample can be corrected through the current focused CLI before the enum lands.
No migration or direct SQLite write is required.

### Supplied UI evidence

The two 2026-07-28 Chrome appshots establish the baseline:

- the Description tab is a full-height read-only text surface but renders the
  Shot as one paragraph;
- the Brief tab renders the Optics chips as `Lens 24 mm`, `Depth Deep`, and a
  long unaccented focus target;
- the Lighting card repeats three Cast names without differentiation.

Desktop verification uses this exact Shot and route. Mobile verification is
out of scope.

## Cinematography Research And Vocabulary Decision

The product vocabulary in this plan is based on authoritative camera/film
sources rather than an invented taxonomy:

- Kodak defines **focal length** as a lens measurement and **depth of field** as
  the near-to-far distance range that appears acceptably sharp. Kodak identifies
  lens opening, focal length, and lens-to-subject distance as contributing
  variables:
  <https://www.kodak.com/en/motion/page/glossary-of-motion-picture-terms/>.
- Kodak's cinema tool uses the director-facing choice **deep focus** versus
  **shallow focus**, while separately accepting format, focal length, f-stop,
  and subject distance:
  <https://www.kodak.com/en/motion/page/kodak-cinema-tools/>.
- Sony likewise distinguishes **shallow depth of field** from **deep depth of
  field** and notes that subject distance, aperture, focal length, and sensor
  size affect the result:
  <https://www.sony.com/electronics/support/articles/00031291>.
- Sony's lens reference demonstrates that the same focal length produces a
  different angle of view on full-frame and APS-C sensors, supporting the
  decision not to infer a wide/normal/tele category from `focalLengthMm` alone:
  <https://www.sony.com/electronics/support/articles/00268239>.
- ARRI lens-data documentation treats focal length, iris, focus distance, and
  the close/far depth-of-field points as separate lens facts:
  <https://www.arri.com/resource/blob/147960/0a0185ebcbe1c872f87a7f7200f44e12/alexa-xt-sup-11-1-1-user-manual-data.pdf>.
- Sony describes **rack focus** as a focus transition, supporting its exclusion
  from the depth-of-field enum:
  <https://www.sony.com/ng/electronics/interchangeable-lens-cameras/ilme-fx3a>.

The resulting bounded vocabulary is:

| Concept | Stored shape | Director-facing label | Decision |
| --- | --- | --- | --- |
| Focal length | positive `focalLengthMm` number | `{n}mm lens` | Keep separate from depth and from an inferred wide/normal/tele category. |
| Depth of field | `"shallow"` or `"deep"` | `Shallow Focus` or `Deep Focus` | Use the two researched glanceable choices; omit when neither is known. |
| Focus target | freeform text with optional canonical `@handle` mentions | `Focus on …` | Preserve the exact creative subject choice; do not convert it into entity relationships. |
| Optics intent | freeform text with optional canonical `@handle` mentions | primary card prose | Explain the visual effect instead of restating technical chips. |
| Rack focus | not accepted in `depthOfField` | none in the depth chip | It is a focus transition, not the depth range. Existing Motion scope is unchanged here. |

This plan deliberately does not claim that a focal length alone determines
field of view or depth of field.

## Right-Sized Change Decision

### Option 1: reuse every current contract unchanged

This would allow the skill to start writing headings and Markdown immediately,
but it would leave arbitrary depth strings, `Depth Deep`, the wrong focal-length
copy, and unaccented known entity handles. It does not satisfy R5 or R6.

### Option 2: extend the existing Shot and Studio owners

Chosen.

- Reuse the exact `Shot.description` string and focused Shot CLI.
- Narrow one existing brief field in Core.
- Reuse current label and schema ownership.
- Reuse the already-loaded Scene narrative entity maps.
- Keep CodeMirror mechanics in the current local control and Shot behavior in
  the Shot Plan feature.
- Refactor the existing screenplay entity resolver rather than creating a
  second independent handle-to-label algorithm.
- Update the current skill and sample directly.

This introduces one public type and one public label map because Core needs an
exact depth contract. Everything else is feature-local presentation or
agent-owned guidance.

### Option 3: introduce a rich Shot document or durable mention model

Rejected. A section schema, mention DTO stored beside the description, rich-text
AST, entity relationship table, new Core resource, or browser editor would
duplicate the current exact Markdown source and create synchronization rules
with no present product need.

## Architecture Shape Gate

### Ownership

`packages/core`

- owns `ShotDepthOfField`, its labels, JSON Schema validation, and structured
  boundary failures;
- continues to treat description, intent, focus target, and lighting text as
  opaque;
- gains no renderer, Markdown parser, handle resolver, route, or persistence
  branch.

`packages/studio`

- owns read-only Shot description and brief presentation;
- derives known entity mentions from the already-loaded
  `SceneNarrativeResourceResponse`;
- owns one domain-neutral `--editor-mention-foreground` theme token used by
  both editor features while each feature owns its own mention behavior;
- owns no durable entity relationship or creative validation;
- continues to consume `CodeMirrorEditor` as the domain-neutral local control.

`studio-skills/skills/shot-planner`

- owns creative authoring guidance, section choice, use of canonical handles,
  and deliberate Markdown emphasis;
- does not turn those conventions into Studio runtime requirements.

### Intended Core module layout

```text
packages/core/src/client/
  shot-plans.ts
    ShotDepthOfField
    ShotBrief
  shot-spec-labels.ts
    SHOT_DEPTH_OF_FIELD_LABELS
    existing Shot labels
  shot-plan-json-schemas.ts
    exact depth enum in shotBriefSchema
  index.ts
    thin intentional public exports only

packages/core/src/server/shot-plans/
  validation.ts
    existing AJV validation and structured diagnostics
  shot-authoring.test.ts
    authoring document and enum validation
  shot-plans.test.ts
    persistence round-trip and invalid stored brief coverage
```

Do not create a depth service, optics registry, brief manager, or schema adapter.
The current client contract and AJV boundary are the correct owners.

### Intended Studio module layout

```text
packages/studio/src/styles/
  theme.css
    shared --editor-mention-foreground visual token

packages/studio/src/features/generation-request-editor/
  prompt-theme.ts
    consumes --editor-mention-foreground; otherwise unchanged

packages/studio/src/features/movie-studio/
  screenplay-entity-mentions.ts
    pure known-handle resolution and exact text ranges
  screenplay-entity-mentions.test.ts

  scenes/
    scene-panel.tsx
      passes its existing entity maps into Shot Plan detail
    scene-narrative-tab.tsx
      consumes the extracted pure resolver; retains dialogue-tag rendering

  shot-plans/
    shot-plan-detail-page.tsx
      passes entity mention context
    shot-plan-shot-content.tsx
      passes entity mention context to the active detail surface
    shot-description-viewer.tsx
      composes the local editor and Shot-owned extensions
    shot-description-theme.ts
      Shot-only strong-Markdown and mention presentation
    shot-description-mentions.ts
      CodeMirror known-mention decoration/widget extension
    shot-brief-mention-text.tsx
      compact non-interactive inline mention presentation
    shot-brief-grid.tsx
      complete Optics labels and mention-aware freeform text
    shot-plans.test.tsx
```

`screenplay-entity-mentions.ts` is a focused feature utility, not a new generic
UI primitive or a barrel. It knows only screenplay Cast/Location handle maps,
meaningful labels, exact lexical boundaries, and resolved identity. It does not
render DOM, read Markdown, fetch data, or mutate selection.

`shot-description-mentions.ts` owns the CodeMirror-specific presentation because
the generic local editor must not learn about Cast Members, Locations, Shots,
or Studio mentions.

`shot-brief-mention-text.tsx` owns the compact card treatment. It must not become
a Markdown renderer or an interactive entity navigation component.

`theme.css` owns only the repeated visual token. It does not define mention
syntax, range matching, identity, decoration, completion, preview, or
interaction. `prompt-theme.ts` replaces its hard-coded mint literals with the
token without changing Generation Preview behavior.

### Public entrypoints and contracts

The only changed workspace public contract is the existing
`@gorenku/studio-core/client` entrypoint:

```ts
export type { ShotDepthOfField };
export { SHOT_DEPTH_OF_FIELD_LABELS };
```

Existing `ShotBrief`, Shot authoring documents, commands, reports, CLI paths,
Studio route paths, and browser API paths remain the entrypoints.

There is no new Studio package export, `index.ts`, route, server response, or
CLI surface.

### Domain branches and dispatch

No switch, registry, command dispatcher, route dispatcher, or purpose branch is
needed.

The label map is a bounded two-entry product vocabulary consumed by JSON Schema,
Studio display, documentation, and skill guidance. It is not a general optics
registry.

Mention resolution is bounded to the two already-supported screenplay entity
kinds:

```ts
type ScreenplayEntityMentionKind = 'castMember' | 'location';
```

If another entity kind later needs authored mentions, that is a separate
product decision. Do not add a catch-all entity registry in anticipation.

### Files expected to shrink, remain thin, or disappear

- `scene-narrative-tab.tsx` loses its local handle-resolution function and keeps
  only Scene block/dialogue presentation.
- `scene-panel.tsx` remains the shallow owner of its already-loaded narrative
  resource and passes a focused presentation context.
- `shot-description-viewer.tsx` remains a small composition component.
- `shot-plan-detail-page.tsx` and `shot-plan-shot-content.tsx` remain prop/data
  pass-through components with no parsing.
- `shot-brief-grid.tsx` keeps card layout and delegates mention rendering.
- `packages/core/src/client/index.ts` remains a thin intentional public
  entrypoint.
- no existing file disappears.

### Explicitly forbidden code shape

Do not:

- put heading requirements or cinematic-term scanning into Core validation;
- use regexes to infer `framing`, `camera`, `motion`, `optics`, or `lighting`
  from description prose;
- make the Studio server resolve mentions or add Shot-specific entity DTOs;
- issue a second Cast/Location request from Shot Plan detail;
- copy the prompt-reference mention implementation into Shot Plans or import
  across those feature boundaries;
- pass Generation Preview `promptMention` DTOs, selected-reference projections,
  or reference-allocation state into Shot Plans;
- move mention behavior into `CodeMirrorEditor` or
  `markdown-code-editor-theme.ts`;
- create a generic rich-editor, mention framework, Markdown AST, token registry,
  or optics manager;
- let a React component decide whether authored state is valid;
- silently map `"Deep"`, `"Deep Focus"`, `"deep-focus"`, or another value to
  `"deep"`;
- add a compatibility alias, fallback reader, repair path, or old-value
  diagnostic;
- render brief intent through unsafe HTML;
- add raw HTML interactive controls.

### Stop conditions

Stop and revise before implementation continues if:

- preserving exact selection/copy is incompatible with replacing known handle
  text for read-only presentation;
- known mention display would require a new durable mention field or route;
- a second entity-resolution algorithm survives beside the existing Scene
  resolver;
- visual consistency starts requiring a shared mention component, parser,
  CodeMirror extension, or cross-feature import rather than the one shared
  theme token;
- `CodeMirrorEditor` or the generic Markdown theme begins learning Shot or
  entity semantics;
- Optics work expands into aperture, capture format, lens inventory, or a broad
  optics schema;
- one component starts handling resource loading, mention parsing, CodeMirror
  setup, card copy, and navigation together;
- plan 0160's in-flight changes overlap in a way that cannot be preserved
  through narrow edits;
- the completion checklist can only be satisfied by accepting a monolithic
  feature file.

## Contracts

### Core depth vocabulary

Add `ShotDepthOfField` to `shot-plans.ts` and
`SHOT_DEPTH_OF_FIELD_LABELS` to `shot-spec-labels.ts`. The JSON Schema reads its
enum values from the same accepted label map keys so Core and UI cannot drift.

`shotBriefSchema.properties.optics.properties.depthOfField` becomes:

```ts
{
  enum: ['shallow', 'deep'];
}
```

The schema remains strict and does not accept a custom branch for this one
field.

Invalid authoring input continues through `CORE_SHOT_PLAN_INVALID`. Invalid
stored JSON continues through `CORE_SHOT_PLAN_STORAGE_INVALID`. No new
diagnostic code is needed because the existing codes already name the owning
boundary.

### Unchanged opaque text contracts

These remain exact strings:

- `Shot.description`;
- `ShotBrief.optics.intent`;
- `ShotBrief.optics.focusTarget`;
- `ShotBrief.lighting.intent`.

Core validates type and non-whitespace rules where already accepted. It does
not validate Markdown, handles, headings, names, terms, or semantic agreement.

### Screenplay entity mention presentation

Define the local Studio-only shape:

```ts
export interface ScreenplayEntityMentionCatalog {
  castMemberHandles: Record<string, string>;
  castMemberLabels: Record<string, string>;
  locationHandles: Record<string, string>;
  locationLabels: Record<string, string>;
}

export interface ScreenplayEntityMentionRange {
  from: number;
  to: number;
  source: string;
  entity: {
    kind: 'castMember' | 'location';
    id: string;
    label: string;
  };
}
```

The catalog is a `Pick`/projection of the existing narrative resource, not a new
server DTO.

Resolution rules:

- accepted source syntax is the current screenplay form
  `@([A-Za-z0-9][A-Za-z0-9_-]*)`;
- lookup is case-insensitive using existing lower-case handle maps;
- range offsets use the exact CodeMirror document string;
- only exact known handles resolve;
- unknown text is returned as no match and remains unchanged;
- no prefix, title, fuzzy, or partial matching is allowed;
- the resolver never produces warnings or changes stored text.

### Shot description presentation contract

`ShotDescriptionViewer` receives:

```ts
interface ShotDescriptionViewerProps {
  value: string;
  entityMentions: ScreenplayEntityMentionCatalog;
}
```

Its CodeMirror document is still `value`. Known handle widgets/decorations are
derived from document offsets and the catalog. The visible replacement is
`@${entity.label}`.

Required presentation/accessibility behavior:

- editor remains keyboard focusable and `aria-readonly="true"`;
- known mention presentation identifies Cast Member versus Location to
  assistive technology;
- unknown mentions remain literal;
- Markdown heading and strong styling work in both light and dark themes;
- selection and copy serialize the exact original string;
- resizing, scrolling, and line wrapping remain editor-owned;
- no feature-calculated popover coordinates or completion state exists.

### Cross-surface mention visual contract

Add one `--editor-mention-foreground` semantic token to `theme.css`, initialized
to the current accepted Generation Preview mint. Both `prompt-theme.ts` and
`shot-description-theme.ts` consume it for known editor mentions.

The token is the only shared implementation. Generation Preview continues to
decorate exact `promptMention` text and own reference completion/image preview.
Shot Plans continue to resolve screenplay entity handles and own read-only
label presentation. Optics and Lighting cards keep the explicitly requested
bold-only treatment and do not use the editor mention color.

### Shot brief presentation contract

The inline renderer receives exact text and the same entity catalog. It emits
text nodes plus non-interactive known-mention spans. It does not accept Markdown
or HTML.

`ShotBriefGrid` maps technical values as follows:

```ts
`${brief.optics.focalLengthMm}mm lens`
SHOT_DEPTH_OF_FIELD_LABELS[brief.optics.depthOfField]
`Focus on ${renderedTarget}`
```

Use the existing number as authored; do not round or categorize it. Existing
positive-number Core validation remains authoritative.

### Agent authoring contract

The sister skill must say:

- read exact current handles from context before writing mentions;
- use relevant Markdown sections and omit empty ones;
- use `**…**` only for material known cinematography terms in descriptions;
- use canonical `@handle` source text for Cast Members and Locations;
- use brief `depthOfField` only as `"shallow"` or `"deep"`;
- keep `focalLengthMm` numeric and unitless;
- keep `rack-focus` out of `depthOfField`;
- state important Optics/Lighting choices in the description and brief without
  copying the same sentence mechanically;
- do not invent a technical choice to satisfy the structure.

## Implementation Slices

### Slice 0 — Settle overlap and record the baseline

Files/data:

- current dirty worktree;
- plan 0160;
- supplied Chrome appshots;
- read-only `urban-basilica` queries.

Work:

1. Preserve and settle plan 0160's current Shot Plan/shared-media changes before
   touching overlapping files.
2. Capture `git status --short` and the focused existing Shot Plan diff.
3. Read back the exact current Shot through `renku shot-plan show`.
4. Confirm the current only persisted depth value remains `"Deep"` before data
   correction.

No code or data change proceeds if the in-flight work cannot be preserved.

### Slice 1 — Record the narrowed decision

Files:

- add
  `docs/decisions/0067-use-structured-shot-depth-and-presentational-mentions.md`;
- add only a concise supersession/narrowing notice near the top of
  `docs/decisions/0063-use-thin-shot-documents-and-shot-owned-images.md`.

The new ADR records:

- exact opaque Markdown remains the Shot description source;
- headings, strong terms, and `@handle` use are agent conventions;
- Studio may resolve known handles for presentation only;
- Shot entity mentions and Generation Preview media-reference mentions share
  one visual token but retain separate identity and interaction contracts;
- `depthOfField` is the strict shallow/deep glanceable vocabulary;
- freeform creative optics and lighting intent remain opaque;
- no durable mention model or runtime semantic validation is introduced.

Do not rewrite Decision 0063's historical body.

### Slice 2 — Correct the real sample through the current CLI

Files/data:

- temporary operation JSON outside durable project data;
- `/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite` through
  current CLI commands only.

Work:

1. Author the exact structured Markdown and corrected brief document for
   `shot_tymef5sr`.
2. Validate with `renku shot-plan validate --file … --json`.
3. Update with:

   ```bash
   renku shot-plan shot update \
     --shot-plan shot_plan_37a3r9yz \
     --shot shot_tymef5sr \
     --file <shot.json> \
     --json
   ```

4. Read `shot_plan_37a3r9yz` back and verify the exact description, handles,
   `"deep"` depth value, and all unchanged choices.
5. Keep no checked-in operation file unless it is deliberately added as a
   current skill sample.

This ordering lets the current permissive validator accept the new exact value
before the strict enum lands.

### Slice 3 — Narrow the Core brief contract

Files:

- `packages/core/src/client/shot-plans.ts`;
- `packages/core/src/client/shot-spec-labels.ts`;
- `packages/core/src/client/shot-plan-json-schemas.ts`;
- `packages/core/src/client/index.ts`;
- focused existing Core Shot Plan tests.

Work:

1. Add `ShotDepthOfField`.
2. Add the exact two-entry label map.
3. type `ShotBrief.optics.depthOfField` with the new union.
4. change the JSON Schema from arbitrary non-empty string to the exact enum.
5. export the type and labels through the existing thin client entrypoint.
6. update current test fixtures directly; keep no old-value fixtures except an
   owning-layer invalid-input assertion described in current vocabulary terms.

No storage schema or command changes are needed.

### Slice 4 — Reuse the current screenplay entity resolver

Files:

- add
  `packages/studio/src/features/movie-studio/screenplay-entity-mentions.ts`;
- add its focused test;
- update
  `packages/studio/src/features/movie-studio/scenes/scene-narrative-tab.tsx`;
- update
  `packages/studio/src/features/movie-studio/scenes/scene-panel.tsx`.

Work:

1. Extract pure exact handle resolution and range discovery from
   `scene-narrative-tab.tsx`.
2. Keep Scene dialogue-audio-tag tokenization inside the Scene feature.
3. Make the existing Scene inline renderer consume the pure resolver with no
   visible behavior change.
4. Derive/pass the focused catalog from the narrative resource already loaded
   by `ScenePanel`.

Do not add a fetch, server response property, or global UI mention primitive.

### Slice 5 — Add Shot description presentation

Files:

- add `shot-description-theme.ts`;
- add `shot-description-mentions.ts`;
- update `packages/studio/src/styles/theme.css`;
- update
  `packages/studio/src/features/generation-request-editor/prompt-theme.ts`;
- update `shot-description-viewer.tsx`;
- update `shot-plan-detail-page.tsx`;
- update `shot-plan-shot-content.tsx`;
- update focused Shot Plan tests.

Work:

1. Pass the existing catalog through the detail components.
2. Add `--editor-mention-foreground` with the current Generation Preview mint
   value and replace the prompt theme's two hard-coded mint literals with that
   token.
3. Compose the existing generic Markdown editor theme with Shot-only amber
   strong text and mint known-mention presentation.
4. Add the known-handle CodeMirror presentation extension.
5. Present meaningful `@label` text while retaining exact document offsets and
   serialized text.
6. Keep the editor read-only, selectable, copyable, wrapped, and internally
   scrollable.

If exact copy cannot be preserved, stop under the Architecture Shape Gate;
do not accept a visually correct but contract-breaking widget.

### Slice 6 — Correct Optics and Lighting card presentation

Files:

- add `shot-brief-mention-text.tsx`;
- update `shot-brief-grid.tsx`;
- update `shot-plans.test.tsx`.

Work:

1. render `24mm lens`;
2. render depth from `SHOT_DEPTH_OF_FIELD_LABELS`;
3. render `Focus on …`;
4. resolve/bold known handles in Optics intent, focus target, and Lighting
   intent;
5. retain intent-first ordering and current quiet missing-value behavior;
6. do not introduce a Markdown parser or interactive raw control.

### Slice 7 — Update the source skill and current samples

Files in `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/shot-planner/`:

- `SKILL.md`;
- `references/shot-writing-guidelines.md`;
- `references/shot-brief-vocabulary.md`;
- `references/shot-plan-json-contract.md`;
- `samples/shot.json`;
- `samples/shot-plan-create.json`;
- `evals/iterative-shot-authoring.md`;
- add `evals/readable-descriptions-and-optics.md`.

Work:

1. add the optional section convention;
2. require exact context-provided handles for Cast/Location mentions;
3. define strong Markdown usage for material terms;
4. define the exact two-value depth vocabulary and full UI labels;
5. clarify that `rack-focus` is not a depth value;
6. update samples directly—no old-shape examples or compatibility guidance;
7. add evals for good structure, no empty/filler headings, exact handles,
   deliberate strong terms, and no invented technical choices.

### Slice 8 — Align current documentation and verify

Files:

- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/reference/domain-vocabulary.md`;
- `docs/architecture/reference/studio-skills.md`;
- `docs/product/design-guidelines.md`;
- `docs/cli/commands.md`.

Work:

1. document the exact depth contract and labels;
2. document Shot description formatting as agent-owned opaque Markdown;
3. document presentation-only known-handle resolution;
4. update CLI Shot brief guidance with the numeric focal length and exact depth
   values;
5. document `--editor-mention-foreground` as the shared editor mention color
   while keeping Generation Preview reference behavior and Shot entity
   behavior feature-owned;
6. document the Shot description and card emphasis treatment;
7. run focused, root, desktop, real-project, and architecture verification.

Do not edit historical plans for a naming sweep.

## Tests And Guardrails

### Core owning-layer coverage

Cover the complete depth invariant once in Core:

- accepts absent `depthOfField`;
- accepts `"shallow"`;
- accepts `"deep"`;
- round-trips both values through brief serialization/projection;
- rejects another current string such as `"medium"` through
  `CORE_SHOT_PLAN_INVALID`;
- rejects invalid stored current-contract JSON through
  `CORE_SHOT_PLAN_STORAGE_INVALID`;
- keeps description, Optics intent, focus target, and Lighting intent exact;
- does not require headings, `@handle` references, strong terms, or
  description/brief agreement.

Do not repeat the invalid enum matrix in CLI, server, React, and E2E tests.

### Studio pure mention coverage

`screenplay-entity-mentions.test.ts` covers:

- exact Cast handle resolution;
- exact Location handle resolution;
- case-insensitive lookup against canonical lower-case maps;
- start, middle, end, repeated, punctuation-adjacent, and line-break ranges;
- meaningful labels and entity kinds;
- unknown, partial, embedded, and fuzzy text remaining unresolved;
- exact source offsets and source substrings.

These tests protect behavior, not private helper names.

### Scene narrative regression coverage

Existing Scene tests prove extraction does not change:

- known Cast and Location labels;
- interactive navigation through the existing local `Button`;
- unknown mention presentation;
- dialogue audio tags.

Do not duplicate the pure range matrix here.

### Shot description coverage

Component tests prove:

- exact Markdown is the CodeMirror document;
- headings retain the accepted primary treatment;
- strong text receives Shot-only amber emphasis;
- known Cast and Location mentions present meaningful `@label` copy in the
  established mint mention color;
- unknown mentions remain exact;
- the editor stays read-only and focusable;
- the underlying text remains exact when entity labels differ from handles;
- Generation Preview still presents exact `@ReferenceN` text with the same mint
  color, completion, and hover/caret image preview.

Use one Chromium interaction test for selection/copy because JSDOM is not
strong evidence for CodeMirror clipboard behavior:

1. open the real structured Shot description;
2. select text spanning a heading, bold term, and known mention;
3. copy;
4. assert the clipboard contains the exact stored Markdown and canonical handle.

### Shot brief coverage

React tests prove:

- intent remains visually before technical metadata;
- `50` renders as `50mm lens` and no `Lens 50 mm` copy remains;
- `"shallow"` renders as `Shallow Focus`;
- `"deep"` renders as `Deep Focus` and no `Depth Deep` copy remains;
- focus target uses `Focus on`;
- known handles in Optics intent, focus target, and Lighting intent present
  meaningful bold labels;
- unknown `@` text remains exact;
- missing optional values remain quiet;
- no brief string is interpreted as Markdown or HTML.

### CLI and server adapter coverage

No new adapter test matrix is needed. Update current typed fixtures to use
`"shallow"` or `"deep"` and retain existing tests that prove:

- CLI reads the current Shot document and delegates to Core;
- server serializes Core reports without interpreting description or brief.

### Skill evals

Forward evals cover:

- a complex Shot uses relevant headings, exact handles, and strong material
  cinematography terms;
- a simple Shot does not add every possible heading;
- an agent reads exact handles before using them;
- `focalLengthMm` stays numeric;
- `depthOfField` uses only `shallow` or `deep`;
- `rack-focus` is not written as depth of field;
- unknown choices remain absent rather than becoming generic film language;
- Optics and Lighting intent remain concise and are not mechanical copies of
  the description;
- focused later edits continue to use the current CLI command rather than
  read-modify-writing a whole plan.

### Stable architecture guardrails

Existing import and raw-control guardrails remain authoritative. Add no
source-text test that freezes implementation function names.

Architecture review verifies:

- Studio UI imports no Core server/database module;
- `CodeMirrorEditor` has no Cast, Location, Shot, Markdown-default, or mention
  semantics;
- `theme.css` shares only the mention foreground color and owns no mention
  syntax or behavior;
- prompt-reference code and Shot entity-mention code do not import each other;
- server routes remain unchanged/thin;
- no direct SQLite write appears in skills or UI;
- no compatibility branch recognizes obsolete depth strings;
- no architecture test inventories private helpers.

## Documentation And ADR Effects

### New decision

Add Decision 0067 to record the closed depth vocabulary and presentation-only
authored mention/Markdown convention.

### Narrowed older decision

Add only a concise notice to Decision 0063 stating that Decision 0067 narrows
custom brief-language acceptance for `optics.depthOfField`. Leave Decision
0063's historical body intact.

### Current documentation

Update:

- `docs/architecture/data-model-and-storage.md` for the strict two-value depth
  field and opaque description presentation;
- `docs/architecture/reference/domain-vocabulary.md` for the current Shot brief
  wording;
- `docs/architecture/reference/studio-skills.md` for the agent-owned structure,
  handles, and emphasis convention;
- `docs/product/design-guidelines.md` for the shared mint editor-mention token,
  Shot-only strong amber text, bold-only brief-card entities, and complete
  Optics chip copy;
- `docs/cli/commands.md` for exact current brief values.

No standalone cinematography encyclopedia is added. The bounded research-backed
vocabulary is documented where the current contract is consumed.

## Final Verification

### Focused commands

Run the repository-owned focused checks:

```bash
pnpm --filter @gorenku/studio-core test -- shot-plan
pnpm --filter @gorenku/studio-core test:typecheck
pnpm --filter @gorenku/studio test -- shot-plans screenplay-entity-mentions prompt-editor prompt-mentions
pnpm --filter @gorenku/studio test:typecheck
pnpm --filter @gorenku/studio lint
pnpm --filter @gorenku/studio-cli test -- shot-plan
```

Use the exact supported script spelling from each package if a filtered command
above is not registered; do not install dependencies or format files to make a
command pass.

Run the focused Chromium test for exact description selection/copy.

### Root verification

Because this changes a public Core client type consumed by CLI, Studio, tests,
docs, and the sister skill, run:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Do not run Prettier or ESLint `--fix`.

### Real-project verification

Through the current CLI:

```bash
renku shot-plan show --shot-plan shot_plan_37a3r9yz --json
```

Confirm:

- `shot_tymef5sr.description` is the exact structured Markdown;
- every known Cast/Location source reference is an exact canonical handle;
- `focalLengthMm` is `24`;
- `depthOfField` is `"deep"`;
- the focus target and Lighting intent use canonical handles;
- no other Shot or Shot Plan fact changed.

### Desktop verification

At a supported desktop viewport, open:

```text
http://localhost:5173/projects/urban-basilica/scenes/scene_zp6ysnpy?sceneTab=shotPlans&shotPlan=shot_plan_37a3r9yz&shot=shot_tymef5sr
```

Verify in both dark and light themes:

1. Description headings make the Shot scannable without unnecessary empty
   sections.
2. Strong cinema terms are amber and remain legible.
3. Known Cast/Location mentions show meaningful `@label` text in the same mint
   mention color used by Generation Preview.
4. unknown mention-like text, if added to a fixture, remains literal.
5. Description scroll, selection, copy, and tab switching remain correct.
6. The copied value is exact Markdown with canonical handles.
7. Optics shows `24mm lens`, `Deep Focus`, and `Focus on …`.
8. Optics and Lighting entity mentions are visibly bold.
9. Intent remains more visually prominent than technical chips.
10. A Generation Preview prompt still shows exact `@ReferenceN` text in mint
    with its existing completion and rich reference preview.
11. the current Shot rail, candidate image dialog, Brief/Description tabs, and
    plan 0160 media behavior are unchanged.

Do not report mobile behavior.

### Sister-skill verification

Inspect the complete `studio-skills` diff and run its repository-owned skill
validation/eval commands. Confirm every current sample uses only the accepted
depth values and no guidance tells agents to write paragraph-only
descriptions.

### Architecture-shape review

Before completion:

1. inspect `git diff --stat` in both repositories;
2. inspect the complete diffs, preserving unrelated user changes;
3. inspect every new or heavily modified file;
4. confirm `scene-narrative-tab.tsx` lost local entity-resolution duplication;
5. confirm `shot-description-viewer.tsx`, `shot-plan-detail-page.tsx`, and
   `shot-plan-shot-content.tsx` remain shallow;
6. confirm `shot-brief-grid.tsx` delegates mention presentation;
7. confirm `index.ts` remains a thin intentional entrypoint;
8. confirm no new route, fetch, table, migration, dependency, generic rich
   editor, catch-all helper, or broad dispatcher exists;
9. confirm the owning Core layer did not become a monolithic optics module;
10. confirm no checklist item was satisfied by accepting unreviewable code
    shape or formatting churn.

## Completion Checklist

### Review Area

- [ ] Confirm every implemented concept maps to R1-R11.
- [ ] Confirm the result is director-readable at the supplied real Shot.
- [ ] Confirm the implementation preserves the opaque creative-text boundary.
- [ ] Confirm centralized ownership did not become a monolithic
      implementation.
- [ ] Confirm the final module/file shape matches the Architecture Shape Gate.
- [ ] Confirm no new broad dispatcher, catch-all helper, rich-editor framework,
      optics manager, or god file was added.
- [ ] Confirm plan 0160 and all unrelated dirty-worktree changes were preserved.

### Product Behavior

- [ ] Make complex Shot descriptions scannable through relevant `##` sections.
- [ ] Omit empty or irrelevant sections rather than filling a template.
- [ ] Keep description prose self-contained, model-neutral, and temporally
      coherent.
- [ ] Use canonical screenplay `@handle` references for Cast Members and
      Locations.
- [ ] Use strong Markdown only for material known cinematography choices.
- [ ] Render strong description text with Shot-only amber emphasis.
- [ ] Present known handles as meaningful `@label` text without changing stored
      Markdown.
- [ ] Use the established mint known-mention color in both Shot descriptions
      and Generation Preview prompts.
- [ ] Keep Generation Preview media-reference behavior and Shot screenplay-
      entity behavior recognizably related but semantically distinct.
- [ ] Keep unknown mention-like text exact and non-blocking.
- [ ] Render `24` as `24mm lens`.
- [ ] Render depth as `Shallow Focus` or `Deep Focus`.
- [ ] Render the focus target with `Focus on`.
- [ ] Bold known entity mentions in Optics and Lighting card prose.
- [ ] Keep Optics/Lighting intent visually primary and optional metadata
      secondary.

### Architecture And Public Contracts

- [ ] Add the deliberately named `ShotDepthOfField` public union.
- [ ] Add `SHOT_DEPTH_OF_FIELD_LABELS` as the single current display map.
- [ ] Narrow the existing JSON Schema to `shallow` and `deep`.
- [ ] Keep the current `ShotBrief`, commands, reports, routes, and browser API
      as the owning entrypoints.
- [ ] Keep package-boundary diagnostics on existing structured Core codes.
- [ ] Add no compatibility alias, fallback reader, old-value mapper, or
      obsolete-value diagnostic.
- [ ] Add no durable mention model, route property, table, column, or migration.
- [ ] Share only `--editor-mention-foreground`; add no cross-feature mention
      DTO, parser, component, CodeMirror extension, completion, or preview
      contract.
- [ ] Keep all creative description/intent strings opaque to Core.
- [ ] Keep `packages/core/src/client/index.ts` thin.

### Real Project Data

- [ ] Capture the exact current `urban-basilica` Shot before mutation.
- [ ] Author a current `kind: "shot"` correction document.
- [ ] Validate the document through the existing CLI.
- [ ] Update only `shot_tymef5sr` through the focused Shot command before the
      stricter enum lands.
- [ ] Convert `"Deep"` directly to `"deep"`.
- [ ] add the relevant headings, exact handles, and strong terms without losing
      any current creative choice.
- [ ] Read the exact Shot Plan back and verify all unchanged fields.
- [ ] Leave no direct SQLite write or compatibility path.

### Core Implementation

- [ ] Update `ShotBrief.optics.depthOfField` to the new union.
- [ ] Update the shared label map and JSON Schema from one current source.
- [ ] Update current fixtures directly to the accepted values.
- [ ] Preserve positive-number validation for focal length.
- [ ] Preserve exact description and intent strings.
- [ ] Keep Core free of Markdown, handle, heading, and cinematic-term
      interpretation.

### Studio Mention Reuse

- [ ] Extract the existing pure screenplay entity resolver into
      `screenplay-entity-mentions.ts`.
- [ ] Keep Scene dialogue-audio tag handling inside the Scene feature.
- [ ] Preserve Scene narrative mention labels and navigation.
- [ ] Derive the Shot mention catalog from the already-loaded narrative
      resource.
- [ ] Pass the catalog through shallow Shot Plan components.
- [ ] Add no extra fetch or Studio server contract.
- [ ] Keep prompt-reference and Shot entity-mention features independent.
- [ ] Replace Generation Preview's hard-coded mint literals with the shared
      semantic token without changing prompt behavior.

### Shot Description Presentation

- [ ] Add the Shot-only strong Markdown theme.
- [ ] Add known-handle CodeMirror presentation in a Shot-owned module.
- [ ] Display meaningful mint `@label` copy for known Cast Members and
      Locations.
- [ ] Preserve exact CodeMirror document text and offsets.
- [ ] Preserve keyboard focus, read-only state, wrapping, scrolling, selection,
      and copy.
- [ ] Preserve exact copied Markdown and canonical handles in Chromium.
- [ ] Keep `CodeMirrorEditor` and the generic Markdown theme domain-neutral.
- [ ] Keep unknown mentions exact and unstyled as known entities.

### Brief Card Presentation

- [ ] Add the compact non-interactive mention renderer.
- [ ] Apply it to Optics intent, focus target, and Lighting intent.
- [ ] Render complete focal-length, depth, and focus-target labels.
- [ ] Preserve intent-first order and quiet missing values.
- [ ] Add no Markdown/HTML renderer or raw interactive control.
- [ ] Keep card copy meaningful and free of raw ids or invented labels.

### CLI And Agent Skills

- [ ] Keep the current focused Shot CLI unchanged and thin.
- [ ] Update `shot-writing-guidelines.md` with the optional section vocabulary.
- [ ] Require exact context-provided handles.
- [ ] Define deliberate strong Markdown treatment for material terms.
- [ ] Update `shot-brief-vocabulary.md` with exact stored values and labels.
- [ ] Keep `focalLengthMm` numeric and unitless in JSON guidance.
- [ ] State that `rack-focus` is not a depth-of-field value.
- [ ] Update both current samples directly.
- [ ] Add evals for complex and simple description structure.
- [ ] Add evals for exact handles, no filler headings, and no invented choices.
- [ ] Add evals for the strict depth vocabulary and focused iteration workflow.

### Tests And Guardrails

- [ ] Cover the complete depth enum and round-trip behavior once in Core.
- [ ] Prove creative prose remains opaque in Core.
- [ ] Cover exact known/unknown entity ranges in the pure Studio resolver.
- [ ] Preserve Scene narrative behavior after resolver extraction.
- [ ] Cover Shot heading, strong, mention, and read-only presentation.
- [ ] Preserve Generation Preview exact-token decoration, completion, and rich
      image preview while moving its mint color to the shared token.
- [ ] Cover exact clipboard serialization in Chromium.
- [ ] Cover complete Optics labels and card mention emphasis.
- [ ] Update adapter fixtures without duplicating the Core invalid matrix.
- [ ] Add no source-text architecture test that freezes private names or a
      complete implementation inventory.
- [ ] Run the shape-review checks listed in Final Verification.

### Documentation And Decisions

- [ ] Add Decision 0067 with the current accepted contract.
- [ ] Add only a concise narrowing notice to Decision 0063.
- [ ] Leave Decision 0063's historical body intact.
- [ ] Update current architecture, domain, skill, design, and CLI docs.
- [ ] Document the shared mention color and the separate Shot/entity versus
      Generation Preview/media-reference behavior.
- [ ] Include the authoritative terminology sources and product derivation.
- [ ] Do not edit historical plans for a naming sweep.

### Final Verification

- [ ] Run focused Core, Studio, CLI, typecheck, lint, and Chromium checks.
- [ ] Run root `build`, `test`, `lint`, and `check`.
- [ ] Run the sister-skill validation/eval commands.
- [ ] Read the exact real Shot Plan back through the CLI.
- [ ] Verify the supplied desktop route in dark and light themes.
- [ ] Verify exact description copy includes Markdown and canonical handles.
- [ ] Verify mint Shot-description mentions and unchanged mint Generation
      Preview `@ReferenceN` mentions.
- [ ] Verify `24mm lens`, `Deep Focus`, `Focus on …`, and bold brief-card
      entity mentions.
- [ ] Verify plan 0160 Shot rail/media behavior did not regress.
- [ ] Review `git diff --stat` and both complete repository diffs.
- [ ] Inspect every large or heavily modified file.
- [ ] Confirm no `index.ts` became a logic container.
- [ ] Confirm no new god file, catch-all module, broad dispatcher, duplicate
      entity resolver, or generic mention framework was created.
- [ ] Confirm no checklist item was satisfied by accepting unreviewable code
      structure or formatting churn.
- [ ] Only then mark the plan complete.
