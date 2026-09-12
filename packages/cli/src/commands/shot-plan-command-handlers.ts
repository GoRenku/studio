import { shotPlanClipCommandHandlers } from './shot-plan-clip-command-handlers.js';
import { shotPlanReferenceCommandHandlers } from './shot-plan-reference-command.js';
import { shotPlanPrevisCommandHandlers } from './shot-plan-previs-command-handlers.js';
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
  previsRevision?: string;
  clip?: string;
  take?: string;
  assetFile?: string;
  sourceTake?: string;
  title?: string;
  number?: string;
  source?: string;
  mediaKind?: string;
  summary?: string;
}

export type ShotPlanCommandRuntime = CliCommandRuntime;

export const shotPlanCommandHandlers: readonly CliCommandHandler<
  ShotPlanCommandFlags,
  ShotPlanCommandRuntime
>[] = [
  ...shotPlanPlanCommandHandlers,
  ...shotPlanPrevisCommandHandlers,
  ...shotPlanClipCommandHandlers,
  ...shotPlanReferenceCommandHandlers,
  ...shotPlanShotCommandHandlers,
  ...shotPlanImageCommandHandlers,
];
