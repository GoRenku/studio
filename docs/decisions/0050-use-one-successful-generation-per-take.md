# 0050: Use One Successful Materializing Generation Per Take

Date: 2026-07-15

Status: superseded by Decision 0052

## Context

A Shot Video Take is both an authoring workspace and the durable record of one
finished video request. Supporting First Frame, Last Frame, and Video Prompt
images are inputs to that request. Their existence does not mean that the final
Take request has succeeded.

Freezing a Take as soon as any supporting image is attached prevents ordinary
authoring, including adding another supporting image or correcting a failed
provider request. Allowing a completed Take to be edited or run again creates
the opposite problem: one Take can no longer be inspected as the exact request
and result that produced its video.

## Decision

A Shot Video Take remains a Draft until its first successful materializing
`shot.video-take` generation. Draft authoring may change Shot membership,
structure, direction, model, provider values, prompt, typed-slot choices,
generic references, and supporting First Frame, Last Frame, or Video Prompt
images.

Failed materializing attempts remain associated with the Draft and do not
freeze it. Supporting-image generation runs remain provenance of those assets;
they are not Shot Video Take materializing runs.

The first successful `shot.video-take` generation atomically records the
immutable run snapshot and final output attachment. That success materializes
the Take, freezes every authoring surface, and is the only successful
materializing run permitted for that Take. The database constrains the
successful run identity, while the focused Core finalization command prevents a
second success or replacement final video before writes.

Completed Take reference display comes only from the successful run's immutable
`specSnapshot`. It never recomputes current Scene candidates or purpose-guide
suggestions. Completed Shot membership and direction remain visible as a static
record, while all mutation controls are absent.

Editing or regenerating a Completed Take uses **New Take**. The focused Core
command creates a new Draft Take and new spec identities, copies the authored
values and reusable exact reference selections, and independently copies each
Take-owned First Frame, Last Frame, or Video Prompt image into a new Asset,
AssetFile, durable file, and focused ownership row. Copied spec selections are
rewritten to those new supporting-media identities.

The new Draft receives no final video, generation run, receipt, provider
payload, approval token, diagnostic history, generation provenance, or Take
lineage. Mutating or generating the new Draft cannot change the completed
source Take or its files.

External media does not materialize a Shot Video Take. Studio does not create a
synthetic successful run, receipt, or provenance record for imported video. A
future imported-completed-Take workflow would require a separate product
decision.

## Examples

- A provider failure followed by a prompt correction stays on the same Draft.
- Generating a First Frame does not prevent authoring a Last Frame or final
  video request.
- Once the final video succeeds, changing duration or reference choices first
  creates a new Draft through **New Take**.
- A completed Take with First and Last Frame inputs creates independent copies
  of both inputs for its new Draft; the source final video and run remain only
  on the completed Take.

## Consequences

- Take authoring state is derived from constrained successful materialization;
  no mutable frozen flag is added.
- Run history shown for a Take contains only materializing `shot.video-take`
  attempts for that exact Take.
- Supporting authoring media may be replaced only before materialization.
- Completed Take media and successful snapshots are immutable and inspectable.
- Production export may rely on one current final video per materialized Take,
  while still failing explicitly when a picked Take lacks ready media.
