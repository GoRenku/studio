# 0242 Casting Rounds, Looks And Wardrobe

Status: implemented (native Codex Desktop panel verification pending)
Date: 2026-10-23

## Decisions

The user chose every recommendation on the review page on 2026-10-23
(published privately as "Casting Flow Proposal"):

- **Age changes are Looks inside one Cast Member.** The user widened this
  rule: the same person is one Cast Member whatever their age. Big Fish's
  Young Edward Bloom, Young Will Bloom and Young Dr. Bennett therefore become
  Looks of Edward Bloom, Will Bloom and Dr. Bennett.
- **Model picking:** set a total, then split it. Model cards have a tick and a
  per-model counter. Each card shows a one-line strength note supplied by the
  Skill.
- **Where candidates show up:** a casting board in Codex. Studio's new
  Casting tab is the record. In Claude Code, the Casting tab is also where the
  user shortlists, hides and casts.
- **Candidate image:** a face close-up and a full-length figure side by side
  in one image.
- **Saved model picks:** per Project, in Project Settings.
- **Skill:** extend `casting-director`. `media-producer` still runs every
  generation.
- **Shot references:** the picked sheet for the scene's costume becomes the
  first Cast continuity suggestion.

The user confirmed both data changes on 2026-10-23:

1. Consolidating Big Fish's three age-variant Cast Members through a one-time
   local data conversion (Slice 9), separate from product commands.
2. Carrying existing costume variants into one "Main" Look per Cast Member,
   with empty scene lists, until the skill is re-run (Slice 2 migration).

Changed during implementation (2026-10-23):

- **Ids use the `cast_look_`, `cast_costume_` and `casting_round_` prefixes.**
- **The casting resource lists the Cast Member's character sheets once**
  (`characterSheets`), not per costume. A sheet does not record which costume
  it was generated for, and any of them can be picked for a costume.
- **A fourth Studio route picks a costume's sheet**
  (`PUT /cast/:id/costumes/:costumeId/selected-sheet/:assetFileId`), so Claude
  Code users can pick sheets in the Casting tab.
- **`castMember.delete` also refuses while the Cast Member has Looks or
  Cast Voices**, because both are foreign-key dependents.
- **The round and board open as a Codex side panel** (fullscreen display
  mode), not inline. Inline, the long model list and live-arriving
  candidates made the chat jump (user feedback, 2026-10-23).
- **One model card per model, with a provider menu.** Cards list the providers
  with saved keys that offer the model, the image lane's provider first.
- **The round reuses the generation estimator.** Codex prices every offered
  model/provider from its Default Model List route at the route's defaults
  (plan 0243, ADR 0128); the agent prepares no requests. Each option retains
  `GenerationCostEstimate` unchanged; Core aggregates the total for both Codex
  and React, and Studio uses its shared estimate view for warnings and sources.
- **Each candidate records its round route's model key** (`casting_candidate.model_key`,
  `media import --casting-model`), so tiles show which model made each
  candidate when a round uses several models. Core also checks the candidate
  status value at runtime.

## Review Attention

- **Estimate repair superseded on 2026-10-24:** the required
  `estimateRequests` input is removed; plan 0243 prices offered routes from the
  Default Model List instead.
- **Scope correction confirmed on 2026-10-24:** Big Fish consolidation is a
  one-time local data conversion, not a reusable product feature. No merge
  operation is exposed through Core, CLI or skills. Screenplay-to-cast skills
  resolve cues to people before creating cast and use Looks for age changes.
- **Estimate correction approved on 2026-10-24:** casting uses the existing
  estimate envelope; Core's browser-safe `estimateCastingRoundCost` is the sole
  casting aggregation entrypoint. Plan 0243 later reintroduced the Default
  Model List route per provider so casting prices need no agent preparation.
