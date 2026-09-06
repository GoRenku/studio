import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Asset } from '../../../client/index.js';
import type { RenkuConfigPathOptions } from '../../config/index.js';

export interface ImportScreenplaySupportingMaterialInput
  extends RenkuConfigPathOptions {
  projectName: string;
  sourcePath: string;
}

export interface ImportScreenplaySupportingMaterialReport {
  valid: true;
  warnings: DiagnosticIssue[];
  status: 'imported' | 'unchanged';
  project: {
    id: string;
    projectName: string;
    projectFolder: string;
  };
  material: Asset;
  resourceKeys: string[];
}
