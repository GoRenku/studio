import type { AssetOwner } from '../../client/assets.js';
import type {
  MediaPurpose,
  MediaTarget,
} from '../../client/media-attachments.js';
import type { ProjectAssetFileDestination } from '../project-asset-files/index.js';
import {
  projectCoverCandidateResourceKeys,
  projectCoverSelectionResourceKeys,
  studioCastMemberSurfaceResourceKey,
  studioLocationSurfaceResourceKey,
  studioPropSurfaceResourceKey,
  studioVisualLanguageLookbookResourceKey,
  studioSceneShotPlansResourceKey,
  studioSceneVideoGenerationsResourceKey,
} from '../studio-coordination/resource-keys.js';
import type { AssetSelectionTarget } from '../../client/assets.js';
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

export function castCharacterSheetAttachmentDestination(
  castMemberId: string,
  semanticName?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'cast.characterSheet', castMemberId, semanticName },
    owner: { kind: 'castMember', id: castMemberId },
    resourceKeys: [studioCastMemberSurfaceResourceKey(castMemberId)],
  };
}

export function castProfileAttachmentDestination(
  castMemberId: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'cast.profile', castMemberId },
    owner: { kind: 'castMember', id: castMemberId },
    resourceKeys: [studioCastMemberSurfaceResourceKey(castMemberId)],
  };
}

export function locationSheetAttachmentDestination(
  locationId: string,
  semanticName?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'location.sheet', locationId, semanticName },
    owner: { kind: 'location', id: locationId },
    resourceKeys: [studioLocationSurfaceResourceKey(locationId)],
  };
}

export function locationHeroAttachmentDestination(
  locationId: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'location.hero', locationId },
    owner: { kind: 'location', id: locationId },
    resourceKeys: [studioLocationSurfaceResourceKey(locationId)],
  };
}

export function propSheetAttachmentDestination(
  propId: string,
  semanticName?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'prop.sheet', propId, semanticName },
    owner: { kind: 'prop', id: propId },
    resourceKeys: [studioPropSurfaceResourceKey(propId)],
  };
}

export function propHeroAttachmentDestination(
  propId: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'prop.hero', propId },
    owner: { kind: 'prop', id: propId },
    resourceKeys: [studioPropSurfaceResourceKey(propId)],
  };
}

export function lookbookImageAttachmentDestination(
  lookbookId: string,
  semanticName?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'visualLanguage.lookbookImage', lookbookId, semanticName },
    owner: { kind: 'lookbook', id: lookbookId },
    resourceKeys: [studioVisualLanguageLookbookResourceKey(lookbookId)],
  };
}

export function lookbookSheetAttachmentDestination(
  lookbookId: string,
  semanticName?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'visualLanguage.lookbookSheet', lookbookId, semanticName },
    owner: { kind: 'lookbook', id: lookbookId },
    resourceKeys: [studioVisualLanguageLookbookResourceKey(lookbookId)],
  };
}

export function resolveGeneratedMediaAttachment(input: {
  purpose: MediaPurpose;
  target: MediaTarget;
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
  Record<MediaPurpose, AttachmentBuilder>
> = {
  'project.cover': (input) =>
    details(
      requireTarget(input, 'project'),
      {
        file: { kind: 'project.cover' },
        owner: { kind: 'project' },
        resourceKeys: projectCoverCandidateResourceKeys(),
      },
      'Project Cover',
      'project_cover'
    ),
  'shot-plan.video-generation': (input) =>
    details(
      requireTarget(input, 'shotPlan'),
      {
        file: { kind: 'shotPlan.video', shotPlanId: requireShotPlanId(input) },
        owner: { kind: 'project' },
        resourceKeys: [],
      },
      'Shot Plan Video',
      'shot_plan_video',
      'video',
    ),
  'shot-plan.video-first-frame': (input) =>
    shotPlanVideoReferenceImageDetails(
      requireTarget(input, 'shotPlan'),
      requireShotPlanId(input),
      'first-frame',
      'Shot Plan Video First Frame',
      'shot_plan_video_first_frame',
    ),
  'shot-plan.video-last-frame': (input) =>
    shotPlanVideoReferenceImageDetails(
      requireTarget(input, 'shotPlan'),
      requireShotPlanId(input),
      'last-frame',
      'Shot Plan Video Last Frame',
      'shot_plan_video_last_frame',
    ),
  'shot-plan.video-storyboard': (input) =>
    shotPlanVideoReferenceImageDetails(
      requireTarget(input, 'shotPlan'),
      requireShotPlanId(input),
      'storyboard',
      'Shot Plan Video Storyboard',
      'shot_plan_video_storyboard',
    ),
  'shot-plan.video-reference': (input) =>
    shotPlanVideoReferenceImageDetails(
      requireTarget(input, 'shotPlan'),
      requireShotPlanId(input),
      'reference',
      'Shot Plan Video Reference',
      'shot_plan_video_reference',
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
      castProfileAttachmentDestination(input.target.id),
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
      locationHeroAttachmentDestination(input.target.id),
      'Location Hero',
      'location_hero'
    ),
  'prop.sheet': (input) =>
    details(
      requireTarget(input, 'prop'),
      propSheetAttachmentDestination(input.target.id, input.title),
      'Prop Sheet',
      'prop_sheet'
    ),
  'prop.hero': (input) =>
    details(
      requireTarget(input, 'prop'),
      propHeroAttachmentDestination(input.target.id),
      'Prop Hero',
      'prop_hero'
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
        },
        owner: { kind: 'shot', id: shot.id },
        resourceKeys: [studioSceneShotPlansResourceKey(shotPlan.sceneId)],
      },
      'Shot Image',
      'shot_image'
    );
  },
};

