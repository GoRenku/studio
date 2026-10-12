# 0227 Codex FLUX 3 Image Edit Panel

Status: implemented (native Codex Desktop verification pending)
Date: 2026-10-11
Model-specific panel parts superseded by plan 0228.

## Summary

Directors need precise, region-level control when editing an existing project
image, not a single free-text instruction. FLUX 3 Image (Black Forest Labs, on
Fal.ai) supports this natively through bounding boxes in the prompt. This plan
does four things:

1. Adds FLUX 3 Image to the Fal.ai provider Skill:
   - `blackforestlabs/flux-3/text-to-image` for every existing focused image
     creation purpose, through the regular image generation flow; and
   - `blackforestlabs/flux-3/edit-image` for `image.edit`.
   Both are Skill-only route additions. The Fal.ai Engines provider is already
   schema-first and needs no code change.
2. Adds a fullscreen Codex Desktop **FLUX 3 Image Edit** panel. The user marks
   rectangular regions on the image, gives each region an Edit or Remove
   instruction, adds an optional whole-image instruction and an optional
   visual-language style reference, chooses a resolution, and clicks
   **Generate**. As with the dialogue direction panels, Generate records the
   direction and posts a message. The agent writes the FLUX 3 prompt, executes,
   imports and reports. The panel shows each result as a new version of the
   image.
3. Adds an inline Codex **Image Edit Target Chooser**. When the user's request
   matches more than one image, the agent shows the matching images inline and
   the user picks the one to edit. The agent then opens the edit panel on that
   image.
4. Makes a newly imported `image.edit` result the selected image of its target
   whenever that image type has a selection, so "the latest edit is selected"
   holds in Studio and in the panel.

The panel's components are split into model-neutral shared components and a
thin FLUX 3 layer, so later region-capable image models can reuse them.

The approved visual target is the published mockup
https://claude.ai/artifact/6uLQeWdtjcUnefcjLVHfXR (version 2): view 1 (inline
chooser) and view 2 (edit panel). It is a design reference only, not code to
port. Its simulated results and simulated earlier profile Takes are not product
behavior.

## Review Attention

**Review fixes (2026-10-11):** Core persists the validated import target in
the nullable internal `asset_file.image_edit_source_asset_file_id` column in
the attachment transaction. A Drizzle Kit migration adds the column and advances
the schema generation; it preserves existing media and provenance without
guessing source relationships for existing files. Codex validates reports
against the action's base, retains each base's lineage in the session, and re-reads
Lookbook sheets on projection, Generate and consume. An unavailable dependency
fails the consumed action clearly so another Generate is possible. No new
commands, Settings, provider request fields or UI controls are introduced.
The sister `studio-skills` consume guidance explains that an unavailable
dependency already fails the action, so the agent must stop without executing
or reporting it again.

**Behavior added beyond the literal request:**

- **Import selects image edits for every host, not only panel edits.**
  - `image.edit` import now selects the new Asset File when its type has a
    selection target: Cast profile, Location hero, Prop hero, Lookbook image,
    Shot image, Scene Beat storyboard image, Project cover. This includes the
    ordinary chat flow and other agents.
  - Why: the user decided "selection should default to the latest version that
    is edited", and the panel's next edit starts from the selected version.
  - This supersedes the "unselected result" parts of ADR 0058 and ADR 0088
    through a new **ADR 0113**.
  - Lookbook images have a Core selection but no Studio selection UI today. The
    rule still applies to them; no Studio UI is added.
- **Sheets and Shot Plan images have no selection.** Character, Location, Prop
  and Lookbook sheets, and the four Shot Plan image types (ADR 0064), have no
  selection target. For these the panel's edit base is the newest version made
  in the current panel session, starting with the source. Studio is unchanged
  for them.
- **No reselection after delete.** If the user deletes the selected image in
  Studio, nothing is reselected (as today). The panel then shows "No selected
  image. Select one in Studio." and disables Generate. It does not guess a base.
- **Correct Studio refresh keys for edited covers and Shot images.** Today
  `image.edit` import returns only candidate keys for covers and only the
  scene key for Shot images. Because import now changes selection, it must
  also return the selection keys, or Studio would show a stale selection.
- **Take numbers for images.** The chooser and version strip label images
  `Take N`. Core computes the number from creation order among all Asset Files
  of the same owner and type, discarded ones included, so numbers never shift
  after a delete. Studio sections are unchanged and still show no numbers.
- **Shared panel infrastructure extracted from the dialogue direction
  panels.** The one-action lifecycle, media blob registry, fullscreen resource
  registration, panel app connection, Generate message and session polling hook
  are generic. They move into shared modules that both panel families use,
  instead of being copied. Dialogue direction behavior does not change. Why:
  the user asked for reusable components, and copying ~400 lines would create
  two drifting implementations.
- **Generate is the execution approval.** As with the dialogue panels, a
  Generate click authorizes one FLUX 3 edit without a separate review step.
  This needs explicit confirmation (see Decisions needed).
- **No aspect ratio control (changed from the mockup).** Regions are drawn on
  the source image, and FLUX 3 stretches the box grid to the output aspect
  ratio. The panel always sends `aspect_ratio: auto`, which keeps the source
  ratio. Resolution stays.
- **One-time live check of Fal box pass-through.** Neither Fal nor BFL
  documents that Fal passes BFL's in-prompt box JSON through unchanged. Slice 1
  runs one paid FLUX 3 edit on Fal (about $0.05 at 1K) to confirm before the
  Skill guide relies on it.

**New or changed contracts:**

- **Core:**
  - `image.edit` attachment selects the result (above), and returns selection
    resource keys.
  - New read `readImageEditTargets({ project, assetFileIds })` returning
    `ImageEditTarget[]`, including the take number and selection state.
- **Codex MCP runtime:**
  - two UI resources: the fullscreen FLUX 3 panel and the inline chooser;
  - opening tools `image.edit.flux-3.open` and `image.edit.target.choose`
    (model);
  - app tools `image.edit.generate` and `image.edit.target.respond`;
  - model tools `image.edit.consume`, `image.edit.report` and
    `image.edit.target.consume`;
  - resource schemes `renku-image-edit://` and `renku-image-target://`;
  - a new `./image-edit` package export of type-only contracts.
- **Codex shared panel modules:** `packages/codex/src/panel-sessions/`, which
  dialogue direction now uses.
