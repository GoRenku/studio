import type { RenkuCliIo } from '../../cli.js';

export interface StudioCommandOptions {
  input: string[];
  project?: string;
  resource?: string[];
  json: boolean;
  noBrowser?: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}
