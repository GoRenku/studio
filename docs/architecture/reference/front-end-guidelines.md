# Renku Studio Frontend Guidelines

Date: 2026-05-06

Status: current

Role: reference

## Purpose

This document defines durable frontend structure and naming guidance for
`packages/studio`.

The goal is not just to make folders tidier. The goal is to make the browser
application easier to extend by giving every file a clear product responsibility
and a clear architectural layer.

Decision history:

- `../../decisions/0005-use-latest-only-save-queues-for-autosave.md`
- `../../decisions/0008-use-url-owned-studio-routes.md`
- `../../decisions/0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
- `../../decisions/0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`

Current implementation steps belong in `plans/active/`. This document should
remain useful after the first refactor is complete.

The frontend follows the same naming rule as the rest of Renku Studio:

> Use the product/domain name when a product/domain concept exists. Avoid broad
> placeholders such as `data`, `detail`, `layout`, `navigation`, `queue`,
> `model`, `manager`, `helper`, and `workspace` when a more precise name is
> available.

## Frontend Layering

Use these layers inside `packages/studio/src`:

```text
packages/studio/src/
  app/
  features/
  services/
  hooks/
  lib/
  ui/
  assets/
  styles/
```

### `app/`

Owns application composition and app-wide providers.

Use this for:

- the root `App` component;
- provider composition;
- app shell components that appear across multiple features;
- route-level or screen-level composition when routing is introduced.

Do not put resource API clients, domain projections, or feature-specific panels
in `app/`.

Recommended shape:

```text
src/app/
  app.tsx
  studio-app-header.tsx
  theme-provider.tsx
```

Naming examples:

- `studio-app-header.tsx` is a reusable app shell header for Renku Studio.
- `theme-provider.tsx` belongs in `app/` when it is one app-wide provider, not a
  general collection of context objects.

### `features/`

Owns product surfaces and user workflows. A feature folder should be named for
the product surface it represents, not for a generic UI pattern.

Feature folders may contain:

- screen or surface components;
- feature-specific child components;
- feature-specific hooks;
- feature-specific projection functions;
- feature-specific types that are not shared app contracts;
- tests for the feature.

Feature folders should not contain:

- app-wide UI primitives;
- HTTP fetch clients shared across features;
- core domain types that belong in `@gorenku/studio-core`;
- server-only concepts.

Recommended high-level feature shape:

```text
src/features/
  project-library/
  movie-studio/
  settings/
```

Feature meanings:

- `project-library` is the project selection and library browsing surface.
- `movie-studio` is the main selected-project movie-making surface. It can be a
  broad feature because it names the actual product mode, but its child folders
  must use precise names.
- `settings` is reserved for future app or project configuration surfaces.

The main selected-project feature should use `movie-studio`, not
`project-production`, `active-project`, `studio-session`, or `workspace`.

Why:

- `movie-studio` describes what the user is doing: making the movie.
- `project-production` is too abstract and adds redundant `project` language.
- `active-project` describes application state rather than the product surface.
- `studio-session` is mechanical and does not describe the movie-making work.
- `workspace` can mean UI state, folder state, or database state.

Recommended `movie-studio` child shape:

```text
src/features/movie-studio/
  movie-studio-screen.tsx
  movie-studio-selection.ts
  use-movie-studio-selection.ts

  studio-sidebar/
    studio-sidebar.tsx
    studio-sidebar-button.tsx
    studio-sidebar-section.tsx

  storyboard/
    storyboard-panel.tsx

  clip-design/
    clip-design-panel.tsx

  cast-design/
    cast-design-panel.tsx

  visual-language/
    visual-language-panel.tsx

  generation-activity/
    generation-activity-footer.tsx
