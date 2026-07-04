import type {
  ShotVideoTakeProductionEstimateReport,
} from '../../../client/index.js';
import type {
  PreviewShotVideoTakeProductionInput,
} from '../../project-data-service-contracts.js';
import {
  planShotVideoTakeProduction,
  shotVideoTakePlanReportContext,
} from '../shot-video-take/production-plan.js';

export async function estimateShotVideoTakeProduction(
  input: PreviewShotVideoTakeProductionInput
): Promise<ShotVideoTakeProductionEstimateReport> {
  const plan = await planShotVideoTakeProduction(input);
  const reportContext = await shotVideoTakePlanReportContext(input);
  return {
    target: reportContext.target,
    take: reportContext.take,
    inputModeId: plan.request.inputMode,
    shotGroupMode: plan.request.shotGroupMode,
    modelChoice: plan.request.modelChoice,
    estimate: plan.finalEstimate,
    plan,
    issues: plan.diagnostics,
  };
}
