# 0029 Location Surfaces UI Redesign

Date: 2026-05-28

Status: implemented

## Goal

Redo the Studio Locations UI so Location Environment Sheets feel like a first
class visual asset across the Locations overview, Location details, and Location
Visual Content tab.

The target behavior is:

- the top-level Locations surface shows location sheet cards in a deliberate
  4:3 frame, with location name and meaningful subtitle copy using the same
  reusable media-card language as the rest of Studio;
- Location Details uses the same spacious editorial style as Cast Details;
- Location Details shows only the selected/preferred composite sheet, not the
  sliced view images;
- every large-image preview uses the shared image preview dialog behavior;
- Location Visual Content lists all Location Environment Sheets as large 4:3
  sheet cards;
- clicking a sheet in Visual Content opens the same preview dialog, extended
  with previous/next controls that cycle through the composite first and then
  the sliced view images;
- each sheet can be toggled active/inactive and deleted through the same shared
  image selection and delete confirmation controls used by Cast and Visual
  Language surfaces.

This is a Studio UI slice. It does not change the media generation workflow or
the grouped import contract.

## References Reviewed

- `packages/studio/src/features/movie-studio/locations/location-overview-panel.tsx`
- `packages/studio/src/features/movie-studio/locations/location-panel.tsx`
- `packages/studio/src/features/movie-studio/cast/cast-overview-panel.tsx`
- `packages/studio/src/features/movie-studio/cast/cast-member-panel.tsx`
- `packages/studio/src/features/movie-studio/cast/cast-member-details-tab.tsx`
- `packages/studio/src/features/movie-studio/cast/cast-member-visual-content-tab.tsx`
- `packages/studio/src/features/movie-studio/cast/cast-member-assets.ts`
- `packages/studio/src/ui/image-overlay-card.tsx`
- `packages/studio/src/ui/image-card-grid.tsx`
- `packages/studio/src/ui/image-selection-control.tsx`
- `packages/studio/src/ui/delete-confirm-dialog.tsx`
- `packages/studio/src/ui/image-preview-dialog.tsx`
- `packages/studio/src/ui/image-aspect-ratio.ts`
- `packages/studio/src/services/studio-project-assets-api.ts`
- `packages/studio/server/routes/assets.ts`
- `packages/studio/server/http/screenplay-responses.ts`
- `packages/core/src/client/assets.ts`
- `packages/core/src/client/resources.ts`
- `packages/core/src/client/locations.ts`
- `packages/core/src/server/resources/screenplay-ui.ts`
- `packages/core/src/server/studio-coordination/resource-keys.ts`
- `packages/core/src/server/database/access/location-environment-sheets.ts`
- `docs/architecture/frontend.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/decisions/0013-use-core-owned-project-assets-and-production-exports.md`
- `docs/decisions/0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
- `docs/decisions/0017-use-scalable-studio-resource-loading.md`
- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `docs/decisions/0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`
- `plans/active/0027-location-environment-sheet-media-generation.md`
- `plans/active/0028-location-environment-sheet-redesign.md`
- `build-web-apps:frontend-app-builder` skill guidance, applied as a
  targeted existing-design-system redesign. No Image Gen concept is needed for
  this plan because the requested direction is to match existing Cast and shared
  Studio media surfaces, not invent a new visual system.

## Current State

Locations are behind the rest of the media UI:

- `LocationOverviewPanel` still uses `ScreenplayImageCardGrid` and
  `ScreenplayImageCard` from `features/movie-studio/screenplay-media`. Those
  cards are feature-local and do not share the newer media-card control slots,
  selection state, or preview behavior.
- `LocationOverviewPanel` does not currently listen for
  `renku:studio-resource-changed`, so newly generated/imported location sheets
  may not appear until the user refreshes or navigates away and back.
- `LocationPanel` only loads `readLocationResource`. It does not load the
  selected location's asset page, so the Visual Content tab cannot render
  sheets or mutate take/select state.
- Location Details uses `ScreenplayPrimaryImage`, which has no shared preview
  dialog behavior and does not match the Cast Details layout.
- The Visual Content tab is a placeholder.
- The Studio assets route already supports listing, selecting, unselecting, and
  serving location asset files. It does not yet support deleting a location
  asset through `DELETE /locations/:locationId/assets/:assetId`.
- Location Environment Sheet assets are grouped assets:
  - `asset.type = location_environment_sheet`
  - `location_asset.role = environment_sheet`
  - file roles are `composite`, `view_front`, `view_right`, `view_back`, and
    `view_left`.
- `readLocationOverviewResource` and `readLocationResource` already prefer a
  selected `environment_sheet` asset as the location's `firstImage`. This means
  the overview can keep using the lightweight resource endpoint instead of
  loading every location asset page.

## Product Decisions

### Location Sheet Is The Card Image

The composite file is the primary visible artifact for Locations UI.

Locations overview cards, Location Details, and Location Visual Content cards
should use the `composite` file when rendering a Location Environment Sheet.

The sliced view files are still useful, but they should not appear as separate
cards or thumbnails in this slice. They are shown only inside the preview dialog
carousel after the composite sheet.

### Active Means Select

The Location Visual Content "active" state maps directly to the asset
relationship selection state:

```text
asset.selection.kind === "select"
```

The UI should allow one active environment sheet per Location. If the user
activates a sheet while another environment sheet is active, the implementation
should select the clicked asset and unselect the other selected assets with the
same role, matching the Cast image behavior.

Clicking the active sheet's selection control again clears it.

### Text Must Stay Intentional

Visible card text should come from domain data:

- location overview card title: `location.name`;
- location overview subtitle: `location.timePeriod`, only when present;
- no raw filenames;
- no asset ids;
- no generated role names such as `environment_sheet`;
- no generic filler subtitle such as `Location` just to occupy space;
- visual-content sheet cards can be visually quiet because the section title
  already says they are Location Sheets.

### Desktop First

This work should be verified on desktop Studio viewports only. Do not add
mobile-specific behavior or report mobile QA unless a later request asks for it.

## UI Architecture

### Shared UI Primitives

Use the existing `src/ui` media primitives wherever possible:

- `ImageOverlayCard` for visual-content sheet cards with action slots;
- `ImageCardGrid` for repeated media cards;
- `ImageSelectionControl` for active/inactive sheet state;
- `DeleteConfirmDialog` for destructive sheet deletion;
- `ImagePreviewDialog` for large image preview;
- `Button`, `Dialog`, `Tooltip`, and other local shadcn-style controls only.

Do not write raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<dialog>`, or
similar browser controls in feature code.

