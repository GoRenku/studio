# 0109 Lean Cast Character Sheet Skill Guidance

Status: proposed
Date: 2026-07-04

## Summary

Change the Renku Studio skill instructions for `cast.character-sheet` so agents
create lean, production-useful character sheets instead of broad character
design boards.

The new target pattern is a neutral identity reference sheet:

- face close-up;
- full-body front view;
- full-body back view;
- left profile;
- right profile;
- visible height scale or height marker;
- compact identity metadata with height treated as a binding detail;
- optional accessory cells only for character-owned continuity items.

The sheet should provide just enough information to preserve character
consistency across shot generation. It should not include random location
shots, scene panels, story beats, expression collages, mood-board fragments,
technical props, or decorative production-board sections that do not help
downstream identity continuity.

This is exclusively a skill-documentation and example update in the
`studio-skills` sister project. It must not introduce Studio app, Core, CLI, or
Engines types, schemas, validators, UI controls, runtime contracts, or media
artifact content checks.

## References Reviewed

- User-provided blank and filled lean character-sheet screenshots.
- `plans/active/0026-cast-profile-and-character-sheet-media-generation.md`
- `plans/active/0101-location-reference-sheet-skill-progressive-disclosure.md`
- `plans/active/0103-opaque-ai-artifacts-and-prompts.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/casting-director/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/casting-director/references/cast-media-handoff.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/casting-director/references/cast-design.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/cast-character-sheet.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/character-images.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/cast-profile.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/samples/cast-character-sheet-spec.json`
- `packages/core/src/server/media-generation/purposes/cast-character-sheet.ts`
- `packages/core/src/client/cast-members.ts`
- `packages/core/src/client/department-design.ts`

## Current Problem

The current character-sheet guidance still pushes agents toward broad design
boards:

- It tells agents to synthesize story function, period and setting signals,
  expression range, posture range, hands, materials, and Movie Lookbook camera
  language.
- The sample spec asks for "a full character sheet" with face, wardrobe,
  materials, expression range, posture, and period detail.
- `character-images.md` repeats the older idea that a good sheet connects story,
  dramatic function, period, setting, and visual-language cues.
- `media-producer/SKILL.md` has detailed routing for many media purposes but no
  small cast-image routing section that forces agents through the
  purpose-specific character-sheet reference.

That broad guidance is useful for early costume or concept exploration, but it
is too noisy for the current downstream job. Shot generation needs a clear
identity reference, especially:

- face and hair consistency;
- body proportions and silhouette;
- exact or intended height;
- front, back, and side views in the same wardrobe state;
- accessories that must remain consistent when they appear in shots.

The expected failure mode is:

1. An agent asks for a rich cinematic character design sheet.
2. The image model invents story/location panels, mood shots, period props, or
   expression studies.
3. The result looks impressive, but downstream shot generation has less useful
   identity information than a plain model-sheet layout would provide.
4. Height, profile, back view, and accessories are either missing or ambiguous.

The screenshots show a better production target: a clean neutral board that
uses space for only the information needed to preserve the character.

## Required Direction

`cast.character-sheet` skill guidance should define the default character sheet
as an identity turnaround, not a broad concept board.

The default layout should be:

```text
Face close-up | Front | Back | Left profile | Right profile
```

The left column may include a compact metadata block and optional accessory
cells. The full-body columns should include visible height reference marks or a
height ruler. The character should be presented in a neutral pose, consistent
wardrobe, and neutral studio-like background.

Height is a first-class prompt requirement for visible on-screen cast members:

- If an exact height is available, include it in both the prompt and the visual
  height marker, preferably in imperial and metric form.
- If an intended height is known only as text, such as "shorter than Mehmed" or
  "towering and broad", convert that into a prompt instruction without
  inventing a precise number.
- If height is missing and the user is asking for a final reusable sheet, the
  agent should ask for height before generating unless the user explicitly says
  to proceed without it.
- If the user wants to proceed without a known height, the prompt should avoid
  fake precision and use a neutral proportional scale instead.

Accessories are optional and scoped:

- Include accessory cells only when the user, Cast Design, or cast role makes
  the accessory a character-owned continuity item.
- Examples include eyeglasses, hair clip, ring, necklace, cane, signature bag,
  or other worn/carried identity objects.
- Do not invent optional accessories just to fill the sheet.
- Do not include scene props, location props, plot devices, technical props, or
  weapons merely because they appear elsewhere in the screenplay.
- If a prop belongs to a scene, Location, shot, or another character, keep it
  out of the character sheet unless the user explicitly asks for that variant.

The sheet may still reflect the selected Movie Lookbook through rendering
quality, palette discipline, lighting softness, texture, and photographic
caliber. It should not translate the Lookbook into extra panels, locations,
cinematic frames, or camera-language studies inside the character sheet.

