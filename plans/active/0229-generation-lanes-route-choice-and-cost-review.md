# 0229 Generation Lanes, Route Choice And Cost-Aware Review

Status: implemented (native Codex Desktop and Claude Code verification pending)
Date: 2026-10-12

## Summary

Project Settings exist to remove friction. They hold the defaults and the
approval preferences an agent follows without asking every time. Today they
only partly do that.

- Image creation and image editing share one Image setting. The Skill then
  overrides that setting for edits: `media-producer/SKILL.md:127-135`
  hard-codes FLUX 3 on Fal.ai whenever a Fal key exists.
- Settings name a provider but no model.
- Nothing lets the user confirm the provider and model before a generation.
- The review surface is not uniform. The image edit and dialogue direction
  panels skip the combined review panel. Their Generate message also claims
  to be the user's approval, which Codex treats as untrusted input.
- No surface shows a cost estimate.
- "Show Generation Previews" only drives the obsolete Visualize path.

This plan makes Project Settings the single source of truth for generation
defaults and interruptions. Every generation goes through the same five
stages, and the user can micromanage or switch off the interruptions:

1. **Target**: unchanged. The existing image target chooser resolves an
   ambiguous image edit.
2. **Route choice** (provider and model): a new inline **Route Chooser**
   panel in Codex, preselected from the lane defaults. Skipped when "Choose
   Provider and Model Each Time" is off.
3. **Authoring**: the purpose desk (image edit or dialogue direction) when
   the route has a `## Codex panel` block. In this stage Generate is an
   authoring step and no longer means approval.
4. **Review**: prompt, references, model settings and **estimated cost**.
   Codex uses the combined review panel. Other harnesses, Claude included,
   use Studio's Generation Preview dialog, or text when Studio is not
   running. Skipped when "Ask Before Generating" is off.
5. **Execute, import, report**: unchanged, and always done by the agent.

A **generation lane** is one group of generation defaults in Project
Settings. The lane boundary is *generating new* versus *editing existing*;
operation variants such as image-to-video or reference-to-video do not get
their own lanes. A video used as a reference for a new video is generation.
This plan ships four lanes: Image Generation, Image Editing, Video Generation
and Audio Generation. Video Editing is added when video editing ships.
Audio editing is skipped because no good models exist yet.

## Decisions

Answered on 2026-10-12:

- **D2. Visualize is deleted.**
  - "Show Generation Previews" (`displayPreview`) is removed.
  - The global `codexGenerationReview` preference is removed.
  - Harnesses other than Codex, Claude included, keep Studio's Generation
    Preview dialog as the review surface.
- **D3. Placement of the two "don't ask" toggles.** Each sits in the panel
  it suppresses, and both also appear in Settings:
  - "Don't ask which provider and model again" in the Route Chooser;
  - "Generate without asking next time" next to Submit in the review panel.

  The user turns either back on by asking the agent or in Settings.
- **D4. Image Editing is an explicit lane.**
  - Its default is FLUX 3 on Fal.ai, through the Skill's recommendation for
    Fal.ai. The user can set any other default.
  - GPT Image 2.5 through Codex's built-in model becomes one route option in
    *our* image edit panel. The agent runs it with the built-in image tool
    instead of calling a provider.
- **D6. Pricing is cached provider metadata owned by Engines,** like input
  schemas.
  - There is no price data in Core, Studio, the Project database or
    studio-skills files.
  - Prices come from provider APIs when they exist; an API call is fast, so
    accuracy wins.
  - Otherwise prices come from an agent-researched entry, recorded into the
    same cache with an expiry, so the slow research runs only when an entry
    is missing or expired.
  - Core and Studio only display an estimate Engines computed.
  - Keep it simple: no rate-card language in Skills.
- **D7. Mutable Renku state moves to a Renku state directory.** The exact
  files are listed under Contracts.
- **D8. Execution always stays with the agent.** No MCP server execution.
- **D9. Lanes split generate versus edit.** There is one default model per
  lane. Users pick a trusted model family (Seedance 2.5, MiniMax H3, Kling,
  Eleven v4), and the agent maps that family to the operation route.
- **Additional answers:**
  - Uploading references needs no separate consent.
  - A missing default model opens the chooser.
  - When Studio is not running, the review falls back to text.
  - Defaults follow the current Urban Basilica values.
  - There is no per-generation spending threshold. An overall generation
    budget is a later plan.
  - This stays one plan.

Confirmed on 2026-10-12:

- **D1. Settings get the model list through the Default Model List
  publish,** explained in detail in its own section below.
- **D5. "Choose Provider and Model Each Time" defaults to on** for new
  Projects and in the migration. The chooser shows until the user ticks
  "Don't ask again".
- **ADRs 0115–0118 are written as accepted.**

## Review Attention

- **Behavior added beyond the literal request (and why):**
  - **Renku state directory (D7).** Without it, every Codex generation
    escalates, because the CLI writes caches and runtime files into the
    read-only `~/.config/renku`. The auto reviewer then refuses the
    escalation, and "generate without asking" cannot work.
  - **Default Model List publish (D1).** Settings cannot list models
    otherwise without copying Skill data.
  - **Agent-recorded price entries.** You asked for slow website research
    to be cached. This is that cache entry.
  - **A `billing` field in Skill route descriptions.** Codex built-in routes
    are marked as using the ChatGPT plan, so the review shows "plan usage"
    without any code branching on the `codex` id.
  - **Provider label in Settings.** It changes from "ChatGPT Images 2.5
    (Codex)" to "Codex (built-in)" now that the model has its own select.