- **Studio packaging:** two single-file Codex app builds,
  `flux-3-image-edit.html` and `image-edit-target-chooser.html`, which
  `renku studio mcp` resolves.
- **New diagnostics:** `CODEX_IMAGE_EDIT_INVALID`,
  `CODEX_IMAGE_EDIT_NOT_FOUND`, `CODEX_IMAGE_EDIT_BUSY`,
  `CODEX_IMAGE_EDIT_UNSUPPORTED`. Core adds
  `CORE_IMAGE_EDIT_TARGET_INVALID` for `readImageEditTargets`.
- **Skills (studio-skills):**
  - two Fal.ai routes;
  - a new FLUX 3 Image model guide;
  - a new image edit panels reference;
  - updates to image operation routing, generation review routing, the Fal.ai
    reference-inputs adapter and the bundled models doc.

**Routing:**

- The **edit panel** opens only when all of these hold:
  - the host is Codex Desktop and the existing panel probe advertises support;
  - the purpose is `image.edit`;
  - the route is Fal.ai `blackforestlabs/flux-3/edit-image`.
- The **chooser** is route-independent: in Codex Desktop with panel support,
  every `image.edit` request that matches more than one image shows it, before
  any route is chosen. With exactly one match, the agent goes straight on.
- FLUX 3 Image Edit is the **default `image.edit` route** whenever a Fal.ai
  key is saved (`renku credentials status`) and the user names no other model
  or provider, whatever the saved Image provider is. The agent does not ask
  which model to use. In Codex Desktop with panel support this opens the panel;
  elsewhere it is the conversational flow on that route. (User decision,
  2026-10-11.) (Added 2026-10-11 after the first native run:
  gating the chooser on an already-selected route made the agent ask in chat.)
- Like the dialogue panels, these are not generation reviews. They ignore
  `codexGenerationReview` and `codexGenerationReviewDisplayMode`. The panel is
  always fullscreen; the chooser is always inline.
- Every other host and route keeps today's conversational `image.edit` flow.
  That includes Claude, Codex CLI, and FLUX 3 edits requested in chat on a host
  without panel support.

**Existing behavior deliberately unchanged:**

- Engines: the Fal.ai provider, its schema discovery and its `image_urls`
  marker handling.
- The `image.edit` source rule (ADR 0088): the source must appear in the
  request, and the destination is derived from the source.
- Discard and restore semantics, and the Studio sections and their controls.
- The dialogue direction panels' behavior and visuals.
- The combined generation review panel.

**Assumptions:**

- Fal passes BFL's in-prompt box JSON through unchanged, with `ref_image_0` =
  `image_urls[0]` (Slice 1 confirms this).
- The Codex host renders an inline MCP App and a later model tool call can open
  the fullscreen panel. This matches the existing generation review (inline)
  and dialogue panels (fullscreen).
- Image blobs for the base image and up to a few versions fit comfortably
  through MCP resources, as audio blobs do today.

**Decisions approved by the user (2026-10-11):**

1. Generate in the panel is the execution approval (no separate review or cost
   confirmation), as for audio.
2. ADR 0113: `image.edit` import selects the result for all hosts.
3. Extracting the shared panel infrastructure from the dialogue direction
   panels in Slice 2.
4. One paid Fal test call in Slice 1.

## Product Behavior

### Inline Image Edit Target Chooser

- Appears inline in the Codex conversation after the agent says the request
  matches several images.
- **Header:** "Choose an image to edit", plus the owner name when all
  candidates share one owner.
