# 0021 Visual Language Inspiration And Lookbook UI

Date: 2026-05-22

Status: draft

## Goal

Design the first Studio UI for the redesigned Visual Language section.

The UI should make Visual Language feel like a real creative workspace, not a
placeholder settings page:

- Inspiration gives users a clear place to collect and analyze reference grabs.
- Lookbooks let users compare generated visual language options and inspect one
  active guide at a time.
- The design borrows the strongest ideas from the cinema-analysis prototype
  while fitting Renku Studio's existing app shell, Shadcn controls, typography,
  color tokens, and information-dense panel style.

This plan is for the Studio UI and its browser/server resource surfaces. The
data model plan is:

- `plans/active/0020-visual-language-inspiration-lookbook-data-model.md`

## References

- `docs/architecture/reference/front-end-guidelines.md`
- `docs/product/design-guidelines.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `plans/active/0020-visual-language-inspiration-lookbook-data-model.md`
- `/Users/keremk/Projects/cinema-analyze/skills/renku-cinema-analyze/assets/viewer.html`

## Product Requirements Captured

The Visual Language sidebar entry becomes a dropdown with two children:

```text
Visual Language
  Inspiration
  Lookbooks
```

### Inspiration

The Inspiration surface has:

- A left bar inside the detail area.
- User-created Inspiration folders in that left bar.
- An add action in the left bar bottom area.
- A trash action on folder rows, with confirmation before deletion.
- A right pane with two tabs:
  - Grabs
  - Analysis
- The Grabs tab supports drag and drop and upload by button.
- The upload/dropzone flow accepts multiple images in one action.
- Grab images display as lightweight cards in a responsive grid.
- Each image card has a small footer.
- The image delete action sits on the right side of the footer and appears on
  hover to reduce clutter.
- The Analysis tab is empty until an agent writes analysis.
- The empty Analysis tab tells the user that the Renku skill can analyze the
  folder images.
- Analysis renders:
  - Thesis
  - Palette
  - Tone & Mood
  - Composition
  - Lighting
  - Texture
  - Lineage

### Lookbooks

The Lookbooks surface has:

- Multiple generated visual language options for the movie.
- A top-level Lookbooks index that shows concrete lookbooks as cards.
- Zero or one active lookbook at a time.
- A way to select a lookbook as the active lookbook.
- The active lookbook state available from the Visual Language sidebar
  dropdown, including the legitimate no-active-lookbook state.
- A generated lookbook card image stored as an explicit database-backed
  relationship so the UI can render the deliberate card image.
- A concrete lookbook detail surface with the generated visual language.
- Editable sections in the durable model, while the first UI iteration leaves
  the exact editing controls undefined.
- Inline generated images as examples.
- Per-section actions for future probing or regeneration.
- The sections:
  - Thesis
  - Palette
  - Tone & Mood
  - Composition
  - Lighting
  - Texture
  - Camera

The first implementation should not invent a built-in generation workflow in
the browser. Agents will use Renku commands to generate analysis, Lookbook JSON,
and example images. The UI should display those outputs, support active
lookbook selection, and expose clear places where generation actions and
carefully designed editing controls will attach later.

Users are allowed to switch the active lookbook after creating downstream
assets such as shots, character sheets, or other generated material. The product
does not automatically migrate those assets. The user is responsible for
regenerating downstream assets when they want them to match the newly active
lookbook.

Having no active lookbook is a legitimate state. Generation workflows that
depend on a lookbook must explicitly check for an active lookbook and fail with
a clear structured diagnostic when one is required but missing.

## Design Direction

Use the prototype's **Cinema** style as inspiration, not as a direct copy.

Carry over:

- Numbered visual sections.
- A two-column section rhythm on wider screens: section label on the left,
  content on the right.
- Palette swatches with names, hex values, and meaning.
- Tone strip derived from palette colors.
- Mood tags.
- Pattern rows for Composition, Lighting, and Camera.
- Inline image grids that invite inspection.
- A restrained cinematic feel.

Adapt to Studio:

- Use Renku Studio theme tokens from `packages/studio/src/styles/theme.css`.
- Keep the existing `PanelShell` as the outer frame.
- Use the app's compact `text-[11px] uppercase tracking-[0.12em]` section
  header language.
- Keep typography smaller and denser than the prototype because this is an app
  work surface, not a standalone report page.
- Avoid the prototype's full topbar, style switcher, page hero, and external
  FilmGrab attribution.
- Do not add decorative gradient blobs or oversized marketing sections.
- Use real project images as the visual weight.

The surface should feel like a cinematographer's working notebook inside Renku
Studio: calm, visual, dense enough for repeated use, but still beautiful.

### Shared Report Rendering

Inspiration Analysis and concrete Lookbook detail pages must use the same
report rendering system.

This is important because the user will keep iterating on the report treatment:
section rhythm, palette rendering, tone strip, mood chips, pattern rows, image
grids, and spacing should change in one place instead of drifting between
Analysis and Lookbook.

Shared components should be designed around the current section schemas and
support both modes:

- **Read-only Inspiration Analysis**, where supporting images come from
  folder-local `imageFiles`.
- **Read-only Lookbook v1**, where supporting images come from
  `lookbook_image_section` placement rows.
- **Future editable Lookbook**, where section renderers can receive action slots
  or editing affordances without rewriting the report layout.

Do not define the Lookbook editing UI in this iteration. The first shared
components should make editability possible later, but the concrete controls,
dialogs, field grouping, and validation behavior belong to the next iteration.

## Shadcn UI Requirement

Feature code must not use raw browser controls.

Use local primitives from:

```text
packages/studio/src/ui/
```

Expected primitives:

- `Button`
- `Input`
- `Dialog`
- `Tabs`
- `Textarea`
- `FileUploadDropzone`
- `Tooltip`
- `Card` only for repeated image/section items when a framed item is needed

Use lucide icons for icon buttons:

- `Palette`
- `Images`
- `BookOpen`
- `Plus`
- `Trash2`
- `Upload`
- `Sparkles`
- `Pencil`
- `RefreshCw`
- `ImageOff`

Every icon-only action needs an accessible label and, where helpful, a tooltip.

## Routes And Selection

The browser URL remains the owner of Studio navigation.

Add current Visual Language selections:

```ts
type StudioSelection =
  | { type: 'inspiration'; folderId?: string }
  | { type: 'lookbooks' }
  | { type: 'lookbook'; lookbookId: string }
