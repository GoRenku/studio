# Structured Diagnostics

Date: 2026-05-12

Status: current

Role: reference

Renku Studio uses structured diagnostics for package-boundary errors, validation
results, and agent-readable command failures.

The shared package is `@gorenku/studio-diagnostics` in `packages/diagnostics`.
It is private to the workspace.

Decision history:

- `../../decisions/0009-use-structured-diagnostics-at-package-boundaries.md`

## Diagnostic Contracts

Use the shared contracts instead of inventing local error payloads:

- `DiagnosticSeverity`: `error` or `warning`.
- `DiagnosticLocation`: `filePath?`, `path`, and optional `context`.
- `DiagnosticIssue`: `code`, `message`, `severity`, `location`, and optional
  `suggestion`.
- `DiagnosticResult`: `valid`, `issues`, `errors`, and `warnings`.
- `StructuredError`: an `Error` with `code`, `issues`, and optional
  `suggestion`.

Validation code should collect all actionable issues before failing. Do not
throw on the first validation problem when the caller can benefit from seeing
the full set.

## Code Namespaces

Use readable domain prefixes:

- `CONFIG001...` for global config.
- `PROJECT_SETUP001...` for setup YAML validation.
- `PROJECT_DATA001...` for project database, filesystem, and data access.
- `CORE_...` for core planning, validation, and resource diagnostics whose
  domain-specific names are clearer than numeric project-data codes.
- `CLI001...` for CLI argument and command errors.
- `STUDIO_SERVER001...` for Studio HTTP adapter errors.

Do not add aliases for obsolete short codes.

## Warnings Versus Errors

Errors block the operation. Warnings do not.

For import YAML:

- missing required fields are errors;
- invalid required values are errors;
- wrong required field names become missing-field errors plus unknown-field
  warnings;
- unknown fields are warnings and are ignored;
- unknown fields must never create database columns, DTO fields, or schema
  changes.

The database schema is deliberate and Drizzle-owned. Import YAML validates
against the current project setup shape; it does not drive the schema.

## CLI Output

Human CLI output:

- successes go to stdout;
- warnings go to stderr before success output;
- errors go to stderr with code, location, message, and suggestion when present.

JSON CLI output:

- success writes the command report to stdout, including warnings;
- validation failure writes a JSON diagnostic report to stderr and leaves stdout
  empty.

This is important for agents: stderr should contain enough structured
information to diagnose what is wrong without scraping prose.

## HTTP Output

Studio server adapters serialize `StructuredError` as:

```json
{
  "error": {
    "code": "PROJECT_SETUP999",
    "message": "Project setup YAML failed validation.",
    "issues": [],
    "suggestion": "Fix the reported project setup errors and run the command again."
  }
}
```

HTTP adapters should map status codes from code prefixes and should not depend
on package-specific error classes.
