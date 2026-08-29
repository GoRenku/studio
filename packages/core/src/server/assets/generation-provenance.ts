import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import { eq } from 'drizzle-orm';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readAssetRecord } from '../database/access/assets.js';
import { assets } from '../schema/index.js';
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

export function setAssetGenerationProvenance(
  session: DatabaseSession,
  input: {
    assetId: string;
    generationProvenance: MediaGenerationProvenance | null;
    authoredFromShotPlanId?: string | null;
  },
): void {
  const existing = readAssetRecord(session, input.assetId);
  if (!existing) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PROVENANCE_INVALID',
      `Asset was not found: ${input.assetId}.`,
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
    .update(assets)
    .set({
      generationProvenance: input.generationProvenance,
      ...(input.authoredFromShotPlanId === undefined
        ? {}
        : { authoredFromShotPlanId: input.authoredFromShotPlanId }),
    })
    .where(eq(assets.id, input.assetId))
    .run();
}
