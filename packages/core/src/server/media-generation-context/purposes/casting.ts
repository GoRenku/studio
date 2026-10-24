import type { Scene } from '../../../client/screenplay/index.js';
import { readCastCostumeRecord } from '../../database/access/casting/costumes.js';
import { listCastLookRecords, readCastLookRecord } from '../../database/access/casting/looks.js';
import { readCastingRoundRecord } from '../../database/access/casting/rounds.js';
import { readCastMemberRecord } from '../../database/access/cast-members.js';
import { readAssetFileRecordIncludingDiscarded } from '../../database/access/asset-files.js';
import { isAssetFileAvailableInSession, toAssetFile } from '../../asset-files/projection.js';
import { readSceneOrder, toCastCostume, toCastLook } from '../../casting/projection.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { MediaGenerationPurposeBuilder, MediaGenerationPurposeBuildInput } from '../purpose-registry.js';
import { createReferenceSuggestion, suggestLookbookMedia } from '../reference-suggestions.js';
import { projectCastMemberContext } from '../scene-context.js';
import { readMediaGenerationLookbooks } from '../visual-language-context.js';

/**
 * A casting candidate shows one Look of a Cast Member. The round's references
 * (an earlier Look's cast candidate, or a shortlist) are the identity
 * reference; other cast Looks are offered as candidates.
 */
export const buildCastingRoundPurposeContext: MediaGenerationPurposeBuilder = (input) => {
  if (input.target.kind !== 'castingRound') {
    throw invalidTarget('a Casting Round');
  }
  const round = readCastingRoundRecord(input.session, input.target.id);
  const lookRecord = round ? readCastLookRecord(input.session, round.lookId) : null;
  if (!round || !lookRecord) {
    throw targetNotFound('Casting Round', input.target.id);
  }
  const sceneOrder = readSceneOrder(input.session);
  const look = toCastLook(input.session, lookRecord, sceneOrder);
  const looks = listCastLookRecords(input.session, look.castMemberId).map((record) => toCastLook(input.session, record, sceneOrder));
  const castContext = castMemberContext(input, look.castMemberId);
  const visualLanguage = readMediaGenerationLookbooks({ assetFiles: input.assetFiles, session: input.session, projectFolder: input.projectFolder, kinds: ['production'] });
  const castLookCandidates = looks.flatMap((other) => other.id !== look.id && other.castCandidateAssetFileId ? [other.castCandidateAssetFileId] : []);
  const identityIds = [...new Set([...round.referenceAssetFileIds, ...castLookCandidates])];
  return {
    targetContext: {
      kind: 'castingRound',
      ...castContext,
      round,
      look,
      looks,
      scenes: scenesById(input, look.sceneIds),
    },
    visualLanguage,
    suggestedReferences: [
      ...suggestLookbookMedia({ lookbooks: visualLanguage, role: 'appearance', projectFolder: input.projectFolder, collection: input.assetFiles, warnings: input.warnings }),
      createReferenceSuggestion({
        id: 'casting-identity',
        role: 'continuity',
        subject: { kind: 'castMember', id: look.castMemberId },
        assetFiles: activeAssetFiles(input, identityIds),
        selectedAssetFileIds: identityIds,
        workflowSelectedAssetFileIds: round.referenceAssetFileIds,
        projectFolder: input.projectFolder,
        collection: input.assetFiles,
        warnings: input.warnings,
      }),
    ],
    resourceKeys: [],
  };
};

/** A Character Sheet shows one costume; the Look's cast candidate is the identity reference. */
export const buildCastCostumePurposeContext: MediaGenerationPurposeBuilder = (input) => {
  if (input.target.kind !== 'castCostume') {
    throw invalidTarget('a Cast Costume');
  }
  const costumeRecord = readCastCostumeRecord(input.session, input.target.id);
  const lookRecord = costumeRecord ? readCastLookRecord(input.session, costumeRecord.lookId) : null;
  if (!costumeRecord || !lookRecord) {
    throw targetNotFound('Cast Costume', input.target.id);
  }
  const sceneOrder = readSceneOrder(input.session);
  const costume = toCastCostume(input.session, costumeRecord, sceneOrder);
  const look = toCastLook(input.session, lookRecord, sceneOrder);
  const castContext = castMemberContext(input, costume.castMemberId);
  const visualLanguage = readMediaGenerationLookbooks({ assetFiles: input.assetFiles, session: input.session, projectFolder: input.projectFolder, kinds: ['production', 'storyboard'] });
  const identityIds = look.castCandidateAssetFileId ? [look.castCandidateAssetFileId] : [];
  return {
    targetContext: {
      kind: 'castCostume',
      ...castContext,
      costume,
      look,
      scenes: scenesById(input, costume.sceneIds.length > 0 ? costume.sceneIds : look.sceneIds),
    },
    visualLanguage,
    suggestedReferences: [
      ...suggestLookbookMedia({ lookbooks: visualLanguage, role: 'appearance', projectFolder: input.projectFolder, collection: input.assetFiles, warnings: input.warnings }),
      createReferenceSuggestion({
        id: 'cast-identity',
        role: 'continuity',
        subject: { kind: 'castMember', id: costume.castMemberId },
        assetFiles: activeAssetFiles(input, identityIds),
        selectedAssetFileIds: identityIds,
        workflowSelectedAssetFileIds: identityIds,
        projectFolder: input.projectFolder,
        collection: input.assetFiles,
        warnings: input.warnings,
      }),
      createReferenceSuggestion({
        id: 'cast-continuity',
        role: 'continuity',
        subject: { kind: 'castMember', id: costume.castMemberId },
        assetFiles: castContext.assetFileIds.map((id) => input.assetFiles.get(id)).filter((assetFile) => assetFile.type === 'character_sheet'),
        ...(costume.characterSheetAssetFileId ? { selectedAssetFileIds: [costume.characterSheetAssetFileId] } : {}),
        projectFolder: input.projectFolder,
        collection: input.assetFiles,
        warnings: input.warnings,
      }),
    ],
    resourceKeys: [],
  };
};

function castMemberContext(input: MediaGenerationPurposeBuildInput, castMemberId: string) {
  const record = readCastMemberRecord(input.session, castMemberId);
  if (!record) {
    throw targetNotFound('Cast Member', castMemberId);
  }
  return projectCastMemberContext(input.session, record, input.assetFiles);
}

function activeAssetFiles(input: MediaGenerationPurposeBuildInput, ids: string[]) {
  return ids.flatMap((id) => {
    const record = readAssetFileRecordIncludingDiscarded(input.session, id);
    return record && isAssetFileAvailableInSession(input.session, record) ? [input.assetFiles.get(input.assetFiles.add(toAssetFile(record)))] : [];
  });
}

function scenesById(input: MediaGenerationPurposeBuildInput, sceneIds: string[]): Scene[] {
  const wanted = new Set(sceneIds);
  return input.screenplay.scenes.filter((scene) => wanted.has(scene.id));
}

function invalidTarget(expected: string): ProjectDataError {
  return new ProjectDataError('CORE_GENERATION_TARGET_INVALID', `This media purpose requires ${expected} target.`);
}

function targetNotFound(label: string, id: string): ProjectDataError {
  return new ProjectDataError('CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND', `Media generation target ${label} was not found: ${id}.`);
}
