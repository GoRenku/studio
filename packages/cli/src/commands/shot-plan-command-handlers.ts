import type { CliCommandHandler, CliCommandRuntime } from './structured-command.js';
import { shotPlanImageCommandHandlers } from './shot-plan-image-command-handlers.js';
import { shotPlanPlanCommandHandlers } from './shot-plan-plan-command-handlers.js';
import { shotPlanShotCommandHandlers } from './shot-plan-shot-command-handlers.js';

export interface ShotPlanCommandFlags {
  project?: string;
  file?: string;
  scene?: string;
  shotPlan?: string;
  shot?: string;
  asset?: string;
  position?: number;
  placement?: string;
}

export type ShotPlanCommandRuntime = CliCommandRuntime;

export const shotPlanCommandHandlers: readonly CliCommandHandler<
  ShotPlanCommandFlags,
  ShotPlanCommandRuntime
>[] = [
  ...shotPlanPlanCommandHandlers,
  ...shotPlanShotCommandHandlers,
  ...shotPlanImageCommandHandlers,
];
