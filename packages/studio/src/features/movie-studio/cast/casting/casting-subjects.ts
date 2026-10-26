import type { CastingRoundKind } from '@gorenku/studio-core/client';
import type {
  CastCastingCostumeResponse,
  CastCastingLookResponse,
  CastingRoundViewResponse,
} from '@/services/studio-project-contracts';

/** The value of the Casting card in a Look's subject row. */
export const CASTING_SUBJECT_KEY = 'casting';

/** Whose rounds the picked Look's box shows: the Look's casting, or one of its costumes. */
export interface CastingSubject {
  key: string;
  kind: CastingRoundKind;
  name: string;
  sceneIds: string[];
  rounds: CastingRoundViewResponse[];
  chosenAssetFileId: string | null;
  costume: CastCastingCostumeResponse | null;
}

/** The Look's casting first, then each of its costumes in wardrobe order. */
export function castingSubjects(look: CastCastingLookResponse, costumes: CastCastingCostumeResponse[]): CastingSubject[] {
  return [
    {
      key: CASTING_SUBJECT_KEY,
      kind: 'candidates',
      name: 'Casting',
      sceneIds: look.sceneIds,
      rounds: look.rounds,
      chosenAssetFileId: look.castCandidateAssetFileId,
      costume: null,
    },
    ...costumes.map((costume): CastingSubject => ({
      key: costume.id,
      kind: 'characterSheets',
      name: costume.name,
      sceneIds: costume.sceneIds,
      rounds: costume.rounds,
      chosenAssetFileId: costume.characterSheetAssetFileId,
      costume,
    })),
  ];
}

/**
 * The subject the box opens on: the casting while the Look is not cast or has no costumes, else the
 * first costume still without a picked sheet, else the first costume.
 */
export function defaultPickedSubject(look: CastCastingLookResponse, subjects: CastingSubject[]): CastingSubject {
  const costumes = subjects.filter((subject) => subject.costume);
  if (!look.castCandidateAssetFileId || costumes.length === 0) {
    return subjects[0]!;
  }
  return costumes.find((subject) => !subject.chosenAssetFileId) ?? costumes[0]!;
}
