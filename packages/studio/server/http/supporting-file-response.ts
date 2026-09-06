import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ProjectSupportingFileInformation } from '@gorenku/studio-core/server';

const previewTypes: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.csv': 'text/plain; charset=utf-8', '.json': 'text/plain; charset=utf-8',
  '.xml': 'text/plain; charset=utf-8', '.fdx': 'text/plain; charset=utf-8',
  '.html': 'text/plain; charset=utf-8', '.svg': 'text/plain; charset=utf-8',
};

function supportingFilePreviewType(absolutePath: string): string | null {
  return previewTypes[path.extname(absolutePath).toLowerCase()] ?? null;
}

export async function supportingFileResponse(
  information: ProjectSupportingFileInformation,
  download: boolean,
): Promise<Response> {
  const previewType = supportingFilePreviewType(information.absolutePath);
  const disposition = download || !previewType ? 'attachment' : 'inline';
  const filename = encodeURIComponent(path.basename(information.absolutePath))
    .replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  const stat = await fs.promises.stat(information.absolutePath);
  return new Response(Readable.toWeb(fs.createReadStream(information.absolutePath)) as ReadableStream<Uint8Array>, {
    headers: {
      'Content-Type': download ? 'application/octet-stream' : previewType ?? 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename*=UTF-8''${filename}`,
      'Content-Length': String(stat.size),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    },
  });
}

