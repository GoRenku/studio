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

FDX import uses stable `SCREENPLAY_FDX_...` codes:

- source envelope: `SCREENPLAY_FDX_SOURCE_NOT_FOUND`,
  `SCREENPLAY_FDX_SOURCE_NOT_FILE`, `SCREENPLAY_FDX_SOURCE_INVALID`,
  `SCREENPLAY_FDX_SOURCE_UNREADABLE`, and `SCREENPLAY_FDX_SOURCE_TOO_LARGE`;
- parser safety/shape: `SCREENPLAY_FDX_UNSAFE_XML`,
  `SCREENPLAY_FDX_INVALID_XML`, `SCREENPLAY_FDX_INVALID_DOCUMENT`, and
  `SCREENPLAY_FDX_LIMIT_EXCEEDED`;
- semantics: `SCREENPLAY_FDX_UNSUPPORTED_VISIBLE_CONTENT`,
  `SCREENPLAY_FDX_INVALID_DIALOGUE`;
- state/persistence: `SCREENPLAY_FDX_IMPORT_INVALID`, `SCREENPLAY_FDX_SOURCE_CHANGED`,
  `SCREENPLAY_FDX_SOURCE_IN_USE`,
  `SCREENPLAY_FDX_SOURCE_DESTINATION_CONFLICT`,
  existing `SCREENPLAY_NOT_EMPTY`, and
  `SCREENPLAY_FDX_BACKED_READ_ONLY`.

Malformed XML includes parser line/column data. Well-formed semantic failures
use the stable FDX element path and zero-based Content paragraph index.

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

## Detected FDX Update Diagnostics

- `SCREENPLAY_FDX_UPDATE_NOT_APPLICABLE`: the focused operation requires an FDX-backed Project; status returns `notApplicable` instead.
- `SCREENPLAY_FDX_EXPORT_PATH_INVALID`: the fixed handoff is unsafe, has the wrong kind, uses symlinked segments, or aliases retained history.
- `SCREENPLAY_FDX_UPDATE_REVIEW_STALE`: source, baseline, revision, or material impact changed; review the latest export before confirming.
- `SCREENPLAY_FDX_UPDATE_REPLACES_SCENES` (warning): current Scene identities disappear; retained production work does not automatically attach to replacements.

Source I/O, size, XML, unsupported-content, source-changed, and retained-source
conflicts reuse existing FDX diagnostics. Missing exports are expected status,
not deletion instructions. No durable pending state or migration is required.

## Personal media model library

Core reports `CORE_MEDIA_MODEL_LIBRARY_INVALID` for malformed/oversized envelopes,
`CORE_MEDIA_MODEL_LIBRARY_PATH_INVALID` for unsafe paths,
`CORE_MEDIA_MODEL_PROVIDER_UNSUPPORTED` for an unregistered provider,
`CORE_MEDIA_MODEL_LIBRARY_CONFLICT` for a stale revision,
`CORE_MEDIA_MODEL_LIBRARY_BUSY` for a held lock,
`CORE_MEDIA_MODEL_NOT_FOUND` for a missing personal removal target, and
`CORE_MEDIA_MODEL_LIBRARY_IO_FAILED` for storage IO failures.
Missing optional guidance has no diagnostic. Provider execution retains Engines codes.

## Sample film and star note

Core reports sample film installation failures with `SAMPLE_FILM_` codes; Studio
HTTP maps the prefix to 400:

- `SAMPLE_FILM_FOLDER_IN_USE`: `sample-project` in the Project Library exists
  and is not a Renku project; nothing is touched.
- `SAMPLE_FILM_INSUFFICIENT_SPACE`: less than twice the download size is free;
  reports the needed and available megabytes.
- `SAMPLE_FILM_DOWNLOAD_FAILED`: release lookup failure, missing release asset,
  network error, non-2xx HTTP status, no data for 60 seconds, or a download
  larger or smaller than the size reported by GitHub when available.
- `SAMPLE_FILM_UNPACK_FAILED`: the system `tar` is missing or failed, or the
  archive lacks the expected project folder.
- `SAMPLE_FILM_REQUIRES_NEWER_RENKU`: the downloaded sample was made by a newer
  Renku; it is not placed in the Library. Its suggestion says how to update:
  the update button in the Studio header or `renku update`, then open the
  sample film again.

`PROJECT_DATA044` for a project database saved by a newer Renku carries the
same update suggestion. The Project Library card shows it under the error.
- `SAMPLE_FILM_STORAGE_FAILED`: a filesystem error while staging or placing
  the folder (error), or a staging folder that could not be removed after a
  successful install (warning in the report).
- `SAMPLE_FILM_INSTALLATION_FAILED`: an unexpected failure in Studio's
  background attempt, reported in its `failed` state.

Opening and upgrading the placed sample keep their existing `PROJECT_DATA`
codes and backup details.

The star note reports `STAR_NOTE_STATE_INVALID` when `star-note.json` is
unreadable or invalid (the note then never shows) and
`STAR_NOTE_STATE_WRITE_FAILED` when it cannot be written; Core never offers the
note without a successful write. `STUDIO_SERVER042` rejects a star note request
body other than `{ "projectName": string }`. `CLI168` rejects a missing or
unknown `renku sample-film` subcommand.

## Usage statistics

Core reports `CORE_TELEMETRY_CHOICE_INVALID` when `heardAbout` is not in the
closed answer list or is sent with `enabled: false`,
`CORE_TELEMETRY_FILE_INVALID` when `telemetry.json` is not exactly
`{ formatVersion: 1, installId: <UUID> }` (suggesting `renku telemetry disable`),
and `CORE_TELEMETRY_FILE_IO_FAILED` when the file cannot be read, written or
deleted. Studio HTTP maps them to 400 by the `CORE` prefix. `STUDIO_SERVER362`
rejects a usage statistics request body other than
`{ enabled: boolean, heardAbout?: string }`. `CLI169` rejects a missing or
unknown `renku telemetry` subcommand. Recording an event never reports an
error (ADR 0120).

## Generation CLI handoff

`CLI_GENERATION_REQUEST_HASH_INVALID` rejects a malformed expected SHA-256 digest.
`CLI_GENERATION_REQUEST_CHANGED` rejects changed prepared-request bytes before
provider context creation or execution. The caller must inspect and reprepare
the changed request; neither error implies a provider submission.

`CLI_GENERATION_PROVENANCE_WRITE_FAILED` means provider execution completed but
the CLI could not publish its provenance file. The diagnostic identifies the
output path, downloaded media, optional provider request id, and any complete
temporary provenance file. It does not echo the receipt or retry generation.

Provenance assembly and Core validation failures after provider completion also
identify the downloaded media and optional provider request id, with an explicit
instruction not to submit another generation. Core validation errors retain
their original codes, issues, and validation reasons. Invalid provenance is not
published as an import-ready file.

Generation visualization preparation reports
`CLI_GENERATION_VISUALIZATION_PAYLOAD_INVALID` for malformed payload JSON and
`GENERATION_CONFIGURATION_VISUALIZATION_CACHE006` for a non-object payload or
an instance exceeding the fragment size limit. Shared-cache output protection
uses `GENERATION_CONFIGURATION_VISUALIZATION_CACHE004`; atomic output failures
use `GENERATION_CONFIGURATION_VISUALIZATION_CACHE005`. Combined request
preparation retains existing Engines validation errors and `CLI144` for failed
Preview delivery.
