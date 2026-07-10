import type { MediaGenerationPurpose } from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';

export function requireLiveProviderApproval(input: {
  mode: 'simulated' | 'live';
  approveLiveProviderRun?: boolean;
  specId: string;
  purpose: MediaGenerationPurpose;
}): void {
  if (input.mode === 'simulated') {
    return;
  }
  if (!input.approveLiveProviderRun) {
    throw new ProjectDataError(
      'CORE_MEDIA_LIVE_PROVIDER_APPROVAL_REQUIRED',
      `Live media generation requires explicit provider-run approval for ${input.purpose}.`,
      {
        suggestion:
          'Review the current generation estimate and preview, then run again with explicit live provider approval if you intend to contact the provider.',
      }
    );
  }
}