export function generationAttachmentAssetType(purpose: MediaPurpose): string {
  const assetTypes: Partial<Record<MediaPurpose, string>> = {
    'project.cover': 'project_cover',
    'shot-plan.video-generation': 'shot_plan_video',
    'shot-plan.video-first-frame': 'shot_plan_video_first_frame',
    'shot-plan.video-last-frame': 'shot_plan_video_last_frame',
    'shot-plan.video-storyboard': 'shot_plan_video_storyboard',
    'shot-plan.video-reference': 'shot_plan_video_reference',
    'lookbook.image': 'lookbook_image',
    'lookbook.video-sheet': 'lookbook_sheet',
    'lookbook.storyboard-sheet': 'lookbook_sheet',
    'cast.character-sheet': 'character_sheet',
    'cast.profile': 'cast_profile',
    'location.sheet': 'location_sheet',
    'location.hero': 'location_hero',
    'prop.sheet': 'prop_sheet',
    'prop.hero': 'prop_hero',
    'shot.image': 'shot_image',
  };
  const assetType = assetTypes[purpose];
  if (!assetType) {
    throw new ProjectDataError(
      'CORE_GENERATION_ATTACHMENT_UNSUPPORTED',
      `Focused media attachment is not available for ${purpose}.`
    );
  }
  return assetType;
}

export function generatedMediaAttachmentResourceKeys(input: {
  attachment: GeneratedMediaAttachmentDetails;
  authoredFromShotPlanId: string | null;
  session: DatabaseSession;
  selectionTarget: AssetSelectionTarget | null;
}): string[] {
  if (input.selectionTarget?.kind === 'project') {
    return [...new Set([
      ...input.attachment.resourceKeys,
      ...projectCoverSelectionResourceKeys(),
    ])];
  }
  if (
    input.attachment.assetType !== 'shot_plan_video' ||
    !input.authoredFromShotPlanId
  ) {
    return input.attachment.resourceKeys;
  }
  const source = requireShotPlanRecord(input.session, input.authoredFromShotPlanId);
  return [studioSceneVideoGenerationsResourceKey(source.sceneId)];
}

function shotPlanVideoReferenceImageDetails(
  _input: unknown,
  shotPlanId: string,
  role: 'first-frame' | 'last-frame' | 'storyboard' | 'reference',
  label: string,
  assetType: string,
): GeneratedMediaAttachmentDetails {
  return details(
    _input,
    {
      file: { kind: 'shotPlan.videoReferenceImage', shotPlanId, role },
      owner: { kind: 'project' },
      resourceKeys: [],
    },
    label,
    assetType,
  );
}

function requireShotPlanId(
  input: Parameters<typeof resolveGeneratedMediaAttachment>[0]
): string {
  requireTarget(input, 'shotPlan');
  requireShotPlanRecord(input.session, input.target.id);
  return input.target.id;
}

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

function requireTarget<K extends MediaTarget['kind']>(
  input: Parameters<typeof resolveGeneratedMediaAttachment>[0],
  kind: K
): asserts input is Parameters<typeof resolveGeneratedMediaAttachment>[0] & {
  target: Extract<MediaTarget, { kind: K }>;
} {
  if (input.target.kind !== kind) {
    throw new ProjectDataError(
      'CORE_GENERATION_TARGET_INVALID',
      `${input.purpose} cannot attach media to ${input.target.kind}.`
    );
  }
}
