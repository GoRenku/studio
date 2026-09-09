# Codex fullscreen interruption — September 9, 2026

## Observation

During prototype QA, the agent invoked the video player's fullscreen button inside
Codex's in-app browser. The user reports that the entire Codex application became
fullscreen and unresponsive and required force quit. The agent had applied a
1440 × 1024 viewport override for screenshot comparison. The fullscreen screenshot
then showed incorrectly sized content in a large black surface; subsequent browser
inspection timed out and the in-app browser disappeared from the tool inventory.

## Evidence inspected

- Local Codex desktop log:
  `/Users/keremk/Library/Logs/com.openai.codex/2026/09/09/codex-desktop-315dc74e-dd30-4398-a63c-1a32f761050f-63036-t0-i1-090428-0.log`.
- At 15:08:57 UTC the embedded-browser API reported `Cannot find context with
  specified id` during a read-only evaluation. This predates the last fullscreen
  checks and establishes browser-context instability, not its cause.
- The last log entries are at 15:10:34 UTC, with no recorded exception explaining
  the freeze or normal shutdown. The restarted app log begins at 15:17:50 UTC.
- No corresponding new Codex crash report was present in the user's
  `Library/Logs/DiagnosticReports` directory.
- The shared player's fullscreen function remains the existing native
  `requestFullscreen` / `exitFullscreen` implementation. The prototype added
  external transport support, not a new fullscreen/window-management mechanism.
- Playback synchronization uses event callbacks with a playing-state guard;
  follower timing updates do not write back to the leader. Inspection did not
  identify an obvious recursive playback loop. This is not proof against all
  runtime problems.

## Conclusion and next step

The triggering interaction is known: fullscreen was requested inside Codex's
embedded browser. The evidence does not isolate the underlying hang to viewport
emulation, Electron fullscreen handling, browser automation, or prototype code.
Do not claim the freeze has been fixed or that the disconnected browser was the
only affected component.

Stop fullscreen automation inside Codex. Continue normal windowed Chrome review.
The prototype server was restarted after force quit, and normal card navigation,
linked keyboard scrubbing, and Description scrolling were verified again. Leave
fullscreen as an explicit verification gap rather than repeatedly risking the
user's desktop session. No Codex settings, installation files, or user data were
changed during the investigation.
