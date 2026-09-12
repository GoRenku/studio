# 0098 Use raw clip takes and independent monitor playback

Date: 2026-09-11
Status: accepted

A Previs revision can have numbered raw Clips. Each Clip has numbered alternative
Takes, an optional authored title and an explicit selected Take. Display identity
is `Clip N.M: Title`, or `Clip N.M` without a title. Numbers are stable within their
owning revision/clip. Browsing a candidate does not select it. Existing video
Assets remain unassigned until deliberately registered; titles are not parsed.

Core owns identity, membership, stable number allocation, file-envelope validation,
selection and atomic attachment/registration. Assets remain Project-owned. Discard
clears a selected pointer while retaining the Take identity; restore does not
reselect it. Optional `sourceTakeId` is attribution to an existing Take in this
Project, including a discarded Take or another plan/revision. Core imposes no
preceding-clip rule, frame-input requirement or generation-readiness decision.

Skills choose segmentation, dialogue coverage, continuation inputs and review
criteria. Engines owns provider capabilities, schema validation and execution.
Actual input files and provider requests remain in existing provenance; attribution
does not establish which inputs were submitted or that continuity is correct.

The desktop Generation player reviews selected whole files in order. Boundaries
use measured file durations. A pending or unavailable middle clip stops continuous
playback, while later takes remain individually inspectable. Auditioning an
alternative uses local seconds on the full scene scale and an explicit Back to clips action.
Each transport stays beneath its own player, with tinted clip sections
behind the Generation slider. The compact selector stays in the Generation header;
Link sits at the right of the revision row. No additional assignment-status row. Selection
changes never automatically regenerate a dependent clip.

Previs and Generation have independent transports by default. Linking is transient
view state and addresses equal elapsed seconds, clamped to each player's length.
It never scales speed or equates creative events. The shorter side ends while the
longer continues. Linked audio has one audible owner. Recorded-dialogue audition
pauses Generation and temporarily suspends coupling. This supersedes the shared
clock portion of ADR 0096. The product remains raw review, without editing, trims,
transitions, composite export or automatic synchronization requirements.

Drizzle migration 0088 adds the two tables and advances schema generation to 70.
It preserves existing media, files and authorship and makes no guessed assignments.