```

Remove the old single selection:

```ts
{ type: 'visualLanguage' }
```

Proposed routes:

```text
/projects/:projectName/visual-language
/projects/:projectName/visual-language/inspiration
/projects/:projectName/visual-language/inspiration/:folderId
/projects/:projectName/visual-language/lookbooks
/projects/:projectName/visual-language/lookbooks/:lookbookId
```

Behavior:

- `/visual-language/inspiration` opens the Inspiration surface and selects the
  first folder if folders exist.
- `/visual-language/inspiration/:folderId` opens that folder or shows a
  structured route error if it does not exist.
- `/visual-language/lookbooks` opens the Lookbooks index with cards for all
  lookbooks.
- `/visual-language/lookbooks/:lookbookId` opens that concrete lookbook or
  shows a structured route error if it does not exist.
- `/visual-language` is the parent route for the Visual Language sidebar group.
  Use it only as a navigation convenience, not as a separate compatibility
  surface. Recommended behavior: redirect to `/visual-language/inspiration`
  because Inspiration is the first child in the sidebar and is useful even when
  no lookbooks exist.

Why this route exists:

- Users or browser history may land on the parent Visual Language URL.
- The route should choose a real child surface so the app never shows an
  ambiguous blank Visual Language page.
- This is not backwards compatibility with the old single Visual Language
  screen; it is the canonical parent route behavior for the new sidebar group.

## Sidebar Design

Update:

```text
packages/studio/src/features/movie-studio/studio-sidebar/
  studio-sidebar.tsx
