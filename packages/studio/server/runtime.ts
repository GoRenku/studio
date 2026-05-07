import { createReadStream, existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import path from 'node:path';
import { getRequestListener } from '@hono/node-server';
import { createStudioServerApp } from './app.js';
import {
  STUDIO_RUNTIME_HEARTBEAT_INTERVAL_MS,
  claimStudioRuntimeDescriptor,
  heartbeatStudioRuntimeDescriptor,
  releaseStudioRuntimeDescriptor,
  type StudioRuntimeDescriptor,
} from '@gorenku/studio-core/node';
import {
  createStudioBootstrapScript,
  createStudioRuntimeToken,
} from './studio-runtime-token.js';

export interface MovieStudioServerOptions {
  distPath: string;
  host?: string;
  port?: number;
  log?: (message: string) => void;
}

export interface MovieStudioServerInstance {
  url: string;
  host: string;
  port: number;
  stop(): Promise<void>;
}

export async function startMovieStudioServer(
  options: MovieStudioServerOptions
): Promise<MovieStudioServerInstance> {
  const host = options.host ?? '127.0.0.1';
  const distDir = path.resolve(options.distPath);
  const port = options.port ?? 0;
  const log = options.log ?? (() => {});
  const token = createStudioRuntimeToken();

  if (!existsSync(distDir)) {
    throw new Error(`Renku Studio assets not found at ${distDir}`);
  }

  let runtimeDescriptor: StudioRuntimeDescriptor | null = null;
  let heartbeat: NodeJS.Timeout | null = null;
  const apiHandler = getRequestListener(createStudioServerApp({ token }).fetch);

  const server = createServer(async (req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end('Missing URL');
      return;
    }

    if (req.url.startsWith('/studio-api')) {
      await apiHandler(req, res);
      return;
    }

    await serveStaticAsset(req, res, distDir, token);
  });

  return await new Promise<MovieStudioServerInstance>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine movie studio server address'));
        return;
      }
      const actualPort = address.port;
      const url = `http://${host}:${actualPort}`;
      void claimStudioRuntimeDescriptor({ host, port: actualPort, serverUrl: url })
        .then((descriptor) => {
          runtimeDescriptor = descriptor;
          heartbeat = setInterval(() => {
            if (runtimeDescriptor) {
              void heartbeatStudioRuntimeDescriptor(runtimeDescriptor).then((next) => {
                runtimeDescriptor = next;
              });
            }
          }, STUDIO_RUNTIME_HEARTBEAT_INTERVAL_MS);
          log(`Renku Studio server listening on ${url}`);
          resolve({
            url,
            host,
            port: actualPort,
            stop: () =>
              new Promise<void>((stopResolve, stopReject) => {
                if (heartbeat) {
                  clearInterval(heartbeat);
                  heartbeat = null;
                }
                server.close((error) => {
                  if (error) {
                    stopReject(error);
                    return;
                  }
                  if (runtimeDescriptor) {
                    void releaseStudioRuntimeDescriptor(runtimeDescriptor).finally(() => {
                      stopResolve();
                    });
                  } else {
                    stopResolve();
                  }
                });
              }),
          });
        })
        .catch((error) => {
          server.close();
          reject(error);
        });
    });
  });
}

async function serveStaticAsset(
  req: IncomingMessage,
  res: ServerResponse,
  distDir: string,
  token: ReturnType<typeof createStudioRuntimeToken>
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://studio.local');
  const method = req.method ?? 'GET';
  const originalPath = url.pathname === '/' ? '/index.html' : url.pathname;

  const safePath = sanitizePath(originalPath);
  const candidatePath = path.join(distDir, safePath);

  if (!candidatePath.startsWith(distDir)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  let targetPath = candidatePath;

  try {
    const stats = await fs.stat(targetPath);
    if (stats.isDirectory()) {
      targetPath = path.join(targetPath, 'index.html');
    }
  } catch {
    targetPath = path.join(distDir, 'index.html');
  }

  if (!existsSync(targetPath)) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  res.setHeader('Content-Type', getMimeType(targetPath));
  res.setHeader('Cache-Control', cacheControlForPath(targetPath, distDir));

  if (method === 'HEAD') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (path.extname(targetPath).toLowerCase() === '.html') {
    const html = await fs.readFile(targetPath, 'utf8');
    res.end(injectStudioBootstrap(html, token));
    return;
  }

  await streamFile(targetPath, res);
}

function injectStudioBootstrap(
  html: string,
  token: ReturnType<typeof createStudioRuntimeToken>
): string {
  const script = createStudioBootstrapScript(token);
  return html.includes('</head>')
    ? html.replace('</head>', `${script}</head>`)
    : `${script}${html}`;
}

function sanitizePath(requestPath: string): string {
  const decoded = decodeURIComponent(requestPath);
  const normalized = path.normalize(decoded);
  if (normalized.startsWith('..')) {
    return 'index.html';
  }
  return normalized.replace(/^[/\\]+/, '');
}

function cacheControlForPath(targetPath: string, distDir: string): string {
  const relative = path.relative(distDir, targetPath);
  if (relative.startsWith('assets/')) {
    return 'public, max-age=31536000, immutable';
  }
  return 'no-cache';
}

async function streamFile(
  filePath: string,
  res: ServerResponse
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('error', (error) => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      } else {
        res.end();
      }
      reject(error);
    });
    stream.on('end', resolve);
    stream.pipe(res);
  });
}

function getMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
  };
  return map[extension] ?? 'application/octet-stream';
}