- **New or changed Settings, commands and contracts:**
  - **Project Settings v7:**
    - `generation.imageEdit` lane;
    - per-lane `model` (a Skill model key and name) and
      `chooseRouteBeforeGenerating`;
    - `displayPreview` removed.
  - **`GenerationWorkflowPolicy`:**
    - adds `lane`, `model` and `chooseRouteBeforeGenerating`;
    - removes `codexGenerationReview` and `displayPreview`.
  - **Global config:**
    - `codexGenerationReview` and `CONFIG015` removed;
    - `codexGenerationReviewDisplayMode` stays.
  - **CLI:**
    - new `renku settings generation show|set`;
    - new `renku generation default-models sync`;
    - new `renku generation price show|record`;
    - new `renku generation estimate`;
    - `renku generation configuration-visualization *` removed.
  - **Codex MCP:**
    - new `generation.route.choose`, `generation.route.respond` (app-only)
      and `generation.route.consume`;
    - new `generation.review.estimate` (app-only);
    - `generation.review` gains `lane` and the route `billing` field;
    - review response gains `askBeforeGeneratingNextTime`;
    - new resource `ui://renku/route-chooser`.
  - **Studio:**
    - Image Editing section;
    - per-lane model select;
    - cost view in the review panel and in Generation Preview;
    - `GET /studio-api/default-models`.
  - **Skills:**
    - `media-producer/references/default-models.json`;
    - a `## Codex panel` image-edit block for the Codex built-in GPT Image
      2.5 route;
    - a price research procedure.
- **Migrations, deletions and moves:**
  - One-way Drizzle data migration of Settings v6 → v7.
  - Deleted:
    - Core `generation-configuration-visualizations/`;
    - CLI visualization commands;
    - Skills Visualize references, scripts and evals;
    - the first-person "I approve…" sentences and their tests.
  - State directory: no read-time migration. Old files in `~/.config/renku`
    are ignored and can be deleted by hand. You select the current Project
    once more.
- **Kept unchanged:**
  - ADR 0103 provider rules (keyed providers, "API key missing", no silent
    provider switch);
  - the image target chooser;
  - desk layouts;
  - Engines execution, provenance and attachment;
  - concurrency semantics (item 5 is future work);
  - the review panel's own model switcher, which now sources the same list;
  - Codex display mode.
- **Assumptions:**
  - Codex keeps running app-only tools without its reviewer. This is
    verified in open-source `codex-rs`, and Renku already relies on it.
    Codex Desktop is closed source.
  - Codex keeps wrapping `ui/message` as untrusted input. Nothing in this
    plan depends on that message carrying authority.
- **Needs approval:**
  - D1 and D5;
  - ADRs 0115–0118 (listed under Documentation).

## Research Findings

All findings were checked on 2026-10-12.

### Why the 2026-10-11 Codex approval was denied

- **Network was already enabled.** Session
  `~/.codex/sessions/2026/10/11/rollout-…01a12c30….jsonl` shows every turn
  with `network: "enabled"` under the `renku-studio` permission profile.
- **The real failure was a filesystem write.** The CLI hit `EPERM` writing
  under `~/.config/renku`, which the profile grants read-only. studio-skills
  `docs/codex-renku-permissions.md` recommends read-only to protect
  credentials. The failed writes were:
  - `cache/provider-metadata/…`
  - `current-project.json`
  - `studio-events.jsonl`
  - `studio-runtime.json.*.tmp`
- **The reviewer refused the follow-up.** The agent escalated. The auto
  reviewer refused because the only "authorization" was the panel's
  untrusted message.
- **Removing the out-of-root writes removes the approval request.** When the
  CLI runs entirely inside the sandbox, no approval request exists, and the
  reviewer never runs (`codex-rs/docs/sandboxing/auto-review.md`).

### Codex approval mechanics

- **Reviewer modes:** `approvals_reviewer` is `user` (the default) or
  `auto_review`. The reviewer trusts only:
  - user and developer messages;
  - `AGENTS.md`;
  - `request_user_input` answers.

  Tool outputs, skills and plugin text are untrusted
  (`prompts/templates/guardian/policy_template.md:6`).
- **Allow rules:** a user-written `prefix_rule(..., decision="allow")` in
  `~/.codex/rules/` skips prompting and review. Plugins cannot ship rules,
  permission profiles or network allowlists (`core-plugins/src/loader.rs`).
- **MCP servers:** they run outside the sandbox. Tools called by an app go
  through `mcpServer/tool/call`, which applies no approval mode, reviewer or
  hooks (`app-server/.../mcp_processor.rs:679-700`).
- **`ui/message`:** Codex Desktop wraps it as `untrusted_input` from
  `mcp_app`.
- **Built-in image tool (`image_gen.imagegen`):**
  - accepts `prompt`;
  - edits take up to five `referenced_image_paths`;
  - has no mask parameter;
  - is callable only by the model;
  - counts against ChatGPT plan usage.

**Consequence:** Renku's confirmation ("Ask Before Generating") and the
host's approval are separate layers. Renku controls only its own
confirmation. Host approval disappears when the CLI stays inside a
network-enabled profile. The Skills must never coach the reviewer.

### Pricing availability

| Provider | API price | Exact quote for a request | Otherwise |
| --- | --- | --- | --- |
| Pika | `display_pricing` in the catalog response Engines already caches | Public `POST /catalog/apis/{id}/quote` | n/a |
| WaveSpeed | `base_price` in the cached model list | `POST /api/v3/model/price` (key) | n/a |
| Fal.ai | `GET /v1/models/pricing` (unit and unit price) | No | Resolution and audio adjustments only in `fal.ai/models/{id}/llms.txt` prose |
| Replicate | None | No | Model pages |
| ElevenLabs | Credit multipliers only | No | `elevenlabs.io/pricing/api` (promotions expire) |
| World Labs | None | No | `docs.worldlabs.ai/api/pricing.md` (credits) |
| Codex built-in | None | n/a | ChatGPT plan usage, not dollars |

Fal.ai and WaveSpeed account discounts may lower the real charge. Recording
the actual charge reported after a run belongs to a later plan, together with
the overall budget.

### Current Studio state

- **Settings storage:** Settings v6 is one JSON document per Project. Agents
  read it only through `renku generation context` `workflowPolicy`.