```

The sidebar should show Visual Language as a collapsible section:

```text
Visual Language
  Inspiration
  Lookbooks
    <active lookbook or no active lookbook state>
    <other lookbook>
```

Design details:

- Use the existing `StudioSidebarSection` pattern so it feels consistent with
  Cast, Locations, and Acts.
- Use `Palette` for the parent.
- Use `Images` or `BookOpen` for Inspiration.
- Use `Palette` or `Sparkles` for Lookbooks.
- Show concrete lookbooks in the sidebar dropdown after the Lookbooks index
  row, using their display names.
- Mark the active lookbook when one has been selected. If no lookbook is active,
  show that state plainly instead of implying a default.
- Selecting a concrete lookbook in the sidebar navigates to that lookbook's
  detail route.
- The active lookbook selection control should be available in the sidebar
  dropdown. It can be an inline active indicator plus a small "set active"
  action, or another compact Shadcn-based control if it fits the existing
  sidebar pattern.
- Avoid count text until the new resource counts are deliberately designed.
  "2 sections" is acceptable if the existing row needs detail text.
- Auto-expand Visual Language when either child route is active.

## Data Model Update Needed

The current implemented data model does **not** yet support multiple lookbooks.

Plan `0020` and the current core contracts describe a single `lookbook` row per
project. The implementation also has single-resource operations such as
`readLookbook(projectName)` and `upsertLookbook(...)`.

Before implementing this UI, update the data model/API plan and core contracts
for multiple named lookbooks:

- `lookbook` must allow multiple rows per project database.
- Each lookbook needs user-facing display metadata, at minimum a `name`.
- Each lookbook needs an explicit database-backed card image relationship. The
  card image is generated by an agent, registered as a project asset, and marked
  as the lookbook's card image so the UI does not guess from existing section
  images or filesystem paths.
- Zero or one lookbook can be active at a time.
- The active lookbook must be persisted in SQLite as nullable state, not
  inferred from latest update time, filesystem paths, or sort order.
- If the active lookbook is deleted, clear the active lookbook state. Do not
  automatically promote another lookbook to active.
- The core API must support listing lookbooks, reading a specific lookbook,
  creating/updating a specific lookbook, deleting a lookbook with confirmation,
  setting the active lookbook, clearing the active lookbook, and setting the
  card image for a lookbook.
- `lookbook_image` should continue to point at the concrete `lookbook_id`.
- Route and resource failures should use structured diagnostics when a
  requested lookbook does not exist.

This is a planned model change, not a compatibility layer. Update callers
directly to the multiple-lookbook contract and do not keep old single-lookbook
aliases.

## Frontend Feature Structure

Keep all feature components inside:

```text
packages/studio/src/features/movie-studio/visual-language/
```

Recommended structure:

```text
packages/studio/src/features/movie-studio/visual-language/
  inspiration-panel.tsx
  lookbooks-panel.tsx
  lookbook-panel.tsx
  empty-state.tsx
  visual-language-report.tsx
  visual-language-report-section.tsx
  visual-language-palette-section.tsx
  visual-language-tone-mood-section.tsx
  visual-language-pattern-section.tsx
  visual-language-texture-section.tsx
  visual-language-camera-section.tsx
  visual-language-image-grid.tsx
  visual-language-image-card.tsx

  inspiration-folder-sidebar.tsx
  inspiration-folder-row.tsx
  inspiration-folder-create-dialog.tsx
  inspiration-folder-delete-dialog.tsx
  grabs-tab.tsx
  grab-grid.tsx
  grab-card.tsx
  inspiration-analysis-tab.tsx

  lookbook-card-grid.tsx
  lookbook-card.tsx
  lookbook-active-control.tsx
  lookbook-delete-dialog.tsx