- **Groups:** one group per owner and image type, in the agent's candidate
  order, labelled with the image type (for example "Profile image", "Character
  sheet"). With several owners, the label adds the owner name.
- **Each candidate card** shows:
  - the thumbnail;
  - `Take N`;
  - a green **Selected** pill when it is the current selection of its target;
  - the creation date.
- Click selects a card (single choice); double-click submits it. The card
  initially selected is the agent's suggested candidate.
- **Footer:** the current choice ("Profile image · Take 3"), **Cancel**, and
  **Edit this image** (primary).
- **After Edit this image:** the card collapses to a one-line confirmation
  (thumbnail, "Profile image · Take 3", "Chosen for editing") and a
  conversation message hands the choice to the agent.
- **After Cancel:** the card collapses to "Image choice canceled." and a
  message tells the agent the user canceled.
- There is no search or paging. The agent passes at most 24 candidates.

### FLUX 3 Image Edit panel

Fullscreen in Codex's right pane. There is no Done or close control; Codex owns
dismissal.

- **Header:** owner name (for example "Constantine XI Palaiologos"), the owner
  kind and image type ("Cast · Profile image"), and the quiet model label
  "FLUX 3 Image · Fal.ai".
- **Layout:** the image stage takes the remaining width; the direction column
  is 340px on the right. Below 760px the columns stack. Studio is desktop-first;
  this breakpoint only keeps narrow Codex panes usable.
- **Version strip** (top of the stage, horizontal, scrolls sideways):
  - the source version first, then a divider, then each version made in this
    session in order;
  - each item: thumbnail, `Take N`, and either the green **Selected** pill or a
    quiet "Source" / "from Take M" line;
  - clicking an item views that version;
  - while generating, a shimmering placeholder shows the next take number.
- **Stage toolbar:**
  - with the edit base shown: "Drag on the image to mark a region", **Hide
    regions** (`H`) and **Clear regions**;
  - for any version made in this session: **Compare with Take M** toggles a
    before/after slider against its parent version.
- **Notice:** when the viewed version is not the edit base: "Viewing Take 4.
  New edits start from the selected Take 5. Change the selection in Studio."
  For image types without selection it reads "…start from Take 5, the latest
  version."
- **Region canvas** (only on the edit base, with comparison off and regions
  shown):
  - drag on empty image space to draw a rectangle; a drag under 1.5% of either
    side is treated as a click and clears the selection;
  - drag a region to move it; drag a corner handle to resize it;
  - regions show a coloured outline and a coloured number chip only, with no
    text on the image;
  - Remove regions use a dashed, hatched outline;
  - the selected region dims the rest of the image slightly;
  - `Delete`/`Backspace` removes the selected region; `Escape` clears the
    selection;
  - a newly drawn region focuses its instruction field.
- **Direction column**, top to bottom:
  1. **Whole image**: optional instruction, prefilled when the agent passes one.
     Help line: "Name project items in plain words, such as 'the Ottoman helmet
     from Props'. The agent adds them as reference images."
  2. **Style reference**: **From visual language** opens a picker of the
     Project's Production and Storyboard Lookbook sheets, grouped by Lookbook.
     One choice at most, shown as a chip with a remove button.
  3. **Regions**: one card per region in creation order. Each has the number
     chip, an **Edit / Remove** segmented control, a delete button and an
     instruction field. Edit requires an instruction; Remove's instruction is
     optional ("what should fill the space"). Cards for empty Edit regions show
     "Needs an instruction" when not focused.
  4. **Output**: resolution **1K / 2K / 4K**, default 2K.
- **Generate bar** (pinned at the bottom of the column):
  - the reason Generate is disabled, or "Edits Take N · ⌘↵";
  - **Generate** (primary); ⌘/Ctrl+Enter in any field also generates.
  - Disabled when: an action is outstanding; there is no edit base; an Edit
    region has no instruction; or there are no regions and no whole-image
    instruction.
- **While generating:** the strip placeholder appears, Generate shows
  "Generating…", and the direction column stays editable.
- **When the agent reports success:** the new version appears in the strip,
  becomes the viewed version with comparison on, and (for selectable types)
  shows **Selected**. Regions and instructions stay so the user can iterate.
- **When the agent reports failure:** the placeholder disappears and the
  reported message shows in the panel's notice bar until the next Generate.
- Regions, instructions and the style reference live only in the panel. They
  are not restored if the panel is reopened.

### Studio

No Studio UI changes. Edit results already appear as images in their owner's
section. With ADR 0113 they arrive selected where the section has a selection,
and the user can change the selection or delete them there as today.

### Non-goals

- Region editing for other image models, Claude Desktop or Codex CLI.
- Moving elements as a region action. Users can describe a move in text.
- Per-region reference pickers. References are named in text and resolved by
  the agent.
- Drawing boxes on reference images.
- Aspect ratio changes, masks, brushes or freeform shapes.
- Restoring panel drafts after the panel closes.
- Selecting or deleting images from the panel.
- Studio take numbers or lineage display.

## Requirement Ledger

| Requirement | Source | Owner |
| --- | --- | --- |
| FLUX 3 region editing on an existing project image | User request | Codex runtime, Studio Codex app, Media Producer Skill |
| Same Generate mechanism as the audio panels | User request | Shared panel modules, Skill |
| FLUX 3 text-to-image through regular image generation | User request | Fal.ai Skill routes, FLUX 3 model guide |
| Fal.ai only for now | User decision | Skill routing |
| Versions as a horizontal strip above the image | User feedback | `ImageTakeStrip` |
| Two-column layout at narrower widths | User feedback | Panel layout (760px breakpoint) |
| Only coloured numbers on the image | User feedback | `RegionCanvas` |
| Reusable components for other image models | User feedback | Shared Studio components, `panel-sessions` |
| Agent asks which image when ambiguous, via an inline panel | User feedback | Inline chooser, Skill |
| Agent writes the prompt using FLUX 3 best practices | User decision | FLUX 3 model guide, Skill |
| Edits are new takes shown in their Studio section | User decision | Core `image.edit` attachment (unchanged location) |
| Latest edit selected by default; user changes it in Studio | User decision | Core attachment selection, ADR 0113 |
| Next edit starts from the selected version | User decision | Panel edit base projection |
| Edit and Remove only | User decision | Shared region contract, FLUX 3 modes |
| Whole image above Regions | User decision | Direction column order |
| Style reference from Production and Storyboard visual languages | User decision | `StyleReferencePicker`, session projection |
| Other references named in text; no internal words like "selected" in the prompt | User decision | Skill and FLUX 3 guide |
| Prompts and images stay opaque to Studio | Architecture, ADR 0041 | All slices |

## Context And Evidence

- **ADR 0058 / 0088:** `image.edit` is agent-owned. The source must appear in
  the request's `$file` markers (`readImageEditSource`,
  `CORE_IMAGE_EDIT_SOURCE_REFERENCE_MISSING`). The destination comes from
  `resolveImageEditContinuation` (subject, Lookbook, scene/Shot, Shot Plan
  resolvers, with an `assetFile.imageEdit` fallback). Today the result is
  stored unselected.
- **ADR 0064 / 0107:** Asset Files have one owner. `selected_asset_file` keeps
  at most one selection per target. `selectedAssetFileTypes` in
  `core/src/server/asset-files/selection.ts` maps targets to selectable types.
  Sheets and Shot Plan images have no selection.
- **ADR 0112:** precedent for "an attached Take is stored selected".
- **ADR 0041:** prompts, region instructions and images are opaque. Region
  geometry, modes, counts and resolution are envelope data Studio may validate.
- **Plan 0226 / commit 16b422a1:** the dialogue direction panels this plan
  mirrors.
  - `packages/codex/src/dialogue-direction/`: one-action lifecycle in
    `session-state.ts`; `DirectionMediaRegistry`; fullscreen resource metadata
    in `resources.ts`; app versus model tool split; consume-once.
  - `packages/studio/src/services/codex-dialogue-direction.ts`: fullscreen
    connection and the `openai/message` send.
  - `use-dialogue-direction-session.ts`: 2s polling, revision ordering,
    notification retry, and autoplay through `lastCompletedAction`.
  - `vite.codex.config.ts` multi-mode builds; `codex-app-architecture.test.ts`.
- **Generation review (plan 0220):** the inline Codex App pattern
  (`availableDisplayModes: ['inline', …]`, `h-[42rem]` inline height).
- **Studio deletes and selection:** `discardAssetFile` sends to Trash and
  clears selection without reselecting. Selection routes exist per section
  (`routes/asset-files.ts`, `routes/shot-plans.ts`,
  `routes/scene-storyboard-images.ts`, `routes/visual-language.ts`).
- **Lineage:** `asset_file` has no parent column. Core's
  `readImageEditLineage` derives it from each edit's provenance `$file`
  references, the same check import uses. (Changed 2026-10-11: tracking
  versions in panel memory lost Take 2 after its action was reported failed and
  the edit was recovered in chat.)
