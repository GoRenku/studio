# Renku Studio Naming Guidelines

Date: 2026-05-05

Status: current

Role: architecture policy

## Purpose

Naming is architecture in Renku Studio.

Names define the boundaries between product concepts, browser contracts,
database records, setup input, CLI commands, and server adapters. A vague name
is not harmless. It makes later code harder to place, harder to review, and
easier to accidentally move across an architectural boundary.

This document records the naming rules for the current Renku Studio
implementation. It should be used when designing new files, functions, types,
database tables, DTOs, commands, route handlers, and tests.

Decision history:

- `../decisions/0010-use-domain-naming-and-remove-obsolete-compatibility.md`

The central rule:

> Use the product/domain name when naming public concepts. Use suffixes only
> when a shape is internal to a specific boundary, such as setup input or
> database records.

## Very Important: Do Not Preserve Obsolete Names

Renku Studio is pre-customer software and will be continuously iterated.

During this phase, do not preserve backwards compatibility in code, tests, or
file structure.

That means:

- do not keep old names as aliases;
- do not add shims for prior APIs;
- do not add fallback branches for old structures;
- do not keep tests whose only purpose is to reject an obsolete format;
- do not keep old loaders after the model changes;
- do not mention obsolete names in new code unless a document is explicitly
  describing a historical decision.

When a name or structure changes, update callers to the new name and delete the
obsolete code.

Tests should describe the current intended behavior only. They should not become
a museum of previous iterations.

## Very Important: Names Must Be Deliberate

Never create placeholder names and hope they become clear later.

Avoid names that are generic, temporary, or detached from the domain vocabulary.
If a name feels like a placeholder, stop and choose a better name before writing
the code.

Examples of names to avoid:

- `thing`
- `alias` -- Absolutely banned
- `item`
- `data`
- `stuff`
- `manager`
- `helper`
- `util`
- `create.ts`
- `open.ts`
- `detail`
- `snapshot`
- `workspace` when it could mean UI state, folder state, or database state

These words are not banned in every possible context, but they require a clear
reason. Most of the time they hide the real concept.

Use the vocabulary from `docs/architecture/reference/domain-vocabulary.md` whenever
it defines the concept.

## Three Kinds Of Type Shapes

Renku Studio currently needs three different TypeScript shapes for many domain
areas.

They must not be given the same name.

### Public Contract Objects

Public contract objects are JSON-safe objects returned by `studio-core` and used
by CLI, Studio server, and the browser.

These are DTOs by role, but they should not use a `Dto` suffix.

Use plain domain names:

```ts
Project
ProjectLibrary
ProjectSummary
ProjectInfo
ProjectLanguage
VisualLanguage
CastMember
Episode
Sequence
Scene
Clip
ProjectCounts
```

Why no `Dto` suffix:

- these are the primary public interface objects;
- callers should not have to read implementation-boundary suffixes everywhere;
- the boundary is already clear because these types are exported from the
  browser-safe core contract entry point.

The plain name belongs to the public contract.

### Setup Input Objects

Setup input objects describe a temporary YAML file used by `renku create`.

They are internal to `studio-core/node`.

Use the `Setup` suffix:

```ts
ProjectSetup
ProjectSetupDocument
ProjectSetupValidator
```

Why `Setup`:

- the YAML is used once to set up a project;
- the YAML is not copied into the project as durable state;
- after creation, SQLite is the source of truth;
- the browser should never import setup types.

Setup names must not leak into browser-safe core exports, Studio frontend code,
or Studio server response contracts.

### Database Record Objects

Database record objects describe persisted rows or row-shaped data used by the
SQLite/Drizzle data layer.

They are internal to `studio-core/node`.

Use the `Record` suffix:

```ts
ProjectRecord
ProjectLocaleRecord
VisualLanguageRecord
CastMemberRecord
EpisodeRecord
SequenceRecord
SceneRecord
ClipRecord
```

Why `Record`:

- it marks the shape as persistence-facing;
- it keeps Drizzle row details out of browser contracts;
- it avoids confusing database rows with public JSON contracts.

Record names should not be exported to CLI, Studio server, or browser code.

## Current Public Contract Names

The following names are approved for the first project creation and project
library slice.

### `Project`

`Project` is the full JSON-safe representation of one Renku Studio project.

It is assembled from the project-local SQLite database by `studio-core` and
returned to callers that need to render or inspect one project.

It is not:

- the project folder;
- the SQLite database itself;
- a live database session;
- the YAML setup file;
- a React component;
- an in-memory mutable domain object.

Expected shape:

```ts
export interface Project {
  identity: ProjectInfo;
  coverImage: ProjectCoverImage | null;
  languages: ProjectLanguage[];
  visualLanguage: VisualLanguage[];
  cast: CastMember[];
  episodes: Episode[];
  sequences: Sequence[];
  counts: ProjectCounts;
}
```

