import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import {
  createStudioBootstrapScript,
  createStudioRuntimeToken,
} from './server/studio-runtime-token';
import type { StudioRuntimeDescriptor } from '@gorenku/studio-core/server';

const expandPath = (input: string | null | undefined) => {
  if (!input) return null;
  const withHome = input.startsWith('~/')
    ? path.join(os.homedir(), input.slice(2))
    : input;
  return path.isAbsolute(withHome)
    ? withHome
    : path.resolve(process.cwd(), withHome);
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, process.cwd(), ''),
    ...loadEnv(mode, __dirname, ''),
  };
  const projectRoot = expandPath(
    env.RENKU_MOVIE_STUDIO_ROOT ?? process.env.RENKU_MOVIE_STUDIO_ROOT
  );
  const studioRuntimeToken = createStudioRuntimeToken();

  return {
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler']],
        },
      }),
      tailwindcss(),
      {
        name: 'renku-studio-api',
        apply: 'serve',
        async configureServer(server) {
          const { createStudioApiMiddleware } = await import('./server/app');
          const {
            STUDIO_RUNTIME_HEARTBEAT_INTERVAL_MS,
            claimStudioRuntimeDescriptor,
            createStudioCliNotificationToken,
            heartbeatStudioRuntimeDescriptor,
            releaseStudioRuntimeDescriptor,
          } = await import('@gorenku/studio-core/server');
          let descriptor: StudioRuntimeDescriptor | null = null;
          let heartbeat: ReturnType<typeof setInterval> | null = null;
          const cliNotificationToken = createStudioCliNotificationToken();

          server.httpServer?.once('listening', () => {
            const address = server.httpServer?.address();
            if (!address || typeof address === 'string') {
              return;
            }
            const host = resolveStudioDevHost(server.config.server.host);
            const port = (address as AddressInfo).port;
            const serverUrl = `http://${host}:${port}`;
            void claimStudioRuntimeDescriptor({
              host,
              port,
              serverUrl,
              cliNotificationToken,
            })
              .then((nextDescriptor) => {
                descriptor = nextDescriptor;
                heartbeat = setInterval(() => {
                  if (!descriptor) {
                    return;
                  }
                  void heartbeatStudioRuntimeDescriptor(descriptor).then(
                    (updatedDescriptor) => {
                      descriptor = updatedDescriptor;
                    }
                  );
                }, STUDIO_RUNTIME_HEARTBEAT_INTERVAL_MS);
              })
              .catch((error) => {
                server.config.logger.error(
                  error instanceof Error ? error.message : String(error)
                );
              });
          });

          server.httpServer?.once('close', () => {
            if (heartbeat) {
              clearInterval(heartbeat);
              heartbeat = null;
            }
            if (descriptor) {
              void releaseStudioRuntimeDescriptor(descriptor);
            }
          });

          server.middlewares.use(
            createStudioApiMiddleware({
              token: studioRuntimeToken,
              cliNotificationToken,
            })
          );
        },
        transformIndexHtml(html) {
          const script = createStudioBootstrapScript(studioRuntimeToken);
          return html.includes('</head>')
            ? html.replace('</head>', `${script}</head>`)
            : `${script}${html}`;
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      fs: {
        allow: [
          path.resolve(__dirname, '..'),
          ...(projectRoot && fs.existsSync(projectRoot) ? [projectRoot] : []),
        ],
      },
    },
  };
});

function resolveStudioDevHost(host: string | boolean | undefined): string {
  if (typeof host === 'string' && host !== '0.0.0.0') {
    return host;
  }
  return '127.0.0.1';
}
