# Module Boundary Investigation

Date: 2026-07-04

Status: accepted follow-up recorded

Role: architecture investigation

## Purpose

This investigation records module-boundary gaps exposed while cleaning up
architecture tests.

The immediate smell was a set of static tests that tried to protect real
architecture rules by scanning source text for current private file names,
function names, or partial path strings. That is not an acceptable architecture
test strategy. It makes ordinary refactors fail and hides the deeper problem:
some areas do not yet have stable module boundaries that can be checked cleanly.

Static architecture tests should be added only after the boundary exists as a
real package, folder, public contract, or runtime behavior.

## Findings

### 1. Media generation now has a stable package boundary

Decision 0086 removed the Core-owned generic estimate, Spec, Run, and execution
rail that motivated this finding. `packages/engines` now owns only standalone
provider protocols and execution mechanics. Core owns focused Asset attachment,
safe provenance, Project settings, and credentials; CLI is the installed
composition root. Architecture checks can therefore protect package imports and
public capability without naming private helpers.

### 2. Engines provider modules are explicit owners

Each production provider owns its protocol mapping, request validation,
provider-specific retry classification, polling/recovery behavior, and output
normalization. Shared Engines modules are limited to the public engine contract,
schema execution, metadata cache, local-file traversal, retry timing, downloads,
and closed error codes. Pricing, simulation, Studio purpose catalogs, and durable
Project state are not Engines capabilities.

### 3. Scene Beats And Shot Authoring Needed Separate Owners

Resolution:

- Decision 0052 replaced the mislabeled scene coverage aggregate with a focused
  Scene Beats domain in Core.
- Beat context, history, operations, storyboard status, and validation are
  separate focused modules behind the Core-owned public contract.
- The reusable Shot composition, motion, dialogue, and AI Production controls
  live in a persistence-free Studio feature kit.
- There is no Shot service, Take workspace, Shot generation purpose, or broad
  durable state patch API.

Enforceable boundary:

- UI and adapters may consume Beat projections and send Scene Beats intent to
  Core, but they may not validate or write Beat metadata directly.
- Shot authoring components may not import project services or create durable
  Shot/Take state until a future accepted architecture defines that owner.

Future enforceable check:

- After submodules exist, use import-boundary checks between submodules. For
  example, planning should not import live generation, and HTTP/CLI adapters
  should call public core commands rather than submodule internals.

### 4. Focused attachment replaces the purpose lifecycle

Decision 0086 removed the generic purpose registry and lifecycle. Skills own
creative/provider request authoring, Engines executes provider-native requests,
and focused Core commands validate Asset ownership and attach exact safe
provenance. CLI and Studio remain adapters to those public owning-layer
contracts.

## Removed Static Checks

The cleanup removed static checks that tried to enforce these concerns by naming
current private implementation paths. Those checks were not wrong about the
desired architecture, but they were wrong as tests.

The replacement boundaries are protected through import checks, public contract
tests, runtime validation-before-write tests, and focused code review. Tests do
not enumerate private provider helpers or command inventories.

## Recommendation

The original follow-up was accepted in Decision 0044. Decision 0086 now
supersedes its generic lifecycle/pricing shape while retaining the rule that
boundaries must be visible in packages and public APIs. Narrow import-boundary
tests should name those stable boundaries, not private implementation files or
helper names.

The target is a codebase where architecture tests can say "this module must not
import that module" instead of "this file must not mention today's private
helper."
