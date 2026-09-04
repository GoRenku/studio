# Sintel Renku Studio Tutorial Recording Runbook

Status: recording guide
Date: 2026-09-03

## Goal

Record a 20–30 minute edited tutorial that begins with the official *Sintel*
screenplay PDF and ends with a small, connected set of Renku Studio production
artifacts. Keep Renku Studio visible while Codex works so viewers see the
Project update as each department completes its part.

This is a product tour, not an attempt to reproduce the finished film. Generate
only enough material to make each workflow understandable.

## Review Attention

- This replaces the previous *Photosynthesis* recording guide and uses the
  openly licensed Blender Foundation short *Sintel*.
- The tutorial now includes a brief PDF-to-FDX conversion step using
  `$screenplay-pdf-to-fdx` before the normal Renku workflow.
- The FDX preserves the screenplay's 14 numbered Scenes. It does not insert
  literal Act headings; Screenplay Analysis derives the three-act reading.
- No Renku product behavior, command, schema, Settings, or error policy changes
  are proposed here.
- Image, audio, and video generation may cost money. Keep every preview and
  approval visible, then shorten generation waits in the edit.

## Source And Attribution

- Official project: <https://studio.blender.org/projects/sintel/>
- Official screenplay asset: <https://studio.blender.org/projects/sintel/gallery/?asset=1185>
- Official script archive: <https://studio.blender.org/download-source/files/4e/4e68d9b58950fff380840a95910e9c4d4265ca81/4e68d9b58950fff380840a95910e9c4d4265ca81.zip>
- Project and licensing background: <https://durian.blender.org/about/>

Use this credit on screen and in the video description:

> *Sintel* screenplay by Esther Wouda, directed by Colin Levy. Durian Open
> Movie Project / Blender Foundation. Licensed under Creative Commons
> Attribution 3.0. FDX prepared as a faithful format conversion for this
> tutorial.

Link viewers to the official Blender pages. If you also provide the converted
FDX, keep the attribution in the file and say clearly that it is a format
conversion rather than an official Blender download.

## Record-Day Setup

- Create a clean Project named **Sintel Tutorial**.
- Keep the official PDF and the converted FDX ready in a neutral local folder.
- Prepare 6–10 licensed inspiration images with their source links.
- Confirm the intended image, voice, dialogue-audio, and video providers.
- Open Codex and Renku Studio side by side; have Beat available for the FDX
  round trip.
- Hide API keys, balances, private paths, notifications, and unrelated Projects.

## Deliberately Small Demo Scope

- Cast: Sintel, the Shaman, and Scales/Pup.
- Locations: the Shaman's Hut, the City of Ishtar, and the Dragon's Lair.
- Prop: the double-bladed Gatekeeper staff and its dragon medallion.
- Voice Samples: Sintel and the Shaman.
- Beat Storyboards: Scene 3, Scene 7, and Scene 13.
- Shot Plan, Dialogue Audio, and video: Scene 2 in the Shaman's Hut.

Scene 2 is the best production demonstration. It is short, contains four clear
Dialogue Turns, uses both speaking characters, and includes the copper dish and
firelit hut as strong visual anchors.

## Recording Script

### 1. Open With The Destination

**On screen:** Briefly show a completed Lookbook image, a Sintel character
image, one Dragon's Lair storyboard, the Scene 2 Shot Plan, a Voice Sample, and
a video candidate. Then return to the empty Project.

**Narration:**

> We are starting with an openly licensed animated screenplay and turning it
> into connected analysis, visual language, continuity, storyboards, a camera
> plan, dialogue audio, and generated video. I will direct the work through
> Codex while Renku Studio keeps the production context visible.

### 2. Convert The Official PDF To FDX

**On screen:** Open the official Blender Studio screenplay asset page, download
the archive, and identify `sintel_final_script_polished.pdf`.

**Say to Codex:**

> Use `$screenplay-pdf-to-fdx` to reconstruct this screenplay PDF as
> `sintel-final-script.fdx`. Preserve the wording and all authored Scene numbers,
> add the official attribution, visually inspect every source page, and validate
> the result. Tell me the Scene and Dialogue counts when it is ready.

**Show:** A quick comparison of one source PDF page and the corresponding FDX
in Beat. In Beat use **File > Import > Import Final Draft...**, not Open.

**Narration:**

> PDF conversion is not ordinary text import. Codex uses the printed layout as
> evidence, reconstructs real screenplay elements, and verifies that the source
> text survives the conversion.

### 3. Import The FDX

**Say to Codex:**

> Import `[sintel-final-script.fdx]` as the current Project's screenplay. Report the
> import result, counts, and any ambiguous Cast, Location, or Prop candidates.

**Show in Studio:** Open several Scenes and point out that the screenplay is
FDX-backed and remains in source order.

**Narration:**

> The external FDX remains the screenplay authority. Renku keeps the imported
> Scenes flat and lets analysis describe the dramatic structure separately.

### 4. Inspiration And Lookbooks

**Say to Codex:**

> Create an Inspiration folder named `Mythic Winter Animation`, import the
> images from `[inspiration folder]`, and analyze their color, lighting,
> composition, texture, atmosphere, and shape language.

**Show:** The Inspiration folder and two or three useful findings.

**Say to Codex:**

> Using the screenplay and that Inspiration Analysis, create a Production
> Lookbook and a Storyboard Lookbook. Keep them related, but make the Production
> Lookbook suitable for final imagery and the Storyboard Lookbook economical
> and readable. Create and select one usable Lookbook Sheet for each.

**Show:** Compare the two Lookbooks and their selected Sheets.

### 5. Establish Continuity

**Say to Codex:**