- **Fal.ai FLUX 3 schemas** (OpenAPI, 2026-10-11):
  - `edit-image`: `prompt`, `image_urls` (1–10, at least 256px per side,
    downscaled to at most 4MP, the first sets `auto` aspect),
    `aspect_ratio` (default `auto`), `resolution`
    (`512sq | 768sq | 1k | 2k | 4k`, default `1k`),
    `enable_prompt_expansion` (default false), `safety_tolerance` (0–4,
    default 2), `output_format` (`jpeg | png`), `sync_mode`.
  - `text-to-image`: the same without `image_urls`; `auto` gives 1:1.
  - Output `images[{ url, content_type, width, height, … }]`.
  - Price from about $0.048 per 1K image after the launch promotion.
- **BFL FLUX 3 box syntax** (docs.bfl.ai, `flux3_image_bounding_boxes`,
  `flux3_image_layout`, prompting guides):
  - boxes live in the prompt: the instruction with inline `<id>` tags, then a
    space, then one JSON array;
  - coordinates `[top, left, bottom, right]`, integers on a 0–1000 grid;
  - edit rows `{ id, from, src_bbox, tgt_bbox, desc }`, with `ref_image_0` the
    first image and prose using "image 1";
  - keep: same source and target box; new, replace or recolor: `from: null`,
    `src_bbox: null`, target box; remove: source box and `tgt_bbox: null`;
    move: different target box;
  - boxes are not masks; shadows and lighting near a box may change; very small
    boxes for new elements often fail; no negative prompts; no seed.
- **studio-skills:**
  - `fal-ai-media-provider/references/supported-routes.json` lists FLUX 3 video
    routes and older image routes, but no FLUX 3 image routes;
  - `media-producer/references/model-guides/image/` has one guide per model
    (for example `flux-kontext-pro.md`);
  - `media-producer/references/dialogue-direction-panels.md` is the panel
    workflow to mirror;
  - `media-producer/references/image-operation-routing.md` decides
    `image.edit` versus focused creation.
- **Urban Basilica** (read-only check): Cast profiles have several sibling
  images per member. No data changes are needed; existing edit results keep
  their current selection.

## Architecture Shape Gate

Review-fix ownership: `schema/asset-files.ts` owns the internal source column;
`image-edit-attachments/attachment.ts` supplies the validated source to
`generation/attachment-persistence.ts` for the same transactional insert;
`image-edit-targets/lineage.ts` follows only that explicit relationship. The
existing Core read entrypoints remain unchanged. Codex `session-state.ts`
retains lineage roots, `session-projection.ts` refreshes versions and style
choices, and `actions.ts` validates and consumes actions. Do not infer lineage
from provider requests, write metadata from Codex, or add a general mutation API.

### Ownership

- **Core:**
  - owns the selection rule for imported `image.edit` results, inside
    `image-edit-attachments/`;
  - owns `readImageEditTargets`: candidate validation, owner and type, take
    number and selection state;
  - learns nothing about panels, FLUX 3, regions or providers.
- **Engines:** unchanged.
- **Codex runtime (`packages/codex`):**
  - `panel-sessions/` owns generic panel infrastructure shared by dialogue
    direction and image edit;
  - `image-edit/` owns image edit sessions, chooser sessions, the shared region
    envelope validation, the edit-base projection, and per-model folders;
  - never imports Engines, the CLI or Studio React; the existing
    `architecture.test.ts` keeps enforcing this.
- **Studio (`packages/studio`):**
  - owns the two Codex apps, model-neutral image edit components and the FLUX 3
    layer;
  - owns pure region geometry (drawing, moving, resizing, clamping) as
    presentation logic. Draft validity is enforced in the Codex runtime, and
    the UI only mirrors it to explain disabled states.
- **CLI:** `renku studio mcp` resolves two more HTML files. No command changes.
- **Skills (studio-skills):** own the chooser decision, the FLUX 3 prompt and
  box rows, reference resolution from text, execution, import and reporting.

### Module layout

```text
packages/core/src/server/
  image-edit-attachments/
    attachment.ts               # selects the result when its type has a selection target (changed)
    selection.ts                # imageEditResultSelection(...): target + resource keys (new)
  image-edit-targets/
    index.ts                    # readImageEditTargets export only
    targets.ts                  # validation + projection of candidate Asset Files
    take-numbers.ts             # creation-order take number per owner and type

packages/codex/src/
  server.ts                     # adds registerImageEdit(...) call and HTML options only
  panel-sessions/               # shared by dialogue-direction and image-edit (extracted)
    session-store.ts            # PanelSessionStore<TParts, TDraft, TDetails, TCompletion>: one action, consume once, revision
    media-registry.ts           # PanelMediaRegistry + readPanelMedia: project path -> opaque URI -> blob via Core
    panel-resources.ts          # registerPanelAppResource(server, { displayMode: 'fullscreen' | 'inline' })
    panel-results.ts            # panelToolResult / panelResourceResult with a family fallback error
  dialogue-direction/           # now consumes panel-sessions (session-state.ts and resources.ts shrink; media-resources.ts deleted)
  image-edit/
    index.ts                    # registerImageEdit(server, options): composition only
    contracts.ts                # type-only public contracts (package export ./image-edit)
    schemas.ts                  # zod schemas for shared tools
    diagnostics.ts              # CODEX_IMAGE_EDIT_* codes and helpers
    session-state.ts            # ImageEditState: sessions + versions, on PanelActionState
    opening.ts                  # shared opening: resolve Project, read source target, style references, create session
    session-projection.ts       # Core reads -> versions, edit base, style references
    edit-base.ts                # imageEditBase(...): Core selection or newest lineage version
    region-validation.ts        # shared envelope: grid bounds, ordering, min size, unique numbers, modes
    draft-context.ts            # ImageEditDraftContext + ImageEditDraftValidator types
    actions.ts                  # generate, consume, report; bounded Record<ImageEditPanel, validator>
    tools.ts                    # shared tool registration
    resources.ts                # renku-image-edit:// session and media resources
    target-chooser/
      chooser-state.ts          # ImageEditTargetChooserState: answer once, consume once
      open.ts                   # image.edit.target.choose: schema, Core validation, chooser session
      choice.ts                 # respond + consume tools
      resources.ts              # renku-image-target:// session and media resources
    flux-3/
      open.ts                   # image.edit.flux-3.open schema + session creation
      draft.ts                  # FLUX 3 draft: modes, resolution enum, delegates regions to region-validation

packages/studio/
  codex-apps/
    flux-3-image-edit.html
    image-edit-target-chooser.html
  vite.codex.config.ts                       # two more entries
  src/app/codex-flux-3-image-edit.tsx
  src/app/codex-image-edit-target-chooser.tsx
  src/services/codex-panel.ts                # shared: fullscreen/inline connection, message send (extracted)
  src/services/codex-dialogue-direction.ts   # shrinks to dialogue tool calls + message text
  src/services/codex-image-edit.ts           # image edit tool calls + Generate message text
  src/features/codex-panels/
    use-codex-panel-session.ts               # shared polling, revision ordering, notification retry (extracted)
    use-panel-media.ts                       # MCP blob -> object URL (moved from dialogue direction)
    codex-panel-notice.tsx                   # notice, pending and Generate button (moved from dialogue direction)
  src/features/codex-dialogue-direction/     # consumes codex-panels; no behavior change
  src/features/codex-image-edit/
    shared/
      image-edit-panel-frame.tsx             # header + stage/direction layout
      image-take-strip.tsx                   # ImageTakeStrip
      image-edit-stage-toolbar.tsx           # hide/clear regions, compare toggle
      region-canvas.tsx                      # RegionCanvas: overlay, pointer handling, compare slider
      region-geometry.ts                     # pure draw/move/resize/clamp on the 0–1000 grid, region colours
      region-list.tsx                        # RegionList + RegionCard (modes as props)
      use-region-draft.ts                    # regions, numbering, selection, focus
      generate-readiness.ts                  # disabled-Generate explanation mirroring runtime rules
      whole-image-direction.tsx
      style-reference-picker.tsx
      image-edit-generate-bar.tsx
      image-type-label.ts                    # Asset File type -> UI label
      use-image-edit-session.ts              # on use-codex-panel-session
    flux-3/
      flux-3-image-edit-panel.tsx            # composes shared parts
      flux-3-output-settings.tsx             # resolution control
    target-chooser/
      image-edit-target-chooser.tsx
      use-image-edit-target-chooser.ts
  src/styles/theme.css                       # .image-edit joins the existing .dialogue-direction token selectors
```

