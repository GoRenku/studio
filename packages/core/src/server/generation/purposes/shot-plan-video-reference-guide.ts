import { createDiagnosticWarning } from '@gorenku/studio-diagnostics';
import type { BuildGenerationPurposeInput } from '../purpose-contract.js';
import {
  buildReferenceGuide,
  type GuideSlotDefinition,
} from '../purpose-guide.js';

export function buildShotPlanVideoReferenceGuide(input: {
  context: BuildGenerationPurposeInput;
  slots: GuideSlotDefinition[];
}) {
  const guide = buildReferenceGuide({
    context: input.context,
    slots: input.slots,
    notices: input.context.guideNotices,
  });
  guide.notices.push(
    ...guide.sections.flatMap((section) =>
      section.slots
        .filter((slot) => slot.eligibleCandidates.length === 0)
        .map((slot) =>
          createDiagnosticWarning(
            'CORE_GENERATION_OPTIONAL_REFERENCE_UNAVAILABLE',
            `${slot.label} has no available reference candidates.`,
            {
              path: [
                'referenceGuide',
                section.id,
                slot.id,
              ],
            },
            'Continue without this optional reference or create and attach a suitable candidate first.',
          )
        )
    ),
  );
  return guide;
}
