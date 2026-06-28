import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  Block,
  Scene,
  ScreenplayDocument,
} from '../../../client/screenplay.js';
import type {
  SceneDialogueAudioTake,
  ShotVideoTakeProductionContext,
} from '../../../client/index.js';
import { readAssetFileRecord } from '../../database/access/asset-files.js';
import {
  listSceneDialogueAudioRecords,
  listSceneDialogueAudioTakeRecords,
  toSceneDialogueAudio,
} from '../../database/access/scene-dialogue-audio.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { sceneDialogueAudioDependencyId } from '../dependency-identifiers.js';
import {
  sceneShotVideoTakeDirectionReferenceSelections,
  sceneShotVideoTakeStructureDirections,
} from './take-state.js';

export interface ResolvedShotDialogueAudioReference {
  dependencyId: string;
  dialogueId: string;
  castMemberId: string | null;
  speakerName: string;
  plainText: string;
  defaultIncluded: boolean;
  audioState:
    | 'ready'
    | 'not-generated'
    | 'no-selected-take'
    | 'missing-file';
  pickedTake: SceneDialogueAudioTake | null;
  pickedTakeLabel: string | null;
  takeCount: number;
  unavailableReason: string | null;
  diagnostics: DiagnosticIssue[];
}

export function resolveShotDialogueAudioReferences(input: {
  session: DatabaseSession;
  screenplay: ScreenplayDocument;
  scene: Scene;
  context: ShotVideoTakeProductionContext;
}): {
  references: ResolvedShotDialogueAudioReference[];
  diagnostics: DiagnosticIssue[];
} {
  const diagnostics: DiagnosticIssue[] = [];
  const dialogueBlocksInSceneOrder = input.scene.blocks.filter(
    (block): block is Extract<Block, { type: 'dialogue' }> =>
      block.type === 'dialogue'
  );
  const castNamesById = new Map(
    input.screenplay.cast.flatMap((castMember) =>
      castMember.id ? [[castMember.id, castMember.name]] : []
    )
  );
  const defaultDialogueIds = new Set<string>();

  input.context.shots.forEach((shot) => {
    shot.dialogue.forEach((reference) => {
      const block = input.scene.blocks[reference.blockIndex];
      if (!block) {
        diagnostics.push(
          createDiagnosticError(
            'CORE_SHOT_DIALOGUE_REFERENCE_BLOCK_MISSING',
            'Shot dialogue reference points to a missing screenplay block.',
            {
              path: ['shots', shot.shotId, 'dialogue', String(reference.blockIndex)],
              context: `shotId=${shot.shotId}`,
            },
            'Update the shot dialogue references from the current scene screenplay.'
          )
        );
        return;
      }
      if (block.type !== 'dialogue') {
        diagnostics.push(
          createDiagnosticError(
            'CORE_SHOT_DIALOGUE_REFERENCE_BLOCK_NOT_DIALOGUE',
            'Shot dialogue reference points to a non-dialogue screenplay block.',
            {
              path: ['shots', shot.shotId, 'dialogue', String(reference.blockIndex)],
              context: `shotId=${shot.shotId}`,
            },
            'Update the shot dialogue references so they point to dialogue blocks.'
          )
        );
        return;
      }
      defaultDialogueIds.add(block.dialogueId);
    });
  });

  const audioByDialogueId = new Map(
    listSceneDialogueAudioRecords(input.session, input.context.scene.id).map(
      (record) => [
        record.dialogueId,
        toSceneDialogueAudio(
          record,
          listSceneDialogueAudioTakeRecords(input.session, record.id)
        ),
      ]
    )
  );

  const references = dialogueBlocksInSceneOrder.map((dialogueBlock) => {
    const dialogueId = dialogueBlock.dialogueId;
    const audio = audioByDialogueId.get(dialogueId) ?? null;
    const selectedTakeId = selectedDialogueAudioTakeIdForContext(
      input.context,
      dialogueId
    );
    const pickedTake =
      selectedTakeId && audio
        ? audio.takes.find((take) => take.takeId === selectedTakeId) ?? null
        : null;
    const takeLabel = pickedTake && audio
      ? takeLabels(audio.takes).get(pickedTake.takeId) ?? 'Take'
      : null;
    const referenceDiagnostics: DiagnosticIssue[] = [];
    let unavailableReason: string | null = null;
    let audioState: ResolvedShotDialogueAudioReference['audioState'] = 'ready';

    if (!audio || audio.takes.length === 0) {
      unavailableReason = 'Not generated yet';
      audioState = 'not-generated';
    } else if (!pickedTake) {
      unavailableReason = 'No selected audio take';
      audioState = 'no-selected-take';
      referenceDiagnostics.push(
        createDiagnosticError(
          'CORE_SHOT_DIALOGUE_AUDIO_SELECTED_TAKE_MISSING',
          'Dialogue audio reference has no selected audio take.',
          {
            path: [
              'take',
              'state',
              'referenceSelections',
              'selectedDialogueAudioTakeIds',
              dialogueId,
            ],
          },
          'Select a dialogue audio take before using this dialogue as a video reference.'
        )
      );
    } else if (
      !readAssetFileRecord(input.session, {
        assetId: pickedTake.assetId,
        assetFileId: pickedTake.assetFileId,
      })
    ) {
      unavailableReason = 'Picked audio take file is missing';
      audioState = 'missing-file';
      referenceDiagnostics.push(
        createDiagnosticError(
          'CORE_SHOT_DIALOGUE_AUDIO_ASSET_FILE_MISSING',
          'Selected dialogue audio take does not resolve to an asset file.',
          { path: ['sceneDialogueAudio', dialogueId, 'takes', pickedTake.takeId] },
          'Regenerate or import the dialogue audio take before using it as a video reference.'
        )
      );
    }

    const castMemberId = dialogueBlock.castMemberId ?? audio?.castMemberId ?? null;
    return {
      dependencyId: sceneDialogueAudioDependencyId(dialogueId),
      dialogueId,
      castMemberId,
      speakerName: castMemberId
        ? castNamesById.get(castMemberId) ?? 'Speaker'
        : 'Narrator',
      plainText: dialogueBlock.lines.join('\n') || audio?.plainText || '',
      defaultIncluded: defaultDialogueIds.has(dialogueId),
      audioState,
      pickedTake,
      pickedTakeLabel: takeLabel,
      takeCount: audio?.takes.length ?? 0,
      unavailableReason,
      diagnostics: referenceDiagnostics,
    };
  });

  return {
    references,
    diagnostics,
  };
}

function selectedDialogueAudioTakeIdForContext(
  context: ShotVideoTakeProductionContext,
  dialogueId: string
): string | undefined {
  for (const direction of sceneShotVideoTakeStructureDirections(
    context.take.state.structure
  )) {
    const selected = sceneShotVideoTakeDirectionReferenceSelections(direction)
      .selectedDialogueAudioTakeIds[dialogueId];
    if (selected) {
      return selected;
    }
  }
  return undefined;
}

function takeLabels(takes: SceneDialogueAudioTake[]): Map<string, string> {
  const sorted = [...takes].sort(
    (left, right) =>
      Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
      left.takeId.localeCompare(right.takeId)
  );
  return new Map(
    sorted.map((take, index) => [take.takeId, `Take ${index + 1}`])
  );
}