### Shapes

- `index.ts` files only compose registration or re-export intentional public
  entrypoints.
- **Region modes** are a shared union `'edit' | 'remove'`. A model's draft
  module declares which modes it accepts and which require an instruction.
  Shared components receive the mode list as props.
- **Draft validators** are a bounded `Record<ImageEditPanel, ImageEditDraftValidator>`
  in `image-edit/actions.ts` with one entry, `flux-3`. Adding a model is a
  deliberate product change.
- **Opening tools** are registered from their own folders. There is no panel
  switch dispatcher.
- **React:** `flux-3-image-edit-panel.tsx` composes shared components and passes
  model parts (modes, output settings) as props. Shared components never branch
  on the model.
- **Shared panel infrastructure** is generic over the draft and session types.
  It holds no dialogue or image vocabulary.
- **Forbidden:**
  - a generic metadata-driven "image editor" with model switches;
  - FLUX 3, provider or region knowledge in Core;
  - prompt authoring, box-row serialization or prompt preview in Studio or
    `packages/codex`;
  - validating instruction text beyond presence;
  - an MCP tool that executes generation or imports media;
  - panel tools that select or delete images;
  - re-export facades for moved panel modules;
  - copying dialogue direction infrastructure instead of extracting it.

**Stop conditions:**

- `panel-sessions/` gains a dialogue- or image-specific field.
- `image-edit/actions.ts` or `session-state.ts` handles FLUX 3 fields inline.
- A shared React component gains `if (model === …)` branches.
- `server.ts` grows image edit logic beyond one registration call.
- Core attachment code starts branching on provider or route.

## Contracts

### Core

- **Attachment selection (`image-edit-attachments/attachment.ts`):**
  - After persisting the result, if
    `assetFileSelectionTargetForOwnerType(result.owner, result.type)` returns a
    target, call `selectAssetFileInSession` for the result in the same
    transaction.
  - The report's `resourceKeys` include that target's selection keys
    (`projectCoverSelectionResourceKeys()` for covers, and the Shot selection
    keys for Shot images), in addition to today's keys.
  - No selection target: unchanged.
- **`readImageEditTargets({ project, assetFileIds })`**, exported from
  `@gorenku/studio-core/server`:

  ```ts
  interface ImageEditTarget {
    assetFile: AssetFile;                // exact file, projectRelativePath included
    owner: AssetFileOwner;
    ownerName: string | null;            // Cast, Location, Prop, Lookbook, Inspiration folder and Shot names; null otherwise
    takeNumber: number;                  // 1-based creation order among all files of this owner and type
    selectable: boolean;                 // the type has a selection target
    selected: boolean;                   // it is that target's current selection
    selectedAssetFileId: string | null;  // the target's current selection, if selectable
  }
  ```

  Image dimensions are not stored on Asset Files, so the panel reads the
  natural size from the loaded image.

  It fails with `CORE_IMAGE_EDIT_TARGET_INVALID`, collecting every issue, when
  an id is unknown, discarded, duplicated or not an image.
- **`readImageEditLineage({ project, sourceAssetFileId })`** returns
  `Array<{ target: ImageEditTarget; parentAssetFileId: string | null }>`: the
  source and every active same-owner, same-type image edited from it, directly
  or through earlier edits, in creation order. A discarded image still links
  its descendants but is not returned.
- **Take number:** count of Asset Files with the same owner key and type
  created at or before this file, discarded files included. Ties break by id.

### Codex MCP surface

