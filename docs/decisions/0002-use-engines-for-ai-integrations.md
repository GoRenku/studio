# 0002 Use Engines for AI Integrations

Date: 2026-05-05

Status: accepted

## Context

The old package name `providers` describes external SDK integrations, but it is
generic and tied to the existing Renku package line. Renku Studio needs a clearer
name for the layer that registers AI generation backends, exposes capabilities,
and normalizes calls across model vendors.

## Decision

Use **Engine** as the product and code term for an AI generation backend.

The future package should be:

```text
packages/engines -> @gorenku/studio-engines
```

Inside that package:

- `engine` means a registered generation backend.
- `adapter` means provider-specific SDK/API code.
- `registry` means the system that collects available engines.
- `capability` means what an engine can do, such as text-to-image,
  image-to-video, text-to-speech, music, transcription, or prompt enhancement.

## Consequences

- Studio-facing language becomes clearer than `provider`.
- The old provider package can be migrated deliberately instead of copied as-is.
- The Studio app should not depend on the legacy provider package.
