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

export interface SceneShotMediaGenerationTarget {
  kind: 'sceneShotGroup';
  id: string;
  sceneId: string;
  shotListId: string;
  productionGroupId: string;
  shotIds: string[];
}

export interface SceneShotMediaGenerationRequestTarget {
  kind: 'sceneShotGroup';
  id?: string;
  sceneId: string;
  shotListId: string;
  productionGroupId?: string;
  shotIds: string[];
}

export type MediaGenerationTarget =
  | LookbookImageGenerationTarget
  | CastMediaGenerationTarget
  | LocationMediaGenerationTarget
  | SceneMediaGenerationTarget
  | SceneDialogueMediaGenerationTarget
  | SceneShotMediaGenerationTarget;

export type MediaGenerationRequestTarget =
  | LookbookImageGenerationTarget
  | CastMediaGenerationTarget
  | LocationMediaGenerationTarget
  | SceneMediaGenerationTarget
  | SceneDialogueMediaGenerationTarget
  | SceneShotMediaGenerationRequestTarget;
