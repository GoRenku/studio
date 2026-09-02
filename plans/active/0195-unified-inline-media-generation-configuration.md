# 0195 Unified Inline Media Generation Configuration

Status: implemented; conversational spot checks pending
Date: 2026-09-02

Implementation verification: `pnpm test:media-generation` and `pnpm test` pass
in `studio-skills`, covering 19 canonical models, 47 provider routes, all 22
purposes, prompt guides, and release contracts. The Skill Creator's generic
`quick_validate.py` could not start because both available Python environments
lack its undeclared PyYAML dependency; the repository-owned skill validator
passed. The three real inline Codex spot checks remain deliberately pending so
this implementation does not stage unrelated generation requests or create
test visualizations in the user's conversation.

## Review Attention

- Extend the transient Codex configuration component introduced for
  `cast.voice-sample` and `shot-plan.dialogue-audio` to every image, video, and
  audio purpose currently routed through Media Producer.
- Keep one interaction owner:
  `studio-skills/skills/media-producer/references/inline-generation-configuration.md`.
  The main Media Producer Skill invokes it for every generation; purpose guides
  retain only purpose-specific craft, reference, and fixed-value rules.
- Use the attached voice-sample component as the visual baseline, but render one
  tab-free Configuration surface. Retain the compact card, orderly fields,
  visible values, and full-width continuation action.
- Treat the Project Setting as the initial selection only. List every compatible
  Renku provider and all of its compatible models, including advanced providers
  as explicit one-request choices. Build alternative selectors from their small
  route indexes only. Render controls from the exact live schema for the
  currently prepared provider/model; never prefetch schemas or guides for every
  alternative.
- When Provider or Model changes, hide the old controls, explain that the new
  selection must prepare settings and may recreate the prompt, and send a
  reconfiguration follow-up. Read only that route and update the same
  request-scoped visualization source path with its prompt and controls.
- Keep exact references out of the inline component and review them in the
  existing Generation Preview. Preserve bounded choices already owned by a
  purpose, such as choosing a Cast Voice sample, as configuration controls, but
  do not add a general Asset/file picker in this iteration.
- The button is **Continue with these settings** while the selected route is
  prepared. A provider/model change turns it into **Prepare selected model**;
  only after that preparation does the ordinary continuation place the editable
  prompt first and a two-space-indented JSON configuration second.
- Keep Studio Generation Preview and Asset Inspection unchanged. Preview remains
  the larger prompt editor and exact request/reference review surface; removing
  it later is a separate product decision.
- Keep this a Codex-only convenience. Add no Studio UI, Core/CLI/Engines
  contract, Settings field, route, event, callback, persistence, migration,
  reusable HTML app, or provider call from the component.
- Bump the local Codex plugin cachebuster and reinstall the marketplace-backed
  Renku plugin so new tasks receive the corrected Skill. Existing tasks retain
  the Skill version with which they started.
- Verification stays inside the normal Codex conversation plus existing
  `studio-skills` tests. Do not launch browser windows, start a preview server,
  add Playwright/screenshot machinery, or make paid generation requests.

No behavior outside the user's request is added. No files or project data are
moved or deleted, and no additional product decision is required before
implementation.

## Summary

The latest Studio Skills work gives Cast Voice Sample and Shot Plan Dialogue
Audio requests a useful inline Codex component, but the remaining Media Producer
purposes still go directly from agent-selected defaults to the review document.
Users therefore cannot consistently inspect or adjust a one-request provider,
model, or useful native values for image and video generation.

Generalize the implemented audio pattern instead of creating another system.
Media Producer will prepare a transient request draft, render the shared
component through the installed Visualize capability, and continue from the
prompt plus exact settings returned by its button. Provider Skills and live
schemas remain authoritative, and the existing Studio Preview follows normally.

## Requirement Ledger

