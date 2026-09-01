import type { MediaPurpose } from '../../client/media-attachments.js';
import type {
  MediaGenerationOutputGuidance,
  MediaGenerationReferenceSuggestion,
  MediaGenerationTargetContext,
  ReadMediaGenerationContextInput,
} from '../../client/media-generation-context.js';
import type { MediaGenerationLookbookContext } from '../../client/media-generation-context.js';
import type { Screenplay } from '../../client/screenplay/index.js';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { buildAssetPurposeContext } from './purposes/asset.js';
import { buildCastPurposeContext } from './purposes/cast.js';
import { buildLocationPurposeContext } from './purposes/location.js';
import { buildLookbookPurposeContext } from './purposes/lookbook.js';
import { buildProjectPurposeContext } from './purposes/project.js';
import { buildPropPurposeContext } from './purposes/prop.js';
import { buildScenePurposeContext } from './purposes/scene.js';
import { buildShotPlanPurposeContext } from './purposes/shot-plan.js';
import { buildShotPurposeContext } from './purposes/shot.js';

export interface MediaGenerationPurposeBuildInput {
  session: DatabaseSession;
  projectFolder: string;
  screenplay: Screenplay;
  purpose: MediaPurpose;
  target: ReadMediaGenerationContextInput['target'];
  sceneStoryboardScope?: ReadMediaGenerationContextInput['sceneStoryboardScope'];
  warnings: DiagnosticIssue[];
}

export interface MediaGenerationPurposeBuildResult {
  targetContext: MediaGenerationTargetContext;
  visualLanguage: MediaGenerationLookbookContext[];
  suggestedReferences: MediaGenerationReferenceSuggestion[];
  resourceKeys: string[];
}

export type MediaGenerationPurposeBuilder = (
  input: MediaGenerationPurposeBuildInput,
) => MediaGenerationPurposeBuildResult;

export const MEDIA_GENERATION_PURPOSE_BUILDERS: Record<MediaPurpose, MediaGenerationPurposeBuilder> = {
  'image.create': buildShotPlanPurposeContext,
  'image.edit': buildAssetPurposeContext,
  'video.edit': buildAssetPurposeContext,
  'project.cover': buildProjectPurposeContext,
  'lookbook.image': buildLookbookPurposeContext,
  'lookbook.video-sheet': buildLookbookPurposeContext,
  'lookbook.storyboard-sheet': buildLookbookPurposeContext,
  'cast.character-sheet': buildCastPurposeContext,
  'cast.profile': buildCastPurposeContext,
  'cast.voice-sample': buildCastPurposeContext,
  'location.sheet': buildLocationPurposeContext,
  'location.hero': buildLocationPurposeContext,
  'prop.sheet': buildPropPurposeContext,
  'prop.hero': buildPropPurposeContext,
  'scene.storyboard-sheet': buildScenePurposeContext,
  'shot.image': buildShotPurposeContext,
  'shot-plan.video-generation': buildShotPlanPurposeContext,
  'shot-plan.video-first-frame': buildShotPlanPurposeContext,
  'shot-plan.video-last-frame': buildShotPlanPurposeContext,
  'shot-plan.video-storyboard': buildShotPlanPurposeContext,
  'shot-plan.video-reference': buildShotPlanPurposeContext,
  'shot-plan.dialogue-audio': buildShotPlanPurposeContext,
};

export function mediaGenerationOutputGuidance(
  purpose: MediaPurpose,
  projectAspectRatio: string,
): MediaGenerationOutputGuidance {
  const aspectRatio = purpose === 'project.cover'
    || purpose === 'cast.character-sheet'
    || purpose === 'location.sheet'
    || purpose === 'location.hero'
    || purpose === 'prop.sheet'
    || purpose === 'prop.hero'
      ? { value: '16:9', rationale: 'This purpose uses the established wide Studio presentation.' }
      : purpose === 'cast.profile'
        ? { value: '1:1', rationale: 'Cast Profiles use a square Studio presentation.' }
        : purpose === 'lookbook.video-sheet' || purpose === 'lookbook.storyboard-sheet'
          ? { value: '4:3', rationale: 'Lookbook Sheets use the established sheet presentation.' }
          : purpose === 'lookbook.image' || purpose === 'shot.image'
            ? { value: projectAspectRatio, rationale: 'Match the current Project aspect ratio.' }
            : null;
  const quality = purpose === 'project.cover'
    || purpose === 'lookbook.image'
    || purpose === 'cast.profile'
    || purpose === 'location.hero'
    || purpose === 'prop.hero'
      ? { value: 'medium' as const, rationale: 'Medium is the established purpose-level quality suggestion.' }
      : purpose === 'lookbook.video-sheet'
        || purpose === 'lookbook.storyboard-sheet'
        || purpose === 'cast.character-sheet'
        || purpose === 'location.sheet'
        || purpose === 'prop.sheet'
        || purpose === 'scene.storyboard-sheet'
        || purpose === 'shot.image'
          ? { value: 'high' as const, rationale: 'High is the established purpose-level quality suggestion.' }
          : null;
  return { aspectRatio, quality };
}
