import type {
  SceneNarrativeResource,
  SequenceResource,
  StoryArcResource,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  listActNavigationPage,
  listSceneNavigationPage,
  listSequenceNavigationPage,
  readActNavigationRow,
  readSceneNavigationContext,
  readSequenceNavigationContext,
} from '../database/access/navigation.js';
import {
  readActiveScreenplayAnalysisRecord,
  readScreenplayAnalysisDocument,
} from '../database/access/screenplay-analysis.js';
import {
  readScreenplayDocumentFromSession,
  readScreenplaySceneFromSession,
  readScreenplaySequenceFromSession,
} from '../database/access/screenplay-resource.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { readSceneStoryboardPreview } from './storyboard-overviews.js';
import type {
  ReadProjectInput,
  ReadSceneNarrativeResourceInput,
  ReadSequenceResourceInput,
} from '../project-data-service-contracts.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readSceneDialogueAudioWorkspace } from '../scene-dialogue-audio-workspace/context.js';
import { firstImageForContinuitySubject } from './continuity-subjects.js';

export async function readStoryArcResource(
  input: ReadProjectInput
): Promise<StoryArcResource> {
  const { session } = await openProjectSession(input);
  try {
    const document = requireScreenplayDocument(session);
    const actPage = listActNavigationPage(session, { limit: 200 });
    const activeAnalysisRow = readActiveScreenplayAnalysisRecord(session);
    return {
      screenplay: {
        title: document.screenplay.title,
        logline: document.screenplay.logline,
        dramaticQuestion: document.screenplay.dramaticQuestion,
        premiseOverview: document.screenplay.premiseOverview,
        centralConflict: document.screenplay.centralConflict,
        summary: document.screenplay.summary,
      },
      acts: actPage.items.map((act) => ({
        ...act,
        sequences: listSequenceNavigationPage(session, {
          actId: act.id,
          limit: 200,
        }).items.map((sequence) => ({
          ...sequence,
          scenes: listSceneNavigationPage(session, {
            sequenceId: sequence.id,
            limit: 200,
          }).items.map((scene) => ({
            ...scene,
            storyFunction: findScreenplayDocumentScene(document, scene.id)?.storyFunction,
          })),
        })),
      })),
      activeAnalysis: activeAnalysisRow
        ? readScreenplayAnalysisDocument({
            row: activeAnalysisRow,
            screenplay: document,
          })
        : null,
    };
  } finally {
    session.close();
  }
}

export async function readSequenceResource(
  input: ReadSequenceResourceInput
): Promise<SequenceResource> {
  const { session } = await openProjectSession(input);
  try {
    const sequenceContext = readSequenceNavigationContext(session, input.sequenceId);
    if (!sequenceContext) {
      throwNotFound('sequence', input.sequenceId);
    }
    const act = readActNavigationRow(session, sequenceContext.sequence.actId);
    if (!act) {
      throwNotFound('act', sequenceContext.sequence.actId);
    }
    readScreenplaySequenceFromSession(session, input.sequenceId);
    const scenes = listSceneNavigationPage(session, {
      sequenceId: input.sequenceId,
      limit: input.limit,
      cursor: input.cursor,
    });
    return {
      act,
      sequence: sequenceContext.sequence,
      scenes: {
        ...scenes,
        items: scenes.items.map((scene) => {
          const storyboardPreview = readSceneStoryboardPreview(
            session,
            scene.id
          );
          return storyboardPreview ? { ...scene, storyboardPreview } : scene;
        }),
      },
    };
  } finally {
    session.close();
  }
}

export async function readSceneNarrativeResource(
  input: ReadSceneNarrativeResourceInput
): Promise<SceneNarrativeResource> {
  const { session } = await openProjectSession(input);
  try {
    const context = readSceneNavigationContext(session, input.sceneId);
    if (!context) {
      throwNotFound('scene', input.sceneId);
    }
    const act = readActNavigationRow(session, context.sequence.actId);
    if (!act) {
      throwNotFound('act', context.sequence.actId);
    }
    const scene = readScreenplaySceneFromSession(session, input.sceneId);
    const document = requireScreenplayDocument(session);
    return {
      act,
      sequence: context.sequence,
      productionNumber: context.scene.productionNumber,
      scene,
      blocks: scene.blocks,
      castMemberLabels: Object.fromEntries(
        document.cast.map((castMember) => [castMember.id, castMember.name])
      ),
      castMemberImages: Object.fromEntries(
        document.cast.flatMap((castMember) => {
          if (!castMember.id) {
            return [];
          }
          const image = firstImageForContinuitySubject(session, {
            kind: 'castMember',
            id: castMember.id,
          });
          return image ? [[castMember.id, image]] : [];
        })
      ),
      locationLabels: Object.fromEntries(
        document.locations.map((location) => [location.id, location.name])
      ),
      locationImages: Object.fromEntries(
        document.locations.flatMap((location) => {
          if (!location.id) {
            return [];
          }
          const image = firstImageForContinuitySubject(session, {
            kind: 'location',
            id: location.id,
          });
          return image ? [[location.id, image]] : [];
        })
      ),
      castMemberHandles: Object.fromEntries(
        document.cast
          .filter((castMember) => castMember.handle && castMember.id)
          .map((castMember) => [castMember.handle.toLowerCase(), castMember.id as string])
      ),
      locationHandles: Object.fromEntries(
        document.locations
          .filter((location) => location.handle && location.id)
          .map((location) => [location.handle.toLowerCase(), location.id as string])
      ),
      dialogueAudio: readSceneDialogueAudioWorkspace({
        session,
        sceneId: input.sceneId,
      }),
    };
  } finally {
    session.close();
  }
}

function findScreenplayDocumentScene(
  document: ReturnType<typeof requireScreenplayDocument>,
  sceneId: string
) {
  for (const act of document.acts) {
    for (const sequence of act.sequences) {
      const scene = sequence.scenes.find((candidate) => candidate.id === sceneId);
      if (scene) {
        return scene;
      }
    }
  }
  return undefined;
}


function requireScreenplayDocument(session: DatabaseSession) {
  const document = readScreenplayDocumentFromSession(session);
  if (!document) {
    throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
      suggestion: 'Create screenplay data before opening this surface.',
    });
  }
  return document;
}

function throwNotFound(label: string, id: string): never {
  throw new ProjectDataError(
    'PROJECT_DATA205',
    `No ${label} was found for this screenplay request: ${id}.`,
    { suggestion: 'Check the id from the latest screenplay resource.' }
  );
}
