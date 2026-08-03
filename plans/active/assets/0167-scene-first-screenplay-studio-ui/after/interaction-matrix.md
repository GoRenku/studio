# Scene-First Screenplay Studio Verification Matrix

Verified at 1440x900 in the light theme against the migrated live
`urban-basilica` project.

The Evidence column names binary captures retained in the local Project review
archive outside the Studio repository.

| Interaction | Verified result | Accessible / focus contract | Persistence and refresh | Evidence |
| --- | --- | --- | --- | --- |
| Select **Scenes** | Story Arc opens from the scene-first root and retains the analysed Act bands, curve, key beats, Scene rail, criteria, and summary. | Root control is named **Scenes 10 scenes** and exposes selected and expanded state independently. | URL selection only; refreshes the Story Arc resource. | `05-story-arc.png` |
| Expand nested Sections | Act and Sequence Sections reveal their descendant Sections or Scenes without changing the current screen. | Each label button is separate from an **Expand/Collapse {title}** disclosure button. | Browser-local disclosure state only; no Project write or resource refresh. | `01-scene-narrative.png`, `04-section-selected.png` |
| Select a Section | The unified Section screen shows type, description, descendant Scene count, and a quiet Scene card list. | Section row remains selected while its disclosure stays independently keyboard reachable. | Section URL selection only; refreshes selection context. | `04-section-selected.png` |
| Open a Scene | The complete Narrative loads with Scene Heading, Action, Dialogue, Shot, Transition, Title Card, Super, and previous/next navigation. | Scene row is named **01 - Bombardment Scene**; **Narrative** is the selected tab. | Scene URL selection only; refreshes Scene Narrative and selection context. | `01-scene-narrative.png` |
| Hover an exact Location range | The exact authored range gains its inline treatment and opens a hero-image/name preview. | Inline control retains the subject name **Theodosian Walls**. | None. | `02-location-hover-preview.png` |
| Hover an exact Cast range | The exact authored range gains its inline treatment and opens a profile-image/name preview. | Inline control retains the subject name **Urban**. | None. | `03-cast-hover-preview.png` |
| Open Dialogue audio | The Turn-specific complementary panel opens with Dialog, Takes, and Advanced tabs; the original card remains highlighted. | Trigger is named **Open Mara dialogue audio takes**; close control is **Close dialogue audio panel**; editor is **Dialog Text**. | Opening is local UI state; the Dialogue Turn workspace resource is loaded. | `06-dialogue-audio-dialog.png` |
| Review Takes | Existing Turn takes retain take-specific play/delete controls and disabled position sliders before playback. | Tab is named **Takes**; controls include **Play Take 2** and **Delete Take 2**. | No write unless a take is deleted. | `07-dialogue-audio-takes.png` |
| Review Advanced | Language Override, Output Format, and Reset controls retain their existing layout and labels. | Tab is named **Advanced**; **Language Override** is a switch. | Writes only when a value changes; refreshes the Turn workspace. | `08-dialogue-audio-advanced.png` |
| Open Beats | Beat rail, current Beat detail, and Cast/Location context load without Section ancestry. | Tab is named **Beats**; each Beat button exposes its number and title. | URL tab state only; refreshes the Scene Beat Sheet. | `09-scene-beats.png` |
| Open Shot Plans | The current Scene-owned empty state remains intentional. | Tab is named **Shot Plans**. | URL tab state only; refreshes Scene Shot Plans. | `10-scene-shot-plans.png` |
| Open Generations | The current Scene-owned empty state remains intentional. | Tab is named **Generations**. | URL tab state only; refreshes Scene generations. | `11-scene-generations.png` |
| Open Project Details | Direct Project fields include Logline, Synopsis, and Premise; footer counts remain visible. | Sidebar control is **Basilica Project Details** and each field keeps its existing label. | Writes only after a field edit; refreshes Project shell and information. | `12-project-information-and-counts.png` |
| Open Cast, Locations, or Props | Independent Project overview surfaces retain their existing card grids and real media. | Sidebar controls include label and collection count. | URL selection only; refreshes the selected collection. | `13-cast-overview.png`, `14-locations-overview.png`, `15-props-overview.png` |
| Move to the next Scene | Scene `02 - The First Patron` opens and the sidebar follows the canonical structure traversal without ancestry reconstruction. | Top controls expose **Previous** and **Next**; bottom controls include full Scene labels. | URL selection only; refreshes Scene Narrative and selection context. | `16-next-scene-navigation.png` |

## Comparison notes

- Side-by-side checks used the original baseline and the corresponding after
  capture in one image at the same viewport.
- Narrative spacing, typography, dialogue geometry, amber selection, borders,
  radii, footer placement, and Story Arc chart geometry remain visually stable.
- The deliberate differences are the **Scenes** root, standardized recursive
  Section rows, unified Section screen, exact-range Cast/Location/Prop previews,
  and Dialogue Turn IDs.
- The verification did not edit Project fields, delete takes, change advanced
  audio values, or generate media in the real sample project.
