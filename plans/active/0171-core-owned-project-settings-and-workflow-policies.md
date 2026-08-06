# 0171 Core-Owned Project Settings And Workflow Policies

Status: complete
Date: 2026-08-06

## Summary

Add a `Settings` tab to Project Details and make those values the durable
Project-wide source of truth for screenplay-import automation and generation
workflow preferences.

The implementation follows one simplicity rule:

> Project Settings are one small, versioned JSON document stored in one
> project-local singleton row.

Core owns that document's current schema, defaults, validation, reads, writes,
and derived workflow policy. Studio, CLI, and skills consume it. There is no
column per setting, no nested patch-interface hierarchy, no generic state
patcher, and no settings framework.

The smallest complete slice is:

- one `project_settings` row with `singleton_id = 1` and one JSON document;
- one document version, starting at `1`;
- one Core read and one full-document replace command;
- one Core-produced generation workflow policy in Generation Context;
- the raw document in Director Context for import coordination;
- thin GET/PUT Studio routes and `renku settings show/set` commands;
- the requested Project Details tabs and settings controls;
- direct removal of the superseded global `agentMedia` setting; and
- focused updates to the three coordinating skills, including every
  purpose-specific file that currently hard-codes generation policy.

The plan does not add a job system, provider abstraction, generic preferences
platform, or creative behavior to Core.

## Requirement Ledger

| Id | Requirement | Source | Owner | Verification |
| --- | --- | --- | --- | --- |
| R1 | Project Details has `Project Info` and `Settings` line tabs matching the existing Cast Details treatment. | User request and supplied screenshots. | Studio Project Details composition. | Component tests and desktop comparison. |
| R2 | Project Info keeps its current fields, layout, autosave, validation, and Project-shell refresh behavior. | User request. | Existing Project Information feature. | Existing tests plus tab-switch/save-state tests. |
| R3 | Settings use the accepted labels, descriptions, shadcn controls, accordion groups, defaults, and 1–5 concurrency choices. | User request and Studio UI rules. | Studio Settings tab. | UI interaction, accessibility, and desktop checks. |
| R4 | Each project-local database owns one durable, versioned Project Settings JSON document initialized during migration or Project creation. | User request and the one-database-per-Project boundary. | Core schema, migration, and creation transaction. | Migration, creation, AJV, and real-project-copy verification. |
| R5 | Core is the only owner of settings defaults, validation, persistence, versioning, and resolved generation policy. | Architecture hard gate. | Core Project Settings module and Project Data Service. | Owning-layer tests and searches for duplicated defaults. |
| R6 | FDX import remains deterministic; saved import preferences gate agent-owned follow-up for facts, images, analysis, Beat Sheets, and storyboards. | User request and accepted FDX architecture. | Director/screenplay skill workflow using Director Context. | Skill evals and unchanged importer tests. |
| R7 | Generation Context reports path preference, Preview behavior, confirmation behavior, and effective per-lane concurrency. | User request. | Core policy projection; media-producer consumes it. | Core projection tests and skill evals. |
| R8 | Renku-managed runs retain exact estimate-token integrity; Codex remains an agent-external harness capability outside Engines. | Existing generation decisions. | Existing Core lifecycle plus agent workflow. | Generation regression tests and skill evals. |
| R9 | Studio HTTP and CLI remain thin and forward the Core mutation result, including its resource key. | User request and coordination decisions 0030/0054. | Studio and CLI adapters. | Delegation, serialization, and notification tests. |
| R10 | The obsolete global `agentMedia.imageGeneration` contract is deleted directly, with no alias or compatibility reader. | Single-source requirement and no-compatibility rule. | Core config cleanup, docs, and skills. | Config tests and repository search. |

Everything in this plan must trace to one of these requirements. In particular,
there is no requirement for individual SQL queries over settings, so there is
no justification for individual settings columns.

## Product Behavior

### Project Details tabs

The Project Details panel keeps the `PROJECT DETAILS` title. Its content becomes
flush so the existing `LineTabs` band sits directly below the title, matching
Cast Member details:

- `Project Info` is first and selected by default;
- `Settings` is second;
- the existing 46px line-tab band, typography, active fill, underline, border,
  and inset are reused unchanged;
- no card, centered wrapper, extra top margin, or second border surrounds the
  tabs;
- each tab's content has its own normal inset below the band;
- both tab contents remain mounted while inactive content is hidden, preserving
  drafts and autosave queues; and
- the parent reports one header save notification across both tabs, prioritizing
  error, then saving, then the most recent saved state.

The existing Project Information feature remains in its current folder and is
composed into the first tab. It is not renamed, split, or moved merely to fit the
new shell. Its visible fields, effective 20px alignment, draft behavior, and
latest-only autosave remain unchanged.

The selected tab is local UI state. This plan adds no route segment and no
persisted tab preference.

### Settings layout and copy

The Settings tab uses one quiet `max-w-4xl` document column aligned with Project
Info. It uses the existing shadcn `Accordion` with `type="multiple"`:

- `Screenplay Import` starts expanded;
- `Generation`, `Renku-managed generation`, and `Codex built-in image
  generation` start collapsed; and
- any combination of the four sections may remain open.

Each row uses a sentence-case label and concise muted description on the left,
with a shadcn `Switch` or compact shadcn `Select` on the right. Soft dividers
separate rows. Controls have visible focus and are associated with their label
and description. No raw interactive HTML is introduced.

The accepted copy and defaults are:

