# 0241 Guided Empty States

Status: implemented
Date: 2026-10-22

## Decisions

The user approved the plan and all three open decisions on 2026-10-22: the
step status rules as listed, sidebar "Not started" for empty Cast, Locations,
Props and Screenplay, and the Project Library start cards using
`AgentRequest`.

Changed during implementation:

- **Video takes step.** Studio stores generated videos per Shot Plan, not
  per Shot Plan Clip, so the step counts active Shot Plans with at least one
  generated video. This matches what the Generations tab shows.
- **Location hero placeholder dropped.** Plan 0239 deliberately renders no
  image box when a Location has no hero. Adding one would have reversed that
  decision without approval, and the Location Assets tab already asks for a
  hero image.

## Review Attention

- **Behavior beyond the literal request, and why it is needed:**
  - A new core read model, the **Production Path**, plus one Studio server
    route. The Overview tab shows which production steps are done and which
    one is next. Deciding that is a project rule, so it belongs in core, not
    in React.
  - The director context's private readiness readers move into a shared core
    module, `production-readiness/`. The Production Path reuses them instead
    of copying their rules. The director context's output to agents stays
    the same.
  - `CastMemberCharacterArcSummary` replaces `null` with a `notWritten`
    variant that says whether the screenplay has been analyzed. The
    always-visible Arc tab needs this to show the right request.
  - The new shared `AgentRequest` component replaces
    `project-library/agent-prompt.tsx`. The Project Library start cards
    switch from a read-only textarea to the new request card. This rule
    forbids keeping both.
  - Dead code is deleted: the never-shown `EmptyAnalysisCallout` in
    `story-arc-chart.tsx` and `scenes/scene-beats-empty.tsx`.
- **New or changed contracts:**
  - `GET /api/projects/:projectName/production-path`.
  - Core client types `ProductionPathResource`, `ProductionPathStage`,
    `ProductionPathStageId` and `ProductionPathStageStatus`.
  - Project data service method `readProductionPathResource`.
  - `CastMemberCharacterArcSummary` gains `{ kind: 'notWritten' }`.
  - `LineTabsItem` gains an optional `pending` flag.
  - No schema, migration, CLI, Settings, or diagnostic code changes.
- **Reverses an accepted decision:** plan 0240 says "The Arc tab appears
  exactly when the Cast Member has one of the two." The Arc tab now always
  shows. The user approved this on 2026-10-22.
- **Deliberately unchanged:**
  - Option D (header Ask button and request library) is out, as the user
    decided on 2026-10-22.
  - The Settings → Screenplay Import switches are not offered at import
    time.
  - Director context JSON and `nextSteps` stay as they are.
  - Small dashed "No … yet" boxes inside asset sections stay. They get no
    request of their own.
  - The Inspiration "New Folder" header button stays.
- **Assumptions that change the result:** the status rules for each
  Production Path step (see Contracts). The Video takes step counts active
  Shot Plans with at least one generated video.
- **Needs explicit approval:**
  1. The status rules for each step.
  2. Changing sidebar counts of zero to "Not started" for Cast, Locations,
     Props and Screenplay.
  3. The Project Library start cards adopting the new request card.

## Summary

A new project hides most of what Studio can do. Almost every artifact is
made by asking the user's agent (Claude or Codex), but Studio never says so.

- Pages render blank grids or say "nothing yet" without saying how.
- The Cast Member Arc tab is invisible until a Screenplay Analysis exists.

The design study on 2026-10-22 audited 25 such places and proposed four
options. The user chose:

- **A · Quiet request** as the single empty-state pattern:
  - an icon, a title and one plain sentence;
  - one request written in the user's voice, with a Copy button;
  - at most two quieter extra requests.
- **B · Preview** on the two most visual pages. Screenplay Analysis and
  Scene Beats show a faint outline of the filled page behind the request.
- **C · Director's path:**
  - a new first tab on Project Details, **Overview**, lists the production
    steps with their status;
  - only the next step shows its request;
  - empty states that depend on earlier work name the missing step first.
- **The Arc tab always shows.** When there is no arc yet, it shows an
  Option A empty state.

