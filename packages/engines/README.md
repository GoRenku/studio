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

`createRenkuProviderSecretResolver` resolves each requested secret only from
`~/.config/renku/.env`. It ignores exported shell values and does not mutate
`process.env` or cache file values, so a saved replacement applies to the next
provider operation. Generic resolution remains available to existing unlisted
consumers, but only catalog entries are exposed or writable through Studio
Settings.

The environment-file owner preserves unmanaged lines, rewrites managed entries
in catalog order, uses an atomic sibling-file replacement, and sets the
resulting credential file to `0600`. Read projections contain presence and
effective-source metadata only, never secret values.