## Non-Goals

- Do not change the `cast.character-sheet` purpose key.
- Do not create a separate accessory media purpose.
- Do not change `packages/core`, `packages/cli`, `packages/studio`, or
  `packages/engines` implementation code.
- Do not add Studio app UI for sheet layout, height, accessories, or metadata.
- Do not add Core client/server types, schemas, generation metadata fields,
  validators, structured diagnostics, import contracts, or command contracts
  for this sheet pattern.
- Do not add a required character-sheet layout enum to Core.
- Do not add runtime validation that generated images contain five views,
  labels, height marks, accessories, or readable metadata.
- Do not add image parsing, visual scoring, OCR checks, panel detection, or
  generated-artifact content validation to Studio runtime code.
- Do not add a `height` field to `CastMember` in this slice.
- Do not add compatibility aliases, fallback formats, or obsolete prompt
  recognition.
- Do not change `cast.profile`; profile images remain square cast-facing
  portraits or symbolic voice-over profile images.
- Do not run paid provider generation as part of this docs change.

## Architecture Boundary

This plan follows the accepted opaque-artifact direction from `0103`:

- Core owns the generation envelope: purpose, target, model choice, parameters,
  cost, receipt, asset attachment, and durable relationships.
- Core should not validate or parse the creative contents of character-sheet
  images.
- Agents and skill instructions own prompt strategy, layout guidance, and
  advisory QA.
- `casting-director` owns Cast Design and character continuity guidance.
- `media-producer` owns character-sheet prompt writing, generation specs,
  inspection, regeneration advice, and import.

The current Core `cast.character-sheet` provider payload passes through
`spec.prompt`; it does not hard-code the old broad sheet structure. This plan
must leave that runtime contract alone. The implementation should happen only
in skill docs and skill examples.

## Proposed Skill File Responsibilities

### `media-producer/SKILL.md`

Add a compact cast-image routing section that points agents to the
purpose-specific files before writing prompts:

```text
For cast.character-sheet, read references/cast-character-sheet.md before
drafting the prompt. Character sheets default to a lean identity turnaround:
face close-up, front, back, left profile, right profile, height scale, and
optional character-owned accessories.
```

Keep this section short. Do not paste the full sheet layout recipe into
`SKILL.md`.

### `media-producer/references/cast-character-sheet.md`

Rewrite this as the operational reference for the new default.

It should keep:

- purpose key and target format;
- context and model-list commands;
- Codex built-in image generation path;
- Renku-managed spec shape;
- model notes;
- likeness guidance;
- import command;
- reference metadata rules.

It should replace the broad prompt guidance with:

- the lean identity-turnaround default;
- required views;
- height handling;
- accessory handling;
- neutral pose and neutral background guidance;
- wardrobe-state guidance;
- what to exclude;
- inspection and advisory QA.

Suggested new prompt recipe:

1. Start with the exact character identity and target wardrobe state.
2. State the required layout in order: face close-up, full-body front, full-body
   back, left profile, right profile.
3. State exact height or known height relationship.
4. Ask for the height scale to align with the full-body views.
5. Add only the stable identity anchors: face, hair, build, skin details,
   silhouette, posture, wardrobe, shoes, and grooming.
6. Add optional accessory cells only when supplied by user or Cast Design.
7. Add concise rendering quality from the active Movie Lookbook.
8. Explicitly exclude location panels, story scenes, expression ranges, random
   props, weapons, scene objects, text-heavy design notes, UI mockups, and
   decorative collage elements.

Suggested default prompt skeleton:

```text
Create a clean neutral production character sheet for {name}. Use one finished
image with five vertical sections: FACE CLOSE UP, FRONT, BACK, LEFT PROFILE,
RIGHT PROFILE. Show the same person in the same wardrobe state in every view.
Use a neutral studio background and simple sheet dividers.

Height is binding: {height}. Include a visible height scale beside the full-body
views and align the body proportions to that height. Use neutral standing poses,
arms relaxed, feet visible, no dramatic acting.

Identity anchors: {face, hair, build, silhouette, grooming, posture}.
Wardrobe anchors: {wardrobe, shoes, materials}.
Optional accessories: {only explicit character-owned accessories, or omit this
section if none are supplied}.

Keep this as an identity reference for video continuity, not a concept-art
collage. No location shots, no scene panels, no expression range, no extra
characters, no invented props, no story moments, no technical diagrams, no
large paragraphs of generated text.
```

The reference should explain that generated labels are helpful but not durable
metadata. Agents should not reject a useful sheet solely because generated text
is imperfect, but they should reject or revise when the missing or garbled text
makes the height, view order, or accessories unclear.