```

Notes:

- `studio-sidebar` is intentionally broad because it is the sidebar for all
  things a user touches while making a movie: story structure, cast, visual
  language, generation activity, and future sections.
- `studio-sidebar` is preferred over plain `navigation` because it is tied to a
  specific Studio surface.
- `storyboard`, `clip-design`, `cast-design`, `visual-language`, and
  `generation-activity` should stay precise because they name product areas
  inside the broader movie studio.

## Component Composition

Feature containers should compose named child components. They should not grow
into large monolithic files that own unrelated controls, status displays,
menus, forms, list rows, and business actions all at once.

Rules:

- Keep screen and shell components focused on layout, data wiring, and
  high-level composition.
- Extract cohesive subcomponents when a UI area has its own responsibility,
  repeated visual treatment, or separate interaction logic.
- Name extracted components after the product area they serve, not after a
  generic implementation detail. For example, use `StudioSidebarActions` for
  sidebar header controls instead of adding those controls directly inside
  `StudioSidebar`.
- Keep feature-local components inside the feature folder when they are not
  reusable app-wide primitives.
- Promote a component to `src/ui/` only when it is domain-neutral and useful
  across multiple features.
- Avoid hiding large blocks of JSX behind private render functions in the same
  file when the block is really a separate UI area. Prefer a small component
  with explicit props.
- A container can own local state for the surface, but child components should
  receive the smallest clear set of values and callbacks they need.

The desired reading experience is that a feature file explains the shape of the
surface at a glance, while focused child components own the details of each
area.

### Detail Panel Tabs And Insets

Movie Studio detail panels use a shared shell with a fixed title header. When a
surface places a tab bar directly under that title header, the tab bar must be
flush with the detail panel content edge.

Required structure:

- the `PanelShell` title/header owns the top label, such as `BOMBARDMENT`,
  `LOOKBOOK`, `URBAN`, or a location name;
- tabbed detail surfaces must pass `p-0` to the `PanelShell` content area;
- the first child of that flush content area should be the shared line-tab
  primitive from `src/ui`;
- the tab bar must have no extra left inset, top margin, wrapping card, centered
  max-width container, or decorative inner panel around it;
- tab content may add its own padding after the tab bar when the content needs
  breathing room, but that padding must not move the tab bar itself.

Use the Bombardment scene detail as the reference pattern: the title header and
line-tab row are adjacent bands in the same panel, and the tab row begins at the
same left edge as the panel content.

Avoid this pattern:

```tsx
<PanelShell>
  <div className="p-4">
    <Tabs>
      <LineTabBar />
      ...
    </Tabs>
  </div>
</PanelShell>
```

That creates an accidental box-within-box effect and makes the tab bar drift
away from the panel edge.

Prefer this pattern:

```tsx
<PanelShell contentClassName="p-0">
  <LineTabs items={tabs}>
    <LineTabsContent value="details">
      <DetailsTab />
    </LineTabsContent>
  </LineTabs>
</PanelShell>
```

Inset containers, centered `max-w-*` wrappers, cards inside cards, and large
outer padding are allowed only when the surface is intentionally presenting a
document, form, grid, or repeated card collection that needs that interior
structure. Do not add them as a default page-building habit.

### `services/`

Owns browser-side adapters to external systems. In this app, that currently
means the local Studio HTTP API.

Use `services/` for code that:

- calls `fetch`;
- converts HTTP response bodies into frontend contracts;
- converts structured HTTP error responses into frontend-readable errors;
- owns endpoint paths.

Do not use `data/` for this layer. `data` is vague and can mean API calls,
fixture data, cache state, loaded domain objects, or persistence.

Recommended shape:

```text
src/services/
  studio-projects-api.ts
  studio-api-errors.ts
  studio-project-contracts.ts
```

File meanings:

- `studio-projects-api.ts`: functions such as `readProject`,
  `readProjectLibrary`, `updateProjectInformation`, and
  `exportProductionAssets`.
- `studio-api-errors.ts`: response error parsing and typed frontend API errors.
- `studio-project-contracts.ts`: HTTP-decorated project contracts such as
  `ProjectShellWithHttp` and `ProjectLibraryWithHttp`, unless these are later
  generated from a typed server contract.

Project-open contracts must follow ADR 0017. The browser should read a bounded
`ProjectShellWithHttp` first, then load selected surface resources and paginated
asset/navigation pages through feature services. Do not add broad eager surface
maps, such as all cast assets or all clip takes, to the project shell.

Function naming should use resource verbs instead of generic fetch names:

```ts
readProject(projectName)
readProjectLibrary()
updateProjectInformation(projectName, information)
```

Avoid:

```ts
fetchData()
load()
open()
movieStudioClient()
```

`readProject(projectName)` is clearer than `fetchProject(projectName)` because
it names the resource projection returned by the Studio API. If a future behavior
truly opens a file picker or project folder, that separate behavior should get
its own name.

### `hooks/`

Owns reusable browser and app-state hooks that are shared across features.

Feature-specific hooks should stay inside the feature folder. Shared hooks
belong in `src/hooks/`.

Examples:

```text
src/hooks/
  use-async-action.ts
  use-stable-set.ts
