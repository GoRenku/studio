import fs from 'node:fs';
import { Readable } from 'node:stream';
import type {
  AssetFile,
  ResolvedProjectAssetFileById,
} from '@gorenku/studio-core/server';
import type { ProjectsRouteProjectData } from '../routes/projects.js';

export async function readProjectAssetFileByIdResponse(
  projectData: ProjectsRouteProjectData,
  input: {
    projectName: string;
    assetId: string;
    assetFileId: string;
  },
  request?: Request,
): Promise<Response> {
  const resolved = await projectData.resolveProjectAssetFileById(input);
  return projectAssetFileResponse(resolved, request);
}

export async function projectAssetFileResponse(
  resolved: ResolvedProjectAssetFileById,
  request?: Request,
): Promise<Response> {
  const contentLength = (await fs.promises.stat(resolved.absolutePath)).size;
  // Without a matching validator, If-Range requires the complete representation.
  const range = request?.method === 'GET' && !request.headers.has('If-Range') ? request.headers.get('Range') : null;
  const bounds = assetByteRange(range, contentLength);
  if (bounds === 'unsatisfiable') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${contentLength}`, 'Accept-Ranges': 'bytes' } });
  }
  const stream = fs.createReadStream(resolved.absolutePath, bounds ?? undefined);
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    status: bounds ? 206 : 200,
    headers: {
      'Content-Type': contentTypeForAssetFile(resolved.file),
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
      'Content-Length': String(bounds ? bounds.end - bounds.start + 1 : contentLength),
      ...(bounds ? { 'Content-Range': `bytes ${bounds.start}-${bounds.end}/${contentLength}` } : {}),
    },
  });
}

function assetByteRange(range: string | null | undefined, size: number): { start: number; end: number } | 'unsatisfiable' | null {
  // RFC 9110 permits ignoring unsupported units and multipart range requests.
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return null;
  const length = BigInt(size);
  const suffix = !match[1];
  const requestedEnd = match[2] ? BigInt(match[2]) : length - 1n;
  const start = suffix ? (requestedEnd > length ? 0n : length - requestedEnd) : BigInt(match[1]!);
  const end = suffix || requestedEnd >= length ? length - 1n : requestedEnd;
  if (start >= length || start > end || length === 0n) return 'unsatisfiable';
  return { start: Number(start), end: Number(end) };
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