> Create only these continuity subjects from the imported screenplay: Sintel,
> the Shaman, Scales/Pup, the Shaman's Hut, the City of Ishtar, the Dragon's
> Lair, and the double-bladed Gatekeeper staff with its dragon medallion. Write
> concise designs grounded in the screenplay and Production Lookbook. Treat
> young and adult Scales as one character identity with two story-time
> appearances. Stop and ask if an identity is genuinely ambiguous.

**Show:** One Cast Member, one Location, and the Prop as durable records.

**Say to Codex:**

> Generate one useful image set for each subject. Review the results, select the
> strongest usable image for each, and do not regenerate acceptable work merely
> to create more variants.

**Show:** Sintel's selected image, the Shaman's Hut, the Dragon's Lair, and the
staff/medallion.

### 6. Create Character Voices

**Say to Codex:**

> Design distinct voices for Sintel and the Shaman from their screenplay roles
> and Cast Designs. Generate one short neutral Voice Sample for each, review
> them, and set the best sample as that Cast Member's default voice.

**Show:** Play a few seconds of each Voice Sample.

**Narration:**

> Voice identity belongs to the Cast Member, so later dialogue work can reuse
> the same performance direction.

### 7. Analyze The Screenplay

**Say to Codex:**

> Analyze the current screenplay as a compact three-act animated short.
> Identify the Act boundaries, Sintel's arc, turning points, setup and payoff,
> visual storytelling, pacing, and the strongest revision opportunities.
> Persist the analysis and make it active.

**Show:** The three-act overview, the scar setup/payoff, and one useful note.

### 8. Demonstrate The External FDX Round Trip

**In Beat:** Import a working copy of the FDX. In Scene 2, add one small,
obvious Action detail without changing the dialogue—for example, firelight
catching the dragon emblem on the Gatekeeper staff. Export it as
`sintel-final-script-edit.fdx`.

**Say to Codex:**

> Refresh the current FDX-backed screenplay from
> `[sintel-final-script-edit.fdx]`. Confirm whether it was refreshed or unchanged,
> identify the affected Scene, and tell me which derived work is now stale.

**Show:** The edited Scene and the stale Screenplay Analysis state.

**Say to Codex:**

> Refresh the Screenplay Analysis against the current screenplay and make the
> new analysis active.

**Narration:**

> Reimport is source-authoritative replacement, not a partial merge. Derived
> work is refreshed deliberately after the screenplay changes.

### 9. Create Scene Beats And Storyboards

**Say to Codex:**

> Create Scene Beats for current Scenes 3, 7, and 13. Use the screenplay,
> active analysis, selected continuity, and Storyboard Lookbook. Let each
> Scene's narrative determine its Beat count.

**Show:** Compare the quieter discovery Beats in Scene 3, the abduction in
Scene 7, and the revelation in Scene 13.

**Say to Codex:**

> Generate Beat Storyboard images for the current Beats in those three Scenes.
> Use the selected Storyboard Lookbook Sheet for appearance and the selected
> Cast, Location, and Prop images for continuity. Review and attach useful
> panels to their exact Beats; report any weak panel instead of hiding it.

### 10. Create The Scene 2 Shot Plan

**Say to Codex:**

> Create a Shot Plan named `At the Edge of the World` for current Scene 2 in the
> Shaman's Hut. Cover the complete exchange in four deliberate Shots: establish
> the firelit hut and copper dish, introduce the Shaman's question, move into
> Sintel's guarded answer, and end on her `A dragon` reveal before the slam cut.
> Include duration, framing, movement, focus, lighting, blocking, eyelines, and
> Beat coverage. Keep the planned duration under 30 seconds.

**Show:** The coverage, Shot order, and camera intent.

**Optional prompt:**

> Create one representative image for each Shot using the Production Lookbook
> and selected continuity references.

### 11. Generate Dialogue Audio

**Say to Codex:**

> For `At the Edge of the World`, identify the exact consecutive Dialogue Turn
> range covering the complete Sintel and Shaman exchange. Generate one Dialogue
> Audio Take using their default voices. Let me review it, then select it for
> the Shot Plan if it is usable.

**Show:** Play and select the Take from the Shot Plan's Audio tab.

### 12. Generate Two Video Candidates

Use the product term **Shot Plan video generation**. These are Generations, not
camera Takes.

**Say to Codex:**

> Prepare a reference-mode Shot Plan video generation for `At the Edge of the
> World`. Use the Production Lookbook, selected Sintel and Shaman images, the
> Shaman's Hut, relevant Shot images, and selected Dialogue Audio. Show me the
> exact references, settings, prompt, and estimated cost before running it.

Approve only after the visible inputs and cost are correct.

**After the first result, say:**

> Review that video against the Shot Plan. Keep it if useful, then prepare one
> genuinely different candidate in first-frame mode using the strongest Shot
> image. Show me the preview and cost before running it.

**Show:** Compare staging consistency, facial performance, timing, and motion.

### 13. Close On The Connected Project

**On screen:** Revisit the screenplay, analysis, Inspiration, Lookbooks,
Sintel's Cast page, the Shaman's voice, Dragon's Lair storyboards, Scene 2 Shot
Plan, Dialogue Audio, and video Generations.

**Narration:**

> The result is not just a generated clip. It is connected production context:
> screenplay, analysis, visual language, continuity, Beats, camera planning,
> dialogue, and video—all retaining the decisions approved along the way.

End on the official Blender project link and attribution.

## Editing Notes

- Shorten generation waits, but keep previews, cost approval, review, and
  Studio refreshes visible.
- Keep the Codex/Studio layout consistent throughout.
- Zoom only when reading a particular analysis point, Beat, Shot, or asset.
- If a generation fails, briefly show the structured error and correction.
- Do not imply that Renku automatically judges artistic correctness. The user
  and Codex review creative results.
