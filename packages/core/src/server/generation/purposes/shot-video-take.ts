import { defineGenerationPurpose, noSettings } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
import { takeContinuitySlots } from '../reference-slots/take-media.js';

export const shotVideoTakePurpose = defineGenerationPurpose({
  purpose: 'shot.video-take',
  targetKind: 'sceneShotVideoTake',
  outputMediaKind: 'video',
  modelUse: 'any',
  settings: noSettings,
  async buildReferenceGuide(context) {
    return buildReferenceGuide({
      context,
      slots: takeContinuitySlots({
        context,
        includeOwnedMediaAndDialogue: true,
      }),
    });
  },
});
