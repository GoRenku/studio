import type { GenerationPreviewAuthoringStrategy } from './types.js';
import { ProjectDataError } from '../../project-data-error.js';

export const noneAuthoringStrategy: GenerationPreviewAuthoringStrategy = {
  async project() {
    return { kind: 'none' };
  },
  async update() {
    throw new ProjectDataError(
      'CORE_GENERATION_PREVIEW_AUTHORING_UNAVAILABLE',
      'This generation output kind does not expose managed Preview authoring.',
    );
  },
};
