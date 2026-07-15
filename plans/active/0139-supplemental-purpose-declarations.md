# Supplemental Purpose Declarations

Status: incorporated by Plan 0142

The product behavior below is retained as the raw exploration that informed
`0142-request-scoped-generation-references-and-take-media.md`. Plan 0142 and ADR
0049 are the accepted implementation direction.

# Product Behavior
- We should have concepts of slots (for all generation purposes) that describes the "type" of references. E.g. Storyboards (and others like character sheets, etc.) should have slots defined in their purpose definition. This defines the known type of references that can be added during generation for continuity purposes mainly but not necessarily. They are pre-defined and baked in the codebase. Of course in each storyboard generation of a scene there can be more than one character so they can be more than one slot for character sheets. The cardinality of that is determined by the number of cast members in that scene. This same thing also applies to location sheets and lookbooks. This needs to be as generic as possible to prevent bloat and unnecessary duplicated code. 
- Each generation purpose can also have adhoc references. I.e. users or agents can always decide that they want to add another adhoc reference. Also this means the above predefined slots are also not required. The agent or user can just decide to override a character sheet and instead generate its own image that describe a character, this is important as it allows experimentation for the user and agent. So nothing should be rigid.
- Then during the planning, the agent gets all the context, gets all the information about these predefined slots and also gets the candidates for each slot. At that point based on the context it can choose one of the character sheets (E.g. palace costume Mehmed II vs. armored Mehmed II in a palace setting). But all other sheets are also still available for each slot.
- The user is presented with a preview generation dialog. User sees the slots in the References tabs with the agent pre-selected choices. For each character in the scene for example, the see the preselected character sheet. They click on the sheet (the card). It opens another dialog that shows all available character sheets for that character. User selects one. Or they select none of the sheets. So no character sheet is selected. Then in Codex etc.  can ask the agent to use their own supplied image (can be generated elsewhere or whatever, it is opaque). Then the agent creates a generic reference by attaching that image. In the prompt though it should refer to that image as depicting that character. This is the main interaction paradigm.

Note: Use the same dialog in References tab in Shot takes when selecting from multiple reference options. Do not invent something new.  

# Purposes and Slots

## lookbook.video-sheet & lookbook.storyboard-sheet
Slots:
None 
Adhoc References: Allowed

## lookbook.image
Slots:
- lookbook.video-sheet
Adhoc References: Allowed

## cast.character-sheet
Slots:
- lookbook.video-sheet
- cast.character-sheet
Adhoc References: Allowed

## cast.profile
Slots:
- cast.character-sheet
Adhoc References: Allowed

## location.sheet
Slots:
- lookbook.video-sheet
- location.sheet
Adhoc References: Allowed

## location.hero
Slots:
- location.sheet
Adhoc References: Allowed

## scene.storyboard-sheet
Slots: 
- cast.character-sheet 
- location.sheet 
- lookbook.storyboard-sheet
Adhoc References: Allowed

## shot.video-take
Slots:
- cast.character-sheet
- location.sheet
- lookbook.video-sheet
Adhoc References: Allowed

# Specific kinds of image.create

## first-frame
Slots
- cast.character-sheet
- location.sheet
- lookbook.video-sheet
Adhoc References: Allowed

## last-frame
Slots
- cast.character-sheet
- location.sheet
- lookbook.video-sheet
Adhoc References: Allowed

## shot-video-prompt
Slots
- cast.character-sheet
- location.sheet
- lookbook.video-sheet
Adhoc References: Allowed

# Notes:
- Cardinality of slots depends on scene data. Eg. 2 character-sheet slots available if 2 members in scene
