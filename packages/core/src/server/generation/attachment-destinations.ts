import type { AssetOwner } from '../../client/assets.js';
import type {
  GenerationPurpose,
  GenerationTarget,
} from '../../client/generation.js';
import type { ProjectAssetFileDestination } from '../project-asset-files/index.js';
import {
  studioCastMemberSurfaceResourceKey,
  studioLocationSurfaceResourceKey,
  studioVisualLanguageLookbookResourceKey,
  studioSceneShotPlansResourceKey,
} from '../studio-coordination/resource-keys.js';
import { requireShotRecord } from '../database/access/shot-plans/shot-records.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';

export interface GeneratedMediaAttachmentDestination {
  file: ProjectAssetFileDestination;
  owner: AssetOwner;
  resourceKeys: string[];
}

export interface GeneratedMediaAttachmentDetails {
  destination: GeneratedMediaAttachmentDestination;
  label: string;
  assetType: string;
  mediaKind: 'image' | 'video';
  resourceKeys: string[];
}

export function projectVideoAttachmentDestination(
  titleHint?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'project.video', titleHint },
    owner: { kind: 'project' },
    resourceKeys: [],
  };
}

export function castCharacterSheetAttachmentDestination(
  castMemberId: string,
  titleHint?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'cast.characterSheet', castMemberId, titleHint },
    owner: { kind: 'castMember', id: castMemberId },
    resourceKeys: [studioCastMemberSurfaceResourceKey(castMemberId)],
  };
}

export function castProfileAttachmentDestination(
  castMemberId: string,
  titleHint?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'cast.profile', castMemberId, titleHint },
    owner: { kind: 'castMember', id: castMemberId },
    resourceKeys: [studioCastMemberSurfaceResourceKey(castMemberId)],
  };
}

export function locationSheetAttachmentDestination(
  locationId: string,
  titleHint?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'location.sheet', locationId, titleHint },
    owner: { kind: 'location', id: locationId },
    resourceKeys: [studioLocationSurfaceResourceKey(locationId)],
  };
}

export function locationHeroAttachmentDestination(
  locationId: string,
  titleHint?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'location.hero', locationId, heroName: titleHint },
    owner: { kind: 'location', id: locationId },
    resourceKeys: [studioLocationSurfaceResourceKey(locationId)],
  };
}

export function lookbookImageAttachmentDestination(
  lookbookId: string,
  titleHint?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'visualLanguage.lookbookImage', titleHint },
    owner: { kind: 'lookbook', id: lookbookId },
    resourceKeys: [studioVisualLanguageLookbookResourceKey(lookbookId)],
  };
}

export function lookbookSheetAttachmentDestination(
  lookbookId: string,
  titleHint?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'visualLanguage.lookbookSheet', titleHint },
    owner: { kind: 'lookbook', id: lookbookId },
    resourceKeys: [studioVisualLanguageLookbookResourceKey(lookbookId)],
  };
}

export function resolveGeneratedMediaAttachment(input: {
  purpose: GenerationPurpose;
  target: GenerationTarget;
  title?: string;
  session: DatabaseSession;
}): GeneratedMediaAttachmentDetails {
  const builder = attachmentBuilders[input.purpose];
  if (!builder) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_UNSUPPORTED',
      `Focused media attachment is not available for ${input.purpose}.`
    );
  }
  return builder(input);
}

type AttachmentBuilder = (
  input: Parameters<typeof resolveGeneratedMediaAttachment>[0]
) => GeneratedMediaAttachmentDetails;

const attachmentBuilders: Partial<
  Record<GenerationPurpose, AttachmentBuilder>
> = {
  'video.create': (input) =>
    details(
      requireTarget(input, 'project'),
      projectVideoAttachmentDestination(input.title),
      'Generated Video',
      'project_video',
      'video'
    ),
  'lookbook.image': (input) =>
    details(
      requireTarget(input, 'lookbook'),
      lookbookImageAttachmentDestination(input.target.id, input.title),
      'Lookbook Image',
      'lookbook_image'
    ),
  'lookbook.video-sheet': (input) =>
    details(
      requireTarget(input, 'lookbook'),
      lookbookSheetAttachmentDestination(input.target.id, input.title),
      'Video Lookbook Sheet',
      'lookbook_sheet'
    ),
  'lookbook.storyboard-sheet': (input) =>
    details(
      requireTarget(input, 'lookbook'),
      lookbookSheetAttachmentDestination(input.target.id, input.title),
      'Storyboard Lookbook Sheet',
      'lookbook_sheet'
    ),
  'cast.character-sheet': (input) =>
    details(
      requireTarget(input, 'castMember'),
      castCharacterSheetAttachmentDestination(input.target.id, input.title),
      'Character Sheet',
      'character_sheet'
    ),
  'cast.profile': (input) =>
    details(
      requireTarget(input, 'castMember'),
      castProfileAttachmentDestination(input.target.id, input.title),
      'Profile',
      'cast_profile'
    ),
  'location.sheet': (input) =>
    details(
      requireTarget(input, 'location'),
      locationSheetAttachmentDestination(input.target.id, input.title),
      'Location Sheet',
      'location_sheet'
    ),
  'location.hero': (input) =>
    details(
      requireTarget(input, 'location'),
      locationHeroAttachmentDestination(input.target.id, input.title),
      'Location Hero',
      'location_hero'
    ),
  'shot.image': (input) => {
    requireTarget(input, 'shot');
    const shot = requireShotRecord(input.session, input.target.id);
    const shotPlan = requireShotPlanRecord(input.session, shot.shotPlanId);
    return details(
      input,
      {
        file: {
          kind: 'shot.image',
          shotPlanId: shot.shotPlanId,
          shotId: shot.id,
          titleHint: input.title,
        },
        owner: { kind: 'shot', id: shot.id },
        resourceKeys: [studioSceneShotPlansResourceKey(shotPlan.sceneId)],
      },
      'Shot Image',
      'shot_image'
    );
  },
};

function details(
  _input: unknown,
  destination: GeneratedMediaAttachmentDestination,
  label: string,
  assetType: string,
  mediaKind: 'image' | 'video' = 'image'
): GeneratedMediaAttachmentDetails {
  return {
    destination,
    label,
    assetType,
    mediaKind,
    resourceKeys: destination.resourceKeys,
  };
}

function requireTarget<K extends GenerationTarget['kind']>(
  input: Parameters<typeof resolveGeneratedMediaAttachment>[0],
  kind: K
): asserts input is Parameters<typeof resolveGeneratedMediaAttachment>[0] & {
  target: Extract<GenerationTarget, { kind: K }>;
} {
  if (input.target.kind !== kind) {
    throw new ProjectDataError(
      'CORE_GENERATION_TARGET_INVALID',
      `${input.purpose} cannot attach media to ${input.target.kind}.`
    );
  }
}