- **Behavior beyond the literal request, and why it is needed:**
  - **Cast Looks** (`cast_look`) become a stored domain concept. Casting
    "per age or per significant physique change" needs somewhere to keep the
    scenes each Look covers and who was cast for it.
  - **Costumes move out of Cast Design** into `cast_costume` records with
    scene lists.
    - Today `costume.variants[]` holds only labels inside one versioned design
      document. Sintel's five variants say `project` scope and keep the scene
      numbers in the wardrobe text, and nothing reads the scene lists.
    - A costume needs a stable id so that a sheet can be picked for it.
    - `CastDesignScope` and `costume.variants` are deleted from the Cast Design
      contract. `costume.baseWardrobeLogic` stays.
  - **Character sheets become selectable per costume.** This reverses the
    rule in ADR 0064 and in the skill ("never create a global Character Sheet
    selection"), but only for the new `castCostume` selection scope. Without a
    picked sheet, the wardrobe plan cannot change anything downstream.
  - **`cast.character-sheet` targets a costume** (`costume:<id>`) instead of a
    Cast Member. Every sheet then knows its Look and costume. A one-costume
    character gets a "Main" Look and a "Main" costume from the skill.
  - **One casting round is confirmed once.** ADR 0118 confirms each generation
    through a review Submit. The Casting round panel is the review for all of
    its candidates: models, counts, brief and estimate. Consuming its Generate
    confirms the round. Claude Code confirms the round in chat text, as the
    text fallback already does.
  - **`castMember.delete` also refuses when any Scene Beats revision names the
    Cast Member.** This closes the dangling-id gap found above.
  - **Character arc changes that follow from the rule:**
    - `characterArcReference` (the shared arc), `CHARACTER_ARC_REFERENCE_IN_USE`
      and the Arc tab's "Shared with …" view are deleted. They existed only for
      age variants.
    - The turning point field `lookAssetFileId` is renamed
      `characterSheetAssetFileId`, so "look" means only a Cast Look. Sintel
      uses it on two Cast Members.
- **New or changed contracts:**
  - Tables `cast_look`, `cast_look_scene`, `cast_costume`,
    `cast_costume_scene`, `casting_round` and `casting_candidate`.
  - Documents `castLooksPlan`, `castWardrobePlan` and `castingRoundCreate`.
  - CLI:
    - `renku cast looks show|validate|write`;
    - `renku cast wardrobe show|validate|write`;
    - `renku cast casting round create|show`;
    - `renku cast casting candidate status`;
    - `renku settings casting show|set`.
  - New selection targets `look:<id>` (picks a `casting_candidate`) and
    `costume:<id>` (picks a `character_sheet`), through the existing
    `renku asset select` and `renku media import --select`.
  - Media:
    - new purpose `cast.casting-candidate` (lane `image`, target
      `castingRound`);
    - new asset file type `casting_candidate`;
    - `cast.character-sheet` target kind changes to `castCostume`.
  - Codex panel families `casting-round`, `casting-board` and
    `casting-wardrobe`, with tools `casting.round.open|respond|consume`,
    `casting.board.open|act|request|consume` and
    `casting.wardrobe.open|respond|consume`.
  - Project Settings v8 adds `casting.routes`.
  - Studio:
    - Casting tab on the Cast Member page;
    - routes `GET /cast/:id/casting`,
      `PUT /cast/:id/casting/candidates/:assetFileId/status` and
      `PUT /cast/:id/looks/:lookId/selected-candidate/:assetFileId`.
  - Diagnostics prefixed `CASTING_`, listed under Contracts.
- **Migrations and data changes (one custom Drizzle migration, documented):**
  - Copy each active Cast Design's `costume.variants` into `cast_costume`
    under one new "Main" Look per Cast Member, with no scenes.
  - Strip `costume.variants` from every Cast Design revision.
  - Null every `characterArcReference` arc.
  - Rename `lookAssetFileId` in stored arcs.
  - Raise Project Settings to v8 with `casting.routes: []`.
  - Local data affected:
    - Urban Basilica: 14 variants on 6 Cast Members;
    - Sintel: 15 variants on 3 Cast Members, plus 2 arcs with turning point
      sheets;
    - Big Fish: 2 reference arcs.
  - Big Fish's three age variants require a separate one-time local
    conversion in Slice 9, verified on a database copy before changing the
    original. It is not part of routine skill execution or the migration.
- **Deliberately unchanged:**
  - The Settings screen gets no casting control.
  - Character sheet layout and QA rules.
  - `cast.profile` and voice work.
  - Shot Plan storage, which holds no cast ids.
  - Engines: per-route estimates already exist.
  - Old screenplay revision snapshots keep their historical speaker ids.
  - Generation provenance stays historical.
  - The Route Chooser stays for single generations. It is skipped for casting
    rounds, because the round panel chooses the models.
- **Assumptions that change the result:**
  - A candidate's cost is the Engines estimate for one image on that route,
    times the count, using the purpose's fixed output guidance (4:3).
  - Shortlist and hidden state is durable, so it survives in Studio's
    Casting tab.
  - Before Big Fish's one-time conversion, inspect source-owned assets,
    designs, voices, Looks, arcs and every revision referencing those ids.

## Summary

Directors cannot audition looks today. The only way to see a character is a
Character Sheet: a layout tuned for video-model consistency, made one at a
time on one model. Costume variants are free text inside Cast Design, so
nothing knows which costume a scene uses.

This plan adds casting before character sheets:

1. **Looks.** The agent proposes one Look per age or physique change, with
   the scenes each covers, and the director approves them in a panel.
2. **Casting rounds.** For one Look, the director picks image models with
   per-model counts, sees the estimated cost, and sends the round. The agent
   generates candidates in parallel batches with the normal media skills.
3. **Casting board.** Candidates appear as each one lands. The director
   shortlists, hides, compares, asks for more like the shortlist (a new
   round with references) or casts one. Casting selects the candidate for
   the Look.
4. **Wardrobe plan.** Costumes with scene lists, grouped by Look, approved
   in a panel.
5. **Character sheets per costume.** These are generated from the Look's
   cast candidate, and one sheet is picked per costume. Shots use the
   scene's costume sheet as the first suggestion.

The director stays in conversation with the agent throughout. Panels only
show, collect choices and post neutral messages. Durable picks such as
shortlist, hide, cast and saving defaults go through core.

## Context

- ADRs:
  - ADR 0041: AI artifacts and prompts are opaque. Candidate images and
    briefs are never inspected.
  - ADR 0049: request-scoped generation reference choices.
  - ADR 0064: exclusive asset membership and scoped selection.
  - ADR 0114: model knowledge stays in Skill data.
  - ADR 0115: lanes.
  - ADR 0117: cached prices and estimates.
  - ADR 0118: confirmation versus host approval.
  - ADR 0125: character arcs.
  - ADR 0126: agent requests in empty states.
- Plans:
  - 0228 (model-neutral panels) and 0229 (lanes, Route Chooser, review);
  - 0239 (Cast details layout), 0240 (character arcs) and 0241 (guided empty
    states).
- Architecture docs:
  - `docs/architecture/json-storage-validation.md`;
  - `docs/architecture/reference/drizzle-migrations.md` (custom migration via
    `drizzle-kit generate --custom`);
  - `docs/architecture/naming-guidelines.md`;
  - `docs/architecture/coding-practices.md`;
  - `docs/architecture/reference/front-end-guidelines.md`.
- Code anchors:
  - `packages/core/src/client/media-attachments.ts` (purpose and target
    registries);
  - `client/generation-lanes.ts`;
  - `server/media-generation-context/purpose-registry.ts` and `purposes/cast.ts`;
  - `server/generation/attachment-destinations.ts`;
  - `server/project-asset-files/destinations/cast.ts`;
  - `server/asset-files/selection.ts` and `selection-targets.ts`;
  - `server/media-generation-context/reference-suggestions.ts`;
  - `client/department-design.ts` and `department-design-json-schemas.ts`;
  - `server/commands/cast-commands.ts`;
  - `client/character-arcs/`, `server/character-arcs/`;
  - `client/project-settings.ts`, `server/project-settings/document.ts`;
  - `packages/codex/src/route-choice/` (the closest panel family) and
    `panel-sessions/`;
  - `packages/studio/src/features/codex-route-chooser/`;
  - `features/movie-studio/cast/cast-member-panel.tsx`.
- Projects:
  - Sintel (`~/renku-movies/sintel`): the worked example;
  - Urban Basilica: costume carry-over;
  - Big Fish: the separate one-time age-variant conversion.
- Skills (`~/Projects/aitinkerbox/studio-skills`):
  - `casting-director`;
  - `media-producer` (`cast-character-sheets.md`, `route-choice.md`,
    `generation-review-routing.md`);
  - `screenplay-analyst` (arcs);
  - `screenplay-supporting-material-importer` and the FDX import guidance in
    `casting-director` (alias questions).

## Product Behavior

### Looks

- A Cast Member has one or more Looks, in order. Each Look has a name, an
  optional one-line description, and the scenes it covers.
- A scene belongs to at most one Look of a Cast Member.
- One person is one Cast Member. When a screenplay writes two cues for one
  person (YOUNG EDWARD, EDWARD), the skill still asks the user whether they
  are the same person. If yes, both cues are speaker references to the one
  Cast Member, and the scene's Look tells the ages apart.
- A Look is "cast" when it has a selected `casting_candidate`.
- A later Look's round can use an earlier Look's cast candidate as its
  identity reference. The skill always offers this.

### Casting round panel (Codex, side panel)

The agent opens it with `casting.round.open`. It shows:

- the Look name and round number;
- the brief as display lines supplied by the agent (opaque, not stored);
- the identity references as thumbnails, for a later Look or "more like the
  shortlist";
- the total candidates stepper. The total splits evenly across ticked
  models, and each ticked card has its own counter. Changing a counter
  updates the total;
- model cards from the Default Model List image lane, for providers with a
  saved key. Each card shows the model name, provider label, price per image
  (or "ChatGPT plan" for Codex built-in), and the strength note the agent
  passes from the Skill;
- "Run N at a time": the image lane's `maxConcurrentGenerations`;
- the estimated total with a per-model breakdown;
- "Save these models and counts as this project's casting defaults";
- Cancel, and "Ask agent to generate N".

The panel opens preselected from `casting.routes`. When that is empty, it
uses the image lane default model with the whole count.

Respond posts a neutral message:

`Casting round ready · Sintel · Young · 10 candidates on 3 models, 4 at a time · estimated $0.67. Round panel <id>. Consume it with casting.round.consume once.`

The panel writes casting defaults only when the save box is ticked. The
consume result is the round plan, and it confirms the round. The agent then
runs `renku cast casting round create`, then generates the candidates and
imports each one as soon as it finishes.

### Casting board panel (Codex, side panel)

`casting.board.open { mode: 'candidates', lookId }` shows:

- every round for the Look, newest first;
- a progress bar while candidates are pending (expected count minus
  imported);
- tiles with the model name, ★ shortlist and ✕ hide;
- tabs: All, Shortlist and Hidden;
- Compare, which lays the shortlist out side by side;
- a notes field;
- "More like the shortlist", and "Cast this Look" (enabled with exactly one
  selected).

The panel polls every 2 s, using the existing panel session hook, so tiles
fill in as the agent imports candidates. Durable actions go through core and
post no message:

- ★ and ✕ call `casting.board.act`, which sets the candidate status;
- Cast calls `casting.board.act`, which selects the candidate for the Look,
  then posts:
  `Look cast · Sintel · Young · candidate from round 1 (Nano Banana). Board <id>. Consume it with casting.board.consume once.`

"More like the shortlist" calls `casting.board.request`. It posts
`More candidates requested · Sintel · Young · 2 shortlisted · notes. Board <id> …`.
Its consume result carries the shortlisted asset file ids and the notes, so
the agent opens a new round panel with them as references.

`casting.board.open { mode: 'sheets', castMemberId }` shows one row per
costume:

- the costume name, its scenes, and the Look it is made from;
- the costume's character sheets, with the picked one marked;
- clicking a sheet picks it through `casting.board.act`, selecting the sheet
  for the costume;
- "Send picks to agent" posts a neutral message.

### Looks and wardrobe panel (Codex, inline)

`casting.wardrobe.open { mode: 'looks' | 'costumes', castMemberId, draft }`
shows a scene strip with one cell per scene in screenplay order:

- `looks` mode adds the Look band and Look cards. Clicking a scene moves it
  to another Look.
- `costumes` mode adds the Costume band under the Look band, plus the
  costume list (name, scenes, wardrobe summary, sheet status). Clicking a
  costume cell picks a costume of that scene's Look.

Renaming, adding or splitting happens in chat. The panel never writes.
"Use these Looks" or "Send plan to agent" posts a neutral message, and
consume returns the edited `castLooksPlan` or `castWardrobePlan` draft. The
agent validates it and writes it with the CLI.

### Studio Casting tab

A new tab on the Cast Member page, between Arc and Assets.

- **Looks row:** each Look's cast candidate, scenes, round count, model, and
  costumes with picked sheet counts.
- **Wardrobe by scene:** the same strip as the panel.
- **Casting rounds per Look:** thumbnails, with the cast one marked. Each
  round shows its number, models, candidate count and estimate.
- **Sheets per costume.**
- Shortlist, hide and Cast buttons on candidates call the Studio routes,
  which call core. The tab works the same in every harness. In Codex the
  board is usually used in the Codex side panel instead.
- **"More like the shortlist"** and every empty state use `AgentRequest`
  (ADR 0126). Examples: "Cast Sintel", "Plan Sintel's wardrobe", "Make
  Sintel's character sheets".

### Claude Code

- No inline panels. Rounds are set up in chat text: models, counts,
  estimate.
- The user's reply confirms the round, through the existing text fallback.
- The agent points the user to the Casting tab for picking.

## Worked Examples

### Sintel: Looks plan the skill writes

```json
{
  "kind": "castLooksPlan",
  "castMemberId": "cast_4e2h4dhp",
  "looks": [
    {
      "name": "Young",
      "description": "About 16, slender and agile, 165 cm.",
      "sceneIds": ["scene_3ebdfaf930d2bb0587486069", "scene_47fd28d51f94ba4e99c68055",
        "scene_c2018e848fe91fa152c1c1e4", "scene_56f0472a8da80437adb0455e",
        "scene_c3ddaec8fb89ccdb4cae6179", "scene_b09056143b94a209c75598d4"]
    },
    {
      "name": "Fifteen years later",
      "description": "White hair, scars, muscular, burnt left forearm.",
      "sceneIds": ["scene_f912398add0de3ec344a70a6", "scene_4911f595eedd6ab463941ca6",
        "scene_60fd4a8d694d0ad9dd377219", "scene_70a282c0da4b8f19b52072dd",
        "scene_8132dabebe529f6c2936ec3f", "scene_a516ad4c195e2c39006400dc",
        "scene_f8e4a3c070994a50da694269", "scene_6a123467a45b96778a423adf"]
    }
  ]
}
```

After the migration, Sintel has one "Main" Look holding her five costumes.
This plan renames "Main" to "Young" by passing its id, and adds "Fifteen years
later". Moving the three older costumes to the new Look is a wardrobe plan
write that follows it.

### Sintel: casting round document

```json
{
  "kind": "castingRoundCreate",
  "lookId": "look_2k9d",
  "routes": [
    { "provider": "fal-ai", "model": { "key": "seedream-5.0-pro", "name": "Seedream 5.0 Pro" }, "count": 4 },
    { "provider": "fal-ai", "model": { "key": "nano-banana", "name": "Nano Banana" }, "count": 3 },
    { "provider": "fal-ai", "model": { "key": "gpt-image-2", "name": "GPT Image 2" }, "count": 3 }
  ],
  "maxConcurrentGenerations": 4,
  "referenceAssetFileIds": [],
  "estimatedCost": { "amount": 0.67, "currency": "USD" }
}
```

Each candidate is generated with purpose `cast.casting-candidate`, target
`casting-round:round_7k2p`, and imported with
`renku media import --purpose cast.casting-candidate --target casting-round:round_7k2p --casting-model seedream-5.0-pro …`.
Each candidate records which round route made it, so the board shows its model.
Casting is `renku asset select --project sintel --target look:look_2k9d --asset-file asset_file_…`.

### Sintel: wardrobe plan

```json
{
  "kind": "castWardrobePlan",
  "castMemberId": "cast_4e2h4dhp",
  "costumes": [
    { "id": "costume_a1", "name": "Young Ishtar survivor", "lookId": "look_2k9d",
      "wardrobe": ["Plain worn leather separates, practical leather boots and belt; no cloak, armour or backpack."],
      "continuityNotes": [], "sceneIds": ["<scenes 3–6>"] },
    { "id": "costume_a2", "name": "Cloaked departure", "lookId": "look_2k9d",
      "wardrobe": ["Same leather base with a plain weathered cloak."], "continuityNotes": [], "sceneIds": ["<scenes 7–8>"] },
    { "id": "costume_a3", "name": "Quest hunter", "lookId": "look_8f1c",
      "wardrobe": ["Heavy hooded cloak, backpack, repaired leather layers, tool belts; dirt and wear increase."],
      "continuityNotes": ["Hood conceals age before recognition."], "sceneIds": ["<scenes 1–2, 9–12>"] },
    { "id": "costume_a4", "name": "Fifteen-year reveal", "lookId": "look_8f1c", "wardrobe": ["…"], "continuityNotes": [], "sceneIds": ["<scene 13>"] },
    { "id": "costume_a5", "name": "Aftermath", "lookId": "look_8f1c", "wardrobe": ["…"], "continuityNotes": [], "sceneIds": ["<scene 14>"] }
  ]
}
```

A sheet for "Fifteen-year reveal" is generated with target `costume:costume_a4`.
Its generation context offers the Look's cast candidate as the identity
reference. Picking a sheet is `renku asset select --project sintel --target costume:costume_a4 --asset-file asset_file_…`.
A shot in scene 13 then lists that sheet first in Sintel's `cast-continuity`
suggestion, with `isWorkflowSelected: true`. Her other sheets follow as
candidates.

### Big Fish: one-time local conversion

Consolidate Young Edward Bloom, Young Will Bloom and Young Dr. Bennett into
their existing person identities through a separate project-specific data
conversion. This is not a public command or a reusable skill workflow.

Inspect the actual database first, back it up, and verify the conversion on
a copy. Preserve the age-specific facts in Looks and explicitly assign Scene
coverage; never silently discard overlapping coverage. Account for all
dependent references before removing duplicate Cast Members. Only change the
original after the copy passes integrity and domain checks. Record the local
conversion outcome separately from product implementation.

## Architecture Shape Gate

### Ownership

- **Core:** all casting rules. That covers Look and costume scene
  coverage, round creation, candidate status, the selection scopes, the
  generation context, reference suggestions and the settings
  shape, plus aggregation of existing Engines estimates by candidate count.
- **CLI:** thin handlers that parse files and flags, call core and format
  the result.
- **Codex:** the panel session state, tools and resources. Respond tools
  write only through `createProjectDataService()` methods that core owns.
- **Studio server:** three thin routes.
- **Studio React:** projection consumers that send user intent.
- **Engines:** unchanged.
- **Skills:** casting judgement, briefs, model strength notes and the
  candidate layout guidance.

### File layout

Core (`packages/core/src`):

- `client/casting/model.ts`: `CastLook`, `CastCostume`, `CastingRound`,
  `CastingCandidate`, `CastingCandidateStatus`, `CastLooksPlanDocument`,
  `CastWardrobePlanDocument`, `CastingRoundCreateDocument`,
  `CastCastingResource`.
- `client/casting/schemas.ts`: the JSON Schemas for the three documents and
  for `casting.routes`.
- `client/casting/cost-estimate.ts`: `CastingProviderEstimate`,
  `CastingModelEstimate`, `CastingRoundCostEstimate` and
  `estimateCastingRoundCost`. This pure aggregation module owns count
  multiplication, rounding, unknown totals and host-plan-only summaries;
  it never reads provider prices or native request fields. Codex and React
  call it directly. Their adapters must not repeat this calculation.
- `server/schema/casting.ts`: the six tables.
- `server/casting/looks/`:
  - `validate.ts` (scene ids exist, no scene in two Looks, unique names, a
    removed Look has no costumes or rounds);
  - `write.ts`;
  - `projection.ts`.
- `server/casting/wardrobe/`:
  - `validate.ts` (costume scenes are within the Look's scenes, one costume
    per scene per Cast Member, unique names);
  - `write.ts` (clears the sheet selection of removed costumes and reports
    it);
  - `projection.ts`;
  - `scene-costume.ts` (finds a Cast Member's costume for a scene).
- `server/casting/rounds/`:
  - `create.ts` (allocates the round number per Look, checks that reference
    files belong to the Cast Member);
  - `candidate-status.ts`;
  - `projection.ts` (rounds, candidates and pending counts).
- `server/casting/resource.ts`: `readCastCastingResource`, composed from the
  three projections.
- `server/casting/defaults.ts`: reads and writes `casting.routes`.
- `server/media-generation-context/purposes/casting-round.ts`: the builder
  for `cast.casting-candidate`.
- `purposes/cast.ts`: the sheet builder switches to the `castCostume` target
  (costume, Look, cast candidate reference).
- The bounded registries gain one entry each:
  - `media-attachments.ts`, `generation-lanes.ts` and `purpose-registry.ts`;
  - `attachment-destinations.ts` (the casting candidate destination also
    inserts the `casting_candidate` row);
  - `project-asset-files/destinations/cast.ts` (the `cast/<handle>/casting/`
    folder);
  - `asset-files/selection.ts` (`castLook: 'casting_candidate'`,
    `castCostume: 'character_sheet'`) and `selection-targets.ts`.
- `server/commands/cast-commands.ts`: the operation `if` chain becomes a
  typed `Record<CastOperation['operation'], CastOperationHandler>`, with
  handlers in `server/commands/cast-operations/{create,update,delete}.ts`.
  The file shrinks to the transaction and dispatch.

CLI (`packages/cli/src/commands`):

- `cast-looks-command.ts`, `cast-wardrobe-command.ts` and
  `cast-casting/{round,candidate}.ts`, registered from `cast-command.ts`.
- `project-settings/casting-command.ts`.
- `media-purpose.ts` and `asset-file/parsing.ts` gain the target and
  selection syntax `casting-round:`, `costume:` and `look:`.

Codex (`packages/codex/src`):

- `casting-round/`: contracts, schemas, opening (builds options from the
  Default Model List image lane, credentials and the per-image estimates),
  tools, resources, choice-state, diagnostics, index.
- `casting-board/`: contracts, schemas, opening, tools, resources,
  candidate-actions, sheet-actions, session-projection, diagnostics, index.
- `casting-wardrobe/`: contracts, schemas, opening, draft-validation (shape
  only; core validates on write), tools, resources, session-state,
  diagnostics, index.
- Each family is registered in `server.ts`, and its HTML entry is added in
  `packages/studio/vite.codex.config.ts` and the CLI MCP command.

Studio (`packages/studio`):

- `src/features/codex-casting-round/`, `codex-casting-board/` and
  `codex-casting-wardrobe/` hold the panel apps.
- `src/features/casting-views/` holds `scene-strip.tsx`, `candidate-tile.tsx`
  and `look-card.tsx`. Panels and the Casting tab share them.
- `src/features/movie-studio/cast/casting/` holds `cast-member-casting-tab.tsx`,
  `casting-rounds.tsx`, `costume-sheets.tsx` and `use-cast-casting.ts`.
- `src/services/studio-cast-casting-api.ts`.
- `server/routes/cast-casting.ts`.

Skills (`studio-skills/skills`):

- `casting-director`: `references/looks.md`, `references/casting-rounds.md`
  and `references/wardrobe-plan.md`; updates to `SKILL.md`,
  `cast-design.md` and `cast-media-handoff.md`.
- `media-producer`: `references/cast-casting-candidate.md`; updates to
  `cast-character-sheets.md`, `route-choice.md` and
  `generation-review-routing.md`.
- `screenplay-analyst`: update the arc guidance.

### Bounded branches

- Purpose, target and selection registries are `Record` maps that gain one
  entry each.
- Board modes: two focused files, chosen by one map in
  `casting-board/opening.ts`.
- Wardrobe modes: two draft shapes, one validator each.
- Cast operations: the typed handler record.

### Forbidden shapes

- Model ids, provider ids or prices in Codex, Studio, CLI or Core. The only
  exceptions are echoing a Skill key back and displaying an Engines
  estimate.
- A "casting model family" enum, or per-model panel code.
- Parsing or validating brief text or candidate images.
- Panel respond tools writing Looks or wardrobe plans. The agent writes
  them.
- Studio routes or React deciding scene coverage, costume membership or
  candidate eligibility.
- One `casting.ts` holding all rules, or a growing `if` chain on modes or
  operations.

### Stop conditions

- Any casting file passes ~300 lines or mixes validation with persistence.
- A panel family needs a model branch.
- The local Big Fish conversion requires broader data changes than the
  inspected age variants and their references. Stop and review that scope.
- The reference suggestion change needs Shot Plan storage changes.

## Contracts

### Tables

| Table | Columns |
|---|---|
| `cast_look` | `id` (`look_…`), `cast_member_id` FK, `name`, `description` nullable, `position`, timestamps. Unique (`cast_member_id`, `name`). |
| `cast_look_scene` | `cast_member_id` FK, `cast_look_id` FK, `scene_id` FK. Unique (`cast_member_id`, `scene_id`). |
| `cast_costume` | `id` (`costume_…`), `cast_member_id` FK, `cast_look_id` FK, `name`, `wardrobe_json` (string[]), `continuity_notes_json` (string[]), `position`, timestamps. Unique (`cast_member_id`, `name`). |
| `cast_costume_scene` | `cast_member_id` FK, `cast_costume_id` FK, `scene_id` FK. Unique (`cast_member_id`, `scene_id`). |
| `casting_round` | `id` (`round_…`), `cast_look_id` FK, `number`, `routes_json`, `max_concurrent_generations`, `reference_asset_file_ids_json`, `estimated_cost_json` nullable, `created_at`. Unique (`cast_look_id`, `number`). |
| `casting_candidate` | `asset_file_id` PK FK, `casting_round_id` FK, `status` (`candidate`, `shortlisted`, `hidden`). |

JSON columns get JSON Schemas and AJV validation on write and read.

### Documents

- `castLooksPlan`: `{ castMemberId, looks: [{ id?, name, description?, sceneIds }] }`.
  It replaces the Cast Member's Looks. A listed `id` keeps the row. An
  omitted existing Look is removed only when it has no costumes, rounds or
  selection.
- `castWardrobePlan`: `{ castMemberId, costumes: [{ id?, name, lookId, wardrobe, continuityNotes, sceneIds }] }`.
  It replaces the Cast Member's costumes.
- `castingRoundCreate`: shown in Worked Examples.
- Cast Design loses `costume.variants`. `CastDesignScope` is deleted.

### Media

- `MediaPurpose` gains `'cast.casting-candidate'`:
  - target `{ kind: 'castingRound'; id }`;
  - output `image`;
  - lane `image`;
  - output guidance: aspect ratio 4:3, standard quality.
- `cast.character-sheet` target becomes `{ kind: 'castCostume'; id }`.
- `AssetFileSelectionTarget` gains `{ kind: 'castLook'; id }` and
  `{ kind: 'castCostume'; id }`. Both are owned by the Look's or costume's
  Cast Member.
- Asset file type `casting_candidate`, destination kind
  `cast.castingCandidate`.

### CLI

```text
renku cast looks show --cast <id> --json
renku cast looks validate|write --file <castLooksPlan.json> --json
renku cast wardrobe show --cast <id> --json
renku cast wardrobe validate|write --file <castWardrobePlan.json> --json
renku cast casting round create --file <castingRoundCreate.json> --json
renku cast casting show --look <id> --json
renku cast casting candidate status --asset-file <id> --status candidate|shortlisted|hidden --json
renku settings casting show --json
renku settings casting set --file <routes.json> --json
renku asset select --project <project> --target look:<id>|costume:<id> --asset-file <asset-file-id>
renku generation context --purpose cast.casting-candidate --target casting-round:<id>
renku generation context --purpose cast.character-sheet --target costume:<id>
```

### Codex tools

| Tool | Visibility | Purpose |
|---|---|---|
| `casting.round.open` | model | `{ project, lookId, brief: string[], notes?: { [modelKey]: string }, references?: string[], suggested?: routes }`. Codex prices each offered model/provider from its Default Model List route at the route's defaults. The agent ends its turn after calling it. |
| `casting.round.respond` | app | `{ panelId, choice: { kind: 'generate', routes, maxConcurrentGenerations } \| { kind: 'canceled' }, saveAsCastingDefaults }` |
| `casting.round.consume` | model | Returns `generate` (confirmed plan), `canceled` or `alreadyConsumed`. |
| `casting.board.open` | model | `{ project, mode: 'candidates', lookId }` or `{ project, mode: 'sheets', castMemberId }` |
| `casting.board.act` | app | `{ sessionId, action }`: `shortlist`, `hide`, `restore`, `cast` and `pickSheet`, written through core |
| `casting.board.request` | app | `{ kind: 'moreLikeShortlist', notes }`, `{ kind: 'sheetPicksDone' }` |
| `casting.board.consume` | model | `{ sessionId }`; returns the last request once: shortlisted ids and notes, the cast candidate, or the picks. |
| `casting.wardrobe.open` | model | `{ project, mode, castMemberId, draft }` |
| `casting.wardrobe.respond` | app | `{ panelId, draft }` or canceled |
| `casting.wardrobe.consume` | model | Returns the edited draft once. |

### Settings

Project Settings v8 adds:

```json
"casting": { "routes": [{ "provider": "fal-ai", "model": { "key": "seedream-5.0-pro", "name": "Seedream 5.0 Pro" }, "count": 4 }] }
```

`routes` may be empty. Concurrency comes from the image lane.

### Studio routes

- `GET /api/projects/:p/cast/:id/casting` returns `CastCastingResource`.
- `PUT /api/projects/:p/cast/:id/casting/candidates/:assetFileId/status`
  with body `{ status }`.
- `PUT /api/projects/:p/cast/:id/looks/:lookId/selected-candidate/:assetFileId`.

### Diagnostics

- `CASTING_LOOK_SCENE_CONFLICT`
- `CASTING_LOOK_IN_USE`
- `CASTING_COSTUME_SCENE_OUTSIDE_LOOK`
- `CASTING_COSTUME_SCENE_CONFLICT`
- `CASTING_DUPLICATE_NAME`
- `CASTING_UNKNOWN_SCENE`
- `CASTING_ROUND_REFERENCE_NOT_OWNED`
- `CASTING_ROUND_ROUTES_EMPTY`
- `CASTING_CANDIDATE_NOT_FOUND`
- `PROJECT_DATA` gains a code for "Cast Member named by Scene Beats" on
  delete.

## Implementation Slices

1. **Contracts and schema.** Add the client model, the JSON Schemas and
   `server/schema/casting.ts`. Run
   `drizzle-kit generate` for the tables.
2. **Custom migration** (`drizzle-kit generate --custom`). Document it in the
   migration header and in `drizzle-migrations.md`:
   - Main Looks and costumes from the active Cast Design variants;
   - strip `costume.variants` from every revision;
   - null the reference arcs;
   - rename `lookAssetFileId`;
   - Settings v8.

   Verify on copies of the Urban Basilica, Sintel and Big Fish databases.
3. **Looks and wardrobe core and CLI.** Add the validators, writers and
   projections, the scene-costume lookup, and the CLI commands with
   dry-run-free validate and write. Delete `costume.variants` handling from
   Cast Design commands and summaries.
4. **Rounds, candidates, selection scopes and purpose.**
   - Round create and candidate status.
   - The `cast.casting-candidate` registries and builder.
   - The candidate destination with its `casting_candidate` row.
   - The `castLook` and `castCostume` selection.
   - The `castCostume` sheet target and context (identity reference
     suggestion from the Look's cast candidate).
   - Casting defaults.
5. **Reference suggestions.** `suggestSceneSubjectMedia` puts the scene
   costume's selected sheet first, marked workflow-selected.
6. **Cast operations and arcs.**
   - The typed handler record.
   - Delete refuses on Scene Beats references.
   - Remove `characterArcReference`, its error and its persistence, plus
     the resource `sharedWith` and the Arc tab's shared view.
   - Rename the turning point field everywhere.
7. **Codex panels.** Build the three families with tests that use fictional
   routes. Add the Studio panel apps and the shared `casting-views`. Inject
   the estimator as the generation review does.
8. **Studio Casting tab.** Add the routes, the service, the tab, and the
   `AgentRequest` empty states.
9. **Skills and local data:**
   - `casting-director` gets the Looks, rounds and wardrobe references, the
     "one person, one Cast Member" rule and the FDX alias wording.
   - `media-producer` gets the candidate layout guide, sheets per costume,
     rounds in route choice and review routing, and a casting strength table
     for image models.
   - `screenplay-analyst` gets the arc guidance.
   - Then, with the user's confirmation:
     1. perform the separate Big Fish one-time conversion on a verified copy
        before changing the original;
     2. re-run Casting Director on Sintel's Looks and wardrobe;
     3. assign scenes for Urban Basilica's costumes.
10. **Docs and ADR.** See Documentation.

## Tests And Guardrails

- **Core:**
  - Looks and wardrobe validation: every diagnostic, replacement
    semantics, and selection clearing.
  - Round numbering, and the reference ownership check.
  - Candidate import writes the asset and its candidate row in one
    transaction.
  - The selection scopes refuse wrong types and wrong owners.
  - The sheet context for a costume lists the Look's cast candidate.
  - The reference suggestion orders the scene costume's sheet first.
  - Delete refuses on Scene Beats.
  - Migration tests on fixture databases.
- **CLI:** parsing for the new targets and commands; handlers stay thin
  (the existing command architecture test).
- **Codex:**
  - Session state, consume-once and app-only respond for each family.
  - Board act writes go through the data service.
  - Fictional routes only.
  - `architecture.test.ts` import rules hold.
- **Studio:**
  - Panel components: split math, totals, disabled Cast, tile states.
  - Casting tab rendering.
  - Thin route tests.
  - shadcn controls only.
- **Static guardrails:** no new architecture tests that name helpers. The
  existing import-boundary tests cover the packages.

## Documentation

- New ADR `docs/decisions/0127-cast-looks-costumes-and-casting-rounds.md`.
  It covers:
  - one person, one Cast Member;
  - Looks and costumes as records;
  - per-costume sheet selection, which supersedes that part of ADR 0064;
  - round-level confirmation, which updates ADR 0118;
  - removing shared arcs, which updates ADR 0125.
- `docs/architecture/data-model-and-storage.md`: the new vocabulary (Cast
  Look, Cast Costume, Casting Round, Casting Candidate).
- `docs/architecture/media-generation.md`: the purposes and targets.
- `docs/architecture/reference/drizzle-migrations.md`: the custom migration
  note.
- CLI reference docs for the new commands.
- Skill docs in Slice 9.
- Plan 0240 is historical and is not edited.

## Final Verification

- `pnpm build`, `pnpm test`, `pnpm lint` and `pnpm check`.
- `renku project migrate` on copies, then the real local Urban Basilica,
  Sintel and Big Fish databases. Inspect the resulting costumes, Looks,
  arcs and settings.
- In Codex Desktop, run the Sintel flow end to end with cheap routes:
  1. Looks panel;
  2. round panel with a two-model split and the estimate;
  3. live board fill-in;
  4. shortlist and cast;
  5. wardrobe panel;
  6. sheets board pick.
- Check the Casting tab in Studio on desktop.
- In Claude Code, set up a text round and cast from the Casting tab.
- Architecture-shape review:
  - `git diff --stat`;
  - inspect `cast-commands.ts`, which should shrink;
  - inspect the new casting folders, each under its size stop;
  - confirm `index.ts` files are thin;
  - confirm no model ids outside Engines and Skills.

## Completion Checklist

### Review Area

- [ ] The user confirmed the Big Fish removals and the costume carry-over.
- [ ] Core owns every casting rule. Server, CLI, Codex and React stay thin.
- [ ] The file layout matches the Architecture Shape Gate. No god file and
      no growing dispatcher.
- [ ] No model, provider or price knowledge in Codex, Studio, CLI or Core.

### Architecture And Contracts

- [ ] Six tables with JSON Schemas on the JSON columns.
- [ ] `castLooksPlan`, `castWardrobePlan` and `castingRoundCreate` documents
      validated in core.
- [ ] `cast.casting-candidate` registered in every purpose registry.
      `cast.character-sheet` targets `castCostume`.
- [ ] `castLook` and `castCostume` selection scopes.
- [ ] Project Settings v8 `casting.routes`.
- [ ] Cast Design `costume.variants` and `CastDesignScope` deleted with no
      aliases.
- [ ] `characterArcReference` deleted. `characterSheetAssetFileId` renamed
      everywhere.
- [ ] Structured `CASTING_` diagnostics, plus the delete-on-beats code.

### Implementation Slices

- [ ] Slice 1, contracts and schema.
- [ ] Slice 2, custom migration, documented and verified on copies.
- [ ] Slice 3, Looks and wardrobe core and CLI.
- [ ] Slice 4, rounds, candidates, selection, purpose and sheet target.
- [ ] Slice 5, reference suggestions.
- [ ] Slice 6, cast operations record, delete guard and arcs.
- [ ] Slice 7, the three Codex families and panel apps.
- [ ] Slice 8, Studio routes and the Casting tab.
- [ ] Slice 9, skills, then the local data runs.
- [ ] Slice 10, docs and ADR 0127.

### Tests And Guardrails

- [x] Require prepared estimate requests for every offered paid model/provider
      before opening the round; collect missing pairs before estimation and
      cover omitted input, partial coverage, host-plan bypass and genuine
      unavailable prices. Update the casting Skill contract and evals.
- [x] Remove the reusable merge operation, its write machinery and dedicated
      tests from the product contract; keep Scene Beats deletion protection.
- [x] Skills group screenplay cues by person before cast creation, reuse
      existing identities and put age changes in Looks.
- [ ] Verify Big Fish's one-time conversion on a copy and record the actual
      local database outcome separately.
- [x] Estimate regression checks cover prepared single-candidate requests,
      route batch defaults, unknown and zero prices, mixed host/provider rounds,
      picked providers, rounding, and preservation/display of warnings and sources.
- [x] Inspect the estimate diff: no duplicate total calculation, provider field
      knowledge or alternate estimate envelope in Codex or React. Casting indexes
      remain thin public entrypoints.
- [ ] Core behavior tests for every rule and diagnostic.
- [ ] Migration tests.
- [ ] Codex family tests with fictional routes.
- [ ] Studio panel and tab tests.
- [ ] Existing import-boundary and command-architecture tests pass
      unchanged.

### Documentation

- [ ] ADR 0127 accepted. ADRs 0064, 0118 and 0125 cross-referenced.
- [ ] Data model, media generation and migration docs updated.
- [ ] Skills updated in studio-skills.

### Final Verification

- [ ] Root build, test, lint and check pass.
- [ ] Local projects migrated and inspected.
- [ ] Codex end-to-end Sintel run and Claude Code text round done.
- [ ] `git diff --stat` reviewed. Large files inspected. `index.ts` files
      are thin.
- [ ] No checklist item satisfied by unreviewable structure.
