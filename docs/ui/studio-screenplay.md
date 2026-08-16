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
Dialogue keeps each turn's audio action independent.

Opening elements appear immediately before the first canonical Scene. They do
not gain a Scene number, Scene tabs, production actions, or Scene ownership.

Cast Member, Location, and Prop interactions come only from validated reference
ranges. Studio preserves the authored text around each exact range, including
punctuation, whitespace, repeated names, and Unicode. Presence-only references
do not fabricate inline highlights.

Dialogue text in the screenplay remains immutable. The dialogue audio panel has
its own editable generation text and continues to own preview, autosave,
estimate, generation, Takes, playback, and Advanced settings by Dialogue Turn
ID.

## Deliberate Absences

Studio does not provide screenplay prose editing, formatting controls,
ScriptNote UI, Section organization controls, or FDX upload. Creative prompt,
Shot-description, and other AI-authored text remains opaque and is displayed
without semantic handle parsing or content repair.