### `media-producer/references/character-images.md`

Update the shared cast-image notes so they no longer describe
`cast.character-sheet` as a broad design reference that connects story,
dramatic function, period, setting, and camera language.

The new shared guidance should say:

- character sheets default to lean identity turnarounds;
- profile images should derive from the selected character sheet when possible;
- the selected character sheet is the physical continuity anchor for shot video;
- broad concept exploration belongs in Cast Design discussion or user/agent
  ideation, not the default `cast.character-sheet` media purpose.

If this file becomes redundant after the purpose-specific references are
updated, either trim it to a short shared note or remove it from future routing.
Do not keep contradictory guidance.

### `media-producer/samples/cast-character-sheet-spec.json`

Replace the current sample prompt with a lean example.

The sample should demonstrate:

- exact layout;
- height as binding;
- same wardrobe across views;
- neutral background;
- optional accessories only if named;
- explicit exclusions for location/story/prop clutter.

Example direction for the sample:

```json
{
  "prompt": "Create a clean neutral production character sheet for Ada with five vertical sections: FACE CLOSE UP, FRONT, BACK, LEFT PROFILE, RIGHT PROFILE. Show the same person in the same simple travel dress and boots in every view. Height is binding: 5 ft 6 in / 168 cm; include a visible height scale beside the full-body views and align body proportions to that height. Keep arms relaxed, feet visible, and poses neutral. Identity anchors: auburn bob-length hair, pale freckled skin, narrow face, watchful expression, slight forward tension in posture. Optional accessories: one small brass hair clip shown in a separate accessory cell. No location shots, no story scenes, no expression range, no extra props, no weapons, no other characters, no long generated notes."
}
```

The exact sample character can remain Ada, but the prompt should read like a
usable production reference, not a generic concept-art prompt.

### `casting-director/references/cast-media-handoff.md`

Add a short handoff requirement before asking `media-producer` for
`cast.character-sheet`:

- summarize the cast member's known or intended height;
- summarize the target wardrobe state;
- summarize character-owned accessories that must remain consistent;
- mark height as missing and ask the user before generation when the sheet is
  meant to be the reusable final continuity reference.

This keeps `casting-director` responsible for character continuity while
leaving prompt generation and media import with `media-producer`.

### `casting-director/references/cast-design.md`

Do not change the Cast Design JSON contract in this slice.

Add guidance near the appearance, costume, continuity, and generation guidance
descriptions explaining where height and accessories should be captured with
the current contract:

- height can be written in `appearance.build`, `appearance.silhouette`,
  `continuity.mustRemainConsistent`, or `generationGuidance.characterSheetPositive`
  when the user supplies it;
- accessory continuity belongs in `costume.baseWardrobeLogic`,
  `costume.variants[].wardrobe`, `continuity.mustRemainConsistent`, or
  `generationGuidance.characterSheetPositive`;
- do not invent height, weight, gender, or accessories just because the visual
  template has fields for them.

If structured height later becomes a product requirement, it must be proposed in
a separate plan. This plan must not do that work.

## Inspection And QA Direction

The skill should instruct agents to inspect generated sheets before import.

Acceptable sheet:

- contains face close-up plus front, back, left profile, and right profile;
- uses one coherent person across all views;
- preserves the requested likeness and identity anchors;
- shows full body, feet, shoes, hair, silhouette, and wardrobe state clearly;
- includes an interpretable height scale or height marker when height is known;
- includes only requested character-owned accessories, or no accessory panel
  when none were supplied;
- stays on a neutral background without scene/location panels.

Weak sheet examples and expected impact:

- Missing back view: downstream video may invent rear hair, clothing closure,
  cape, bag, or silhouette details.
- Missing side profiles: downstream video may drift on nose, chin, hair volume,
  posture, and body depth.
- No height marker: multi-character shots may produce inconsistent scale.
- Different outfit across panels: shots may mix wardrobe states.
- Random location/story panels: useful sheet area is wasted and the model may
  treat scene context as character identity.
- Invented accessories: downstream shots may preserve objects the character
  should not own.
- Text-heavy collage: the image becomes less useful as a visual reference and
  text artifacts may contaminate shot prompts.

QA recommendation language should stay advisory:

- "Import" when the sheet is strong.
- "Import with caveat" when minor label text is imperfect but visual identity
  and height are clear.
- "Revise prompt or regenerate" when required views, height, likeness, wardrobe,
  or accessory scope are wrong.

Do not import weak media automatically.

## Prompt-Scope Rules

Keep these rules explicit in the updated skill docs:

- The character sheet is not a Location Sheet.
- The character sheet is not a Movie Lookbook.
- The character sheet is not a storyboard.
- The character sheet is not a costume-variant catalog unless the user asks for
  that specific wardrobe-state variant.
