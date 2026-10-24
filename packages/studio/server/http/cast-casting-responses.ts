import type { CastCastingResource, CastingRoundView } from '@gorenku/studio-core/client';
import {
  toStudioAssetFileResponse,
  type StudioAssetFileResponse,
} from './asset-responses.js';

type CastCastingLook = CastCastingResource['looks'][number];

export type CastingRoundViewResponse = Omit<CastingRoundView, 'candidates'> & {
  candidates: Array<Omit<CastingRoundView['candidates'][number], 'assetFile'> & {
    assetFile: StudioAssetFileResponse;
  }>;
};

export type CastCastingResourceResponse = Omit<CastCastingResource, 'looks' | 'characterSheets'> & {
  looks: Array<Omit<CastCastingLook, 'rounds' | 'castCandidate'> & {
    rounds: CastingRoundViewResponse[];
    castCandidate: StudioAssetFileResponse | null;
  }>;
  characterSheets: StudioAssetFileResponse[];
};

export function toCastCastingResourceResponse(
  projectName: string,
  resource: CastCastingResource
): CastCastingResourceResponse {
  return {
    ...resource,
    looks: resource.looks.map((look) => ({
      ...look,
      rounds: look.rounds.map((round) => ({
        ...round,
        candidates: round.candidates.map((candidate) => ({
          ...candidate,
          assetFile: toStudioAssetFileResponse(projectName, candidate.assetFile),
        })),
      })),
      castCandidate: look.castCandidate
        ? toStudioAssetFileResponse(projectName, look.castCandidate)
        : null,
    })),
    characterSheets: resource.characterSheets.map((sheet) =>
      toStudioAssetFileResponse(projectName, sheet)
    ),
  };
}
