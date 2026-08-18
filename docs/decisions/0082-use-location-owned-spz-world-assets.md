# 0082 Use Location-Owned SPZ World Assets

Date: 2026-08-18

Status: accepted

## Context

Renku needs to turn a reviewed equirectangular panorama or reconstruction image
set into a navigable Gaussian splat, keep prior results for rollback, and
display the current result without depending on an expiring provider URL.
Location Hero selection already uses the common Asset selection table, but its
owner-scoped key cannot independently select a Location World.

World Labs Marble's World response supplies SPZ variants for panorama and
multi-image inputs. Spark can load the full-resolution SPZ directly and build
its initial LOD tree in a worker. Using PLY, SPLAT, KSPLAT, or Spark RAD would
require conversion or a different delivery pipeline without improving this
focused workflow.

## Decision

A generated 3D World is a Location-owned Asset with type `location_world`,
media kind `model`, origin `world-labs`, and one primary full-resolution SPZ.
Core persists it at:

```text
locations/<location-handle>/world-gxxx.spz
```

The exact panorama or two-to-eight reconstruction inputs remain temporary files
under `tmp/media/`. Engines owns the narrow World Labs upload, fixed
`marble-1.1` direct panorama request with `is_pano: true` or multi-image request
with reconstruction enabled and no directional azimuths, authored-prompt
recaption disablement, operation polling, and one-time full-resolution SPZ
download. Core owns validation, durable file allocation, Asset membership, and
selection. Renku does not persist the provider's panorama output. Provider URLs
and credentials are never persisted or returned to Studio.

Common Asset selection is extended with the bounded `locationWorld` target.
The selected-asset storage key is therefore named `target_key`; existing
selection values retain their data and behavior. Every successful generation
adds a candidate and atomically selects it. Rollback selects a retained older
Asset through the same common command.

Studio adds a read-only **3D World** Location tab. Spark receives only the local
Asset-file URL, loads SPZ with `lod: true`, and never calls World Labs. The
existing Asset-file response streams local bytes with immutable browser caching.

## Consequences

- A Location has at most one current World while retaining prior candidates.
- SPZ is downloaded from World Labs once per successful generation; subsequent
  views read the saved Project file or browser cache.
- Location Hero selection remains independent and unchanged.
- PLY/SPLAT/KSPLAT conversion, Spark RAD preprocessing, HTTP Range delivery,
  remote World management, and Studio generation controls remain outside this
  decision.
- Prompt and image quality review stays in the agent/user workflow; runtime
  validates only owned envelopes and never interprets creative contents.
