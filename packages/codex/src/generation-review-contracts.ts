import { createDiagnosticError, StructuredError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { GenerationReviewDraft, GenerationReviewRequest } from './client.js';
import type { NativeRequestControls } from './native-request-controls/contracts.js';
import { initialNativeRequestValues, nativeRequestControlIssues, nativeRequestControlList, nativeRequestValuesIssues } from './native-request-controls/validation.js';
import { reviewError } from './diagnostics.js';

function reviewIssue(path: Array<string | number>, message: string): DiagnosticIssue {
  return createDiagnosticError('CODEX_REVIEW_INVALID', message, { path: path.map(String) });
}

function assertNoReviewIssues(issues: DiagnosticIssue[], message: string): void {
  if (issues.length > 0) throw new StructuredError({ code: 'CODEX_REVIEW_INVALID', message, issues });
}

export function validateReviewControls(controls: NativeRequestControls): void {
  assertNoReviewIssues(nativeRequestControlIssues(controls, reviewIssue, ['controls']), 'The review controls are invalid.');
}

export function validateReviewDrafts(requests: GenerationReviewRequest[], drafts: GenerationReviewDraft[]): void {
  validateReviewDraftIdentities(requests, drafts);
  assertNoReviewIssues(requests.flatMap((request, index) => {
    const draft = drafts[index]!;
    return [
      ...(!request.preview.editable && draft.prompt !== request.preview.prompt ? [reviewIssue(['drafts', index, 'prompt'], 'This request does not allow prompt editing.')] : []),
      ...nativeRequestValuesIssues(request.controls, draft.values, reviewIssue, ['drafts', index, 'values']),
    ];
  }), 'The review drafts are invalid.');
}

export function validateReviewDraftIdentities(requests: GenerationReviewRequest[], drafts: GenerationReviewDraft[]): void {
  if (drafts.length !== requests.length || new Set(drafts.map((draft) => draft.requestId)).size !== drafts.length) {
    throw reviewError('CODEX_REVIEW_INVALID', 'Submit one draft for each declared request, in the review order.');
  }
  requests.forEach((request, index) => {
    const draft = drafts[index]!;
    if (draft.requestId !== request.requestId) throw reviewError('CODEX_REVIEW_INVALID', 'Draft request identities or order do not match the review.');
    const declared = nativeRequestControlList(request.controls);
    if (Object.keys(draft.values).some((key) => !declared.some((control) => control.key === key))) {
      throw reviewError('CODEX_REVIEW_INVALID', 'Only declared native controls may be submitted.');
    }
  });
}

export function initialReviewDraft(request: GenerationReviewRequest): GenerationReviewDraft {
  return { requestId: request.requestId, prompt: request.preview.prompt, values: initialNativeRequestValues(request.controls) };
}