If the top-level overview needs a caption-below media card that
`ImageOverlayCard` should not own, add a real domain-neutral `src/ui`
component, for example `image-caption-card.tsx`. This must be a genuine shared
card anatomy, not a pass-through wrapper around a feature component. Update
callers directly rather than adding compatibility barrels or aliases.

### Location Feature Components

Add precise Location-owned feature files:

```text
packages/studio/src/features/movie-studio/locations/location-assets.ts
packages/studio/src/features/movie-studio/locations/location-details-tab.tsx
packages/studio/src/features/movie-studio/locations/location-visual-content-tab.tsx
```

Keep product-specific filtering, file-role selection, and Location copy in the
Locations feature. Keep reusable card/dialog/control implementation in `src/ui`.

Do not import Cast private child components into Locations. Matching Cast style
means using the same primitives and visual conventions, not creating a
feature-to-feature dependency.

## Data And Asset Helpers

Create `location-assets.ts` with Location-specific helpers:

```ts
export const LOCATION_ENVIRONMENT_SHEET_ROLE = 'environment_sheet';
export const LOCATION_ENVIRONMENT_SHEET_TYPE = 'location_environment_sheet';

export const LOCATION_ENVIRONMENT_SHEET_FILE_ROLES = [
  'composite',
  'view_front',
  'view_right',
  'view_back',
  'view_left',
] as const;
```

The helper should expose focused functions:

- `locationEnvironmentSheetAssets(assets)`: returns ready image assets with
  `role === "environment_sheet"` and a composite file;
- `selectedLocationEnvironmentSheetAsset(assets)`: returns the selected sheet,
  or `null`;
- `preferredLocationEnvironmentSheetAsset(assets)`: selected sheet first, then
  first take;
- `locationEnvironmentSheetFile(asset, role)`: reads a named file role without
  guessing from filenames;
- `locationEnvironmentSheetCompositeUrl(projectName, locationId, asset)`:
  returns the composite file URL;
- `locationEnvironmentSheetAspectRatio(asset, fallbackAspectRatio)`: uses
  stored composite dimensions and falls back to `4 / 3`;
- `locationEnvironmentSheetPreviewImages(projectName, locationId, asset)`:
  returns preview images in this exact order:
  - composite sheet;
  - front view;
  - right view;
  - back view;
  - left view.