| Group | Visible label | Description | Control | Default |
| --- | --- | --- | --- | --- |
| Screenplay Import | Create cast, locations, and props | After importing Final Draft, continue with unambiguous continuity facts and screenplay reference bindings. | Switch | On |
| Screenplay Import | Generate profile and hero images | Generate a Cast Profile, Location Hero, or Prop Hero after the corresponding continuity subject is ready. | Switch | Off |
| Screenplay Import | Analyze the screenplay | Run screenplay analysis after the imported screenplay and accepted reference bindings are ready. | Switch | Off |
| Screenplay Import | Generate Scene Beat Sheets | Create an active Beat Sheet for each imported Scene after its required project context is ready. | Switch | Off |
| Screenplay Import | Generate storyboard images | Generate and import storyboard images for the current Beats after each Scene has an active Beat Sheet. | Switch | Off |
| Generation | Prefer Codex for image generation | Use Codex built-in image generation when the current agent has that capability and the user has not chosen another path. | Switch | On |
| Generation | Show generation previews | Open the saved Generation Preview automatically before execution. Explicit Preview requests still work when this is off. | Switch | On |
| Renku-managed generation | Ask before generating | Pause for confirmation immediately before a live provider run. | Switch | On |
| Renku-managed generation | Run generations concurrently | Allow independent Renku-managed requests to run concurrently. | Switch | Off |
| Renku-managed generation | Max concurrent generations | Maximum independent Renku-managed requests scheduled together. | Select: 1–5 | 1 |
| Codex built-in image generation | Ask before generating | Pause for an additional conversational confirmation before invoking the Codex image tool. | Switch | Off |
| Codex built-in image generation | Run generations concurrently | Allow independent Codex image requests to run concurrently. | Switch | On |
| Codex built-in image generation | Max concurrent generations | Maximum independent Codex image requests scheduled together. | Select: 1–5 | 5 |

The generation lanes are separate top-level accordion sections, not cards or
nested accordions:

- `Renku-managed generation` — “Runs through configured providers and may
  incur usage charges.”
- `Codex built-in image generation` — “Runs through the current Codex image
  capability and is not a Renku provider run.”

A maximum Select is disabled when concurrency is off and displays “Applies
when concurrent generation is enabled.” Disabling concurrency does not change
the stored maximum. Core reports an effective limit of `1`; re-enabling restores
the saved maximum.

### Loading and autosave

The Settings tab reads the complete current document and uses that document as
its draft. It does not create a second draft schema or calculate a partial
patch.

Autosave uses the existing latest-only serialized queue:

1. a control updates the local document immediately;
2. the queue sends the complete document with `PUT` only when it differs from
   the last committed document;
3. one request runs at a time and only the latest pending document is retained;
4. a successful Core response becomes the new committed baseline;
5. a response replaces the visible draft only when no newer local edit would
   be overwritten;
6. structured Core errors flow through `StudioApiError` and the existing header
   notification; and
7. a `project-settings` refresh reloads a clean draft but never overwrites an
   unsaved local edit.

The browser does not synthesize defaults. A missing or invalid settings row is
a Core error and tells the caller to migrate or repair the selected Project
through the supported workflow.

### Screenplay import automation

The five import settings are agent workflow preferences. They do not add
creative behavior to Core, the server, CLI import code, or React.

The deterministic FDX command remains responsible only for parsing, validating,
and writing the canonical imported Screenplay and provenance, returning
candidate evidence, and enforcing the current single-import contract.

After a successful import, the movie-director/screenplay-drafter workflow reads
`projectSettings.screenplayImport` and applies enabled stages in this order:

1. create accepted Cast, Location, and Prop facts from unambiguous evidence,
   then bind exact durable ids to the Screenplay;
2. generate `cast.profile`, `location.hero`, or `prop.hero` media after its
   subject is ready;
3. run screenplay analysis after import and accepted bindings settle;
4. create an active Scene Beat Sheet after each Scene's context is ready; and
5. generate/import the existing storyboard-sheet outputs only after that Scene
   has an active Beat Sheet.

Analysis and continuity media may proceed independently after their own
prerequisites. Storyboards never run before an active Beat Sheet.

Enabled means the coordinating agent continues without another “start this
stage?” question after the user requested the import. It does not authorize
identity guesses:

- ambiguous cues, places, or Props still require user/agent judgment;
- an existing fact is not reused only because its name looks similar;
- disabled stages are not proactively dispatched;
- explicit direction for the current task may run or skip a stage without
  mutating Project Settings; and
- a missing prerequisite stops only its dependent stage with a clear report.

The movie director remains the cross-department coordinator. The screenplay
drafter owns the deterministic import and returns its evidence to that
coordinator; it does not independently become a casting, production-design, or
media orchestrator.

### Generation workflow policy

Core resolves the stored Generation settings for the requested output media
kind and places one small `workflowPolicy` object in Generation Context. Skills
do not read the database or copy default matrices.

Path precedence is:

1. explicit user direction for the current request;
2. an execution path already authored on the saved `GenerationSpec`;
3. Project workflow policy; and
4. no adapter-local or skill-local default.

For image output, Codex is preferred when configured and the current harness
offers `codex.gpt-image-2`. Codex remains `agent-external`, unavailable as a
Renku provider, and dependent on the harness tool. If the capability is absent,
the agent asks for a path instead of silently falling back to a paid Renku run.
Audio and video use Renku-managed execution.

`displayPreview` controls only automatic Preview display. Explicit Preview
requests and Preview UI access always remain available. Preview edits keep the
existing revalidation and re-estimation behavior.

`requirePerRunConfirmation` controls an additional conversational pause. It
does not bypass tool permissions, provider authentication, output review, or
attachment intent. For Renku-managed execution, every run still validates the
saved spec, obtains the exact current estimate and approval token, passes that
token unchanged, and re-estimates when pricing inputs change.

