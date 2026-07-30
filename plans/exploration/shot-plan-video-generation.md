Now that we have implemented shot plans, the next step is to generate videos based on the shot plans. The generation will follow the same infrastructure and architecture as the other image generations. 

# Generation
- We will initially support Seedance 2.0 only to get that right. We will be adding other models later. So the skills system should be extensible (i.e. instructions for each model will be different) and not hard-coded to only Seedance 2.0 But we will only provide instructions for Seedance 
- There are mainly these types of video generation based on what you are providing to the model:
  - *Text to video*: This requires everything to be described in text. Generally not good for character, location continuity as there is no way to of course describe the exact character by text. This can only be suitable for more generic establishing shots where it is mostly a one-off and no continuity (apart from what you can accurately describe by text such as time of day, broad geographical features etc.) 
  - *Image to video*: This starts with a first frame image and can alternatively have an end frame image and in between what happens is described by the prompt. The first frame can provide continuity when it is generated with the character, location sheets etc. This can be useful for single shot, shot plans. This is also useful for continuous camera shots where there is drone camera, or some form of camera movement that can be accurately described with no big camera changes in between. The user will decide on this (as the director) working with the AI agent but the agents should have the skills to suggest this as a default if the user did not specify. 
    - This is also not suitable for audio because you cannot provide audio files for character voice continuity. But for narration scenes, audio can be a separate track outside of the video so this is still fine for that.
    - The creation of first and last frame images will need its own generation purposes. These will generally use the location and cast sheets as references.
    - The generation will first need to generate first and optionally last frame images before the video generation can happen. VERY IMPORTANT: We should not model this as formal dependencies in the data model, create validations etc. If they lack the generation (in engines package) can validate that there is a missing reference and the AI agent can warn and they generate this. No automatic dependency tracking of sorts, no execution engines with dependency graphs. Very simple. NO OVERENGINEERING
  - *Reference to video*: This is the most versatile option. For Seedance, images, audio and video can be specified as references. This can be used in single or multi shot, shot plans. There are various ways of creating video using this. Ultimately the user can override but we will have some default skill instructions for the AI agent for some common practices:
    - Providing a shot by shot storyboard: This a common technique. The idea is to turn the shot definitions in the plan into a single image (using image generation not by manual image manipulation) that demonstrates the shots in the plan and gives specific instructions the video model around camera, optics,... (things we have in the briefs) along with the dialog when appropriate.
      - For the Seedance 2.0 model, it prefers the shot images to be not realistic (or looking like final rendering if it is an animated feature) but more hand-drawn and simple but showing the specific motions more accurately. This is especially for the high motion scenes like fights, dancing, car chases etc. This is also useful for dialog scenes that cuts across characters (OTS camera moves that coincide with the dialog etc.)
      - The shot images provided in this way do not necessarily map to the shot images in the shot plan. We can have more shot images to illustrate motion etc. more clearly. Or we may want to represent the cuts more clearly here based on the plan. So this should not strictly follow the shot plan image by image but rather it should use it as a context in determining the best possible description for this generation. I.e. the key point: Shot Plan is a just a context reference, it does not need to be followed shot by shot. The user can freely change this as they also work with the agent. Therefore there should be no hard references to individual shots in a plan. (also not in the data model)
      - Using a white (but not pure white but a very light grey or beige close to white) background for the storyboard sheet image is needed.
      - The creation of this image will also be a generation purpose (similar to the first/last frame discussed above).
      - In this technique if the shot images provided in the storyboard image are simplistic drawings than we would also need to provide character sheets (per character appearance in the shots) and location sheets as reference for continuity. Again this is more about the defaults, not hard validation. The user can remove sheets if they want. They can also choose a different sheet for a character or location to better represent character's costume for example.
      - Audio references will be provided for the dialog when it exists. The user can also delete those if they want or add different ones. 
      - The prompt generated by the AI agent will map the image and audio references to their actual meanings. I.e. in the prompt they will say something like @ImageRef1 (check Seedance docs for the formatting), belongs to character A.
    - Providing a video for motion transfer: This is another popular technique. The video is mainly a very rough (sometimes a depth map) video that displays the motion and it is fed into the video model to accurately describe the motion and interaction of characters, car chases, camera movements etc. Could be a green screen representation video as well. So there are many possibilities of what this video represents. Renku treats this as opaque but the generated prompt will have the instructions for the video model. So during the authoring between user and AI agent, user will describe how the video should be treated and Renku AI agent will use the Seedance best practices to write up the prompt based on that.
      - The video (currently) is expected to be created outside of Renku. So the user will likely place the video in a folder and give a link to the AI agent to use it. The video than gets attached in the project as a reference to this generation.
      - For continuity, we will need to again supply character/location sheets, audio for dialogs. 
    - Adhoc reference based video generation: The user can skip generating a storyboard or could be generating a single shot using references for continuity. We can by default attach the character and location sheets for continuity. And user can generate adhoc images as references (or attach) These are done using generic image.create and also CLI attach actions if the user wants to include an external image, audio etc. They are attached as a reference for this generation. 
  - Special note on lookbooks:
    - Lookbook sheets are usually not necessary in video generation as they are already represented in character and location sheets and general shot plan instructions (composition, lighting etc.) So we should not by default attach a lookbook sheet
    - A user may override and attach a lookbook sheet. So this should be shown in the Preview references but not selected by default
