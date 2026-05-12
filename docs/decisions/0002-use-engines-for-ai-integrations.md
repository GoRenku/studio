# 0002 Use Engines for AI Integrations

Date: 2026-05-05

Status: accepted

## Context

The old package name `providers` describes external SDK integrations, but it is
generic and tied to the existing Renku package line. Renku Studio needs a clearer
name for the layer that registers AI generation backends, exposes capabilities,
and normalizes calls across model vendors.

## Decision

Use **Engine** as the package and Studio-facing product term for the AI
generation integration layer.

The package is:

```text
packages/engines -> @gorenku/studio-engines
```

Inside that package:

- `provider` may remain an internal vendor/backend term where it names a
  concrete external service, catalog entry, SDK adapter, or registry entry;
- `adapter` means provider-specific SDK/API code;
- `registry` means the system that collects available providers or engines for
  Studio use;
- `capability` means what an engine can do, such as text-to-image,
  image-to-video, text-to-speech, music, transcription, or prompt enhancement.

## Consequences

- Studio-facing language can use the broader `engine` concept without forcing
  every internal catalog and SDK type to avoid the vendor-oriented word
  `provider`.
- The old provider package can be extracted deliberately instead of copied as-is.
- The Studio app should not depend on the legacy provider package.