```

File responsibilities:

- `inspiration-panel.tsx`: layout and resource wiring for the Inspiration
  surface.
- `lookbooks-panel.tsx`: top-level Lookbooks index with concrete lookbook cards.
- `lookbook-panel.tsx`: layout and resource wiring for one concrete Lookbook
  detail surface.
- `empty-state.tsx`: small reusable empty states.
- `visual-language-report.tsx`: shared report composition for Inspiration
  Analysis and Lookbook detail.
- `visual-language-report-section.tsx`: shared section header rhythm based on
  the prototype, adapted to Studio tokens, with an optional action slot reserved
  for future Lookbook editing/probing controls.
- Section-specific `visual-language-*` files render palette, tone/mood, pattern,
  texture, and camera content for both Analysis and Lookbook where the section
  exists.
- `visual-language-image-grid.tsx` and `visual-language-image-card.tsx`: shared
  image display. They must support folder-local Inspiration images and
  asset-backed Lookbook images through explicit props rather than path
  inference.
- `inspiration-folder-sidebar.tsx`: left inner sidebar, folder list, and add
  area.
- `inspiration-folder-row.tsx`: one folder row with hover delete affordance.
- `inspiration-folder-create-dialog.tsx`: folder creation form.
- `inspiration-folder-delete-dialog.tsx`: destructive confirmation dialog.
- `grabs-tab.tsx`: upload/dropzone and image grid composition.
- `grab-grid.tsx`: responsive grid.
- `grab-card.tsx`: image card with hover delete action.
- `inspiration-analysis-tab.tsx`: empty notice or report.
- `lookbook-card-grid.tsx`: responsive grid for the top-level Lookbooks index.
- `lookbook-card.tsx`: one lookbook card with explicit card image, name, and
  active state.
- `lookbook-active-control.tsx`: Shadcn-based control for setting a concrete
  lookbook as active.
- `lookbook-delete-dialog.tsx`: confirmation dialog for deleting one lookbook,
  including a stronger warning when the selected lookbook is currently active.

Do not add broad folders such as `components`, `data`, `details`, `manager`, or
`helpers` inside this feature.

## Browser Services

Add:

```text
packages/studio/src/services/
  studio-visual-language-api.ts
```

Keep transport-only response types in:

```text
packages/studio/src/services/studio-project-contracts.ts
```

Recommended service functions:

```ts
readInspirationFolders(projectName, query)
readInspirationFolder(projectName, folderId, query)
createInspirationFolder(projectName, input)
renameInspirationFolder(projectName, folderId, input)
deleteInspirationFolder(projectName, folderId)
uploadInspirationImages(projectName, folderId, files)
deleteInspirationImage(projectName, folderId, fileName)

listLookbooks(projectName)
readLookbook(projectName, lookbookId)
createLookbook(projectName, input)
updateLookbook(projectName, lookbookId, input)
deleteLookbook(projectName, lookbookId)
setActiveLookbook(projectName, lookbookId)
clearActiveLookbook(projectName)
setLookbookCardImage(projectName, lookbookId, imageId)
uploadLookbookImage(projectName, lookbookId, file)
setLookbookImageSections(projectName, imageId, sections)
deleteLookbookImage(projectName, imageId)
```

Names should use resource verbs. Avoid `fetchData`, `load`, `saveStuff`,
`details`, or `visualLanguageClient`.

## Studio Server

Add:

```text
packages/studio/server/routes/
  visual-language.ts

packages/studio/server/http/
  visual-language-responses.ts
```

Responsibilities:

- Route handlers call `ProjectDataService`.
- Response adapters add HTTP URLs for asset files.
- Server code does not open SQLite directly.
- Server code does not infer folders or sections from file paths.
- Upload routes require the Studio API token.
- Inspiration upload routes write files to the selected folder path.
- Lookbook routes operate on a concrete `lookbookId` except for list/create and
  setting the active lookbook.
- Lookbook upload routes write files to core-approved project-relative
  locations for the concrete lookbook, then register assets through core.
- Deleting a lookbook clears the active lookbook pointer when the deleted
  lookbook was active. It must not select a replacement active lookbook.

Mount under:

```text
/studio-api/projects/:projectName/visual-language
```

## Inspiration Layout

Inside `PanelShell`, Inspiration uses a two-pane layout:

```text
InspirationPanel
  Inner sidebar: Inspiration folders
  Main pane:
    Folder header
    Tabs: Grabs | Analysis
