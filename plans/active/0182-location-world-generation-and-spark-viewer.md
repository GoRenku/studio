# 0182 Location World Generation And Spark Viewer

Status: implemented; paid World Labs and actual-SPZ desktop acceptance pending explicit approval
Date: 2026-08-17
Updated: 2026-08-18

The original fixed-azimuth input strategy in this implementation record is
corrected by `0184-location-world-reconstruction-inputs.md`. Current code and
skill behavior use two-to-eight Auto Layout reconstruction images, omit
directional azimuths, and preserve authored prompts without recaptioning.

## Review Attention

- The product addition is one **3D World** workflow for a Location: an agent
  collaborates with the user on four temporary azimuth images, submits those
  images to World Labs Marble, downloads the returned full-resolution SPZ, and
  imports it as a Location-owned `location_world` Asset. Studio only displays
  the selected World; it does not generate, regenerate, approve, or select
  Worlds.
- Location World history reuses the existing common Asset candidate and
  canonical-selection mechanism. Every successful generation remains an
  active Location-owned candidate, the newest successful candidate is selected
  atomically, and the user can roll back by selecting an older candidate. No
  World-specific version table, Take model, history table, or replacement
  workflow is added.
- The existing `selected_asset.owner_key` cannot represent both a selected
  Location Hero and a selected Location World for the same Location. This plan
  renames that column to `target_key`, moves key construction behind the
  existing Core selection owner, and adds the bounded `locationWorld`
  selection target. Existing Hero and every other current selection retain
  their exact behavior and data. This is a required extension of the common
  mechanism, not a parallel selection system.
- The selection-column rename is a breaking project-database schema change.
  Generate it through Drizzle Kit, advance the current project schema
  generation from 62 to 63, rehearse it on an isolated Urban Basilica copy,
  and migrate the live Project only through the existing verified-backup
  workflow. The migration does not move, rewrite, discard, or attach media.
- The four World Labs inputs are temporary project files at exact azimuths
  `0`, `90`, `180`, and `270`. They are not Assets, do not appear in the
  Location Assets tab, and are not retained as World provenance. The new skill
  keeps them under `tmp/media/` long enough for user review and submission.
- The agent uses the existing Media Producer workflow for the four images.
  Codex GPT Image 2 remains the default image path through the current Project
  setting; any existing Renku-managed image model remains an explicit
  alternative. This plan does not add a new image purpose, image provider,
  model setting, reference model, or image-consistency runtime validator.
- The World Labs integration is deliberately narrow: `WLT_API_KEY`, local
  image upload, one `multi-image` request using fixed model `marble-1.1`,
  operation polling, full-resolution SPZ download, and structured failures.
  It does not add World listing/deletion, mesh export, pano/depth endpoints,
  collaborative Worlds, a provider catalog entry, pricing infrastructure,
  generic long-running-operation machinery, or a World Labs Settings surface.
- World Labs returns SPZ URLs for `100k`, `500k`, and `full_res`; it does not
  return PLY, SPLAT, or KSPLAT from this generation response. The durable file
  is therefore the native `full_res` SPZ. Spark loads that file with
  `lod: true`, building its first LOD tree in a background worker. No PLY
  conversion, KSPLAT conversion, Rust `build-lod`, RAD/RADC preprocessing, or
  silent fallback to a lower-resolution SPZ is planned.
- Spark's RAD format is the better future choice only if measured loading or
  memory behavior justifies an offline conversion and chunk-serving pipeline.
  That would add a Rust build dependency, multiple durable files, and paged
  delivery behavior, so it is explicitly outside this smallest useful slice.
- A completed SPZ is downloaded from World Labs exactly once for that
  generation and persisted before the command reports success. The canonical
  durable path is `locations/<location-handle>/world-gxxx.spz`, following the
  existing shallow Location folder and generated-file naming rules. The
  `gxxx` token is only a collision discriminator; Asset identity, creation
  history, and current selection remain in SQLite.
- Studio never stores, proxies, or revisits the signed World Labs SPZ URL. Spark
  receives only the existing project Asset-file URL, which reads the saved
  local SPZ. That response keeps the existing immutable browser-cache policy,
  so revisiting the same selected Asset normally reuses the browser's cached
  bytes. After cache eviction or in another browser session, Studio may read
  the saved project file again, but it must never redownload it from World
  Labs.
- In this plan, “streaming” refers only to memory-safe byte transfer during the
  one-time provider-to-disk download and local disk-to-browser delivery. It
  never means leaving the World remote or using the World Labs URL as the
  viewer source.
- The existing generic Asset-file HTTP response currently buffers a complete
  file in server memory. Full-resolution SPZ files make that unsafe. This plan
  changes the existing response helper to stream all Asset files and include
  their content length while preserving its URL, authorization, cache policy,
  and MIME behavior. HTTP Range support is not needed for a directly loaded
  SPZ and is not added.
- The user already installed `@sparkjsdev/spark@2.1.0` in
  `packages/studio`. Preserve those working-tree changes. Implementation adds
  only Spark's direct `three` peer and TypeScript types if the package compiler
  requires them; it must not reinstall or replace the user's Spark version.
- The new Studio tab is named **3D World**, appears after **Assets**, and is a
  full-height viewer rather than a padded card or separate 3D application. It
  uses the existing line-tab shell, panel colors, typography, icons, and local
  shadcn-style controls. It has loading, ready, empty, unsupported-WebGL, and
  failure states; no mobile work is planned.
- Prompts and source images remain opaque creative artifacts. Core validates
  only the document shape, exact azimuth set, project-relative files, supported
  image extensions, owner relationship, API envelope, provider response, and
  Asset persistence. It never scores, compares, rewrites, or semantically
  interprets the four views or the prompt.
- World Labs upload URLs, signed SPZ URLs, and the API key are never logged,
  persisted, returned to Studio, or stored in Asset metadata. The completed
  command may return non-secret `operationId` and `worldId` for immediate
  diagnostics, but the downloaded Asset is the durable Studio source of truth.
  Remote World Labs Worlds are retained; automatic remote deletion is outside
  scope.
- Existing Location Details, Hero selection, Location Sheets, Assets-tab
  behavior, generation Preview/confirmation/estimate rules, and every other
  media workflow remain unchanged. No product decision remains open inside
  this plan.

## Summary

Renku can already author Location facts and designs, generate Location images,
retain media candidates as Assets, and select one current candidate for a
surface. It cannot yet turn several views of a Location into navigable 3D
media, persist that result, or display it.

The smallest architecture-correct addition is:

1. a `location-world-producer` skill in the Studio Skills repository that
   obtains four reviewed views of one Location through Media Producer;
2. a focused World Labs Marble HTTP client in `packages/engines`;
3. a Core-owned `generateLocationWorld` command that validates the request,
   invokes Marble, downloads the SPZ once into durable project storage,
   creates a Location-owned Asset, and selects it through the common Asset
   mechanism;
4. thin CLI access for the skill and existing Asset selection for rollback;
5. a read-only **3D World** tab in Location Details using Spark and Three.js.

The workflow is agent-first. The user reviews and approves the four source
images and the paid Marble submission conversationally. Studio remains the
durable inspection surface.

## Requirement Ledger

