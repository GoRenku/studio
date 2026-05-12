# 0009 Studio Text Asset Editing

Date: 2026-05-10

Status: draft

## Goal

Teach the Studio UI to edit both direct SQLite string fields and Markdown-backed
text assets.

This plan builds on:

- `0005-project-storage-foundation.md`
- `0006-asset-commands-and-selects.md`

## Deliverable

In Studio, a user can:

- edit a short field stored directly in SQLite, such as a title;
- edit rich text stored as a Markdown asset, such as a clip brief or visual
  intent;
- see saved changes reflected immediately in the open project without manually
  reloading it.

## References

- `docs/architecture/reference/project-storage-boundaries.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/layers-of-responsibility.md`

## API/Core Shape

Core/server should expose enough data for the UI to distinguish:

```text
direct text field
  field_name
  value

Markdown-backed text asset
  asset_id
  asset_file_id
  project_relative_path
  title
  text_kind
```

Server APIs should provide:

```text
read Markdown asset content
update Markdown asset content
update direct SQLite text field
```

Core remains responsible for metadata rules. Server routes are adapters.

## Frontend Structure

Follow `docs/architecture/reference/front-end-guidelines.md` and use shadcn UI controls
only.

Likely frontend locations:

```text
packages/studio/src/services/
  studio-project-assets-api.ts

packages/studio/src/features/movie-studio/
  project-information/
  storyboard/
  clip-design/
  cast-design/
  visual-language/
```

Shared editor components, if needed, should be named for their responsibility,
not generically:

```text
markdown-asset-editor.tsx
direct-text-field-editor.tsx
```

Do not use raw `<button>`, `<input>`, `<textarea>`, or similar controls in
feature code. Use local shadcn-style primitives from `packages/studio/src/ui`.

## UX Rules

- Use single-line inputs for direct SQLite one-line fields.
- Use textarea/editor surfaces for Markdown-backed content.
- Do not expose filesystem paths as the primary UI concept.
- Show useful save/error states.
- Preserve structured diagnostics from the server when saves fail.

## Verification

- `pnpm test:studio`
- `pnpm check`
- Browser/manual verification:
  - edit a SQLite title;
  - edit a Markdown-backed clip brief;
  - confirm both saved changes are reflected immediately in the open project;
  - as a verification-only persistence check, refresh the browser or restart
    Studio and confirm both saved changes are still present.
- Component/service tests prove:
  - Markdown asset content loads;
  - Markdown asset content saves;
  - direct text field saves;
  - validation/API errors display without breaking the screen.

## Non-Goals

- No rich Markdown preview/editor beyond the minimal editing surface.
- No asset upload UI.
- No production asset materialization UI.
- No localization workflow UI beyond reading/editing existing text assets.
