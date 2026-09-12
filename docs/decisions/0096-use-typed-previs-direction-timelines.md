# 0096 Use typed Previs direction timelines

Date: 2026-09-09
Status: accepted

The shared-clock monitor behavior is superseded by [ADR 0098](0098-use-raw-clip-takes-and-independent-monitor-playback.md): independent transports with optional elapsed-time linking and raw clip/take selection.

Previs revisions retain an optional `playback.json` domain document. Core owns
its public `PrevisPlayback` contract and structural validation. Its rational
`frameRate` and positive `frameCount` describe the authored constant-frame-rate
Previs. Positions are zero-based integer frames; ends are exclusive. Player
seconds equal frame × denominator / numerator.

Cues have stable revision-local ids and one of three explicit kinds:

- Dialogue: `speaker`, exact `text`, `startFrame`, optional `endFrame` and exact
  optional audio `{assetId, assetFileId, offsetSeconds?}`. Only a turn with an
  explicit end supports bounded audition.
- Action: `startFrame`, `text`, optional local `subject`. A direction change,
  without duration or audio.
- Camera: `startFrame` and `text`. A camera direction point within a shot,
  without actor identity, duration or audio.

Ordered `segments` contain `{id, startFrame, label}`. The first starts at zero;
every subsequent start is a cut to the incoming uninterrupted camera view.
One segment represents a continuous shot. No duplicate cut/end fields, SQL cue
entities or Shot List Shot rows are created. A dialogue may cross a cut.

Core validates supplied timelines before registration writes and uses the same
validator on read. Missing playback is valid. Invalid retained metadata has a
localized warning; the video/history remain usable. Malformed or unavailable
optional audio affects only the recording. Source bytes and hashing remain exact.
This replaces ADR 0095's registration policy and generic cue envelope.

Studio renders direction points, a segment strip and derived cut boundaries.
Only the playing, explicitly chosen dialogue has amber audition highlighting.
Selection is neutral. Point/cut seeking pauses and exits audition. Dialogue
pause/resume retains its turn; replay after its end restarts it. Main Play exits
audition and plays continuously. Unknown ends are never inferred. Exact recording
audition mutes embedded tracks; visual rehearsal without a recording uses Previs
audio and mutes Generation. A shorter recording becomes silent until the turn end.

Creative choices remain user/agent owned under ADR 0041: runtime never classifies
prose, exports animation controls, verifies speech, detects cuts or interprets AI
performance. Generations remain compared at equal elapsed seconds, without a
promise of speech/action alignment or automatic retiming.

The user authorized a one-off, backed-up correction of three Harbor annotations
and source hashes on their machine. That operation stays outside the repository,
preserves revision/render/AI identities and leaves migration ledgers untouched.
It is not a runtime mutation API or a migration framework.

Implementation: [plan 0202](../../plans/active/0202-previs-direction-cues-and-shot-segments.md).