```

Suggested desktop sizing:

```text
grid-template-columns: 240px minmax(0, 1fr)
gap: 12px
height: 100%
min-height: 0
```

The inner sidebar:

- Uses `bg-sidebar-bg` or a subtle `bg-muted/20` surface.
- Has a compact header using the section header type pattern.
- Lists folder rows with stable height.
- Keeps the add action pinned at the bottom.
- Uses hover-only delete icons on rows.
- Opens a confirmation dialog before deleting a folder.

The right pane:

- Uses a compact folder title area.
- Shows the reminder that names like movies, cinematographers, or directors are
  useful only when creating or renaming a folder, not as a permanent banner.
- Uses `Tabs` with `variant='line'` if that fits the local primitive.
- Keeps tab content scrollable without resizing the outer `PanelShell`.

Responsive behavior:

- At narrow widths, the folder sidebar can become a top horizontal strip or a
  collapsible section above the tabs.
- The selected folder and tab content must remain readable without overlapping
  the Studio sidebar.

## Inspiration Grabs Tab

The Grabs tab has:

- A dropzone at the top when the folder has no images.
- A compact upload button in the tab header or above the grid when images
  already exist.
- A multi-image upload contract for both drag-and-drop and the upload button.
- A responsive image grid.

Grid rules:

```text
grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))
gap: 12px
```

Image card rules:

- Stable `aspect-ratio: 16 / 9`.
- Image uses `object-cover`.
- Footer has fixed height, for example `h-9`.
- Footer text is small and truncated.
- Delete icon appears on hover and focus-within.
- Delete uses `Button` with `variant='ghost'` or `variant='destructive'`
  depending on the local visual treatment.
- Deleting an image should not shift the rest of the grid until the mutation
  succeeds or the optimistic state is intentionally applied.

Empty state copy:

```text
Drop grabs here or upload images.
```

The exact wording can be refined in implementation, but it should stay short.
The dropzone and hidden file input should allow multiple accepted image files in
one selection. Upload feedback should make it clear when several files are being
processed, and individual failed files should be reported without hiding the
successful uploads.

## Inspiration Analysis Tab

When no analysis exists, show a quiet empty notice:

```text
Use the Renku skill to analyze this folder.
```

This is explicitly requested product copy. Keep it as a compact notice, not a
large instructional panel.

When analysis exists, render it as a report using the same shared section
components as concrete Lookbook detail where possible:

- Thesis section with supporting grabs.
- Palette section with swatches.
- Tone & Mood section with tone strip and mood chips.
- Composition section with pattern rows and supporting grabs.
- Lighting section with technique rows and supporting grabs.
- Texture section with observations and supporting grabs.
- Lineage section with cards for movie, director, and cinematographer
  affinities.

Lineage wording should be careful. The UI should not imply confirmed influence
unless the stored analysis says it is sourced. The prototype's rule is a good
guide: present lineage as visual affinity.

## Lookbooks Index Layout

The top-level Lookbooks route is an index of concrete lookbooks.

Recommended top structure:

```text
LookbooksPanel
  Compact header row
  LookbookCardGrid
```

Avoid a large hero. This is an app surface, and the outer Studio shell already
provides context.

When no lookbooks exist:

- Show a compact empty state.
- Do not build a fake sample lookbook.
- Use this compact product copy:

```text
Use the Renku skill to generate a lookbook.
```

When lookbooks exist:

- Render cards for all lookbooks.
- Each card shows:
  - generated card image when one has been marked in the database;
  - fallback empty image treatment when no image exists;
  - lookbook name;
  - short summary only if available in the resource contract;
  - active state;
  - set-active action when the card is not active;
  - delete action with confirmation.
- Clicking a card opens the concrete lookbook route.
- Setting a lookbook active should not navigate unless that matches the local
  sidebar/card pattern. The active state should update everywhere after the
  mutation succeeds.
- Deleting a lookbook requires confirmation.
- If the lookbook being deleted is currently active, the confirmation dialog
  must state that deleting it will leave the project with no active lookbook.
- After deleting the active lookbook, the UI must show the no-active-lookbook
  state. It must not automatically mark another lookbook active.

Card image rules:

- Use a stable 16:9 or 4:3 image area.
- Use the explicitly marked lookbook card image from the database.
- Use `ImageOff` or a restrained empty treatment when no image exists.
- Do not infer card images from section image ordering, latest update time, or
  filesystem paths.

## Lookbook Detail Layout

A concrete Lookbook is a report-like surface for one generated visual language.

Recommended top structure:

```text
LookbookPanel
  Compact header row with lookbook name and active state
  VisualLanguageReport
