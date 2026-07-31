# 0164 First-Class Props Continuity Subjects

Status: completed
Date: 2026-07-30
Completed: 2026-07-30

## Summary

Add Props as a third first-class continuity-subject family beside Cast Members
and Locations.

Props will be durable project data with:

- ordered Prop facts and agent-authored Prop Design history in project SQLite;
- `renku prop` and `renku production-design prop` authoring commands;
- Prop-owned `prop_sheet` and `prop_hero` image Assets;
- `prop.sheet` and `prop.hero` generation purposes;
- exact, request-scoped Prop Sheet choices and one optional canonical Prop Hero;
- a bookmarkable Studio overview and Prop detail surface;
- a sidebar section directly below Locations and directly above Acts;
- the same Studio information architecture and visual layout as Locations:
  overview cards, then a Prop detail surface with Details and Assets tabs;
- Production Designer and Media Producer skill guidance, samples, and evals.

This is not a UI-only addition. Prop identity, delete safety, design history,
Asset ownership, canonical selection, generation attachment, path allocation,
and resource invalidation belong to `packages/core`. CLI and Studio adapters
remain thin.

The implementation should use the third continuity subject to remove concrete
Cast/Location duplication, but it must not create a universal entity,
department, Asset, generation, route, or React configuration framework. The
right-sized shared boundary is:

- Core keeps domain-specific Prop contracts and commands;
- existing common Asset ownership and canonical selection are extended with
  the focused Prop capability;
- shared Cast/Location/Prop resource projection and Studio presentation
  mechanics are extracted where three current callers now need the same
  behavior;
- Cast-only voice behavior, Location-only screenplay references, and
  Prop-specific design semantics stay in their domain owners.

The real `urban-basilica` project proves that this is not an empty-model
exercise. Its active Location Designs currently contain fourteen local
`propsAndRecurringObjects` entries across the Edirne Foundry, Imperial Council
Chamber, and Theodosian Walls, including the bombard mold, cannon drawing,
coin tray, maps, repair timber, stone shot, and defense equipment. The helmet
currently appears as research or Cast continuity media. Those records are
useful evidence, but they must not all be automatically promoted into
first-class Props: several are grouped set dressing, crews, silhouettes, or
location-local equipment rather than reusable continuity subjects.

The proposed launch model therefore distinguishes:

- a **Prop**, which has durable project identity and can own media; from
- a **Location Recurring Object**, which remains local guidance inside one
  Location Design and has no independent media ownership.

The plan recommends creating explicit first-class sample Props for the cannon
and helmet after migration, without reparenting or silently sharing their
existing Cast, Lookbook, Location, or research media.

## Requirement Ledger

| Requirement | Source | Planned result |
| --- | --- | --- |
| Add a new Props section to Studio. | User | First-class Props overview and detail surfaces. |
| Put Props below Locations and before Acts in the sidebar. | User | `ProjectShell.navigation.props`, Prop counts, URL-owned selection, and sidebar ordering. |
| Match the Location layout exactly, except for Prop-specific facts and copy. | User | Same card grid geometry, detail feature-image geometry, Details/Assets tabs, collection order, and shared MediaCard behavior. |
| Give each Prop Details and Assets tabs. | User | `PropDetailsTab` and `PropAssetsTab` under one `PropPanel`. |
| Use Prop Sheets as continuity images. | User | Prop-owned `prop_sheet` Assets and `prop.sheet` generation/import. |
| Use one Hero Image in the UI. | User | Prop-owned `prop_hero` candidates with zero-or-one canonical selection. |
| Investigate the complete Location path before planning Props. | User | Plan covers facts, design history, SQLite, commands, Assets, generation, Preview, Studio resources, routes, UI, skills, and real project data. |
| Reuse common Cast/Location/Prop behavior instead of adding a third copy. | User | Bounded continuity-subject resource, owned-image, overview, details-image, and Assets-tab refactors. |
| Keep business rules in Core. | Repository architecture gate | Core owns Prop identity, validation, deletion, design history, generation bindings, attachment, selection, and resource keys. |
| Keep AI artifacts and prompts opaque. | ADR 0041 and repository rules | Prop Sheet contents are inspected by agents/users only; runtime validates the owned envelope, never panels, angles, labels, materials, or visual match. |
| Keep Prop Sheets request-scoped. | ADRs 0049, 0051, and 0064 | No global Prop Sheet selection and no implicit first-candidate choice. |
| Keep Prop Hero selection display-only. | Location precedent and ADR 0064 | Selected Prop Hero drives overview/detail display and never becomes a hidden generation reference. |
| Preserve URL-owned Studio navigation. | ADR 0008 | `/projects/:projectName/props` and `/projects/:projectName/props/:propId`. |
| Preserve scalable resource loading and scoped refresh. | ADRs 0017, 0030, and 0054 | Bounded shell navigation, lazy detail/Asset resources, `navigation:props`, and `surface:prop:<id>`. |
| Use the existing shared MediaCard design. | ADRs 0023, 0053, 0065, and 0066 | No Prop-specific card primitive, preview dialog, selection control, or collection component. |
| Update the Studio Skills sister project. | User | Production Designer, Media Producer, Movie Director, samples, references, and evals gain coarse Prop intent. |
| Use realistic sample evidence. | User and repository instructions | Migrate and smoke-test an isolated copy of `urban-basilica`; explicitly author cannon and helmet Props after product approval. |
| Identify meaningful Prop differences that require product input. | User | Product gates below cover facts, design shape, classification, relationships, and sample-media treatment. |

## Product Decisions Required Before Implementation

The plan is implementation-ready only after the following product decisions
are accepted or revised. Recommended defaults are included so review can be
concrete.

### Decision 1: launch Prop facts

Recommended launch contract:

```ts
export interface Prop {
  id: string;
  handle: string;
  name: string;
  description?: string;
  visualNotes?: string;
}
```

Do not add a closed `category`, `type`, `department`, `size`, `owner`,
`locationId`, or `castMemberId` field in the first slice.

Why:

- the cannon, helmet, council table, document, vehicle-like object, and symbol
  examples do not share a trustworthy closed taxonomy;
- `Asset.type` already has a different meaning;
- a generated category would violate the intentional-copy rule when shown on
  overview cards;
- project-level continuity identity is useful before relationship modeling is
  accepted.

With this default, Prop overview cards show the user-authored name and no
invented subtitle. The detail surface shows name, description, and Visual
Notes. This preserves the Location layout without copying Location's
`timePeriod` fact into an object domain where it is not clearly meaningful.

Product input:

- Is a user-authored category or short role required at launch?
- If yes, what exact domain name and open/closed value contract should it use?

### Decision 2: launch Prop Design document

Recommended launch contract:

```ts
export interface PropDesignDocument {
  kind: 'propDesign';
  propId: string;
  title?: string;
  design: {
    designThesis: string;
    formAndSilhouette: string[];
    materialsAndSurfaces: string[];
    constructionAndFunction: string[];
    scaleAndHandling: string[];
    statesAndVariants: string[];
    continuity: string[];
    propSheetGuidance: string[];
    generationGuidance: string[];
  };
  openQuestions?: string[];
}
```

This is the Prop equivalent of Location Design, not a clone of spatial fields.
It provides enough durable continuity guidance for an object without
introducing rigging, inventory, procurement, fabrication, scene breakdown, or
shot-use models.

The validator owns only structure, owner identity, required/non-empty fields,
and duplicate-free exact collections where the current department-document
rules already do so. It does not semantically classify or rewrite creative
text.

Product input:

- Is this initial design vocabulary sufficient?
- Should `constructionAndFunction` remain one axis or be split into two?
- Are `statesAndVariants` needed immediately for intact/damaged, open/closed,
  loaded/unloaded, clean/aged, or before/after continuity?

The recommendation is to keep the shown shape. It is smaller than a complete
physical-production prop breakdown while covering the continuity questions the
current cannon and helmet examples need.

### Decision 3: first-class Prop versus Location Recurring Object

Recommended rule:

- A first-class **Prop** is deliberately authored when an object needs identity
  across locations, scenes, Cast interactions, generation requests, or media.
- A **Location Recurring Object** is local set-dressing or production-design
  guidance inside one Location Design and has no independent identity or media.
- Do not automatically promote Location Design entries into Props.
- Do not add a Prop-to-Location relationship in this slice.

To make that distinction legible in current code and JSON:

- rename `ProductionDesignProp` to `LocationRecurringObject`;
- rename `LocationDesign.design.propsAndRecurringObjects` to
  `LocationDesign.design.recurringObjects`;
- update current callers directly;
- use one explicit migration to rewrite existing stored Location Design JSON;
- add no old-field reader, alias, fallback, or obsolete-shape diagnostic.

This rename does not discard the fourteen `urban-basilica` entries. It makes
their local ownership explicit. The cannon may remain mentioned as local
Location guidance while a separately authored Prop carries the reusable
continuity identity.

Product input:

- Accept the local-versus-first-class distinction and JSON rename?
- Or should all Location recurring objects be removed in favor of first-class
  Prop ids? The latter is not recommended until Prop-to-Location relationships
  and historical document behavior are designed.

### Decision 4: what physical subjects count as Props

Recommended initial rule:

> A Prop is any deliberately authored physical object or object-like continuity
> subject that benefits from independent visual identity. Size, wearability,
> mobility, and current holder do not exclude it.

Under that rule:

- the cannon is a Prop even though it is large and location-defining;
- the helmet may be a Prop even when worn by a Cast Member;
- wardrobe as a whole remains Cast Design unless an individual item needs
  independent continuity media;
- vehicles, ships, symbols, and architecture are not automatically Props, but
  may be authored as one if the user deliberately chooses that identity;
- Core never infers this classification from prompt text, media pixels,
  filenames, screenplay prose, or Location Design text.

Product input:

- Confirm that wearable and large objects are allowed as Props.
- Confirm that no separate Costume, Vehicle, or Architecture subject is needed
  in this implementation.

### Decision 5: relationships and downstream use

Recommended launch boundary:

- Props are project-level continuity subjects.
- There is no Prop-to-Scene, Prop-to-Beat, Prop-to-Shot, Prop-to-Cast, or
  Prop-to-Location join in this slice.
- Screenplay JSON does not gain `propIds`.
- Shot and video generation guides do not automatically create Prop Sheet
  slots.
- Agents may still use an exact Prop Sheet as an explicitly authored
  additional reference when the current generation contract supports it.

This avoids turning the plan into a universal dependency or continuity graph.
A later product decision can add one focused relationship when a concrete
consumer requires it.

Product input:

- Is project-level inventory sufficient for launch?
- If one relationship is essential now, which exact consumer owns it and what
  behavior depends on it?

### Decision 6: Hero geometry and overview treatment

Recommended default: match Location exactly.

- `prop.hero` fixes a 16:9 generated output.
- The overview card uses the current Location 4:3 frame with `cover`.
- The Details feature image measures the actual image and falls back to 16:9.
- The Hero collection uses the current Location 16:9 fallback, 320-pixel
  minimum cards, and `cover`.
- The Prop Sheet collection uses the current Location 4:3 fallback,
  480-pixel minimum cards, and `contain`.

Product input:

- Accept the exact Location geometry, even though isolated objects are often
  shown square?

The recommendation is yes for the first slice because the user explicitly
requested the Location layout. A future design change should update the
product contract deliberately rather than silently making Prop cards square.

### Decision 7: `urban-basilica` seed content and existing media

Recommended development-project update:

- author a Cannon Prop and a Helmet Prop through `renku prop apply`;
- author active Prop Designs through `renku production-design prop write`;
- do not infer all fourteen Location recurring objects as Props;
- do not reparent existing Assets from Cast, Location, or Lookbook owners;
- do not convert the research helmet file into durable Prop media without
  explicit acceptance;
- when an existing visual should also become Prop media, import it into a new
  Prop-owned Asset/File identity through the focused media path.

This follows exclusive Asset ownership. One Asset is never shared by a
Lookbook and a Prop merely because the pixels are useful to both.

Product input:

- Which exact cannon and helmet names/descriptions should become accepted
  sample facts?
- Should existing research or generated images be imported as independent Prop
  Assets, or should the sample Props start without media?

## Product Behavior

### Prop facts and ordering

- Props are project-owned, ordered durable facts.
- Handles are unique across Cast Members, Locations, and Props so `@handle`
  vocabulary cannot become ambiguous.
- Add, update, delete, and move operations follow the existing Cast/Location
  operation-document pattern.
- New records use request-local `key`; existing records use durable `id`.
- Validation collects all actionable issues before the write.
- Delete fails before mutation when the Prop owns active or discarded Assets,
  has Prop Design history or active-state data, or is referenced by another
  accepted current contract.
- Because this plan adds no Prop relationships, delete does not scan screenplay
  text or creative prompts for semantic mentions.
- Successful fact mutations return `project-shell`, `navigation:props`, and
  the affected `surface:prop:<id>` keys as appropriate.

### Prop Design

- Each Prop can have many immutable Prop Design documents and zero or one
  active document.
- `write` creates history and makes the new document active atomically.
- `set-active` can select only a design owned by the exact Prop.
- Stored JSON is validated before writes and after reads.
- Unknown fields fail under the current strict department-document contract.
- Prop Design stores design and continuity guidance, not media paths, provider
  payloads, generation specs, shot coverage, scene usage, or inventory counts.

### Prop Sheets

- A Prop can own many active `prop_sheet` image Assets.
- Each Prop Sheet has one primary image file and a concise Asset description.
- A Prop Sheet is one opaque full-image continuity board.
- Studio runtime does not require a panel count, angle list, label, scale
  ruler, material swatch, readable caption, state comparison, or object match.
- There is no global selected Prop Sheet.
- `prop.sheet` context exposes same-Prop Prop Sheet candidates in an optional,
  cardinality-one continuity slot.
- The agent or user chooses an exact candidate or none for each request.
- A sole candidate remains unselected until explicitly chosen.
- `prop.sheet` initially recommends the same 16:9, high-quality GPT Image 2
  route as Character and Location Sheets, subject to the current model catalog
  returned by context.

### Prop Heroes

- A Prop can own many active `prop_hero` image candidates.
- Common selection chooses zero or one current Prop Hero.
- The selection drives Prop overview and Details display only.
- Selection never initializes a generation reference.
- `prop.hero` exposes an optional `source/prop-sheet` slot.
- The agent or user chooses the exact source Prop Sheet or none; Core never
  initializes the first candidate.
- `prop.hero` initially fixes 16:9 and recommends the same medium-quality Nano
  Banana 2 path as Location Hero, subject to the current model catalog.
- Import with `--select` attaches and selects the accepted Hero atomically.

### Studio overview and detail

Props are URL-owned:

```text
/projects/:projectName/props
/projects/:projectName/props/:propId
```

The sidebar order is:

```text
Cast
Locations
Props
Acts
```

The Props section:

- shows the Prop count from `ProjectCounts.props`;
- expands to ordered Prop navigation rows;
- routes its section label to the overview;
- routes a child row to the exact Prop;
- uses a deliberate object/package icon from the existing icon library;
- participates in coordination focus, selection context, validation, and
  scoped refresh.

The overview matches Locations:

- 260-pixel minimum MediaCards;
- roomy grid gap;
- 4:3 frame;
- selected Prop Hero with `cover` and zoom-on-hover;
- name as the only required overlay copy;
- quiet image empty state;
- whole-card callback navigation.

The detail surface matches Locations:

- LineTabs with `Details` then `Assets`;
- the Details tab uses the shared continuity feature-image presentation;
- selected Prop Hero at left and facts at right;
- name, optional description, and optional Visual Notes;
- no invented category chip, filename, Asset id, handle, or generic subtitle;
- image activation opens the existing shared Preview.

The Assets tab matches Locations:

1. Hero Images;
2. Prop Sheets.

Hero cards expose canonical-selection toggle, image Preview, and deletion under
the existing Asset lifecycle. Prop Sheet cards expose image Preview, generation
request inspection, and delete, but no global selection. This matches the
current Location surface: generation-request inspection belongs to the sheet
cards, not the Hero cards.

### Generation Preview

- Preview titles include `Prop Sheet Generation Preview` and
  `Prop Hero Generation Preview`.
- `GenerationPreviewSubject` gains `locationLabel` and `propLabel`; the current
  Location omission is corrected while adding Props.
- A focused Core subject resolver reads labels for Cast Member, Location, Prop,
  and Scene targets. It preserves any separately owned Shot/Take label
  projection accepted by Plan 0162 without moving that behavior into the
  continuity subject branch.
- The resolver returns facts only. It does not inspect prompt text or media.
- Preview reference slots show the exact current Prop Sheet choice and eligible
  candidates using the existing shared image authoring UI.
- Studio Preview remains purpose-agnostic outside its title map and rendered
  Core contract. It does not add Prop-specific selection or validation logic.

### Agent workflow

Production Designer owns:

- Prop fact authoring;
- Prop Design history and active selection;
- the local-versus-first-class classification decision with the user;
- Prop Sheet and Hero readiness handoff.

Media Producer owns:

- reading `renku prop context` for Prop facts, active Prop Design, current
  Assets, and readiness before authoring media;
- `prop.sheet` and `prop.hero` generation context;
- model selection from current context/catalog;
- exact prompt and reference authoring;
- saved Preview, estimate, approval, run, inspection, and focused import;
- Prop Sheet/Prop Hero visual review through agent vision;
- `--select` only for accepted Prop Heroes.

The Prop Sheet board-design reference may recommend useful coverage such as:

- dominant identity view;
- necessary alternate angles;
- silhouette and scale;
- materials and finish;
- distinctive marks;
- construction or moving parts;
- handling/interaction scale;
- state, wear, aging, or damage variants.

Those are agent-owned creative recommendations. They must not become fields in
Asset DTOs, generation schemas, Preview state, runtime image validation, or
Studio UI requirements.

## Explicit Non-Goals

This plan does not:

- add Props by filtering generic Assets in React;
- add a generic `Entity`, `Subject`, `DepartmentObject`, or `ContinuityItem`
  database table;
- merge Cast Members, Locations, and Props into one public fact schema;
- add a universal CRUD command framework or arbitrary state-patch API;
- add Prop relationships to Scenes, Beats, Shots, Cast Members, Locations,
  dialogue, screenplay blocks, or Generation Specs;