| ID | Requirement | Source | Planned result |
| --- | --- | --- | --- |
| R1 | A new skill must help the user create a 3D representation of a Location. | User | Add `location-world-producer` and route Location-world work to it. |
| R2 | The skill must obtain four views of the same Location at four azimuths. | User | Require exactly `0`, `90`, `180`, and `270` degrees in the generation document and skill review. |
| R3 | Codex GPT Image 2 is the default image path, while Renku-managed image models remain available. | User and current Project Settings | Reuse Media Producer and the existing image execution policy; add no World-specific image provider logic. |
| R4 | Source images are temporary inputs. | User clarification | Store working views under `tmp/media/`; never attach them as Assets. |
| R5 | Submit the four local images and prompt through World Labs' multi-image API. | User | Prepare and upload four media assets, submit one `multi-image` world request, and preserve the optional prompt exactly. |
| R6 | Load the World Labs API key through existing Renku configuration. | User | Resolve `WLT_API_KEY` through `loadProviderEnvFiles()`/the existing secret boundary; never expose it to Core reports or Studio. |
| R7 | Poll until completion, download the generated World once, and save it. | User and user clarification | Poll `/marble/v1/operations/{id}`, download `full_res` once from the returned signed URL, and persist it before reporting success. |
| R8 | The integration must be enough for this workflow without becoming a platform. | User | Implement only upload, generate, poll, and SPZ download; explicitly omit unrelated Marble endpoints and generic infrastructure. |
| R9 | Use the appropriate Spark-supported file format and understand LOD. | User | Persist native full-resolution SPZ and use Spark `lod: true`; document why PLY/SPLAT/KSPLAT/RAD are not used in this slice. |
| R10 | Preserve prior World generations and allow rollback while only one is current. | User clarification and current Asset architecture | Keep all `location_world` Assets active; add `locationWorld` to common selection; select a new result atomically and use `renku asset select` for rollback. |
| R11 | Add the viewer beside existing Location content. | User | Add a **3D World** line tab after **Assets** in Location Details. |
| R12 | Studio displays but does not generate Worlds. | User clarification | Extend the Location resource with the selected World and render it; add no generation controls or paid-provider state to React. |
| R13 | The viewer must follow current Studio design and frontend rules. | User and repository rules | Reuse the current detail-panel tab shell, local UI controls, resource refresh, feature/service layering, and desktop-first verification. |
| R14 | Large saved SPZ delivery must not buffer the complete file in the Studio server. | Hard operational boundary | Serve the durable local Asset through the existing streaming Asset-file response and immutable browser cache, without adding a second Location-specific route. |
| R15 | Creative image/prompt content stays agent-owned. | Decision 0041 and repository hard rule | Runtime validates only owned envelopes and never interprets image pixels, view consistency, or prompt semantics. |
| R16 | The user's installed Spark dependency must be preserved. | User clarification | Treat `@sparkjsdev/spark@2.1.0` and its lockfile edits as pre-existing user work. |
| R17 | The saved SPZ needs an exact guideline-compliant folder and name, and later views must not return to the provider URL. | User clarification and current storage contract | Save `locations/<location-handle>/world-gxxx.spz`; use only its local Asset-file URL after import, with no provider proxy/refetch path. |

## Product Behavior

### Agent workflow

`location-world-producer` performs one user intent from source views through a
selected durable World:

1. Resolve the current Project and exact Location id through Renku CLI.
2. Read the Location facts, active Location Design, current Production
   Lookbook context, and useful existing Location media. These are creative
   guidance; none becomes an automatic runtime requirement.
3. Agree with the user on the world prompt and the intended center/orientation.
   Azimuth labels mean:
   - `0`: front;
   - `90`: right;
   - `180`: back;
   - `270`: left.
4. Use Media Producer to author and review four independent `image.create`
   requests targeting the Project. Reuse exact references deliberately when
   they improve consistency. The current Project setting keeps Codex GPT Image
   2 as the default; an explicit managed-model choice follows the existing
   Preview, estimate, approval-token, and confirmation rules.
5. Keep accepted output files under one request folder below
   `tmp/media/location-world/<location-handle>/`. Do not import them.
6. Present the four labeled images together. The user may replace any view
   before Marble submission. The skill checks visual consistency in the
   agent/user loop but does not claim that passing a runtime validator proves
   consistency.
7. Write one `locationWorldGeneration` JSON document under `tmp/operations/`.
8. Immediately before the paid Marble call, show the Location, prompt, exact
   four paths, azimuth mapping, fixed model, and the fact that the remote World
   will remain in World Labs. Ask for confirmation. This is a skill-owned paid
   action confirmation because Marble is outside the existing managed-media
   price-token catalog; no fake estimate token is created.
9. Run `renku location world generate --file ... --json`, wait for completion,
   read back the selected World, and tell the user that Studio's **3D World**
   tab can display it.

The skill must not issue a second Marble request as an automatic retry after a
creative-quality failure. A new paid generation requires the user to review
any changed image or prompt and confirm again.

### World candidates, current selection, and rollback

Every successful Marble generation creates:

- one Asset with `type: "location_world"`;
- `mediaKind: "model"`;
- exclusive Location membership;
- one primary SPZ Asset File;
- `origin: "world-labs"`;
- a meaningful domain title derived from the Location, such as
  `Theodosian Walls 3D World`;
- no creative-content metadata inferred from the prompt or pixels.

The command selects the new Asset only after the full SPZ has downloaded and
the canonical durable file and Asset/File rows are ready. The signed provider
URL is discarded at that boundary. Existing `location_world` candidates remain
active and unchanged. Generation failure leaves the prior selection intact and
does not create a partial Asset.

For example, two retained Theodosian Walls candidates may be stored as:

```text
locations/theodosian-walls/world-g7k3.spz
locations/theodosian-walls/world-g2n6.spz
```

The names do not mean version 1 or version 2. SQLite Asset creation timestamps
and the exact `locationWorld` selection provide history and current identity.
The skill and Studio never construct or parse these paths.

The agent lists history with the existing Asset command:

```bash
renku asset list \
  --project <project-name> \
  --owner location:<location-id> \
  --type location_world \
  --json
```

It reads the current selected World through `renku location world show`, then
rolls back through the existing selection command:

```bash
renku asset select \
  --project <project-name> \
  --target location-world:<location-id> \
  --asset <location-world-asset-id> \
  --json
```

The common selection command rejects a discarded, unavailable, wrong-type,
or differently owned Asset before changing the current World. Clearing the
World selection uses the existing `asset clear-selection` command with the
same target. The skill does not introduce `world rollback`, `world activate`,
or `world versions` aliases.

### Studio 3D World tab

Location Details keeps the current line-tab layout and adds:

```text
Details | Assets | 3D World
```

The tab behavior is:

- **empty**: a quiet message states that this Location has no selected 3D
  World; there is no generation button;
- **loading**: the viewer frame stays in place and shows the existing loading
  icon treatment plus meaningful download/initialization text;
- **ready**: the canvas fills the available tab area, with pointer navigation,
  focused keyboard navigation, and one local shadcn `Button` to reset the
  camera;
- **unsupported**: a clear WebGL-unavailable message replaces the canvas;
- **failed**: a structured, user-readable load message and local shadcn retry
  button appear without clearing or mutating the selected Asset.