For a batch, Core reports each lane's effective concurrency limit:

```text
allowConcurrentGenerations ? maxConcurrentGenerations : 1
```

Only independent requests may overlap. Every request retains its own spec,
Preview decision, estimate/token or external freeze, run/tool call, inspection,
and attachment. This plan adds no durable queue, worker, scheduler, retry system,
or cross-process concurrency guarantee.

### Project scope and CLI

Settings live in the selected Project's own
`<project-folder>/.renku/project.sqlite`. The database is already the Project
ownership boundary, so the settings row has no `project_id`. The home library
continues to discover separate Project folders and databases.

The CLI surface is:

```bash
renku settings show --project <project-name> --json
renku settings set --project <project-name> --file <project-settings.json> --json
```

`--project` may use the current authoring Project under existing resolution
rules. `show` returns the complete current document. `set` requires one complete
current-version document, delegates validation and replacement to Core, prints
the committed result, and forwards Core's resource notification. The CLI does
not expose thirteen duplicated flags, calculate defaults, or merge documents.

## Simplicity Rule And Non-Goals

### Simplicity rule

The settings share one lifecycle and are never queried independently by SQL.
Therefore the starting design is one versioned JSON document.

Adding a future setting may require a document-schema/version change and a
one-way data migration, but it must not require a new SQL column, a mirrored
patch type, or another adapter contract. A relational column is allowed only
when a concrete current query, uniqueness rule, join, index, or database
integrity requirement cannot be met by the document boundary.

The property bag remains bounded and Core-owned. “JSON” does not mean
unvalidated or adapter-writable: Core validates the complete document with AJV
before every write and after every read.

### Explicit non-goals

This plan does not:

- add settings to Project Information or global Renku configuration;
- introduce a column per setting, key/value table, generic settings service,
  generic Project-state patch, arbitrary mutation API, or recursive patch type;
- add timestamps, row revisions, optimistic locking, or audit history without a
  current consumer;
- preserve obsolete `agentMedia` config/report aliases or readers;
- make FDX import create facts, media, analyses, Beat Sheets, or storyboards;
- semantically parse creative screenplay, prompt, or media content;
- add Project Settings or Codex provider behavior to Engines;
- weaken estimate-token, freeze, output-acceptance, or attachment boundaries;
- silently fall back from Codex to paid Renku execution;
- rewrite an existing Generation Spec when settings change;
- add a persistent queue or scheduler;
- add a frontend dependency, raw interactive control, or mobile work; or
- run an automatic plan review.

## Context And Evidence

- `AGENTS.md` requires durable Project rules and mutations in Core with thin
  Studio, CLI, React, and skill consumers.
- `docs/architecture/data-model-and-storage.md` explicitly allows SQLite JSON
  text when AJV validates an explicit JSON Schema before writes and after reads.
- `docs/architecture/reference/drizzle-migrations.md` requires Drizzle Kit for
  schema generation/application and documented custom data SQL.
- ADR 0005 requires latest-only serialized autosave.
- ADRs 0030 and 0054 require Core mutation reports to carry resource keys and
  adapters to forward them unchanged.
- ADR 0040 keeps Codex image generation agent-external and outside Engines.
- ADR 0043 protects live provider intent; the current exact estimate-token gate
  remains intact while the extra conversational pause becomes configurable.
- ADRs 0047, 0056, and current generation references retain context-first saved
  specs and exact freeze/run behavior.
- ADRs 0071 and 0073 keep FDX content on the Project and derived creative
  artifacts independently authored.
- The current Cast panel already supplies the requested `LineTabs` treatment.
- The existing Project Information component already owns the correct form and
  autosave behavior and can remain unchanged inside a new tab shell.
- The local shadcn `Accordion`, `Switch`, `Select`, and `LineTabs` primitives
  already exist.
- Current generation and director contexts are the established agent-facing
  read boundaries; no new settings lookup is needed in every specialist.
- Current media-producer guidance hard-codes routing, Preview, and confirmation,
  including purpose-specific instructions in `references/shot-image.md`; those
  files must be cut over together.

Repository state inspected on 2026-08-06:

- migration `0074_backfill_missing_project_base_language.sql` is latest;
- Project schema generation is `59`;
- `urban-basilica` is at generation `59` and has no settings table; and
- the current local global Renku config has no `agentMedia` block.

The next schema migration is planned as
`0075_core_owned_project_settings.sql`, reaching generation `60`. If migration
history changes first, implementation must update the number before generation
rather than overwriting history.

## Right-Sized Change Decision

Three options were compared:

1. **Add fields to Project Information.** Rejected because story metadata and
   workflow preferences have different ownership and consumers.
2. **Expand global Renku YAML.** Rejected because the settings belong to and
   travel with one Project database.
3. **Store one Core-owned versioned JSON document.** Accepted because all
   settings share one lifecycle, are read together, and have no relational query
   requirement.

The accepted option deliberately uses the fewest concepts that preserve the
architecture boundary:

- one document;
- one table row;
- one AJV validator;
- one read command;
- one replace command;
- one derived generation policy; and
- existing Director/Generation contexts and existing adapters.

## Contracts

### Version 1 document

`packages/core/src/client/project-settings.ts` exports one
`ProjectSettingsDocument` type matching this complete persisted JSON shape:

```json
{
  "version": 1,
  "screenplayImport": {
    "createContinuitySubjects": true,
    "generateContinuityImages": false,
    "runScreenplayAnalysis": false,
    "generateSceneBeatSheets": false,
    "generateBeatStoryboardImages": false
  },
  "generation": {
    "preferCodexImageGeneration": true,
    "displayPreview": true,
    "renkuManaged": {
      "requirePerRunConfirmation": true,
      "allowConcurrentGenerations": false,
      "maxConcurrentGenerations": 1
    },
    "codexBuiltIn": {
      "requirePerRunConfirmation": false,
      "allowConcurrentGenerations": true,
      "maxConcurrentGenerations": 5
    }
  }
}
```

This literal is also the sole `DEFAULT_PROJECT_SETTINGS` value in Core. The
TypeScript type keeps the nested members inline; there are no exported
per-group settings interfaces and no patch interfaces.

The current JSON Schema requires every displayed field, rejects unknown fields
and `null`, and constrains both maxima to integers from 1 through 5. AJV runs
with all errors enabled before writes and after parsing reads so callers receive
all actionable issues together.

### Document versioning

`version` is the settings-document schema version, independent from SQLite's
`PRAGMA user_version`:

- the initial row contains document version `1`;
- runtime code accepts only the current document version;
- future document changes bump the version and add one Drizzle-managed,
  one-way data migration from the immediately previous current version;
- migration rewrites the stored JSON to the new complete document before the
  new runtime reads it;
- runtime reads never migrate, repair, or silently default an older document;
  and
- changing document fields alone does not add table columns.

There is no compatibility reader or multi-version runtime registry. Current
code and current data move together during this pre-customer phase.

### Persistence

The Drizzle table is intentionally only:

| Column | Shape |
| --- | --- |
| `singleton_id` | integer primary key, non-null, check `singleton_id = 1` |
| `document` | text, non-null, containing the complete JSON document |

There is no Project foreign key, per-setting column, generic setting key,
timestamp, or duplicated Project identity. Database access reads, inserts, or
replaces the one complete `document` value.

Migration 0075 creates the table and inserts the exact version 1 default into
the selected existing project-local database. `createMovieProject` inserts the
same serialized default inside the existing Project creation transaction.
Missing or invalid rows are errors; runtime reads do not create them.

### Public Core boundary

The browser-safe client entrypoint exports only these settings concepts:

- `ProjectSettingsDocument` — the complete versioned document;
- `ProjectSettingsResource` — existing Project identity plus the document;
- `ProjectSettingsMutationReport` — `{ resource, resourceKeys }` from a
  successful replacement;
- `GenerationWorkflowPolicy` — one resolved policy object with inline lane
  members; and
- `STUDIO_PROJECT_SETTINGS_RESOURCE_KEY` — `project-settings`.

The existing server resource-key catalog adds
`studioProjectSettingsResourceKey()`. Core uses that builder when constructing
the mutation report and Director Context dependencies; adapters never call it
to recreate a mutation result.

No per-field, per-group, patch, record, lane, or concurrency-limit public type
is added.

`ProjectDataService` adds:

```ts
readProjectSettings(input: ReadProjectInput): Promise<ProjectSettingsResource>;

replaceProjectSettings(
  input: ReadProjectInput & { settings: unknown }
): Promise<ProjectSettingsMutationReport>;
```

`unknown` is deliberate at the mutation boundary: HTTP and CLI may pass parsed
JSON to Core, and Core owns the only validation. After validation, Core writes
the complete document atomically and constructs the mutation report with the
Core-owned `project-settings` resource key. CLI and Studio forward that report;
they do not reconstruct the key.

### Context projections

`DirectorContextReport` replaces `agentMedia` with:

```ts
projectSettings: ProjectSettingsDocument;
```

Director Context includes `project-settings` in its resource dependencies.

`GenerationContext` gains one `workflowPolicy: GenerationWorkflowPolicy`. The
policy contains only what the media workflow needs:

- `displayPreview`;
- `preferredExecutionPath`;
- for each lane, `requirePerRunConfirmation` and the resolved
  `concurrencyLimit`;
- for Codex, `applicable`, `executionKind: "agent-external"`, capability id
  `codex.gpt-image-2`, `availableInRenku: false`, and
  `requiresHarnessTool: true`; and
- for Renku, `executionKind: "renku-managed"`.

There are no separate exported lane-policy interfaces. One pure Core resolver
returns `GenerationWorkflowPolicy` from the settings document and requested
output media kind.

### HTTP and CLI

Studio adds:

```text
GET /studio-api/projects/:projectName/settings
PUT /studio-api/projects/:projectName/settings
```

GET returns `{ resource }`. PUT requires the existing mutation token, accepts
the complete document as its body, passes it to Core unchanged, and returns the
Core `ProjectSettingsMutationReport` unchanged.

The CLI `set --file` command reads one complete JSON document and passes the
parsed unknown value to Core. Core validation errors are serialized through the
existing structured diagnostic path.

### Diagnostics

Use two Core diagnostic codes:

| Code | Meaning |
| --- | --- |
| `PROJECT_SETTINGS001` | The selected database has no required settings singleton and must be migrated. |
| `PROJECT_SETTINGS002` | The stored or supplied settings document is invalid; AJV issues include exact paths and version/type/range failures. |

Adapters do not invent field-specific diagnostic families.

## Architecture Shape Gate

### Ownership and minimal module layout

Core owns the durable document and derived policy:

```text
packages/core/src/client/
  project-settings.ts

packages/core/src/server/project-settings/
  index.ts
  document.ts
  service.ts
  generation-policy.ts

packages/core/src/server/schema/
  project-settings.ts

packages/core/src/server/database/access/
  project-settings.ts
```

- `client/project-settings.ts` contains only the small browser-safe public
  contracts.