| ID | Requirement | Source | Owner | Verification |
| --- | --- | --- | --- | --- |
| R1 | Show the shared component for every supported Media Producer image, video, and audio generation. | User | Media Producer entrypoint | Purpose audit plus image/video/audio checks |
| R2 | Match the current voice-sample styling and interaction. | User + screenshot + plan 0194 | Shared guide + Visualize | Inline comparison at normal conversation width |
| R3 | Treat Project Settings as the initial selection and offer every broadly compatible Renku provider and model as a staged one-request override. | User | Media Producer + provider route indexes | Cross-provider/model switch cases |
| R4 | Initialize values from explicit direction, Project Settings, agent choices, or live-schema defaults, in that order. | User | Shared guide | Initial-value cases |
| R5 | Prefer selects, sliders, booleans, and truthful typed inputs when live schema facts support them. | User | Shared guide + live schema | Representative schema-to-control cases |
| R6 | Omit values that are not meaningful user choices for the purpose. | User | Shared semantic omission rules | Negative field case |
| R7 | Render one tab-free Configuration surface and keep exact reference review in the existing Generation Preview. | User correction after observed safeguard delay | Shared guide | Referenced and reference-free cases |
| R8 | Return editable prompt text before pretty JSON containing exact raw choices. | User | Continuation-message contract | Exact handoff check |
| R9 | Retain Generation Preview and its current prompt/reference/configuration behavior. | User + ADR 0086 | Existing Core/Studio boundary | Diff audit |
| R10 | Share behavior without a persistent schema, duplicate component family, browser automation, or runtime changes. | User + architecture rules | Studio Skills only | Scope and diff audit |
| R11 | Read the Skill, guides, adapter, and live schema only for the currently prepared route; on selection change, prepare only that alternative and update the same pending component path. | User correction after observed slow run | Shared guide + Media Producer | Command-history and staged-switch case |

## Product Behavior

### Covered purposes

The shared step applies to all current entries in
`skills/media-producer/evals/purpose-coverage.json`:

- `image.create`, `image.edit`, and `video.edit`;
- `project.cover`, `lookbook.image`, `lookbook.video-sheet`, and
  `lookbook.storyboard-sheet`;
- `cast.character-sheet`, `cast.profile`, and `cast.voice-sample`;
- `location.sheet`, `location.hero`, `prop.sheet`, and `prop.hero`;
- `scene.storyboard-sheet` and `shot.image`;
- `shot-plan.video-first-frame`, `shot-plan.video-last-frame`,
  `shot-plan.video-storyboard`, `shot-plan.video-reference`, and
  `shot-plan.video-generation`; and
- `shot-plan.dialogue-audio`.

This requirement lives once in the main Media Producer workflow. Do not copy the
same component instructions into twenty-two purpose guides.

### Request sequence

For each pending generation:

1. Read `renku generation context` for the exact purpose and target.
2. Resolve the initial provider from explicit user direction or the matching
   Project Setting, then choose the initial compatible model and operation.
3. Read only each provider's small `supported-routes.json` to build the
   provider/model selectors. Do not read unselected provider Skills, guides,
   adapters, documentation, or live schemas.
4. Read the Skill, canonical model/operation guides, adapter, and live schema
   for only the initial selected route. Apply that guidance to
   prepare the initial authored prompt, exact references, and native values. Do
   not write the review document yet.
5. Render one fresh shared component. Never reuse an earlier component's HTML,
   browser-local values, or provider/model state.
6. Let the user change the prepared route's useful native values or select
   another provider/model. Exact reference review remains in Generation Preview.
7. If Provider or Model changed, hide the old controls, show that preparation is
   required, and use **Prepare selected model** to send a reconfiguration
   follow-up. Read only that selected route's Skill, guides, adapter, and schema;
   verify exact references; re-author the prompt when the canonical model
   changed; and update the same visualization source path with the new prepared
   controls. Do not author the review document.
8. When the selectors match the prepared route, **Continue with these settings**
   sends the prepared prompt followed by exact, pretty-printed settings through
   `window.openai.sendFollowUpMessage`.
9. In the next agent turn, use the returned JSON as the non-prompt request
   choices, author the existing review document, validate it when Engines-owned,
   and continue through current Preview, confirmation, execution, inspection,
   and attachment behavior.

Changing a local control is not confirmation and never begins generation. Only
the follow-up message, or a separate explicit confirmation of unchanged values,
advances the workflow.

### Provider and model switching

- Provider starts from explicit user direction or the current per-media Project
  Setting. This only preselects the control and never filters its options.
