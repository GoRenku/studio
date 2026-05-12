# Renku Studio Server Hono Architecture

Date: 2026-05-05

Status: current

Role: reference

## Purpose

This document records the routing architecture for the local Renku Studio
server.

Renku Studio should use Hono for HTTP routing instead of hand-written route
dispatch. The server should stay an adapter: it accepts HTTP requests, calls
`@gorenku/studio-core/node`, and returns HTTP responses. It must not own project
data behavior.

Decision history:

- `../../decisions/0008-use-url-owned-studio-routes.md`
- `../../decisions/0014-use-hono-route-modules-for-the-local-studio-server.md`

## Current Contract

Use Hono for the Studio server API.

The reasons:

- Hono gives us a real router instead of a local mini-framework;
- route modules can be grouped by resource with `app.route()`;
- handlers can live directly beside their route paths, which preserves Hono's
  TypeScript inference;
- Hono can run on Node through its Node adapter;
- future Hono RPC/client typing remains possible if we want it.

The Studio server should not use one giant handler file, but it also should not
split every HTTP method into a separate controller-style file.

Use Hono's documented larger-application convention:

```text
one Hono app per resource module
mount resource modules with app.route()
write handlers inline next to their route definitions
avoid Rails-style controllers when possible
```

## Layering

The server stack should be:

```text
browser
  -> Studio server Hono route
    -> HTTP adapter code
      -> ProjectDataService from @gorenku/studio-core/node
        -> core data layer
          -> project-local SQLite
```

The Hono layer owns:

- HTTP route matching;
- request parameter extraction;
- request method handling;
- response status codes;
- HTTP-only response decoration such as `coverUrl`;
- streaming files after core resolves a safe path;
- translating structured core errors into structured HTTP error responses.

The Hono layer must not own:

- project folder scanning;
- SQLite opening;
- Drizzle queries;
- create YAML validation;
- project projection assembly;
- storage root fallback behavior;
- domain mutation rules.

Those belong in `@gorenku/studio-core/node`.

## File Structure

Use this shape for the current Hono server:

```text
packages/studio/server/
  app.ts
  runtime.ts
  errors.ts

  routes/
    health.ts
    projects.ts
    studio-events.ts

  http/
    project-responses.ts
    project-cover-url.ts
    studio-event-responses.ts

  studio-runtime-token.ts
```

File meanings:

- `app.ts`: creates the root Hono app and mounts resource routes;
- `runtime.ts`: starts the Node server and serves built Studio assets;
- `errors.ts`: translates structured core errors into HTTP responses;
- `routes/health.ts`: health-check resource route module;
- `routes/projects.ts`: project resource route module;
- `routes/studio-events.ts`: Studio coordination event resource route module;
- `http/project-responses.ts`: adapts core `Project` and `ProjectLibrary`
  contracts into HTTP response bodies when HTTP-only fields are needed;
- `http/project-cover-url.ts`: builds Studio API cover URLs only;
- `http/studio-event-responses.ts`: adapts Studio coordination events and
  current context into HTTP response bodies when HTTP-only fields are needed;
- `studio-runtime-token.ts`: creates and verifies the local runtime trust token.

Avoid:

```text
project-handler.ts
project-controller.ts
project-routes.ts
route-list-projects.ts
route-read-project.ts
route-read-project-cover.ts
```

Why:

- `handler` and `controller` encourage moving logic out of route definitions and
  can weaken Hono type inference;
- `project-routes.ts` repeats what the `routes/` folder already says;
- one file per route method is not the Hono convention for this size of server;
- the resource module should be `routes/projects.ts`.

## Root App

The root server app should be composed with `app.route()`.

Example shape:

```ts
import { Hono } from 'hono';
import health from './routes/health.js';
import { createProjectsRoute } from './routes/projects.js';
import { createStudioEventsRoute } from './routes/studio-events.js';

export const app = new Hono()
  .route('/studio-api/health', health)
  .route('/studio-api/projects', createProjectsRoute({ token }))
  .route('/studio-api/studio/events', createStudioEventsRoute({ token }));

export type StudioServerApp = typeof app;
```