- parse screenplay prose or prompts to infer Props;
- automatically promote Location recurring objects into Props;
- move or share an existing Asset between owners;
- add global Prop Sheet selection;
- auto-select the only Prop Sheet candidate;
- use selected Prop Hero as a hidden generation reference;
- slice Prop Sheets or validate their creative contents;
- add fixed angle, panel, caption, label, state, or material schemas for a
  Prop Sheet image;
- add Prop editing forms in Studio; fact/design authoring remains CLI/agent
  owned in this slice, like current Location authoring;
- add a separate Prop specialist skill;
- add costume, wardrobe, vehicle, architecture, inventory, fabrication,
  procurement, or breakdown-management domains;
- add mobile behavior or responsive acceptance criteria;
- preserve old Location Design JSON names with aliases or compatibility reads;
- reformat unrelated files or touch historical plans for a naming sweep.

## Context And Evidence

### Current Location contract traced

The current Location slice spans:

- `packages/core/src/client/locations.ts`;
- Location facts in `packages/core/src/server/schema/locations.ts`;
- ordered persistence in
  `packages/core/src/server/database/access/locations.ts`;
- Core list/read/context/validate/apply commands in
  `packages/core/src/server/commands/location-commands.ts`;
- Location Design contracts, strict JSON, history, active state, commands, and
  summaries;
- Location owner/navigation resource keys;
- exclusive Asset membership and common canonical selection;
- `location_sheet` and `location_hero` destinations;
- `location.sheet` and `location.hero` purpose modules;
- optional same-owner Location Sheet reference slots;
- generation context, saved Preview, estimate/run, and focused attachment;
- Studio shell/navigation, selection context, resource projection, HTTP
  decoration, browser services, overview, details, Assets, routing, and refresh;
- Production Designer and Media Producer guidance and samples.

Props must cover this complete chain. A schema and React panel without commands,
attachment, Preview, paths, resource keys, or skills would be incomplete.

### Current Cast/Location duplication

The third subject makes the following duplication concrete:

- Cast and Location overview panels repeat resource loading, refresh, error,
  grid, image-card, and activation structure.
- Cast and Location detail panels repeat detail-plus-Asset loading, resource
  refresh, canonical selection, deletion, and toast behavior.
- Cast and Location image helper files repeat primary-image lookup, URL
  projection, aspect-ratio measurement, Preview objects, title normalization,
  and created/title/id sorting.
- Cast and Location Assets tabs repeat the canonical-image collection and
  continuity-sheet collection using the same MediaCard/MediaCollection
  contract.
- Cast and Location feature images repeat the same measured-frame, Button,
  empty-image, Preview, and focus behavior.
- Cast and Location resource projections are currently located in
  `resources/screenplay-ui.ts`, even though neither overview/detail surface is
  screenplay-owned.
- Studio Cast/Location read routes and browser calls sit under
  `/screenplay`, which is the wrong owner for Props and an increasingly vague
  owner for existing continuity resources.
- Preview subject projection names Cast but omits Location.
- Department design persistence repeats the same history/active-state mechanics
  for Cast and Location; adding Prop would create a third copy.
- Cast and Location fact operations currently invalidate navigation/detail
  resources without refreshing the bounded Project Shell that also contains
  first-page navigation and counts. Adding `ProjectCounts.props` is the point
  to make all three continuity-subject count/membership mutations invalidate
  that accepted projection explicitly.

The plan refactors these proven three-way mechanics while retaining:

- Cast Voice sample and voice-over behavior as Cast-specific;
- Location screenplay reference/delete checks as Location-specific;
- Prop facts/design and deletion as Prop-specific;
- domain-named CLI commands and Core reports.

### Real `urban-basilica` evidence

Read-only inspection of the current project database found:

- no `prop`, `prop_design`, or Prop-owned Asset rows;
- 82 total Assets;
- 22 Cast-owned Assets and 11 Location-owned Assets;
- 12 Character Sheets, 7 Cast Profiles, 5 Location Sheets, and 6 Location
  Heroes;
- fourteen active Location Design `propsAndRecurringObjects` entries across
  three Locations;
- cannon imagery and references distributed across Location Design, Lookbook,
  and Storyboard context;
- a helmet research file and helmet continuity embedded in Cast-related media.

Representative Location-local entries include grouped furnaces, bellows teams,
ox carts, defense equipment, city silhouettes, repair materials, and debris.
These prove that a semantic bulk conversion would be wrong. The migration must
preserve them as local recurring-object guidance, while first-class Props are
authored deliberately.

### Accepted architecture and decision history

This plan is constrained by:

- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/reference/domain-vocabulary.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/reference/drizzle-migrations.md`;
- `docs/architecture/reference/front-end-guidelines.md`;
- `docs/architecture/media-generation.md`;
- `docs/architecture/generation-preview-purpose-bindings.md`;
- ADR 0008 for URL-owned Studio routes;
- ADRs 0016 and 0017 for active project sessions and bounded resources;
- ADR 0023 for shared domain-neutral frontend primitives;
- ADR 0028 for durable department design documents;
- ADR 0030 for unified resource refresh;
- ADR 0036 and ADR 0059 for unsliced, request-scoped Location Sheets;
- ADR 0041 for opaque prompts and AI artifacts;
- ADR 0045 for small purpose bindings over shared Preview;
- ADRs 0049 and 0051 for explicit request-scoped references;
- ADR 0054 for Core-owned resource-key strings;
- ADR 0064 for exclusive Asset membership and scoped canonical selection;
- ADRs 0065 and 0066 for current MediaCard collections and Preview activation.

Completed Plan 0159 owns the current common Asset model. Props extend that
accepted owner/selection contract; they do not reopen or parallel it.

Completed Plan 0160 owns current MediaCard Preview and collection behavior.
Props compose that implementation; they do not add a Prop card or viewer.

The in-progress Plan 0162 and its migration 0069 are unrelated user work. This
plan must not edit, reset, reformat, or absorb that work. Its migration and ADR
numbers must be allocated after accepted predecessors at implementation time.

### Sister-project skill evidence

Current relevant files include:

- `studio-skills/skills/production-designer/SKILL.md`;
- `production-designer/references/location-authoring.md`;
- `production-designer/references/location-design.md`;
- `production-designer/references/media-and-beat-sheet-handoff.md`;
- `media-producer/SKILL.md`;
- `media-producer/references/workflow.md`;
- `media-producer/references/location-sheet.md`;
- `media-producer/references/location-sheet-board-design.md`;
- Location Sheet and Hero sample specs;
- Media Producer forward evals;
- Movie Director routing and specialist handoff checklists.

One current Location reference says Core initializes `location.hero` from the
first matching Location Sheet. That text is stale and conflicts with the
accepted current rule that candidates remain unselected. The skills update must
correct Location guidance and give Props the correct explicit-choice behavior.

### Current migration guidance

The current repository migration reference and current official Drizzle
codebase-first guidance require:

1. TypeScript schema as source of truth;
2. Drizzle Kit generation from `packages/core`;
3. generated SQL, snapshot, and journal committed together;
4. a new `PRAGMA user_version` when runtime requires the new tables/shape;
5. focused custom SQL only where Drizzle cannot express data conversion;
6. explicit project migration with a verified backup before changing the real
   project.

The new Prop tables are generated from schema. Rewriting the Location Design
JSON key is a documented custom step in the same ordered migration and needs a
transaction-level preservation test.

## Right-Sized Change Decision

### Option 1: copy Locations and rename every file

Rejected.

It would quickly produce a working surface, but it would create a third copy of
overview loading, detail/Asset orchestration, image helpers, feature-image
presentation, Assets collections, resource routes, Preview subject lookup, and
department design history mechanics. Those are already concrete repeated
capabilities.

### Option 2: refactor bounded continuity-subject mechanics and add Props

Accepted.

This option:

- adds focused Prop domain contracts and commands;
- extends accepted Asset, generation, navigation, and coordination contracts;
- extracts only stable behavior shared by current Cast, Location, and Prop
  surfaces;
- preserves domain-specific facts and exceptional behavior;
- removes incorrect screenplay ownership from continuity resource reads;
- avoids a generic entity or arbitrary CRUD framework.

### Option 3: build one generic continuity-subject platform

Rejected.

A schema/configuration system that declares fields, tables, commands, routes,
generation purposes, assets, and React panels for arbitrary subject kinds would
hide domain rules in metadata and make Cast voice, Location screenplay
relationships, Prop design semantics, and future subjects harder to review.
Three related product subjects justify bounded shared mechanics, not a
universal platform.

## Architecture Shape Gate

### Package ownership

`packages/core` owns:

- Prop and Prop Design public contracts;
- schema and Drizzle migration;
- Prop fact/design validation and persistence;
- delete dependency checks;
- Asset owner/selection capability;
- project-relative Prop destinations;
- generation purpose contracts, guide slots, Preview subject facts, and
  attachment;
- navigation/resource projections, counts, selection context, and resource
  keys;
- structured diagnostics.

`packages/cli` owns:

- argument parsing and JSON/file IO;
- thin `prop` and `production-design prop` handlers;
- target spelling `prop:<prop-id>`;
- forwarding Core reports and resource-change notifications.

`packages/studio/server` owns:

- HTTP parameter/body parsing;
- calling Core resource and Asset commands;
- decorating project AssetFile identities with browser URLs;
- translating structured errors;
- returning Core resource keys.

`packages/studio/src` owns:

- URL parsing and navigation;
- sidebar and selected-surface presentation;
- browser API calls;
- composition of shared continuity presentation and current `src/ui`
  primitives;
- no Prop validation or ownership rules.

`studio-skills` owns:

- when agents author Props or Prop Design;
- creative Prop Sheet/Hero prompt guidance;
- explicit reference choice;
- output inspection and handoff.

### Intended Core module shape

```text
packages/core/src/client/
  props.ts
  department-design.ts
  assets.ts
  generation.ts
  generation-preview-resource.ts
  project.ts
  resources.ts