```

Do not add a shared hook until at least two features need it or the hook hides
browser mechanics that would otherwise be repeated.

### `lib/`

Owns small shared browser utilities that are not product features, API clients,
hooks, or UI primitives.

Use `lib/` for queueing, timing, formatting, class-name, and other browser-safe
helpers that are shared enough to avoid belonging to one feature.

Do not put API clients, feature projections, Node-only code, or generic
framework experiments in `lib/`.

### `ui/`

Owns reusable Shadcn-style design-system primitives.

The frontend should use local Shadcn primitives for controls and common UI
building blocks. Feature code should not hand-roll raw controls when a Shadcn
primitive exists locally or can be installed.

Recommended shape:

```text
src/ui/
  alert.tsx
  badge.tsx
  button.tsx
  card.tsx
  dropdown-menu.tsx
  empty.tsx
  input.tsx
  item.tsx
  select.tsx
  sidebar.tsx
  spinner.tsx
  tabs.tsx
  textarea.tsx
  theme-toggle.tsx
  tooltip.tsx
```

Rules:

- `ui/` components should not import feature code.
- `ui/` components should not know about `Project`, `Clip`, `CastMember`, or
  other Renku Studio domain contracts.
- `ui/` components may wrap third-party primitives and encode shared visual
  conventions.
- Feature code should use local `ui/` primitives for buttons, inputs, selects,
  tabs, dropdowns, tooltips, alerts, empty states, cards, sidebars, items, and
  similar UI pieces.
- Raw `<button>`, `<input>`, `<select>`, and similar controls should be limited
  to the implementation of `ui/` primitives. Feature code must use the local
  Shadcn primitive instead.
- Before designing a new reusable primitive or custom control, check the Shadcn
  component catalog first:
  `https://ui.shadcn.com/docs/components`.
- If Shadcn has the needed component but it is not installed locally, add it
  with the project command shape:

```bash
sfw pnpm dlx shadcn@latest add alert
```

Replace `alert` with the needed component name, such as `empty`, `item`,
`sidebar`, `spinner`, `badge`, or `field`.

If the local `ui/` folder moves, update Shadcn configuration such as
`components.json` so future CLI installs land in the correct directory.

## App-Wide Visual Consistency

Studio surfaces must use one consistent interaction language across the app.
Using Shadcn primitives is required, but it is not sufficient on its own:
feature code must also apply the same Studio visual states and section
treatments.

Rules:

- Interactive controls must use the app's primary/yellow focus and selection
  treatment consistently. Textareas, inputs, selects, segmented controls,
  upload controls, tile pickers, and icon buttons should not each invent their
  own focus border, ring color, or hover color.
- Selection states should use the primary/yellow token family unless a different
  semantic state is required, such as destructive, warning, or disabled.
- Hover states for selectable tiles, add-more controls, and compact command
  buttons should visibly connect to the same primary/yellow interaction system.
  Do not mix generic muted hover styling with primary selection styling in the
  same workflow.
- Form sections should use the same surface treatment inside a workflow:
  consistent border, background, padding, radius, and shadow. Avoid mixing loose
  full-width fields with card-like sections unless the difference has a clear
  product meaning.
- Section headings should use a consistent hierarchy. For compact Studio
  settings panels, use uppercase micro-headings with the same tracking, weight,
  and muted color across sibling sections. Field labels inside those sections
  should also follow one shared label treatment.
- Footer or command-bar controls are not exempt. Model selectors, take-count
  controls, cost summaries, and generate buttons should align visually with the
  form sections above them.
- When a workflow needs custom styling around Shadcn primitives, create a
  shared local primitive or variant for that workflow, then reuse it across
  every control in the workflow. Do not scatter one-off class strings that make
  the same primitive look different from screen to screen.
- If a visual convention proves useful across more than one feature, promote it
  into `src/ui/` as a domain-neutral primitive or variant rather than copying
  feature-local classes.

The goal is that a user can move between Studio surfaces and immediately
understand what is selectable, focused, selected, destructive, disabled, or
primary without relearning the visual language.

## Shared Visual Primitives

When a repeated visual pattern appears in more than one product surface, choose
one owner deliberately.

Rules:

- Put domain-neutral reusable components in `src/ui`.
- Keep feature-local components only when they express product-specific
  composition or behavior.
- Do not import another feature's private child component just to reuse its
  styling.
- Do not add pass-through wrappers, compatibility aliases, or re-export files to
  preserve an old component name.
- When promoting a shared pattern, move the real implementation, update all
  callers directly, and delete the obsolete feature-owned component.

For example, Cast should not import a Visual Language image card to get the
Lookbook card treatment. The shared image-card treatment belongs in `src/ui`;
Cast and Visual Language should both compose that primitive with their own
product data.

Feature components are allowed only when they add real product meaning. A
`CastAssetSection` that filters assets by role and wires Cast callbacks is a
feature component. A `CastImageCard` that only renames a generic image card is
not.