The preview helper should skip a missing view file only if the asset contract
already allowed incomplete assets. Current grouped imports require all five
roles, so missing file roles should be treated as invalid UI data and excluded
from the preview list with no invented fallback image.

## Service API Work

Extend `packages/studio/src/services/studio-project-assets-api.ts` with Location
asset functions that mirror Cast:

```ts
readLocationAssets(projectName, locationId)
selectLocationAsset(projectName, locationId, assetId)
unselectLocationAsset(projectName, locationId, assetId)
deleteLocationAsset(projectName, locationId, assetId)
locationAssetFileUrl(projectName, locationId, assetId, assetFileId)
```

The service file should keep endpoint construction private and continue to use
`readStudioApiError` for non-OK responses.

Add the missing server route:

```text
DELETE /studio-api/projects/:projectName/locations/:locationId/assets/:assetId
```

The route should call:

```ts
projectData.deleteAsset({
  projectName,
  target: { kind: 'location', locationId },
  assetId,
});
```

The response should match Cast shape:

```json
{
  "assetId": "asset_id",
  "resourceKeys": [
    "assets:location:<location-id>",
    "surface:location:<location-id>"
  ]
}
```

No Core asset command is needed for this route because `deleteAsset` already
supports `AssetTarget.kind === "location"` and deletes grouped
Location Environment Sheet records through the existing delete path.

## Top-Level Locations Overview

Update `LocationOverviewPanel` to use the shared media card/grid direction.

Behavior:

- load `readLocationOverviewResource(projectName)` as it does today;
- add `resourceRevision` state and listen for
  `renku:studio-resource-changed`;
- refresh when resource keys include:
  - `navigation:locations`;
  - any key starting with `assets:location:`;
  - any key starting with `surface:location:`;
- render one card per location;
- use the location's `firstImage?.url` as the sheet image URL;
- pass a 4:3 card contract:

```tsx
aspectClassName='aspect-[4/3]'
aspectRatio={4 / 3}
```

- use `object-contain` for environment-sheet composites so the whole sheet is
  visible;
- keep the current useful width by using a grid minimum around `260px`;
- title is `location.name`;
- subtitle is `location.timePeriod` only when present;
- click selects the Location route.

Expected impact example:

- If "Edirne Test Field" has an active environment sheet and
  `timePeriod = "Late Ottoman frontier"`, the overview card shows the full 4:3
  sheet, then the name and time period using the shared card treatment.
- If the location has no time period, the card shows the name only and does not
  invent a generic subtitle.

## Location Details Tab

Replace the current details markup with a `LocationDetailsTab` modeled on Cast
Details.

Inputs:

```ts
projectName: string;
locationId: string;
resource: LocationResourceResponse;
assets: StudioAssetResponse[];
```

Visual structure:

- same full-height panel background treatment as Cast Details;
- same centered max width around `1240px`;
- same two-column header rhythm on wide desktop;
- left side: selected/preferred composite sheet in one large 4:3 feature image;
- right side:
  - time period pill only if `location.timePeriod` exists;
  - large `location.name` heading;
  - `location.description`, if present;
- lower report section:
  - section title: `Visual Notes`;
  - `location.visualNotes`, if present.

Information must not repeat:

- do not show `timePeriod` both as a pill and as a fact card;
- do not show `description` in two sections;
- do not show `visualNotes` in the header and again below;
- do not show the same composite sheet twice in Details;
- do not show the sliced view images in Details;
- do not show asset title, role, or filename copy in Details.

Preview behavior:

- clicking the feature image opens `ImagePreviewDialog`;
- the details preview uses the composite sheet only;
- it does not expose next/previous sliced-image controls.

Expected impact example:

- A location with name, time period, description, visual notes, and one active
  sheet reads like Cast Details: the sheet is the visual anchor, the description
  explains the place, and visual notes sit in one clearly labeled section.
- A location with no sheet still has a polished empty visual frame instead of a
  bare placeholder card.

## Location Visual Content Tab

Add `LocationVisualContentTab`.

Inputs:

```ts
projectName: string;
locationId: string;
assets: StudioAssetResponse[];
onToggleActive: (asset: StudioAssetResponse) => Promise<void>;
onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
```

Behavior:

- filter to Location Environment Sheet assets only;
- render a single section titled `Location Sheets`;
- show a quiet count label such as `1 image` or `3 images`;
- use `ImageCardGrid` with large cards, matching the Cast character sheet
  scale:

```tsx
gridClassName='grid-cols-[repeat(auto-fill,minmax(480px,1fr))]'
```