Requests are Studio-owned interface copy. Studio never sends, parses or
checks them. They are filled in with names the page already shows, such as
the scene heading or the Cast Member's name. `[Bracketed]` words mark the
parts the user should edit.

## Context

- Design study canvas (private): "Studio Empty States". Boards A1, A2, B1,
  B2, C1 and C2 are accepted. Boards D1 and D2 are rejected.
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/decisions/0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
- `docs/decisions/0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`
- `docs/decisions/0030-use-unified-studio-resource-refresh-components.md`
  and `0054` (string resource keys).
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`. Requests are
  fixed copy and are never read back.
- `plans/active/0240-character-arcs.md` (Arc tab visibility, now changed).
- `packages/core/src/server/resources/director-context.ts`. It holds the
  readiness readers this plan shares.
- `packages/studio/src/features/project-library/project-library-starts.tsx`
  and `agent-prompt.tsx`, the existing request pattern.
- Real data:
  - `~/renku-movies/urban-basilica` (populated);
  - the local "Test" project (sparse: cast, but no analysis, beats or
    images).

## Product Behavior

### Option A pattern

`PanelEmptyState` is centred in the panel:

- an icon in a muted circle;
- a title, 18px semibold;
- one sentence in the muted colour;
- the primary `AgentRequest` card, with the kicker "Ask your agent", the
  request text and a Copy button;
- up to two `AgentRequestLine` rows, each with a copy icon;
- one footnote: "Paste into Claude or Codex. Studio updates while your agent
  works."

Copy places the request text on the clipboard exactly as shown, brackets
included. The button changes to "Copied" for 2 seconds. If copying fails,
it shows the existing error text.

### Surfaces

| Surface | Today | New title | Primary request | Extra requests |
|---|---|---|---|---|
| Cast overview, 0 members | blank grid | No cast yet | Cast the main characters from my screenplay. | Add `[character name]` to the cast. · Cast the characters and make a portrait for each one. |
| Locations overview, 0 | blank grid | No locations yet | Create the locations from my screenplay. | Add `[location]` as a location. |
| Props overview, 0 | blank grid | No props yet | List the props that matter for continuity in my screenplay. | — |
| Screenplay page, no scenes | "no generated beat images yet" | No screenplay yet | Import the Final Draft screenplay at `[full path to your .fdx file]`. | Write a one-page scene about `[your idea]`. |
| Screenplay page, scenes but no storyboards | same text | No storyboards yet | Design beats for every scene and draw a storyboard frame for each. | — |
| Screenplay Analysis, no analysis (**B**) | "No active screenplay analysis" | See the shape of your story | Analyze my screenplay. | — |
| Scene → Beats, none (**B**) | "No beat list yet." | Break this scene into beats | Design the beats for the scene "{heading}" and draw a storyboard frame for each. | Design beats for every scene. |
| Scene → Shot Plans, scene has no beats (**C**) | "No Shot Plans for this Scene." | Shot plans start from beats | Design the beats for "{heading}", then plan its shots. | Block this scene as a Blender previs. |
| Scene → Shot Plans, beats exist | same | No shot plans yet | Plan the shots for "{heading}". | Block this scene as a Blender previs. |
| Scene → Generations, no Shot Plans (**C**) | "No generated videos yet." | Video takes start from a shot plan | Plan the shots for "{heading}", then generate video takes. | — |
| Scene → Generations, Shot Plans exist | same | No video takes yet | Generate video takes for the shots in "{heading}". | — |
| Cast Member → Arc, not analyzed | tab hidden | {name}'s arc isn't written yet | Analyze my screenplay and write arcs for the main characters. | — |
| Cast Member → Arc, analyzed, no arc | tab hidden | {name}'s arc isn't written yet | Write a character arc for {name}. | — |
| Lookbook (Production / Storyboard), none | "has not been authored" | No production lookbook yet / No storyboard lookbook yet | Design a production lookbook from my inspiration. / Design a storyboard lookbook. | — |
| Inspiration, no folders | "Create an Inspiration folder…" | No inspiration yet | none: the header "New Folder" button is the action | — |
| Inspiration folder → Analysis, none | "Use the Renku skill to analyze this folder." | Not analyzed yet | Analyze my "{folder name}" inspiration images. | — |
| Project Covers, none | "No project covers yet." | No cover yet | Make a cover image for this project. | — |
| Location → 3D World, none | "has no selected 3D World yet." | No 3D world yet | Build a 3D world for {location}. | — |
| Shot Plan → Audio, none | "No audio yet." | No dialogue audio yet | Record the dialogue for this shot plan. | — |

Smaller inline additions use one `AgentRequestLine`, not a full empty state:

- **Project Info**, when Logline, Synopsis and Premise are all empty: "Write
  a logline, synopsis and premise from my screenplay."
- **Cast Member, Location and Prop Assets tabs**, when every section in the
  tab is empty:
  - Cast Member: "Make a portrait and a character sheet for {name}."
  - Location: "Make a hero image and a location sheet for {name}."
  - Prop: "Make a hero image and a prop sheet for {name}."
- Location Details keep plan 0239's behavior: no image box without a hero.

### Previews (Option B)

- **Story Arc preview:**
  - three faint act bands;
  - a dotted analysed curve and a dashed ideal curve;
  - a row of scene cadence blocks, one per actual scene;
  - drawn at 50% opacity with a radial fade behind the request.
  - It is decoration only (`aria-hidden`) and reads no analysis data. It does
    replace the "No active screenplay analysis" box.
- **Scene Beats preview:** six faint beat cards in the real three-column
  grid, each a 16:9 frame plus three text lines, behind the request.

### Arc tab

- The tab always appears between Details and Assets.
- When the summary is `notWritten`, the tab label shows a small hollow dot
  (`pending`), and the tab shows the Arc empty state above.
- Remove the fallback that silently switched a selected Arc tab back to
  Details.

### Overview tab (Option C)

Project Details gets a new first tab, **Overview**, which becomes the
default. It shows:

- the project title (36px, weight 800);
- one line: "From screenplay to finished clips. Each step is a request to
  your agent.";
- an ordered list of eight steps:

| Step | Plain description | Primary request |
|---|---|---|
| Screenplay | Imported or written. | Import the Final Draft screenplay at `[full path to your .fdx file]`. |
| Story analysis | Acts, turning points and an arc for each main character. | Analyze my screenplay. |
| Cast, locations and props | Who appears, where it happens, and what they handle. | Create the cast, locations and props from my screenplay. |
| Look of the film | Reference images and a lookbook your images follow. | Design a production lookbook and a storyboard lookbook. |
| Portraits and set images | How each character and place looks. | Make portraits for the cast and sheets for every location and prop. |
| Beats and storyboards | Each scene broken into moments, with a frame for each. | Design beats for every scene and draw a storyboard frame for each. |
| Shot plans | Camera coverage for each scene, or a 3D previs. | Plan the shots for every scene that has beats. |
| Video clips | Generated takes for every shot. | Generate video takes for the planned shots. |

Each step row shows:

- **A status mark:**
  - complete: a filled gold check;
  - next: a gold ring with a dot, plus a "Next" label;
  - started or not started: a grey ring.
- **The step's progress** on the right, when core supplies one, as
  "{done} of {total}". Screenplay shows the scene count as "{n} scenes".
- **The request:** only the next step shows its full `AgentRequest` card.
  Every other step that isn't complete has a quiet "Show request" button
  that expands the same card inline.

The footer line reads: Not sure? Ask "What should I do next on {title}?"

The Overview refreshes on any Studio resource change for the project, since
it summarises the whole project.

### Sidebar (Option C, needs approval)

When the count is zero, the Cast, Locations, Props and Screenplay section
details read "Not started" instead of "0 members", "0 locations", "0 props"
or "0 scenes". Visual Language and Analysis keep their fixed subtitles.

## Architecture Shape Gate

### Ownership

- **Core** (`packages/core`) owns:
  - Production Path statuses and order;
  - the shared readiness readers;
  - the Character Arc summary variant.
- **The Studio server** has one thin route. It reads the project name, calls
  `projectData.readProductionPathResource`, returns `{ resource }`, and
  translates errors with `projectErrorResponse`.
- **Studio React** owns presentation only:
  - layout and copy;
  - choosing which copy variant to show from data it already loads, such as
    "scene has beats", "summary is `notWritten`" or "count is 0";
  - the decorative previews.
- **Request copy** lives in one feature-level copy module, so the same
  request never drifts between surfaces.

### File layout

Core:

```text
packages/core/src/client/production-path.ts          types only
packages/core/src/server/production-readiness/
  cast.ts                 readCastReadiness (moved from director-context.ts)
  production-design.ts    readProductionDesignReadiness (moved)
  visual-language.ts      readVisualLanguageReadiness (moved)