| Name | Kind | Visibility | Purpose |
| --- | --- | --- | --- |
| `ui://renku/image-edit/flux-3` | UI resource | — | FLUX 3 panel HTML. `preferredDisplayMode: 'fullscreen'`, `availableDisplayModes: ['fullscreen']`; CSP `blob:` |
| `ui://renku/image-edit/target-chooser` | UI resource | — | Chooser HTML. `preferredDisplayMode: 'inline'`, `availableDisplayModes: ['inline']`; CSP `blob:` |
| `image.edit.target.choose` | app tool | model | Open a chooser session; returns `{ chooser }`, text "end the turn and wait" |
| `image.edit.target.respond` | tool | app | `{ chooserId, choice: { status: 'chosen'; assetFileId } \| { status: 'canceled' } }`; records it once |
| `image.edit.target.consume` | tool | model | `{ chooserId }` → `{ status: 'chosen'; project; assetFileId } \| { status: 'canceled' } \| { status: 'alreadyConsumed' }` |
| `image.edit.flux-3.open` | app tool | model | Open an edit session; returns `{ session }`, text "end the turn and wait" |
| `image.edit.generate` | tool | app | `{ sessionId, draft }`; validates and records one action; `CODEX_IMAGE_EDIT_BUSY` when one is outstanding |
| `image.edit.consume` | tool | model | `{ sessionId, actionId }` → once: `{ status: 'consumed'; project; route; base; styleReference; draft }`; then `alreadyConsumed` |
| `image.edit.report` | tool | model | `{ sessionId, actionId, outcome: { status: 'attached'; assetFileId } \| { status: 'failed'; message } }` |
| `renku-image-edit://{sessionId}` | resource | app | Current `ImageEditSession` JSON |
| `renku-image-edit://{sessionId}/media/{mediaId}` | resource | app | Image blobs (versions, style references) |
| `renku-image-target://{chooserId}` | resource | app | Current `ImageEditTargetChooser` JSON |
| `renku-image-target://{chooserId}/media/{mediaId}` | resource | app | Candidate thumbnails |

- Both opening tools call the existing `assertGenerationReviewCapability` before any read.
- `image.edit.report` with `attached` requires that the Asset File exists, has
  the same owner and type as the action's base, and is not already a session
  version. Core's import has already verified the base was in the request.

### Opening inputs (zod)

```ts
interface ImageEditTargetChooseInput {          // target-chooser/open.ts
  project: string;
  assetFileIds: string[];                       // 2..24, agent order
  suggestedAssetFileId: string;                 // must be in assetFileIds
}
interface ImageEditRoute { provider: string; model: string } // opaque; echoed on consume
interface Flux3ImageEditOpenInput {             // flux-3/open.ts
  project: string;
  sourceAssetFileId: string;
  route: ImageEditRoute;                        // 'fal-ai', 'blackforestlabs/flux-3/edit-image'
  wholeImageInstruction: string;                // agent prefill, may be empty
  resolution: '1k' | '2k' | '4k';
}
```

### Session and drafts (`image-edit/contracts.ts`, type-only)

```ts
type ImageEditPanel = 'flux-3';
type ImageEditRegionMode = 'edit' | 'remove';
interface ImageEditRegionBox { top: number; left: number; bottom: number; right: number } // integers, 0..1000
interface ImageEditRegion { number: number; mode: ImageEditRegionMode; box: ImageEditRegionBox; instruction: string }
interface ImageEditVersion {
  assetFileId: string;
  takeNumber: number;
  imageUri: string;
  parentAssetFileId: string | null;   // null for the source and for a selection made outside the session
  selected: boolean;
}
interface ImageEditSession {
  sessionId: string;
  revision: number;
  panel: ImageEditPanel;
  route: ImageEditRoute;
  owner: { kind: string; name: string | null };
  imageType: string;                  // Asset File type; Studio maps it to a label
  selectable: boolean;
  versions: ImageEditVersion[];       // Core lineages of the opening source and bases used by the session, then an outside selection; discarded ones dropped
  editBaseAssetFileId: string | null; // see edit base rule
  styleReferences: Array<{ assetFileId: string; name: string; lookbook: 'production' | 'storyboard'; lookbookName: string; imageUri: string }>;
  action: { actionId: string; baseAssetFileId: string; status: 'pending' | 'running' | 'failed'; message?: string } | null;
  lastCompletedAction: { actionId: string; assetFileId: string } | null;
  initial: { wholeImageInstruction: string; resolution: '1k' | '2k' | '4k' };
}
interface Flux3ImageEditDraft {
  panel: 'flux-3';
  baseAssetFileId: string;            // must equal the session's current edit base
  wholeImageInstruction: string;
  styleReferenceAssetFileId: string | null; // must be in session.styleReferences
  regions: ImageEditRegion[];
  resolution: '1k' | '2k' | '4k';
}
```

- **Edit base rule (`edit-base.ts`):**
  - selectable type: the target's current Core selection when it has the same
    owner and type, otherwise `null`;
  - otherwise: the newest version in the source's edit lineage.
- **Region validation (`region-validation.ts`, shared):** integer coordinates
  in 0..1000; `top < bottom` and `left < right`; each side at least 15 grid
  units; unique positive `number`s; instructions are strings. The FLUX 3 draft
  adds: modes `edit | remove`; `edit` requires a non-empty trimmed
  instruction; at least one region or a non-empty whole-image instruction; the
  resolution enum. All issues are collected into `CODEX_IMAGE_EDIT_INVALID`.
- **Consume result:** `base` is `{ assetFileId, projectRelativePath, width, height }`
  and `styleReference` is `{ assetFileId, projectRelativePath, name } | null`,
  both re-read from Core at consume time so the agent never sees panel-only
  ids.

### Generate and chooser messages

The Generate message carries the user's explicit approval for the upload and
the paid run, in the model panel's words. Codex's approval review only accepts
consent the user gave, not Skill instructions, so a message without it was
blocked in the first native run (2026-10-11). The panel shows the same terms
beside Generate, so the click is informed consent.

`src/services/codex-image-edit.ts` sends, with
`_meta: { 'openai/message': { target: 'active', send: true } }`:

```text
Generate image edit · <owner name> · <image type label> Take <N>. I approve uploading this image and any references it needs to Fal.ai and running one paid FLUX 3 Image Edit at <resolution> with my saved Fal.ai key. Session <id>, action <id>. Consume it with image.edit.consume once.
Edit image chosen · <owner name> · <image type label> Take <N>. Chooser <id>. Consume it with image.edit.target.consume once.
Image choice canceled. Chooser <id>. Consume it with image.edit.target.consume once.
```

### Skills (studio-skills)

- **`skills/fal-ai-media-provider/references/supported-routes.json`:** add
  `{ "apiId": "blackforestlabs/flux-3/text-to-image", "name": "FLUX 3 Image" }`
  and `{ "apiId": "blackforestlabs/flux-3/edit-image", "name": "FLUX 3 Image Edit" }`.
- **`skills/fal-ai-media-provider/references/adapters/reference-inputs.md`:**
  FLUX 3 uses ordered `image_urls`; image 1 is the edit base; prose says
  "image N"; box rows use `ref_image_<N-1>`; at most 10 images; at least 256px
  per side.
