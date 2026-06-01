# 0038 Shot Composition and Location Tabs

Date: 2026-06-01

Status: implemented

## Goal

Finish the non-generation shot design tabs by making the current Camera
Framing work match the director-facing workflow:

- rename **Camera Framing** to **Composition**;
- remove the planned **Camera Type** tab entirely;
- fold lens and focus choices into Composition because they overlap with shot
  size, subject framing, and angle;
- implement the remaining **Location** tab;
- keep all Composition, Motion, and Location selections persisted through the
  existing active Scene Shot List document.

This plan intentionally covers only shot design. The AI Production tab and
shot-video-take generation storage are specified separately in
`0039-shot-ai-production-tab.md`.

## References

- `plans/active/0036-shot-design-tabs.md`
- `plans/active/0037-shot-design-asset-generation.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `packages/core/src/client/scene-shot-list.ts`
- `packages/core/src/client/scene-shot-list-json-schemas.ts`
- `packages/core/src/client/shot-camera-design-labels.ts`
- `packages/core/src/server/scene-shot-list-json/validator.ts`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-detail.tsx`
- `packages/studio/src/features/movie-studio/scenes/use-shot-camera-design.ts`
- `packages/studio/server/routes/screenplay.ts`
- `packages/studio/src/services/studio-screenplay-api.ts`

## Current Baseline

Camera Framing and Camera Motion are already implemented in the shot detail
surface.

The current lower tab list is:

```text
Description
Camera Framing
Camera Motion
Location
Camera Type
```

Only Camera Framing and Camera Motion have real tab content. Location and Camera
Type still render `SceneShotDetailTabPlaceholder`.

The current persistent design object is `SceneShot.cameraDesign` in
`packages/core/src/client/scene-shot-list.ts`. It currently stores:

```ts
export interface ShotCameraDesign {
  shotSize?: ShotSizeId;
  subjectFraming?: SubjectFramingId[];
  cameraAngle?: CameraAngleId;
  dutch?: 'left' | 'right';
  movement?: ShotMovementDesign;
  custom?: ShotCameraDesignCustom;
}
```

Studio already autosaves that object through:

- browser service:
  `packages/studio/src/services/studio-screenplay-api.ts`
  `updateSceneShotCameraDesign`;
- server route:
  `PATCH /screenplay/scenes/:sceneId/shots/:shotId`;
- core project data service:
  `updateSceneShotCameraDesign`;
- active shot-list row update through
  `updateSceneShotListRecordDocument`.

That persistence path is the right one for Composition and Location. This plan
extends it rather than introducing a second design document or a separate table.

## Product Decisions

The shot-detail tab list becomes:

```text
Description
Composition
Camera Motion
Location
AI Production
```

This implementation slice adds the first four tabs and removes Camera Type. The
AI Production tab itself is specified in `0039-shot-ai-production-tab.md`.

Camera Type is removed because it separates lens and focus from framing even
though those decisions are creatively interdependent:

- a close-up on a wide lens reads differently from a close-up on a telephoto
  lens;
- a wide shot on a long lens compresses space and can contradict the geography
  implied by the shot size;
- shallow focus can fight an establishing composition if it hides the space the
  shot was meant to reveal;
- macro behaves like both an optical choice and a subject-framing choice;
- rack focus has an optical state and a temporal action, so it must be
  reconciled with Camera Motion.

## Persistence Decision

Composition and Location persist on `SceneShot.cameraDesign`.

Reason:

- the choices describe the shot's authored design, not a generation run;
- they are needed by the storyboard sheet, video prompts, and later generation
  contexts;
- the existing active Scene Shot List document already owns shot-level design
  data and already has validation, autosave, and resource invalidation;
- no additional database table is needed for this slice.

The implementation must update the existing shot-list JSON schema and semantic
validator so stored project data fails fast when the new fields are malformed.

## Core Contract

Update `packages/core/src/client/scene-shot-list.ts`.

Add lens, focus, and shot-location vocabulary:

```ts
export type LensId =
  | 'ultra-wide'
  | 'wide'
  | 'normal'
  | 'short-tele'
  | 'tele'
  | 'macro';

export type FocusId =
  | 'deep-focus'
  | 'shallow-focus'
  | 'rack-focus'
  | 'tilt-shift';

export type LocationAzimuthViewId =
  | 'front'
  | 'right'
  | 'back'
  | 'left';
```

Add structured equipment and location design:

```ts
export interface ShotEquipmentDesign {
  lens?: LensId;
  lensMillimeters?: number;
  focus?: FocusId;
}

export interface ShotLocationDesign {
  locationId?: string;
  usesDifferentLocation?: boolean;
  azimuthView?: LocationAzimuthViewId;
  customView?: string;
}
```

Update the custom note and camera design contracts:

```ts
export interface ShotCameraDesignCustom {
  composition?: string;
  movement?: string;
}

export interface ShotCameraDesign {
  shotSize?: ShotSizeId;
  subjectFraming?: SubjectFramingId[];
  cameraAngle?: CameraAngleId;
  dutch?: 'left' | 'right';
  movement?: ShotMovementDesign;
  equipment?: ShotEquipmentDesign;
  location?: ShotLocationDesign;
  custom?: ShotCameraDesignCustom;
}
```

`custom.framing` is renamed to `custom.composition`. Do not keep a fallback,
alias, loader branch, or compatibility field for `custom.framing`. Update all
callers directly.

The existing free-text `SceneShot` fields remain the prompt-facing contract:

- `shotType`
- `cameraAngle`
- `cameraMovement`
- `framing`
- `lensIntent`
- `aspectRatio`

Composition edits derive `shotType`, `cameraAngle`, `framing`, and
`lensIntent`. Camera Motion edits derive `cameraMovement`. Location edits do
not overwrite `locationIds`; they refine how a shot uses a location.

## JSON Schema

Update `packages/core/src/client/scene-shot-list-json-schemas.ts`.

The schema must:

- allow `cameraDesign.equipment.lens` only from `LensId`;
- allow `cameraDesign.equipment.focus` only from `FocusId`;
- allow `cameraDesign.equipment.lensMillimeters` as a positive number;
- allow `cameraDesign.location.locationId` as a non-empty string;
- allow `cameraDesign.location.usesDifferentLocation` as a boolean;
- allow `cameraDesign.location.azimuthView` only from
  `LocationAzimuthViewId`;
- allow `cameraDesign.location.customView` as a non-empty string;
- allow `cameraDesign.custom.composition`;
- reject `cameraDesign.custom.framing`;
- keep `additionalProperties: false` for every structured object.

Expected shape:

```ts
equipment: {
  type: 'object',
  properties: {
    lens: enumValue(LENS_IDS),
    lensMillimeters: { type: 'number', exclusiveMinimum: 0 },
    focus: enumValue(FOCUS_IDS),
  },
  additionalProperties: false,
}
```

The schema should continue to reject unknown fields rather than silently
dropping them.

## Semantic Validation

Update `packages/core/src/server/scene-shot-list-json/validator.ts`.

Add semantic checks for `shot.cameraDesign?.location`:

- when `location.locationId` is set and `usesDifferentLocation` is not `true`,
  the location id must already appear in `shot.locationIds`;
- when `usesDifferentLocation` is `true`, the location id may reference any
  valid project location id;
- `azimuthView` and `customView` are mutually exclusive;
- `customView` must contain useful text if present;
- a location override outside the scene should still rely on the existing
  `productionNotes` warning behavior from `shot.locationIds` when the shot
  itself references that outside-scene location.

Add semantic checks for `shot.cameraDesign?.equipment`:

- `lensMillimeters` may only be present with `lens`;
- `lensMillimeters` should be within a practical range, for example `1` to
  `300`;
- `rack-focus` must be reconciled with Camera Motion:
  if `movement.movement === 'rack-focus'` or
  `movement.secondary === 'rack-focus'`, then
  `equipment.focus` must be `rack-focus`;
- if `equipment.focus === 'rack-focus'` and there is no rack-focus movement,
  keep it valid because the optical intent may be preparatory or subtle.

Use structured diagnostics through the existing validator helpers.

## Composition Tab

Rename the current Camera Framing UI to Composition.

### UI Sections

The tab keeps the shipped tile-based controls and adds two compact optical
sections:

1. Shot Size
   - existing single-select ladder from `extreme-close-up` through
     `extreme-wide-shot`;
   - persists `cameraDesign.shotSize`.

2. Subject Framing
   - existing multi-select relationship controls;
   - persists `cameraDesign.subjectFraming`.

3. Camera Angle / Height
   - existing single-select viewpoint ladder;
   - persists `cameraDesign.cameraAngle`;
   - Dutch tilt remains a separate left/right modifier.

