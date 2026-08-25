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

Run no paid test without separate user approval. Keep fixtures small, cap output,
and clean provider jobs/artifacts when the provider supports it.