- render each sheet with `ImageOverlayCard`;
- card image is the `composite` file;
- pass 4:3 aspect class and numeric ratio;
- use `object-contain`;
- do not render the four sliced view files as cards;
- lower-right control is `ImageSelectionControl`;
- top-right action is `DeleteConfirmDialog` with a trash icon button;
- clicking the card opens the preview carousel for that sheet.

Selection behavior:

- if the sheet is selected, clicking the control calls
  `unselectLocationAsset`;
- if the sheet is not selected, clicking the control calls
  `selectLocationAsset`;
- after selecting a new sheet, unselect other selected `environment_sheet`
  assets for the same Location;
- refresh the Location resource and asset page after selection changes.

Delete behavior:

- deletion uses `DeleteConfirmDialog`;
- dialog title: `Delete Location Sheet?`;
- dialog message: `Remove this location sheet from this location. This cannot be undone.`;
- after deletion, refresh the Location resource and asset page;
- if the deleted sheet is currently open in the preview dialog, close the
  preview.

Expected impact example:

- A Location with three generated sheets shows three large 4:3 sheet cards.
  The active card has the shared selected border treatment. The user can set a
  different sheet active, clear the active sheet, or delete a sheet after
  confirmation.

## Image Preview Dialog Extension

Extend the shared `ImagePreviewDialog` so it can preview either:

- one image; or
- a finite ordered image set with previous/next controls.

Keep this in `src/ui`; do not build a Location-only dialog.

The API can evolve to an ordered image collection, for example:

```ts
export interface PreviewImage {
  src: string;
  alt: string;
  title: string;
}

interface ImagePreviewDialogProps {
  images: PreviewImage[];
  currentIndex: number;
  onCurrentIndexChange?: (index: number) => void;
  onOpenChange: (open: boolean) => void;
}
```

If the implementation changes the current single-image prop shape, update Cast
and other existing callers directly in the same slice. Do not keep a second
compatibility component or re-export alias.

Dialog behavior:

- no carousel controls when there is only one image;
- previous/next controls use local `Button` and icon components, not text
  glyphs;
- controls cycle:
  - previous from the first image goes to the last image;
  - next from the last image goes to the first image;
- keyboard left/right can cycle when the dialog is open if this can be added
  cleanly without overcomplicating the component;
- the close control remains the same;
- the image area keeps the current `object-contain` behavior and runtime aspect
  measurement.

For Location Environment Sheets, the image order must be:

1. composite sheet;
2. front view;
3. right view;
4. back view;
5. left view.

The first image shown after clicking a Visual Content card must always be the
composite sheet.

## Location Panel Container

Update `LocationPanel` to match `CastMemberPanel`'s data flow:

- load `readLocationResource(projectName, locationId)` and
  `readLocationAssets(projectName, locationId)` together;
- store `assets` in component state;
- add a `refreshLocation` callback that reloads both resource and assets;
- listen for `renku:studio-resource-changed`;
- refresh when keys include:
  - `assets:location:<locationId>`;
  - `surface:location:<locationId>`;
- keep `Tabs`, `TabsContent`, and `LineTabBar`;
- pass `resource` and `assets` into `LocationDetailsTab`;
- pass `assets`, `toggleActive`, and `removeAsset` into
  `LocationVisualContentTab`;
- use `toast.error` for failed select/delete requests, matching Cast.

Error copy should be location-specific:

```text
Unable to load location.
Location request failed.
```

Do not add a broad project refresh or eagerly load location assets in the
project shell.

## No Schema Or Migration Work

This plan does not change the SQLite schema.

The existing grouped Location Environment Sheet records remain the source of
truth for sheet/view relationships. The UI reads file roles from `Asset.files`
and must not infer ownership or order from project-relative paths.

If implementation discovers that the current contracts cannot identify the
composite and view files reliably, stop and design the missing contract
explicitly. Do not add filename heuristics as a fallback.

## Tests

### Studio Route Tests

Update `packages/studio/server/routes/assets.test.ts`:

- location assets can be deleted through `DELETE /locations/:locationId/assets/:assetId`;
- the delete response includes:
  - `assetId`;
  - `assets:location:<locationId>`;
  - `surface:location:<locationId>`;
- the route calls `projectData.deleteAsset` with
  `{ kind: 'location', locationId }`.

### Studio Component Tests

Add a focused Location panel test file:

```text
packages/studio/src/features/movie-studio/locations/location-panel.test.tsx
```

Cover:

- Location Details opens the shared preview dialog for the composite sheet;
- Location Details does not render sliced view images as separate visible
  cards;
