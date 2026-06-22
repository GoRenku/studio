import type { DatabaseSession } from './database/lifecycle/store.js';
import {
  countLookbookImagePlacementSlotImages,
  deleteOtherLookbookImagePlacementSlotRecords,
  type LookbookImagePlacement,
} from './database/access/lookbook-images.js';
import { ProjectDataError } from './project-data-error.js';

const LookbookImageMultiSlotLimit = 10;

export function assertLookbookImagePlacementCapacity(
  session: DatabaseSession,
  input: {
    lookbookId: string;
    imageId?: string;
    placements: LookbookImagePlacement[];
  }
): void {
  for (const placement of input.placements) {
    if (isSingleImageLookbookPlacement(placement)) {
      continue;
    }
    const count = countLookbookImagePlacementSlotImages(session, {
      lookbookId: input.lookbookId,
      placement,
      excludeImageId: input.imageId,
    });
    if (count >= LookbookImageMultiSlotLimit) {
      throw new ProjectDataError(
        'PROJECT_DATA394',
        `Lookbook image placement slot is full: ${formatPlacementSlot(placement)}.`,
        {
          suggestion: `Move or discard an existing image before adding another one. This slot allows up to ${LookbookImageMultiSlotLimit} images.`,
        }
      );
    }
  }
}

export function replaceSingleLookbookImagePlacementSlots(
  session: DatabaseSession,
  input: {
    lookbookId: string;
    imageId: string;
    placements: LookbookImagePlacement[];
    now: string;
  }
): void {
  const placements = input.placements.filter(isSingleImageLookbookPlacement);
  if (placements.length === 0) {
    return;
  }
  deleteOtherLookbookImagePlacementSlotRecords(session, {
    lookbookId: input.lookbookId,
    imageId: input.imageId,
    placements,
    now: input.now,
  });
}

function isSingleImageLookbookPlacement(
  placement: LookbookImagePlacement
): boolean {
  return placement.pointId === null && placement.section === 'thesis';
}

function formatPlacementSlot(placement: LookbookImagePlacement): string {
  if (placement.pointId) {
    return `${placement.section}:${placement.pointId}`;
  }
  return placement.section;
}