- The character sheet is not a prop sheet.
- The character sheet is not a performance-expression sheet.
- The character sheet is a physical continuity anchor for a visible cast
  member.

When multiple wardrobe or state variants are needed, generate separate
character sheets with distinct reference names and purposes, such as:

- `mara-main-travel`
- `mara-palace-formal`
- `mehmed-ii-armored-siege`
- `urban-workshop-main`

Do not combine unrelated variants into the same default sheet.

## Relationship To Existing Plans

This plan narrows the guidance created by `0026`.

`0026` correctly said that character sheet style belongs in skills and
agent-authored prompts, not a Core enum. This plan uses that ownership decision
to change the default style without changing the `cast.character-sheet`
contract.

This plan follows `0103` by keeping sheet structure inside agent guidance and
advisory QA. The runtime should not inspect generated image contents.

This plan mirrors the progressive-disclosure approach of `0101`: keep
`media-producer/SKILL.md` small, put detailed purpose guidance in
`references/cast-character-sheet.md`, and update samples so agents see the new
pattern immediately.

## Validation Plan

Skill-doc validation:

- Search `studio-skills` for old broad character-sheet wording such as
  "expression range", "period and setting signals", "camera language", and
  "full character sheet" after edits.
- Confirm any remaining use is intentionally scoped outside the default
  `cast.character-sheet` purpose.
- Confirm `cast-profile.md` still describes square profile images, not full
  multi-view sheets.
- Confirm `voice-over-profile-image.md` still blocks physical character sheets
  for voice-only cast members.

Example validation:

- Confirm `samples/cast-character-sheet-spec.json` remains valid JSON.
- Confirm the sample still uses purpose `cast.character-sheet`, a cast target,
  one supported model choice, and existing spec fields only.

Do not run paid generation for validation.

## Completion Checklist

### Review Area

- [ ] Re-open the user screenshots and restate the target sheet pattern in
      implementation notes.
- [ ] Review the current dirty work in `studio-skills` before editing, especially
      the location-sheet docs already changed in that repo.
- [ ] Confirm no existing user changes are overwritten.

### Architecture And Contracts

- [ ] Keep `cast.character-sheet` as the public purpose key.
- [ ] Keep `cast.profile` unchanged.
- [ ] Do not edit `packages/core`, `packages/cli`, `packages/studio`, or
      `packages/engines`.
- [ ] Do not add Studio UI, Core types, schemas, validators, diagnostics, or
      media generation metadata for sheet layout, height, or accessories.
- [ ] Do not add runtime image-content validation, OCR, panel parsing, or
      artifact scoring.
- [ ] Do not add a required sheet-layout enum or new prompt metadata field.
- [ ] Do not add a `CastMember.height` data-model field in this slice.

### Media Producer Skill Updates

- [ ] Add a short cast-image routing section to
      `skills/media-producer/SKILL.md`.
- [ ] Rewrite `skills/media-producer/references/cast-character-sheet.md` around
      the lean identity-turnaround default.
- [ ] Add clear height handling to `cast-character-sheet.md`.
- [ ] Add optional accessory handling to `cast-character-sheet.md`.
- [ ] Add explicit exclusions for locations, scenes, expression ranges,
      invented props, text-heavy notes, and broad concept-board content.
- [ ] Add an advisory inspection and QA rubric to `cast-character-sheet.md`.
- [ ] Update or trim `skills/media-producer/references/character-images.md` so
      it no longer conflicts with the new default.
- [ ] Confirm `skills/media-producer/references/cast-profile.md` remains focused
      on profile images and source-sheet continuity.

### Casting Director Skill Updates

- [ ] Update `skills/casting-director/references/cast-media-handoff.md` so
      handoffs summarize height, wardrobe state, and accessory continuity.
- [ ] Update `skills/casting-director/references/cast-design.md` with guidance
      for recording height and accessories using the current Cast Design
      contract.
- [ ] Ensure the guidance tells agents not to invent height, weight, gender, or
      accessories just because the template has fields.

### Samples

- [ ] Replace `skills/media-producer/samples/cast-character-sheet-spec.json`
      with a lean sheet prompt.
- [ ] Keep the sample JSON valid and limited to current spec fields.
- [ ] Include a known height in the sample prompt.
- [ ] Include one optional accessory only as an explicit continuity item.
- [ ] Include explicit exclusions for location/story clutter.

### Validation And Final Verification

- [ ] Run `rg` over `studio-skills` for broad old wording and resolve
      contradictions.
- [ ] Validate the sample JSON with a JSON parser.
- [ ] Do not run paid provider generation.
- [ ] Report changed files, validation performed, and any remaining open
      product question about structured height metadata as out of scope for
      this skills-only slice.
