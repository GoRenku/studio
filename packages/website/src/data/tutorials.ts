import inspiration from '../assets/screens/wes-anderson-grabs.png';
import screenplayAnalysis from '../assets/screens/screenplay-analysis.png';
import lookbook from '../assets/screens/lookbook.png';
import cast from '../assets/screens/cast-grid.png';
import beats from '../assets/screens/scene-beats.png';
import storyboard from '../assets/screens/act-storyboard.png';
import shots from '../assets/screens/shot-list-bombardment.jpg';
import previs from '../assets/screens/harbor-blender-previs.jpg';
import takes from '../assets/screens/studio-generation-review-clean.jpg';
import type { ImageMetadata } from 'astro';

interface TutorialSection {
  id: string;
  title: string;
  introduction: string;
  steps: string[];
  prompt?: string;
  figure?: { image: ImageMetadata; alt: string; caption: string };
}

export interface Tutorial {
  slug: string;
  title: string;
  description: string;
  phase: string;
  image: ImageMetadata;
  alt: string;
  caption: string;
  prerequisite: string;
  outcome: string;
  sections: TutorialSection[];
  checkpoint: string;
}

export const tutorials: Tutorial[] = [
  {
    slug: 'inspiration', title: 'Find your visual language', phase: 'Visual development',
    description: 'Turn a collection of references into a clear cinematic direction.',
    image: inspiration, alt: 'The Wes Anderson reference collection in Renku’s Inspiration Grabs tab.',
    caption: 'Collect images for the decisions they help you make: light, framing, color, and atmosphere.',
    prerequisite: 'A project with a screenplay. Complete Quick Start first if you are still setting up.',
    outcome: 'An Inspiration collection and an analysis you can use to brief your lookbooks.',
    sections: [
      { id: 'screenplay-analysis', title: 'Understand the story before choosing its look', introduction: 'Begin with a screenplay analysis to understand the dramatic arc and choose one scene to develop through this tutorial.', steps: ['Ask Codex to analyze the imported screenplay, including the central conflict, character arcs, and major turning points.', 'In Studio, open Analysis > Screenplay Analysis. Review the dramatic progression and written analysis against your script, and discuss any interpretation you would change.', 'Choose a manageable scene for your first production pass. Identify what the audience should feel and what changes during the scene; use those intentions to guide your visual references.'], prompt: 'Analyze my screenplay with Renku and save the Screenplay Analysis. Explain the dramatic arc and major turning points, then suggest a manageable scene to develop first and why it is a useful starting point.', figure: { image: screenplayAnalysis, alt: 'Renku Screenplay Analysis showing a dramatic progression chart and written story analysis.', caption: 'Review the screenplay’s dramatic progression before choosing the visual direction for your first scene.' } },
      { id: 'collect', title: 'Collect with a question in mind', introduction: 'Start with the feeling of one scene. For a harbor farewell, you might explore distance, cold morning light, and the contrast between a still figure and a busy port.', steps: ['Choose a small, coherent set of film stills, photographs, paintings, or your own reference images. Use sources you have permission to use.', 'Group the images by a useful intention, such as “Harbor at dawn” or “Quiet interiors.” Tell Codex where the local image files are and ask it to add them to an Inspiration folder.', 'Open the collection in Studio and remove distractions from your working selection. A few purposeful references make a clearer brief than an indiscriminate mood board.'], prompt: 'Use the reference images at [local folder path] to create an Inspiration folder for my project. The direction is a restrained harbor farewell: cool dawn light, wide negative space, and one warm practical light. Keep the source images unchanged.' },
      { id: 'analyze', title: 'Describe what you want to borrow', introduction: 'An analysis makes visual choices discussable. Ask Codex to inspect the actual images rather than infer their appearance from filenames.', steps: ['Ask for an Inspiration Analysis covering palette, lighting, composition, camera distance, texture, and recurring visual patterns.', 'Review the analysis alongside the images. Correct vague claims with specifics: “The figures feel isolated because of their scale in the frame.”', 'Separate the qualities you want to carry forward from those that do not suit your screenplay. Save the useful direction before authoring the lookbooks.'], prompt: 'Analyze this Inspiration folder with Renku. Explain the lighting, palette, composition, and camera language using evidence from the images. Save the Inspiration Analysis. Suggest which choices fit my selected scene and which I should leave behind.' },
    ],
    checkpoint: 'You can explain the intended look in a few concrete sentences, and the saved Inspiration Analysis supports those choices. Next, turn that direction into the two project lookbooks.',
  },
  {
    slug: 'lookbooks', title: 'Give the film a visual compass', phase: 'Visual development',
    description: 'Author Production and Storyboard Lookbooks with distinct jobs.',
    image: lookbook, alt: 'Renku Lookbook with cinematic imagery and visual direction.',
    caption: 'A shared visual brief keeps individual generations part of the same film.',
    prerequisite: 'Your screenplay, an Inspiration collection, and a reviewed analysis or a clear visual brief.',
    outcome: 'A Production Lookbook for the final film and a Storyboard Lookbook for Beat Storyboards.',
    sections: [
      { id: 'production', title: 'Define the final film’s appearance', introduction: 'The Production Lookbook directs the image you want an audience to see. Each project has one Production Lookbook that you refine as your direction develops.', steps: ['Ask Codex to read the screenplay and your Inspiration Analysis before authoring the Production Lookbook.', 'Specify palette, contrast, light sources, lens character, framing, camera movement, surfaces, and atmosphere. Tie each choice to the story.', 'Review the written direction first. Then request a visual sheet if it would help you judge whether the ideas belong together.'], prompt: 'Create the Production Lookbook from my screenplay and reviewed Inspiration Analysis. Use cool dawn exteriors, restrained contrast, weathered surfaces, and deliberate camera movement. Explain the visual choices, save the Lookbook, and let me review it before generating a sheet.' },
      { id: 'storyboard', title: 'Choose how you want to read the boards', introduction: 'The Storyboard Lookbook directs the appearance of Beat Storyboards. It can be hand-drawn, cinematic, or another visual treatment that makes the scene easy to discuss.', steps: ['Choose the board treatment separately from the final film’s look. A pencil board can communicate a cinematic scene without reproducing its final texture.', 'Ask Codex to author the project’s Storyboard Lookbook with that treatment. Consider readability, framing clarity, color, and how much visual detail you need.', 'If you generate lookbook sheets, review them as visual references. Revise the lookbooks when the intended direction changes rather than expecting an image alone to communicate every decision.'], prompt: 'Create the Storyboard Lookbook for clear graphite-style Beat Storyboards with simple lighting and readable staging. Use the Production Lookbook as story context, but keep this board treatment distinct. Save the Lookbook and show me where to review it.' },
    ],
    checkpoint: 'Both lookbooks are authored, and you can distinguish the final film’s appearance from the boards’ presentation. Any generated sheets agree with the direction you intend to use.',
  },
  {
    slug: 'cast-and-world', title: 'Meet the people. Build the world.', phase: 'Production design',
    description: 'Develop Cast Members, Locations, and Props before planning coverage.',
    image: cast, alt: 'Renku Cast grid with character portraits and descriptions.',
    caption: 'Stable character and world references give the scene continuity.',
    prerequisite: 'An imported or authored screenplay and a reviewed Production Lookbook.',
    outcome: 'The Cast Members, Locations, and important Props needed for your first scene, with reviewed design notes and references.',
    sections: [
      { id: 'breakdown', title: 'Start with one scene’s needs', introduction: 'FDX import preserves the screenplay; it does not populate the production departments. Ask Codex to read the scene and develop those records deliberately.', steps: ['Identify the speaking and visible characters, the setting, and the Props that matter to the action.', 'Have Codex create or revise the corresponding Cast Members, Locations, and Props. Ask it to reuse existing records when they describe the same subject.', 'Separate facts in the script from creative design proposals. Resolve uncertainties before producing a large image batch.'], prompt: 'Read [scene heading or production number] and the Production Lookbook. Identify the Cast Members, Locations, and important Props it needs. Create or update their Renku records without rewriting the FDX-backed screenplay. Distinguish script facts from design suggestions.' },
      { id: 'design', title: 'Direct identities and spaces', introduction: 'Descriptions are the durable brief. Images help you decide whether that brief has become the right person, place, or object.', steps: ['For Cast, define appearance, performance, costume continuity, and voice direction where needed. Review a portrait before expanding the reference set.', 'For Locations, define layout, materials, light, atmosphere, and key spatial relationships. Request consistent views of the same space when staging needs them.', 'For Props, establish scale, material, condition, and how the character handles the object. Prioritize objects that carry story meaning.'], prompt: 'Develop the Cast Design, Location Design, and Prop Design for this scene using the Production Lookbook. Start with written designs. Then propose a small reference-image batch with provider, model, references, and estimated cost for my approval.' },
      { id: 'review', title: 'Choose references you can keep using', introduction: 'Review each generated reference in Studio before treating it as established continuity.', steps: ['Check character identity and wardrobe, Location geography, and Prop scale against your intended scene.', 'Ask for a focused revision when something is wrong. Name the exact image and what to preserve.', 'Select the accepted references for the relevant owners. For a 3D Location World, ask Codex about the World Labs workflow and its same-space reference requirements as a separate generation step.'] },
    ],
    checkpoint: 'Your first scene has the people, places, and objects it needs, with useful descriptions and deliberately selected visual references. You do not need to finish the entire film’s asset library before continuing.',
  },
  {
    slug: 'scene-beats', title: 'Find the turns inside the scene', phase: 'Story to screen',
    description: 'Break the scene into meaningful changes in action and emotion.',
    image: beats, alt: 'Scene Beats in Renku with individual narrative moments.',
    caption: 'Beats describe how the scene changes before you decide how to photograph it.',
    prerequisite: 'A selected scene, visual direction, and the relevant Cast, Location, and Prop context.',
    outcome: 'A reviewed, saved Scene Beats revision that will guide your storyboards.',
    sections: [
      { id: 'read', title: 'Know what changes', introduction: 'A Beat is a meaningful turn in the scene. A character notices something, commits to a choice, changes tactics, or leaves the audience with a different understanding.', steps: ['Read the scene with Codex and identify its starting state, central tension, and ending state.', 'Ask for a concise Beat breakdown that preserves the screenplay’s action and dialogue.', 'Keep camera coverage for the Shot Plan. One Beat may later need several shots, and one continuous shot may carry several Beats.'], prompt: 'Read the selected scene and its Cast, Location, Prop, and Lookbook context. Create Scene Beats around meaningful changes in action and emotion. Preserve the screenplay, avoid inventing new dialogue, and save a revision for review.' },
      { id: 'refine', title: 'Make every Beat earn its place', introduction: 'For the harbor farewell, “she watches the ship” may be setup; “she hides the letter instead of waving” is a turn. Use that level of specificity in feedback.', steps: ['Review the saved Beats in Studio in scene order. Check what the viewer learns and what each character is trying to do.', 'Merge repetitive moments or split an overloaded Beat when it contains more than one meaningful turn.', 'Ask Codex to save the revised breakdown. Identify the exact saved revision you want to use for the storyboard pass.'], prompt: 'Review these Beats with me. Merge moments that repeat the same emotional state, keep the farewell decision distinct, and preserve the scene’s ending. Save the revised Scene Beats and confirm which revision we will storyboard.' },
    ],
    checkpoint: 'The Beat sequence reads as the same scene as your script, with a clear progression and no unexplained story additions. The revision you intend to storyboard is saved.',
  },
  {
    slug: 'storyboards', title: 'See the scene before you shoot it', phase: 'Story to screen',
    description: 'Turn reviewed Beats into images you can discuss and refine.',
    image: storyboard, alt: 'Renku storyboard images arranged across a story sequence.',
    caption: 'Review the visual progression, then refine the moments that are unclear.',
    prerequisite: 'A reviewed Scene Beats revision, the Storyboard Lookbook, and relevant visual references.',
    outcome: 'Beat Storyboards that communicate the scene’s dramatic progression.',
    sections: [
      { id: 'brief', title: 'Brief a bounded storyboard pass', introduction: 'Start with one scene. Give Codex the exact saved Beats revision and ask it to use your Storyboard Lookbook for the images’ appearance.', steps: ['Confirm the scene, Beats revision, board treatment, and reference images before generation.', 'Ask Codex to propose the provider, model, and cost. Review the request and approve the batch you want.', 'Have Codex use the Renku storyboard workflow and attach the resulting images to the intended Beats.'], prompt: 'Prepare Beat Storyboards for the saved Scene Beats revision of [scene]. Use the Storyboard Lookbook and our selected Cast and Location references. Show me the planned generation, provider, model, and estimated cost before running it. After approval, save the results to the Beats.' },
      { id: 'revise', title: 'Read it like a sequence', introduction: 'The boards should make the action legible even before you have final camera coverage. Look at the relationship between images, not only the beauty of each one.', steps: ['Check character continuity, geography, the progression of attention, and whether the decisive action is visible.', 'Give precise feedback on a weak image. If you want most of an existing image preserved, identify that image and ask for a focused edit.', 'If the story changes, revise the Beats first and ask Codex for a new storyboard pass from that revision. If only the visual treatment changes, update the Storyboard Lookbook.'], prompt: 'Revise the storyboard image for [Beat]. Preserve the character and harbor layout, but make the hidden letter readable and move the departing ship deeper into the background. Use the existing image as the edit source and attach the accepted result to this Beat.' },
    ],
    checkpoint: 'You can follow the scene through the Beat Storyboards, and the important actions are legible. Next, choose Shot List planning for coverage or Blender Previs for spatial and timed staging.',
  },
  {
    slug: 'shot-list', title: 'Design the coverage', phase: 'Shot planning',
    description: 'Translate story intentions into a practical, shot-by-shot plan.',
    image: shots, alt: 'Renku Shot List with numbered images and camera direction.',
    caption: 'Shot List planning puts framing, coverage, and references beside each camera decision.',
    prerequisite: 'A scene with reviewed Beats and Storyboards, plus established visual direction.',
    outcome: 'A Shot List based Shot Plan with purposeful coverage and reviewed Shot Images.',
    sections: [
      { id: 'coverage', title: 'Choose the camera’s point of view', introduction: 'Use a Shot List when you want to design coverage directly: what the audience sees, from where, and in what order.', steps: ['Ask Codex to create a Shot List based Shot Plan for the selected scene, using the screenplay, Beats, and visual context.', 'Describe shot size, angle, lens intent, camera movement, subject action, and the Beat each shot serves.', 'Review the order, screen direction, eyelines, and transitions. Remove redundant coverage and add a missing reaction or detail only when it helps the scene.'], prompt: 'Create a Shot List based Shot Plan for this scene. Begin with a wide harbor master, move closer as the farewell becomes personal, and reserve the letter detail for the decision Beat. Include framing, lens intent, movement, action, and Beat coverage. Save the plan for review before generating images or video.' },
      { id: 'references', title: 'Refine the images that guide the take', introduction: 'Shot Images help you evaluate a camera idea and may become references for generation. Make the important compositional decisions before spending on video.', steps: ['Review the individual Shots in Studio. Ask for Shot Images where they help resolve framing or continuity.', 'Select the intended image for each Shot and tell Codex exactly which references should guide video generation.', 'Check the planned duration and dialogue needs. If timing, movement, or geography is hard to communicate through a list, explore the Blender Previs chapter.'], prompt: 'Prepare reference images for the reviewed Shots, keeping the selected Cast and Location consistent. Propose the image generation cost first. After I review the images, help me select the references and prepare this Shot Plan for video generation.' },
    ],
    checkpoint: 'The Shot Plan covers the scene with deliberate camera decisions and selected references. Continue to video generation, or explore Blender Previs if you want to direct staging in space and time.',
  },
  {
    slug: 'blender-previs', title: 'Direct in space and time', phase: 'Shot planning',
    description: 'Block characters, cameras, and action in a moving 3D rehearsal.',
    image: previs, alt: 'A Blender harbor previs shown beside its generated cinematic interpretation.',
    caption: 'Previs establishes staging and timing; the generated take interprets it as a cinematic image.',
    prerequisite: 'A reviewed scene and visual context. The Blender workflow also requires a working Blender installation, which Codex should check before rendering.',
    outcome: 'A Previs Shot Plan with reviewed blocking, camera direction, and a retained render for generation reference.',
    sections: [
      { id: 'stage', title: 'Build a rehearsal of the scene', introduction: 'Choose Blender Previs when positions, camera paths, or timing need to be precise. You can use it as your planning approach without completing the Shot List chapter first.', steps: ['Ask Codex to check the Blender workflow prerequisites and create a Previs Shot Plan for the selected scene.', 'Define the space, character positions, camera framing, lenses, and the important action. Start with readable blocking instead of detailed surface finishes.', 'If your scene uses a generated Location World, identify the reviewed World you want to use. Discuss any missing Location or character references before the render.'], prompt: 'Use Renku’s Blender Previs workflow for this scene. Check Blender availability first. Stage the character near the harbor edge, the departing ship in the distance, and a slow camera push toward the letter. Create and save a Previs Shot Plan with clear blocking before refining the render.' },
      { id: 'timing', title: 'Direct the timing, then watch it', introduction: 'Use concrete direction: when the character moves, where the camera travels, and how an action relates to a line of dialogue.', steps: ['Ask Codex to set action and dialogue timing. Preview the scene and watch for collisions, awkward holds, or camera moves that reveal the wrong information.', 'Give a bounded adjustment: “Hold the wide frame until she lowers the letter; then move closer over two seconds.”', 'Render the revised plan and review playback in Studio. Keep the render revision that expresses your intention and identify it as the reference for the video request.'], prompt: 'Revise this Previs Shot Plan: hold the opening camera until the character lowers the letter, then push closer over two seconds. Preserve the stage layout. Render a new revision, let me review its playback, and use the accepted render when preparing video generation.' },
    ],
    checkpoint: 'The previs communicates the intended geography, movement, and timing. You have reviewed the actual render and identified the revision to use for a generated take.',
  },
  {
    slug: 'video-generation', title: 'Turn the plan into a take', phase: 'Generation & review',
    description: 'Prepare a generation, review its cost, and direct the next iteration.',
    image: takes, alt: 'Renku video generation review with a cinematic take in the Studio player.',
    caption: 'The first take is a creative result to review, not the end of the directing process.',
    prerequisite: 'A reviewed Shot List or Previs Shot Plan, selected references, and a configured provider with generation access.',
    outcome: 'A generated video take saved to your project, reviewed against the plan, with a clear next decision.',
    sections: [
      { id: 'prepare', title: 'Prepare one deliberate generation', introduction: 'Start with one Shot Plan and a small generation scope. Provider routes have different reference, duration, and audio capabilities; ask Codex to check the route you intend to use.', steps: ['Name the Shot Plan and the references you want: selected Shot Images, a reviewed previs render, Cast references, or other accepted material.', 'If dialogue is needed, decide with Codex whether to prepare dialogue audio or use a provider route that supports the intended audio workflow.', 'Ask for the exact provider and model, duration, prompt, submitted references, and estimated cost. Resolve missing inputs and approve the bounded request before execution.'], prompt: 'Prepare video generation for this reviewed Shot Plan. Use [selected references or accepted previs render]. Check the chosen provider route’s support for our duration and audio needs. Show the prompt, submitted references, provider, model, and estimated cost, and wait for my approval before generating.' },
      { id: 'review', title: 'Watch with a director’s eye', introduction: 'Once generation completes, review the saved take in Studio alongside the plan and its references.', steps: ['Watch the whole take for story clarity and pacing, then inspect identity, costume, geography, motion, and dialogue timing.', 'Keep the take if it serves the scene. If it misses, identify the cause: a weak reference, unclear action, camera direction, or a limitation of the chosen route.', 'Request a focused next pass. Editing a specific existing video and generating a new take are different requests; tell Codex which result you want.'], prompt: 'Review this generated take against the Shot Plan with me. The character and framing work, but the camera starts moving too early. Propose a focused next pass that preserves those strengths. Explain whether the available route can edit this take or needs a new generation, and show the cost before running.' },
      { id: 'continue', title: 'Carry the learning into the next scene', introduction: 'A good first scene gives you a repeatable workflow. Keep the choices that worked and update the shared direction when you learn something new.', steps: ['Select the accepted take in Studio and record any continuity decisions that matter for the following scene.', 'Repeat the Beat, Storyboard, Shot Plan, and take loop for the next scene using your established Cast, Locations, Props, and lookbooks.', 'Use your preferred editing application for final assembly, sound work, and delivery. This tutorial ends with generated scene takes; it does not assume Renku has completed an edited film.'] },
    ],
    checkpoint: 'The take is saved and reviewed, and you know whether to accept it or request a specific revision. You have completed the full path from inspiration to a generated scene.',
  },
];
