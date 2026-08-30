# 0089 Use Capability-Aware Video Continuity And Editing

Date: 2026-08-30

Status: accepted

## Context

Video workflows need exact Scene Dialogue Audio continuity when a selected
provider route can accept uploaded audio references. The current Project model
had active per-turn Takes but no persisted user choice among them. Provider
prompt expansion also lacked a Project preference, and video editing had been
incorrectly treated as a Shot Plan-specific capability even though Asset media
kind, ownership, and registered files already provide the durable facts.

## Decision

Core stores zero or one selected active Take for each Scene Dialogue Audio
workspace. Selection is exact user intent, is distinct from common Asset display
selection, and is projected as `isWorkflowSelected` in Generation Context.
Generating or restoring a Take does not select it. Discarding the selected Take
clears selection atomically.

Media Producer resolves Dialogue Audio only after selecting a route and reading
its live schema. A route that accepts uploaded audio references uses the selected
Take by default, or the sole active Take when none is selected. Multiple
unselected Takes require a user choice in Scene Narrative; a missing Take
requires creating Dialogue Audio there. Explicit omission wins. Incapable
routes receive no invented audio field or mention, and live reference limits
are never handled by silent truncation.

The existing per-turn `scene.dialogue-audio` purpose remains the only Dialogue
Audio generation purpose. Agent-facing `dialogue-audio show/setup` commands
expose the Core workspace and complete setup document. Whole-Scene generation
is orchestration over independent per-turn ElevenLabs requests, outputs,
provenance, and Take attachments; it is not a combined audio artifact.

Project Settings version 5 adds default-on
`generation.enableProviderPromptExpansion`, projected as
`workflowPolicy.enableProviderPromptExpansion`. Skills apply it only by
semantically inspecting the selected live schema and provider documentation.
Core, Studio, CLI, and Engines keep no native field-name map and do not inspect
or rewrite creative prompt contents.

`video.edit` accepts any active registered Asset with a current video file,
regardless of Asset type or owner. The exact current source file must occur once
in safe video provenance. An accepted result is a separate ready, unselected
Asset beside the source. It inherits owner, type, title/metadata defaults,
locale, and weak authorship, stores new provenance, and uses a Core-allocated
`edited-video-gxxx` filename. Paths never determine ownership or type.

This decision supersedes plan 0096's rule that Scene Dialogue Audio has no
Scene-level selection. Historical plans and migrations remain unchanged.

## Consequences

- Dialogue Audio continuity is capability-based rather than Wan- or
  model-name-specific.
- Generation Context remains advisory and deterministic while exposing one
  exact workflow selection fact.
- Provider additions do not require runtime mappings for prompt expansion or
  reference-audio fields.
- Video editing and provider-native continuation share one source-derived
  attachment purpose without mutating the source or adding an edit-chain table.
- Studio remains the selection/setup/playback surface; generation stays in the
  conversational Media Producer workflow.

## Verification

Core, migration, CLI, route, Studio, desktop E2E, guide-validator, and Skill
eval coverage protect exact Take membership and lifecycle, Settings v5
preservation, selected reference projection, capability-based audio policy,
provider guidance, arbitrary video owner/type support, exact provenance source
matching, sibling paths, and rollback-safe persistence.