packages/core/src/server/production-path/
  resource.ts             readProductionPathResource: opens session, runs the ordered stage readers, picks nextStageId
  stage-order.ts          the ordered array of { id, read } stage readers (bounded registry of 8)
  stages/screenplay.ts
  stages/screenplay-analysis.ts
  stages/cast-and-sets.ts
  stages/visual-language.ts
  stages/cast-and-set-visuals.ts
  stages/scene-beats.ts
  stages/shot-plans.ts
  stages/video-takes.ts
  stage-status.ts         statusFromProgress(done, total) shared helper
packages/core/src/server/database/access/
  scene-beats.ts          + countScenesWithActiveSceneBeats(session)
  shot-plans/plan-records.ts + countScenesWithShotPlans(session)
  shot-plans/plan-records.ts + listActiveShotPlanIds(session)
packages/core/src/server/shot-plan-video-generations/projection.ts
  + readShotPlanVideoCoverage(session) -> { shotPlansWithVideo, shotPlans }
```

`director-context.ts` imports the moved readers and keeps its own
`buildNextSteps` and diagnostics.

Studio server:

```text
packages/studio/server/routes/production-path.ts   (+ .test.ts)
```

It is registered beside `project-information.ts` in the route composition.

Studio browser:

```text
packages/studio/src/ui/agent-request.tsx          AgentRequest (card), AgentRequestLine (quiet row), AgentRequestHint (one line on a filled page); bracket highlighting
packages/studio/src/ui/panel-empty-state.tsx      PanelEmptyState: icon, title, description, request slots, optional preview + prerequisite slots, footnote
packages/studio/src/ui/step-chain.tsx             StepChain: 2–3 labelled steps joined by dashed lines; first incomplete step in gold
packages/studio/src/ui/line-tabs.tsx, line-tab-bar.tsx   + pending flag (hollow dot)
packages/studio/src/services/studio-production-path-api.ts   readProductionPath(projectName)
packages/studio/src/features/movie-studio/agent-request-copy.ts   named request builders, e.g. analyzeScreenplayRequest, sceneBeatsRequest(heading)
packages/studio/src/features/movie-studio/production-path/
  production-path-tab.tsx         loads + refreshes the resource, composes the list
  production-path-stage-row.tsx   one row: mark, title, description, progress, request toggle
  production-path-stage-copy.ts   lookup table stageId -> { title, description, request }