```

When the selected lookbook does not exist:

- Show a compact empty state.
- Surface the structured route/resource error if available.

When the selected lookbook exists:

- Render sections in this order:
  1. Thesis
  2. Palette
  3. Tone & Mood
  4. Composition
  5. Lighting
  6. Texture
  7. Camera
- Each section has:
  - compact numbered label;
  - section title;
  - section body;
  - inline images for that section;
  - optional action slot reserved for future edit or probe/regenerate actions.

Suggested section layout on desktop:

```text
grid-template-columns: minmax(180px, 0.38fr) minmax(0, 1fr)
gap: 28px
padding-block: 28px
border-bottom: border-border/40
```

Suggested section layout on narrow screens:

```text
grid-template-columns: 1fr
gap: 12px
```

Do not place every section inside a large decorative card. Use full-width
section bands or unframed section rows inside the panel. Use cards only for
repeated items such as palette swatches, image cards, and lineage items.

## Shared Report Section Rendering

Use the same section components for Inspiration Analysis and Lookbook wherever
the schemas overlap.

The shared renderer should accept a clear source mode instead of branching on
loose object shape:

- Inspiration Analysis resolves supporting images from folder-local filenames in
  `imageFiles`.
- Lookbook resolves supporting images from asset-backed lookbook image placement
  rows.
- Lookbook includes Camera; Inspiration Analysis includes Lineage/Inspired By.

### Thesis

Display:

- thesis statement as readable prose;
- principles as a compact ordered or bulleted list;
- inline generated images.

Use the prototype's "Visual constitution" energy, but keep the Studio version
more compact.

### Palette

Display:

- description;
- color swatches;
- observations;
- inline generated images.

Swatch cards:

- stable aspect ratio for color fill;
- name and hex value;
- meaning as small muted copy.

### Tone & Mood

Display:

- tone phrase;
- mood chips;
- description;
- tone strip derived from palette colors;
- inline generated images.

Tone strip:

- fixed height, for example `h-16`;
- soft border;
- labels: `shadow`, `midtone`, `highlight`.

### Composition And Lighting

Display:

- section description;
- pattern rows;
- inline generated images per pattern if available;
- section-level generated image grid.

Pattern rows should feel like a practical cinematography guide:

- clear name;
- short description;
- supporting images.

### Texture

Display:

- description;
- observations;
- inline generated images.

### Camera

Display:

- description;
- grouped rows for Movement, Motion, and Framing.

Each group contains pattern rows with:

- name;
- description;
- supporting generated images.

## Editing Experience

Lookbooks are editable in the product direction and durable data model, but the
first UI iteration should not define the edit controls yet.

For this plan:

- Do not build `lookbook-section-edit-dialog.tsx` yet.
- Do not show edit buttons until the interaction design is accepted.
- Do not expose raw JSON editing as a placeholder.
- Design shared report components with an optional action slot so future edit
  affordances can attach without changing the section layout.
- Keep service/core update functions in the implementation plan only if they are
  needed by agent or server workflows before the UI exists.

Avoid:

- A raw JSON textarea as the primary editing UI.
- A single giant form for all Lookbook sections.
- Saving invalid JSON and hoping readers recover.

The next iteration should design the actual editing experience carefully,
including which sections are editable first, how repeated rows work, and how
validation errors are shown.

## Probe And Generation Actions

The Lookbook needs a place for per-section probing, but generation execution is
not part of this UI plan.

Recommended first behavior:

- Show a `Sparkles` icon action only when there is a real command or agent
  handoff flow attached.
- If the command is not ready, keep the action out of the UI instead of showing
  a disabled tease.
- When implemented, probing should create a flat Lookbook image and add
  `lookbook_image_section` placement rows for whichever sections the image
  illustrates. One image may appear in several sections.

## Visual Polish Details

Use these visual patterns:

- Soft borders: `border-border/40`.
- Panel backgrounds: `bg-panel-bg`, `bg-sidebar-bg`, and muted translucent
  surfaces.
- Section labels: `text-[11px] uppercase tracking-[0.12em] font-semibold`.
- Body copy: mostly `text-sm`.
- Secondary copy: `text-xs text-muted-foreground`.
- Cards: `rounded-md` or `rounded-lg`; avoid oversized radius.
- Image cards: subtle hover lift is acceptable, but keep it restrained inside
  the app shell.
- Palette swatches: use actual color as content, not as decoration.
- Mood tags: compact chips with muted borders.

Avoid:

- One-note purple or blue gradients.
- Beige-only or parchment-only drift beyond the existing Studio theme.
- Nested cards.
- Large marketing hero layouts.
- Visible tutorial paragraphs beyond the specifically requested analysis empty
  notice.
- Raw SVG icons when lucide icons exist.

## Loading, Empty, And Error States

Inspiration:

- Loading folders: compact skeleton rows in the inner sidebar.
- No folders: empty left bar with add action.
- No selected folder: short main-pane empty state.
- No grabs: dropzone-centered empty state.
- No analysis: requested Renku skill notice.

Lookbooks:

- Loading index: compact card skeletons.
- No lookbooks: compact empty state with `Use the Renku skill to generate a
  lookbook.`
- Lookbooks exist but none is active: compact notice that generation workflows
  need an active lookbook and that the user can choose one from Lookbooks or the
  sidebar dropdown.
- Loading concrete lookbook: section skeletons.
- Missing concrete lookbook: structured route/resource error.
- No images for a section: no placeholder grid unless the section itself would
  look broken.
- Invalid stored section JSON: show a structured error state from the API
  instead of rendering partial nonsense.

Errors:

- Use toasts for mutation failures where the user stays on the same surface.
- Use inline errors for route/resource failures.
- Surface structured diagnostic messages when available.

## Accessibility

Requirements:

- Folder rows are keyboard reachable.
- Hover-only delete actions are also visible on focus-within.
- Dialogs use `DialogTitle` and `DialogDescription`.
- Lookbook delete confirmation dialogs clearly name the lookbook being deleted.
- If the deleted lookbook is active, the dialog states that the project will
  have no active lookbook afterward.
- Icon buttons have accessible labels.
- Tabs use the local `Tabs` primitive.
- Upload dropzone remains connected to a local `Input` primitive.
- Upload dropzone and upload button support multiple image selection with
  accessible status messaging.
- Inspiration images have useful alt text based on filename or folder context.
- Lookbook images have useful alt text based on asset title or section context.
- Lookbook cards have useful labels that include the lookbook name and active
  state.
- Setting a lookbook active is keyboard reachable and does not rely on color
  alone.
- Color swatches include visible hex text so color is not the only information.

## Testing

Add focused tests for:

- Visual Language sidebar dropdown expansion and child navigation.
- Inspiration route parsing and selected folder routing.
- Creating an Inspiration folder.
- Deleting a folder requires confirmation.
- Grabs tab renders upload/dropzone and image cards.
- Grabs upload accepts multiple image files from drop and file selection.
- Image delete action is keyboard reachable.
- Analysis tab renders the empty Renku skill notice.
- Analysis report renders palette, tone, composition, lighting, texture, and
  lineage sections from resource data.
- Lookbooks index empty state renders the Renku skill notice when no lookbooks
  exist.
- Lookbooks index renders multiple lookbook cards with explicit card images
  when available.
- Zero or one lookbook is shown as active.
- Setting a lookbook active updates the index, sidebar dropdown, and concrete
  lookbook header.
- Deleting a lookbook requires confirmation.
- Deleting the active lookbook warns that no lookbook will be active afterward.
- Deleting the active lookbook clears active state and does not promote another
  lookbook.
- Concrete Lookbook route renders all seven sections from resource data.
- Inspiration Analysis and Lookbook use the same shared report section
  components.
- Palette swatches and tone strip render from the section JSON.

If visual changes are substantial, use the Browser plugin to inspect the local
Studio page after implementation.

## Implementation Order

1. Update the data model/API plan and core contracts for multiple named
   lookbooks with zero or one active lookbook and explicit lookbook card images.
2. Update selection and routes for Visual Language children, Lookbooks index,
   and concrete lookbook detail pages.
3. Update the Studio sidebar dropdown, including concrete lookbook rows and
   active lookbook selection.
4. Add Visual Language service functions and server routes for Inspiration and
   multiple Lookbooks.
5. Build Inspiration folder sidebar and empty states.
6. Build Grabs tab with multi-image upload and image grid.
7. Build the shared Visual Language report renderer from the prototype-inspired
   section system.
8. Build Inspiration Analysis using the shared report renderer.
9. Build Lookbooks index cards, active selection, and delete confirmation.
10. Build concrete Lookbook detail using the shared report renderer.
11. Add tests and browser verification.

## Open Questions Before Implementation

None currently.

Settled decisions from review:

- `Lookbook` is the final durable name.
- The sidebar label is plural: `Lookbooks`.
- The parent `/projects/:projectName/visual-language` route should redirect to
  Inspiration.
- Lookbook cards use an explicit generated card image marked in the database.
- Users can delete lookbooks after confirmation.
- Deleting an active lookbook leaves the project with no active lookbook.

## Implementation Checklist

Use this checklist before calling the implementation complete:

- [x] Data model and core contracts support multiple named lookbooks.
- [x] Active lookbook state supports zero or one active lookbook and is exposed
  through the resource contract.
- [x] Deleting the active lookbook clears active state without selecting a
  replacement.
- [x] Each lookbook can have an explicit database-backed generated card image.
- [x] Lookbook images remain attached to concrete `lookbook_id` values.
- [x] Visual Language routes cover Inspiration, Lookbooks index, and concrete
  lookbook detail pages.
- [x] The parent Visual Language route redirects to Inspiration.
- [x] The Studio sidebar shows Visual Language as a dropdown with Inspiration,
  Lookbooks, concrete lookbooks, and active lookbook state.
- [x] Users can set the active lookbook from the sidebar dropdown or Lookbooks
  index.
- [x] The Lookbooks index displays lookbook cards with explicit card images
  when available and a restrained empty image treatment otherwise.
- [x] Users can delete lookbooks after confirmation.
- [x] Deleting an active lookbook shows a warning that no lookbook will be active
  afterward.
- [x] The Lookbooks empty state says `Use the Renku skill to generate a
  lookbook.`
- [x] Inspiration Grabs dropzone and upload button accept multiple images.
- [x] Inspiration Analysis empty state says `Use the Renku skill to analyze this
  folder.`
- [x] Inspiration Analysis and Lookbook detail share report styles, layouts, and
  UI components.
- [x] Shared report components render Thesis, Palette, Tone & Mood,
  Composition, Lighting, and Texture for both applicable surfaces.
- [x] Shared report components render Lineage for Inspiration Analysis.
- [x] Shared report components render Camera for Lookbook detail.
- [x] Lookbook detail does not show edit controls in this first iteration.
- [x] Lookbook report components reserve a clean extension point for future edit
  and generation actions.
- [x] Feature code uses local Shadcn UI primitives instead of raw browser form
  or interactive controls.
- [x] Tests cover multi-image upload, multiple lookbooks, active selection,
  shared report rendering, and required empty states.
- [x] Browser verification checks the Inspiration and Lookbooks surfaces at
  desktop and narrow widths.
