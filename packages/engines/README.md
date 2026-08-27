# @gorenku/studio-engines

Standalone media-provider execution for Renku.

The package owns provider protocols and shared provider mechanisms:

- exact-model metadata/schema retrieval and raw conditional caching;
- provider-native request validation;
- recursive `LocalMediaFile` discovery and upload substitution;
- provider-classified retry, polling, cancellation, and recovery;
- normalized output discovery, safe download, MIME/size checks, and atomic files;
- closed, secret-safe `EngineErrorCode` failures.

It does not depend on another workspace package. It knows nothing about Projects,
Assets, purposes, targets, Preview, Studio UI, Project Settings, credentials on
disk, pricing, approvals, or agent workflows. Callers pass one opaque credential
and all runtime dependencies through `ProviderContext`.

## Public surface

Create a `MediaEngine` with provider factories and call `readInputSchema`,
`validate`, `execute`, or `recover` by provider id. Schema inspection returns
the existing provider loader's raw live input schema. Requests contain the exact
provider API model id, passed unchanged to the provider, and opaque JSON input.
A local file is represented exactly as:

```ts
interface LocalMediaFile {
  $file: string;
  mimeType?: string;
  reviewLabel?: string;
  promptMention?: string;
}
```

The two annotations are opaque caller review metadata. Engines replaces the
entire marker during validation/upload and never interprets provider prompt
syntax.

Execution returns normalized downloaded artifact paths and an optional opaque
provider receipt. The caller decides how those facts are stored or attached.

Production factories currently cover Fal.ai, Pika, Replicate, WaveSpeed, and
ElevenLabs. Pika uses provider id `pika`, receives one opaque `PIKA_API_KEY`
value from its caller, and reads the exact selected operation from Pika's live
catalog. It has no Engines model allowlist or checked-in schema fallback. World
Labs is a focused Location World API because a 3D World is not ordinary
image/video/audio generation. Codex built-in image generation is not an Engines
provider.

## Checks

```bash
pnpm --dir packages/engines type-check
pnpm --dir packages/engines test:typecheck
pnpm --dir packages/engines test
pnpm --dir packages/engines build
pnpm --dir packages/engines lint
```

Paid smoke tests are manual and explicit. See
[`tests/e2e/README.md`](tests/e2e/README.md). For the provider extension contract,
see [`docs/adding-a-provider.md`](docs/adding-a-provider.md).
