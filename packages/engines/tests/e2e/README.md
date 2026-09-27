# Paid Provider Smoke Tests

Provider smoke tests are explicit opt-in checks. They are not part of the normal
test suite and must never be used to prove the refactor.

The test operator supplies a credential through an E2E-only environment variable
after deliberately opting into the selected provider test. Production credential
resolution remains in Core/CLI. E2E tests must not import Core, read Renku's
credential file, or perform a paid request merely because a credential happens to
exist in the shell.

Use `readOptInProviderTestCredential` from `provider-test-credentials.ts` in
each paid test. Give it a test-specific `RUN_*` variable and the provider's
ordinary environment credential name. It returns `null` until the opt-in is
exactly `1`, and it fails clearly when opt-in is present without a credential.
Do not add a Core import or a credential-file reader to this package.

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

Run the selected suite with `pnpm --dir packages/engines test:e2e -- <name>`
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
RUN_PIKA_TEST=1 pnpm --dir packages/engines test:e2e -- pika
```
