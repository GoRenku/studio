# UI Changes
- Rename the Shots tab to Shot Plans, and add a new tab called Generations (Generations tab will defined in a later iteration)
- Shot Plans will be represented by a card. (Remove the New Shot card from the existing Shots tab)
  - Shot Plans cards are the same reusable cards. Do not invent a new card for this. 
  - Each card has a delete button (top right) and an inspect button (bottom right). They follow the same delete (with confirmation dialog) pattern
  - If images for the shots are generated for the shot plan card, they should be used in a grid format of max 3x3.
  - The title of the Shot Plan should be overlaid at the bottom (again same as in other cards). Below that it should say which Beats it covers in smaller font than the Title (again same as in other card for styling)
- Clicking on the inspect button, launches a shot plan dialog (same header/footer style as the inspect for generations)

## Shot Plan Dialog
- The wireframe describes the general layout.
- The dialog is read-only and has a close button. The user is expected to work with the AI agent for edits.

### Shot Plan Header
- The header shows the ShotPlan Title
- Under it shows the beats (Beat 1, ...) that it covers. Hovering over the beat shows a square image of the beat image, so the users can get context.

### Shot list vertical bar
- Shows the images (or icons) for each shot in the shot plan
- Shot list vertical bar will display the shot images (if available) with shot # on the left top corner (as a badge in a circle). If the shot image is not available, it should show one stock image (iconography) in the image area
- The shotlist vertical bar area is resizable with resize handles (exactly the same as the Sidebar in the app)
- Currently active shot in the vertical has a background color to distinguish that it is selected(green with the same UI design colors) color.
- Under each shot image aligned to right, the timing of the shot is shown with its start second and the end second 

### Shot Plan Details Area
- We show the title of the shot at top (use proper font and weight choice as well as spacing using design skills)
- On top, it shows the top 5 Brief Items as easily glanceable square bars. Framing, Camera, Motion, Optics, Lighting
  - BTW Motion was not in the original list in the JSON. We have duration but since we already have it shown in the shot list, no need to show it here. So we bring in Motion (requires JSON schema change, no data migration needed, as no shot plans ever generated yet)
  - In the wireframe, I am presenting some ideas on what we can show, but it is a wireframe. For each I want a tasteful, useful UI design that is consistent and also informative. For Motion we created some videos for early iteration here; /Users/keremk/Projects/aitinkerbox/studio/packages/studio/src/features/movie-studio/shot-authoring/shot-design-assets/generated/motion 
  - When we use illustrations for camera, framing and motion(video) there will be some cases where we have not built an illustration so the UI needs to take that into account. Also the JSON schema for the briefs should specify the known names for these so Agent AI can provide it consistently but it should allow other camera types, motion types etc. so we don't lose out on the expressiveness just because we don't have an illustration for it. 
  - The plan should look at the current /Users/keremk/Projects/aitinkerbox/studio/packages/studio/src/features/movie-studio/shot-authoring/shot-design-assets list of assets, suggest how we can incorporate that in here. It should use design skills to create tasteful Brief cards to display.
  - The brief items are not editable in this first iteration
- The description box is the same code editor (markdown) we used for the prompt editing in the preview generation dialog. It should use proper color coding. The description should be in markdown format. Description can not be edited by the user in this first iteation.
  - The user is supposed to work with the AI agent to request changes to the shot (currently selected or by shot number). The agent changes the description and also modifies the brief when necessary. These will be all in the skills for editing shots


# Renku CLI & Skills
- We need to add a shot planning skill
- We need to have CLI commands to create a shot plan, add shots to it and edit the shot information. 

## Expected User - AI Agent workflow
- The user will ask the AI agent to create a new shot plan using the new shot planning skill (routed from MovieDirector skill)
- In creating a shot plan, user may choose to have one or more shots in the plan. They will express their intent on which scene and which beats they are targeting in the shot plan. This creates an important context for the AI agent 
- User is expected to work shot by shot defining each shot in the plan. 
- For each shot the user can optionally request to create an image that represents the shot using the new shot image purpose. This is similar to generating other images and should follow the same workflow of creating the generation spec, displaying that to the user with a generation preview dialog. These images will inherit the aspect ratio of the project. The preferred default is the Codex GPT-Image-2 model within Codex imageneration but the user may decide to use other available image models and use Renku generation as well.
- The description and the brief for the shot will be focused on describing the shot and not specific to the AI Generation nor AI Generation models. These descriptions, briefs etc. will later be used as context for the actual video generation with a specific model but we are not designing this yet in this iteration.
- The description should be rich (See Appendix for some context on earlier conversations and how film makers approach. Do your additional research if needed)
- There should be a Brief JSON file generated for the UI
- There should a shot title generated as well
- User will ask the agent to add more shots. User can also ask the agent an initial proposed plan with shot proposals and then go shot by shot to fine tune shots by chatting with the agent. This is all iterative. There is no "final done" state. (User will be able to also iterate on generating videos based on the plan but will be described later)
- The agent should have all the context about the shotplan automatically (using Renku CLI) about the overall project, narrative of the scene, the beats and their narratives, the cast involved in the scene, the location etc. The agent can progressively choose to discover more about the project (prior, later scenes etc). Agent should have all the tools available to progressively learn about the project as it is needed by its reasoning and thought process. This does not mean that there is one GOD CLI command that returns everything at once, it is all progressive discovery. (Much like discovering the codebase while reading relevant parts of the code)
- The agent skill should have (progressively disclosed) information on relevant film making concepts and terminology.