The tab is a direct child of the flush `LineTabs` content area. It does not add
an inset card, centered document column, nested panel shell, filename, Asset
id, signed provider URL, or decorative copy. A small overlaid control hint is
allowed because it explains actual viewer interaction.

The viewer dynamically imports Spark and Three.js only when the tab mounts. It
creates one Three scene, perspective camera, `WebGLRenderer` with
`antialias: false`, `SparkRenderer`, `SplatMesh({ url, lod: true })`, and
`SparkControls`. It uses Spark's platform LOD defaults rather than adding a
Studio setting or hard-coded custom splat budget.

The `url` is always the existing same-origin project Asset-file URL for the
saved SPZ. It is never a World Labs URL. A first browser load transfers the
local file and populates the existing immutable browser cache. Remounting the
same selected Asset reuses that URL/cache; changing selection uses the other
candidate's distinct immutable Asset-file URL.

A `ResizeObserver` keeps the renderer aligned with the panel, and cleanup
stops the animation loop and disposes the SplatMesh, Spark renderer, Three
renderer, controls/listeners, and observer whenever the selected World changes,
the tab unmounts, or the Location changes. Keyboard movement updates only
while the canvas is focused so the viewer does not consume unrelated Studio
shortcuts.

### File-format decision

| Format | Relevant properties | Decision |
| --- | --- | --- |
| SPZ | Native compressed World Labs output; explicit `100k`, `500k`, and `full_res` URLs; Spark detects and loads it directly; supports `lod: true`. | **Use `full_res` SPZ.** It avoids conversion and preserves the best available source detail. |
| PLY | Common interchange/training format and supported by Spark, including compressed variants, but typically larger and not returned by the Marble World response. | Do not convert to PLY. It adds size and work without improving this viewer. |
| SPLAT / KSPLAT | Spark-supported runtime formats; format detection can need filename/type hints; not returned by Marble. | Do not convert. There is no product benefit in this slice. |
| RAD / RADC | Spark's preferred prebuilt LOD and paged-streaming format; fastest startup for large files. Requires Spark's Rust `build-lod` tool, a conversion step, and possibly multiple chunk files. | Defer until real SPZ measurements justify the extra pipeline and storage contract. |

Spark documents that runtime `lod: true` builds the LOD tree in a background
worker at roughly 1–3 seconds per million input splats and supports around 30
million input splats. The UI therefore distinguishes network download from LOD
initialization and does not promise instant first display. It uses Spark's
desktop default splat budget instead of exposing tuning prematurely.

### Explicit non-goals

This plan does not add:

- generation buttons, prompts, source-image pickers, cost UI, or World history
  controls to Studio;
- a new image-generation purpose or World Labs entry in the generic media model
  catalog;
- automatic four-view generation in Core or Engines;
- creative validation of camera angles, consistency, geometry, lighting,
  captions, or image contents;
- retention of the four inputs as Assets or formal generation provenance;
- a `location_world` table, World Take table, generation Run table, selection
  table, or provider receipt schema;
- provider-side World list/get/delete management after the completed operation;
- remote SPZ proxying, signed-URL persistence, or provider redownload during
  Studio viewing;
- Marble mesh, pano, depth, collider, semantics, thumbnail, or collaborative
  endpoints;
- PLY/SPZ/SPLAT/KSPLAT conversion, RAD/RADC preprocessing, HTTP Range support,
  or progressive multi-file streaming;
- a Project Setting for Marble model, LOD detail, camera controls, or file
  format;
- mobile, touch-layout, XR, or gamepad product work;
- a generic polling/retry platform or a new provider abstraction above the
  focused World Labs client.

## Context And Current Evidence

### Accepted project constraints

- `docs/architecture/reference/project-files-and-assets.md` owns Assets,
  exclusive membership, current selections, temporary files, and durable paths.
- `docs/architecture/reference/media-generation.md` and Decisions 0040/0074
  preserve Codex as an agent-external default rather than an Engines provider.
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md` prohibits
  runtime interpretation of prompts and generated/reference media.
- `docs/architecture/reference/front-end-guidelines.md` requires feature,
  service, hook, and UI layering plus flush detail-panel tabs.
- `docs/architecture/reference/drizzle-migrations.md` requires Drizzle Kit
  generation and verified backups before populated-project migration.
- completed Plan 0174 defines durable Location media under
  `locations/<handle>/` and temporary working media under `tmp/`.
- the Studio Skills repository's `media-producer` owns image-generation
  Preview, confirmation, managed estimate/token, Codex external generation,
  and output review.
- `production-designer` owns Location facts/design and hands media work to a
  specialist rather than invoking provider code itself.

### Current implementation evidence

- `LocationPanel` currently loads one `LocationResource` and the Location Asset
  page, then renders **Details** and **Assets** through `LineTabs`.
- `LocationResource` currently includes the Location and optional first image;
  it does not expose a selected World.
- the Location Assets tab intentionally renders only `location_hero` and
  Location Sheet image types. It does not provide a generic non-image history
  surface.
- common Asset history already keeps multiple same-owner candidates and
  `selected_asset` chooses the current one. The current key is an owner key,
  which prevents independent Hero and World selection for one Location.
- the generic Asset File URL already resolves identity and path through Core,
  but `asset-file-response.ts` currently calls `fs.readFile()` and buffers the
  complete response.
- `packages/engines` already owns provider HTTP transport, environment loading,
  secret resolution, and structured provider errors. Core already depends on
  Engines for generation execution.
- `@sparkjsdev/spark@2.1.0` is present in the user's uncommitted Studio package
  and lockfile changes. Spark declares `three >= 0.180.0` as a peer; the Studio
  package does not yet declare Three directly.
- Urban Basilica currently has eight Locations, ten active Location Assets,
  two selected Location Heroes, and no Location World. This gives the migration
  rehearsal both populated Location history and existing Hero selections that
  must remain exact.

### External API and viewer evidence

- [World Labs API quickstart](https://docs.worldlabs.ai/api) documents
  `WLT-Api-Key`, local media upload, multi-image prompts with azimuths, operation
  polling, and completed World assets.
- The API explicitly defines `0` front, `90` right, `180` back, and `270` left,
  and recommends JPG/JPEG/PNG/WEBP image inputs.
- Completed Worlds expose SPZ URLs for `100k`, `500k`, and `full_res`. The
  completed operation response is enough to obtain the World and file URL; a
  second World GET is unnecessary for this workflow.
- [Spark Getting Started](https://sparkjs.dev/docs/) documents the Three.js
  integration and current 2.1.0 package.
- [Spark SplatMesh](https://sparkjs.dev/docs/splat-mesh/) documents direct SPZ
  URL loading, progress callbacks, LOD, and disposal.
- [Spark LOD Getting Started](https://sparkjs.dev/docs/lod-getting-started/)
  documents runtime `lod: true`, prebuilt RAD, paged RAD streaming, platform
  budgets, and the Rust conversion tool.
- [Spark Controls](https://sparkjs.dev/docs/controls/) and
  [SparkRenderer](https://sparkjs.dev/docs/spark-renderer/) define viewer
  controls, render-loop integration, recommended disabled WebGL antialiasing,
  default desktop LOD budgets, and cleanup responsibilities.

## Architecture Shape Gate

### Ownership

| Layer | Owner | Responsibility |
| --- | --- | --- |
| Agent workflow | `studio-skills/skills/location-world-producer/` | Creative four-view authoring/review, user approval, CLI invocation, rollback coordination. |
| Provider transport | `packages/engines/src/sdk/world-labs/` | World Labs auth, uploads, request/response parsing, polling, signed SPZ fetch, provider-safe errors. |
| Durable domain behavior | `packages/core/src/server/location-worlds/` | Input envelope validation, project file resolution, command orchestration, Asset persistence, selection, and Location World resource projection. |
| Shared selection | `packages/core/src/server/assets/` and schema access | Bounded target-key construction and validation for all canonical selections, including `locationWorld`. |
| Project file paths | `packages/core/src/server/project-asset-files/` | Download-stage under `tmp/media/`, then allocate `locations/<handle>/world-gxxx.spz`, hash/copy the file, and register the durable Asset File. |
| CLI adapter | `packages/cli/src/commands/location-world-command.ts` plus thin Location dispatch | Parse the document/file flag, call Core, serialize reports, and forward resource refresh. |
| HTTP adapter | existing Location resource and Asset-file routes | Serialize the Core resource and serve only the saved local Asset File; no provider proxy or business rules. |
| Browser feature | `packages/studio/src/features/movie-studio/locations/` | Compose the tab, project the selected World, and own Spark canvas lifecycle. |

### Intended module shape

```text
packages/engines/src/sdk/world-labs/
  contracts.ts                    # minimal Marble request/response envelopes
  client.ts                       # authenticated JSON and signed-upload HTTP calls
  location-world-generation.ts   # upload -> submit -> poll -> SPZ response stream
  index.ts                        # bounded public exports only