## Reusable Image Card Contracts

Media-heavy surfaces must use consistent image-card anatomy across the app.
This includes Cast profile images, Cast character sheets, Inspiration folders,
Inspiration grabs, Lookbooks, and future generated take surfaces.

Reusable image-card primitives should expose explicit props for:

- the image URL and alt text;
- the intended display aspect ratio;
- optional runtime image aspect-ratio detection;
- image fitting and cropping behavior;
- optional overlay title and description;
- selected state;
- a top-right action slot;
- a lower-right control slot;
- opening the shared image preview dialog.

Use the same slot positions consistently:

- top-right is for actions such as delete;
- lower-right is for pick, active, or selected-state controls;
- text overlays should stay quiet and should not overwhelm the image.

Selection controls on image cards should use one app-wide control, tooltip, and
pressed-state treatment. The control must toggle both directions. Clicking an
unselected item selects it; clicking the current selected item clears it.

Delete actions on image cards should use a trash icon, the shared confirmation
dialog, and concise generic copy when no meaningful product name exists.

Do not fill image cards with raw filenames, asset ids, producer identifiers,
generated role names, or kebab-case labels. If there is no meaningful
product/domain label, leave the card without visible copy.

## Image Aspect Ratios

Aspect ratio is part of the image-card contract. Callers must pass the intended
numeric aspect ratio when using a reusable image card.

Examples:

- Cast profile images are `1`.
- Cast character sheets are `4 / 3`.
- Wider cinematic frames and Lookbook cards may use wider defaults.

The Tailwind aspect class and numeric aspect ratio must agree. Do not pass
`aspect-square` while leaving the reusable card's numeric ratio at a wide
default; inline aspect-ratio styles will override the visual intent.

When stored image dimensions are available, calculate the ratio through the
shared aspect-ratio utility. When dimensions are only known after image load,
use the same utility inside the reusable card or preview component. Do not
duplicate image `onLoad` ratio calculation in each feature.

Use `object-contain` when preserving the whole image matters, such as character
sheets and design boards. Use `object-cover` only when cropping is intentional,
such as portrait cards where the subject should fill the frame.

## Generated Media Refresh

Surfaces that display generated or imported assets must refresh when Studio
reports resource changes. The user should not need to reload the browser to see
newly attached media.

Use scoped resource keys from the Studio event payload to decide whether to
reload. For example, a Cast member panel should refresh when keys for that Cast
member's assets or surface change. A top-level Cast overview should refresh when
Cast navigation or any Cast member media that contributes to overview imagery
changes.

Keep this refresh local to the owning container. Do not expand the project shell
to include every asset collection just to make a tab feel live. The current
architecture follows lazy selected-resource loading and scoped invalidation.

### `assets/` And `styles/`

Keep these folders:

```text
src/assets/
src/styles/
```

Use `assets/` for static images and icons imported by the app.

Use `styles/` for global CSS, theme tokens, and app-wide style setup.

Feature-specific sample images used only by one experimental surface should
live under that feature, for example:

```text
src/features/movie-studio/cast-design/sample-assets/
```

## Component Naming Rules

Name components after the product surface or reusable UI primitive they render.

Good examples:

- `ProjectLibraryScreen`
- `ProjectLibraryCard`
- `MovieStudioScreen`
- `StudioSidebar`
- `StudioSidebarButton`
- `StudioSidebarSection`
- `StoryboardPanel`
- `ClipDesignPanel`
- `CastDesignPanel`
- `VisualLanguagePanel`
- `GenerationActivityFooter`
- `StudioAppHeader`

Avoid examples:

- `ProjectOpener`
- `MovieWorkspace`
- `ProjectProduction`
- `DetailArea`
- `Navigation`
- `NavButton`
- `QueueBar`
- `Layout`
- `Panel` by itself
- `Card` by itself outside `ui/`

Use `Screen` for top-level app surfaces that fill the available browser area.

Use `Sidebar`, `Footer`, `Header`, and `Panel` only when paired with a product
or app surface name:

```text
StudioSidebar
GenerationActivityFooter
StudioAppHeader
ClipDesignPanel
```

Do not name by implementation mechanics alone:

- `navigation` says how a user moves;
- `studio-sidebar` says this is the sidebar for the Studio surface;
- `generation-activity` says the surface owns task, status, and cost activity,
  while `queue` names only one possible mechanism.

## Function And Hook Naming Rules

Functions should reveal the domain operation or projection.

Good examples:

```ts
buildMovieStudioLookup(project)
resolveStudioSelection(selection, lookup)
readProjectLibrary()
readProject(projectName)
returnToProjectLibrary()
useProjectSession()
useProjectLibrarySearch(projects, query)
useStudioSelection(project)
```

Avoid examples:

```ts
buildLookup()
resolveSelection()
fetchCurrentProject()
fetchProjectLibrary()
openProject()
toggleSetValue()
handleClick()
```

Some generic words are acceptable when the file context already supplies the
domain. For example, a private `toggleSection` function inside
`studio-sidebar.tsx` is clear enough because the surrounding component is
specific.

For exported functions, prefer fully descriptive names because import sites lose
local file context.

## React State And Effects

Keep React effects close to external synchronization. Do not use effects as a
general way to compute derived state.

Use custom hooks for multi-step asynchronous behavior. For example, the root app
behavior should be shaped like:

```ts
function useProjectSession() {
  return {
    project,
    library,
    isLoadingProjectRoute,
    isLoadingProjectLibrary,
    isSelectingProject,
    projectSessionError,
    refreshProjectLibrary,
    navigateToProject,
    returnToProjectLibrary,
  };
}
```

The root app should then read like composition:

```tsx
function App() {
  const projectSession = useProjectSession();

  if (projectSession.isLoadingProjectRoute) {
    return <StudioLoadingScreen />;
  }

  if (projectSession.project) {
    return <MovieStudioScreen projectSession={projectSession} />;
  }

  return <ProjectLibraryScreen projectSession={projectSession} />;
}
```

Guidelines:

- Use `useMemo` for expensive projections or stable lookup objects, not for
  simple local expressions.
- Use `useCallback` when passing callbacks to memoized children, hooks, or
  effect dependencies. Do not wrap every inline event handler by default.
- Keep cancellation or stale-response handling inside hooks that perform async
  work.
- Prefer derived values over duplicated state. For example, derive filtered
  project cards from `projects` and `query` instead of storing a second project
  list.
- Keep ephemeral UI state, such as expanded sidebar branches, inside the
  component or a feature hook.
- Keep durable project state in core/server contracts, not in React-only
  mirrors.
- Avoid boolean names that hide the subject, such as `isLoading`. Prefer
  `isLoadingProjectLibrary`, `isSelectingProject`, or
  `isLoadingProjectRoute`.

## Service And Error Handling Rules

Frontend service functions should fail fast and preserve structured diagnostic
information where possible.

Rules:

- API service files own `fetch` calls.
- Components should not manually assemble Studio API URLs.
- Components should not parse HTTP error bodies.
- Service functions should throw typed frontend errors that include code and
  message when the server provides them.
- Unknown response shapes should fail with a clear error. Do not silently return
  empty objects, empty arrays, or `null` unless the endpoint explicitly allows
  that result.

Example:

```ts
const project = await readProject(projectName);
```

Better than:

```ts
const response = await fetch(`/studio-api/projects/${projectName}`);
const body = await response.json();
```

## Import Rules

Keep imports easy to read and avoid feature-to-feature tangles.

Recommended aliases:

```text
@/app/*
@/features/*
@/services/*
@/hooks/*
@/ui/*
```

Avoid feature-specific aliases such as `@movie-workspace/*`. They make a
temporary folder name feel permanent and encourage importing across internal
feature boundaries.

Import direction should usually be:

```text
app -> features -> services
app -> ui
features -> ui
features -> services
features -> feature-local files
```

Avoid:

```text
services -> features
ui -> features
one feature importing another feature's private child component
```

If two features need the same component, move that component to `ui/` only when
it is domain-neutral. If it is still a domain component, move it to a shared
domain feature folder with a precise name.

## Testing Guidance

Keep tests close to the behavior they protect.

Recommended tests:

- root app tests verify session states choose the correct screen;
- project library tests verify search, empty states, validation-error rendering,
  and selecting a project;
- movie studio selection tests verify sequence, scene, clip, cast, visual
  language, and fallback selection resolution;
- service tests verify endpoint paths, successful response parsing, and
  structured error parsing.

Tests should describe current behavior only. Do not keep tests for obsolete
folder names, old aliases, or previous API shapes.

Because Renku Studio is pre-customer software, do not leave compatibility
aliases behind during frontend migrations.

Renku Studio is desktop-first. Do not test or optimize mobile viewport behavior
unless the user explicitly asks for mobile support.

For media-card work, add focused tests for behavior that can regress without a
visual failure, such as toggling the current pick off, refreshing after
resource-change events, and calling the correct delete endpoint after
confirmation. Use desktop browser verification for rendered card size,
placement, aspect ratio, and overlay consistency.
