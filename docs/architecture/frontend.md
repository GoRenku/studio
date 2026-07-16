# Studio Frontend Architecture

Date: 2026-05-26

Status: current

Role: topic overview

This document summarizes the current frontend architecture for
`packages/studio`. Detailed rules live in
`reference/front-end-guidelines.md`.

## Frontend Shape

The Studio browser app is organized around clear layers:

- `src/app` owns app composition, route/session coordination, and providers.
- `src/features` owns product surfaces and user workflows.
- `src/services` owns browser API clients and HTTP response contracts.
- `src/hooks` owns shared browser and app-state hooks.
- `src/lib` owns small shared browser utilities.
- `src/ui` owns local Shadcn-style primitives and domain-neutral reusable UI
  components.
- `src/styles` and `src/assets` own global styles and static frontend assets.

Feature code must use the local UI primitives from `src/ui`; it must not write
raw browser controls directly.

Generation feature code is an experience projection consumer. Core supplies
purpose context, exact reference eligibility, focused workspace state, and
structured diagnostics; Engines supplies provider field capabilities. React may
hold draft interaction state and bind those fields to existing controls, but it
must not classify project assets, guess provider field names, construct missing
generation work, or calculate cost.

## Shared UI Ownership

Reusable frontend behavior belongs to the layer that owns its meaning.

Domain-neutral design-system behavior belongs in `src/ui`. Examples include
buttons, dialogs, tabs, tooltips, image preview dialogs, the shared
`src/ui/media-card` module, and the token-themed `SyntaxTextEditor` wrapper for
embedded Markdown or JSON editing. Feature code must consume that wrapper
instead of importing `prism-react-editor` directly.

Product-specific composition belongs in `src/features`. A Cast component can
prepare Cast data, choose which asset role to show, and pass Cast-specific
labels or callbacks to a UI primitive. It should not own a copy of a generic
image card, delete control, or pick control.

When two product surfaces need the same visual treatment, move the real
implementation to `src/ui`, update callers directly, and remove the old
feature-owned implementation. Do not add re-export stubs, compatibility aliases,
or thin wrappers whose only job is to rename the same component.

## Detail Panel Structure

Movie Studio detail pages share a single visual rule for header and tabs:

- the detail panel title header is one band;
- the line-tab bar is the next band, directly below it;
- there is no margin between the header and the tab bar;
- the tab bar starts at the panel content's left edge;
- tabbed surfaces render inside a flush `PanelShell` content area, not inside a
  padded wrapper.

Feature code should use the shared line-tab primitives from `src/ui` for these
surfaces. If a detail page needs interior spacing, apply that spacing inside the
selected tab content, below the tab bar. Do not wrap the entire tab system in a
card, centered `max-w-*` container, or general-purpose padded `div`.

## Media Surfaces

Studio has several media-heavy surfaces: Inspiration grabs, Lookbooks, Cast
profile images, character sheets, scene imagery, and future generated takes.
These surfaces should feel like one application.

Shared media surfaces should use the same conventions:

- included visual-card surfaces use `MediaCard`;
- repeated included cards use `MediaCardGrid`;
- image previews use the shared image preview dialog;
- destructive image actions use the shared delete confirmation dialog;
- selection is persistent in the lower-right corner;
- Edit follows selection in the lower-right corner;
- delete uses the one shared top-right treatment;
- whole-card activation is a sibling layer behind the action controls, so the
  DOM never nests interactive controls.

`MediaCard` has four bounded presentations: overlay, thumbnail, evidence, and
summary. It supports the media and frame shapes used by current Studio cards;
it is not a generic render-slot container.

The included surfaces are:

- Cast and Location overview cards and asset galleries;
- Inspiration folders and grabs;
- Production and Storyboard Lookbook evidence, hero, and asset cards;
- Scene, Act, and Sequence storyboard cards;
- Project Library cards;
- Generation Preview and Image Revision reference cards;
- Reference Picker candidates;
- Shot Design Composition and Motion options.

