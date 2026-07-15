import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
import { takeContinuitySlots } from '../reference-slots/take-media.js';

export const shotVideoPromptPurpose = defineGenerationPurpose({
  purpose: 'shot.video-prompt',
  targetKind: 'sceneShotVideoTake',
  outputMediaKind: 'image',
  modelUse: 'any',
  settings: {
    fixed: [],
    recommended: [{ kind: 'aspect-ratio', value: '16:9' }],
    recommendedModel: { provider: 'fal-ai', model: 'openai/gpt-image-2' },
  },
  async buildReferenceGuide(context) {
    return buildReferenceGuide({
      context,
      slots: takeContinuitySlots({ context, includeOwnedMediaAndDialogue: false }),
    });
  },
});
