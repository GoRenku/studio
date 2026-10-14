# Paid Provider Smoke Tests

Provider smoke tests are explicit opt-in checks. They are not part of the normal
test suite and must never be used to prove the refactor.

Each suite runs only after the operator deliberately opts into that provider
test. The tests then use the provider key saved in Renku Settings, read through
the CLI's own credential lookup (`createExecutionContext` in
`src/commands/generation/engine-context.ts`), so they exercise the same key and
context path as `renku generation`. A saved key alone never starts a paid
request.

Use `isPaidProviderTestEnabled` and `createProviderTestContext` from
`provider-test-context.ts` in each paid test. Give `isPaidProviderTestEnabled` a
test-specific `RUN_*` variable; suites stay skipped until it is exactly `1`. An
opted-in suite with no saved key fails with the CLI's missing-credential error.
Import provider code only from the public `@gorenku/studio-engines` entrypoint.

Run no paid test without separate user approval. Keep requests small, cap output,
and clean provider jobs/artifacts when the provider supports it.

Each suite is independently enabled:

- `RUN_FAL_TEST=1`
- `RUN_REPLICATE_TEST=1`
- `RUN_WAVESPEED_TEST=1`
- `RUN_PIKA_TEST=1`
- `RUN_ELEVENLABS_TEST=1`
- `RUN_ELEVENLABS_VOICE_SAMPLE_TEST=1` (read/download only)
- `RUN_ELEVENLABS_MEDIA_ENGINE_TEST=1`

Run the selected suite with `pnpm --dir packages/cli test:e2e -- <name>`
only after the operator approves the external request and its possible cost.

The image-provider suites make one low-cost request each and verify that the
generated image was downloaded to a nonempty temporary file:

- Fal.ai: `openai/gpt-image-2`, one square image at low quality.
- Replicate: `black-forest-labs/flux-schnell`, one image.
- WaveSpeed: `wavespeed-ai/z-image/turbo`, one image.
- Pika: `meta/muse-image-1.0/text-to-image`, one image at low reasoning strength.

The Pika suite checks live metadata, validation, submission, polling, and image
download. It does not verify video generation or local-media upload. As of
2026-09-27, Pika lists the selected image route at $0.0105 per successful image.
Recheck the live operation specification, price, and account balance before a
paid run. The test removes its temporary output afterward. Run only with an
explicit paid-test decision:

```bash
RUN_PIKA_TEST=1 pnpm --dir packages/cli test:e2e -- pika
```
