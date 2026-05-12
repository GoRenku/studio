# 0002 Studio Frontend Structure Refactor

Date: 2026-05-06

Status: proposed

## Goal

Refactor `packages/studio/src` so the frontend follows
`docs/architecture/reference/front-end-guidelines.md`.

This plan tracks the concrete next migration steps. The architecture document is
the long-lived reference; this plan can be completed, revised, or archived after
the refactor lands.

## Decisions

- Use `movie-studio` for the main selected-project movie-making surface.
- Use `studio-sidebar` for the sidebar that lists the things a user touches
  while making a movie, including story structure, cast, visual language, and
  generation activity.
- Use `services/` instead of `data/` for browser-side Studio API adapters.
- Move reusable Shadcn-style primitives to `ui/`.
- Use Shadcn components in feature code instead of raw HTML controls.
- Check `https://ui.shadcn.com/docs/components` before designing a reusable UI
  primitive from scratch.
- Update Shadcn configuration, including `components.json`, if the local `ui/`
  install path changes.
- Install missing Shadcn primitives with the project command shape:

```bash
sfw pnpm dlx shadcn@latest add alert
```

## Proposed Folder Shape

```text
packages/studio/src/
  app/
    app.tsx
    app.test.tsx
    studio-app-header.tsx
    theme-provider.tsx

  features/
    project-library/
      project-library-screen.tsx
      project-library-card.tsx
      empty-project-library.tsx
      use-project-library-search.ts

    movie-studio/
      movie-studio-screen.tsx
      movie-studio-selection.ts
      movie-studio-selection.test.ts
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
        cast-overview-panel.tsx
        cast-design-panel.tsx
        cast-design-tabs.tsx
        cast-design-tab-panel.tsx
        cast-asset-card.tsx
        cast-asset-grid.tsx
        cast-reference-card.tsx
        empty-cast-assets.tsx
        generation-settings-panel.tsx
        cast-design-sample-data.ts
        cast-design-types.ts

      visual-language/
        visual-language-panel.tsx

      generation-activity/
        generation-activity-footer.tsx

  services/
    studio-projects-api.ts
    studio-api-errors.ts
    studio-project-contracts.ts

  hooks/

  ui/

  assets/
  styles/
```

## Refactor Map

```text
src/app.tsx
  -> src/app/app.tsx

src/app.test.tsx
  -> src/app/app.test.tsx

src/contexts/theme-context.tsx
  -> src/app/theme-provider.tsx

src/components/layout/movie-studio-header.tsx
  -> src/app/studio-app-header.tsx

src/components/project-opener.tsx
  -> src/features/project-library/project-library-screen.tsx

ProjectCard inside project-opener.tsx
  -> src/features/project-library/project-library-card.tsx

EmptyLibrary inside project-opener.tsx
  -> src/features/project-library/empty-project-library.tsx

project search filtering inside project-opener.tsx
  -> src/features/project-library/use-project-library-search.ts

src/components/movie-workspace/movie-workspace.tsx
  -> src/features/movie-studio/movie-studio-screen.tsx

src/components/movie-workspace/model/movie-selection.ts
  -> src/features/movie-studio/movie-studio-selection.ts

selection state inside movie-studio-screen.tsx
  -> src/features/movie-studio/use-movie-studio-selection.ts

src/components/movie-workspace/navigation/movie-navigation.tsx
  -> src/features/movie-studio/studio-sidebar/studio-sidebar.tsx

src/components/movie-workspace/navigation/nav-button.tsx
  -> src/features/movie-studio/studio-sidebar/studio-sidebar-button.tsx

src/components/movie-workspace/navigation/navigation-section.tsx
  -> src/features/movie-studio/studio-sidebar/studio-sidebar-section.tsx

src/components/movie-workspace/detail/detail-area.tsx
  -> delete after responsibilities move into movie-studio-screen.tsx

src/components/movie-workspace/detail/storyboard-overview.tsx
  -> src/features/movie-studio/storyboard/storyboard-panel.tsx

src/components/movie-workspace/detail/clip-workspace.tsx
  -> src/features/movie-studio/clip-design/clip-design-panel.tsx

src/components/movie-workspace/detail/casting-overview.tsx
  -> src/features/movie-studio/cast-design/cast-overview-panel.tsx

src/components/movie-workspace/cast/cast-workspace.tsx
  -> src/features/movie-studio/cast-design/cast-design-panel.tsx

src/components/movie-workspace/queue/queue-bar.tsx
  -> src/features/movie-studio/generation-activity/generation-activity-footer.tsx

src/components/movie-workspace/shared/readiness-dot.tsx
  -> keep near storyboard if only storyboard uses it, or move to ui/ if reused

src/components/movie-workspace/shared/stat-pill.tsx
  -> keep near generation-activity if only footer uses it, or move to ui/ if reused

src/data/movie-studio-client.ts
  -> src/services/studio-projects-api.ts

src/types/movie-project.ts
  -> split between src/services/studio-project-contracts.ts and
     src/features/movie-studio/movie-studio-selection.ts
```

## Implementation Order

1. Create the new folders and move app shell, project library, services, and UI
   primitives.
2. Rename `movie-workspace` concepts to `movie-studio` and move selection logic
   out of the component tree.
3. Rename the current navigation surface to `studio-sidebar`.
4. Split the current large components into named product surfaces: project
   library card, empty project library, studio sidebar, storyboard panel, clip
   design panel, cast design panel, and generation activity footer.
5. Introduce `useProjectSession`, `useProjectLibrarySearch`, and
   `useMovieStudioSelection`.
6. Replace raw feature-level controls with local Shadcn `ui/` primitives. When a
   needed primitive is missing, check the Shadcn catalog and install it before
   designing one from scratch.
7. Remove obsolete aliases and update imports directly.
8. Run focused Studio checks, then root checks if the change touches shared
   contracts.

## Validation

Run focused commands after the refactor:

```bash
pnpm test:studio
pnpm build:studio
pnpm lint:studio
```

If root package contracts or workspace configuration change, also run:

```bash
pnpm test
pnpm build
pnpm lint
pnpm check
```