- **Settings enforcement:** no code enforces Ask, concurrency or
  `displayPreview`.
- **Default model:** there is none anywhere.
- **Image edit routing in the Skill:**
  - `media-producer/SKILL.md:127-135` forces FLUX 3 whenever a Fal key
    exists;
  - `image-operation-routing.md:88-102` still says the Image setting decides
    edits.
- **Model list command:** `renku generation models list` merges
  caller-supplied bundled `supported-routes.json` files with the personal
  library (ADR 0100). Route `name`s there are family names such as
  "Seedance 2.5".
- **Urban Basilica Settings:** equal to today's defaults.
  - Image: `codex`, Ask off, concurrent 5.
  - Video: `fal-ai`, Ask on, 1.
  - Audio: `elevenlabs`, Ask on, 1.
  - `displayPreview` true and prompt expansion on.

## D1 In Detail: Default Model List Publish

**The problem.** The Settings page runs in Studio, separate from any agent.
To show a model dropdown it needs a list of models per lane and provider.
That list belongs to studio-skills, which Codex or Claude installed into a
plugin cache folder that Studio cannot locate.

**The design.**

1. **studio-skills owns one small file:**
   `skills/media-producer/references/default-models.json`. It lists, per
   lane, the trusted model families a user may pick as a default, the
   providers that carry each family, and which family is recommended for
   each provider when the lane's model is unset:

   ```json
   {
     "formatVersion": 1,
     "lanes": {
       "imageEdit": [
         { "model": "flux-3-image", "name": "FLUX 3", "providers": ["fal-ai"], "recommendedFor": ["fal-ai"] },
         { "model": "chatgpt-images-2.5", "name": "GPT Image 2.5", "providers": ["codex"], "recommendedFor": ["codex"] },
         { "model": "gpt-image-2.5", "name": "GPT Image 2.5 Flare and Sunburst", "providers": ["fal-ai"], "recommendedFor": [] },
         { "model": "nano-banana", "name": "Nano Banana 2.1", "providers": ["fal-ai"], "recommendedFor": [] }
       ],
       "video": [
         { "model": "seedance-2.5", "name": "Seedance 2.5", "providers": ["fal-ai", "pika", "wavespeed-ai"], "recommendedFor": ["fal-ai", "pika", "wavespeed-ai"] },
         { "model": "minimax-h3", "name": "MiniMax H3", "providers": ["fal-ai"], "recommendedFor": [] }
       ],
       "image": [],
       "audio": []
     }
   }
   ```

   - `model` is the existing model guide key: the guide filename or folder
     under `model-guides/`.
   - The Skills validator checks that every entry has a guide.
   - It checks that every provider has a route of that family name in its
     `supported-routes.json`. Codex is checked against its guide.
   - It checks that each provider has at most one recommendation per lane.
   - Real entries are curated in Slice 4; the values above are examples.
2. **The agent publishes it.** At the start of generation work, beside its
   existing `renku credentials status` check, Media Producer runs:

   ```
   renku generation default-models sync --file <skill-dir>/references/default-models.json
   ```

   - This is a local file read and validation, taking milliseconds.
   - Core writes a copy to `~/.local/state/renku/default-models.json`.
   - It does nothing when the content hash is unchanged.
   - This is the same pattern the Skill already uses when it passes its
     `supported-routes.json` paths to `generation models list`.
3. **Studio Settings read the copy.** `GET /studio-api/default-models`
   returns `notSynced` or the lanes.
   - The model select lists the families whose `providers` include the
     selected provider.
   - The first option is "Recommended (FLUX 3)", which saves `model: null`.
   - A saved family missing from the current list shows with a "not in
     current Renku skills" note.
   - Before the first sync, the select shows only "Recommended".
4. **The Route Chooser** reads the same copy.
5. **At generation time** the agent reads the lane's provider and model key
   from `generation context`. It then maps the family and the purpose to the
   exact route with its model guide. For example, Seedance 2.5 for a
   reference-to-video shot maps to Seedance 2.5's reference-to-video route
   on the selected provider.

**Why this is not duplication.**

- The list is written once, in Skills.
- Studio holds a cache that the agent refreshes. Studio never decides
  anything from it except which names to list.
- Core validates only the envelope: lane names, unique keys, providers and
  one recommendation per provider.

**Alternatives.**

- **Choose the model only in the Route Chooser.** The agent supplies the
  candidates. Settings show the saved name and a Clear action, with no
  dropdown. There is no new file and no sync. The trade-off is that the
  model can't be changed from the Settings page.
- **Rejected: Studio reads the installed plugin folders.** That ties Studio
  to the Codex and Claude cache layouts.
- **Rejected: move the list into Engines.** That duplicates Skill data.

## Target User Experience

| Stage | Lane setting | Codex Desktop | Other harnesses (Claude included) |
| --- | --- | --- | --- |
| Route choice | Choose Each Time on | Route Chooser panel (inline) | One short question, using the harness's structured question tool when it has one |
| Route choice | Choose Each Time off | Lane default, no prompt | Same |
| Authoring | Route has a panel block | Purpose desk | Conversational authoring |
| Review | Ask on | Combined review panel with estimate; Submit | Studio Generation Preview with estimate, then confirmation in chat; text summary when Studio is not running |
| Review | Ask off | No review; the agent executes | Same |

**Route Chooser contents:**

- **Provider:** the keyed providers, plus Codex in Codex Desktop. A provider
  without a key shows "API key missing".
- **Model:** the families for that provider in this lane.
- **Preselection:** the lane default, or the recommendation when the model
  is unset.
- **Checkboxes:**
  - "Save as Project default for Image Editing";
  - "Don't ask which provider and model again for Image Editing".
- **Buttons:** Continue and Cancel.
- **Not shown:** prices (the review stage shows cost) and raw ids.

**Missing default.** Sometimes the saved model no longer appears in the
list, or its provider key is gone. The agent then opens the chooser, or asks
in text, even when Choose Each Time is off, and says why.

