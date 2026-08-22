# @gorenku/studio-engines

Renku Studio AI engine package.

This package owns:

- provider-organized model catalog data;
- schema-first payload validation;
- live and simulated engine invocation;
- provider adapters for model APIs.

It intentionally does not own final movie assembly, timeline rendering,
Remotion, FFmpeg export producers, or the legacy Renku execution-plan bridge.

## Provider credentials

Engines owns the ordered Settings credential catalog for fal.ai (`FAL_KEY`),
ElevenLabs (`ELEVENLABS_API_KEY`), and World Labs (`WLT_API_KEY`). The catalog
is an explicit product allowlist rather than a projection of every provider
adapter present in the package.

Core owns the Renku `.env` file and injects a `SecretResolver` into live Engines
operations. Engines never discovers a user config directory. The Core resolver
ignores exported shell values and reads each saved value for the next provider
operation, while only catalog entries are exposed or writable through Studio
Settings.

Live-provider E2E tests and provider catalog tooling receive that same Core
resolver. They never read API keys from `process.env`; selecting an operation
without a saved key fails with the missing credential name.

The Core environment-file owner preserves unmanaged lines, rewrites managed entries
in catalog order, uses an atomic sibling-file replacement, and sets the
resulting credential file to `0600`. Read projections contain presence and
effective-source metadata only, never secret values.
