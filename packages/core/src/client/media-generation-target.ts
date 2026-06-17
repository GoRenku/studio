export interface LookbookImageGenerationTarget {
  kind: 'lookbook';
  id: string;
}

export interface CastMediaGenerationTarget {
  kind: 'castMember';
  id: string;
}

export interface LocationMediaGenerationTarget {
  kind: 'location';
  id: string;
}

export interface SceneMediaGenerationTarget {
  kind: 'scene';
  id: string;
}

export interface SceneDialogueMediaGenerationTarget {
  kind: 'sceneDialogue';
  sceneId: string;
  dialogueId: string;
}

export interface SceneShotVideoTakeGenerationTarget {
  kind: 'sceneShotVideoTakeGeneration';
  id: string;
  sceneId: string;
  takeGenerationId: string;
  shotIds: string[];
}

export interface SceneShotVideoTakeGenerationRequestTarget {
  kind: 'sceneShotVideoTakeGeneration';
  id?: string;
  sceneId: string;
  takeGenerationId: string;
  shotIds: string[];
}

export type MediaGenerationTarget =
  | LookbookImageGenerationTarget
  | CastMediaGenerationTarget
  | LocationMediaGenerationTarget
  | SceneMediaGenerationTarget
  | SceneDialogueMediaGenerationTarget
  | SceneShotVideoTakeGenerationTarget;

export type MediaGenerationRequestTarget =
  | LookbookImageGenerationTarget
  | CastMediaGenerationTarget
  | LocationMediaGenerationTarget
  | SceneMediaGenerationTarget
  | SceneDialogueMediaGenerationTarget
  | SceneShotVideoTakeGenerationRequestTarget;