Pure presentation media remains outside `MediaCard`: Cast and Location detail
feature images, the Studio sidebar cover and logo, preview-dialog media,
standalone video players, tooltip portraits, upload/dropzone visuals, audio
cards, and non-media report widgets.

Text on image cards should be sparse and useful. The app should not surface raw
filenames, asset ids, producer identifiers, or kebab-case labels as visible
copy. If no meaningful product label exists, keep the card quiet.

## Aspect Ratios

Image-card aspect ratios are part of the component contract. Callers must pass
the intended aspect ratio explicitly when they use a reusable image card.

Examples:

- Cast profile cards use `1`.
- Cast character sheets use `4 / 3`.
- Generic cinematic frames and Lookbook cards may use wider defaults.

When the image file dimensions are available, feature code should derive the
aspect ratio through the shared aspect-ratio utility. When dimensions are not
known until load time, reusable card and preview components should use the same
utility to inspect the loaded image.

Do not rely on a Tailwind aspect class alone if the component also applies an
inline aspect-ratio style. The class and the numeric aspect ratio must describe
the same intended shape.

## Resource Refresh

Surfaces that show project data changed by Studio, the Renku CLI, or agent
workflows must update without requiring a browser refresh.

Frontend containers should subscribe through the shared Studio resource-refresh
hook or module, listen for the scoped Studio resource-change events defined by
the selected surface, and reload only the affected resource or asset page. The
app shell should stay bounded; it should not eagerly load every possible asset
collection just to keep media tabs fresh.

Feature code should not attach direct
`window.addEventListener('renku:studio-resource-changed', ...)` listeners, define
local copies of the resource-change event detail type, or assemble resource-key
strings that should come from the core catalog.

This follows ADR 0017 and ADR 0030: project shells remain bounded, selected
resources are loaded lazily, resource keys drive invalidation, and all browser
surfaces use the shared refresh system.

## Verification

Renku Studio is a desktop-first app. Unless a task explicitly asks for mobile
support, frontend verification should use desktop browser sizes only.

Browser E2E coverage is owned by `packages/studio` and uses Playwright Test
according to ADR 0037. E2E fixtures must create project data through core-owned
commands and services, not through route-local shortcuts, React-local state, or
direct SQLite writes.

Backend replacements that promise an unchanged experience must capture the
pre-work desktop state from an isolated checkout and compare the final Studio
against locked Playwright screenshots. Dynamic project identifiers and media
pixels may be masked narrowly; retained layout, copy, cards, controls, dialogs,
and interaction assertions must remain visible. Approved product deltas need
separate DOM assertions so a screenshot mask cannot silently broaden them.

For media surfaces, verification should check:

- card aspect ratios match the asset role;
- image fitting and cropping are intentional;
- overlays do not overwhelm the image;
- pick controls are lower-right and toggle both ways;
- delete controls are top-right and confirm before removal;
- image preview opens the selected image in the shared dialog;
- newly generated or imported assets appear after resource-change events.

## Decision History

- `../decisions/0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
  defines the app, feature, service, hook, library, style, asset, and UI layers.
- `../decisions/0017-use-scalable-studio-resource-loading.md` defines bounded
  project shells, lazy resource loading, pagination, and scoped invalidation.
- `../decisions/0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`
  defines shared UI primitive ownership and reusable media-card behavior.
- `../decisions/0027-use-details-header-for-save-notifications.md` defines the
  details header as the single placement for save notifications.
- `../decisions/0030-use-unified-studio-resource-refresh-components.md` defines
  the shared resource-refresh system used by browser surfaces.
- `../decisions/0037-use-playwright-for-studio-browser-e2e.md` defines the
  Studio browser E2E test infrastructure and AI-assisted testing boundaries.
- `../decisions/0053-use-one-configurable-studio-media-card.md` defines the
  included card surfaces, exclusions, bounded presentations, and shared action
  placement.