### `ProjectLibrary`

`ProjectLibrary` is the JSON-safe object used by the project library or project
picker surface.

It is a list-oriented contract, not the full contents of every project.

Expected shape:

```ts
export interface ProjectLibrary {
  storageRoot: string;
  projects: ProjectSummary[];
}
```

### `ProjectSummary`

`ProjectSummary` is one compact project entry inside `ProjectLibrary`.

It contains only the data needed to show a library card/list item and report
whether the project could be read.

Expected shape:

```ts
export interface ProjectSummary {
  name: string;
  title: string;
  type: ProjectType;
  folderPath: string;
  coverImage: ProjectCoverImage | null;
  logline?: string;
  counts: ProjectCounts | null;
  validationError: ProjectDataError | null;
}
```

### `ProjectInfo`

`ProjectInfo` is the stable identity and top-level metadata for a `Project`.

It exists so that the main `Project` object does not mix identity fields with
collections such as cast, visual language, sequences, scenes, and clips.

Expected shape:

```ts
export interface ProjectInfo {
  id: string;
  name: string;
  title: string;
  type: ProjectType;
  folderPath: string;
  databasePath: string;
  aspectRatio?: string;
  logline?: string;
  summary?: string;
}
```

### `ProjectType`

`ProjectType` identifies the shape of the project.

The first implemented type is a standalone movie. The schema may leave room for
series, but code should not pretend series behavior exists until it is actually
implemented.

Expected shape:

```ts
export type ProjectType = 'standaloneMovie' | 'series';
```

### `ProjectCoverImage`

`ProjectCoverImage` describes a project-local cover image known to core.

Core should expose the file information. Studio server may add an HTTP URL in
its own response adapter because URLs are transport concerns.

Expected shape:

```ts
export interface ProjectCoverImage {
  fileName: 'cover.png';
}
```

### `ProjectLanguage`

`ProjectLanguage` describes a language configured for the project.

Expected shape:

```ts
export interface ProjectLanguage {
  id: string;
  localeTag: string;
  displayName?: string;
  isBase: boolean;
  supportsAudio: boolean;
  supportsSubtitles: boolean;
}
```

### `VisualLanguage`

Use `VisualLanguage`, not `VisualLanguageProfile`.

The canonical product term is Visual Language. The first implementation can
store multiple visual-language entries, but the term should not be renamed to
profile unless the product later introduces a distinct profile concept.

Expected shape:

```ts
export interface VisualLanguageCategory {
  id: string;
  name: string;
  description?: string;
  source: 'system' | 'project';
}

export interface VisualLanguage {
  id: string;
  categoryId: string;
  name: string;
  summary?: string;
  priority: 'default' | 'situational' | 'rare';
  guidance?: string;
  prompt?: string;
  guidanceAsset?: RichTextAssetLink;
  promptAsset?: RichTextAssetLink;
}
```

The matching table name should be:

```text
visual_language
visual_language_category
```

Not:

```text
visual_language_profile
```

### `CastMember`

`CastMember` is one reusable production subject.

Expected shape:

```ts
export interface CastMember {
  id: string;
  name: string;
  kind?: string;
  role?: string;
  shortDescription?: string;
}
```

### `Episode`

`Episode` is a future-capable project structure concept for series.

The first standalone movie slice may return an empty `episodes` array if series
behavior is not implemented yet. Do not add fake episode behavior just because
the table exists.

Expected shape:

```ts
export interface Episode {
  id: string;
  title: string;
  shortTitle?: string;
  summary?: string;
  sequences: Sequence[];
}
```

### `Sequence`

`Sequence` is the canonical v1 narrative group above scenes.

Expected shape:

```ts
export interface Sequence {
  id: string;
  number: number;
  title: string;
  shortTitle?: string;
  summary?: string;
  scenes: Scene[];
}
```

### `Scene`

`Scene` belongs to a sequence.

Expected shape:

```ts
export interface Scene {
  id: string;
  title: string;
  summary?: string;
  clips: Clip[];
}
```

### `Clip`

`Clip` is the v1 production unit below scene.

Expected shape:

```ts
export interface Clip {
  id: string;
  title: string;
  summary?: string;
  visualIntent?: string;
}
```

### `ProjectCounts`

`ProjectCounts` contains counts used by project library cards, summaries, and
basic UI status areas.

Expected shape:

```ts
export interface ProjectCounts {
  languages: number;
  visualLanguage: number;
  castMembers: number;
  episodes: number;
  sequences: number;
  scenes: number;
  clips: number;
}
```

## Current Internal Setup Names

The create YAML should be represented internally as `ProjectSetup`.

Example YAML:

