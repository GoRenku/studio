# JSON Storage Validation

Date: 2026-05-22

Status: current

Role: architecture decision record

## Context

Renku Studio stores some structured project data as JSON text in SQLite columns.
This is useful for section-shaped content where a normalized table model would
add friction before the product surface is stable.

SQLite accepting text does not make the stored value safe. TypeScript types also
do not validate runtime data once it crosses a CLI, Studio server, agent, or
database boundary. Project-owned JSON needs a real runtime contract.

The codebase already uses this pattern for screenplay JSON:

- browser-safe JSON Schema constants live under `packages/core/src/client`;
- server validators use AJV v8 with JSON Schema draft 2020-12;
- AJV errors are mapped into structured diagnostics;
- stored JSON fragments are validated when written and when read back.

## Decision

Every SQLite column that stores JSON must have an explicit JSON Schema and must
be validated with AJV before persistence.

Stored JSON must also be validated after it is read from SQLite and before it is
returned through core, CLI, Studio server, or UI-facing resource contracts. If
stored JSON no longer matches its schema, core must fail fast with structured
diagnostics instead of returning malformed data.

Use the same AJV pattern as `packages/core/src/server/screenplay-json/validator.ts`:

```ts
import Ajv2020 from 'ajv/dist/2020.js';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});
```

Required behavior:

- `allErrors: true` so commands and agents receive all actionable structural
  issues in one response.
- `strict: true` so schemas remain explicit and reviewable.
- `strictRequired: false` because some schema compositions use shared object
  definitions and write-time variants.
- `removeAdditional: false` because validation must not mutate input.
- `useDefaults: false` because defaults should be explicit core behavior, not
  hidden schema side effects.
- `coerceTypes: false` because callers should fix type mistakes instead of
  relying on implicit conversion.

## Schema Ownership

JSON Schema constants should live beside the browser-safe core contracts they
validate, normally under:

```text
packages/core/src/client/
```

For example:

```text
packages/core/src/client/screenplay-json-schemas.ts
packages/core/src/client/visual-language-json-schemas.ts
```

These schema modules should export plain JSON schema objects. They must not
import AJV, Drizzle, Node-only modules, server-only modules, or database access
code.

Server-side validators should live under a feature-owned server folder, for
example:

```text
packages/core/src/server/screenplay-json/validator.ts
packages/core/src/server/visual-language-json/validator.ts
```

Validators register schemas once per process with `addSchema` and retrieve
compiled validators with `getSchema`. Do not compile schemas on every command
request.

## Validation Boundary

JSON validation has two passes:

1. AJV validates the structural JSON contract.
2. Core performs semantic validation that needs project state.

Examples of semantic validation include checking that referenced assets exist,
that image filenames are inside the expected folder, that relationship IDs point
to current rows, and that section keys are allowed by the feature.

JSON parsing alone is not validation. Ad hoc type guards are not a replacement
for JSON Schema when data is persisted in SQLite.

## Unknown Fields

Project-owned stored JSON should use narrow schemas. Prefer
`additionalProperties: false` for stored JSON objects unless a current feature
explicitly documents why extra fields are part of the accepted contract.

External import formats may accept unknown fields as warnings at the import
boundary. Those unknown fields must be ignored or normalized before persistence.
They must not silently become stored JSON fields, TypeScript contract fields, or
database columns.

## Diagnostics

AJV failures at package boundaries must be reported through
`@gorenku/studio-diagnostics`.

Validators should map AJV errors to stable diagnostic codes with useful field
paths and suggestions. Do not expose raw AJV error arrays as the public command,
server, or CLI response shape. Do not use loose `throw new Error(...)` for
caller-caused JSON validation failures.

## Consequences

- SQLite JSON columns stay flexible without becoming untyped dumping grounds.
- Agents get clear, structured feedback when generated JSON does not match the
  current contract.
- UI resources can trust that parsed JSON has passed the same runtime schema
  used by CLI and server commands.
- Future JSON-shaped feature sections, including Visual Language, should reuse
  this pattern instead of inventing local validation rules.