packages/core/src/server/
  schema/
    props.ts
    department-design.ts
    index.ts
  database/access/
    props.ts
    department-design-history.ts
    cast-designs.ts
    location-designs.ts
    prop-designs.ts
    navigation.ts
    project-counts.ts
  commands/
    department-command-support.ts
    prop-commands.ts
    cast-design-commands.ts
    location-design-commands.ts
    prop-design-commands.ts
  department-design-json/
    validator.ts
  assets/
    owner-keys.ts
    ownership.ts
    selection.ts
    resource-keys.ts
  project-asset-files/
    destinations/
      prop.ts
      registry.ts
    owner-lookups.ts
    types.ts
  generation/
    purposes/
      prop-sheet.ts
      prop-hero.ts
    reference-slots/
      domain-assets.ts
    attachment-destinations.ts
  generation-preview-resource/
    projection.ts
    subjects.ts
  resources/
    continuity-subjects.ts
    project-shell.ts
    selection-context.ts
    screenplay-ui.ts
  studio-coordination/
    resource-keys.ts
    selection-validation.ts
```

Responsibilities:

- `props.ts` files own only Prop facts, ordered records, and delete dependency
  facts.
- `prop-commands.ts` owns Prop-specific operations and validation. It reuses
  placement/id/report helpers but does not enter a generic CRUD dispatcher.
- `department-design-history.ts` owns only repeated immutable-document history
  and active-state storage mechanics. It does not know Cast, Location, or Prop
  semantics.
- `cast-designs.ts`, `location-designs.ts`, and `prop-designs.ts` bind exact
  tables, owner fields, validators, and summaries to that internal history
  mechanic.
- `cast-design-commands.ts`, `location-design-commands.ts`, and
  `prop-design-commands.ts` remain public domain command owners.
- Rename the current misleading `production-design-commands.ts` directly to
  `location-design-commands.ts`; add no re-export stub.
- `continuity-subjects.ts` owns Cast/Location/Prop overview/detail resource
  projection and the shared selected-image projection. It exports specific
  methods, not a generic `readItem`.
- `screenplay-ui.ts` retains screenplay, Act, Sequence, Scene, and narrative
  resources and shrinks by removing continuity overview/detail projection.
- `subjects.ts` resolves bounded factual Preview labels. `projection.ts`
  remains shallow.
- `domain-assets.ts` may extract one internal continuity-sheet slot builder,
  but retains typed Character Sheet, Location Sheet, and Prop Sheet entrypoints
  with deliberate role labels and Asset types.
- `destinations/registry.ts` remains a bounded path dispatcher. Prop path logic
  lives in `destinations/prop.ts`.

Only existing package/module `index.ts` files may re-export the new public
contracts. They must remain thin. No non-index re-export facade is allowed.

### Intended CLI module shape

```text
packages/cli/src/commands/
  prop-command.ts
  production-design-command.ts
  production-design-location-command.ts
  production-design-prop-command.ts
  studio-target-parsing.ts
  generation-purpose-command-registry.ts
  media-import-command-handlers.ts
```

- `prop-command.ts` mirrors the human-facing Cast/Location command grammar but
  calls Prop Core commands.
- `production-design-command.ts` becomes a thin domain subcommand dispatcher.
- Location and Prop design parsing/formatting live in their focused files.
- Generation/media registries add one typed Prop target branch; they do not add
  purpose business rules.

### Intended Studio server and browser-service shape

```text
packages/studio/server/
  routes/
    continuity.ts
    screenplay.ts
    assets.ts
    projects.ts
  http/
    continuity-responses.ts
    screenplay-responses.ts

packages/studio/src/services/
  studio-continuity-api.ts
  studio-screenplay-api.ts
  studio-project-assets-api.ts
  studio-project-contracts.ts
```

`continuity.ts` owns:

```text
GET   /continuity/cast
GET   /continuity/cast/:castMemberId
PATCH /continuity/cast/:castMemberId/voice-over
GET   /continuity/locations
GET   /continuity/locations/:locationId
GET   /continuity/props
GET   /continuity/props/:propId
```

Current Cast/Location callers move directly from `/screenplay/...` to
`/continuity/...`; the old HTTP paths are removed without aliases.
`screenplay.ts` retains story arc, Acts, Sequences, Scenes, Beat Sheets, and
dialogue audio.

`continuity-responses.ts` decorates the three resource families with browser
AssetFile URLs. It does not read project data or choose canonical images.

`studio-continuity-api.ts` owns the matching browser reads and Cast voice-over
mutation. `studio-screenplay-api.ts` retains narrative resources.

Asset routes remain domain-named in accordance with Plan 0159:

```text
GET    /props/:propId/assets
POST   /props/:propId/selected-hero/:assetId
DELETE /props/:propId/selected-hero
DELETE /props/:propId/assets/:assetId
```

The routes call the common Core list/select/clear/discard commands. Shared
request/response mechanics may be internal, but route-local capability,
ownership, or Asset-type validation is forbidden.

### Intended Studio feature shape

```text
packages/studio/src/features/movie-studio/
  continuity/
    continuity-overview-grid.tsx
    continuity-feature-image.tsx
    continuity-image-assets.ts
    continuity-image-assets-tab.tsx
    use-continuity-assets.ts
  cast/
    cast-overview-panel.tsx
    cast-member-panel.tsx
    cast-member-details-tab.tsx
    cast-member-assets-tab.tsx
  locations/
    location-overview-panel.tsx
    location-panel.tsx
    location-details-tab.tsx
    location-assets-tab.tsx
  props/
    prop-overview-panel.tsx
    prop-panel.tsx
    prop-details-tab.tsx
    prop-assets-tab.tsx
  studio-sidebar/
    studio-sidebar.tsx
  movie-studio-screen.tsx
  movie-studio-selection.ts
  use-movie-studio-navigation.ts
```

Responsibilities:

- `continuity-overview-grid.tsx` receives prepared subject cards and renders
  the accepted overview grid. It knows the Cast/Location/Prop continuity
  presentation pattern, not fetching or routing rules.
- `continuity-feature-image.tsx` owns the shared measured image frame, empty
  state, Button, and Preview activation currently duplicated by Cast and
  Location.
- `continuity-image-assets.ts` owns image-file lookup, browser URL projection,
  aspect ratio, Preview object, title normalization, role filtering, and stable
  sorting for continuity media.
- `continuity-image-assets-tab.tsx` owns the bounded two-section pattern:
  canonical Hero/Profile images followed by request-scoped continuity sheets.
  It accepts meaningful domain copy, exact Asset types, and card geometry. It
  does not fetch, select, delete, or inspect generation requests.
- Cast composes the shared image sections plus its distinct Voice Samples
  section.
- Location and Prop compose the exact two-section base.
- `use-continuity-assets.ts` owns only common Asset page loading and
  select/clear/discard orchestration. Domain detail-resource loading remains in
  each panel.
- Rename `use-screenplay-navigation.ts` directly to
  `use-movie-studio-navigation.ts`, because it owns Cast, Locations, Props,
  Acts, Sequences, and Scenes. Add no alias.
- Feature files continue to use local shadcn controls and current shared
  `MediaCard`, `MediaCollectionSection`, `LineTabs`, `Button`, and Dialog
  primitives. No raw interactive HTML control is added.

### Bounded dispatch and registries

Allowed focused dispatch:

- Prop as one new `AssetOwner` and `AssetSelectionTarget` kind;
- Prop as one new `GenerationTarget` kind;
- `prop.sheet` and `prop.hero` in the existing purpose registry;
- Prop destinations in the existing destination registry;
- Prop selection/context/navigation branches in their accepted bounded unions;
- Cast/Location/Prop subject labels in the focused Preview subject resolver.

These switches protect stable typed domain boundaries. They must not become one
registry that declares schema, commands, routes, UI fields, or skills.

### Files expected to shrink, split, or disappear

- `resources/screenplay-ui.ts` shrinks when continuity resources move.
- `routes/screenplay.ts` shrinks when Cast/Location resources move.
- `http/screenplay-responses.ts` shrinks accordingly.
- `studio-screenplay-api.ts` shrinks accordingly.
- `database/access/department-design.ts` disappears after direct split into
  the focused design stores and internal history mechanic.
- `production-design-commands.ts` disappears after direct rename.
- Cast/Location image helper duplication moves into `continuity/`.
- Location's `location-visual-content-tab.tsx` is renamed to
  `location-assets-tab.tsx`; no compatibility wrapper remains.
- `use-screenplay-navigation.ts` disappears after direct rename.

### Forbidden shapes

Do not:

- add a `continuity_subject` table with JSON facts;
- add arbitrary `kind + payload` Prop/Cast/Location commands;
- create a generic patch-state or domain manager API;
- put Prop rules in CLI, HTTP, or React;
- create a single `department-design.ts` god file containing history,
  validation, summaries, and all domain commands;
- create a single `continuity-subject.tsx` that fetches, routes, selects,
  deletes, and renders all three domains from a large configuration object;
- make `src/ui` import Core, services, or feature contracts;
- add a catch-all generation purpose file or route-local purpose switch;
- add arbitrary renderer slots or class-name escape hatches to shared
  continuity components;
- keep old resource routes, file names, JSON fields, or imports through shims;
- add architecture tests that inventory private function/file names;
- validate Prop Sheet creative contents.

### Stop conditions

Stop and revise before implementation continues if:

- the proposed Prop fact/design fields remain product-ambiguous;
- a migration would infer first-class Props from free text or recurring-object
  names;
- a Core file begins combining domain command parsing, validation,
  persistence, generation, and projection;
- `department-design-history.ts` needs domain-specific switches or semantic
  validation;
- the shared continuity React contract needs Cast voice or
  Location screenplay branches;
- a shared React component takes arbitrary children solely to accommodate one
  domain;
- a route or browser service decides which Asset type a Prop may select;
- the Prop UI cannot match the Location surface without redesigning shared
  primitives;
- the next migration or ADR number conflicts with accepted in-progress work;
- implementation touches the unrelated Plan 0162 worktree changes.

## Contracts

### Public Core fact contract

Add:

```ts
export interface Prop {
  id: string;
  handle: string;
  name: string;
  description?: string;
  visualNotes?: string;
}