- Seedance 2.0 have these *quality* model variants: full, mini and fast
  - We should default to full but 480 unless specified. The user can change in the preview dialog or also can ask the agent differently as well.
- Duration of generation can be informed by the shot plan but the user can override and change. Also if it is longer than 15s (which is the current max) than shot plan may not be generated as a single generation.
- Generation a video may optionally require first generating some images (as outlined above). So those should be part of the skill instructions and also we need to add the purposes for those in Renku. They are not generic images (like the adhoc reference images user may add using image.create).
- Also attaching videos as references is something new as well.
- The adhoc image generation also should pop up the generation preview dialog
- Shot plan context should be available to the agent AI through CLI and should include all configured information in the shot plan and the individual shots. The shot images can also sometimes be verbatim used (although as explained they are not default used) so they should be included in the context so if the AI chooses to use them, it can and it can inspect those.

# Generation Preview Dialog
- The preview dialog should be the same component as the other image generation preview dialogs. Do not invent a parallel codebase for this.
- The unique requirements for the video generation will be added the preview dialog. 
- The read-only generation spec review dialog should also be the same and used.
- The video models configuration will have unique capabilities:
  - The screenshot included has the 3 panes for model. You should switch Input and Model panes: So Model, Input and Setup
  - The input does not have the final Video one
  - The models are currently only the 3 Seedance 2.0 models, so remove the rest
  - I like the design of this though, the fonts used, drop-downs etc. 
- The References section:
  - The video generation method specific images are shown in the first section. Each in its own Mediacards and can be expanded by clicking on it view it larger. (These are first frame, last frame, video storyboard) They can be explicitly deselected by the user.
  - The characters and location is coming from the scene definition. So for the generation we shot have slots for each character (not just one character sheet slot). So users can choose the sheet they want for a character. By default the AI will choose the first sheet or whatever based on the context so we should show the chosen sheet. This follow the same re-usable card and its selection dialog. (We built this in the last few commits). DO NOT INVENT A NEW ONE HERE
    - User clicks on a character sheet for a given character: 
      - If there is only one character sheet for the character that is shown in large dialog so user can inspect
      - If there are multiple characters sheets for the character than selection dialog is shown. The user can select whichever sheet they want. They can also click on the sheet in the dialog to see a large version of it.
      - The user can deselect the character sheet altogether (bottom right select button, standard one)
      - Same flow applies for the location
  - We have a slot for lookbook. By default it is not selected (as explained in the section above). But the user can select. If the user clicks on it, they can see the selection dialog for the storyboard and production lookbooks. In this case the dialog contains the 2 if both exists. If not clicking on the sheet just shows the larger image dialog for inspection. Again same behaviors as the reusable MediaCard and MediaCard Dialogs just the contents are different and behaviour configurable.
  - If the user attached an adhoc image (using agent AI), that is also shown in an Adhoc section at the bottom with the attached images. Multiple images can be attached and selected for the generation. Clicking on each will show the image in large form. In this case there is no Selection dialog as there are no selections.
- The prompt section:
  - Again uses the same CodeMirror color coded prompt and in editable form. References can be selected with the @ description, same behavior as image prompts
- There is the same Update button which updates the final changes to the GenerationSpec. The agent can read these adjust accordingly.
- Generations have frozen GenerationSpec once generation succeed. Just like the image generations.

# Generations UI
The generations will be show in the Generation tab (Next to Shot Plan tab) we created but left disabled earlier.
- The should be grouped by ShadCn accordion based on Shot Plan. They can be expanded and collapsed. 
- Each generation will be a Media Card. When hovered over they can autoplay in the card for quick preview.
- There is the same delete behavior as in MediaCard
- Clicking on it, opens up the preview dialog which shows the video larger in a dialog with a video previewer contents, so they can start/stop play and scrub it.
