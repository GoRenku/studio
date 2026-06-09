# 0029 Use Cast Voice As Durable Project Data

Date: 2026-06-08

Status: accepted

## Context

Cast Design documents already describe performance direction and voice casting
notes, but they are not the right place to store provider voice ids, provider
model names, generated audio samples, or sample asset ownership.

Renku needs to support more than one named voice reference for a Cast Member.
Examples include a normal dialogue voice, a whispered variant, or a temporary
audition voice. Each reference needs durable metadata and a playable sample
asset that can be inspected in Studio.

## Decision

Renku Studio treats **Cast Voice** as durable Cast Member-owned project data.

A Cast Voice stores:

- the Cast Member owner;
- a human-readable reference name;
- a purpose;
- the provider;
- the provider model;
- the provider voice id;
- the linked audio sample asset;
- ordering and timestamps.

The linked audio sample is a normal project Asset with media kind `audio`, asset
type `cast_voice_sample`, and relationship role `voice_sample`. The Cast Voice
record owns the provider-specific voice reference. The asset owns the playable
file.

Cast Voice attachment and deletion are handled by the dedicated CLI surface:

```bash
renku cast voice attach --file <cast-voice-attachment-json> --json
renku cast voice remove --cast <cast-member-id> --voice <cast-voice-id-or-name> --json
```

Cast Voice samples can be generated through the `cast.voice-sample` media
generation purpose. Generated output is still attached through
`renku cast voice attach` so the provider generation step and durable Cast Voice
metadata mutation stay separate.

## Consequences

- Cast Design remains focused on creative direction and does not store provider
  voice ids or generated sample paths.
- Generic asset deletion refuses to delete a Cast Voice sample while a Cast
  Voice references it. The user must remove the Cast Voice first.
- Studio can show and play voice samples in the Cast Member surface without
  treating raw filenames or generated ids as product copy.
- Studio Skills should route provider voice id and sample attachment work
  through `renku cast voice`, not direct database edits or Cast Design JSON.