packages/studio/src/features/movie-studio/cast/cast-overview-empty-state.tsx
packages/studio/src/features/movie-studio/cast/arc/cast-member-arc-empty-state.tsx
packages/studio/src/features/movie-studio/locations/location-overview-empty-state.tsx
packages/studio/src/features/movie-studio/props/prop-overview-empty-state.tsx
packages/studio/src/features/movie-studio/screenplay/screenplay-beat-gallery-empty-state.tsx
packages/studio/src/features/movie-studio/story-arc/story-arc-preview.tsx
packages/studio/src/features/movie-studio/story-arc/story-arc-empty-state.tsx   chooses import-screenplay vs analyze
packages/studio/src/features/movie-studio/scenes/use-scene-has-beats.ts         used by the Shot Plans empty state
packages/studio/src/features/movie-studio/scenes/scene-beats-empty-state.tsx    (replaces scene-beats-empty.tsx)
packages/studio/src/features/movie-studio/scenes/scene-beats-preview.tsx
packages/studio/src/features/movie-studio/shot-plans/scene-shot-plans-empty-state.tsx
packages/studio/src/features/movie-studio/shot-plan-video-generations/scene-video-generations-empty-state.tsx
packages/studio/src/features/movie-studio/visual-language/lookbook-empty-state.tsx
```

Existing files gain only their call site:

- `inspiration-folders-panel.tsx`, `inspiration-analysis-tab.tsx`;
- `project-covers-tab.tsx`, `location-world-tab.tsx`,
  `shot-plan-dialogue-audio.tsx`;
- `project-information-panel.tsx`;
- the three asset tabs;
- `studio-sidebar.tsx`.

Deleted:

- `features/project-library/agent-prompt.tsx` and its test. Callers move to
  `ui/agent-request.tsx`.
- `features/movie-studio/scenes/scene-beats-empty.tsx`.
- `EmptyAnalysisCallout` and the old "No active screenplay analysis" box in
  `story-arc-chart.tsx`.

### Bounded branches

- **Production Path stages** form a fixed ordered array of eight readers in
  `stage-order.ts`. Each stage's rule lives in its own file. `resource.ts`
  never branches on stage id.
- **Overview copy** is a lookup table keyed by `ProductionPathStageId`. It is
  not a `switch` in JSX.
- **Two-variant empty states** (Shot Plans, Generations, Arc, Screenplay)
  choose a copy entry with one boolean, inside their own feature file. There
  are no nested ternaries.

### Forbidden shapes

- React computing step status, the next step, or "complete" from raw counts.
- Copying the director readiness rules into `production-path/`.
- One `empty-states.tsx` file that holds every surface's empty state.
- Raw `<button>` or `<textarea>` in feature code. Use `Button` and the new
  `ui/` components.
- Request text that names skills, CLI commands, providers or models.
- Studio code that reads, parses or checks the text of a request.

### Stop conditions

Stop and revise the plan if:

- a stage reader needs data from another stage's reader;
- `resource.ts` grows a branch per stage;
- `agent-request-copy.ts` starts holding logic beyond string builders;
- any empty state needs a new server field other than the Arc summary
  variant.

## Contracts

```ts
// packages/core/src/client/production-path.ts
export type ProductionPathStageId =
  | 'screenplay'
  | 'screenplayAnalysis'
  | 'castAndSets'
  | 'visualLanguage'
  | 'castAndSetVisuals'
  | 'sceneBeats'
  | 'shotPlans'
  | 'videoTakes';