- Offer every provider named by the current execution lanes, including
  Replicate and WaveSpeed when they have compatible indexed routes. Choosing an
  advanced provider in the component is the required explicit request; this
  does not promote it into Project Settings or normal defaults.
- Codex appears only when the active harness exposes built-in image generation.
  Its available values come from that capability contract; Studio Skills do not
  invent a provider schema for it.
- Model shows only current routes compatible with the media kind, operation, and
  required input mode according to the small route indexes. Exact schema-level
  reference compatibility is checked only after the user selects an alternative.
- The initial component reads only the selected route's schema and shows only
  that route's native controls. It does not inspect, cache, or embed every
  alternative route's schema or control set.
- Changing provider rebuilds the model list, hides the prepared route's controls,
  displays the reconfiguration message, and changes the action to **Prepare
  selected model**. The next agent turn reads only that selected route and
  updates the same pending component source path.
- If the selected route cannot carry a required appearance authority, first/last
  frame, source video, voice, or other non-negotiable reference, keep the prior
  prepared selection and explain the incompatibility rather than dropping the
  reference.
- When the canonical model is unchanged, preserve a native value only when the
  destination schema accepts the same exact property path, type, and value.
  Never carry fields by matching labels or guessing equivalents.
- Purpose, target, and compatible exact references remain stable across a
  switch. References are not rendered in this component. If a switch cannot
  represent a required reference, keep the prior prepared selection rather than
  dropping the reference; the user may request a deliberate downgrade in
  conversation.
- A canonical model change causes the next agent turn to re-author the prompt
  from the selected model and operation guides while preserving the user's
  intent and explicit facts. A provider-only change for the same canonical model
  retains the prompt and applies only adapter-required reference notation.

### Shared composition

Use the attached voice-sample component as the baseline: one compact bounded
surface, concise title/context, restrained hierarchy, orderly fields, visible
current values, and one primary action spanning the content width.

Render Configuration directly with no tabs. Do not show reference thumbnails,
labels, paths, marker objects, or a References section. Generation Preview
remains the exact reference review surface. Preserve bounded choices already
owned by a purpose, such as choosing a compatible Cast Voice sample, as ordinary
configuration controls. Add no general Project Asset browser, file picker,
upload, drag/drop, reference-role editor, or durable reference selection.

- Show Provider and Model first, followed by useful route-native controls for
  the currently prepared selection only, in the same orderly grid as the
  current audio component.
- Put each numeric label and formatted current value together above its control;
  update that value as the control changes.
- Prefer natural component growth to cramped controls or an inner scrolling
  form.

Keep the primary action below the configuration fields. It is **Continue with
these settings** for the prepared route and **Prepare selected model** while a
different Provider or Model is selected. The installed Visualize Skill remains
the authority for styling, theme, spacing, accessibility, and control
primitives. The Renku guide defines only this composition and behavior; it must
not copy the Visualize design system or add purpose-specific CSS.

### Schema-informed controls

Map only explicit schema facts:

- a scalar `enum`, scalar `oneOf`, or other finite schema-authored choice uses a
  select with readable labels and exact raw values;
- a number or integer with a finite minimum, maximum, and usable step uses a
  slider with its current value and schema-authored units;
- a useful numeric value without a truthful bounded range uses a numeric input;
- a boolean uses an accessible checkbox/switch, with a visible state label when
  the field label is ambiguous;
- a useful short scalar string may use a text input when it is not prompt-like
  and the schema gives it clear meaning; and
- a nested object is decomposed only when its child fields independently satisfy
  these rules. Do not expose raw JSON editing.

Initial values use this precedence: explicit user direction, applicable Project
workflow preference, agent-authored request value, then live-schema default.
Friendly labels and units are display-only. The handoff retains exact raw values
and enough precision to distinguish adjacent valid choices.

Omit fields that are not meaningful one-request user choices:

- prompt and negative-prompt text, because the Codex handoff and retained
  Preview own prompt editing;
- local-file marker objects, upload URLs/handles, native mention bookkeeping,
  and reference-order internals, which remain provider/request construction;
- credentials, authentication, callbacks, webhooks, queues, polling, delivery,
  storage, and output URLs;
