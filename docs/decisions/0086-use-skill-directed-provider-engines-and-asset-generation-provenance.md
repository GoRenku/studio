# 0086 Use Skill-Directed Provider Engines And Asset Generation Provenance

> **Decision 0087 update:** Provider-native authorship and execution ownership remain unchanged. Core additionally owns deterministic, advisory Project context and relationship-derived media suggestions for each purpose and target.

Date: 2026-08-24

Status: accepted

## Context

Studio previously treated provider execution as a shared product lifecycle. Core
stored Generation Specs and Runs, Engines depended on workspace-owned concepts,
Preview projected purpose-specific authoring contracts, and attachment recovered
provenance indirectly through file-level generation records. That made provider
addition require coordinated changes across Engines, Core, CLI, Studio, storage,
and Skills even when the provider protocol was the only new capability.

Provider-native request fields and creative prompts are intentionally opaque to
Studio. Provider and model choice is an agent workflow decision informed by a
provider Skill, while durable Studio state needs only the exact safe request and
receipt that authored an attached Asset.

## Decision

`@gorenku/studio-engines` is a standalone package for asset-generation provider
protocols. It has no workspace dependency and receives an opaque credential,
provider-native JSON request, local-file markers, timeouts, cancellation, cache,
fetch, and output directory through its public contract. Providers own schema
retrieval, authentication, upload, retry classification, polling, recovery,
output normalization, and download. Engines exposes closed structured errors.

Provider and model selection belongs to Media Producer and focused provider
Skills. The CLI composes installed providers and delegates validation, execution,
and recovery exactly once. Core resolves Project state and credentials, validates
safe review/provenance envelopes, owns attachment, and never executes providers.

Preview uses a temporary Project-relative JSON document under
`tmp/operations/media-generation/`. The shared Studio view renders prompt,
recursive local references, provider-native configuration, and diagnostics.
Preview may update only the top-level prompt and offers Update and Close; it has
no Generate action or agent-resume protocol. Inspection projects the same view
from saved Asset provenance and is read-only.

Each generated Asset may store one exact `MediaGenerationProvenance` value:
provider, model, media kind, prompt, native request, and optional opaque receipt.
`renku media import --provenance` passes that value to the focused Core attachment
owner. Provenance is Asset-level rather than AssetFile-level. Asset copies retain
it immutably. Codex built-in image generation uses provider `codex` in the same
review/provenance envelope only when the current harness exposes the capability;
Codex is never registered in Engines and has no invented provider receipt.

Persisted Generation Specs, Runs, estimates, approval tokens, freezing,
simulation, generic model catalogs, pricing, and dependency orchestration are
removed. Ask Before Generating and concurrency remain conversational per-media
Project workflow preferences. World Labs Location World generation remains a
focused Engines API with Core-owned Project input and persistence.

## Consequences

- A normal provider addition changes Engines, CLI registration, provider Skill
  guidance, tests, and release notes. It does not require Core, Studio, database,
  Preview, or a shared request schema.
- A new credential descriptor or Project provider preference is a separate
  product decision, not an automatic consequence of provider support.
- Provider review files are temporary operation artifacts. They have no id,
  lifecycle, status, approval, price, or attachment identity.
- Attachments without generated provenance remain valid only where the focused
  domain purpose accepts external media. Required-provenance purposes fail before
  writing.
- Migration is one-way. Reachable generated Assets receive safe coherent
  provenance before obsolete tables and columns are dropped; conflicts abort.
- Creative contents remain opaque. Runtime validation covers only the envelope,
  safe paths/URLs/secrets, provider protocol schema in Engines, and focused domain
  attachment relationships.

## Verification

The architecture is protected by package import/manifest checks, a built public
surface consumer, a test-only Atlas-like provider injected through the public
Engine and CLI seams, provider mechanism tests, Core review/provenance and
migration tests, shared Studio view/route tests, and Media Producer/provider Skill
evals. Paid provider smoke tests remain explicit opt-in checks.