**Codex built-in GPT Image 2.5 in the image edit panel:**

- The route block uses provider `codex`, no region modes (the built-in tool
  has no mask), a style reference, and no native controls. It is offered
  only in Codex Desktop.
- After Generate, the agent consumes the draft. When Ask is on, it opens the
  review panel; the estimate shows "Uses your ChatGPT plan's Codex usage".
- The agent then calls the built-in image tool with the base image, the
  style image and the instruction.
- It imports the result with `renku media import --purpose image.edit` and
  `codex` provenance, then reports through `image.edit.report`.

## Context

- **ADRs:**
  - 0074 (Core-owned workflow settings);
  - 0086 (Skill-directed provider engines; pricing removed);
  - 0091 (Visualize cache, deleted here);
  - 0100 (personal media model library);
  - 0103 (keyed providers as agent defaults);
  - 0105 and 0106 (review routing);
  - 0113 (imported image edits);
  - 0114 (models as Skill data in Codex panels).
- **Plans:**
  - 0226, 0227 and 0228;
  - the 2026-10-12 investigation of the Generate approval wording.
- **Docs:**
  - `docs/architecture/media-generation.md`;
  - `media-model-library.md`;
  - `docs/cli/commands.md`;
  - studio-skills `docs/codex-renku-permissions.md`.
- **Real project:** `$HOME/renku-movies/urban-basilica`.

## Architecture Shape Gate

### Ownership

- **Core** owns:
  - lanes and the purpose→lane map;
  - Settings v7, its validation and migration;
  - the focused lane-settings command;
  - the workflow policy projection;
  - state directory paths;
  - the Default Model List envelope and its stored copy;
  - the `GenerationCostEstimate` display envelope.

  Core holds no prices and no price rules.
- **Engines** owns:
  - price retrieval from provider APIs;
  - recorded price entries;
  - their caching and expiry in the provider metadata cache;
  - quotes;
  - estimate computation.

  Engines stays standalone.
- **CLI** is the composition root. It:
  - reads the files the agent passes;
  - calls Core and Engines;
  - maps the Engines estimate into the Core envelope;
  - injects a `GenerationCostEstimator` into the Codex MCP server.
- **Codex** owns:
  - the Route Chooser session tools;
  - review estimate plumbing.

  It never imports Engines and never branches on provider or model ids.
- **Studio** is a projection consumer:
  - Settings UI;
  - panels;
  - the shared cost view.
- **Skills** own all model knowledge:
  - the Default Model List;
  - recommendations;
  - the mapping from family to route;
  - price research;
  - when to ask;
  - honest host-approval behavior.

### File layout

**Core:**

- `core/src/client/generation-lanes.ts`: `GenerationLane`, `GENERATION_LANES`
  and `MEDIA_PURPOSE_GENERATION_LANES` (`Record<MediaPurpose, GenerationLane>`).
- `core/src/client/project-settings.ts`: v7 types (edited).
- `core/src/client/default-models.ts`: Default Model List DTOs.
- `core/src/client/generation-cost-estimate.ts`: display envelope.
- `core/src/server/project-settings/document.ts`: v7 schema and defaults
  (edited).
- `core/src/server/project-settings/lane-settings.ts`:
  `updateGenerationLaneSettings`.
- `core/src/server/project-settings/generation-policy.ts`: resolves by lane
  (edited).
- `core/src/server/default-models/`:
  - `document.ts`: envelope schema and size limit;
  - `store.ts`: atomic write and hash no-op;
  - `service.ts`: `syncDefaultModelList`, `readDefaultModelList`;
  - `index.ts`: thin.
- `core/src/server/config/paths.ts`: `resolveRenkuStateDir` (edited).
  `current-project.ts`, `runtime-descriptor.ts` and `event-store.ts` switch
  to it.
- Deleted: `core/src/server/generation-configuration-visualizations/`.

**Engines:**

- `engines/src/pricing/`:
  - `contracts.ts`: `RoutePrice`, `CostEstimate`, `CostEstimateState`;
  - `price-schema.ts`;
  - `price-evaluation.ts`: closed unit and quantity vocabulary;
  - `price-cache.ts`: API and recorded entries in the provider metadata
    cache;
  - `estimate.ts`: order is quote, then fresh recorded entry, then API
    price, then unpriced;
  - `index.ts`.
- The empty `generation/pricing/` folder is deleted.
- `media/contracts.ts` gains optional `readPrice(model, ctx)` and
  `quoteCost(model, request, ctx)`. Implementations live in:
  - `providers/pika/pricing.ts`: catalog `display_pricing` plus quote;
  - `providers/wavespeed/pricing.ts`: `base_price` plus price API;
  - `providers/fal-ai/pricing.ts`: pricing API.

  Provider `index.ts` files only register these.

**CLI:**

- `cli/src/commands/project-settings/generation-lane-command.ts`.
- `cli/src/commands/generation/default-models-sync.ts`.
- `cli/src/commands/generation/price.ts`: `price show` and `price record`.
- `cli/src/commands/generation/estimate.ts`.
- `cli/src/commands/generation/cost-estimator.ts`: the Engines-to-Core
  composition, also injected into `studio mcp`.
- Deleted: `configuration-visualization.ts`.

**Codex:**

- `codex/src/route-choice/`:
  - `contracts.ts` and `schemas.ts`;
  - `opening.ts`;
  - `choice-state.ts`;
  - `tools.ts`;
  - `resources.ts`;
  - `index.ts`: registration only.
- `codex/src/generation-review-estimate.ts`.
- `server.ts` gains only registration and injection lines.

**Studio:**

- `src/features/codex-route-chooser/`.
- `src/app/codex-route-chooser.tsx`.
- `vite.codex.config.ts`: the fifth single-file build.
- `src/features/media-generation-request/generation-cost-estimate-view.tsx`:
  shared by the review panel and Generation Preview.
- `src/features/movie-studio/project-details/generation-lane-section.tsx`.
- `server/routes/default-models.ts`.

