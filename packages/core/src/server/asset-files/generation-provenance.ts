import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import { eq } from 'drizzle-orm';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import { assetFiles } from '../schema/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { parseMediaGenerationProvenance } from '../media-generation-review/document.js';
import {
  assertSafeMediaGenerationReceipt,
  assertSafeMediaGenerationRequest,
} from '../media-generation-review/safety.js';

export function validateMediaGenerationProvenance(
  value: unknown,
): MediaGenerationProvenance {
  const provenance = parseMediaGenerationProvenance(value);
  assertSafeMediaGenerationRequest(provenance.request, 'provenance');
  if (provenance.receipt !== undefined) {
    assertSafeMediaGenerationReceipt(provenance.receipt);
  }
  return provenance;
}

export function setAssetFileGenerationProvenance(
  session: DatabaseSession,
  input: {
    assetFileId: string;
    generationProvenance: MediaGenerationProvenance | null;
    authoredFromShotPlanId?: string | null;
  },
): void {
  const existing = readAssetFileRecordIncludingDiscarded(session, input.assetFileId);
  if (!existing) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PROVENANCE_INVALID',
      `Asset was not found: ${input.assetFileId}.`,
    );
  }
  if (existing.generationProvenance !== null
    && input.generationProvenance !== null
    && JSON.stringify(existing.generationProvenance) !== JSON.stringify(input.generationProvenance)) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PROVENANCE_CONFLICT',
      'Asset already has different generation provenance.',
    );
  }
  session.db
    .update(assetFiles)
    .set({
      generationProvenance: input.generationProvenance,
      ...(input.authoredFromShotPlanId === undefined
        ? {}
        : { authoredFromShotPlanId: input.authoredFromShotPlanId }),
    })
    .where(eq(assetFiles.id, input.assetFileId))
    .run();
}
