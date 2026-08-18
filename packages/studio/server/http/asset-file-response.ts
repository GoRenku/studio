import fs from 'node:fs';
import { Readable } from 'node:stream';
import type { AssetFile } from '@gorenku/studio-core/server';
import type { ProjectsRouteProjectData } from '../routes/projects.js';

export async function readProjectAssetFileByIdResponse(
  projectData: ProjectsRouteProjectData,
  input: {
    projectName: string;
    assetId: string;
    assetFileId: string;
  }
): Promise<Response> {
  const resolved = await projectData.resolveProjectAssetFileById(input);
  const contentLength = resolved.file.sizeBytes
    ?? (await fs.promises.stat(resolved.absolutePath)).size;
  const stream = fs.createReadStream(resolved.absolutePath);
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      'Content-Type': contentTypeForAssetFile(resolved.file),
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Length': String(contentLength),
    },
  });
}

function contentTypeForAssetFile(file: AssetFile): string {
  if (file.mimeType) {
    return file.mimeType;
  }
  if (file.mediaKind === 'image') {
    const path = file.projectRelativePath.toLowerCase();
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    if (path.endsWith('.webp')) {
      return 'image/webp';
    }
    if (path.endsWith('.gif')) {
      return 'image/gif';
    }
    return 'image/png';
  }
  if (file.mediaKind === 'audio') {
    return 'audio/mpeg';
  }
  if (file.mediaKind === 'video') {
    return 'video/mp4';
  }
  if (file.mediaKind === 'text') {
    return 'text/plain; charset=utf-8';
  }
  if (file.mediaKind === 'json') {
    return 'application/json';
  }
  return 'application/octet-stream';
}