- **New `skills/media-producer/references/model-guides/image/flux-3-image.md`**,
  written from BFL's docs and Fal's schema (sources cited in the guide):
  - prompt structure for text-to-image (subject and placement, style,
    lighting, colour), visible details only, positions in words;
  - editing: name the target precisely, state the new state, then list what
    stays; one change per request when refining; hex colours for exact colour;
  - bounding boxes: the in-prompt tag plus JSON array format,
    `[top, left, bottom, right]` on 0–1000, the four row types with short
    examples, anchors for anything that must not move, boxes are not masks,
    avoid tiny boxes for new elements, and say additions and removals in the
    instruction too;
  - references: give every image a role ("the helmet in image 2"), base first,
    style references phrased as "in the style of image N while keeping…";
  - no negative prompts; describe what should be there;
  - leave `enable_prompt_expansion` off for region edits;
  - iterate at 1K, finish at 2K or 4K; resolution changes recompose;
  - text rendering: quoted exact words with their own box.
- **New `skills/media-producer/references/image-edit-panels.md`:**
  1. eligibility (Codex Desktop, probe advertised, `image.edit`, route
     `blackforestlabs/flux-3/edit-image`; review preferences ignored);
  2. find candidate images for the user's request from generation context and
     asset listings; one match opens the panel directly; several call
     `image.edit.target.choose` (at most 24, best guess suggested) and end the
     turn;
  3. on a chooser message, `image.edit.target.consume` once; `canceled` ends
     quietly;
  4. open `image.edit.flux-3.open` with the chosen source, an optional
     whole-image instruction from the user's words and a resolution, then end
     the turn;
  5. on each Generate message:
     - `image.edit.consume` once (`alreadyConsumed` means do nothing);
     - resolve every project item the user named in text (Cast, Props,
       Locations, Lookbooks) to exact Asset Files and add them as ordered
       `image_urls` after the base and style reference. **Never put internal
       words such as "selected", "the pick" or Renku ids in the prompt.**
       Describe each reference by what it shows and its image number;
     - map regions to box rows: Edit becomes a new row (`from: null`,
       `src_bbox: null`, target box, `desc` from the instruction, rewritten
       for FLUX 3 without changing its intent); Remove becomes a remove row
       (`from: "ref_image_0"`, source box, `tgt_bbox: null`); add keep rows
       when a nearby element must not move;
     - write the instruction with inline `<region_N>` tags, the whole-image
       change, any style reference role and the preservation sentence, then
       the JSON array;
     - set `aspect_ratio: auto`, the draft resolution, `output_format: png`;
     - validate and execute without further confirmation (pending decision 1);
     - `renku media import --purpose image.edit --target assetFile:<base id>`;
     - `image.edit.report` with the imported Asset File id, or `failed` with a
       readable message;
  6. reply briefly in the conversation; selection and deletion stay in Studio.
- **`skills/media-producer/references/image-operation-routing.md`:** link the
  panel reference for eligible Codex requests.
- **`skills/media-producer/references/generation-review-routing.md`:** add the
  image edit panel rule; it does not depend on review preferences.
- **`docs/bundled-media-models.md`:** add FLUX 3 Image and FLUX 3 Image Edit
  rows.

## Implementation Slices

1. **FLUX 3 routes and model guide (studio-skills).**
   - Add both routes, the reference-inputs note and the bundled models rows.
   - Run one approved paid Fal edit on an Urban Basilica image with one remove
     row and one new row, to confirm box pass-through and `ref_image_0`
     mapping. Record the result in the guide.
   - Write `flux-3-image.md`. Skill validators pass. This slice can ship on its
     own and enables FLUX 3 in the chat flow.
2. **Extract shared panel infrastructure (no behavior change).**
   - Move the action lifecycle, media registry, panel resource registration and
     capability check into `packages/codex/src/panel-sessions/`; dialogue
     direction imports them directly.
   - Move the Codex app connection and message send into
     `src/services/codex-panel.ts`, and the polling hook and blob hook into
     `src/features/codex-panels/`.
   - Existing dialogue direction tests pass unchanged except for import paths.
3. **Core: select imported edits and image edit targets.**
   - Attachment selection and selection resource keys; ADR 0113.
   - `image-edit-targets/` with take numbers and `CORE_IMAGE_EDIT_TARGET_INVALID`.
   - Update `docs/cli/commands.md` `image.edit` import text.
4. **Codex runtime: image edit sessions and chooser.**
   - `image-edit/` contracts, schemas, diagnostics, state, projection, edit
     base, region validation, actions, tools, resources.
   - `target-chooser/` and `flux-3/`.
   - One `registerImageEdit` call in `server.ts`; package export
     `./image-edit`.
5. **Studio apps.**
   - Shared image edit components and `region-geometry.ts`, FLUX 3 panel,
     chooser, services, app entries, HTML files, vite entries, theme block.
   - `renku studio mcp` asset resolution for the two HTML files.
6. **Skill panel workflow (studio-skills).** `image-edit-panels.md` and the
   routing updates.
7. **Native verification in Codex Desktop** with Urban Basilica (see Final
   Verification).

## Tests And Guardrails

- **Core:**
  - `image.edit` import of a Cast profile selects the result and returns the
    Cast selection keys; a character sheet edit selects nothing;
  - cover and Shot image edits return selection keys;
  - discarding the selected edit leaves no selection;
  - `readImageEditTargets`: take numbers stay stable after a discard; unknown,
    discarded, duplicate and non-image ids are all reported together.
- **Codex runtime:**
  - opening validation (unknown source, discarded source, wrong route shape)
    collects all issues;
  - FLUX 3 draft validation: box bounds, ordering, minimum size, duplicate
    numbers, empty Edit instruction, empty draft, unknown style reference,
    stale `baseAssetFileId`;
  - generate, then BUSY, then consume once, then `alreadyConsumed`;
  - report `attached` with a wrong owner or type fails; success appends a
    version with the right parent and sets `lastCompletedAction`;
  - the edit base follows a selection change made in Studio, and is `null`
    after the selected file is discarded;
  - chooser: candidate validation, respond once, consume once, cancel;
  - `panel-sessions` tests cover the lifecycle independently of either panel.