# Appendix
## Some prior conversations on what should be in a shot
Yes—your instinct is largely correct. **An elaborate cinematography JSON schema would probably be the wrong architecture for Renku.**

The mistake would be trying to convert filmmaking language into a large set of mandatory fields such as:

```text
shotSize
cameraAngle
cameraHeight
subjectPosition
subjectMovement
cameraMovement
movementSpeed
focalLength
depthOfField
lightingDirection
lightingQuality
startState
endState
...
```

That creates several problems:

* Many fields will not apply to every shot.
* The same intention can be expressed in several valid ways.
* AI models do not consistently interpret technical terminology.
* Different production methods need different information.
* Model-specific controls change constantly.
* Users will inevitably need concepts you did not anticipate.
* Schema migrations and UI forms become a substantial part of the product.
* The structured fields can contradict the prose description.

Most importantly, filmmakers generally think about a shot as a **coherent visual idea unfolding over time**, not as a database form.

## Keep the database structure thin

Renku still needs some rigid structure, but only for things the application must manipulate deterministically.

For example:

```text
Scene
  has Shot Plans

Shot Plan
  has ordered Shots

Shot
  has a stable ID
  belongs to one Shot Plan
  has an order
  has a title
  has a document/body

Attempt
  targets one or more Shots
  has a method: camera or AI
  produces Assets
```

A minimal shot record might be approximately:

```ts
type Shot = {
  id: string;
  shotPlanId: string;
  orderKey: string;
  label: string;
  title: string;
  body: string; // Markdown
  status?: "draft" | "planned" | "ready";
};
```

The `body` is where almost all the cinematographic meaning lives.

You need structure for:

* stable identity;
* ordering;
* plan membership;
* references between attempts and shots;
* media attachments;
* lifecycle or status;
* permissions and version history.

You do **not** necessarily need structure for “low-angle medium close-up with a slow push-in.”

## The shot should be a document

A shot could be stored as well-written Markdown:

```markdown
Anna holds the unopened letter beside the window. The shot begins in a
medium close-up, with Ben visible as a soft foreground silhouette.

She opens the letter and reads the first line. As her expression changes,
the camera slowly pushes toward a close-up. The movement should feel almost
imperceptible and should end when she looks up at Ben.

Cold daylight comes from the window, while the letter is picked up by the
warmer desk lamp. Anna must keep the letter in her left hand, and she ends
the shot looking screen-right.
```

That is understandable by:

* a director;
* a cinematographer;
* a storyboard artist;
* a camera operator;
* an AI video model;
* and an AI agent preparing downstream instructions.

It also preserves the relationships between the choices. The slow push-in is not merely a camera-movement property; it is connected to the moment Anna’s expression changes.

A rigid schema tends to destroy that relationship:

```json
{
  "framing": "medium_close_up",
  "movement": "push_in",
  "movementSpeed": "slow",
  "endFraming": "close_up"
}
```

Technically correct, but dramatically impoverished.

## Use a writing convention, not a validation schema

Codex can be instructed to produce shot descriptions that usually cover:

1. What the shot is intended to communicate.
2. What is visible at the beginning.
3. What the subjects do.
4. What the camera does.
5. How the shot ends.
6. Important lighting, continuity, or production constraints.

These do not need to be database fields. They can be recommended sections or simply requirements imposed by the Renku skill.

For example, the skill instruction could say:

> Write each shot as a self-contained visual description in temporal order. Establish the opening composition, describe subject and camera movement separately, and state the condition that ends the shot. Include lens, lighting, timing, continuity, and technical details only when they materially affect the intended result. Do not invent technical choices that the filmmaker has not made.

That is likely much more maintainable than an elaborate schema.

## The critical architectural rule

A useful rule is:

> **Make something structured only when Renku itself needs to compute, filter, reference, or enforce it.**

Examples:

### Keep structured

* Which scene the shot plan belongs to.
* Which shot plan owns the shot.
* Shot ordering.
* Which shots an AI generation targets.
* Which generation or camera take produced an asset.
* Whether an attempt used a camera or an AI model.
* Asset filenames and locations.
* Shot status.
* Estimated duration, but only if Renku performs timeline calculations with it.

### Keep in prose

* Emotional purpose.
* Composition.
* Blocking.
* Camera movement.
* Lens intention.
* Lighting.
* Focus changes.
* Timing within the shot.
* Continuity instructions.
* Performance direction.
* Environmental motion.
* Stylistic constraints.