- provider debug/internal fields without a clear creative or output decision;
- values fixed by the purpose, including required media kind, input mode, exact
  output count, or deterministic sheet layout; and
- unavailable, deprecated, read-only, or untruthfully renderable fields.

Do not infer inclusion from familiar field names. If the inspected schema does
not provide enough information to present a value truthfully, omit the control
and keep the prepared request value unchanged.

### Prompt and JSON handoff

The acceptance action is available only while Provider and Model match the
prepared selection. It is **Continue with these settings**, with optional
confirmation title **Continue with generation settings**. The follow-up message
is:

```text
Use this prompt for the pending <purpose> generation:

<exact current authored prompt>

Use this exact one-shot generation configuration:
```

The message then includes a JSON block with two-space indentation and this key
order:

```json
{
  "purpose": "<purpose>",
  "target": "<target>",
  "provider": "<provider>",
  "model": "<exact executable provider model id>",
  "references": [],
  "controls": {}
}
```

`references` preserves the existing exact request marker or purpose-specific
voice identity shapes; do not invent a normalized reference DTO. `controls`
uses exact provider-native field names and raw values. Generate the JSON with
`JSON.stringify(value, null, 2)` rather than manually concatenating minified
JSON.

The prompt stays outside JSON so the user can edit it without also updating a
duplicate prompt field. This handoff is transient conversation text, not a new
persisted schema or runtime-validated contract.

### Preview and Inspection remain unchanged

After the handoff, Media Producer writes the existing review envelope and opens
Generation Preview when Project policy or explicit user direction requires it.
Preview still provides the larger editable top-level prompt, exact References
and Configuration tabs, Update/Close, and ordinary conversational confirmation.
It gains no Generate action or agent-resume callback. Asset Inspection remains
the same read-only request view.

## Explicit Non-Goals

- Do not remove or redesign Generation Preview or Asset Inspection.
- Do not add a Studio model picker, generation button, React component, server
  route, coordination event, callback, resumable task, or browser-to-agent
  protocol.
- Do not persist choices to Project Settings, Project SQLite, a setup document,
  or a review document before the user continues.
- Do not create checked-in provider schemas, control descriptors, normalized
  field metadata, capability matrices, or per-purpose component copies.
- Do not add arbitrary reference browsing/picking or new providers, models,
  purposes, Settings options, or paid-generation coverage.
- Do not launch external browsers, run preview servers, add Playwright or
  screenshot automation, or introduce a reusable HTML application.

## Context And Evidence

### Accepted constraints

- ADR 0041 keeps creative prompt/media content opaque to Studio runtime code.
- ADR 0086 assigns provider/model selection and native request authorship to
  Media Producer/provider Skills while retaining conversational Preview.
- ADR 0087 keeps Core generation context advisory rather than a provider or
  reference allowlist.
- ADR 0088 preserves exact request references and provider-native mentions.
- ADR 0090 establishes the request-scoped inline audio configuration pattern.
- `docs/architecture/media-generation.md` makes live schemas the technical
  field authority while keeping Studio's saved-request renderer schema-free.
- `docs/architecture/reference/studio-skills.md` assigns operational agent
  workflows to the sister Skills repository.

### Current implementation

- Studio Skills commit `5fbb9b3` introduced
  `references/inline-generation-configuration.md`. It already owns fresh
  instances, visible numeric values, raw-value preservation, and the
  `sendFollowUpMessage` handoff.
- Only `cast-voice-sample.md` and `shot-plan-dialogue-audio.md` currently require
  that component.
- `media-producer/SKILL.md` already centralizes purpose routing, Project Setting
  defaults, provider/model guide selection, live schema inspection, review
  documents, Preview, execution, and attachment.
- Provider `supported-routes.json` indexes and
  `model-guides/model-catalog.json` already provide curated route/model identity
  without duplicating native request schemas.
- `evals/purpose-coverage.json` lists twenty-two purposes, while
  `evals/forward-test-cases.md` contains only an audio-specific component case.
- The attached screenshot establishes the current visual baseline.

### Overlap and right-sized choice

Plans 0189, 0191, 0192, and 0193 own the provider-Skill boundary, deterministic
context, live schema inspection/exact references, and current image/video
routing. Implemented plan 0194 is the direct audio interaction baseline. Do not
rewrite those plans.