4. Lens Intent
   - single-select lens intent;
   - optional numeric millimeter field;
   - persists `cameraDesign.equipment.lens` and
     `cameraDesign.equipment.lensMillimeters`.

5. Focus / Depth of Field
   - single-select focus intent;
   - persists `cameraDesign.equipment.focus`.

6. Custom Composition
   - one textarea;
   - persists `cameraDesign.custom.composition`.

Do not add visible instructional text to explain every control. The tab should
stay as dense and direct as the shipped Camera Framing surface.

### Rack Focus Reconciliation

Rack focus crosses Composition and Camera Motion.

Implementation behavior:

- selecting rack focus in Composition sets `cameraDesign.equipment.focus`;
- selecting rack focus in Camera Motion sets
  `cameraDesign.equipment.focus = 'rack-focus'` in the same update;
- clearing `equipment.focus` while a rack-focus movement remains should either
  clear the rack-focus movement in the same deliberate action or show a compact
  validation state that blocks persistence until reconciled;
- do not store two independent rack-focus values that can disagree.

## Location Tab

Implement Location as a compact shot-context tab inside the same lower
shot-detail tab region.

### UI Sections

1. Shot Location
   - shows the shot's screenplay locations by meaningful name;
   - lets the user choose which shot location this shot uses when more than one
     is present;
   - persists `cameraDesign.location.locationId`.

2. Different Location
   - lets the user intentionally use another project location for flashbacks,
     inserts, screens-within-scenes, cutaways, or imagined views;
   - persists `cameraDesign.location.usesDifferentLocation = true`;
   - selected location id still persists in `cameraDesign.location.locationId`;
   - does not mutate `shot.locationIds`.

3. Environment Sheet Views
   - uses the selected Location Environment Sheet when one exists;
   - displays the four extracted azimuth views:
     `front`, `right`, `back`, `left`;
   - persists `cameraDesign.location.azimuthView`.

4. Custom View
   - one textarea for a view that does not match the four azimuths;
   - persists `cameraDesign.location.customView`;
   - mutually exclusive with `azimuthView`.

The tab must keep visual cards quiet when there is no meaningful product copy.
Do not show asset ids, raw filenames, generated file roles, or generic filler
labels on cards.

### Location Asset Projection

Use the existing location environment-sheet helpers instead of re-querying or
duplicating asset logic:

- `packages/studio/src/features/movie-studio/locations/location-assets.ts`
- `preferredLocationEnvironmentSheetAsset`
- `locationEnvironmentSheetPreviewImages`

Add a feature-local projection file for shot-specific usage:

```text
packages/studio/src/features/movie-studio/scenes/
  scene-shot-location-assets.ts
```

This file should map the selected shot location to:

- the current location record;
- the preferred environment sheet asset;
- the four available environment-sheet view image URLs;
- whether a view is selectable.

The projection belongs in the feature folder because it combines scene-shot
state with location asset state. It should not move to `src/ui` or `src/lib`.

## Studio Frontend Structure

Follow `docs/architecture/reference/front-end-guidelines.md`.

Feature files stay under:

```text
packages/studio/src/features/movie-studio/scenes/
```

Use these names:

```text
scene-shot-composition-tab.tsx
scene-shot-location-tab.tsx
scene-shot-location-assets.ts
scene-shot-design-vocabulary.ts
use-shot-camera-design.ts
shot-camera-design-context.tsx
```

Direct rename:

```text
scene-shot-camera-framing-tab.tsx
  -> scene-shot-composition-tab.tsx
```

Do not add a wrapper component whose only purpose is to keep the old Camera
Framing name alive.

`scene-shot-detail.tsx` owns the tab list and high-level composition. It should
remain responsible for:

- the current video stage;
- the resizable split;
- the lower tab region;
- wiring the `ShotCameraDesignProvider`;
- passing labels and resource refresh callbacks.

The Composition and Location tabs should only own their controls and
feature-local projections.

All controls in feature code must use local shadcn-style primitives from
`packages/studio/src/ui`. Do not add raw `<button>`, `<input>`, `<select>`,
`<textarea>`, or `<dialog>` in feature components.

## Studio API

Reuse the existing camera-design autosave endpoint for this slice:

```text
PATCH /screenplay/scenes/:sceneId/shots/:shotId
```

Request body:

```json
{
  "cameraDesign": {
    "shotSize": "wide-shot",
    "equipment": {
      "lens": "wide",
      "focus": "deep-focus"
    },
    "location": {
      "locationId": "location_basilica_wall",
      "azimuthView": "front"
    }
  }
}
```

The existing route should keep returning:

- refreshed `SceneShotListResourceResponse`;
- scoped `resourceKeys` from `sceneShotListResourceKeys`.

No new Studio server route is required for Composition or Location persistence.

## Autosave

Update `use-shot-camera-design.ts`:

- initialize from `shot.cameraDesign`;
- autosave the full `ShotCameraDesign` object;
- treat `equipment`, `location`, and `custom.composition` as meaningful when
  deciding whether an empty object should be persisted as `null`;
- keep `custom.movement` behavior for Camera Motion;
- preserve the current debounced save behavior.

There is no explicit Save button.

## Derived Labels

Update `packages/core/src/client/shot-camera-design-labels.ts`.

Derive:

- `shotType` from `shotSize`;
- `cameraAngle` from `cameraAngle` and `dutch`;
- `framing` from subject framing plus `custom.composition`;
- `lensIntent` from lens, lens millimeters, focus, and relevant custom
  composition text;
- `cameraMovement` from movement plus `custom.movement`.

The derivation must not invent noisy prompt text. It should produce concise,
director-readable phrases that are useful to prompt generation.

## Resource Refresh

When Composition or Location is saved, Studio receives the refreshed shot-list
resource through the existing route. The owning shot list container should
continue replacing its local resource with the returned resource.

If the Location tab displays generated location assets, it must refresh those
asset previews when Studio coordination events include location media resource
keys. Do this locally in the shot tab container; do not expand the project shell
to eagerly load all location assets.

## Implementation Checklist

- [x] Update `SceneShot.cameraDesign` contracts with `equipment`, `location`,
      and `custom.composition`.
- [x] Update shot-list JSON schema for the new fields.
- [x] Update shot-list semantic validation for location references,
      azimuth/custom exclusivity, lens millimeters, and rack-focus
      reconciliation.
- [x] Update camera-design label derivation.
- [x] Rename Camera Framing UI files and symbols to Composition.
- [x] Remove the Camera Type tab and placeholder.
- [x] Add Lens Intent controls to Composition.
- [x] Add Focus / Depth of Field controls to Composition.
- [x] Update Camera Motion rack-focus behavior.
- [x] Implement `SceneShotLocationTab`.
- [x] Add `scene-shot-location-assets.ts` projection.
- [x] Update `use-shot-camera-design.ts` empty-design detection.
- [x] Add focused core tests for schema, semantic validation, and label
      derivation.
- [x] Add focused Studio tests for tab list, autosave payloads, Location
      behavior, and removal of Camera Type.

## Tests

Core tests:

- schema accepts the new Composition equipment fields;
- schema rejects `custom.framing`;
- schema accepts `custom.composition`;
- schema accepts valid Location tab selections;
- schema rejects unknown fields under `equipment`, `location`, and `custom`;
- semantic validation rejects a `locationId` outside `shot.locationIds` unless
  `usesDifferentLocation` is `true`;
- semantic validation rejects both `azimuthView` and `customView`;
- semantic validation rejects rack-focus motion without reconciled focus;
- label derivation includes lens/focus in `lensIntent`.

Studio tests:

- tab bar shows `Description`, `Composition`, `Camera Motion`, `Location`, and
  later `AI Production`;
- tab bar does not show `Camera Framing` or `Camera Type`;
- Composition updates call `updateSceneShotCameraDesign` with the extended
  object;
- Location selection updates `cameraDesign.location`;
- clearing the last design field sends `cameraDesign: null`;
- Location visual cards do not render raw ids or filenames.

## Acceptance Criteria

- The existing shot detail layout is unchanged.
- Camera Framing is renamed to Composition everywhere visible.
- Camera Type is removed without a compatibility alias.
- Composition owns shot size, subject framing, angle, Dutch tilt, lens, focus,
  and custom composition notes.
- Camera Motion remains a separate tab and reconciles rack focus with
  Composition.
- Location is implemented as a real tab and persists structured shot-location
  choices.
- All Composition and Location choices persist in the active Scene Shot List
  document through the existing camera-design autosave route.
- Stored shot-list JSON fails fast on malformed Composition or Location data.
- Feature code uses local shadcn-style UI controls only.
- No new model-generation UI, run setup, estimate, or preflight behavior is
  implemented in this slice.
