# 0051: Keep Generation Authoring Incomplete And Reference Slots Agent-Directed

Date: 2026-07-15

Status: accepted for generic generation authoring; Shot/Take-specific clauses
superseded by Decision 0052

## Context

Generation purpose guides currently mix two concerns: trustworthy product UI
placement and executable provider validation. Treating a guide candidate list
as an authorization list makes saved authoring invalid when current Scene or
guide projections change. Automatic provider-field binding and provider-value
defaults also turn incomplete authored intent into Studio-authored intent.

Typed domain slots are still useful because Studio can truthfully show which
Character Sheets belong to a Cast Member, which Location Sheets belong to a
Location, and which sheets belong to the Production Lookbook.

## Decision

Generation authoring may remain incomplete. Core validates only the minimum
persistable envelope, immutable purpose and target identity, structurally
readable placement, unique reference identities, normalized project paths, and
the owning Take lifecycle. It does not decide provider readiness, creative
suitability, current guide membership, typed candidate membership, or typed
ownership when saving an exact authored selection.

Draft typed reference slots are optional database-backed UI structure. A Draft
Shot Video Take projects:

- one Character Sheet slot for every Cast Member in the complete Scene;
- one Location Sheet slot for every Location in the complete Scene;
- one Production Lookbook slot;
- the fixed First Frame, Last Frame, and Video Prompt Image supporting-media
  slots, independent of the selected model's current field schema.

Each typed slot has one nullable exact current choice. Its picker lists only
active assets explicitly registered to that exact subject. A sole eligible
candidate is shown unchecked when the slot is empty; it is not selected merely
because it is the only choice. Studio never substitutes another candidate when
the authored choice becomes unavailable.

Purpose guides and focused candidate queries drive Draft presentation only.
They do not validate persisted placement, candidate membership, or
Cast/Location/Lookbook ownership. Draft projection merges exact persisted
choices with current suggestions by placement identity so a guide change
cannot erase authored intent.

Completed Takes project only exact references from the successful immutable
run snapshot. They expose no current candidates, empty suggestion slots,
checkboxes, pickers, or clear actions.

Generic references remain a separate ordered collection. A user- or
agent-supplied image, audio file, or video may be explicitly registered through
the focused Shot-owned `scene_shot_reference_asset` relationship and then added
to a spec. Registration does not place it in a typed slot or create a typed
domain relationship. Only a focused Character Sheet, Location Sheet, or
Lookbook workflow can create an asset eligible for that corresponding picker.
Studio never promotes media by inspecting its pixels, filename, title, prompt,
role text, or provenance.

`providerField` is optional exact authored payload intent. Core preserves it
byte-for-byte when present and leaves it absent otherwise. Core does not bind,
repair, or validate provider fields. Engines remains the sole complete payload
assembly and execution-validation boundary.

Provider values, including duration, follow the same rule. Authored absence is
shown as `Unspecified`; Studio does not write `Auto`, an enum choice, a schema
minimum, or a provider default. Estimation is a separate pricing-only rail and
may succeed whenever pricing facts suffice without resolving references or
assembling an executable payload.

## Examples

- A Scene containing Maria and John shows both Character Sheet slots even when
  the Draft Take currently selects only Maria's Shot.
- Maria's picker lists only Character Sheets explicitly registered to Maria.
  John may remain empty without a readiness warning.
- An uploaded age-21 image of Maria can be a Shot-owned generic reference. It
  appears in Maria's Character Sheet picker only after a focused Character
  Sheet workflow creates and registers the typed asset.
- A saved reference absent from today's purpose guide remains inspectable and
  editable. Core does not raise a guide-placement diagnostic.
- A model change may make an authored provider field invalid for execution. A
  focused Preview update reassigns it only when the new model exposes exactly
  one compatible media field. Ambiguous mappings remain incomplete, and
  Engines reports the real issue during payload preview or run.

## Consequences

- AI Production and Generation Preview edit the same exact spec state and
  shared picker contract.
- Studio users author typed slot choices. Agent-authored Additional References
  are displayed in Preview but are not created or changed through a generic
  Studio media picker.
- Image Revision is a focused exception: Edit fixes the current AssetFile as
  its only source reference, Regenerate preserves the completed source run's
  exact references, and neither mode authors reference selections.
- Empty slots and provider-incomplete drafts are ordinary authoring states.
- Agents and users deliberately author reference choices; Studio supplies
  factual candidates but no creative defaults or fallbacks.
- Browser resources expose safe media identities and URLs, never local paths,
  secrets, or provider upload URLs.
- Engine schema validation remains independent of Core purpose and typed-slot
  projection.