Options considered:

1. Leave the audio-only contract unchanged: insufficient because image/video
   purposes still skip the requested convenience.
2. Extend the existing shared guide and call it from the main Media Producer
   flow: selected because it adds one owner and no runtime machinery.
3. Add a persistent component library, schema projection, or Studio surface:
   rejected because it duplicates Visualize/live schemas and expands the task.

## Architecture Shape Gate

### Owners and entrypoints

- `studio-skills/skills/media-producer/SKILL.md` remains the public workflow
  entrypoint. It adds one cross-purpose step after prompt/request preparation and
  before review-document authorship.
- `studio-skills/skills/media-producer/references/inline-generation-configuration.md`
  is the single Renku interaction owner for composition, schema-to-control
  selection, switching, omissions, and continuation formatting.
- Visualize remains the styling/accessibility/control owner.
- Purpose guides own only creative craft, required inputs, fixed purpose facts,
  and meaningful purpose-specific choices. Provider Skills continue to own
  route indexes and live schema access.
- Current Studio architecture docs record the cross-repository boundary. They
  do not define a new runtime UI contract.

There are no TypeScript modules, `index.ts` files, registries, public runtime
types, routes, or database owners in this plan.

### Planned files

```text
studio-skills/.codex-plugin/plugin.json
studio-skills/skills/media-producer/SKILL.md
studio-skills/skills/media-producer/references/inline-generation-configuration.md
studio-skills/skills/media-producer/references/cast-voice-sample.md
studio-skills/skills/media-producer/references/shot-plan-dialogue-audio.md
studio-skills/skills/media-producer/evals/forward-test-cases.md
studio/docs/architecture/media-generation.md
studio/docs/architecture/reference/studio-skills.md
```

The main Skill gains only the shared step and remains a thin orchestrator. The
two audio guides retain only their distinct voice/reference constraints. No
other purpose guide needs a copied section. Provider indexes, the model catalog,
purpose coverage manifest, validators, and runtime code remain unchanged.

### Forbidden shapes and stop conditions

Do not add a component guide per purpose/provider/model, a checked-in control
registry, component-side API calls, a permanent HTML file, a provider switch
statement in each guide, or heuristic cross-model value/reference conversion.

Do not prefetch every selectable route's Skill, schema, guide, adapter, or
documentation, and do not build a global or cross-task component cache. Reusing
the same visualization source path is limited to provider/model preparation for
one pending generation request.

Stop and revise if truthful rich controls require copied provider metadata; a
provider/model switch exposes an unresolved required-reference choice; the main
Skill starts collecting model-specific fields; the shared reference becomes a
provider catalog; or implementation starts touching runtime code, Settings,
routes, persistence, or browser automation.

## Contracts

The main Skill adds one mandatory step named **Configure the pending request in
Codex**. It consumes existing transient workflow facts: purpose, target,
workflow policy, initial provider/model, authored prompt, exact proposed
references, the selected route's inspected live schema, and initial native
values. A provider/model change returns a reconfiguration follow-up and updates
the same pending visualization; an accepted prepared selection returns the
ordinary Codex follow-up described above.

This adds no TypeScript interface, JSON Schema, file contract, CLI command, or
diagnostic. The existing review/provenance envelope stays unchanged:

```ts
{
  provider: string;
  model: string;
  mediaKind: 'image' | 'video' | 'audio';
  prompt: string | null;
  request: JsonValue;
}
```

Image/video purpose guides do not gain native field lists. Their current
purpose/operation/reference rules plus the selected live schema are sufficient
to expose aspect ratio, size, resolution, duration, frame rate, seed, output
format, or another useful value when the schema truthfully supports it.

## Implementation Slices

### 1. Generalize the shared guide

Expand `inline-generation-configuration.md` with the tab-free configuration
composition, lazy provider/model switching, schema-to-control rules, omission
rules, exact action copy, same-request source reuse, and prompt-plus-JSON
formatting. Preserve its current fresh-instance, visible-value, raw-value,
accessibility, and transient-state rules.

### 2. Put the step in the common workflow