export type ProductionPathStageStatus = 'notStarted' | 'started' | 'complete';

export interface ProductionPathStage {
  id: ProductionPathStageId;
  status: ProductionPathStageStatus;
  progress: { done: number; total: number } | null;
}

export interface ProductionPathResource {
  stages: ProductionPathStage[];          // always all eight, in path order
  nextStageId: ProductionPathStageId | null; // first stage that is not complete; null when all are
}
```

Status rules (**needs approval**):

| Stage | notStarted | started | complete | progress |
|---|---|---|---|---|
| screenplay | 0 scenes | — | ≥1 scene | `{ done: scenes, total: scenes }` |
| screenplayAnalysis | no active analysis | — | active analysis exists | null |
| castAndSets | 0 cast, 0 locations and 0 props | anything else | ≥1 Cast Member and ≥1 Location | null |
| visualLanguage | no Inspiration folders and no Lookbooks | one of those | Production and Storyboard Lookbooks both exist | null |
| castAndSetVisuals | no visual references, location sheets or prop sheets | some | every visual Cast Member has a profile or sheet, every Location has a sheet, every Prop has a sheet, and ≥1 Cast Member | subjects with media / visual subjects |
| sceneBeats | no scene has active beats | some | every scene has active beats, and ≥1 scene | scenes with beats / scenes |
| shotPlans | no scene has a Shot Plan | some | every scene has ≥1 Shot Plan, and ≥1 scene | scenes with plans / scenes |
| videoTakes | no Shot Plan has a video | some | every active Shot Plan has ≥1 generated video, and ≥1 plan | plans with video / plans |

- Project data service: `readProductionPathResource(input: ReadProjectInput):
  Promise<ProductionPathResource>`.
- HTTP: `GET /api/projects/:projectName/production-path` returns
  `{ resource: ProductionPathResource }`. Errors go through the existing
  `projectErrorResponse`, with no new codes.
- Character Arc summary:

```ts
export type CastMemberCharacterArcSummary =
  | { kind: 'own' }
  | { kind: 'shared'; ownerCastMemberId: CastMemberId; ownerName: string }
  | { kind: 'notWritten'; screenplayAnalyzed: boolean };