- `document.ts` contains the one default literal, one JSON Schema, and AJV
  validation/parse functions. These are one cohesive responsibility.
- `service.ts` composes read and full replace operations through the existing
  Project database lifecycle and returns resources/reports.
- `generation-policy.ts` is the pure policy projection.
- `project-settings/index.ts` is a thin internal entrypoint.
- the existing `project-administration.ts` wiring gains the two methods; a new
  wiring module is not justified for two Project-administration operations.
- the existing schema/access boundaries keep SQL out of the service.
- current director and generation modules consume the focused functions; they
  do not re-own settings logic.

Studio reuses the existing Project Information feature and projects the new
resource:

```text
packages/studio/src/features/movie-studio/project-details/
  project-details-panel.tsx
  project-details-panel.test.tsx
  project-settings-panel.tsx
  project-settings-panel.test.tsx
  project-settings-fields.tsx

packages/studio/server/routes/
  project-settings.ts
  project-settings.test.ts
```

- `project-details-panel.tsx` owns tabs and combines the two existing save
  statuses using `chooseDetailSaveNotification`.
- `project-settings-panel.tsx` owns load, full-document draft, latest-only
  autosave, and safe refresh behavior.
- `project-settings-fields.tsx` owns the accordion/row presentation and shadcn
  controls only.
- `project-information/` remains in place and unchanged except for any minimal
  inset needed when composed below the tab band.
- `studio-projects-api.ts` gains the two settings fetch functions; a new service
  file is unnecessary.
- the route passes parsed JSON to Core and needs no separate request parser.
- `movie-studio-screen.tsx` swaps in `ProjectDetailsPanel` and adds the Project
  surface to the existing flush-content predicate; it acquires no settings
  logic.

CLI adds one focused command file and its test:

```text
packages/cli/src/commands/project-settings-command.ts
packages/cli/src/commands/project-settings-command.test.ts
```

The file owns only `show`, `set`, file reading, Core delegation, output, and
notification for this two-command family. Split it only if implementation makes
it materially difficult to review; do not begin with a four-file dispatcher.

The sister-skill cutover includes these known owners:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/movie-director/
  SKILL.md
  references/workflow-playbooks.md
  references/specialist-handoff-checklists.md
  evals/project-settings-workflow-policy.md

/Users/keremk/Projects/aitinkerbox/studio-skills/skills/screenplay-drafter/
  SKILL.md
  references/screenplay-json-workflow.md
  evals/fdx-import-enrichment.md

/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/
  SKILL.md
  references/workflow.md
  references/shot-image.md
  evals/forward-test-cases.md
  evals/image-prompt-routing/forward-test-cases.md
