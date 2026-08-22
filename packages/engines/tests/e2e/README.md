# Live Provider E2E Tests

These tests call real API providers and can incur cost. They are excluded from
the normal unit and integration suites.

## Running Tests

By default, every live test is skipped. Set the test's explicit `RUN_*` flag to
`1` on the command line and run the Engines E2E command:

Example:
```bash
RUN_FAL_TEST=1 pnpm --dir packages/engines test:e2e
```

The `RUN_*` flags only opt into paid execution. They do not provide credentials.
When a requested test has no saved credential, the test fails immediately with
the missing credential name instead of silently skipping.

## Saving Test Artifacts

By default, generated files (videos, images, audio, etc.) are **not** saved to disk.

To save test artifacts for manual inspection, set the `SAVE_TEST_ARTIFACTS` environment variable:

```bash
SAVE_TEST_ARTIFACTS=1 RUN_FAL_TEST=1 pnpm --dir packages/engines test:e2e
```

Generated files will be saved to `packages/engines/tmp/` which is git-ignored.

### Provider credentials

Provider credentials live only in the Core-owned Renku provider credential file.
On macOS that file is:

```text
~/.config/renku/.env
```

The E2E tests use the same Core `SecretResolver` as production. They do not load
credentials into `process.env`, inspect exported API-key variables, or fall back
to package-local or repository-local `.env` files. Exporting an API-key variable
in the shell therefore has no effect on the credential used by a test.