export interface PropInput {
  id?: string;
  key?: string;
  handle: string;
  name: string;
  description?: string;
  visualNotes?: string;
}

export type PropOperation =
  | { operation: 'prop.add'; prop: PropInput; placement?: DepartmentPlacement }
  | { operation: 'prop.update'; prop: PropInput }
  | { operation: 'prop.delete'; propId: string }
  | { operation: 'prop.move'; propId: string; placement: DepartmentPlacement };

export interface PropOperationDocument {
  kind: 'propOperations';
  operations: PropOperation[];
}
```

Add the exact Prop Design contract from Product Decision 2, plus:

- `PropDesignListReport`;
- `PropDesignReadReport`;
- `PropDesignWriteReport`;
- `PropDesignSummary`;
- `ProductionDesignPropContextReport`.

Rename:

```text
ProductionDesignProp -> LocationRecurringObject
propsAndRecurringObjects -> recurringObjects
```

No deprecated names remain in current runtime code or current skill examples.

### Core commands

Add:

```ts
listProps
readProp
readPropContext
validatePropOperations
applyPropOperations

listPropDesigns
readPropDesign
validatePropDesign
writePropDesign
setActivePropDesign
```

The public methods remain specific and appear in
`ProjectDataService`/wiring. There is no public generic department-document
write command.

### Database contract

Add Drizzle tables:

```text
prop
  id text primary key
  handle text not null unique
  name text not null
  description text null
  visual_notes text null
  position integer not null

prop_design
  id text primary key
  prop_id text not null references prop(id)
  document_json text not null
  title text null
  source_command text null
  created_at text not null

prop_design_state
  prop_id text primary key references prop(id)
  active_design_id text not null references prop_design(id)
  updated_at text not null
```

Indexes mirror current ordered fact and department history lookup needs.

Add entity id prefixes:

```text
prop
prop_design
```

The next migration after current in-progress migration 0069 is presently
expected to be:

```text
packages/core/drizzle/0070_add_props_continuity_subjects.sql
```

Implementation must allocate the actual next number after all accepted
predecessors and use Drizzle Kit with the deliberate name
`add_props_continuity_subjects`.

The migration:

- adds the three generated tables/indexes;
- rewrites stored current Location Design JSON from
  `propsAndRecurringObjects` to `recurringObjects`;
- preserves every nested object name, description, continuity note, design id,
  active selection, timestamp, and source command;
- fails before partial conversion when current JSON is malformed or both old
  and new keys are present ambiguously;
- updates `PRAGMA user_version` because current runtime reads the new Prop
  tables unconditionally;
- does not create Prop rows from Location Design text.

### Asset contract

Extend:

```ts
export type AssetOwner =
  | ...
  | { kind: 'prop'; id: string };

export type AssetSelectionTarget =
  | ...
  | { kind: 'prop'; id: string };
```

Add owner-key spelling:

```text
prop:<encoded-prop-id>
```

Add canonical types:

```text
prop_sheet
prop_hero
```

Selection requires:

```text
target kind prop
exact Prop owner
active ready Asset
Asset type prop_hero
```

`prop_sheet` never supports common canonical selection.

### Project Asset file contract

Add destinations:

```ts
{ kind: 'prop.sheet'; propId: string }
{ kind: 'prop.hero'; propId: string }
```

Paths:

```text
props/<prop-handle>/prop-sheets/<sheet-slug>.<ext>
props/<prop-handle>/prop-sheets/<sheet-slug>-v01.<ext>
props/<prop-handle>/heroes/hero.<ext>
props/<prop-handle>/heroes/hero-v01.<ext>
```

Both are flat collections. Do not create one folder per Prop Sheet or Hero.

### Generation contract

Extend:

```ts
export type GenerationPurpose =
  | ...
  | 'prop.sheet'
  | 'prop.hero';

export type GenerationTarget =
  | ...
  | { kind: 'prop'; id: string };
```

Purpose bindings:

| Purpose | Target | Output | Settings | Guide slots | Attachment |
| --- | --- | --- | --- | --- | --- |
| `prop.sheet` | `prop` | image | recommended 16:9, high, GPT Image 2 | Production Lookbook Sheet; optional same-Prop Prop Sheet continuity | `prop_sheet`, Prop owner, `prop.sheet` destination |
| `prop.hero` | `prop` | image | fixed 16:9; recommended medium, Nano Banana 2 | optional same-Prop Prop Sheet source | `prop_hero`, Prop owner, `prop.hero` destination |

The actual provider/model recommendation comes from the current catalog and
must be verified during implementation. Purpose modules must not duplicate
provider schemas.

Preview adds:

```ts
export interface GenerationPreviewSubject {
  projectLabel: string;
  sceneLabel?: string;
  takeLabel?: string;
  shotLabel?: string;
  castMemberLabel?: string;
  locationLabel?: string;
  propLabel?: string;
}
```

### Resource and coordination contracts

Add:

```ts
export interface PropNavigationRow {
  id: string;
  handle: string;
  name: string;
  firstImage?: ScreenplayImageReference;
}

export interface PropOverviewResource {
  props: PageResponse<PropNavigationRow>;
}

export interface PropResource {
  prop: Prop;
  firstImage?: ScreenplayImageReference;
}
```

Extend:

```text
ProjectCounts.props
ProjectShellNavigation.props
StudioSelection { type: 'props' }
StudioSelection { type: 'prop'; id: string }
StudioSelectionContext surface props
StudioSelectionContext surface prop
DirectorProductionDesignReadiness Prop counts/design/sheet readiness
```

Add exact resource keys:

```text
navigation:props
surface:prop:<propId>
```

Prop fact membership/order changes invalidate `navigation:props` and the
Project Shell. Prop detail, design, Asset, attachment, and selection changes
invalidate `surface:prop:<id>`. The shared fact-mutation correction updates
Cast and Location add/delete/move/update reports to invalidate their current
navigation/detail projections and `project-shell` when the bounded shell's
first page or counts may be stale. Core remains the only key producer.

### CLI contract

Add:

```bash
renku prop list --json
renku prop show <prop-id> --json
renku prop context --prop <prop-id> --json
renku prop validate --file <prop-operations-json> --json
renku prop apply --file <prop-operations-json> [--dry-run] --json

renku production-design prop context --prop <prop-id> --json
renku production-design prop list --prop <prop-id> --json
renku production-design prop show --active --prop <prop-id> --json
renku production-design prop show --design <prop-design-id> --json
renku production-design prop validate --file <prop-design-json> --json
renku production-design prop write --file <prop-design-json> --json
renku production-design prop set-active \
  --prop <prop-id> --design <prop-design-id> --json

renku generation context --purpose prop.sheet \
  --target prop:<prop-id> --json
renku generation context --purpose prop.hero \
  --target prop:<prop-id> --json

renku media import --purpose prop.sheet \
  --target prop:<prop-id> --source <path> --title <title> \
  [--receipt <run-json> | --source-spec <spec-id>] --json
renku media import --purpose prop.hero \
  --target prop:<prop-id> --source <path> --title <title> \
  [--receipt <run-json> | --source-spec <spec-id>] [--select] --json
