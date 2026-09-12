# 0090 Use Shot Plan Dialogue Audio And Provider-Neutral Cast Voices

Current clarification: [ADR 0097](0097-use-agent-directed-scene-segmentation.md)
permits recorded, unretimed excerpts of selected Takes for authorized multi-clip
generation with complete scene coverage. Other whole-Take and selection rules remain.

Date: 2026-09-01

Status: accepted

## Context

Dialogue Audio is generated for the coverage represented by a Shot Plan, not as
editable setup attached to every screenplay Dialogue Turn. Seed Audio can
generate either one speaker or a consecutive multi-speaker exchange from
file-backed voice references. ElevenLabs instead uses a durable provider voice
identity. Core must persist the Studio domain facts without learning either
provider's models, request fields, controls, or capabilities.

The screenplay's displayed Turn numbers are useful for conversational requests,
but they are not stable domain identity. A reimport may change those numbers and
the product deliberately does not repair or invalidate existing audio.

## Decision

`shot_plan_dialogue_audio_take` stores one independent Project-owned audio Take
with its exact Shot Plan, Asset/File, positive consecutive inclusive Turn range,
selection timestamp, and lifecycle fields. It stores no Dialogue Turn ids,
speaker relations, grouping, combination, completeness, or stale-range state.
Every Take starts unselected. Selection is independent and multi-select; video
Generation Context projects every selected Take as one exact reference,
including a multi-Turn Take as one reference.

Narrative computes canonical Dialogue Turn numbers from the current screenplay
order and shows only the small top-right number. Dialog, Takes, and Advanced
panels are removed. Shot Plan detail adds **Audio** after **Assets**. Its Media
Cards show range, Cast Profile portraits or an empty state, waveform, generic
provenance/date, shared selection, and hover/focus Trash. Studio has no audio
generation button.

Cast Voice remains durable Cast Member-owned data. Each Cast Voice has a
playable sample Asset, optional bounded opaque `voiceIdentity` JSON, and default
selection through `cast_voice_default`. Core never interprets identity provider,
model, id, or capability fields. Provider Skills decide whether a generation
uses a sample file or understands an opaque identity. The typed provider
registration table and provider-specific sample-source fields are removed.
Discarding the default voice clears that relation. Restoring it restores the
default relation when no newer default exists; otherwise Core keeps the newer
choice and reports a structured warning.

Audio configuration is request-scoped conversation state. Media Producer always
shows a Codex inline configuration component initialized from Project Settings
and the Cast Member's default voice, but changes apply only to that request.
Project Settings version 6 allows ElevenLabs or Fal.ai as the opaque default
audio provider preference.

Fal.ai Seed Audio support lives in Engines and Skills. The provider adapter owns
the live schema, local `audio_urls`, output normalization, and request limits;
the provider-neutral model guide owns prompt craft. ElevenLabs voice sample
retrieval is a normal Engines operation. Generation provenance remains the only
durable provider/model source of truth for each accepted output.

The one-time migration converts only the explicitly reviewed populated Urban
Basilica Takes and voice identities, establishes deterministic defaults, and
fails rather than guessing when unexpected active legacy data is present.

## Consequences

- Adding another audio provider or voice identity shape requires no Core Cast
  Voice contract or schema change.
- A stale Turn range stays playable and user-deletable; there is no hidden
  repair or validation system.
- Single-Turn Seed Audio, single-Turn ElevenLabs, and multi-Turn Seed Audio all
  produce the same simple Take type.
- Disjoint ranges are separate generations. More than three Seed speakers,
  more than 2,048 prompt characters, likely over-two-minute output, and live
  video-reference limit overflow are conversational stop conditions, never
  runtime content interpretation or silent truncation.
- Selected exact Takes, not inferred sole candidates, define video audio
  reference context.

## Verification

Core migration/domain tests cover opaque identity, deterministic defaults,
range persistence, multi-selection, exact selected reference projection, file
membership, and Trash. Engines tests cover Seed reference count and ElevenLabs
sample retrieval. CLI, HTTP, Studio, skill validators/evals, Urban Basilica
migration rehearsal, and desktop visual comparison cover the remaining public
surfaces without paid generation.
