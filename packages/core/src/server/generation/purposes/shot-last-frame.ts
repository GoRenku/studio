import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
import { takeContinuitySlots } from '../reference-slots/take-media.js';

export const shotLastFramePurpose = defineGenerationPurpose({
  purpose: 'shot.last-frame',
  targetKind: 'sceneShotVideoTake',
  outputMediaKind: 'image',
  modelUse: 'any',
  settings: {
    fixed: [],
    recommended: [{ kind: 'aspect-ratio', value: 'project' }],
  },
  async buildReferenceGuide(context) {
    return buildReferenceGuide({
      context,
      slots: takeContinuitySlots({ context, includeOwnedMediaAndDialogue: false }),
    });
  },
});