Use chained route construction when practical because it preserves useful Hono
type inference and leaves room for future RPC/client typing.

## Resource Route Modules

Each resource file exports a Hono app for that resource.

For projects:

```ts
import { Hono } from 'hono';

const projects = new Hono()
  .get('/', async (c) => {
    const library = await projectData.listLibrary();
    return c.json({ library: toProjectLibraryResponse(library) });
  })
  .get('/:projectName', async (c) => {
    const projectName = c.req.param('projectName');
    const project = await projectData.readProject({ projectName });
    return c.json({ project: toProjectResponse(project) });
  })
  .get('/:projectName/cover', async (c) => {
    const projectName = c.req.param('projectName');
    const coverPath = await projectData.resolveCoverImage({ projectName });
    return streamCoverImage(c, coverPath);
  });

export default projects;
export type ProjectsRoute = typeof projects;
```

The exact route list may change as the product changes. The naming rule does
not change: route modules are named by resource, and handlers stay near their
route definitions.

## Route Naming

Use plural resource names for route module files:

```text
routes/projects.ts
routes/health.ts
routes/cast.ts
routes/clips.ts
routes/sequences.ts
```

Use route paths that match the mounted resource:

```ts
app.route('/studio-api/projects', projects);
```

Inside `routes/projects.ts`, use resource-relative paths:

```ts
.get('/')
.get('/:projectName')
.get('/:projectName/cover')
```

Browser route selection is owned by the browser URL, not by a Studio API
selection endpoint. See `docs/decisions/0008-use-url-owned-studio-routes.md`.

Do not encode the HTTP method or action in the filename unless the file is not a
route module. The route path already names the HTTP endpoint.

## Response Adapters

Core owns public contracts such as:

```ts
Project
ProjectLibrary
ProjectSummary
ProjectCoverImage
```

The Studio server may need HTTP-only fields. For example, core should know that
a project has:

```ts
coverImage: { fileName: 'cover.png' }
```

The Studio server may translate that into:

```ts
coverUrl: '/studio-api/projects/constantinople/cover'
```

That translation belongs in:

```text
packages/studio/server/http/project-responses.ts
packages/studio/server/http/project-cover-url.ts
```

The response adapter must stay mechanical. It should not scan project folders,
open SQLite, or infer domain relationships.

## Error Handling

The Hono app should translate structured core errors into structured HTTP
responses.

Do not allow route modules to catch arbitrary errors and invent local messages
unless they are translating a known structured error.

The default should be:

- core throws or returns structured errors with stable error codes;
- server maps those codes to HTTP status codes and JSON error bodies;
- unexpected errors become a generic internal error response and are logged.

The server should not add fallbacks for missing config, missing project
databases, invalid project folders, or invalid core projections.

## Static Assets

The Studio runtime still needs to serve built Vite assets.

It can either:

- keep a small static asset handler in `runtime.ts`; or
- use Hono-compatible static middleware if that proves cleaner.

Static serving must stay separate from `/studio-api/*` route modules.

Path safety remains required. Static asset serving must not introduce fallback
behavior that hides missing build output or path traversal attempts.

## Testing

Route tests should exercise Hono apps directly where possible.

Preferred test shape:

```ts
const response = await app.request('/studio-api/projects');
expect(response.status).toBe(200);
expect(await response.json()).toEqual(...);
```

Use fake or injected `ProjectDataService` implementations in server route tests.
Do not reach into SQLite from Studio server tests. SQLite behavior belongs in
core tests.

## Sources

This architecture follows Hono's documented guidance:

- use `app.route()` for larger applications;
- split by resource modules such as `authors.ts` and `books.ts`;
- avoid Rails-style controllers when possible;
- write handlers directly next to path definitions to preserve type inference;
- use chained route definitions when future RPC/client inference matters.
