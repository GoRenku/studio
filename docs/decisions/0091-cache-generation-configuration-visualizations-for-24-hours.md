# 0091 Cache Generation Configuration Visualizations For 24 Hours

Date: 2026-09-03

Status: accepted

## Context

Media Producer uses the bundled Visualize Skill to show a provider, model, and
provider-native configuration card before authoring a generation review
document. Rebuilding the same schema-derived HTML for every request is slow and
makes equivalent routes unnecessarily inconsistent. Fetching a provider's
schema for every card render adds another remote dependency even when that
schema was inspected recently.

The visual card is system behavior shared by every Renku Project. Request
prompts, targets, references, and selections remain Project- and task-specific
and must not leak through a shared cache.

## Decision

Core owns a system-wide cache beneath its existing platform configuration
directory:

```text
<renku-config-dir>/cache/generation-configuration-visualizations/v1/routes/
  <provider>/<exact-model-segments>/<operation>/<input-mode>/
    manifest.json
    schema.json
    template.html
```

The exact provider, executable model id, operation, and input mode form the
route identity. The manifest also fingerprints the route indexes used for the
Provider and Model selectors, the installed Visualize Skill version and
contents, and the version and contents of Media Producer's template contract. A
mismatch is incompatible and requires a new template.

Each successful live check sets `checkedAt` and `expiresAt` exactly 24 hours
apart. A cache inspection before `expiresAt` returns the schema snapshot and
template without contacting the provider. At or after `expiresAt`, Media
Producer fetches the current schema once. An unchanged semantic schema hash
refreshes the timestamps without rebuilding the template; a changed schema
requires a new template. A failed refresh does not use expired content.

The CLI exposes focused `generation configuration-visualization inspect`,
`store`, `refresh`, and `invalidate` commands. Core alone resolves the cache
path, validates route descriptors and HTML-fragment envelopes, hashes schemas
and templates, enforces freshness, rejects symlinked cache artifacts, and uses
atomic file replacement. The cache is disposable system state, not Project
data, a database contract, or generation provenance.

Shared `template.html` contains exactly one request-payload placeholder and no
request or Project values. A Media Producer script safely embeds a fresh JSON
payload into a task-local Visualize fragment. Prompts, purpose targets,
references, initial control values, credentials, browser state, and user
selections never enter the shared cache.

Final provider validation and execution remain live authoritative boundaries.
If validation reveals that a cached control is no longer accepted, Media
Producer invalidates that exact entry, refreshes it, and asks the user to
configure again. It never silently removes or translates the rejected value.

## Consequences

- Equivalent requests across Projects reuse one consistent route template and
  avoid provider schema traffic for 24 hours.
- Provider/model selectors remain broad because route-index changes invalidate
  templates independently from provider schemas.
- Changing provider, exact model, operation, or input mode selects a different
  cache entry rather than carrying controls across incompatible routes.
- No Settings surface, Project migration, database schema, provider adapter,
  or durable generation record changes.
- The existing raw provider metadata cache remains an Engines transport detail;
  this cache owns the longer-lived, schema-and-visualization artifact contract.

## Verification

Core tests cover hierarchy, the exact 24-hour boundary, semantic schema hashing,
dependency incompatibility, invalidation, template validation, and atomic cache
artifacts. CLI tests cover schema snapshot output and cache command delegation.
Skill tests cover stable descriptor fingerprints and safe task-local payload
materialization. Media Producer evals cover fresh hits, expiry, schema changes,
dependency changes, cross-Project isolation, refresh failure, and
validation-triggered invalidation.