```yaml
kind: renku.projectSetup
version: 0.1.0
project:
  name: constantinople
  title: Constantinople
  type: standaloneMovie
```

Rules:

- `ProjectSetup` is internal to `studio-core/node`;
- setup types are not browser-safe exports;
- setup types are not imported by Studio server;
- setup types are not imported by Studio frontend;
- CLI passes a setup file path to core, not a parsed setup object.

Why:

```text
YAML setup file
  -> ProjectSetup               internal setup shape
  -> core create command
  -> SQLite records             durable source of truth
  -> Project                    public contract object
```

The setup file is not the project.

## Current Database Names

The project-local database should be named after the durable folder-level domain
object:

```text
.renku/project.sqlite
```

The initial tables should use canonical domain names:

```text
project
project_locale
visual_language
cast_member
episode
sequence
scene
clip
```

Avoid:

```text
movie_project
visual_language_profile
story_structure
project_detail
project_snapshot
```

Rationale:

- `project` is the folder-level durable concept;
- `visual_language` is the canonical product term;
- `sequence`, `scene`, and `clip` are the canonical narrative hierarchy;
- `story_structure` is too vague and not a persisted domain object;
- `detail` and `snapshot` describe presentation style, not durable data.

## Data Layer Naming

The data layer belongs in `@gorenku/studio-core/server`.

It should expose one organized service interface to CLI and Studio server. It
should not expose Drizzle, `better-sqlite3`, raw database handles, or row-shaped
record types.

Approved public facade name:

```ts
ProjectDataService
```

Definition:

> `ProjectDataService` is the Node-side core facade used by CLI and Studio
> server for project creation, project listing, project reading, and project
> cover resolution.

Expected public interface:

```ts
export interface ProjectDataService {
  createFromSetup(input: CreateProjectFromSetupInput): Promise<ProjectCreateReport>;
  listLibrary(): Promise<ProjectLibrary>;
  readProject(input: ReadProjectInput): Promise<Project>;
  resolveCoverImage(input: ResolveProjectCoverImageInput): Promise<string | null>;
}
```

Naming rationale:

- `ProjectDataService` names the boundary, not an implementation detail;
- `createFromSetup` is explicit that setup YAML is a creation input;
- `listLibrary` returns the project library contract;
- `readProject` returns the full public `Project` contract;
- `resolveCoverImage` returns a filesystem path, not an HTTP URL.

Internal data-layer files should be named by responsibility, not by one-off
function:

```text
project-data-service.ts
database/lifecycle/store.ts
database/access/project.ts
database/access/project-locales.ts
database/access/visual-language.ts
database/access/cast-members.ts
database/access/narrative.ts
resources/full-project.ts
resources/project-library.ts
project-paths.ts
cover-image-files.ts
entity-ids.ts
```

These names mean:

- `database/lifecycle/store.ts`: opens and closes the project-local SQLite store;
- `database/access/*`: reads or writes persisted records through Drizzle;
- `database/access/narrative.ts`: reads or writes the canonical narrative hierarchy
  tables: episode, sequence, scene, and clip;
- `resources/full-project.ts`: assembles the public `Project` contract from records;
- `resources/project-library.ts`: assembles the public `ProjectLibrary` contract;
- `project-paths.ts`: allocates and validates project folder/database paths;
- `cover-image-files.ts`: copies and resolves project-local cover images;
- `entity-ids.ts`: creates short opaque project-local IDs.

Do not create files named only after a verb, such as:

```text
create.ts
open.ts
read.ts
list.ts
```

Those names do not explain the boundary or the domain object.

## Drizzle Naming And Responsibility

Drizzle provides typed SQL access to SQLite tables. It does not replace the
Renku Studio data boundary.

The layering should be:

```text
CLI / Studio server
  -> ProjectDataService
    -> setup reader / file handling / project readers
      -> record modules
        -> Drizzle schema
          -> better-sqlite3
```

The database access modules are thin wrappers around Drizzle operations. They exist so
the command and reader code does not become a long script full of raw table
operations.

Examples:

- `database/access/project.ts` owns CRUD-style operations for the `project` table;
- `database/access/visual-language.ts` owns CRUD-style operations for the
  `visual_language` table;
- `database/access/cast-members.ts` owns CRUD-style operations for the
  `cast_member` table;
- `database/access/narrative.ts` owns CRUD-style operations for `episode`, `sequence`,
  `scene`, and `clip` because those tables form one narrative hierarchy.

Repository classes are not required unless they add clarity. A module with
well-named functions is enough for the first slice.

Avoid introducing a large class hierarchy just to wrap Drizzle.

## CLI Naming

The CLI package owns terminal behavior only.

Command files should be named after the command's domain action:

```text
initialize-config-command.ts
create-project-command.ts
```