packages/core/src/client/
  location-worlds.ts              # public generation document/report/resource DTOs

packages/core/src/server/location-worlds/
  input.ts                         # structural validation and project-file resolution
  generation.ts                    # thin domain orchestration over Engines and persistence
  assets.ts                        # create/list/read selected Location World Assets
  index.ts                         # bounded Core entrypoint only

packages/core/src/server/project-asset-files/destinations/
  location.ts                      # add focused location.world destination and world stem

packages/cli/src/commands/
  location-world-command.ts        # generate/show nested command adapter
  location-command.ts              # thin dispatch to the focused handler

packages/studio/src/features/movie-studio/locations/
  location-world-tab.tsx           # empty/loading/error/ready presentation
  spark-location-world-viewer.tsx  # dynamic imports and viewer lifecycle

studio-skills/skills/location-world-producer/
  SKILL.md
  agents/openai.yaml
  references/workflow.md
  samples/location-world-generation.json
```

Existing package and bounded-module `index.ts` files may export the new public
contracts/functions. They may not contain API calls, validation branches,
polling, persistence, CLI parsing, or viewer setup.

### Public entrypoints

- Engines exports `generateWorldLabsLocationWorld` and its minimal input/output
  types from the existing package entrypoint through `sdk/world-labs/index.ts`.
- Core's `ProjectDataService` exposes `generateLocationWorld` and
  `readLocationWorldResource`.
- Core's common `selectAsset`/`clearAssetSelection` remain the only selection
  mutations and accept the new `locationWorld` target.
- CLI exposes `renku location world generate` and
  `renku location world show`; rollback stays on `renku asset select`.
- Studio reuses the existing Location resource route and generic Asset File
  route. No Location-World generation route is added.

### Bounded dispatch

- Add one `locationWorld` branch to the existing bounded Asset-selection
  target/type map and target-key builder.
- Add one `location.world` branch to the existing focused Location destination
  resolver and its typed destination registry.
- Add one nested `world` dispatch in `location-command.ts` that immediately
  delegates to `location-world-command.ts`.
- Do not add World Labs to the generic media-purpose registry: the requested
  workflow is a focused 3D World operation, not a new image/video/audio model.

### Files expected to remain thin or change narrowly

- `packages/engines/src/index.ts`, `sdk/index.ts`, Core client/server
  entrypoints, and ProjectDataService composition gain exports/delegation only.
- `location-command.ts` gains only focused dispatch; it must not accumulate the
  generation document parser or provider flow.
- `location-panel.tsx` remains the resource/tab container and does not own
  Three/Spark setup.
- `packages/studio/server/routes/assets.ts` keeps its existing route shape and
  delegates streaming to `asset-file-response.ts`.
- the existing Assets tab remains image-specific and unchanged.

### Forbidden shapes and stop conditions

Stop and revise before implementation continues if any of these occurs:

- React, the Studio route, CLI, or the skill decides whether an Asset is a
  valid current Location World;
- World files are represented by tags, filenames, newest-created ordering, or
  a second selection table instead of common selection;
- the World Labs client expands into model discovery, World management, generic
  operations, provider pricing, or unrelated Marble endpoints;
- the Core generation function handles document parsing, provider HTTP,
  polling, file streaming, Asset SQL, and report formatting in one body;
- signed URLs, API keys, or prompt/image semantics enter durable Asset metadata
  or logs;
- a World Labs URL is stored as the Asset File, returned to Studio, or fetched
  again after the durable file has been accepted;
- Spark lifecycle code grows inside `location-panel.tsx` or a shared domain-
  neutral UI primitive;
- a second file-serving route is introduced solely for SPZ rather than fixing
  the existing generic response owner;
- a conversion pipeline, RAD chunks, Range handling, mobile controls, or LOD
  Settings enter the slice without separate user approval;
- an architecture test freezes private helper names or inventories every
  selection target/destination as source text;
- any `index.ts` becomes the implementation owner rather than a thin public
  entrypoint.

## Contracts

### Common Asset selection

Keep `selected_asset` as the one common selection table and change its schema
from:

```text
owner_key primary key
```

to:

```text
target_key primary key
```

The existing rows and timestamps remain exact. Existing target values remain
valid for their current surfaces. Runtime code constructs all keys through
`assetSelectionTargetKey(target)` rather than treating a selection key as an
Asset owner key.

Add this public target without renaming unrelated current targets:

```ts
type AssetSelectionTarget =
  | ExistingAssetSelectionTargets
  | { kind: 'locationWorld'; id: string };
```

`selectionTargetOwner({ kind: 'locationWorld', id })` returns
`{ kind: 'location', id }`. Its only accepted Asset type is
`location_world`. The new CLI spelling is `location-world:<location-id>`.

`AssetPage.selectedAssetId` retains its current owner-surface behavior for
existing pages so Location Hero UI does not change. Location World selection
is projected through `LocationWorldResource`, not squeezed into that singular
Hero-oriented field.

### Location World generation document

The exact agent-authored document is:

```ts
interface LocationWorldGenerationDocument {
  kind: 'locationWorldGeneration';
  version: 1;
  locationId: string;
  prompt?: string;
  images: Array<{
    azimuth: 0 | 90 | 180 | 270;
    projectRelativePath: ProjectRelativePath;
  }>;
}
```

Validation collects all actionable issues before any provider call:

- exact `kind` and `version`;
- existing Location id;
- exactly four images;
- every required azimuth exactly once;
- normalized, project-contained paths;
- existing regular files;
- extension in `jpg`, `jpeg`, `png`, or `webp`;
- optional prompt is a string and, when present, is not empty.

Validation never opens pixels for semantic checks, identifies camera direction
from content, rewrites prompt whitespace, or compares images.

The command fixes these provider values in code:

```text
model = marble-1.1
world_prompt.type = multi-image
reconstruct_images = false
recaption = provider default
output = assets.splats.spz_urls.full_res
```

There is no `model`, `format`, `resolution`, `reconstructImages`,
`disableRecaption`, `pollInterval`, or LOD setting in the document.

### Core reports and resources

```ts
interface LocationWorldGenerationReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: ProjectCommandContext;
  location: Location;
  asset: Asset;
  selectedAssetId: string;
  provider: {
    name: 'world-labs';
    model: 'marble-1.1';
    operationId: string;
    worldId: string;
  };
  resourceKeys: string[];
}

