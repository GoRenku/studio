import type { RenkuCliIo } from '../../cli.js';
export interface RunAssetFileCommandOptions {
  input: string[];
  flags: AssetFileCommandFlags;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

export interface AssetFileCommandFlags {
  file?: string;
  source?: string;
  project?: string;
  owner?: string;
  target?: string;
  assetFile?: string;
  type?: string;
  mediaKind?: string;
  title?: string;
  summary?: string;
  referenceName?: string;
  tag?: string[];
  clearTags?: boolean;
  locale?: string;
  limit?: number;
  cursor?: string;
}

