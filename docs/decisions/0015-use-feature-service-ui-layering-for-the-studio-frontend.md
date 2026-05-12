# 0015 Use Feature, Service, And UI Layering For The Studio Frontend

Date: 2026-05-12

Status: accepted

## Context

`packages/studio` contains the browser Studio application. It needs a structure
that supports product features, shared service clients, app-level orchestration,
and reusable UI primitives without mixing those concerns.

Renku Studio also has a strict UI rule: feature code must use local shadcn-style
components from `packages/studio/src/ui` instead of raw browser controls.

## Decision

The Studio frontend is organized around app, feature, service, hook, library,
style, asset, and UI layers.

The durable folder roles are:

- `src/app`: app shell, route/session coordination, providers, and app-level
  orchestration;
- `src/features`: product surfaces and feature-specific components;
- `src/services`: browser API clients, response contracts, and service-level
  error handling;
- `src/hooks`: reusable hooks that are not owned by one feature;
- `src/lib`: small shared browser utilities;
- `src/ui`: local shadcn-style primitives and reusable UI controls;
- `src/styles` and `src/assets`: global styling and static frontend assets.

Feature components must not use raw `<button>`, `<input>`, `<select>`,
`<textarea>`, `<dialog>`, or similar browser controls. If a needed primitive is
missing, add it under `src/ui` first, then use it from feature code.

## Consequences

- Product features remain easier to navigate.
- API details stay out of UI components.
- Shared UI controls can enforce accessibility and visual consistency.
- Tests can focus on feature behavior instead of duplicated low-level controls.