```

Search the full media-producer tree for other hard-coded path, Preview,
confirmation, or concurrency defaults before completing the cutover. Add a file
to the change only when that search proves it owns conflicting current policy.

### Files that shrink or disappear

- delete `packages/core/src/client/agent-media.ts`;
- remove `agentMedia` fields, readers, validators, and exports from
  `renku-config.ts` and current callers;
- replace `DirectorContextReport.agentMedia` with `projectSettings`;
- remove the hard-coded agent-media object from Director Context;
- keep `generation/purpose-factory.ts`, `project-data-service.ts`,
  `routes/projects.ts`, and package `index.ts` files thin; and
- do not move or reformat Project Information files.

### Forbidden implementation shapes

Do not:

- add one database column or public interface per setting;
- add a patch document, patch resolver, generic recursive merge, settings
  registry, generic key/value API, or arbitrary Core state patcher;
- validate settings in HTTP, CLI, React, Engines, or skills;
- add read-time migration, missing-row defaults, or compatibility parsing;
- reconstruct `resourceKeys` in Studio or CLI;
- add settings logic to Project Information;
- call agents, providers, or harness tools from Core settings code;
- put Codex in Engines catalogs;
- add provider/purpose branches to every generation purpose;
- add a queue or scheduler;
- add raw Studio controls, compatibility wrappers, or re-export stubs;
- add architecture tests that freeze helper names or module inventories; or
- split a small cohesive file solely to satisfy an abstract layering pattern.

### Stop conditions

Stop and revise before implementation continues if:

- a proposed setting needs independent SQL querying or relational integrity;
- the JSON document starts accepting unrelated arbitrary application state;
- more than one runtime document version must be supported;
- Core would need to invoke a skill, provider, or harness tool;
- Engines would need to read a Project database;
- concurrency requires durable recovery, cancellation, fairness, or dependency
  scheduling;
- HTTP, CLI, React, or a skill needs to calculate defaults or effective policy;
- one file begins combining settings, unrelated Project administration,
  generation execution, and response formatting; or
- the implementation grows a framework larger than the settings behavior.

## Implementation Slices

### Slice 1 — Add the versioned document and storage

Files:

- Core client document contracts;
- `project-settings/document.ts`;
- Drizzle schema/access files;
- migration 0075 and lifecycle test;
- `createMovieProject` and its test.

Work:

- define the exact version 1 document and default literal;
- compile one all-errors AJV validator;
- validate parsed JSON after reads and before writes;
- add the two-column singleton table;
- generate migration 0075 with Drizzle Kit and add the documented default-row
  insert;
- insert the same default inside new-Project creation; and
- prove rollback, singleton integrity, exact default JSON, and generation 60.

Exit: a new or migrated Project has exactly one valid version 1 document, with
no per-setting columns or runtime repair.

### Slice 2 — Add Core read/replace and context policy

Files:

- `project-settings/service.ts` and `generation-policy.ts`;
- Project Data Service contracts and existing Project Administration wiring;
- Director/Generation client contracts and context producers;
- Core resource-key catalog;
- Core tests.

Work:

- implement focused read and full-document replacement;
- return Core-owned resource keys in the mutation report;
- add the raw document to Director Context;
- add one resolved policy to Generation Context;
- cover media-kind applicability, Preview, confirmation, path preference, and
  effective concurrency; and
- leave existing generation models, references, prompts, validation, estimates,
  and execution unchanged.

Exit: existing agent contexts carry all policy needed by their current owners,
and no adapter derives settings behavior.

### Slice 3 — Remove global policy and add thin adapters

Files:

- delete the old Core agent-media client contract;
- Core Renku config and tests;
- Studio settings route, `routes/projects.ts`, and `studio-projects-api.ts`;
- CLI settings command and tests;
- shared Studio resource matcher.

Work:

- delete global `agentMedia` support and update current callers directly;
- add token-protected GET/PUT routes;
- add browser read/replace functions to the existing Project service;
- add CLI `show` and full-document `set`;
- forward Core mutation reports and diagnostics unchanged; and
- emit one Studio resource notification after successful CLI replacement.

Exit: there is one Project-owned settings source and thin adapters contain no
defaults, validation, merge, or resource-key construction.

### Slice 4 — Add the Project Details settings UI

Files:

- the three Project Details files in the Architecture Shape Gate;
- their focused tests;
- `movie-studio-screen.tsx`;
- minimal additions to the existing Project API service/matcher tests.

Work:

- compose existing Project Information and new Settings under `LineTabs`;
- keep both contents mounted;
- implement the exact accordion copy and shadcn controls;
- use the complete document as the draft and PUT payload;
- reuse latest-only autosave and safe external refresh behavior;
- combine save notifications; and
- preserve Project Info behavior and formatting.

Exit: the requested desktop surface works without a second settings model,
feature-local validation, raw controls, or Project Information rewrite.

### Slice 5 — Cut agent workflows over to Core policy

Files: the exact sister-skill files listed in the Architecture Shape Gate plus
any additional conflicting media-producer reference found by the required
search.

Work:

- make movie-director consume Project Settings for FDX follow-up dispatch;
- keep screenplay-drafter deterministic and preserve ambiguity handoff;
- make media-producer consume Generation Context before choosing an unselected
  path or deciding Preview, confirmation, and concurrency;
- remove the Shot Image hard-coded Codex/approval defaults;
- preserve saved-spec, freeze, exact estimate-token, inspection, and focused
  attachment rules; and
- update forward evals for defaults, overrides, unavailable Codex, Preview,
  confirmation, and concurrency.

Exit: current skills contain no independent policy defaults and do not weaken
generation or media-integrity boundaries.

### Slice 6 — Record the accepted decision

Files:

- new `docs/decisions/0074-use-core-owned-project-workflow-settings.md`;
- concise notices in ADRs 0040 and 0043;
- current data-model, media-generation, FDX-import, Studio-skill,
  coordination-event, vocabulary, and CLI references that describe the changed
  contract.

Work:

- record the versioned JSON document and its Core ownership;
- record that per-setting columns and patch interfaces were deliberately not
  introduced;
- record the deterministic-import/agent-follow-up boundary;
- supersede the global policy source from ADR 0040 while retaining
  agent-external Codex;
- narrow ADR 0043's conversational pause while retaining exact token integrity;
  and
- document current CLI/HTTP/context surfaces without rewriting historical ADR
  bodies or old plans.

Exit: accepted docs describe the same small current architecture as code and
skills.

## Tests And Guardrails

### Core owning-layer coverage

- New Project creation and migration store the exact version 1 default JSON.
- Settings insertion failure rolls back the existing Project creation
  transaction.
- The singleton check prevents any id except `1` and a second row.
- Valid current-version documents round-trip exactly.
- Missing rows, malformed JSON, old/new versions, missing/unknown keys, nulls,
  wrong types, fractional/zero/above-five maxima, and invalid stored documents
  fail before a write or projection with structured issues.
- A failed replacement leaves the previous document unchanged.
- Core mutation reports include the committed resource and exact
  `project-settings` key.
- Director Context contains the exact document and dependency key.
- Generation Context covers image/audio/video path applicability, both path
  preferences, both confirmation values, Preview values, and effective
  concurrency with concurrency on/off.

### Adapter and UI coverage

- HTTP tests cover token enforcement, delegation of parsed unknown JSON,
  response forwarding, and structured error translation—not Core's full
  validation matrix.
- CLI tests cover Project/file resolution, malformed JSON, delegation, output,
  and one notification—not Core's field matrix.
- Browser service and resource matcher tests cover GET/PUT and the stable key.
- UI tests cover default tab, mounted tab preservation, exact copy/controls,
  full-document autosave, disabled maxima without value loss, dirty-draft
  refresh protection, combined save notification, labels, and keyboard focus.
- Existing Project Information tests remain green without being copied into the
  Project Details suite.

### Generation and skill regression coverage

- Existing exact estimate-token, spec validation, Preview, freeze,
  agent-external provenance, and focused attachment tests remain green.
- Engines gains no Project Settings contract or Codex provider behavior.
- Skill evals cover default FDX follow-up, all import stages enabled, explicit
  overrides, unavailable Codex, Preview off with explicit Preview intent,
  confirmation off with exact Renku token use, and concurrency limits.
- A Shot Image eval proves `references/shot-image.md` no longer overrides Core
  policy.

### Architecture guardrails

- Keep existing package import, raw-control, and forbidden-re-export checks.
- Add runtime boundary tests for invalid JSON before writes; do not add
  source-text tests naming settings helpers or inventories.
- Search production and sister skills for duplicated default values and obsolete
  `agentMedia`/hard-coded workflow policy.

## Documentation And ADR Effects

ADR 0074 records:

- one Project-local, versioned JSON settings document;
- Core-owned schema, defaults, validation, replacement, and policy projection;
- full-document replacement rather than patches;
- future version changes through one-way Drizzle data migrations, never
  read-time migration;
- agent-owned FDX follow-up and concurrency scheduling;
- Codex remaining agent-external; and
- the precise supersession/narrowing of ADRs 0040 and 0043.

Only current docs whose contracts change are edited. ADRs 0040 and 0043 receive
short notices linking to ADR 0074; their historical reasoning remains intact.
No separate Project Settings framework/reference document is added unless the
implementation proves existing data-model and workflow references cannot hold
the concise current contract.

## Final Verification

### Automated verification

Run focused tests using the final paths created by implementation, then:

```bash
pnpm build:core
pnpm build:cli
pnpm build:studio
pnpm test:core
pnpm test:cli
pnpm test:studio
pnpm check:architecture
pnpm check
pnpm test
pnpm test:integration
pnpm test:e2e:studio:smoke
```

Do not install dependencies or run a formatter-wide rewrite.

### Real Project

Before the live Project database:

1. stop Studio or otherwise ensure the database is unused;
2. retain the supported pre-migration backup;
3. migrate a disposable copy of
   `/Users/keremk/renku-movies/urban-basilica`;
4. verify generation 60, one two-column settings row, exact version 1 JSON,
   `PRAGMA quick_check`, and unchanged Project Information/counts;
5. run CLI show, replace one value using a complete document, read it back,
   restore the default document, and verify one resource notification; and
6. only then migrate the live Project through the supported command.

Never edit SQLite directly.

### Desktop Product Design

At the existing desktop Studio route for `urban-basilica`, verify:

- the title and tab bands are adjacent and aligned with Cast Details;
- Project Info is selected first and its form spacing is unchanged;
- Settings uses the same active tab treatment;
- accordion rhythm, dividers, lane accordion sections, controls, focus, disabled
  states, and scrolling match current Studio tokens;
- tab switching during autosave preserves drafts and save status; and
- there is no card-within-card, double border, excessive inset, or invented
  copy.

Capture Project Info and Settings at the same desktop viewport as the supplied
references and inspect them side by side. Do not perform mobile verification.

### Architecture and diff inspection

- inspect `git diff --stat` and complete diffs in Studio and `studio-skills`;
- inspect every newly large or heavily modified file;
- confirm Project Information was not moved or reformatted;
- confirm package and module `index.ts` files remain thin;
- confirm the database has only the singleton id and JSON document columns;
- confirm there are no patch interfaces/resolvers, per-setting columns,
  adapter validators, generic settings APIs, local resource keys, job systems,
  or duplicated skill defaults;
- confirm Core ownership did not become a god file; and
- confirm no checklist item passed by accepting unreviewable structure.

## Completion Checklist

### Review Area

- [x] Confirm all ten requirements remain implemented without unsupported
      infrastructure.
- [x] Confirm the final design is one versioned document, one row, one Core
      validator, one read, and one replace command.
- [x] Confirm every additional type, module, diagnostic, or test has a current
      consumer or hard-boundary reason.
- [x] Confirm the final file shape matches the Architecture Shape Gate and no
      god file or broad dispatcher was created.

### Architecture And Contracts

- [x] Add the exact version 1 `ProjectSettingsDocument` and default literal.
- [x] Add only the small resource, mutation-report, workflow-policy, and
      resource-key contracts named by this plan.
- [x] Add focused `readProjectSettings` and `replaceProjectSettings` methods.
- [x] Validate supplied and stored JSON only in Core.
- [x] Return resource keys from Core and forward them unchanged in adapters.
- [x] Add Project Settings to Director Context and resolved policy to Generation
      Context.
- [x] Remove the global agent-media config/report directly with no compatibility
      shape.
- [x] Keep Engines, FDX import, React, HTTP, CLI, and skills outside durable
      settings ownership.

### Data And Migration

- [x] Add the two-column `project_settings` singleton table with no Project FK,
      timestamps, or per-setting columns.
- [x] Generate migration 0075 through Drizzle Kit, or update the number first if
      repository history changed.
- [x] Insert the exact version 1 default for the selected migrated database.
- [x] Insert the same default inside new-Project creation's transaction.
- [x] Verify generation 60, singleton integrity, rollback, exact JSON, and AJV
      read/write validation.
- [x] Add no runtime default, repair, multi-version reader, or migration registry.
- [x] Document future version changes as one-way JSON data migrations without
      table-column expansion.

### Core And Adapter Implementation

- [x] Keep `document.ts`, `service.ts`, and `generation-policy.ts` focused on
      their named responsibilities.
- [x] Reuse existing Project Administration wiring rather than adding a
      two-method wiring abstraction.
- [x] Add token-protected GET/PUT routes without a duplicate request validator.
- [x] Add browser settings calls to the existing Project API service.
- [x] Add one focused CLI command file for show/set and split it only if actual
      complexity demands it.
- [x] Keep Studio and CLI free of defaults, merging, policy calculation, and
      resource-key construction.
- [x] Delete old agent-media code and update current callers directly.

### Project Details UI

- [x] Add `ProjectDetailsPanel` with `Project Info` first and `Settings` second.
- [x] Reuse `LineTabs` and keep both contents mounted.
- [x] Preserve the existing Project Information folder, component behavior,
      tests, formatting, and form layout.
- [x] Add all four accordion groups with the exact accepted copy and shadcn
      controls.
- [x] Use the complete settings document as draft and PUT payload; add no patch
      draft model.
- [x] Reuse latest-only autosave and protect dirty drafts from refresh.
- [x] Disable maxima without overwriting their values.
- [x] Combine both save statuses in the existing header notification.
- [x] Verify labels, descriptions, keyboard focus, scrolling, and supported
      desktop widths.

### CLI And Skills

- [x] Add `renku settings show` and full-document `settings set --file`.
- [x] Resolve explicit/current Projects using existing CLI rules.
- [x] Print canonical JSON and emit exactly one forwarded resource notification.
- [x] Update movie-director to apply import preferences from Director Context.
- [x] Keep screenplay-drafter deterministic and preserve ambiguity handoff.
- [x] Update media-producer to consume Generation Context for path, Preview,
      confirmation, and concurrency.
- [x] Remove the hard-coded policy from `references/shot-image.md`.
- [x] Search all media-producer references/evals and update only additional files
      that contain conflicting current defaults.
- [x] Preserve exact saved-spec, freeze, estimate-token, inspection, and focused
      attachment rules.

### Tests And Guardrails

- [x] Add the complete AJV/storage/version/replacement matrix at Core only.
- [x] Prove invalid documents fail before writes and invalid stored documents
      fail after reads.
- [x] Add Director and Generation context projection tests.
- [x] Keep adapter tests focused on parsing, delegation, translation, output,
      and notification.
- [x] Add Project Details tab, control, autosave, refresh, and save-status tests.
- [x] Keep existing generation-integrity and Project Information tests green.
- [x] Add skill evals for defaults, explicit overrides, Preview, confirmation,
      capability availability, concurrency, and Shot Image policy.
- [x] Keep architecture tests boundary-based and free of implementation-name
      needles.

### Documentation

- [x] Add ADR 0074 for the versioned Core-owned settings document.
- [x] Add concise supersession/narrowing notices to ADRs 0040 and 0043 without
      rewriting their history.
- [x] Update only current data-model, generation, FDX, skill, coordination,
      vocabulary, and CLI docs whose contracts changed.
- [x] Do not add a separate framework document or edit historical plans merely
      to repeat the decision.

### Final Verification

- [x] Run focused and root build/test/check commands listed above.
- [x] Verify a disposable `urban-basilica` migration before the live database
      and retain the supported backup path.
- [x] Complete desktop-only visual and interaction comparison.
- [x] Search for obsolete agent-media concepts, duplicated settings defaults,
      and hard-coded skill policy.
- [x] Review `git diff --stat` and complete diffs in both repositories.
- [x] Inspect large files and confirm `index.ts` files remain thin.
- [x] Confirm no per-setting columns/interfaces, patch machinery, generic
      settings platform, adapter-local rules, queue, or god file was added.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code.
- [x] Only then add completion evidence and mark the plan complete.

## Completion Evidence

Completed on 2026-08-06.

- `pnpm build:core`, `pnpm build:cli`, and `pnpm build:studio` passed.
- `pnpm test` passed across Diagnostics, Core, CLI, Engines, and Studio. The
  package totals relevant to this change were 316 Core tests, 58 CLI tests, and
  322 Studio tests; Engines passed 722 tests with 12 existing todo cases.
- `pnpm test:integration` passed across Core, CLI, Engines, and Studio, including
  31 CLI and 51 Studio integration tests.
- `pnpm test:e2e:studio:smoke` passed all 3 Chromium desktop smoke tests.
- `pnpm check` and `pnpm check:architecture` passed. The root check retained
  only the repository's pre-existing unused-code and CLI `console` warnings.
- Focused Project Settings tests cover Core AJV validation, storage replacement,
  invalid stored data, version rejection, Project-creation rollback, migration,
  Director Context, Generation Context, Studio routes and controls, browser API,
  and CLI parsing/delegation/notification behavior.
- A disposable copy of `urban-basilica` migrated from generation 59 to 60 with
  `PRAGMA quick_check` reporting `ok`, an exact singleton default row, unchanged
  Project identity and content counts, and a supported backup at
  `/private/tmp/renku-settings-0171-final.zTl2Ue/projects/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-59-to-60-20260806T160043766Z-110cac.sqlite`.
- The live `urban-basilica` Project then migrated through the same supported
  path and retained its backup at
  `/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-59-to-60-20260806T160149391Z-ab7a8b.sqlite`.
- Live CLI `settings show`, `settings set`, verification, and restoration proved
  canonical JSON replacement and the single `project-settings` resource key.
- Desktop verification at 1440x1000 covered both line tabs, mounted draft
  preservation, autosave, all four accordion groups, exact copy, disabled maximum
  behavior, scrolling, and the unchanged Project Information form. Evidence is
  stored under the task visualization directory as
  `project-settings-project-info.png`, `project-settings-screenplay-import.png`,
  `project-settings-generation.png`, and `project-settings-generation-lanes.png`.
- Follow-up desktop verification confirmed that `Generation`, `Renku-managed
  generation`, and `Codex built-in image generation` are independent peer
  accordion sections and can remain open or closed in any combination.
- Final searches found the default values only in Core's settings document, no
  settings ownership in Engines, no raw interactive HTML in the feature, no
  Project Settings patch contract, and no remaining global agent-media contract.
- Complete diffs and large-file shapes were inspected in both repositories;
  entrypoint indexes remain thin and no generic settings platform, queue,
  adapter-local policy, compatibility layer, or broad dispatcher was introduced.
