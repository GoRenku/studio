import type { ProviderLogger, SecretResolver } from '../../types.js';

export type WorldLabsImageExtension = 'jpg' | 'jpeg' | 'png' | 'webp';

export interface WorldLabsLocationWorldImage {
  fileName: string;
  extension: WorldLabsImageExtension;
  mimeType: string;
  bytes: Uint8Array;
}

export type WorldLabsLocationWorldSource =
  | {
      kind: 'panorama';
      image: WorldLabsLocationWorldImage;
    }
  | {
      kind: 'multiImage';
      images: WorldLabsLocationWorldImage[];
    };

export interface GenerateWorldLabsLocationWorldInput {
  displayName: string;
  prompt?: string;
  source: WorldLabsLocationWorldSource;
  secretResolver?: SecretResolver;
  logger?: ProviderLogger;
  signal?: AbortSignal;
  fetch?: typeof fetch;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

export interface WorldLabsLocationWorldResult {
  operationId: string;
  worldId: string;
  body: ReadableStream<Uint8Array>;
  contentLength: number | null;
  mediaKind: 'model';
  mimeType: 'application/octet-stream';
  extension: 'spz';
}

export interface WorldLabsPreparedUpload {
  mediaAssetId: string;
  uploadUrl: string;
  uploadMethod: string;
  requiredHeaders: Record<string, string>;
}

export interface WorldLabsCompletedWorld {
  worldId: string;
  fullResolutionSpzUrl: string;
}
