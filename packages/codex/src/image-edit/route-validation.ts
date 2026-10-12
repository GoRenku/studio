import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { panelControlIssues } from '../panel-sessions/panel-controls.js';
import type { ImageEditRoute } from './contracts.js';
import { imageEditIssue } from './diagnostics.js';

/** Consistency of a Skill-supplied Route Description, collected. Never reads provider or model ids. */
export function imageEditRouteIssues(route: ImageEditRoute): DiagnosticIssue[] {
  const modeIds = (route.regionModes ?? []).map((mode) => mode.id);
  return [
    ...(route.regionModes?.length === 0 ? [imageEditIssue(['route', 'regionModes'], 'List at least one region mode, or use null when the route takes no regions.')] : []),
    ...modeIds
      .filter((id, index) => modeIds.indexOf(id) !== index)
      .map((id) => imageEditIssue(['route', 'regionModes'], `Region mode ${id} is listed more than once.`)),
    ...panelControlIssues(route.controls, imageEditIssue, ['route', 'controls']),
  ];
}
