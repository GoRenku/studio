import type {
  ImageEditConsumeInput,
  ImageEditConsumeResult,
  ImageEditGenerateReceipt,
  ImageEditReportInput,
  ImageEditSession,
} from './contracts.js';
import { imageEditError } from './diagnostics.js';
import { validateImageEditDraft } from './draft-validation.js';
import { projectImageEditSession, readImageEditLineageFor, readImageEditStyleReferences, readImageEditTargetsFor } from './session-projection.js';
import type { ImageEditState } from './session-state.js';

export async function generateImageEdit(
  state: ImageEditState,
  input: { sessionId: string; draft: unknown },
  homeDir?: string,
): Promise<ImageEditGenerateReceipt> {
  const record = state.record(input.sessionId);
  const current = await projectImageEditSession(record, homeDir);
  if (!current.editBaseAssetFileId) {
    throw imageEditError('CODEX_IMAGE_EDIT_INVALID', 'There is no selected image to edit.', 'Select an image in Studio, then generate again.');
  }
  const draft = validateImageEditDraft(input.draft, {
    route: record.route,
    editBaseAssetFileId: current.editBaseAssetFileId,
    styleReferenceAssetFileIds: current.styleReferences.map((reference) => reference.assetFileId),
  });
  await readImageEditTargetsFor(record.projectRef, [...new Set([draft.baseAssetFileId, ...(draft.styleReferenceAssetFileId ? [draft.styleReferenceAssetFileId] : [])])], homeDir);
  const action = state.startAction(input.sessionId, draft, { baseAssetFileId: draft.baseAssetFileId });
  if (!record.versionSourceAssetFileIds.includes(draft.baseAssetFileId) && current.versions.some((version) => version.assetFileId === draft.baseAssetFileId && version.parentAssetFileId === null)) {
    state.update(input.sessionId, (parts) => { parts.versionSourceAssetFileIds.push(draft.baseAssetFileId); });
  }
  return {
    sessionId: input.sessionId,
    actionId: action.actionId,
    session: await projectImageEditSession(state.record(input.sessionId), homeDir),
  };
}

/** Returns the draft once, with the base and style reference re-read from Core so the agent never sees panel-only ids. */
export async function consumeImageEditAction(state: ImageEditState, input: ImageEditConsumeInput, homeDir?: string): Promise<ImageEditConsumeResult> {
  const draft = state.consume(input.sessionId, input.actionId);
  if (!draft) return { status: 'alreadyConsumed', sessionId: input.sessionId, actionId: input.actionId };
  const record = state.record(input.sessionId);
  try {
    const style = draft.styleReferenceAssetFileId === null ? null
      : (await readImageEditStyleReferences(record.projectRef, homeDir)).find((reference) => reference.assetFileId === draft.styleReferenceAssetFileId);
    if (draft.styleReferenceAssetFileId !== null && !style) {
      throw imageEditError('CODEX_IMAGE_EDIT_INVALID', 'The selected style reference is no longer available.', 'Choose an available Lookbook sheet or clear the style reference, then generate again.');
    }
    const targets = await readImageEditTargetsFor(record.projectRef, [...new Set([draft.baseAssetFileId, ...(style ? [style.assetFileId] : [])])], homeDir);
    const base = targets[0]!;
    const styleTarget = targets.find((target) => target.assetFile.id === style?.assetFileId);
    return {
      status: 'consumed',
      sessionId: input.sessionId,
      actionId: input.actionId,
      project: record.projectRef.name,
      provider: record.route.provider,
      model: record.route.model,
      base: { assetFileId: base.assetFile.id, projectRelativePath: base.assetFile.projectRelativePath },
      styleReference: style ? { assetFileId: styleTarget!.assetFile.id, projectRelativePath: styleTarget!.assetFile.projectRelativePath, name: style.name } : null,
      draft,
    };
  } catch (error) {
    state.failAction(input.sessionId, input.actionId, error instanceof Error ? error.message : 'The image edit dependencies could not be read.');
    throw error;
  }
}

export async function reportImageEditAction(state: ImageEditState, input: ImageEditReportInput, homeDir?: string): Promise<ImageEditSession> {
  const action = state.runningAction(input.sessionId, input.actionId);
  if (input.outcome.status === 'failed') {
    state.failAction(input.sessionId, input.actionId, input.outcome.message);
    return projectImageEditSession(state.record(input.sessionId), homeDir);
  }
  const { assetFileId } = input.outcome;
  const record = state.record(input.sessionId);
  const lineage = await readImageEditLineageFor(record.projectRef, action.baseAssetFileId, homeDir);
  const result = lineage.find((entry) => entry.target.assetFile.id === assetFileId);
  if (!result || result.parentAssetFileId !== action.baseAssetFileId) {
    throw imageEditError('CODEX_IMAGE_EDIT_INVALID', `Asset File ${assetFileId} is not an edit of the action's base image ${action.baseAssetFileId}.`, 'Import the edit with renku media import --purpose image.edit --target assetFile:<base id> before reporting it attached.');
  }
  state.completeAction(input.sessionId, input.actionId, { actionId: input.actionId, assetFileId });
  return projectImageEditSession(state.record(input.sessionId), homeDir);
}