**Skills:**

- `media-producer/references/default-models.json`.
- `media-producer/references/route-choice.md`.
- `model-researcher/references/price-research.md`.
- The Codex panel block in `model-guides/image/chatgpt-images-2.5.md`.
- Validator: two focused functions, one for Default Model List entries and
  one for accepting the Codex panel identity.
- Deleted:
  - `inline-generation-configuration.md`;
  - `generation-configuration-template.md`;
  - Visualize scripts and evals.

### Forbidden shapes and stop conditions

**Forbidden:**

- A lane `switch` in Studio, Codex or CLI. Lanes come from `GENERATION_LANES`
  and the purpose map.
- Provider or model id literals outside Engines provider modules and Skills.
  The existing `codex` default (ADR 0103) is the one exception.
- Price data or price arithmetic outside `engines/src/pricing/` and
  provider pricing files. Estimate formatting outside the shared Studio
  view.
- A generic settings patch tool. The chooser and review panel call the
  focused lane command with the two fields they own.
- Read-time migration of old state files.

**Stop and revise if:**

- `price-evaluation.ts` needs provider branches;
- the Route Chooser needs route-specific UI;
- `project-settings-fields.tsx` gains lane conditionals;
- Codex `server.ts` grows beyond registration and injection.

## Contracts

### Project Settings v7

```ts
export type GenerationLane = 'image' | 'imageEdit' | 'video' | 'audio';

export interface ProjectGenerationSettings {
  enableProviderPromptExpansion: boolean;
  image: GenerationLaneSettings;
  imageEdit: GenerationLaneSettings;
  video: GenerationLaneSettings;
  audio: GenerationLaneSettings;
}

export interface GenerationLaneSettings {
  provider: string;                    // opaque kebab-case id (unchanged rule)
  model: GenerationLaneModel | null;   // null = the Skill's recommendation for the provider
  chooseRouteBeforeGenerating: boolean;
  askBeforeGenerating: boolean;
  runGenerationsConcurrently: boolean;
  maxConcurrentGenerations: number;    // 1..5 (unchanged)
}

export interface GenerationLaneModel {
  key: string;   // Skill model guide key, e.g. a model family
  name: string;  // display name from the Default Model List
}
```

- **Purpose→lane map:** `image.edit` → `imageEdit`; every other purpose maps
  by output media kind. `video.edit` stays in `video` until the Video
  Editing lane exists.
- **`GenerationWorkflowPolicy`:**

  ```ts
  { codexPluginInstalled, codexGenerationReviewDisplayMode,
    enableProviderPromptExpansion, lane, provider, model,
    chooseRouteBeforeGenerating, askBeforeGenerating, concurrencyLimit }
  ```

- **`updateGenerationLaneSettings`:**
  - takes `{ lane, provider?, model?, chooseRouteBeforeGenerating?, askBeforeGenerating? }`;
  - returns `ProjectSettingsMutationReport`;
  - changing `provider` without `model` clears `model`;
  - an unknown lane or an empty change fails with `PROJECT_SETTINGS003`.
- **Defaults for new Projects** (Urban Basilica values plus the new lane):

  | Lane | Provider | Ask | Concurrency |
  | --- | --- | --- | --- |
  | `image` | `codex` | off | concurrent, 5 |
  | `imageEdit` | `fal-ai` | on | off, 1 |
  | `video` | `fal-ai` | on | off, 1 |
  | `audio` | `elevenlabs` | on | off, 1 |

  Every lane also gets `model: null` and `chooseRouteBeforeGenerating: true`
  (D5). Core never stores a model key. Without a Fal key, the Image Editing
  chooser opens through the missing-default rule.
- **Migration:**
  - a custom Drizzle data migration `00NN_generation_lanes.sql`, generated
    with `drizzle-kit generate --custom` as
    `docs/architecture/drizzle-migrations.md` describes;
  - v6 → v7: add `imageEdit` with the defaults above; add `model: null` and
    `chooseRouteBeforeGenerating: true` to every lane; drop `displayPreview`;
  - a migration test from a v6 fixture.

### Renku state directory

`resolveRenkuStateDir()` resolves to:

- macOS and Linux: `$XDG_STATE_HOME/renku`, defaulting to
  `~/.local/state/renku`;
- Windows: `%LOCALAPPDATA%\Renku\Studio\State`.

| File | What it holds | Written by | When |
| --- | --- | --- | --- |
| `current-project.json` | Pointer to the Project the CLI works on: name, id, folder, database path | CLI (`openCurrentProject` / `closeCurrentProject`) | When the current Project changes |
| `studio-runtime.json` | Running Studio's URL, port, pid, heartbeat, and the token the CLI uses to notify it | Studio server | At start, then every 30 s |
| `studio-events.jsonl` | Resource-changed events the CLI appends so open Studio windows refresh | CLI after every write command | On each mutation |
| `cache/provider-metadata/` | Engines' cache of provider input schemas, and now prices and recorded price entries | CLI (`schema show`, `validate`, `execute`, `estimate`, `price record`) | When an entry is missing or expired |
| `default-models.json` | Copy of the Skill's Default Model List | CLI `generation default-models sync` | When the Skill's list changes |

- **Stays in `~/.config/renku`:**
  - `config.yaml`;
  - `.env` (provider keys);
  - `codex-plugin.json`;
  - `model-library/`.

  These are user-authored files; writing them stays an explicit, escalated
  action.
- **Removed:** `cache/generation-configuration-visualizations/`, deleted with
  Visualize.
- **Not written by current Studio code:** `cli-config.json`,
  `config-setting.json`, `env.sh` and `updater.log` are older leftovers on
  this machine, safe to delete by hand.
- **Permissions doc:** studio-skills `codex-renku-permissions.md` adds
  `"~/.local/state/renku" = "write"`.

### Default Model List

