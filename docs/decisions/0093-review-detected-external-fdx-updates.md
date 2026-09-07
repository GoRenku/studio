# 0093 Review Detected External FDX Updates

Date: 2026-09-06
Status: accepted

An FDX-backed Project has one filesystem-owned external export handoff:
`<project>/screenplay/edit/script.fdx`. The external editor owns its bytes.
Studio may prepare the directory on an explicit folder action, but never seeds,
restores, writes, deletes, or enrolls that file as an Asset. Retained screenplay
sources remain immutable under ADR 0092.

While a Project is open and visible, Studio checks content on entry, focus,
connection recovery, and every three seconds after the preceding check finishes.
Differing bytes need two stable bounded reads 750 ms apart. Missing or incomplete
exports never request deletion. No operating-system watcher or Settings policy
is added.

A detected update requires explicit review and confirmation. Core computes
impact from the existing whole-Scene identity algorithm and relational production
metadata, then binds the source, accepted import, current revision, and impact
to an opaque review fingerprint. Apply rechecks that fingerprint inside the same
immediate SQLite transaction used by explicit imports. Source retention verifies
exact bytes and keeps existing write-set rollback. Duplicate acceptance is a no-op.

Even a punctuation change can replace the entire affected Scene graph. Existing
Beats, Shot Plans, Shots, and dialogue audio remain historical work attached to
old Scene identities; they do not move to replacements. Review reports removed
or replaced identities without inventing edited-Scene pairings. No cascades,
creative artifact validation, matching changes, merge, or undo promise is added.

The independently invoked CLI `screenplay import-fdx` remains immediate and may
replace current Scene identities without a dialog. This decision narrows ADR
0079 only for detected-file Studio updates, preserving its parser, identity,
source authority, and manual import contract.