Update `media-producer/SKILL.md` to prepare the initial prompt and values, invoke
the shared component for every purpose, and continue from its returned message
before writing the review document. Keep Preview, validation, execution,
recovery, inspection, and attachment unchanged.

Reduce the two audio purpose sections to their distinct voice/reference/control
constraints plus the shared-guide link. Do not add parallel sections elsewhere.

### 3. Extend representative evals

Update `evals/forward-test-cases.md` with:

- one referenced image case covering provider/model switching, tab-free
  configuration, selected-route-only schema loading, same-path reconfiguration,
  enum/select and bounded-number/slider controls, exact hidden-reference
  preservation, and prompt-plus-JSON handoff;
- one referenced Shot Plan video case covering compatible route switching and
  required-reference preservation;
- the existing audio case updated for the tab-free configuration and common
  handoff; and
- one negative case covering prompt-like, transport, credential/callback,
  workflow-fixed, and untruthfully renderable fields.

Keep `purpose-coverage.json` and `validate-media-purpose-evals.mjs` unchanged;
the common entrypoint already covers the full inventory. Do not add brittle
tests for private wording, generated HTML structure, Visualize class names, or
provider field inventories.

### 4. Align current documentation

Update `docs/architecture/media-generation.md` and
`docs/architecture/reference/studio-skills.md` to record the transient
schema-informed pre-review component and distinguish it from Studio's
schema-free saved-request renderer. No ADR is needed because current ownership,
Preview, and runtime contracts do not change.

## Tests And Guardrails

Skill evals cover:

- entry through the common flow for representative image, video, and audio;
- Project Setting initialization and request-only switching;
- lightweight route-index selector discovery and schema inspection for only the
  currently prepared route;
- enum, bounded number, boolean, and useful scalar controls;
- display labels/units without raw-value or precision changes;
- staged route switching without eager schema reads, stale native fields, or
  silent reference loss;
- prompt first, pretty JSON second, with exact native values; and
- no review document or generation from unsent component-local state.

Diff inspection confirms:

- no copied schemas, control descriptors, provider matrices, per-purpose
  component shells, or Visualize CSS;
- no production code, Settings, route, database, migration, callback, resume,
  browser-launch, or persistent HTML changes; and
- existing Preview and Inspection files/contracts are untouched.

## Documentation And ADR Effects

- Update only the two current architecture references named above.
- Do not change ADR 0086 or ADR 0090; this plan extends their existing
  Skill-owned transient behavior.
- Do not edit completed plans 0189, 0191, 0192, 0193, or 0194.
- No CLI, setup, Settings, provider, release, or migration docs change.

## Final Verification

Run from `studio-skills`:

```bash
pnpm test:media-generation
pnpm test
```

Perform three bounded checks in an ordinary Codex conversation without an
external browser, preview server, Playwright, screenshots, or paid generation:

1. A referenced image request whose Project default is Codex: confirm all
   broadly compatible Renku providers and models appear from route indexes while
   only the Codex contract is initially inspected. Confirm no reference content
   or tabs appear, switch provider/model, confirm the preparation notice, then
   confirm only that selected route is loaded into the same component source
   path before changing one enum and bounded number and inspecting the
   model-appropriate prompt plus pretty JSON.
2. A referenced Shot Plan video request: verify required references remain in
   the handoff and Preview while only compatible route switches are offered.
3. A Cast Voice Sample or Shot Plan Dialogue Audio request: confirm the existing
   visible values, reference choice, and raw-value handoff did not regress.

Finally inspect `git diff --stat` and complete diffs in both repositories,
confirm the main Skill remains thin, reread the full shared guide, confirm only
the planned Skill/eval/docs files changed, and remove any unrelated formatting
churn. Root Studio checks are unnecessary while no production code changes. If
implementation needs production code, stop and revise this plan first.

## Completion Checklist

### Review Area

- [x] Confirm every current Media Producer purpose enters the shared component
      through the main Skill.
- [x] Confirm the screenshot's compact composition remains the baseline, with
      one tab-free Configuration surface.
- [x] Confirm Preview and Inspection remain present and unchanged.
- [x] Confirm there are no runtime, Settings, persistence, migration,
      browser-launch, file-move, deletion, or paid-generation effects.
