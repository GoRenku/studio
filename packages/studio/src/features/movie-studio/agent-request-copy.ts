// Requests the user copies into their agent from Studio's empty states.
// They are Studio-owned interface copy: Studio never sends, parses or checks them.
// Bracketed words are the parts the user should edit.

export const importScreenplayRequest =
  'Import the Final Draft screenplay at [full path to your .fdx file].';
export const writeSceneRequest = 'Write a one-page scene about [your idea].';
export const analyzeScreenplayRequest = 'Analyze my screenplay.';
export const analyzeScreenplayAndWriteArcsRequest =
  'Analyze my screenplay and write arcs for the main characters.';
export const castMainCharactersRequest = 'Cast the main characters from my screenplay.';
export const addCastMemberRequest = 'Add [character name] to the cast.';
export const castWithPortraitsRequest = 'Cast the characters and make a portrait for each one.';
export const createLocationsRequest = 'Create the locations from my screenplay.';
export const addLocationRequest = 'Add [location] as a location.';
export const listPropsRequest = 'List the props that matter for continuity in my screenplay.';
export const createCastLocationsAndPropsRequest =
  'Create the cast, locations and props from my screenplay.';
export const designLookbooksRequest =
  'Design a production lookbook and a storyboard lookbook.';
export const designProductionLookbookRequest =
  'Design a production lookbook from my inspiration.';
export const designStoryboardLookbookRequest = 'Design a storyboard lookbook.';
export const makeCastAndSetVisualsRequest =
  'Make portraits for the cast and sheets for every location and prop.';
export const designAllSceneBeatsRequest = 'Design beats for every scene.';
export const designAllSceneBeatsWithStoryboardsRequest =
  'Design beats for every scene and draw a storyboard frame for each.';
export const planAllShotsRequest = 'Plan the shots for every scene that has beats.';
export const generateAllVideoTakesRequest = 'Generate video takes for the planned shots.';
export const blenderPrevisRequest = 'Block this scene as a Blender previs.';
export const projectCoverRequest = 'Make a cover image for this project.';
export const projectInformationRequest =
  'Write a logline, synopsis and premise from my screenplay.';
export const dialogueAudioRequest = 'Record the dialogue for this shot plan.';

export function nextStepQuestion(projectTitle: string): string {
  return `What should I do next on ${projectTitle}?`;
}

export function characterArcRequest(castMemberName: string): string {
  return `Write a character arc for ${castMemberName}.`;
}

export function sceneBeatsRequest(sceneHeading: string): string {
  return `Design the beats for the scene “${sceneHeading}” and draw a storyboard frame for each.`;
}

export function sceneBeatsThenShotsRequest(sceneHeading: string): string {
  return `Design the beats for “${sceneHeading}”, then plan its shots.`;
}

export function sceneShotsRequest(sceneHeading: string): string {
  return `Plan the shots for “${sceneHeading}”.`;
}

export function sceneShotsThenVideoRequest(sceneHeading: string): string {
  return `Plan the shots for “${sceneHeading}”, then generate video takes.`;
}

export function sceneVideoTakesRequest(sceneHeading: string): string {
  return `Generate video takes for the shots in “${sceneHeading}”.`;
}

export function inspirationAnalysisRequest(folderName: string): string {
  return `Analyze my “${folderName}” inspiration images.`;
}

export function locationWorldRequest(locationName: string): string {
  return `Build a 3D world for ${locationName}.`;
}

export function castMemberMediaRequest(castMemberName: string): string {
  return `Make a portrait and a character sheet for ${castMemberName}.`;
}

export function locationMediaRequest(locationName: string): string {
  return `Make a hero image and a location sheet for ${locationName}.`;
}

export function propMediaRequest(propName: string): string {
  return `Make a hero image and a prop sheet for ${propName}.`;
}
