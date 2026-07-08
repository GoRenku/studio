export interface LookbookImageGenerationTarget {
  kind: 'lookbook';
  id: string;
}

export interface AssetMediaGenerationTarget {
  kind: 'asset';
  id: string;
}

export interface ProjectMediaGenerationTarget {
  kind: 'project';
  id: string;
}

export interface ProjectMediaGenerationRequestTarget {
  kind: 'project';
  id?: string;
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

export interface SceneShotVideoTakeTarget {
  kind: 'sceneShotVideoTake';
  id: string;
  sceneId: string;
  takeId: string;
  shotIds: string[];
}

export interface SceneShotVideoTakeRequestTarget {
  kind: 'sceneShotVideoTake';
  id?: string;
  sceneId: string;
  takeId: string;
}

export type MediaGenerationTarget =
  | ProjectMediaGenerationTarget
  | AssetMediaGenerationTarget
  | LookbookImageGenerationTarget
  | CastMediaGenerationTarget
  | LocationMediaGenerationTarget
  | SceneMediaGenerationTarget
  | SceneDialogueMediaGenerationTarget
  | SceneShotVideoTakeTarget;

export type MediaGenerationRequestTarget =
  | ProjectMediaGenerationRequestTarget
  | AssetMediaGenerationTarget
  | LookbookImageGenerationTarget
  | CastMediaGenerationTarget
  | LocationMediaGenerationTarget
  | SceneMediaGenerationTarget
  | SceneDialogueMediaGenerationTarget
  | SceneShotVideoTakeRequestTarget;