- **Studio:**
  - `region-geometry.ts`: draw normalizes direction, clamps to the grid,
    rejects tiny drags; move keeps the box inside; resize keeps the minimum
    size;
  - `RegionCanvas`: draw, select, move, resize, delete key, hidden regions,
    compare mode blocks drawing;
  - panel: disabled-reason messages, ⌘↵, Generate sends the draft and message,
    success switches to the new version with comparison, failure shows the
    message;
  - `ImageTakeStrip`: selected pill, "from Take M", placeholder;
  - chooser: grouping, suggested choice, submit, cancel, collapsed states;
  - dialogue direction panel tests still pass after the extraction.
- **Architecture:**
  - `codex-app-architecture.test.ts` covers the two new HTML entries
    automatically;
  - the existing `packages/codex` import-boundary test stays green;
  - a Core import-boundary check that `image-edit-targets/` and
    `image-edit-attachments/` do not import Codex, Engines or provider
    modules.
- **Skills:** existing skill validators and route-index checks.

## Documentation

- **New ADR 0113** "Select imported image edits": supersedes the unselected
  result parts of ADR 0058 and ADR 0088; keeps their source and destination
  rules; records the sheet and Shot Plan image exception and no reselection
  after delete.
- **`docs/architecture/media-generation.md`:** add "Codex image edit panels"
  (fullscreen panel, inline chooser, edit base rule, message handoff, shared
  panel infrastructure).
- **`docs/cli/commands.md`:** `image.edit` import now selects the result where
  the type has a selection.
- **`packages/codex` README or module docs, if present:** the `panel-sessions`
  split.
- studio-skills docs listed under Contracts.

## Final Verification

- `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm check`.
- studio-skills validators.
- Native Codex Desktop run against `$HOME/renku-movies/urban-basilica` (a
  backed-up copy):
  - ask to edit Constantine's profile; the chooser appears with the profile,
    character image and production sheet; choose the profile;
  - draw two regions (Edit with a prop named in text, Remove), add a Production
    Lookbook style reference, Generate at 1K;
  - confirm the agent's prompt has no internal words, the helmet prop is an
    ordered reference, the Asset File imports as a new Cast profile and is
    selected in Studio, and the panel shows the new version with comparison;
  - change the selection in Studio and confirm the panel's edit base follows;
  - edit a character sheet and confirm no selection change.
- Architecture-shape review:
  - inspect `git diff --stat` and every new or heavily changed file;
  - confirm `index.ts` files are thin;
  - confirm `panel-sessions/` has no dialogue or image vocabulary;
  - confirm no Studio component branches on the model;
  - confirm no prompt or box serialization exists outside the Skill.

## Completion Checklist

### Review Area

- [x] Decisions 1–4 in Review Attention are confirmed by the user.
- [x] Core stays free of panel, FLUX 3, region and provider knowledge.
- [x] Final module layout matches the Architecture Shape Gate.
- [x] No broad dispatcher, catch-all helper or god file was added.
- [x] The dialogue direction panels behave exactly as before the extraction.

### Architecture And Contracts

- [x] `image.edit` attachment selects results with a selection target, in one
      transaction, and returns selection resource keys.
- [x] `readImageEditTargets` and `CORE_IMAGE_EDIT_TARGET_INVALID` exist with
      collected issues.
- [x] `panel-sessions/` is generic and used by both panel families with no
      re-export facades.
- [x] `image-edit/contracts.ts` is type-only and exported as
      `@gorenku/studio-codex/image-edit`.
- [x] Draft validators are a one-entry bounded record.
- [x] All `CODEX_IMAGE_EDIT_*` diagnostics are structured.
- [x] No MCP tool executes generation, imports media, selects or deletes images.

### Implementation Slices

- [x] Slice 1: routes, reference-inputs note, bundled rows, paid pass-through
      check recorded, `flux-3-image.md`.
- [x] Slice 2: shared panel extraction with dialogue tests green.
- [x] Slice 3: Core selection, resource keys, targets, take numbers, ADR 0113,
      CLI docs.
- [x] Slice 4: Codex image edit sessions, chooser, FLUX 3 opening and draft,
      one registration call.
- [x] Slice 5: Studio apps, shared components, geometry, FLUX 3 layer, chooser,
      HTML and vite entries, MCP asset resolution.
- [x] Slice 6: `image-edit-panels.md` and routing updates.

### Product Behavior

- [x] Chooser groups, Selected pill, take numbers, suggested choice, submit and
      cancel states match the mockup.
- [x] Panel version strip sits above the image and shows Selected and parent
      labels.
- [x] Two columns down to 760px.
- [x] Only coloured number chips on the image; Remove regions hatched.
- [x] Whole image, Style reference, Regions, Output in that order.
- [x] Style reference picker lists only Production and Storyboard Lookbook
      sheets.
- [x] Edit base follows Studio selection, or the newest lineage version for
      types without selection; no base disables Generate with the notice.
- [x] Success shows the new version with comparison; failure shows the message.
- [x] Every control uses local `src/ui` components; no raw controls in feature
      code.

### Tests And Guardrails

- [x] Review regressions cover outside selections, exact parents with ancestor
      references, style-sheet changes and consume failure recovery.
- [x] Migration 0090 is generated with Drizzle Kit; prior migration tests build
      their fixture from only earlier journal entries.
- [x] Review-fix final architecture, lint, type checks and package tests pass:
      Core 675, Codex 74 and Studio 583 tests; Core/Codex builds; Core/Codex
      lint and production/test types; Studio test types; media Skill validators.
- [x] Core, Codex runtime and Studio behavior tests listed above.
- [x] Architecture tests stay green and new Core boundary check added.
- [ ] Skill validators pass. (All pass except `shipped skills separate temporary working files from retained Previs authoring`, which fails identically without these changes.)

### Documentation

- [x] ADR 0113 added.
- [x] `docs/architecture/media-generation.md` section added.
- [x] `docs/cli/commands.md` updated.
- [x] studio-skills guides and routing updated.

### Final Verification

- [x] Root `pnpm build`, `test`, `lint`, `type-check` pass.
- [ ] Native Codex Desktop run on a backed-up Urban Basilica copy completed.
- [x] `git diff --stat` reviewed; large files inspected; no format churn.
- [x] No checklist item satisfied by accepting unreviewable code structure.
- [ ] Only then mark the plan complete.