The public command remains:

```bash
renku create --file project.yaml
renku create --file project.yaml --cover cover.png
```

The CLI should call `ProjectDataService.createFromSetup`.

The CLI should not:

- parse setup YAML into public types;
- know Drizzle table names;
- open SQLite;
- assemble `Project` or `ProjectLibrary`;
- contain project creation business rules.

## Studio Server Naming

The Studio server is an HTTP adapter.

The Studio server should use Hono for routing. Route naming should follow Hono's
resource-module convention, not controller-style files and not one file per HTTP
method.

Use plural resource module filenames:

```text
server/app.ts
server/routes/health.ts
server/routes/projects.ts
server/routes/assets.ts
server/routes/navigation.ts
server/routes/markdown-assets.ts
server/routes/production-exports.ts
server/http/project-responses.ts
server/http/project-cover-url.ts
```

These names mean:

- `server/app.ts`: creates the root Hono app and mounts resource modules;
- `server/routes/health.ts`: owns the health-check resource route;
- `server/routes/projects.ts`: owns the top-level `/studio-api/projects`
  resource routes and mounts bounded child resource modules;
- `server/routes/assets.ts`: owns asset page, selection, and file routes below
  one project;
- `server/routes/navigation.ts`: owns navigation page routes below one project;
- `server/routes/project-information.ts`: owns Project Information routes;
- `server/routes/markdown-assets.ts`: owns Markdown asset content routes;
- `server/routes/production-exports.ts`: owns production export routes;
- `server/http/project-responses.ts`: adapts core contracts to HTTP response
  shapes when HTTP-only fields are needed;
- `server/http/project-cover-url.ts`: builds Studio API cover URLs only.

Inside a Hono resource module, write handlers inline next to their route paths:

```ts
const projects = new Hono()
  .get('/', async (c) => {
    // list projects
  })
  .get('/:projectName', async (c) => {
    // read one project
  });
```

When `routes/projects.ts` mounts child modules under `/:projectName`, those
child modules should use the resource name without a noisy `project-` prefix:
`routes/assets.ts`, not `routes/project-assets.ts`; `routes/navigation.ts`, not
`routes/project-navigation.ts`. Use `Project` only when it names a domain
concept, such as `ProjectInformation`.

Avoid:

```text
project-handler.ts
project-controller.ts
project-routes.ts
route-list-projects.ts
route-read-project.ts
route-read-project-cover.ts
project-assets.ts
project-navigation.ts
```

Reasons:

- `handler` and `controller` encourage moving route logic away from Hono route
  definitions;
- `project-routes.ts` repeats what the `routes/` folder already says;
- one file per HTTP method is not the Hono convention for this server size;
- the route module should be named after the resource: `routes/projects.ts`.
- `project-assets.ts` and `project-navigation.ts` repeat the enclosing
  `/studio-api/projects/:projectName` scope instead of naming the bounded
  resource.

The Studio server may add HTTP-only fields such as `coverUrl`.

Core should expose `coverImage.fileName` and safe filesystem path resolution.
The Studio server should translate that into an HTTP URL because URLs are
transport concerns.

See `docs/architecture/reference/studio-server-hono.md` for the full server routing
architecture.

## Names To Avoid In This Slice

Avoid the following names for the first project creation and library work:

```text
MovieProject
MovieStudioProject
ProjectDetail
ProjectSnapshot
ProjectView
Workspace
Production
ProductionSeed
StoryStructureRepository
VisualLanguageProfile
```

Reasons:

- `MovieProject` and `MovieStudioProject` append broad words instead of naming
  the concept precisely;
- `ProjectDetail` only means "more than summary" and does not describe a
  boundary;
- `ProjectSnapshot` sounds like a saved/versioned snapshot;
- `ProjectView` can be confused with React/UI views;
- `Workspace` can mean UI surface, folder, database, or live editing session;
- `Production` is too abstract for the current product language;
- `ProductionSeed` is both abstract and detached from the CLI behavior;
- `StoryStructureRepository` invents a non-canonical persistence concept;
- `VisualLanguageProfile` uses a term that has not been introduced as a
  distinct product concept.

## Naming Checklist

Before adding a name, ask:

1. Is this a public contract, setup input, database record, route, command, or
   filesystem helper?
2. Does the name use an existing domain term from the architecture vocabulary?
3. If it has a suffix, does the suffix explain a real boundary?
4. Would the browser, CLI, Studio server, and core all understand the name the
   same way?
5. Does this name preserve an obsolete concept from a prior iteration?
6. Is the file named after a durable responsibility instead of a one-off
   function?
7. Is the name specific enough that a reviewer can predict what belongs in the
   file or type?

If the answer is unclear, do not write the code yet. Improve the name first.