```

`screenplayAnalyzed` is true when the project has an active Screenplay
Analysis. Every caller that tested truthiness switches to checking `kind`.

- Studio UI:
  - `AgentRequest({ request })` and `AgentRequestLine({ request })`, where
    `request` is a `string`;
  - `PanelEmptyState({ icon, title, description, request?, moreRequests?,
    preview?, prerequisite? })`;
  - `StepChain({ steps: { label, note, state: 'missing' | 'upcoming' }[] })`;
  - `LineTabsItem.pending?: boolean`.

## Implementation Slices

1. **Shared readiness extraction (core):**
   - Move the three readers out of `director-context.ts` into
     `production-readiness/`.
   - Update the director context imports.
   - Director context tests stay green with no output change.
2. **Production Path (core):**
   - Add the client types, the three access counts, the eight stage files,
     `stage-order.ts`, `resource.ts` and the project data service wiring.
   - Add resource tests covering the "Test" project shape and a fresh
     project.
3. **Arc summary variant (core + Studio):**
   - Change `readCastMemberCharacterArcSummary` to return `notWritten`.
   - Update `cast-member-panel.tsx` so the tab always shows.
   - Add `cast-member-arc-empty-state.tsx` and `LineTabsItem.pending`.
4. **Server route and service:** add `routes/production-path.ts`, its test,
   and `studio-production-path-api.ts`.
5. **Shared UI:**
   - Add `agent-request.tsx`, `panel-empty-state.tsx` and `step-chain.tsx`,
     with tests.
   - Move Project Library starts to `AgentRequest` and delete
     `agent-prompt.tsx`.
6. **Copy module:** add `agent-request-copy.ts` with every request in the
   Surfaces table.
7. **Option A surfaces:** add the Cast, Locations and Props overview empty
   states, and the Screenplay page, Lookbook, Inspiration, Covers, 3D World,
   Audio, Project Info and asset-tab changes.
8. **Option B previews:** add the Story Arc preview (and delete the old box
   and the dead callout) and the Scene Beats preview (replacing
   `scene-beats-empty.tsx`).
9. **Option C:**
   - Add the Overview tab and make it the default in
     `project-details-panel.tsx`.
   - Add the Shot Plans and Generations empty states, each with a
     `StepChain` variant.
   - Add the sidebar "Not started" text (only if approved).

## Tests And Guardrails

- **Core:**
  - Production Path status and progress for each stage, at the boundaries:
    0, partial and all.
  - `nextStageId` picks the first incomplete stage and is null when all are
    complete.
  - `notWritten` carries `screenplayAnalyzed` both ways.
  - Director context output is unchanged after the extraction.
- **Server:** the route returns `{ resource }`, and an unknown project goes
  through `projectErrorResponse`.
- **Studio:**
  - `AgentRequest` copies the exact text, brackets included. It shows
    "Copied", and on clipboard failure it shows the existing error text.
  - Bracket highlighting renders the original string unchanged.
  - The Arc tab is always listed. It shows the right request for each
    `screenplayAnalyzed` value, and selecting it never falls back to
    Details.
  - The Overview renders eight rows in order. Only the next step shows the
    full card, and "Show request" expands a row.
  - Shot Plans and Generations show the `StepChain` variant only when their
    prerequisite is missing.
  - Cast, Locations and Props overviews show the empty state at 0 and the
    grid otherwise.
- **Architecture:** the existing import-boundary tests apply. Add no
  name-based "needle" tests. Add one runtime check that feature code renders
  no raw `button` or `textarea` in the new empty states. The existing lint
  rule may already cover this.

## Documentation

- New ADR, `docs/decisions/0126-guide-empty-states-with-agent-requests.md`.
  It records:
  - the Option A pattern;
  - request copy as Studio-owned interface text that is never parsed;
  - the Production Path as a core read model;
  - the Arc tab always showing.
- Update `plans/active/0240-character-arcs.md`, "Arc tab" section: one line
  pointing at this plan for the visibility change. Make no historical edits.
- Add a short "Empty states" section to
  `docs/architecture/reference/front-end-guidelines.md` naming
  `PanelEmptyState` and `AgentRequest`.

## Final Verification

- Run:

```bash
pnpm build:core
pnpm test:core
pnpm test:studio
pnpm test:typecheck:core
pnpm test:typecheck:studio
pnpm lint:core
pnpm lint:studio
```

- In the running Studio, in both dark and light themes, check:
  - **"Test" project:** Overview statuses, Arc tab on Susie, Beats and Shot
    Plans on scene 1, and the Analysis preview.
  - **Urban Basilica:** populated pages show no empty states, and the
    Overview marks the right steps complete.
- Shape review:
  - inspect `git diff --stat`;
  - confirm `director-context.ts` shrank;
  - confirm no feature file collects other surfaces' empty states;
  - confirm `index.ts` files only gained exports;
  - confirm no formatting churn.

## Completion Checklist

### Review Area

- [x] The implementation preserves accepted architecture boundaries.
- [x] Step status and the next step are computed only in core.
- [x] The final module and file shape matches the Architecture Shape Gate.
- [x] No new broad dispatcher, catch-all helper or god file was added.
- [x] Option D, the Settings import offer and the director `nextSteps` are
      untouched.

### Architecture And Contracts

- [x] `ProductionPathResource` types are added to the core client and
      exported from its index.
- [x] `readProductionPathResource` is on the project data service contract
      and wiring.
- [x] `CastMemberCharacterArcSummary` has `notWritten`, and no caller tests
      truthiness.
- [x] The route is thin: params, then core, then `{ resource }`, then
      errors.
- [x] There are no compatibility shims, and `agent-prompt.tsx` is deleted.
- [x] Request text names no skills, commands, providers or models.

### Implementation Slices

- [x] 1 Readiness readers moved, and director context unchanged.
- [x] 2 Production Path stages, order, resource and access counts.
- [x] 3 Arc summary variant, always-on Arc tab, Arc empty state, tab
      `pending` dot.
- [x] 4 Server route and Studio service.
- [x] 5 `AgentRequest`, `PanelEmptyState` and `StepChain`; Project Library
      migrated.
- [x] 6 `agent-request-copy.ts` covers every row of the Surfaces table.
- [x] 7 Option A surfaces and inline request lines (Location hero placeholder
      dropped, see Decisions).
- [x] 8 Story Arc and Scene Beats previews; dead callout and old box
      removed.
- [x] 9 Overview tab as default; Shot Plans and Generations step chains;
      sidebar "Not started" (if approved).

### Tests And Guardrails

- [x] Core stage status, progress and `nextStageId` tests.
- [x] Arc summary variant tests.
- [x] Server route test.
- [x] Studio component and surface tests listed above.
- [x] No name-based architecture tests added.

### Documentation

- [x] ADR 0126 written.
- [x] Plan 0240 Arc tab note added.
- [x] Front-end guidelines "Empty states" section added.

### Final Verification

- [x] Focused test, lint and build commands pass.
- [x] Checked in an isolated Studio (port 5174, copied "Test" project plus a
      new blank project), in dark and light themes. Urban Basilica was not
      opened: its 4.5 GB folder was not copied, and the user's own dev
      server still runs the old core until restarted.
- [x] `git diff --stat` reviewed, large files inspected, and no formatting
      churn.
- [x] No checklist item was satisfied by accepting unreviewable structure.
- [x] Only then mark the plan complete.
