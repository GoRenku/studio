# Scene-First Screenplay Studio Interaction Matrix

Captured at 1440×900 in the current light theme against the live
`urban-basilica` project.

The Evidence column names binary captures retained in the local Project review
archive outside the Studio repository.

| Interaction | Trigger | Visible state | Focus / accessible name | Persistence effect | Expected resource refresh | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Open Project Information | Select the **Basilica** project card or sidebar row | Project Name, Type, Title, Aspect Ratio, Logline, Summary, Languages, and footer counts | The project control is named **Basilica** in the library and **Basilica Project Details** in Studio | None until a field is edited | Project shell and information resources after edits | `01-current-story-arc.png`, `02-project-information-and-counts.png` |
| Expand Acts | Activate **Expand Acts** | The Offer, The Patron, and The Sound appear below Acts | Disclosure is named **Expand Acts** / **Collapse Acts** and reports expanded state | Browser-local disclosure only | None | `03-acts-expanded.png` |
| Select an Act | Activate **The Offer** | Act detail shows its purpose, Sequences, Scenes, Beats, and storyboard cards | Act row is a distinct button from the Acts disclosure | URL selection changes; no Project data changes | Selection context | `04-act-selected.png` |
| Select a Sequence | Activate **The Sound That Opens Stone 1 scenes** | Sequence detail opens and the selected Sequence expands to reveal Bombardment | Sequence label and disclosure are separate buttons | URL selection changes; no Project data changes | Selection context | `05-sequence-selected.png` |
| Collapse a Sequence | Activate **Collapse The Sound That Opens Stone** | Current selected Sequence remains open; neighboring Sequences demonstrate the collapsed treatment | Disclosure remains named **Collapse The Sound That Opens Stone** while selected | Browser-local disclosure intent only | None | `06-sequence-collapsed.png` |
| Open Bombardment Narrative | Activate **01 - Bombardment Scene** | Scene Heading, Action, Dialogue, Shot, Transition, Title Card, Super, previous/next navigation, sidebar, and footer appear | Narrative tab is selected; Scene row is active | URL selection changes; screenplay does not change | Scene Narrative and selection context | `07-bombardment-narrative-top.png` |
| Hover a Location mention | Point at **Theodosian Walls** in Action text | Link hover styling appears; no image preview is currently rendered | Mention is a button named **Theodosian Walls** | None | None | `08-location-hover-preview.png` |
| Hover a Cast dialogue cue | Point at **Mara** in the dialogue card | Profile-image preview appears to the right of the cue | Cue is a button named **Mara**; preview image alt is **Mara profile image** | None | None | `09-cast-hover-preview.png` |
| Hover a dialogue card | Point inside the Mara card | Border and background hover treatment strengthen; audio affordance can become visible when a saved take exists | Card contains the speaker and audio controls | None | None | `10-dialogue-card-hover.png` |
| Keyboard-focus a dialogue cue | Move keyboard focus to **Mara** | Focus/active treatment is visible without changing dialogue content | Cue remains a named button and is keyboard reachable | None | None | `11-dialogue-card-keyboard-focus.png` |
| Open dialogue audio | Activate the **Mara** cue or **Open dialogue audio takes** | Dialog, Takes, and Advanced tabs appear in a right-side complementary panel | Close control is **Close dialogue audio panel**; editor is **Dialog Text** | Opens workspace only | Dialogue-audio workspace | `12-dialogue-audio-dialog.png` |
| Edit dialogue-generation text | Edit **Dialog Text** | The Mara dialogue card and estimate update live while canonical screenplay text remains unchanged | Textbox remains focused and labelled **Dialog Text** | Autosaves dialogue-audio setup text; the temporary capture suffix was restored immediately after capture | Dialogue-audio workspace and Scene Narrative preview | `13-dialogue-live-preview-edited.png` |
| Review Takes | Select **Takes** | Two generated takes show timestamps, play/delete controls, and playback positions | Tab is named **Takes**; controls include **Play Take 2** and **Delete Take 2** | None unless a take is deleted | Dialogue-audio workspace after deletion | `14-dialogue-audio-takes.png` |
| Review Advanced options | Select **Advanced** | Language Override, Output Format, and Reset values are visible | Tab is named **Advanced**; Language Override is a switch | Changes persist only when an option is changed | Dialogue-audio workspace | `15-dialogue-audio-advanced.png` |
| Play generated audio | Activate **Play Take 2** | Control becomes **Pause Take 2**, slider enables, and elapsed time advances | Play/Pause controls have take-specific names | None | None | `16-dialogue-audio-playback.png` |
| Open Beats | Select **Beats** | Beat card rail and selected Beat detail appear | Tab is named **Beats**; Beat buttons include number and title | URL tab state only | Scene Beat Sheet resource | `17-scene-beats.png` |
| Open Shot Plans | Select **Shot Plans** | Current empty state reads **No Shot Plans for this Scene.** | Tab is named **Shot Plans** | URL tab state only | Scene Shot Plan resources | `18-scene-shot-plans.png` |
| Open Generations | Select **Generations** | Current empty state reads **No generated videos yet.** | Tab is named **Generations** | URL tab state only | Scene generation resources | `19-scene-generations.png` |
| Move to next Scene | Activate the top **Next** control from Bombardment | **02 - The First Patron** loads; both Previous and Next become available and sidebar expansion follows the selected Scene | Top controls are **Previous** / **Next**; bottom controls include Scene titles | URL selection changes; screenplay order does not change | Scene Narrative and selection context | `20-next-scene-navigation.png` |
| Open Story Arc | Navigate to the Acts root / Story Arc selection | Analytical Acts, cadence chart, Scene rail, criteria, and analysis summary render | Scene/Beat analysis controls expose explicit accessible names | URL selection only | Story Arc resource | `21-story-arc.png` |
| Open Cast overview | Activate **Cast 8 members** | Eight Cast cards render with profile art where available | Sidebar control states both label and count | URL selection only | Cast collection | `22-cast-overview.png` |
| Open Locations overview | Activate **Locations 8 locations** | Eight Location cards render with hero art where available | Sidebar control states both label and count | URL selection only | Location collection | `23-locations-overview.png` |
| Open Props overview | Activate **Props 2 props** | Two Prop cards render with hero art where available | Sidebar control states both label and count | URL selection only | Prop collection | `24-props-overview.png` |

## Accessibility evidence limits

The captures and DOM observations confirm accessible names, selected/expanded
state exposure, keyboard reachability for the sampled dialogue cue, and visible
focus/hover states. They do not prove full screen-reader behavior, contrast
ratios, zoom reflow, reduced-motion support, or a complete keyboard traversal.