- Visual Content renders all environment sheet assets as large sheet cards;
- clicking a Visual Content sheet opens the dialog on the composite first;
- next/previous controls cycle to the sliced view images in the required order;
- clicking the active control on the active sheet calls `unselectLocationAsset`;
- clicking the active control on an inactive sheet calls `selectLocationAsset`
  and unselects any other selected environment sheet;
- deleting a sheet calls `deleteLocationAsset` only after confirmation.

Update app-level tests only if route loading or endpoint expectations change.

### Shared Dialog Tests

If `ImagePreviewDialog` gains carousel state, add a small `src/ui` test or cover
the behavior through the Location panel test:

- no previous/next controls for one image;
- previous/next controls appear for multiple images;
- cycling wraps at both ends;
- accessible labels identify the controls.

## Verification

Run focused checks first:

```bash
pnpm test:studio
pnpm lint:studio
pnpm build:studio
```

If changes touch server route typing or shared core contracts, also run:

```bash
pnpm test:core
pnpm test:cli
```

Browser verification should use the Browser plugin first, at desktop sizes
only:

- open Studio with a project that has Location Environment Sheet assets;
- inspect the top-level Locations overview;
- open a Location Details tab;
- open the Location Visual Content tab;
- click a sheet and cycle through the preview images;
- toggle active off and on;
- delete a sheet from a disposable/test project only;
- confirm generated/imported location resource-change events refresh the
  visible cards without a browser reload.

Visual QA should compare against the existing Cast Details and Cast Visual
Content surfaces:

- 4:3 sheet aspect ratios remain stable;
- card width is large enough and does not shrink below the current useful
  overview width;
- labels do not overlap image content;
- selected state appears in the lower-right card control;
- delete action appears in the top-right hover/focus action slot;
- Details uses Cast's spacing, typography, section rhythm, and image scale;
- no sliced view thumbnails appear outside the preview dialog.

Do not run or report mobile viewport checks.

## Acceptance Criteria

- Locations overview uses reusable Studio media-card primitives, not the old
  feature-local screenplay image card surface.
- Locations overview cards render the selected/preferred location sheet in a
  4:3 frame.
- Locations overview preserves the current useful card width.
- Locations overview shows only meaningful name/subtitle copy.
- Location Details visually matches the Cast Details style.
- Location Details does not repeat time period, description, or visual notes.
- Location Details does not show sliced view images.
- Details image preview uses the shared image preview dialog.
- Visual Content shows all Location Environment Sheet composites as 4:3 cards.
- Visual Content does not show sliced view images as separate cards.
- Visual Content card click opens the shared preview dialog on the composite
  sheet first.
- Preview previous/next controls cycle through composite, front, right, back,
  and left images.
- Active toggling uses `ImageSelectionControl` and maps to asset select state.
- Deletion uses `DeleteConfirmDialog`.
- Location asset deletion is available through the Studio server route.
- Location panels refresh after scoped location resource-change events.
- No raw browser controls are introduced in feature code.
- No compatibility aliases, re-export stubs, wrapper facades, filename
  heuristics, or fallback readers are added.
- Focused Studio tests, lint, build, and desktop Browser verification pass.

## Checklist

- [x] Add Location asset service functions in `studio-project-assets-api.ts`.
- [x] Add the missing location asset delete route and route test coverage.
- [x] Add `location-assets.ts` with explicit environment sheet role/file-role
      helpers.
- [x] Extend `ImagePreviewDialog` for optional ordered image sets with
      previous/next cycling.
- [x] Update existing dialog callers directly if the dialog API changes.
- [x] Update `LocationOverviewPanel` to use reusable media-card primitives,
      4:3 aspect ratio, meaningful copy, and scoped refresh events.
- [x] Add `LocationDetailsTab` with Cast Details styling and composite-only
      preview behavior.
- [x] Add `LocationVisualContentTab` with large sheet cards, active toggle,
      delete confirmation, and preview carousel.
- [x] Update `LocationPanel` to load assets, refresh scoped resources, and wire
      selection/deletion behavior.
- [x] Add focused Location component tests.
- [x] Add or update shared dialog carousel tests.
- [x] Run `pnpm test:studio`.
- [x] Run `pnpm lint:studio`.
- [x] Run `pnpm build:studio`.
- [x] Verify the UI in Browser at desktop viewport sizes.
- [x] Confirm no visible raw filenames, asset ids, generated role names, or
      generic filler labels appear on location cards.
- [x] Confirm sliced view images appear only inside the preview carousel.
