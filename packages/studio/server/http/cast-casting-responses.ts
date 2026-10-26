import type { CastCastingResource, CastingRoundView } from '@gorenku/studio-core/client';
import {
  toStudioAssetFileResponse,
  type StudioAssetFileResponse,
} from './asset-responses.js';

type CastCastingLook = CastCastingResource['looks'][number];
type CastCastingCostume = CastCastingResource['costumes'][number];

export type CastingRoundViewResponse = Omit<CastingRoundView, 'candidates'> & {
  candidates: Array<Omit<CastingRoundView['candidates'][number], 'assetFile'> & {
    assetFile: StudioAssetFileResponse;
  }>;
};

export type CastCastingResourceResponse = Omit<CastCastingResource, 'looks' | 'costumes'> & {
  looks: Array<Omit<CastCastingLook, 'rounds' | 'castCandidate'> & {
    rounds: CastingRoundViewResponse[];
    castCandidate: StudioAssetFileResponse | null;
  }>;
  costumes: Array<Omit<CastCastingCostume, 'rounds'> & { rounds: CastingRoundViewResponse[] }>;
};

export function toCastCastingResourceResponse(
  projectName: string,
  resource: CastCastingResource
): CastCastingResourceResponse {
  return {
    ...resource,
    looks: resource.looks.map((look) => ({
      ...look,
      rounds: look.rounds.map((round) => toCastingRoundViewResponse(projectName, round)),
      castCandidate: look.castCandidate
        ? toStudioAssetFileResponse(projectName, look.castCandidate)
        : null,
    })),
    costumes: resource.costumes.map((costume) => ({
      ...costume,
      rounds: costume.rounds.map((round) => toCastingRoundViewResponse(projectName, round)),
    })),
  };
}

function toCastingRoundViewResponse(projectName: string, round: CastingRoundView): CastingRoundViewResponse {
  return {
    ...round,
    candidates: round.candidates.map((candidate) => ({
      ...candidate,
      assetFile: toStudioAssetFileResponse(projectName, candidate.assetFile),
    })),
  };
}
