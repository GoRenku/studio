import { createDiagnosticWarning, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import {
  MEDIA_PURPOSE_OUTPUT_MEDIA_KINDS,
  MEDIA_PURPOSE_TARGET_KINDS,
} from '../../client/media-attachments.js';
import type {
  MediaGenerationContextReport,
  ReadMediaGenerationContextInput,
} from '../../client/media-generation-context.js';
import { readProjectRecord } from '../database/access/project.js';
import { readProjectSettingsFromSession } from '../project-settings/service.js';
import { resolveGenerationWorkflowPolicy } from '../project-settings/generation-policy.js';
import { ProjectDataError } from '../project-data-error.js';
import { withProject } from '../project-operation.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import {
  studioProjectInformationResourceKey,
  studioProjectSettingsResourceKey,
} from '../studio-coordination/resource-keys.js';
import { MEDIA_GENERATION_PURPOSE_BUILDERS, mediaGenerationOutputGuidance } from './purpose-registry.js';
import { projectMediaGenerationContext } from './project-context.js';

export async function readMediaGenerationContext(
  input: ReadMediaGenerationContextInput,
): Promise<MediaGenerationContextReport> {
  validateInput(input);
  return withProject(input, ({ session, projectFolder }) => {
    const projectRecord = readProjectRecord(session);
    if (!projectRecord) {
      throw new ProjectDataError('PROJECT_DATA021', `Project database has no project row: ${session.databasePath}.`);
    }
    const warnings: DiagnosticIssue[] = [];
    const project = projectMediaGenerationContext({
      session,
      projectName: projectRecord.projectName,
      projectId: projectRecord.id,
      projectFolder,
    });
    const outputMediaKind = MEDIA_PURPOSE_OUTPUT_MEDIA_KINDS[input.purpose];
    const purposeContext = MEDIA_GENERATION_PURPOSE_BUILDERS[input.purpose]({
      session,
      projectFolder,
      screenplay: readCanonicalScreenplay(session),
      purpose: input.purpose,
      target: input.target,
      sceneStoryboardScope: input.sceneStoryboardScope,
      warnings,
    });
    if (purposeExpectsVisualLanguage(input.purpose) && purposeContext.visualLanguage.length === 0) {
      warnings.push(createDiagnosticWarning(
        'CORE_MEDIA_GENERATION_CONTEXT_GAP',
        'No relevant Lookbook is currently available for this generation context.',
        { path: ['visualLanguage'] },
        'The context is still usable; author a Lookbook only when it is useful for the current request.',
      ));
    }
    return {
      valid: true,
      project,
      purpose: input.purpose,
      target: input.target,
      outputMediaKind,
      workflowPolicy: resolveGenerationWorkflowPolicy({
        settings: readProjectSettingsFromSession(session).settings,
        outputMediaKind,
      }),
      outputGuidance: mediaGenerationOutputGuidance(input.purpose, project.aspectRatio),
      ...purposeContext,
      warnings,
      resourceKeys: [...new Set([
        studioProjectInformationResourceKey(),
        studioProjectSettingsResourceKey(),
        ...purposeContext.resourceKeys,
      ])],
    };
  });
}

function validateInput(input: ReadMediaGenerationContextInput): void {
  const targetKind = MEDIA_PURPOSE_TARGET_KINDS[input.purpose];
  if (input.target.kind !== targetKind) {
    throw new ProjectDataError(
      'CORE_GENERATION_TARGET_INVALID',
      `${input.purpose} requires a ${targetKind} target, not ${input.target.kind}.`,
    );
  }
  if (input.target.kind === 'project' && input.target.id !== 'project') {
    throw new ProjectDataError(
      'CORE_GENERATION_TARGET_INVALID',
      `${input.purpose} requires the canonical project target.`,
    );
  }
  if (input.sceneStoryboardScope && input.purpose !== 'scene.storyboard-sheet') {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_CONTEXT_SCOPE_INVALID',
      'Scene Storyboard revision and Beat scope is only valid for scene.storyboard-sheet.',
    );
  }
}

function purposeExpectsVisualLanguage(purpose: ReadMediaGenerationContextInput['purpose']): boolean {
  return purpose !== 'image.edit'
    && purpose !== 'video.edit'
    && purpose !== 'cast.voice-sample'
    && purpose !== 'scene.dialogue-audio';
}
