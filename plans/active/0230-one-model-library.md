# 0230 One Model Library

Status: proposed
Date: 2026-10-13

## Summary

Studio Settings and the Route Chooser need the list of models a user can
pick. Renku must contain no models; every model comes from studio-skills
(bundled) or from the user (personal). Plan 0229 delivered the bundled list by
asking the agent to copy it (`renku generation default-models sync`), so
Settings stayed empty until an agent ran, and personal models could not be
picked at all because the personal library stores bare routes with no model or
lane.

This plan keeps all models in one **Model Library** folder,
`~/.config/renku/model-library/`, holding two files in one format:

- `bundled-models.json`, written only by Renku setup from the studio-skills
  download it already makes (install, `renku update`, `renku update skills`,
  the Studio update button);
- `personal-models.json`, written only by `renku generation models import` and
  `remove`, which the Model Researcher skill runs when the user adds or removes
  a model.

Core reads and merges the two files. Studio Settings, the Route Chooser and
the agent all read the merged list through Core. Nothing is synced, copied at
session start or supplied by the agent. Bundled entries win over personal ones.

The approved explainer is
[Renku Model Library](https://claude.ai/artifact/774rt8XjA7kFAFhMWGzCqZ)
(revision 2).

## Review Attention

- **Behavior beyond the literal request, and why:**
  - **Setup prepares the studio-skills download for every user**, not only
    when Claude is detected. Codex-only and `npx skills` users have no other
    Renku-owned copy to install `bundled-models.json` from.
  - **Every bundled route must belong to a model.** The 179 routes in the five
    `supported-routes.json` files get grouped into models with lanes and an
    operation label. This is curation work in studio-skills (Slice 4).
  - **A route `operation` label** (for example `image-to-video`) is added so
    the agent maps a model to its exact route from data instead of prose. Core
    treats it as an opaque string.
- **New or changed contracts:**
  - files `bundled-models.json` and `personal-models.json` (format below);
  - `renku generation models list|show|import|remove` change to model entries;
    `--route-index` is removed;
  - new `renku generation models bundled install --file <path>` (setup and
    development only);
  - new Studio route `GET /studio-api/model-library`;
  - new diagnostics `CORE_MEDIA_MODEL_LIBRARY_*` codes listed under Contracts,
    and installer code `INSTALL014`.
- **Removed:** `renku generation default-models sync`, Core
  `default-models/`, the state-folder `default-models.json`,
  `GET /studio-api/default-models`, `CODEX_ROUTE_CHOICE_NOT_SYNCED`, the five
  `supported-routes.json` files and `default-models.json` in studio-skills,
  the Media Producer sync step, and the old `library.json` personal format.
- **Rule reversed:** ADR 0100 lets a personal label win a collision. Now the
  bundled entry wins; the personal entry and its notes are kept but unused.
- **Migrations:** none. No populated personal library exists
  (`~/.config/renku/model-library/` is absent on the development machine), so
  `library.json` is simply no longer read. Project databases are untouched.
- **Kept unchanged:** the Claude marketplace checkout path
  `<install-root>/plugins/claude/renku` (renaming it would force re-registering
  every user's Claude marketplace); provider schemas, prices and execution in
  Engines; lane settings and the Settings dropdown behavior from 0229; prompting
  guides in studio-skills; the Codex permission profile.
- **Assumptions:**
  - pre-customer: no other machine has a personal library worth converting;
  - every user installs and updates Renku through the same setup, so the
    bundled list reaches users of every agent.
- **Needs approval:**
  - keeping the checkout at `plugins/claude/renku` while it also serves
    Codex-only users (recommended), versus renaming it with a Claude
    marketplace re-registration;
  - ADR 0119 below.

## Context

- ADR 0100 (personal media model libraries), ADR 0110 (Claude marketplace
  checkout), ADR 0111 (plugin-only installation), ADR 0114 (models as Skill
  data), ADR 0115 (generation lanes), ADR 0116 (state directory and Default
  Model List publish).
- Plan 0229 (lanes, Route Chooser, cost review).
- Code: `packages/core/src/server/media-model-library/`,
  `packages/core/src/server/default-models/`,
  `packages/cli/src/commands/generation/models/`,
  `packages/cli/src/commands/generation/default-models-sync.ts`,
  `packages/codex/src/route-choice/`,
  `packages/studio/server/routes/default-models.ts`,
  `packages/studio/src/features/movie-studio/project-details/`,
  `distribution/install.sh`, `distribution/install.ps1`,
  `distribution/claude/checkout.mjs`, `distribution/claude/plugin.mjs`.
- studio-skills: provider Skills' `references/supported-routes.json`,
  `media-producer/references/default-models.json`, `model-guides/`,
  `model-researcher/references/{workflow,bundled-authoring}.md`,
  `scripts/validate-media-generation-skills.mjs`.

## Contracts

### Model Library files

Both files live in `<resolveRenkuConfigDir()>/model-library/` and share one
format:

```json
{
  "formatVersion": 1,
  "models": [
    {
      "key": "seedance-2.5",
      "name": "Seedance 2.5",
      "lanes": ["video"],
      "routes": [
        { "provider": "fal-ai", "apiId": "bytedance/seedance-2.5/image-to-video", "name": "Seedance 2.5 Image to Video", "operation": "image-to-video" },
        { "provider": "fal-ai", "apiId": "bytedance/seedance-2.5/text-to-video", "name": "Seedance 2.5 Text to Video", "operation": "text-to-video" }
      ],
      "recommendedFor": ["fal-ai"]
    }
  ]
}
```

- `key`: lowercase `^[a-z0-9]+(?:[.-][a-z0-9]+)*$`; for bundled models it is the
  model guide key under `media-producer/references/model-guides/`.
- `lanes`: non-empty subset of `GENERATION_LANES`.
- `routes`: non-empty; `provider` is a kebab id known to Engines or the host
  provider `codex`; `apiId` exact and opaque; `operation` an opaque kebab label.
  A `(provider, apiId)` pair appears once per file.
- `recommendedFor`: providers that appear in `routes`; at most one
  recommendation per provider per lane across a file.
- Size limit 1 MiB per file. Unknown fields are errors (these are not import
  YAML).

### Merge rule

Core merges by model `key`, then by route:

1. A bundled model replaces a personal model with the same `key`.
2. A personal route whose `(provider, apiId)` is in any bundled model is dropped
   from the personal model; a personal model left with no routes is dropped.
3. Bundled `recommendedFor` wins; a personal recommendation applies only where
   no bundled model recommends that provider in that lane.

The merged list carries no source marking; Settings and the chooser show bundled
and personal models alike.

### Core

- `packages/core/src/client/media-models.ts`: `MediaModel`, `MediaModelRoute`,
  `MediaModelLibrary` (`{ models, bundled: { installed: boolean },
  personal: { revision: string | null } }`).
- `readMediaModelLibrary(options)`: reads both files, validates, merges.
  A missing bundled file returns `bundled.installed: false` and an empty
  bundled layer.
- `installBundledMediaModels({ file, providerIds })`: validates the source file
  and atomically replaces `bundled-models.json`; unchanged content is a no-op.
- `importPersonalMediaModel` / `removePersonalMediaModel`: model entries,
  existing revision and lock protocol, `--if-revision`.
- `readMediaModel({ key })`: the merged entry plus `personalGuidePath`
  (`model-library/guides/<key>.md`), returned for every key so bundled and
  personal models get notes the same way.
- Diagnostics: `CORE_MEDIA_MODEL_LIBRARY_INVALID`,
  `CORE_MEDIA_MODEL_LIBRARY_IO_FAILED`, `CORE_MEDIA_MODEL_LIBRARY_BUSY`,
  `CORE_MEDIA_MODEL_NOT_FOUND`, `CORE_MEDIA_MODEL_PROVIDER_UNSUPPORTED`
  (existing codes, current meanings).

### CLI

```bash
renku generation models list [--lane <image|image-edit|video|audio>] [--provider <id>] [--query <text>] --json
renku generation models show --model <key> --json
renku generation models import --file <model.json> --if-revision <revision|absent> --json
renku generation models remove --model <key> --if-revision <revision> --json
renku generation models bundled install --file <path-to-bundled-models.json> --json
```

`bundled install` passes Engines' registered provider ids plus the host provider
to Core; it returns `{ changed, sha256, path }`.

### Setup

- Both installers prepare the studio-skills checkout at
  `<install-root>/plugins/claude/renku` for every user, before Codex and Claude
  plugin setup, using `prepareClaudeMarketplaceCheckout` renamed to
  `prepareStudioSkillsCheckout` in `distribution/studio-skills-checkout.mjs`.
- Then they run the new runtime's
  `renku generation models bundled install --file <checkout>/models/bundled-models.json`.
- This runs for install, `renku update`, `renku update skills` and the Studio
  update button (which runs `renku update`).
- A failure stops setup with `INSTALL014 Bundled models could not be installed.`
  and keeps the previous `bundled-models.json`.

### Studio and Codex

- `GET /studio-api/model-library` returns `{ resource: MediaModelLibrary }`.
- Settings lists, per lane and provider, the merged models whose `lanes`
  include the lane and whose `routes` include the provider. The default shows
  as the selected model when the lane model is unset (0229 behavior).
- The Route Chooser builds options from `readMediaModelLibrary`.

### studio-skills

- `models/bundled-models.json` at the repository root replaces the five
  `supported-routes.json` files and `media-producer/references/default-models.json`.
- `pnpm models:install` (development only) runs
  `renku generation models bundled install --file models/bundled-models.json`.
- Provider Skills and Media Producer read models only through
  `renku generation models list|show`.

## Architecture Shape Gate

- **Core owns** `packages/core/src/server/media-model-library/`:
  - `document.ts`: envelope parsing for one file;
  - `merge.ts`: the merge rule only;
  - `bundled-store.ts`: read and atomic install of `bundled-models.json`;
  - `personal-store.ts`: read, lock and mutate `personal-models.json`
    (from today's `file-store.ts`);
  - `service.ts`: `readMediaModelLibrary`, `readMediaModel`,
    `installBundledMediaModels`, `importPersonalMediaModel`,
    `removePersonalMediaModel`;
  - `index.ts`: re-exports only.
  - Deleted: `resolution.ts`, `packages/core/src/server/default-models/`,
    `packages/core/src/client/default-models.ts`.
- **CLI** `packages/cli/src/commands/generation/models/`: `queries.ts`
  (list, show), `mutations.ts` (import, remove), new `bundled-install.ts`;
  `default-models-sync.ts` deleted.
- **Studio server** `routes/model-library.ts` replaces `routes/default-models.ts`;
  `services/studio-model-library-api.ts` replaces
  `services/studio-default-models-api.ts`.
- **Codex** `route-choice/opening.ts` and `options.ts` read the library; the
  `NOT_SYNCED` code is removed from `diagnostics.ts`.
- **Distribution** `distribution/studio-skills-checkout.mjs` (renamed from
  `claude/checkout.mjs`) and `distribution/install-bundled-models.mjs`;
  `install.sh` and `install.ps1` call them; `claude/plugin.mjs` receives the
  prepared checkout.
- **Forbidden:** model names, keys or route ids in any studio package or
  distribution script; Studio or Codex reading Skills folders; a read path for
  `library.json`; agent-supplied model lists; a source marker in Settings.
- **Stop and revise if:** `merge.ts` needs provider or model branches;
  `service.ts` grows file IO; an installer script parses the model file instead
  of calling the CLI.

## Implementation Slices

### Slice 1: Core library

Two-file format, `merge.ts`, stores, service, client DTOs; delete
`resolution.ts`, `default-models/` and the client Default Model List types.

### Slice 2: CLI

New `models list|show|import|remove` shapes, `models bundled install`; remove
`--route-index` and `default-models sync`; update help and command docs.

### Slice 3: Setup

`distribution/studio-skills-checkout.mjs` for every user,
`distribution/install-bundled-models.mjs`, both installers, `INSTALL014`;
release-contract and installer tests.

### Slice 4: studio-skills

Curate `models/bundled-models.json` from the five route files and
`default-models.json` (every route gets a model, lanes and an operation);
delete the old files; validator checks (guide per key, routes unique,
recommendations within routes, Codex identity); `pnpm models:install`; update
provider Skills, Media Producer, Model Researcher (personal and bundled
workflows), evals and README.

### Slice 5: Studio and Codex consumers

`GET /studio-api/model-library`, Settings and Route Chooser on the merged
library; remove the default-models route, service and `NOT_SYNCED`.

## Tests And Guardrails

- Core: envelope validation per field; merge precedence (same key, shared route,
  emptied personal model, recommendations); missing bundled file; atomic install
  and no-op; personal revision, lock and remove; guide path per key.
- CLI: each command's JSON shape; `bundled install` changed and unchanged;
  `--route-index` rejected as an unknown flag.
- Setup: the checkout is prepared without Claude; bundled install runs on install,
  `update` and `update skills`; failure stops with `INSTALL014` and keeps the old
  file.
- Studio: Settings lists bundled and personal models identically; bundled wins a
  collision; disabled select when `bundled.installed` is false and no personal
  models exist.
- Codex: chooser options from the merged library, fictional models only.
- Architecture: Studio and Codex do not import Engines; a scan finds no model
  ids in studio packages or distribution scripts.
- studio-skills: validator and `pnpm test`.

## Documentation

- ADR 0119 "Keep media models in one Model Library": supersedes the Default
  Model List part of ADR 0116 (the state directory part stays) and updates
  ADR 0100's collision rule.
- `docs/architecture/media-model-library.md`, `docs/cli/commands.md`,
  `docs/architecture/media-generation.md`, `README.md`.
- Plan 0229 gets a one-line supersession note for its Default Model List parts.
- studio-skills: README, provider Skills, Media Producer, Model Researcher,
  `docs/bundled-media-models.md`.

## Final Verification

- `pnpm build`, `pnpm check`, `pnpm test` in studio; validator and `pnpm test`
  in studio-skills (the known Previs release test excepted).
- Run `pnpm models:install` on the development machine; Settings shows every
  lane's models; add a personal model through the Model Researcher skill and see
  it in Settings; add one with a bundled key and see the bundled entry win.
- Run the installer in a temporary profile without Claude; confirm
  `bundled-models.json` is installed.
- Architecture-shape review: `git diff --stat`, inspect large files and every
  `index.ts`, confirm no model data in studio packages.

## Completion Checklist

### Review Area

- [ ] Checkout path decision and ADR 0119 approved.
- [ ] Ownership matches the Architecture Shape Gate.

### Architecture And Contracts

- [ ] One file format for bundled and personal models, validated by Core.
- [ ] Merge rule implemented in `merge.ts` only; bundled wins.
- [ ] No reader for `library.json` or the state-folder `default-models.json`.
- [ ] No model data in studio packages or distribution scripts.

### Implementation Slices

- [ ] Slice 1 Core library.
- [ ] Slice 2 CLI commands.
- [ ] Slice 3 Setup installs bundled models for every user.
- [ ] Slice 4 studio-skills bundled models file, validator and Skill updates.
- [ ] Slice 5 Studio and Codex read the merged library.

### UI And Agent Surfaces

- [ ] Settings shows bundled and personal models alike, default preselected.
- [ ] Route Chooser options come from the library.
- [ ] Model Researcher adds personal models as full model entries.

### Tests And Guardrails

- [ ] Tests listed above added or updated in every package and in studio-skills.

### Documentation

- [ ] ADR 0119, architecture and CLI docs, Skill docs updated.

### Final Verification

- [ ] Root checks pass in studio; validator and tests pass in studio-skills.
- [ ] Development and clean-profile setup runs verified.
- [ ] `git diff --stat` reviewed; large files inspected; `index.ts` files thin.