- [x] Refresh the local plugin cachebuster and reinstall Renku so new tasks load
      the corrected Skill version.
- [x] Confirm the final file shape matches the Architecture Shape Gate.

### Architecture And Contracts

- [x] Keep `media-producer/SKILL.md` as the one cross-purpose entrypoint.
- [x] Keep `inline-generation-configuration.md` as the one Renku interaction
      owner and Visualize as the styling/control owner.
- [x] Keep provider indexes and live schemas authoritative; add no copied
      schemas, field maps, descriptors, or capability matrices.
- [x] Read alternative route indexes only; never prefetch unselected provider
      Skills, guides, adapters, documentation, schemas, or controls.
- [x] Keep Core context advisory and the review/provenance envelope unchanged.
- [x] Add no public schema, command, route, diagnostic, callback, event, wrapper,
      compatibility layer, or resume protocol.

### Shared Inline Experience

- [x] Render Configuration directly with no tabs or inline reference section.
- [x] Initialize provider/model/values in the documented precedence order and
      keep all changes request-scoped.
- [x] Treat the Project provider as initial selection only and show every
      broadly compatible indexed Renku provider/model without inspecting every
      alternative schema before rendering.
- [x] On provider/model change, hide the old controls, show the preparation
      notice, and use **Prepare selected model** rather than accepting settings.
- [x] Read only the selected alternative route, then update the same pending
      visualization source path with its prompt and controls.
- [x] Rebuild native controls without guessed field conversion or silent
      required-reference loss.
- [x] Keep exact references out of the component while preserving them for the
      handoff and existing Generation Preview; add no general reference picker.
- [x] Put Provider and Model first and use the shared compact field layout.
- [x] Use selects for finite choices, sliders for truthful bounded ranges,
      accessible booleans, visible values/units, and limited useful scalar
      inputs.
- [x] Omit prompt-like, transport, credential, callback, workflow-fixed,
      provider-internal, unavailable, and untruthfully renderable fields.
- [x] Keep one full-width **Continue with these settings** action below the
      configuration fields.
- [x] Create no global or cross-task component/schema cache.

### Prompt And JSON Handoff

- [x] Prepare the initial authored prompt before rendering without writing the
      review document.
- [x] Return the editable exact prompt first and two-space-indented JSON second.
- [x] Keep stable purpose, target, provider, model, references, and controls key
      order and exact raw values.
- [x] Reuse existing exact reference marker/voice identity shapes rather than
      adding a normalized reference DTO.
- [x] Re-author the prompt from the selected canonical model and operation
      guides when the model changes; retain it for a provider-only switch of the
      same canonical model.
- [x] Keep reconfiguration follow-ups distinct from settings acceptance and do
      not author a review document until the prepared selection is continued.
- [x] Treat only the returned message or explicit unchanged-value confirmation
      as accepted state.
- [x] Author the existing review document afterward and preserve Preview.

### Purpose Guidance And Evals

- [x] Keep Cast Voice Sample and Shot Plan Dialogue Audio purpose-specific voice
      and reference rules without duplicating the shared component contract.
- [x] Let image/video controls come from purpose/operation guidance plus live
      schema facts, not copied field lists.
- [x] Add representative referenced-image, Shot Plan video, updated audio, and
      negative-field eval cases.
- [x] Keep the current purpose manifest/validator; add no brittle implementation
      name or generated-markup test.
- [x] Run `pnpm test:media-generation` and `pnpm test` in `studio-skills`.
- [ ] Complete the three inline Codex checks without external browser or paid
      generation activity.

### Documentation And Final Verification

- [x] Update the current media-generation and Studio Skills architecture
      references; leave ADRs and completed plans unchanged.
- [x] Review `git diff --stat` and complete diffs in both repositories.
- [x] Confirm only planned Skill/eval/docs files changed and remove formatting
      churn.
- [x] Inspect the main Skill and shared guide for duplicated model/purpose logic,
      copied schemas, or an overgrown entrypoint.
- [x] Confirm no production source, `index.ts`, route, public type, schema,
      migration, broad dispatcher, catch-all helper, or parallel component
      contract was added.
- [x] Confirm no checklist item was satisfied by copying the shared behavior
      across purpose files.
- [ ] Only then mark the plan complete.