```

Add `--prop` as a deliberate CLI flag. Do not overload `--location`.

### Studio HTTP and browser contracts

Use the continuity and Asset routes named in the Architecture Shape Gate.

Browser DTOs add:

- `PropOverviewResourceResponse`;
- `PropResourceResponse`;
- browser URL decoration for `firstImage` and Asset files.

The Studio browser uses the canonical Prop routes. It does not infer fallback
selection when an id is missing or invalid.

### Structured diagnostics

Use existing stable diagnostics where the condition is already shared:

- missing id/key;
- duplicate handle/name warning;
- invalid placement;
- owner not found;
- invalid Asset owner;
- invalid canonical selection;
- invalid generation target;
- malformed design JSON.

Add Prop-specific diagnostic codes only when the caller needs to distinguish a
new condition, such as:

```text
CORE_PROP_DELETE_BLOCKED
CORE_PROP_DESIGN_INVALID
```

Final code allocation must follow the current diagnostics catalog and avoid
collisions. Messages describe current Prop contracts only; they must not name
obsolete fields or compatibility shapes.

## Implementation Slices

### Slice 0: accept product decisions and record architecture

- Resolve the seven product decisions above.
- Add ADR 0070,
  `docs/decisions/0070-use-first-class-props-as-continuity-subjects.md`, after
  the in-progress ADR 0069 is accepted or renumber it to the next available
  decision.
- Record:
  - first-class Prop identity;
  - Location Recurring Object distinction;
  - Prop Design;
  - Prop Sheet/Prop Hero ownership and selection;
  - request-scoped Prop Sheets;
  - no launch relationships;
  - exact Studio surface and route placement.
- Add narrow update notices to ADRs 0028 and 0064. Preserve their historical
  bodies.
- Stop if product decisions change the public schema or relationship scope;
  revise this plan before production implementation.

### Slice 1: add Prop facts and ordered authoring

Expected files:

- `packages/core/src/client/props.ts`;
- `client/department-design.ts`;
- `server/schema/props.ts`;
- `server/database/access/props.ts`;
- `server/commands/prop-commands.ts`;
- department JSON schemas/validator;
- Core public service contracts and wiring;
- `packages/cli/src/commands/prop-command.ts`;
- CLI registration/help/tests.

Work:

- add fact, input, operation-document, report, and context contracts;
- add ordered records, handle uniqueness across Cast/Location/Prop, and
  dependency summaries;
- add list/read/context/validate/apply;
- keep delete rules and writes transactional;
- return project/navigation/surface resource keys from Core;
- add CLI parsing/formatting only after Core is complete.

### Slice 2: split department design storage and add Prop Design

Expected files:

- `server/database/access/department-design-history.ts`;
- `cast-designs.ts`, `location-designs.ts`, `prop-designs.ts`;
- `server/commands/cast-design-commands.ts`;
- `location-design-commands.ts`;
- `prop-design-commands.ts`;
- strict department JSON schemas/validator;
- client reports/summaries;
- Core service wiring;
- CLI production-design domain handlers.

Work:

- lock existing Cast/Location behavior with focused tests before extraction;
- move repeated history/active-state mechanics into the internal bounded
  owner-agnostic store;
- keep exact domain parsing, semantic validation, summaries, and commands in
  focused files;
- add Prop Design history and active state;
- rename the current Location command/store files directly;
- update all callers without re-export shims;
- keep public commands domain-named.

### Slice 3: generate and test the schema migration

- Edit the Drizzle TypeScript schema first.
- Generate the next migration from `packages/core` with
  `--name add_props_continuity_subjects`.
- Inspect generated SQL, snapshot, and journal.
- Add the documented custom Location Design JSON rewrite.
- Set the next required schema generation through `PRAGMA user_version`.
- Add a transaction-level migration test with:
  - Cast and Location facts/design history;
  - all fourteen representative recurring-object shapes, including optional
    continuity notes;
  - active design selection;
  - existing Assets, memberships, selections, specs, runs, and Trash rows;
  - no starting Props.
- Prove:
  - all unrelated ids/data survive;
  - every current Location Design reads under `recurringObjects`;
  - no first-class Prop is inferred;
  - new Prop/design/state writes succeed after migration;
  - ambiguous/malformed conversion fails before partial state.

### Slice 4: extend Asset ownership, selection, and Prop storage

Expected files:

- `client/assets.ts`;
- `server/assets/owner-keys.ts`;
- `ownership.ts`;
- `selection.ts`;
- Asset request parsing and resource keys;
- `project-asset-files/destinations/prop.ts`;
- destination registry, types, and owner lookups;
- discard/restore/delete dependency tests.

Work:

- add `prop` owner and selection target;
- add existence checks and owner-key parsing;
- add `prop_hero` canonical-selection requirement;
- keep `prop_sheet` outside canonical selection;
- add focused flat destinations under the existing `props/` root;
- prove selection and discard operate through the existing common Core
  commands;
- do not add Prop-owned relationship or selection tables.

### Slice 5: add Prop generation and Preview

Expected files:

- `client/generation.ts`;
- `client/generation-preview-resource.ts`;
- `server/generation/purposes/prop-sheet.ts`;
- `prop-hero.ts`;
- purpose registry and guide slots;
- attachment destinations;
- `project-asset-files` output placement;
- `generation-preview-resource/subjects.ts`;
- Studio Preview title map/tests;
- CLI target parsing and media import registration.

Work:

- register `prop.sheet` and `prop.hero`;
- expose current recommendations/fixed settings through the existing purpose
  contract;
- add Production Lookbook and same-Prop sheet candidates;
- ensure candidates remain unselected;
- attach output atomically to the exact Prop and destination;
- allow `--select` only for `prop.hero`;
- project Prop and Location labels into Preview;
- keep Preview configuration driven by current model schemas;
- add no Prop-specific Preview component or content validation.

### Slice 6: add bounded shell/navigation/resource contracts

Expected files:

- `client/project.ts` and `client/resources.ts`;
- database navigation and project counts;
- `resources/continuity-subjects.ts`;
- `resources/project-shell.ts`;
- `resources/selection-context.ts`;
- studio coordination selection/focus/resource keys;
- Director context/readiness.

Work:

- add paged Prop navigation to the bounded Project Shell;
- add Props count;
- update project-create/count reports and zero-count fixtures for Props;
- add overview/detail resources using selected Prop Hero;
- extract existing Cast/Location overview/detail projection from
  `screenplay-ui.ts`;
- add selection validation/context/focus for Props and one Prop;
- add resource refresh keys and browser matchers;
- correct Cast/Location/Prop fact-mutation invalidation so bounded shell
  counts and first navigation pages do not remain stale;
- extend Production Design readiness with Prop count, active design count,
  Prop Sheet count, and missing ids;
- do not add Props to screenplay readiness or Scene facts.

### Slice 7: correct Studio route/service ownership

Expected files:

- `server/routes/continuity.ts`;
- `server/routes/screenplay.ts`;
- `server/http/continuity-responses.ts`;
- `server/http/screenplay-responses.ts`;
- `server/routes/assets.ts`;
- route composition/service contracts/fakes;
- `src/services/studio-continuity-api.ts`;
- `studio-screenplay-api.ts`;
- `studio-project-assets-api.ts`;
- browser DTOs and tests.

Work:

- move Cast/Location overview/detail and voice-over routes to `/continuity`;
- add Prop overview/detail routes there;
- remove old `/screenplay/cast` and `/screenplay/locations` routes directly;
- add thin Prop Asset/selected-Hero routes;
- keep Core resource keys and diagnostics unchanged through adapters;
- keep all browser file paths hidden behind safe URLs;
- delete duplicate response decoration and request mechanics after migration.

### Slice 8: extract shared continuity presentation

Before modifying presentation, capture current deterministic desktop evidence
for representative Cast and Location overview/detail/Assets states at
1440×900 and 1024×900.

Expected files:

- `features/movie-studio/continuity/*`;
- current Cast/Location overview, details, Assets, and panel files;
- current tests.

Work:

- extract prepared overview grid presentation;
- extract shared measured continuity feature image;
- extract common image Asset helpers and stable sorting;
- extract the bounded canonical-image plus continuity-sheet Assets sections;
- extract Asset page/select/clear/discard orchestration only;
- retain Cast Voice behavior in Cast;
- retain Location facts/copy in Location;
- refactor current callers first and prove no visible/behavior regression;
- do not redesign existing cards, tabs, copy, spacing, image fit, controls, or
  Preview behavior.

### Slice 9: add the Prop Studio surface

Expected files:

- `features/movie-studio/props/*`;
- `movie-studio-screen.tsx`;
- `studio-sidebar/studio-sidebar.tsx`;
- router/session selection;
- renamed `use-movie-studio-navigation.ts`;
- selection resolution and tests;
- App/browser E2E fixtures.

Work:

- add sidebar Props directly between Locations and Acts;
- add overview and exact Prop routes;
- add detail Details/Assets tabs;
- use Location geometry and the shared continuity components;
- show only meaningful Prop-authored copy;
- wire refresh, loading, empty, error, selection, Preview, inspection, delete,
  browser history, reload, and focus return;
- test desktop only.

### Slice 10: update Studio Skills

Expected sister-project files:

- `production-designer/SKILL.md`;
- new `production-designer/references/prop-authoring.md`;
- new `production-designer/references/prop-design.md`;
- updated media handoff guidance;
- `media-producer/SKILL.md`;
- `media-producer/references/workflow.md`;
- new `media-producer/references/prop-sheet.md`;
- new `media-producer/references/prop-sheet-board-design.md`;
- new Prop Sheet and Prop Hero sample specs;
- Media Producer forward evals;
- Movie Director routing/checklists.

Work:

- route Prop fact/design intent to Production Designer;
- route Prop media intent to Media Producer;
- document exact context/Preview/approval/run/inspect/import sequence;
- document `--select` for Hero only;
- state that Prop Sheet candidates are never initialized;
- correct the stale Location Hero first-candidate claim;
- keep board composition agent-owned and runtime-opaque;
- add evals for:
  - authoring a cannon Prop and Prop Design;
  - generating a Prop Sheet;
  - deriving a Prop Hero from an explicitly chosen Prop Sheet;
  - refusing to auto-promote Location recurring objects;
  - refusing global Prop Sheet selection;
  - classifying a wearable helmet with explicit user direction.

### Slice 11: migrate and verify the real project

- Create a verified project-database backup through the accepted migration
  command.
- Work on an isolated copy first.
- Run the migration.
- Confirm all existing Cast, Location, Lookbook, Storyboard, generation,
  Asset, selection, and Trash data survives.
- Confirm all active Location Designs retain the fourteen recurring objects
  under the new local name.
- Author the accepted cannon and helmet Prop facts/designs through the public
  CLI only.
- Import or generate Prop media only after the exact Product Decision 7 choice;
  never write SQLite or copy into canonical folders manually.
- Verify the Props sidebar, overview, detail, Assets, generation Preview,
  resource refresh, and direct routes in Studio.

### Slice 12: documentation and cleanup

- Update current architecture, CLI, storage, media-generation, Studio resource,
  and skill references.
- Add ADR notices without rewriting decision history.
- Remove obsolete current code/imports/routes/JSON names and duplicated
  presentation implementations.
- Do not edit completed historical plans just to change terminology.
- Inspect the complete diff and module shape before declaring the plan
  complete.

## Tests And Guardrails

### Prop facts and design

Cover:

- add/update/delete/move and dry-run;
- id versus request-local key rules;
- handle uniqueness across all three continuity subject families;
- duplicate names as current warning behavior;
- stable ordered persistence;
- missing Prop and invalid placement diagnostics;
- delete blocked by Assets, Prop Design history, or active state;
- no screenplay/prompt text semantic scanning;
- strict Prop Design validation before write and after read;
- design ownership and active selection;
- all actionable validation issues collected before mutation;
- no partial writes on failure.

### Department design refactor

Regression tests prove unchanged:

- Cast Design list/show/write/set-active;
- Location Design list/show/write/set-active;
- summary projection and active state;
- strict unknown-field behavior;
- stored malformed JSON failure.

Architecture coverage should protect import/package boundaries and runtime
behavior. Do not inventory the names of private helpers or every domain
command.

### Migration

Cover:

- generated table/index shape;
- schema generation;
- exact recurring-object JSON preservation;
- optional continuity notes;
- active Location Design selection;
- unrelated data survival;
- no inferred Prop rows;
- rollback/fail-before-partial behavior for ambiguous current JSON;
- open migrated database through the normal runtime.

### Asset ownership and selection

Cover:

- Prop owner-key round trip;
- missing Prop owner rejection before Asset/file write;
- exact Prop membership;
- `prop_hero` select/clear;
- cross-Prop and wrong-type selection rejection;
- `prop_sheet` selection rejection;
- discard selected Hero clears selection under current common behavior;
- whole-Prop dependency summary includes active/discarded Assets;
- destination paths remain within the exact Prop folder;
- version allocation and path collision behavior;
- no Asset sharing/reparenting.

### Generation and Preview

Cover:

- purpose registry contracts;
- target mismatch;
- missing Prop;
- context recommendations and fixed settings;
- Production Lookbook slot;
- same-Prop Prop Sheet candidates only;
- empty/one/multiple candidates stay unselected;
- exact saved choice round trip;
- no selected Hero leakage into references;
- Prop Sheet/Prop Hero destination and Asset type;
- `--select` accepted only for Hero;
- generation receipt/source-spec target and purpose validation;
- Preview subject label for Prop and corrected Location label;
- Preview title and current model-schema configuration;
- no creative artifact validation.

### Resource, navigation, and coordination

Cover:

- Project Shell Prop first page and count;
- paged Prop navigation order;
- Props and Prop selection parsing;
- selection not found;
- direct focus validation;
- `navigation:props` and `surface:prop:<id>`;
- exact mutation invalidation;
- Director Production Design readiness;
- no Props in screenplay readiness;
- browser refresh matcher for overview and exact Prop.

Exact resource-key strings may be asserted because they are accepted
cross-package contracts. Tests must not hard-code private builder names.

### CLI and Studio server

Cover:

- all new command grammars and JSON output;
- stdin/file validation;
- dry-run versus mutation notification;
- `prop:<id>` parsing;
- focused media import and `--select`;
- continuity resource routes;
- Prop Asset/selected-Hero routes;
- structured diagnostic serialization;
- old `/screenplay/cast` and `/screenplay/locations` paths absent;
- thin adapters do not derive owners, types, or selection eligibility.

### Studio components

Shared continuity regression coverage proves:

- Cast and Location overview/detail/Assets remain visually and behaviorally
  unchanged;
- Cast Voice controls remain Cast-owned;
- shared actions do not trigger whole-card activation accidentally;
- no raw interactive HTML controls appear in feature code.

Prop coverage proves:

- sidebar placement directly after Locations and before Acts;
- count and expand/collapse behavior;
- overview loading/error/empty/ready states;
- cards show Hero/name and no invented subtitle;
- direct overview/detail routes survive reload, Back, and Forward;
- invalid Prop id fails clearly;
- Details/Assets tab order;
- selected Hero appears in overview and Details;
- Hero select/clear/delete refreshes exact surfaces;
- Prop Sheets never expose global selection;
- image Preview and generation request inspection;
- loading and mutation errors preserve current usable state;
- keyboard activation and focus return.

### Desktop visual verification

At 1440×900 and 1024×900:

- compare Location overview and Prop overview with equivalent fixtures;
- compare Location Details and Prop Details with equivalent field presence;
- compare Location Assets and Prop Assets with equivalent candidate counts;
- confirm identical grid geometry, tabs, padding, typography, borders, radii,
  image fit, overlay, controls, empty states, and Preview presentation;
- confirm Props does not cause sidebar overflow or reorder Acts incorrectly;
- ignore dynamic media pixels only; do not mask layout or controls.

No mobile viewport is in scope.

### Skill tests

Run the sister-project validation and forward evals to prove:

- coarse intent routing;
- context-first authoring;
- explicit reference selection;
- Preview before approval;
- output inspection before attachment;
- Hero-only canonical selection;
- no global Prop Sheet selection;
- no automatic first candidate;
- no runtime creative-content rules;
- no silent recurring-object promotion.

## Documentation

Add:

- the next available ADR, expected as
  `docs/decisions/0070-use-first-class-props-as-continuity-subjects.md`.

Update:

- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/reference/domain-vocabulary.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/generation-preview-purpose-bindings.md`;
- `docs/architecture/reference/front-end-guidelines.md`;
- `docs/architecture/reference/studio-skills.md`;
- `docs/cli/commands.md`;
- ADR 0028 with a narrow Prop/Location Recurring Object update notice;
- ADR 0064 with a narrow Prop owner/selection update notice;
- ADR 0059 only if a discoverability notice is needed for the analogous Prop
  Sheet contract; do not rewrite Location history.

In `studio-skills`, update the exact files named in Slice 10.

Do not update historical plans or old decision bodies merely to replace
`ProductionDesignProp`. Current reference docs, runtime contracts, current
skills, and the new ADR carry the accepted vocabulary.

## Final Verification

Run focused tests while implementing, then:

```bash
pnpm test:core
pnpm test:cli
pnpm test:studio
pnpm build:core
pnpm build:cli
pnpm build:studio
pnpm check
pnpm test
pnpm test:integration
pnpm test:e2e:studio:smoke
```

Run the sister-project skill validation and relevant forward evals from
`/Users/keremk/Projects/aitinkerbox/studio-skills`.

Manually verify an isolated migrated `urban-basilica`:

1. Location Design recurring objects survived exactly.
2. Cannon and helmet Props are deliberately authored, not inferred.
3. Props appears below Locations and above Acts.
4. Prop overview matches Location layout.
5. Direct Prop URL opens and survives reload.
6. Details shows the selected Prop Hero and authored facts.
7. Assets shows Hero Images before Prop Sheets.
8. Prop Sheet context offers candidates without selecting one.
9. Prop Hero Preview shows the exact explicitly chosen Prop Sheet.
10. Accepted Hero import with `--select` updates overview/detail without a
    broad project reload.
11. Deleting or selecting an invalid cross-owner Asset fails through a
    structured Core error.
12. Browser console and server logs contain no unexpected warnings/errors.

Before completion:

- inspect `git diff --stat`;
- inspect the complete diff, including sister-project changes;
- inspect every new or heavily modified Core, CLI, route, and React file;
- confirm `index.ts` files remain thin;
- confirm `screenplay-ui.ts`, `screenplay.ts`, and duplicated continuity UI
  actually shrank;
- confirm `department-design-history.ts` is mechanical and domain-neutral;
- confirm no generic entity/CRUD/configuration framework was introduced;
- confirm no route, CLI, React, or skill code owns durable Prop rules;
- confirm no runtime code validates prompt or Prop Sheet creative contents;
- confirm no checklist item was satisfied by accepting a god file, broad
  dispatcher, wrapper, re-export stub, compatibility path, or formatting churn;
- confirm unrelated in-progress Plan 0162 changes were not modified.

## Completion Checklist

### Review Area

- [x] Accept or revise all seven product decisions.
- [x] Confirm Props are a first-class Core domain, not a UI Asset filter.
- [x] Confirm the implementation preserves package ownership boundaries.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm centralized ownership did not become a monolithic implementation.
- [x] Confirm no broad dispatcher, catch-all helper, or god file was added.
- [x] Confirm no unrelated Plan 0162 work was changed.

### Product Contract

- [x] Accept the launch Prop fact fields.
- [x] Accept the launch Prop Design fields.
- [x] Accept first-class Prop versus Location Recurring Object semantics.
- [x] Accept wearable and large-object classification.
- [x] Accept no Prop relationship joins at launch.
- [x] Accept Location-equivalent Hero/card geometry.
- [x] Accept exact `urban-basilica` cannon/helmet facts and media treatment.

### Architecture And Public Contracts

- [x] Add `Prop`, inputs, operations, reports, context, and navigation types.
- [x] Add `PropDesignDocument` and reports/summaries.
- [x] Rename Location recurring-object contracts directly.
- [x] Add public Core Prop and Prop Design commands.
- [x] Add `prop` to Asset owner and selection unions.
- [x] Add `prop` to Generation target and the two purposes.
- [x] Add Project count, shell navigation, selection, and context contracts.
- [x] Add Preview Location and Prop labels.
- [x] Add no compatibility aliases, wrapper exports, or generic patch APIs.
- [x] Keep package-boundary diagnostics structured.

### Schema And Drizzle Migration

- [x] Add `prop`, `prop_design`, and `prop_design_state` in TypeScript schema.
- [x] Generate the migration through Drizzle Kit with a deliberate name.
- [x] Commit generated SQL, snapshot, and journal together.
- [x] Add the documented custom Location Design JSON rewrite.
- [x] Preserve every existing recurring object and active design.
- [x] Add no inferred first-class Prop rows.
- [x] Update `PRAGMA user_version` to the next required generation.
- [x] Add the transaction-level migration preservation/failure test.
- [x] Apply through the accepted backup/migration command, never runtime reads.

### Prop Facts And Design

- [x] Implement ordered Prop persistence.
- [x] Enforce cross-domain handle uniqueness.
- [x] Implement list/read/context/validate/apply.
- [x] Implement deletion dependency checks.
- [x] Implement Prop Design list/read/validate/write/set-active.
- [x] Validate before writes and after reads.
- [x] Keep creative text exact and opaque.
- [x] Split department design storage without creating a configuration god
      object.
- [x] Keep Cast, Location, and Prop design commands specific.

### Asset Ownership And Storage

- [x] Add Prop owner-key encode/decode.
- [x] Add Prop owner existence validation.
- [x] Add `prop_sheet` and `prop_hero`.
- [x] Add Prop Hero canonical selection.
- [x] Prove Prop Sheets cannot be globally selected.
- [x] Add flat Prop Sheet and Hero destinations.
- [x] Keep path allocation in Core.
- [x] Preserve exclusive ownership and independent copy/import identities.
- [x] Cover discard/restore/delete dependency behavior.

### Generation And Preview

- [x] Add focused `prop.sheet` purpose module.
- [x] Add focused `prop.hero` purpose module.
- [x] Register the Prop target parser.
- [x] Add Production Lookbook and same-Prop sheet guide candidates.
- [x] Keep candidate selection explicit and request-scoped.
- [x] Add attachment destinations and atomic Hero `--select`.
- [x] Add Prop/Location Preview subject labels.
- [x] Add Prop Preview titles.
- [x] Keep model configuration schema-driven.
- [x] Keep prompts and media contents opaque to runtime.

### Resources And Coordination

- [x] Add Prop counts and bounded shell navigation.
- [x] Add Props to project-create/count reports and fixtures.
- [x] Add Prop overview/detail Core resources.
- [x] Extract continuity resources from screenplay ownership.
- [x] Add Props/Prop selection parsing and context.
- [x] Add focus validation.
- [x] Add `navigation:props` and `surface:prop:<id>`.
- [x] Invalidate `project-shell` for continuity fact changes that stale its
      counts or first navigation pages.
- [x] Add exact browser refresh matchers.
- [x] Extend Director Production Design readiness.
- [x] Keep Props out of screenplay readiness.

### CLI

- [x] Add `renku prop` commands and `--prop`.
- [x] Add `renku production-design prop` commands.
- [x] Split the production-design handler before it becomes a long branch.
- [x] Add `prop:<id>` generation/media parsing.
- [x] Add focused Prop Sheet/Hero import.
- [x] Preserve dry-run and resource-change notification behavior.
- [x] Keep handlers thin over Core.

### Studio Server And Browser Services

- [x] Add continuity routes and response decoration.
- [x] Move Cast/Location resources out of `/screenplay`.
- [x] Remove old routes directly with no aliases.
- [x] Add Prop overview/detail reads.
- [x] Add thin Prop Asset/selected-Hero routes.
- [x] Add browser continuity services and DTOs.
- [x] Keep file paths behind safe browser URLs.
- [x] Forward Core diagnostics and resource keys unchanged.
- [x] Keep all Asset eligibility rules out of routes/services.

### Shared Studio Presentation

- [x] Lock current Cast/Location desktop evidence before refactoring.
- [x] Extract the shared continuity overview grid.
- [x] Extract the shared continuity feature image.
- [x] Extract common image Asset helpers.
- [x] Extract the bounded canonical-image/sheet Assets sections.
- [x] Extract only Asset orchestration that is truly common.
- [x] Keep Cast Voice behavior Cast-owned.
- [x] Keep Location and Prop fact presentation domain-owned.
- [x] Prove no visible or behavioral Cast/Location regression.
- [x] Use only local shadcn-style interactive controls.
- [x] Delete obsolete duplicated implementations rather than wrapping them.

### Prop Studio Surface

- [x] Add Props below Locations and above Acts.
- [x] Add count, expansion, and ordered child navigation.
- [x] Add URL-owned overview and detail routes.
- [x] Add Prop overview cards with no invented subtitle.
- [x] Add Details and Assets tabs.
- [x] Match Location geometry and behavior.
- [x] Show selected Hero in overview/details.
- [x] Show Hero Images before Prop Sheets.
- [x] Add Preview, inspection, select/clear, delete, loading, and error behavior.
- [x] Add desktop component and E2E coverage.
- [x] Rename the broad navigation hook directly with no alias.

### Studio Skills

- [x] Update Production Designer routing and main workflow.
- [x] Add Prop fact and Prop Design references.
- [x] Add Prop media handoff guidance.
- [x] Update Media Producer routing and workflow.
- [x] Add Prop Sheet/Hero reference guidance.
- [x] Add agent-owned Prop Sheet board-design guidance.
- [x] Add Prop Sheet and Hero sample specs.
- [x] Add forward evals for cannon, helmet, explicit reference choice, and no
      automatic promotion.
- [x] Correct stale Location first-candidate guidance.
- [x] Update Movie Director routing/checklists.
- [x] Validate skills without moving creative rules into Studio runtime.

### Real Project

- [x] Create a verified migration backup.
- [x] Prove migration on an isolated project copy first.
- [x] Confirm all current Location recurring objects survive.
- [x] Confirm all existing Asset/selection/generation/Trash data survives.
- [x] Author accepted cannon and helmet Props through public commands.
- [x] Do not reparent or share existing Assets.
- [x] Import/generate accepted Prop media only through focused commands.
- [x] Complete the end-to-end Studio and generation smoke journey.

### Tests And Guardrails

- [x] Add fact/design behavior tests.
- [x] Add migration preservation/failure tests.
- [x] Add Asset ownership/selection/path tests.
- [x] Add generation/context/Preview/attachment tests.
- [x] Add resource/navigation/coordination tests.
- [x] Add CLI/server/service tests.
- [x] Add shared continuity regression tests.
- [x] Add Prop Studio component/E2E tests.
- [x] Add skill validations/evals.
- [x] Protect stable boundaries without private-name architecture inventories.
- [x] Run the architecture-shape checks in Final Verification.

### Documentation And Decisions

- [x] Add the accepted first-class Props ADR at the next available number.
- [x] Add narrow update notices to ADRs 0028 and 0064.
- [x] Update current domain vocabulary and data/storage docs.
- [x] Update generation and Preview docs.
- [x] Update frontend/resource docs.
- [x] Update CLI command docs.
- [x] Update current Studio Skills reference docs.
- [x] Preserve historical plans and decision bodies.

### Final Verification

- [x] Run focused package tests during each slice.
- [x] Run package builds and root `pnpm check`.
- [x] Run root unit, integration, and Studio smoke E2E coverage.
- [x] Run sister-project skill validation and relevant evals.
- [x] Complete the isolated `urban-basilica` migration and desktop journey.
- [x] Compare Props and Locations at both accepted desktop viewports.
- [x] Inspect `git diff --stat` and the complete diff.
- [x] Inspect all new or heavily modified files.
- [x] Confirm `index.ts` files remain thin.
- [x] Confirm expected existing files shrank or disappeared.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure, a compatibility layer, or unrelated formatting churn.
- [x] Only then mark this plan complete.
