# Studio Screenplay Experience

Status: current

Renku Studio presents the screenplay as a read-only, Scene-first production
workspace. Scenes are the canonical units. Optional Act and Sequence Sections
organize them without owning Scene media, Scene Beats revisions, Shot Plans, dialogue
audio, or other production artifacts.

## Navigation

The sidebar screenplay root is **Screenplay** and always reports the total Scene
count. Its tree renders the stored screenplay structure directly:

- Scenes may appear at the root or inside an optional Section;
- Act Sections may contain Scenes directly or contain Sequence Sections;
- Act and Sequence rows share the same selection and disclosure behavior, with
  distinct icons; and
- expanding and collapsing Sections is local browser presentation state.

FDX-backed Screenplays always render as a flat Scene tree. Final Draft planning
paragraphs and outline lanes remain only in the retained source; Studio never
shows them as Act or Sequence rows.

The current browser routes are:

```text
/projects/:projectName/screenplay
/projects/:projectName/scenes
/projects/:projectName/scenes/:sceneId
```

The separate top-level **Analysis** section contains **Screenplay Analysis**.
It reuses the existing Story Arc display and is designed to accept future
analysis document types without adding empty placeholders now. The Screenplay
route opens the generated beat image gallery grouped by Scene. Act and Sequence
rows only organize and disclose Scenes in the sidebar; they are not selectable
surfaces and do not have browser routes. A Scene route owns Narrative, Beats,
Shot Plans, and Generations.

An active analysis remains visible after screenplay changes. Studio shows a
keyboard-focusable **Needs refresh** badge with the tooltip “Screenplay changed
since this analysis.” Historical analysis prose remains readable when a
referenced Scene no longer exists; navigation to a missing current Scene is
unavailable rather than crashing the display.

## Narrative

Narrative renders semantic screenplay elements with the existing Studio visual
language: Scene Headings, Action, Transition, Shot, Lyrics, Cast List, visible
Note, Special Heading, Title Card, Super, Dialogue, and Dual Dialogue. Dual
Dialogue keeps its authored side-by-side layout. Every canonical Dialogue Turn
shows a small current-order number in the top-right corner of its block. The
number is a user/agent aid only and is recomputed from current screenplay order.

Opening elements appear immediately before the first canonical Scene. They do
not gain a Scene number, Scene tabs, production actions, or Scene ownership.

Cast Member, Location, and Prop interactions come only from validated reference
ranges. Studio preserves the authored text around each exact range, including
punctuation, whitespace, repeated names, and Unicode. Presence-only references
do not fabricate inline highlights.

Dialogue text in the screenplay remains immutable. Narrative has no Dialog,
Takes, or Advanced audio panel and no generation controls. Dialogue Audio is
generated only through the conversational Media Producer workflow.

## Shot Plan Detail

Shot Plan detail exposes **Shots**, **Assets**, and **Audio** tabs. Audio shows
one full-width Media Card per independent Dialogue Audio Take. A card shows its
single Turn or consecutive Turn range, selected Cast Profile portraits (with an
empty portrait state when no Profile is selected), one waveform/player, generic
generation provenance, date, the shared selection control, and a hover/focus
Trash action. It deliberately omits dialogue text, speaker names, aggregate
labels, duplicate duration, links, a right action column, headings, and any New
Take button.

Audio selection is multi-select. Each selected single- or multi-Turn Take is
projected as one exact reference for a later video request. Studio does not
combine Takes, infer groups, validate stale Turn numbers after screenplay
changes, or generate audio itself.

## Deliberate Absences

Studio does not provide screenplay prose editing, formatting controls,
ScriptNote UI, Section organization controls, or FDX upload. Creative prompt,
Shot-description, and other AI-authored text remains opaque and is displayed
without semantic handle parsing or content repair.

## External Screenplay Updates

FDX-backed Projects show **External screenplay** on the Screenplay root. The
dialog provides the exact copyable export path, the platform folder action,
and **Check for changes**. Export repeatedly to `screenplay/edit/script.fdx`.
Missing exports show instructions without changing the screenplay.

One Project-level controller checks on entry, focus, browser connection recovery,
and every three seconds while visible. A stable changed export opens **Update
screenplay?** in the focused browser when no other dialog is open. **Later**
keeps current state and remembers that candidate for this browser session;
**Screenplay update available** reopens it. Another export can prompt again.

Review shows retained, new, and removed-or-replaced Scenes, order changes, and
production history counts. Even a small dialogue edit may sever current Scene
connections. History is retained without automatic reattachment. Long lists
scroll while the warning and actions remain visible. Focus starts on **Later**;
there is no automatic or default-submit acceptance.

Changes to the file, accepted baseline, or material impact disable confirmation.
**Review latest export** explicitly loads a new review. An uncertain response
causes a status recheck, never an automatic mutation retry. Successful application
refreshes resources across tabs and returns a removed selected Scene to Screenplay.
Narrative remains read-only and the external editor remains the author.
