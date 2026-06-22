import type {
  LookbookSection,
  MovieLookbookDefinition,
} from '../../client/index.js';
import type {
  LookbookImagePlacement,
} from '../database/access/lookbook-images.js';
import type { LookbookRecord } from '../database/access/lookbook.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  assertLookbookSectionsForType,
  parseStoredLookbookDefinition,
} from './validator.js';

export function resolveLookbookImagePlacements(input: {
  lookbook: LookbookRecord;
  sections: string[];
  anchorPointId?: string;
}): LookbookImagePlacement[] {
  const sections = assertLookbookSectionsForType(
    input.lookbook.type,
    input.sections
  );
  const anchorPointId = input.anchorPointId;
  if (!anchorPointId) {
    return sections.map((section) => ({ section, pointId: null }));
  }
  const [section] = sections;
  if (!section || sections.length !== 1) {
    throw new ProjectDataError(
      'PROJECT_DATA296',
      'Anchoring a Lookbook image to a point requires exactly one --sections value.'
    );
  }
  const matches = lookbookAnchorPoints(input.lookbook).filter(
    (point) => point.id === anchorPointId
  );
  if (matches.length === 0) {
    throw new ProjectDataError(
      'PROJECT_DATA391',
      `Lookbook image anchor point was not found: ${anchorPointId}.`,
      {
        suggestion:
          'Use an id from the selected Lookbook section pattern or observation.',
      }
    );
  }
  if (matches.length > 1) {
    throw new ProjectDataError(
      'PROJECT_DATA392',
      `Lookbook image anchor point is ambiguous: ${anchorPointId}.`,
      {
        suggestion:
          'Use a Lookbook point id that appears exactly once in the Lookbook definition.',
      }
    );
  }
  const [match] = matches;
  if (match.section !== section) {
    throw new ProjectDataError(
      'PROJECT_DATA393',
      `Lookbook image anchor point ${anchorPointId} belongs to ${match.section}, not ${section}.`,
      {
        suggestion:
          'Use the section that owns the anchor point, or use a point id from the selected section.',
      }
    );
  }
  return [{ section, pointId: anchorPointId }];
}

interface LookbookAnchorPoint {
  id: string;
  section: LookbookSection;
}

function lookbookAnchorPoints(lookbook: LookbookRecord): LookbookAnchorPoint[] {
  if (lookbook.type !== 'movie') {
    parseStoredLookbookDefinition({
      type: lookbook.type,
      value: lookbook.definitionJson,
    });
    return [];
  }
  const definition = parseStoredLookbookDefinition({
    type: lookbook.type,
    value: lookbook.definitionJson,
  });
  return movieLookbookAnchorPoints(definition);
}

function movieLookbookAnchorPoints(
  definition: MovieLookbookDefinition
): LookbookAnchorPoint[] {
  const points: LookbookAnchorPoint[] = [];
  appendAnchorPoints(points, 'palette', definition.palette.observations);
  appendAnchorPoints(points, 'composition', definition.composition.patterns);
  appendAnchorPoints(points, 'lighting', definition.lighting.patterns);
  appendAnchorPoints(points, 'texture', definition.texture.observations);
  appendAnchorPoints(points, 'camera', definition.camera.movement);
  appendAnchorPoints(points, 'camera', definition.camera.motion);
  appendAnchorPoints(points, 'camera', definition.camera.framing);
  return points;
}

function appendAnchorPoints(
  points: LookbookAnchorPoint[],
  section: LookbookSection,
  candidates: { id?: string }[]
): void {
  for (const candidate of candidates) {
    if (candidate.id) {
      points.push({ id: candidate.id, section });
    }
  }
}