Some information may later move from prose into structure when a real product capability requires it. For example, if Renku eventually displays a duration-based production timeline, `estimatedDuration` becomes worth storing separately. Until then, it can remain in the shot description.

## Structured metadata can be derived rather than authoritative

You could optionally have Codex extract lightweight metadata from the document:

```json
{
  "estimatedDurationSeconds": 8,
  "tags": ["close-up", "push-in", "letter", "Anna"],
  "characters": ["Anna", "Ben"]
}
```

But this should be treated as:

* generated indexing metadata;
* disposable;
* recomputable;
* not the source of truth.

The Markdown shot description remains canonical.

This gives you search and filtering without forcing the filmmaker or agent to populate a complex schema correctly.

For example, Codex could answer:

* “Show me all shots involving Anna and the letter.”
* “Find shots requiring camera movement.”
* “Which AI shots require character continuity?”
* “Create a shooting list for exterior night scenes.”

It can derive those answers from the documents or from cached extracted metadata.

## Shot specification versus generation prompt

I would also avoid treating the AI prompt as the canonical shot description.

The canonical shot document might say:

> Anna opens the letter. The camera makes a restrained push toward her as she understands what it says.

A Seedance prompt, Veo prompt, storyboard-grid prompt, or future model instruction may express that differently. The agent should translate the shot specification into a **model-specific attempt instruction**.

Therefore:

```text
Shot document
    stable creative intent

AI attempt
    model-specific prompt
    reference images
    model settings
    targeted shots
```

This is valuable because AI prompting conventions will keep changing, while the filmmaker’s intended shot remains relatively stable.

The same canonical shot document can also be converted into:

* a storyboard request;
* a camera department shot description;
* an AI-video prompt;
* a reference-image brief;
* a call-sheet note;
* a camera setup suggestion.

## One caveat: do not collapse everything into one scene document

Although the content of each shot can be prose, each shot should still be an individual entity.

You need to be able to:

* reorder shots;
* target shots 2–5 in a multi-shot generation;
* attach references to one shot;
* create three camera takes of one shot;
* regenerate one shot without replacing the whole plan;
* compare alternative shot plans;
* identify a specific shot in agent instructions.

So the right balance is not “everything is free-form.” It is:

> **Structured containers and relationships; document-oriented creative content.**

For Renku, I would start with something close to this:

```text
Shot
  id
  shotPlanId
  order
  label
  title
  bodyMarkdown
  status
  attachments
  createdAt
  updatedAt
```

Then add a structured property only after a feature genuinely needs it. That keeps the product flexible and makes Codex responsible for the part it is already good at: understanding and producing coherent filmmaking language.


## The description example
Here is a more complete version that still reads as a coherent shot description rather than a collection of database fields:

---

### Shot: Anna reads the letter

The shot lasts approximately ten seconds and is captured on an **85 mm lens on a full-frame camera at T2.0**, giving Anna a compressed, intimate close-up with a shallow depth of field. The camera begins at her eye level, approximately 2.5 metres away, in a medium close-up from the chest upward. Anna is positioned on the right third of the frame beside the window. Ben is seated closer to camera on the left, visible only as a soft, dark foreground silhouette that frames Anna without drawing attention away from her.

Anna holds the unopened letter in her left hand at the lower edge of the frame. She opens it and begins reading. The camera remains still for the first three seconds, allowing the action to settle. As Anna reaches the first line and her expression begins to change, the camera makes a slow, nearly imperceptible dolly push of approximately 60 centimetres, tightening from the medium close-up to a close-up. The movement should feel motivated by her realization rather than noticeable as a camera move.

Focus remains on Anna’s eyes throughout the shot. Because of the shallow depth of field, the letter is identifiable but its text is not readable, while Ben remains heavily defocused in the foreground. The focus puller should make a subtle adjustment during the push to maintain sharp focus on Anna as the camera closes the distance.

The primary light is cool, soft daylight entering through the window to Anna’s left. It is diffused through a large frame outside the window so that it wraps gently across her face without producing hard shadows. Negative fill on camera-right deepens the shadow side of her face and gives the image more contrast as her mood changes. A dimmed tungsten desk lamp at approximately 2800K creates a warmer pool of light on the letter and her hands. The camera is white-balanced around 4300K so that the window light remains slightly cool while the practical lamp retains a visible warmth.

Anna should begin the shot calm and focused on the envelope. Her reaction must develop gradually rather than appearing immediately: recognition, disbelief, and then stillness. She freezes briefly after reading the first line, lifts only her eyes toward Ben, and then raises her head. The camera completes its push at the exact moment she looks at him.

The shot ends with Anna in close-up, looking screen-right toward Ben. She must keep the letter in her left hand throughout, the desk lamp must remain visible behind her, and Ben must remain on the left side of the frame to preserve the scene’s established eyeline and screen direction.

---

This is still **one shot** because the camera continuously observes Anna without cutting away. The changing framing—from medium close-up to close-up—is achieved through the dolly push rather than an edit.
