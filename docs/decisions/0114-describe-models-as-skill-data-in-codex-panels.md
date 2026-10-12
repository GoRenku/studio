# 0114 Describe Models As Skill Data In Codex Panels

Date: 2026-10-11

Status: accepted

## Context

Plans 0226 and 0227 built the Codex dialogue direction and image edit panels
around specific models: model-named tools, UI resources, HTML builds, server
options, contracts, React panels and draft validators, plus model limits,
provider labels and provider request parsing in Codex and Studio. Adding one
more panel model touched about 15 files across `packages/codex`,
`packages/studio` and `packages/cli`.

That breaks the provider extension rule
([ADR 0086](0086-use-skill-directed-provider-engines-and-asset-generation-provenance.md),
[ADR 0088](0088-use-exact-request-references-and-source-derived-image-continuation.md)):
a model addition changes the Engines provider module and the Skills, and
nothing in Core, Studio or shared request contracts. The generation review
already had the model-neutral mechanism: Skill-authored, schema-derived
controls keyed by native JSON Pointer, validated structurally and rendered
generically.

## Decision

- There is one Codex panel per purpose: one dialogue direction panel
  (`dialogue.direction.open`, `ui://renku/dialogue-direction`) and one image
  edit panel (`image.edit.open`, `ui://renku/image-edit`), each with one HTML
  build.
- The Skill describes the selected route as data when it opens a panel, in a
  Route Description with three parts: route identity and display labels; a
  structure drawn from a small, closed, purpose-level vocabulary; and the
  native settings the model guide marks as relevant, as Native Request
  Controls built from the live schema.
- The dialogue vocabulary is Script Layout (`line-scripts`, `range-prompt`),
  Voice Binding (`speaker-voices`, `voice-references` with optional Voice
  Mentions), Max Voices, emphasis (`bracket-tags`, `quoted-spans` or none),
  Single-Line and optional Line-Range operations, advisory character limits
  and Script Locations. The image edit vocabulary is Region Modes (or none),
  whether the route takes a style reference, and controls.
- Each panel-capable model guide in studio-skills holds a `## Codex panel`
  block. Its short `controlPointers` list decides which native settings
  appear; the live schema supplies their kind, bounds and options. Engines and
  Core stay catalog-free.
- `packages/codex` validates Route Descriptions structurally and validates
  drafts against them. Studio renders them through the vocabulary. Neither
  reads or branches on a provider or model id, apart from echoing ids on
  consume and matching Take provenance against the described route.
- Panel controls reuse the generation review controls, renamed
  `NativeRequestControl*`, with a panel profile: scalar kinds, an initial
  value, never nullable.
- Panel code grows only with interaction shapes, never with models. A new
  shape is a product decision and an update to this ADR; a model that needs
  one gets no block until then, and `model-researcher` records it as a Studio
  product gap.
- ElevenLabs speech and dialogue gain Engines input schemas so their native
  settings can be panel controls; the ElevenLabs provider module is the only
  owner of those field facts.

## Consequences

- Adding a model that fits the vocabulary is a `## Codex panel` block in its
  Skill guide, with no code change in Codex, Studio, CLI or Core.
- The old model-named tools, resources, HTML builds and server options are
  removed with no aliases, so `studio` and `studio-skills` release together.
- Panel copy comes from purpose templates filled with Skill-supplied labels.
- Seed Audio Takes gain Edit from Take, because any route with a declared
  Script Location can reopen earlier direction.
- `AGENTS.md` adds the top instruction "Model Knowledge Lives In Engines And
  Skills"; reviewers treat model knowledge in Codex panels, Studio, CLI or Core
  as a high-severity boundary violation.

## Verification

Codex and Studio panel tests use only fictional routes, covering every layout
and binding pairing, single-line-only routes, region-free routes, routes
without a style reference, control values and Script Locations. A scan of the
panel modules, Studio panel features, app entries, HTML files and CLI Codex
wiring finds no provider or model names.