- **Skill file and validator:** as described in "D1 In Detail".
- **CLI:**

  ```
  renku generation default-models sync --file <path> [--json]
  ```

  - Returns `{ changed, sha256, path }`.
  - Needs no Project and no running Studio.
- **Stored copy:** `{ formatVersion: 1, syncedAt, sha256, lanes }`.
  - Core validates lane names against `GENERATION_LANES`.
  - Entries are `{model, name, providers[], recommendedFor[] ⊆ providers}`.
  - Model keys are unique per lane, with at most one recommendation per
    provider and lane.
  - The size limit is 256 KiB.
- **Readers:**
  - Core `readDefaultModelList()` returns `{state:'notSynced'}` or
    `{state:'synced', syncedAt, lanes}`;
  - Studio `GET /studio-api/default-models`;
  - the Route Chooser.

### Prices and estimates (Engines)

- **`RoutePrice`** is the cached price for one provider route:

  ```
  { currency: 'USD',
    components: [{ unit: 'request'|'image'|'megapixel'|'second'|'character'|'credit',
                   unitPriceUsd, quantity, tiers? }],
    source: { kind: 'providerApi'|'recorded', url?, observedAt }, expiresAt, notes }
  ```

  - `quantity` is `{kind:'constant', value}`,
    `{kind:'field', pointer, default?}` or
    `{kind:'characters', pointer}`.
  - `tiers` are `{ when: { "<pointer>": value }, unitPriceUsd }`.
  - Anything the vocabulary cannot express, such as token formulas, stays
    `unpriced` unless the provider quotes it.
- **API prices** come from Pika, WaveSpeed and Fal.ai. They are fetched
  through `retrieveProviderMetadata` and expire by provider headers, or after
  24 hours when headers are absent.
- **Live quotes** come from Pika and WaveSpeed. Each is one fast API call per
  estimate, so they are not cached.
- **Recorded entries** cover providers or options with no API price:

  ```
  renku generation price record --provider <id> --model <apiId> --file <price.json>
  ```

  - Engines validates the entry and stores it in the same cache.
  - `expiresAt` is the earlier of `observedAt + 14 days` and any promotion
    end the agent found.
  - `renku generation price show --provider --model` prints the current
    cached price and its age.
- **`estimateCost({provider, model, request})`** tries, in order: a live
  quote, a fresh recorded entry, the API price. Its result:

  ```
  CostEstimate { state: 'quoted'|'computed'|'missingPrice'|'expired'|'unpriced',
                 amountUsd?, basis, observedAt?, sourceUrl?, notes }
  ```

  A missing price is never `0`.
- **CLI estimate command:**

  ```
  renku generation estimate --file <request.json> [--json]
  ```

  - `generation prepare` and `preview show` attach the estimate to the
    Studio preview notification.
  - Generation Preview shows "estimate outdated" when the request SHA no
    longer matches.
- **Core `GenerationCostEstimate`** is the display envelope the CLI maps the
  Engines result into: state, amount, basis, observedAt, sourceUrl, notes and
  requestSha256. Studio renders only this.
- **Route description `billing`:**
  - The Skill sets `'hostPlanUsage'` on Codex built-in routes. The estimator
    is then not called, and the review shows plan usage.
  - Every other route has `'providerCharge'`.
- **Agent research flow (Skill):**
  - Trigger: the review estimate comes back `missingPrice` or `expired` for
    a route without API pricing.
  - The agent reads the provider's public pricing page with web fetch first
    and a browser only if needed.
  - It records the price, then refreshes the estimate.
  - This runs at most once per route per expiry period. It never runs when
    Ask is off, because no review means no estimate.

### Codex MCP

- **`generation.route.choose`** (model, inline):
  - input `{ project, purpose, lane, suggested?: {provider, model} }`;
  - the server builds options from the stored Default Model List;
  - it adds key status and provider labels from Core;
  - it preselects the lane default.
- **`generation.route.respond`** (app-only):
  - input `{ choiceId, choice: {kind:'chosen', provider, model} | {kind:'canceled'}, saveAsLaneDefault, chooseRouteBeforeGenerating }`;
  - records the choice once;
  - on `chosen`, applies lane changes through `updateGenerationLaneSettings`.
- **`generation.route.consume`** (model): returns one of:
  - `{ chosen: {provider, providerLabel, model: {key, name}}, laneSettingsChanged }`;
  - `canceled`;
  - `alreadyConsumed`.
- **`generation.review`:**
  - input gains `lane`;
  - routes gain `billing`;
  - each request projection carries a server-computed `estimate` from the
    injected estimator.
- **`generation.review.estimate`** (app-only):
  - input `{ reviewId, requestId, prompt, values }`;
  - returns `GenerationCostEstimate`;
  - used when the user edits controls in the panel.
- **`generation.review.respond`** gains `askBeforeGeneratingNextTime?`. It is
  applied only with `action: 'submit'`.
- **Purpose desk Generate notifications become neutral.** Example: "Generate
  image edit · Giovanni · Profile Take 3. Session S, action A. Consume it
  with image.edit.consume once." There is no "I approve…" sentence. The
  disclosure line beside Generate remains as information.

## Implementation Slices

Slices run in order. Each slice leaves `pnpm check` and the Skills tests
green.

### Slice 1: Renku state directory

- Add `resolveRenkuStateDir`. Switch current project, runtime descriptor,
  event store and the provider metadata cache root to it.
- Update `docs/cli/commands.md`.
- Update studio-skills `codex-renku-permissions.md`:
  - the state directory write grant;
  - the two approval layers;
  - the optional user-written `prefix_rule`.
- Tests:
  - platform path tests;
  - a CLI test proving `generation execute` writes nothing under the config
    directory.

### Slice 2: Remove Visualize, `codexGenerationReview` and `displayPreview`

- Delete the Core module, CLI commands, config key and `CONFIG015`.
- Remove `displayPreview` from the types, schema, policy and UI. Its data
  removal ships in the Slice 3 migration.
