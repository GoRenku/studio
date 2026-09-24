# 0102 Preflight Provider Credentials And Curate Cross-Provider Routes

Date: 2026-09-24

Status: accepted

## Context

An agent can spend time preparing a generation request before Engines reports
that the selected provider has no saved key. Studio already has a Core-owned,
sanitized credential status resource and a global Settings dialog. Fal.ai's
bundled model list also has broader coverage than the other media providers.

## Decision

`renku credentials status --json` reads the existing Core status resource. It
lists each managed provider's identity, label, and saved-key presence, with no
secret or environment-variable value. Missing keys are a successful status
result. Credential-file read errors retain Core's structured diagnostic.

Agents check the selected external provider immediately after selection, before
prompt, reference, schema, or World input preparation. A missing key pauses the
request and directs the user to the existing global Settings editor through
`/?settings=provider-credentials` on the running Studio URL. Closing or saving
removes only that query parameter. The agent rereads status after the user saves
or changes provider. Saved presence does not certify remote validity; Engines
still owns operation-time authentication failures. Codex built-in image has no
Renku provider key.

For the September 2026 catalog update, Fal.ai's bundled routes were used as a
one-time research list for additions to Pika, WaveSpeed, and Replicate where
the exact model version and operation were available. This does not establish
an ongoing requirement to match provider catalogs. The indexes remain
independent discovery and optional guidance; live schemas and Engines continue
to own native request validation and execution.
Replicate and WaveSpeed remain explicit advanced choices. ElevenLabs remains
audio-focused. No provider default, personal library, credential write
contract, or paid execution policy changes.

## Consequences

The CLI can help an agent warn early without exposing secrets or requiring an
active Project. The Studio deep link reuses the existing write-only editor.
Curated routes become available through a later Studio Skills release, without
claiming that each has been exercised by a paid provider request.