interface LocationWorldResource {
  location: Location;
  selectedWorld: Asset | null;
}
```

The report excludes API keys, upload ids, upload URLs, signed SPZ URLs, provider
caption, prompt echo, and source image bytes/paths. `selectedWorld` is either
the exact active, ready, Location-owned `location_world` selection or `null`;
Core never falls back to newest or first.

### Engines World Labs client

`generateWorldLabsLocationWorld(input)` accepts only:

- display name;
- fixed-model-compatible prompt;
- four `{ azimuth, fileName, extension, mimeType, bytes }` inputs;
- optional `SecretResolver`, `ProviderLogger`, `AbortSignal`, `fetch`, and
  injectable poll wait for tests.

It returns:

- non-secret `operationId` and `worldId`;
- an SPZ download response body as a stream;
- content length when supplied by the download response;
- fixed media metadata needed by Core.

The client owns this exact network sequence:

1. load `WLT_API_KEY` and send it only as `WLT-Api-Key` to
   `https://api.worldlabs.ai`;
2. for each image, call `POST /marble/v1/media-assets:prepare_upload`;
3. `PUT` the exact bytes to the returned signed URL with exactly the returned
   required headers;
4. call `POST /marble/v1/worlds:generate` with four media-asset ids and their
   azimuths;
5. poll `GET /marble/v1/operations/{operationId}` at one small fixed interval
   until `done` is true or the provider returns a terminal error;
6. require a completed World id and `assets.splats.spz_urls.full_res`;
7. fetch that signed URL without the World Labs API key and return its stream.

The implementation hand-writes only the response fields this flow consumes;
it does not generate or vendor the complete OpenAPI client. Non-2xx responses,
malformed required fields, terminal operation errors, missing full-resolution
SPZ, aborted polling, and failed downloads become structured provider errors.
There is no silent lower-resolution fallback and no broad retry framework.

### Storage

Add `location.world` to the typed project Asset-file destination contract:

```ts
{ kind: 'location.world'; locationId: string }
```

Core streams the provider response first to a temporary file under
`tmp/media/`, verifies that it is non-empty, then closes the provider response
and uses the existing Asset-file persistence owner to allocate the only
durable copy:

```text
locations/<location-handle>/world-gxxx.spz
```

The Asset File uses role `primary`, media kind `model`, MIME
`application/octet-stream`, size, and the existing content hash. Paths and
filenames do not encode provider ids or generation order. The staging file is
not an Asset and is removed through the existing successful-persistence cleanup
path. After this boundary, every reader resolves the durable Asset File from
Core; no runtime contract retains the signed provider URL.

This extends the accepted destination matrix with exactly one row:

| Media | Durable folder | Generated filename stem |
| --- | --- | --- |
| Location 3D World | `locations/<handle>/` | `world-gxxx` |

No `worlds/`, `3d/`, provider-named, generation-number, or Asset-id subfolder is
introduced. That matches the current rule that Location Hero and Sheet media
live directly under the Location handle and that generated candidates use a
short Core-owned role stem plus the collision token.

### CLI

Add:

```bash
renku location world generate --file <document.json> --json
renku location world show --location <location-id> --json
```

The handler reads JSON with the existing command I/O boundary, calls Core,
prints one final JSON report, and forwards the returned Location resource keys
after a successful mutation. Provider polling/progress may write concise
non-secret status to stderr in human mode; JSON stdout remains parseable and
contains only the final report.

Extend only `parseSelectionTarget` and help text for:

```text
location-world:<location-id>
```

No new rollback or history command is introduced.

### Studio HTTP and browser contracts

- Extend the existing Location resource response with `selectedWorld`.
- Reuse `projectAssetFileUrl(projectName, assetId, assetFileId)` for SPZ.
- Change `readProjectAssetFileByIdResponse` to return a Node/Web stream and
  `Content-Length`; keep current `Cache-Control` and MIME resolution.
- Resolve that response only from the durable project-relative Asset File.
  Never proxy the World Labs URL or fall back to it when the local file is
  missing; missing local state fails through the existing structured path.
- Add no mutation endpoint for World generation or selection.
- Keep server handlers thin and translate Core structured errors through the
  existing response owner.

### Skill contract

Create `location-world-producer` rather than expanding Media Producer into a
3D provider coordinator. The new skill delegates the four image requests to
Media Producer, then owns only the World-specific review, confirmation, CLI
document, Marble invocation, history readback, and rollback instructions.

Update:

- `production-designer` to hand 3D Location requests to
  `location-world-producer` after Location facts/design are ready;
- `movie-director` specialist routing and current capability lists;
- the plugin README included-skill inventory;
- `location-world-producer/agents/openai.yaml` for discovery metadata.

The plugin manifest already discovers `skills/`; do not add a one-off manifest
entry or wrapper skill.

### Structured diagnostics

Use current `@gorenku/studio-diagnostics` and Engines provider errors. Add
stable Core codes in the Location World owner:

| Code | Meaning |
| --- | --- |
| `LOCATION_WORLD_INPUT_INVALID` | Document kind/version, image count, azimuth set, extension, or prompt envelope is invalid. |
| `LOCATION_WORLD_SOURCE_INVALID` | A source path escapes the Project, is missing, or is not a regular supported image file. |
| `LOCATION_WORLD_GENERATION_FAILED` | World Labs upload, submission, polling, terminal operation, or download failed after safe provider error translation. |
| `LOCATION_WORLD_OUTPUT_MISSING` | The completed World lacks a World id or full-resolution SPZ URL/body. |
| `LOCATION_WORLD_PERSISTENCE_FAILED` | A complete provider output could not become a ready Location-owned Asset without changing selection. |

Existing `CORE_ASSET_SELECTION_INVALID` and unsupported-selection diagnostics
cover rollback errors. CLI adds only focused parse/document codes and forwards
Core issues rather than reproducing the validation matrix.

## Implementation Slices

### Slice 1 — Extend common canonical selection safely

Expected files:

- `packages/core/src/client/assets.ts`;
- `packages/core/src/server/assets/selection.ts`;
- a focused selection-target key module under `server/assets/`;
- `packages/core/src/server/database/access/selected-assets.ts`;
- `packages/core/src/server/schema/assets.ts`;
- generated Drizzle migration 0078, snapshot, and journal;
- direct callers/tests that currently use selection owner keys;
- CLI selection-target parsing/tests.

Work:

- rename schema/access vocabulary from owner key to target key;
- generate the migration with Drizzle Kit and advance generation to 63;
- preserve all existing selected rows and timestamps;
- add `locationWorld`, its Location ownership mapping, accepted Asset type, and
  CLI spelling;
- update existing Core reads to construct selection target keys explicitly;
- prove Hero and World selections coexist for one Location.

Do not rename unrelated public target spellings or create a generalized
caller-supplied selection slot.

### Slice 2 — Add the minimal World Labs client in Engines

Expected files:

- `packages/engines/src/sdk/world-labs/{contracts,client,location-world-generation,index}.ts`;
- focused tests beside the client/orchestrator;
- thin SDK/package exports.

Work:

- resolve `WLT_API_KEY` through the existing environment/secret pattern;
- implement four prepare/upload operations, one multi-image submission,
  operation polling, required response parsing, and streamed full-res download;
- inject fetch/wait/clock-sensitive behavior only where tests need control;
- redact sensitive headers and signed URLs from logs/errors;
- reject malformed or incomplete success responses without fallback.

Do not register Marble in the generic image/video provider catalog.

### Slice 3 — Add Core Location World generation and persistence

Expected files:

- `packages/core/src/client/location-worlds.ts`;
- `packages/core/src/server/location-worlds/{input,generation,assets,index}.ts`;
- ProjectDataService contracts/composition;
- Location resource projection;
- Location destination contracts/resolver/registry;
- focused Core tests.

Work:

- define and validate the exact document;
- resolve the Location and four safe project-relative files before any network
  call;
- read source bytes without interpreting pixels;
- call Engines and stream the SPZ into a Core temporary destination;
- persist one ready `location_world` Asset/File at the exact canonical path
  `locations/<handle>/world-gxxx.spz` and discard the signed provider URL;
- select it in the same successful domain operation while keeping old
  candidates active;
- expose the exact selected World on the Location resource;
- return structured report/resource keys and leave prior selection unchanged
  on every failure before commit.

### Slice 4 — Add thin CLI access and skill rollback support

Expected files:

- `packages/cli/src/commands/location-world-command.ts`;
- narrow dispatch/help/flag changes in `location-command.ts` and `cli.ts`;
- `asset-command.ts` target parsing/help;
- focused CLI tests.

Work:

- implement `location world generate/show` as thin Core adapters;
- preserve final JSON stdout during long polling;
- forward resource refresh after successful generation or Asset selection;
- teach existing Asset selection the exact `location-world:` target;
- prove list/show/select supports an agent-led rollback without a new command.

### Slice 5 — Add the Location World Producer skill

Expected files in `/Users/keremk/Projects/aitinkerbox/studio-skills`:

- `skills/location-world-producer/SKILL.md`;
- `skills/location-world-producer/agents/openai.yaml`;
- `skills/location-world-producer/references/workflow.md`;
- `skills/location-world-producer/samples/location-world-generation.json`;
- focused routing edits in `production-designer` and `movie-director`;
- README and skill validation/eval fixtures.

Work:

- reuse Media Producer for every source-image request and its existing Project
  Settings/approval behavior;
- define azimuth authoring, labeled review, replacement, temporary-path, and
  paid Marble confirmation steps;
- author the exact CLI document without duplicating provider schema details;
- read back the selected Asset and explain Studio viewing;
- document list/show/common-select rollback;
- keep visual consistency checks and prompt guidance entirely agent-owned.

### Slice 6 — Stream Asset files and build the Spark tab

Expected files:

- `packages/studio/server/http/asset-file-response.ts` and focused tests;
- Location HTTP/browser response contracts as required by selectedWorld;
- `location-panel.tsx` and its tests;
- new `location-world-tab.tsx`;
- new `spark-location-world-viewer.tsx` and lifecycle tests;
- `packages/studio/package.json`/lockfile only for the direct Three peer/types
  needed beside the user's installed Spark package.

Work:

- stream generic Asset files and preserve URL/cache/MIME behavior;
- prove the response is backed by the saved project file and has no remote URL
  proxy/fallback;
- project the selected SPZ URL from the existing Location resource;
- add **3D World** after **Assets**;
- dynamically load Spark/Three, create the full-height viewer, use
  `lod: true`, surface progress, and clean up every GPU/browser resource;
- keep keyboard behavior focus-scoped and controls accessible;
- render empty/unsupported/failure states with intentional copy and local UI
  primitives;
- refresh the selected World through the existing Location resource-key path.

### Slice 7 — Update accepted documentation and exercise the real Project

Expected docs:

- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/reference/domain-vocabulary.md`;
- `docs/architecture/reference/front-end-guidelines.md` only if the reusable
  3D-viewer pattern is accepted as durable guidance;
- `docs/architecture/reference/media-generation.md` for the boundary between
  temporary image generation and focused World generation;
- a new ADR, `docs/decisions/0082-use-location-owned-spz-world-assets.md`,
  recording native SPZ, common selection, and agent-first generation;
- current CLI help/docs and the Studio Skills docs named above.

Work:

- document `Location World`, `location_world`, `locationWorld` selection,
  canonical path, and agent-first ownership;
- record why native SPZ/runtime LOD is accepted and RAD is deferred;
- rehearse migration on an isolated Urban Basilica copy;
- after focused/root checks pass, migrate live Urban Basilica through
  `renku project migrate urban-basilica`, verify backup metadata and selection
  preservation, and do not call World Labs during migration verification;
- run one explicitly approved real World generation only when the user has
  supplied `WLT_API_KEY` and approves provider credit use.

## Tests And Guardrails

### Engines ownership tests

- missing `WLT_API_KEY` fails before upload;
- each supported extension maps to the correct prepare-upload envelope and MIME;
- all four uploads use returned required headers and never send the API key to
  signed upload/download URLs;
- the generation body contains fixed `marble-1.1`, multi-image type, exact
  azimuth/media-asset pairs, and exact optional prompt;
- polling continues through nonterminal responses and stops on terminal success;
- terminal provider errors, non-2xx responses, malformed JSON, missing ids,
  missing `full_res`, empty body, and aborts become structured provider errors;
- the completed SPZ body stays a stream rather than a full in-memory buffer;
- logs and error metadata contain no API key or signed URLs.

### Core owning-layer tests

- the exact four-azimuth document succeeds with safe JPG/PNG/WEBP project
  files;
- duplicate, missing, extra, or invalid azimuths are collected as input issues;
- unsupported extensions, absolute paths, traversal, missing files, directory
  paths, missing Location, blank prompt, and malformed version fail before the
  Engines client is called;
- no test interprets image contents or prompt semantics;
- successful generation creates one ready Location-owned `location_world`
  Asset with one primary model/SPZ file at `locations/<handle>/world-gxxx.spz`;
- after successful persistence, making World Labs unavailable does not affect
  Core reads or Studio viewing of the saved Asset;
- two candidates receive distinct collision-safe `world-gxxx.spz` paths with
  no version/generation directory or suffix;
- a second success keeps both candidates active and selects only the second;
- selecting the first again restores it as current without modifying files or
  creating a new row;
- a selected Location Hero and selected Location World coexist independently;
- wrong owner/type, discarded, or unavailable World selection fails at common
  Core selection;
- provider, stream, empty-output, hash/copy, or persistence failure creates no
  partial Asset and leaves the prior World selected;
- Location resource returns only the exact selected World and never newest/
  first fallback;
- the report excludes prompt, local source paths, API secrets, and signed URLs.

### Migration tests

- generated migration 0078 preserves populated selected rows, timestamps,
  foreign keys, and current Asset relationships while renaming to `target_key`;
- new schema permits independent `location:<id>` Hero and
  `locationWorld:<id>` World target keys;
- `PRAGMA foreign_key_check` and `quick_check` pass;
- migration advances the expected schema generation to 63;
- an isolated Urban Basilica copy preserves its current 29 selection rows,
  including both Location Heroes, before any new World fixture is added;
- one temporary fixture World selection added to the isolated copy does not
  change the existing Hero selection.

### CLI and server adapter tests

- CLI parses the exact generation document and delegates once to Core;
- CLI rejects missing `--file`/`--location` and invalid
  `location-world:<id>` spelling with structured CLI issues;
- JSON stdout remains one parseable final report while status uses stderr;
- `location world show` and common Asset list/select expose enough state for
  rollback;
- Studio Location route serializes selectedWorld without provider secrets;
- generic Asset file response streams bytes, provides content length, keeps
  immutable cache headers, and still serves existing image/audio/video tests;
- the Asset file response reads the durable project file and never redirects,
  proxies, or falls back to a signed World Labs URL;
- no generation or selection business rule appears in the server route.

### Studio UI and lifecycle tests

- Location tab order is Details, Assets, 3D World;
- no selected World renders the intentional empty state and no generation
  control;
- a selected World supplies the generic Asset-file URL to the viewer;
- loading, unsupported WebGL, failed load, retry, ready, and reset-camera states
  are visible and accessible;
- Spark/Three are dynamically loaded only after viewer mount;
- resize updates renderer/camera without recreating the viewer;
- selection/Location changes and unmount stop animation and dispose all viewer
  resources/listeners;
- keyboard movement is inactive while the canvas is unfocused;
- resource refresh replaces the viewed Asset after generation or rollback;
- feature code uses local shadcn `Button` for retry/reset and adds no raw form
  controls;
- tests target behavior and import boundaries, not private function names.

### Skill tests/evals

- default Codex and explicit Renku-managed image paths both preserve Media
  Producer approval contracts;
- the skill creates exactly four labeled temporary views and never imports them;
- changing one weak view regenerates only that image request before submission;
- combined review occurs before paid Marble confirmation;
- the generated JSON matches the sample and exact azimuth mapping;
- the skill does not call Marble without explicit confirmation;
- successful generation reads back the exact selected Asset;
- rollback lists Location World Assets, reads the current selection, and uses
  common Asset selection rather than editing SQLite or guessing newest;
- prompts/pixels are inspected only by the agent/user loop and never promoted
  into runtime validation claims.

### Stable architecture guardrails

- retain existing package import-boundary tests: Studio browser features cannot
  import Core server or Engines modules, and Studio routes cannot import
  provider clients;
- add a stable capability guard only if needed to prevent the World Labs API
  client from entering CLI/Studio packages; do not freeze helper names;
- keep route tests proving selection/generation delegates to Core rather than
  listing every allowed Core command;
- inspect module complexity rather than adding a source-text inventory of every
  World Labs endpoint or selection type.

## Documentation

Update current accepted documentation to cover:

- Location World domain vocabulary, Asset type/media kind, owner, selection,
  current/history behavior, and path;
- the renamed `selected_asset.target_key` contract and why one owner can have
  more than one deliberately bounded canonical surface;
- the focused World Labs client and `WLT_API_KEY` configuration;
- the exact agent/CLI workflow and rollback command;
- temporary four-view inputs and lack of durable source provenance;
- SPZ format choice, runtime LOD behavior, and explicit RAD deferral;
- Studio's display-only 3D World tab and desktop verification expectations;
- the new `location-world-producer` skill and routing from Production Designer
  and Movie Director.

Do not rewrite historical plans. Add ADR 0082 for the new accepted direction
and link it from the current reference docs.

## Final Verification

### Focused automated checks

```bash
pnpm --dir packages/engines test
pnpm --dir packages/core test
pnpm test:cli
pnpm --filter @gorenku/studio test
pnpm --filter @gorenku/studio test:typecheck
```

Run the Studio Skills repository's current validation, release, and focused
skill eval commands documented there. Do not install or upgrade packages beyond
the dependencies accepted in this plan.

### Root checks

```bash
pnpm check
pnpm test
pnpm build
```

### Migration verification

1. generate migration 0078 with Drizzle Kit from the TypeScript schema;
2. apply it to a disposable Urban Basilica copy through the normal migration
   command;
3. compare Asset, Asset File, membership, selection, and non-database file
   counts/hashes before and after;
4. verify all 29 current selections and timestamps remain exact;
5. add isolated Hero/World coexistence proof and run SQLite integrity checks;
6. only after focused and root checks pass, migrate live Urban Basilica through
   the verified-backup workflow and inspect its backup sidecar;
7. do not make a paid World Labs call as part of migration proof.

### Desktop visual verification

Use the current Studio desktop viewport and an actual Urban Basilica Location.
Verify:

- tab alignment stays flush with the Location detail panel;
- the canvas fills the usable panel without nested-card styling, clipping, or
  accidental page scrollbars;
- loading and LOD initialization do not cause layout jumps;
- pointer, focused keyboard, reset, retry, and Location switching work;
- the selected full-resolution SPZ reaches a ready frame and remains usable at
  the normal desktop size;
- disabling World Labs/network access after the initial generation does not
  prevent the saved World from loading through Studio's local Asset URL;
- revisiting the same selected Asset uses its unchanged immutable URL and
  browser cache rather than a provider download;
- no filenames, ids, provider URLs, or invented labels appear;
- Details, Assets, Hero display, Sheets, and surrounding Studio shortcuts do
  not regress;
- leaving/re-entering the tab and switching Worlds does not leak animation
  loops, workers, event handlers, or GPU resources.

Measure first-view download size, time to first frame, background LOD-build
time, server memory, browser memory, and interaction smoothness. Record the
results. Poor measurements may justify a separate RAD/paged-streaming proposal;
they do not authorize adding that pipeline inside this plan.

### One approved end-to-end World

After `WLT_API_KEY` is configured and the user explicitly approves credits:

1. use `location-world-producer` on one Urban Basilica Location;
2. create/review four temporary azimuth images through the selected existing
   image path;
3. submit once to Marble and wait for completion;
4. verify one durable `location_world` Asset and full-res SPZ path;
5. verify the previous Hero remains selected independently;
6. display the World in Studio;
7. generate or import a second approved candidate only if separately desired,
   then prove rollback through common selection;
8. verify no source image became an Asset and no secret/signed URL entered logs
   or SQLite.

### Architecture and diff review

- inspect `git diff --stat` and the complete diff in both Studio repositories;
- preserve the user's pre-existing Spark/package-lock changes distinctly;
- inspect every new or heavily modified file for mixed responsibilities;
- confirm Engines owns HTTP, Core owns durable rules, CLI/server stay thin, and
  React only consumes the selected projection;
- confirm `index.ts` files are exports only;
- confirm no generic operations/provider platform, parallel selection model,
  semantic artifact validator, conversion pipeline, or generation UI slipped
  into the work;
- run `git diff --check` in both repositories.

## Completion Checklist

### Review Area

- [ ] Confirm every implemented concept maps to R1–R17 and no unrelated Marble, viewer, Settings, or media feature was added.
- [ ] Confirm the implementation preserves Engines/Core/CLI/server/React/skill ownership boundaries.
- [ ] Confirm centralized ownership did not become a monolithic World generation function.
- [ ] Confirm the final module/file shape matches the Architecture Shape Gate.
- [ ] Confirm no broad dispatcher, catch-all helper, provider platform, or god file was added.
- [ ] Confirm existing Location Details, Assets, Hero, Sheets, and image-generation behavior remains unchanged.

### Architecture And Contracts

- [ ] Add the exact `LocationWorldGenerationDocument`, report, and resource contracts.
- [ ] Add `location_world` as a Location-owned model Asset with one primary SPZ file.
- [ ] Rename `selected_asset.owner_key` to `target_key` through Drizzle Kit and advance schema generation to 63.
- [ ] Preserve every existing selection row/timestamp and add only the bounded `locationWorld` target.
- [ ] Keep `selectAsset`/`clearAssetSelection` as the only current-World mutation boundary.
- [ ] Keep `AssetPage.selectedAssetId` behavior unchanged for existing surfaces and project World selection through `LocationWorldResource`.
- [ ] Add `location.world` to the existing focused Location destination and allocate exactly `locations/<handle>/world-gxxx.spz`.
- [ ] Add named structured diagnostics at Engines/Core/CLI boundaries without compatibility branches.
- [ ] Keep prompts and images opaque in runtime code.
- [ ] Exclude secrets, source paths, prompts, upload ids, and signed URLs from durable/report/browser contracts.

### Engines And Provider Flow

- [ ] Implement only World Labs key resolution, image prepare/upload, multi-image submit, operation polling, and one-time full-res SPZ download.
- [ ] Fix the request to `marble-1.1`, exact four azimuths, provider recaption default, and full-res SPZ.
- [ ] Use returned upload headers exactly and never send `WLT_API_KEY` to signed storage URLs.
- [ ] Fail clearly on provider/malformed/missing-output states without lower-resolution fallback.
- [ ] Keep the SPZ response streamed and avoid a generic retry/operations framework.
- [ ] Keep World listing/deletion, meshes, panos, depth, semantics, thumbnails, and collaboration outside scope.

### Core And Storage

- [ ] Validate the complete input envelope and all four safe source files before provider submission.
- [ ] Create no Asset and change no selection when upload, polling, download, or persistence fails.
- [ ] Stream the completed SPZ through a Core temporary file into canonical Asset storage.
- [ ] Remove successful staging state and discard the signed provider URL after the durable Asset File is ready.
- [ ] Ensure every later Core/Studio read uses only the saved project file and never refetches World Labs.
- [ ] Persist size/hash/MIME/media-kind metadata and meaningful Location World title.
- [ ] Select the new candidate atomically while retaining every prior candidate for rollback.
- [ ] Return only the exact selected World from Location resources, with no newest/first fallback.
- [ ] Preserve independent Location Hero and Location World selections.

### CLI And Skill Surfaces

- [ ] Implement thin `renku location world generate/show` commands.
- [ ] Add exact `location-world:<id>` parsing to existing common Asset selection.
- [ ] Keep JSON stdout parseable and provider status non-secret.
- [ ] Create `location-world-producer` with discovery metadata, workflow reference, and exact sample document.
- [ ] Reuse Media Producer for Codex-default and managed-model source-image generation.
- [ ] Keep all four views under `tmp/media/` and never attach them.
- [ ] Require labeled four-view review and explicit paid Marble confirmation.
- [ ] Document and test rollback through Asset list/show/select without a new history command.
- [ ] Update Production Designer, Movie Director, and README routing.

### Studio UI And Delivery

- [ ] Preserve the user's installed `@sparkjsdev/spark@2.1.0` changes.
- [ ] Declare the direct Three peer/types required to compile the viewer without changing Spark version.
- [ ] Stream the existing generic Asset-file HTTP response with content length and unchanged cache/MIME behavior.
- [ ] Keep the immutable local Asset URL/cache contract and add no provider redirect, proxy, or fallback.
- [ ] Add the 3D World tab after Assets using the existing flush LineTabs shell.
- [ ] Add intentional empty, loading, ready, unsupported-WebGL, and failure/retry states.
- [ ] Dynamically load Spark/Three only for the mounted viewer.
- [ ] Use full-res SPZ with `lod: true` and Spark's platform defaults.
- [ ] Scope keyboard movement to canvas focus and use local shadcn controls for retry/reset.
- [ ] Dispose animation, workers, observers, controls, Three, Spark, and SplatMesh resources on every teardown path.
- [ ] Add no generation, prompt, source picker, history selector, cost, or Settings UI.
- [ ] Perform desktop-only visual verification; do not add mobile work.

### Tests And Guardrails

- [ ] Cover the complete World Labs request/poll/download/error boundary in Engines.
- [ ] Cover the complete document, persistence, selection, rollback, and failure-atomicity matrix in Core.
- [ ] Cover migration preservation and Hero/World coexistence on an isolated populated database.
- [ ] Cover thin CLI parsing/delegation/serialization and Studio route streaming.
- [ ] Cover Location tab states, resource refresh, focus behavior, and complete viewer cleanup.
- [ ] Cover skill image-path variants, review, confirmation, success, and rollback.
- [ ] Keep adapter/UI tests focused on their own behavior rather than duplicating Core's invalid matrix.
- [ ] Keep architecture guardrails based on imports, public contracts, and runtime boundaries rather than implementation names.

### Documentation

- [ ] Add ADR 0082 for Location-owned native SPZ Assets, common selection, and agent-first generation.
- [ ] Update current Asset, domain vocabulary, media generation, CLI, Studio UI, and World Labs configuration docs.
- [ ] Document the SPZ/PLY/SPLAT/KSPLAT/RAD decision and runtime LOD tradeoff.
- [ ] Update current Studio Skills docs and samples.
- [ ] Do not edit historical plans merely to mention Location Worlds.

### Final Verification

- [ ] Run focused Engines, Core, CLI, Studio, and Studio Skills checks.
- [ ] Run `pnpm check`, `pnpm test`, and `pnpm build` at the Studio root.
- [ ] Rehearse migration 0078 on an isolated Urban Basilica copy and verify all populated data/integrity evidence.
- [ ] Migrate live Urban Basilica only after checks pass and verify the automatic backup/sidecar.
- [ ] Run one real paid World only after API-key readiness and explicit user approval.
- [ ] Measure SPZ download, first frame, LOD build, server/browser memory, and desktop interaction.
- [ ] Verify an existing Hero and selected World coexist, prior World rollback works, and inputs remain temporary.
- [ ] Verify exact `locations/<handle>/world-gxxx.spz` naming and offline/local reload after the one-time provider download.
- [ ] Review `git diff --stat`, complete diffs, and every large/heavily modified file in both repositories.
- [ ] Confirm `index.ts` files remain thin and no checklist item was satisfied by accepting unreviewable code structure.
- [ ] Run `git diff --check` in both repositories.
- [ ] Only then mark this plan complete.
