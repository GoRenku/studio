# 0001 Create Renku Studio Monorepo

Date: 2026-05-05

Status: accepted

## Context

The existing Renku repository contains several packages and root commands that
build and test more than the new long-form Studio product needs. The new product
also needs package names that do not collide with the existing published
`@gorenku/core`, `@gorenku/cli`, and `@gorenku/providers` packages.

## Decision

Create a new local monorepo at:

```text
/Users/keremk/Projects/aitinkerbox/studio
```

Use the product name **Renku Studio** and the package family:

```text
@gorenku/studio-core
@gorenku/studio-cli
@gorenku/studio-engines
@gorenku/studio
```

`@gorenku/studio-engines` is extracted as a focused AI engine package. It keeps
provider-organized model catalogs, schema-first validation, simulation, and
provider adapters, while leaving legacy Renku timeline/export/final-render
producers behind.

## Consequences

- Root commands in the new repo only target Studio packages.
- Existing Renku npm packages can continue independently.
- Studio docs and plans can be cleaned up without carrying all legacy Renku
  repository rules forward.
- Engines can evolve around Studio's asset-generation needs without inheriting
  old execution-plan or final-rendering design choices.
