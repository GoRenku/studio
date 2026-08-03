# Studio Screenplay Experience

Status: current

Renku Studio presents the screenplay as a read-only, Scene-first production
workspace. Scenes are the canonical units. Optional Act and Sequence Sections
organize them without owning Scene media, Beat Sheets, Shot Plans, dialogue
audio, or other production artifacts.

## Navigation

The sidebar screenplay root is **Scenes** and always reports the total Scene
count. Its tree renders the stored screenplay structure directly:

- Scenes may appear at the root or inside an optional Section;
- Act Sections may contain Scenes directly or contain Sequence Sections;
- Act and Sequence rows share the same selection and disclosure behavior, with
  distinct icons; and
- expanding and collapsing Sections is local browser presentation state.

The current browser routes are:

```text
/projects/:projectName/scenes
/projects/:projectName/sections/:sectionId
/projects/:projectName/scenes/:sceneId
```

The Scenes root opens Story Arc. A Section route opens one shared read-only
Section surface. A Scene route owns Narrative, Beats, Shot Plans, and
Generations. There are no Act- or Sequence-specific routes.

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