- Skills:
  - delete the Visualize references, scripts and evals;
  - simplify `generation-review-routing.md`. In Codex Desktop, the panel
    opens when the probe is advertised; a failed probe, or a missing probe
    while `codexPluginInstalled`, stops with the existing diagnostic.
    Otherwise use Studio Preview, or text when Studio is not running.
- Mark ADR 0091 superseded.

### Slice 3: Project Settings v7 lanes

- **Core:**
  - lanes and the purpose map;
  - v7 schema, defaults and migration;
  - `updateGenerationLaneSettings`;
  - the lane policy.
- **CLI:** `renku settings generation show|set` with these flags:
  - `--lane image|image-edit|video|audio`
  - `--provider`
  - `--model <key> --model-name <name>` or `--clear-model`
  - `--choose-route on|off`
  - `--ask-before-generating on|off`
- **Studio Settings:**
  - lane sections through `generation-lane-section.tsx`, with an Image
    Editing section;
  - the "Choose Provider and Model Each Time" toggle;
  - the model shown by saved name, or "Recommended";
  - "Show Generation Previews" removed;
  - the provider label "Codex (built-in)".
- **Skills (media-producer):**
  - read the lane fields from `workflowPolicy`;
  - replace the forced FLUX 3 rule: an unset model uses the recommendation
    for the provider (FLUX 3 for Fal.ai image edits);
  - make `image-operation-routing.md` consistent;
  - apply Ask to every route, Codex built-in included;
  - change Settings with `renku settings generation set` only at the user's
    direct request.
- Verify the migration on a copy of the Urban Basilica database.

### Slice 4: Default Model List

- **Skills:**
  - `default-models.json`, curated per lane;
  - validator checks;
  - the Media Producer sync step.
- **Core:** the stored copy module and its services.
- **CLI:** `generation default-models sync`.
- **Studio:**
  - `GET /studio-api/default-models`;
  - the per-lane model select, including the `notSynced` and not-listed
    states.

### Slice 5: Route Chooser

- **Codex:** the `route-choice/` module, resource and tools.
- **Studio:** the panel and its HTML build. The CLI `studio mcp` resolves
  the fifth HTML file.
- **Skills:**
  - `route-choice.md`: open the chooser after the target and before
    authoring or preparation; skip it when the user named a route in chat;
    the text fallback; the missing-default rule; re-enabling at the user's
    request;
  - both panel guides open the chooser before `image.edit.open` and
    `dialogue.direction.open`.
- **Codex built-in GPT Image 2.5 edit route:**
  - the `## Codex panel` block in `chatgpt-images-2.5.md`;
  - validator acceptance of the Codex identity;
  - an image edit panel check that a route with empty controls, no regions
    and a style reference renders correctly;
  - the image edit Skill procedure for executing it through the built-in
    image tool.

### Slice 6: Prices and estimates

- **Engines:**
  - the pricing module;
  - Pika, WaveSpeed and Fal.ai `readPrice`;
  - Pika and WaveSpeed `quoteCost`;
  - recorded entries in the provider metadata cache.
- **CLI:**
  - `generation price show|record`;
  - `generation estimate`;
  - estimator injection into `studio mcp`;
  - estimates attached by `prepare` and `preview show`.
- **Core:** the display envelope and the preview notification field.
- **Studio:** the shared cost view in the review panel and Generation
  Preview.
- **Skills:**
  - `price-research.md` in model-researcher;
  - the Media Producer research trigger;
  - the route `billing` field;
  - replace the provider Skills' "no pricing artifacts" rules.

### Slice 7: Uniform review and honest confirmation

- **Image edit and dialogue Skills:**
  - after Generate, consume the draft and prepare the native request(s);
  - when Ask is on, open `generation.review` with the requests and `lane`;
  - otherwise validate and execute.
- **Neutral Generate notifications.** Delete the first-person approval
  sentences, their persistence, and the tests asserting them.
- **Review panel:** the "Generate without asking next time" toggle and
  `askBeforeGeneratingNextTime`.
- **Skills approval rules:**
  - a consumed Submit, or Ask off, is Renku's confirmation;
  - if the host still asks for approval, request it once with an honest
    description;
  - if refused, ask the user once in chat;
  - never quote panel text as authorization;
  - never retry around a denial.
- **Where those approval rules land:**
  - `SKILL.md:286-287`;
  - `generation-review-routing.md:146-151`;
  - `image-edit-panels.md:196-205`;
  - `dialogue-direction-panels.md:226-235`;
  - the forward-test evals.
- **Docs:** `media-generation.md:129-131` and `:168-172`.

## Tests And Guardrails

- **Core:**
  - v7 schema;
  - lane command, including that a provider change clears the model;
  - the policy per purpose (`image.edit` → `imageEdit`);
  - migration from a v6 fixture;
  - Default Model List envelope, hash no-op and size limit;
  - state directory paths.
- **Engines:**
  - price schema;
  - evaluation for each unit, quantity kind and tier;
  - expiry;
  - estimate ordering;
  - Pika and WaveSpeed quote adapters and Fal.ai pricing with mocked fetch;
  - recorded entries in the cache.
- **CLI:**
  - `settings generation` set and show;
  - `default-models sync` changed and unchanged;
  - `price record` and `price show`;
  - `estimate` JSON shape;
  - `execute` writes only to the state directory and the Project.
- **Codex:**
  - Route Chooser open, respond and consume, with consume allowed once;
  - app-only visibility of respond and estimate;
  - lane changes applied only on `chosen` or `submit`;
  - review estimates from an injected fake estimator;
  - `billing: 'hostPlanUsage'` skipping the estimator;
  - neutral notification text.
- **Studio:**
  - Settings lane sections and the model select states;
  - the removed preview toggle;
  - the Route Chooser panel;
  - every cost view state, with no "$0" for an unknown price;
  - the review toggle.
- **Architecture (stable boundaries only):**
  - Codex and Studio do not import Engines;
  - the 0228 model-id scan, extended to the new modules;
  - no lane switch statements.
