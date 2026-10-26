import type { CastingRoute, CastingSettings, ImageDetailLevel } from '@gorenku/studio-core/client';
import { createProjectDataService, type StudioProjectRef } from '@gorenku/studio-core/server';
import type { CastingRoundCostume, CastingRoundSubject, CastingRoundSubjectInput } from './contracts.js';
import { assertNoCastingRoundIssues, castingRoundIssue } from './diagnostics.js';

/** How many images per round the panel opens with when nothing else sets it. */
const FALLBACK_COUNT: Record<CastingRoundSubject['kind'], number> = { look: 10, costumes: 2 };

/** A resolved panel subject: what it shows, whose it is, and the references it defaults to. */
export interface ResolvedRoundSubject {
  subject: CastingRoundSubject;
  castMember: { id: string; name: string };
  defaultReferences: string[];
}

/** Which saved casting defaults a subject reads and writes. */
export const ROUND_SUBJECT_DEFAULTS: Record<CastingRoundSubject['kind'], {
  routes: (settings: CastingSettings) => CastingRoute[];
  detail: (settings: CastingSettings) => ImageDetailLevel;
  save: (routes: CastingRoute[], detail: ImageDetailLevel) => Partial<CastingSettings>;
  fallbackCount: number;
}> = {
  look: {
    routes: (settings) => settings.candidateRoutes,
    detail: (settings) => settings.candidateDetail,
    save: (candidateRoutes, candidateDetail) => ({ candidateRoutes, candidateDetail }),
    fallbackCount: FALLBACK_COUNT.look,
  },
  costumes: {
    routes: (settings) => settings.characterSheetRoutes,
    detail: (settings) => settings.characterSheetDetail,
    save: (characterSheetRoutes, characterSheetDetail) => ({ characterSheetRoutes, characterSheetDetail }),
    fallbackCount: FALLBACK_COUNT.costumes,
  },
};

type SubjectReader<K extends CastingRoundSubjectInput['kind']> = (
  projectRef: StudioProjectRef,
  input: Extract<CastingRoundSubjectInput, { kind: K }>,
  homeDir?: string,
) => Promise<ResolvedRoundSubject>;

const SUBJECT_READERS: { [K in CastingRoundSubjectInput['kind']]: SubjectReader<K> } = {
  look: async (projectRef, input, homeDir) => {
    const projectData = createProjectDataService();
    const { look } = await projectData.showCastingLook({ projectName: projectRef.name, homeDir, lookId: input.lookId });
    const { castMember } = await projectData.readCastCastingResource({ projectName: projectRef.name, homeDir, castMemberId: look.castMemberId });
    return { subject: { kind: 'look', look: { id: look.id, name: look.name } }, castMember, defaultReferences: [] };
  },
  costumes: async (projectRef, input, homeDir) => {
    assertNoCastingRoundIssues(costumeIdIssues(input.costumeIds), 'The character sheet round panel cannot open.');
    const projectData = createProjectDataService();
    const { costume: first } = await projectData.showCastingCostume({ projectName: projectRef.name, homeDir, costumeId: input.costumeIds[0]! });
    const resource = await projectData.readCastCastingResource({ projectName: projectRef.name, homeDir, castMemberId: first.castMemberId });
    const look = resource.looks.find((entry) => entry.id === first.lookId)!;
    const costumes = input.costumeIds.map((costumeId) => resource.costumes.find((costume) => costume.id === costumeId));
    assertNoCastingRoundIssues(costumes.flatMap((costume, index) => costume?.lookId === look.id
      ? []
      : [castingRoundIssue(['subject', 'costumeIds', index], `${input.costumeIds[index]} is not a costume of ${resource.castMember.name} · ${look.name}.`)]),
    'A character sheet round covers costumes of one Look.');
    return {
      subject: {
        kind: 'costumes',
        look: { id: look.id, name: look.name },
        scenes: resource.scenes,
        costumes: costumes.map((costume): CastingRoundCostume => ({
          id: costume!.id,
          name: costume!.name,
          sceneIds: costume!.sceneIds,
          sheetCount: costume!.rounds.reduce((total, round) => total + round.candidates.length, 0),
          picked: costume!.characterSheetAssetFileId !== null,
        })),
      },
      castMember: resource.castMember,
      defaultReferences: look.castCandidateAssetFileId ? [look.castCandidateAssetFileId] : [],
    };
  },
};

export function readRoundSubject(projectRef: StudioProjectRef, input: CastingRoundSubjectInput, homeDir?: string): Promise<ResolvedRoundSubject> {
  return (SUBJECT_READERS[input.kind] as SubjectReader<typeof input.kind>)(projectRef, input, homeDir);
}

function costumeIdIssues(costumeIds: string[]) {
  return costumeIds.flatMap((costumeId, index) => costumeIds.indexOf(costumeId) === index
    ? []
    : [castingRoundIssue(['subject', 'costumeIds', index], `Costume ${costumeId} is listed more than once.`)]);
}