- **Skills:**
  - validator coverage of `default-models.json` and the Codex panel
    identity;
  - evals for:
    - the chooser being skipped or shown;
    - Ask off executing without a question;
    - a host denial leading to one chat question;
    - a missing default leading to the chooser;
    - the price research running only on missing or expired entries.

## Documentation

- **New ADRs** (each needs approval):
  - 0115 "Use Project generation lanes as agent defaults" (updates 0074 and
    0103).
  - 0116 "Publish the Skill Default Model List to the Renku state directory"
    (extends 0100).
  - 0117 "Cache provider prices with schemas and estimate before review"
    (supersedes the pricing removal in 0086).
  - 0118 "Separate Renku generation confirmation from host approval"
    (updates 0105 and 0106; records the state directory decision).
- **Architecture docs:**
  - `media-generation.md`;
  - `media-model-library.md`;
  - `data-model-and-storage.md`;
  - the `drizzle-migrations.md` reference.
- **CLI docs:** `docs/cli/commands.md`, covering the new and removed
  commands and the state directory.
- **Website:** fix the stale tutorial line at
  `packages/website/src/data/tutorials.ts:144-145`.
- **Skills:**
  - media-producer `SKILL.md`;
  - `route-choice.md`;
  - the routing guide;
  - both panel guides;
  - `image-operation-routing.md`;
  - provider Skills;
  - model-researcher;
  - `codex-renku-permissions.md`;
  - `README.md`.
- **Historical plans:** 0226–0228 get one-line supersession notes only.

## Final Verification

- In `studio`, run `pnpm build`, `pnpm test`, `pnpm lint` and `pnpm check`.
- In `studio-skills`, run the validator and `pnpm test`. The Previs release
  test already fails before this change.
- Run the extended model-id scan.
- Migrate a copy of Urban Basilica. Settings should show four lanes with the
  defaults above.
- **Native Codex Desktop on Urban Basilica** (paid runs need your approval):
  1. Image edit with Choose and Ask on: target chooser → Route Chooser → desk
     → review with estimate → Submit → attached.
  2. The same edit after turning off both toggles from the panels: no
     interruptions, and no host approval request under the updated profile.
  3. An image edit with GPT Image 2.5 through Codex, with plan usage shown.
  4. A Fal.ai video review with an API-priced or quoted estimate.
- **Claude Code:** one run with a text route question, then Studio Preview
  with the estimate, then confirmation in chat.
- **Architecture-shape review:**
  - read `git diff --stat`;
  - inspect `server.ts`, `project-settings-fields.tsx`,
    `price-evaluation.ts` and every new `index.ts`;
  - confirm there is no lane switch, no price arithmetic outside Engines,
    and no god file.

## Completion Checklist

### Review Area

- [x] D1 and D5 confirmed and recorded at the top of this plan.
- [x] Ownership matches the Architecture Shape Gate across Core, Engines, CLI,
      Codex, Studio and Skills.
- [x] No new broad dispatcher, catch-all helper or god file.

### Architecture And Contracts

- [x] Settings v7 types, schema, defaults and migration; no `displayPreview`.
- [x] `GENERATION_LANES` and `MEDIA_PURPOSE_GENERATION_LANES` drive every lane
      listing.
- [x] `updateGenerationLaneSettings` is the only focused writer used by CLI and
      Codex.
- [x] `codexGenerationReview` and `CONFIG015` removed with no fallback.
- [x] All five state files resolve through `resolveRenkuStateDir`; generation
      writes nothing under `~/.config/renku`.
- [x] Default Model List envelope validated by Core; Core and Studio never
      interpret model keys beyond listing them.
- [x] Prices exist only in the Engines provider metadata cache; Core and
      Studio hold only the display envelope.
- [x] Codex never imports Engines; the estimator is injected by the CLI.
- [x] No provider or model id literals outside Engines provider modules and
      Skills, apart from the ADR 0103 exception.
- [x] Structured diagnostics for every new failure.

### Implementation Slices

- [x] Slice 1 state directory and permissions doc.
- [x] Slice 2 Visualize, `codexGenerationReview` and `displayPreview` removed in
      both repos.
- [x] Slice 3 v7 lanes, migration, CLI, Settings UI, Skill rules.
- [x] Slice 4 Default Model List file, sync, stored copy, Settings model select.
- [x] Slice 5 Route Chooser and the Codex built-in GPT Image 2.5 edit route.
- [x] Slice 6 prices, quotes, recorded entries, estimate, cost view, research
      procedure.
- [x] Slice 7 uniform review, neutral messages, review toggle, honest approval
      Skills.

### UI, CLI And Agent Surfaces

- [x] Settings show four lanes with provider, model, Choose, Ask and
      concurrency; no raw ids in copy.
- [x] Route Chooser preselects defaults and applies its toggles only on
      Continue.
- [x] Review panel shows and refreshes the estimate and applies its toggle only
      on Submit.
- [x] Generation Preview shows the estimate and the outdated state; text
      fallback when Studio is not running.
- [x] New CLI commands documented with JSON shapes.
- [x] Skills contain no approval coaching and no "Generate is approval"
      wording.

### Tests And Guardrails

- [x] Tests listed above added or updated in every package and in Skills.
- [x] Architecture tests protect import boundaries and the id scan without
      naming private helpers.

### Documentation

- [x] ADRs 0115–0118 accepted; 0074, 0086, 0091, 0100, 0103, 0105, 0106 carry
      update notes.
- [x] Architecture, CLI, website and Skill docs updated; historical plans only
      get supersession notes.

### Final Verification

- [x] Root checks pass in `studio`; validator and tests pass in `studio-skills`
      (apart from the pre-existing Previs release test).
- [x] Urban Basilica migration verified on a copy.
- [ ] Native Codex Desktop and Claude Code runs completed as listed.
- [x] `git diff --stat` reviewed; large files inspected; `index.ts` files thin.
- [ ] Only then mark the plan complete.
