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
import {
  STUDIO_DEV_SERVER_HOST,
  STUDIO_DEV_SERVER_PORT,
  STUDIO_DEV_SERVER_URL,
  type StudioRuntimeDescriptor,
} from '@gorenku/studio-core/server';
import {
  appendStudioDevServerLog,
  claimRequiredStudioDevRuntime,
  STUDIO_E2E_SERVER_HOST,
  STUDIO_E2E_SERVER_PORT,
  STUDIO_E2E_SERVER_URL,
} from './server/studio-dev-server';

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
  const isStudioE2eServer = env.RENKU_STUDIO_E2E_SERVER_ENABLED === '1';
  const studioE2eIsolatedHomeDirectory = isStudioE2eServer
    ? env.RENKU_STUDIO_E2E_ISOLATED_HOME_DIR ??
      process.env.RENKU_STUDIO_E2E_ISOLATED_HOME_DIR
    : undefined;
  if (isStudioE2eServer && !studioE2eIsolatedHomeDirectory) {
    throw new Error(
      'RENKU_STUDIO_E2E_ISOLATED_HOME_DIR is required for the E2E Studio runtime.'
    );
  }
  const studioServerHost = isStudioE2eServer
    ? STUDIO_E2E_SERVER_HOST
    : STUDIO_DEV_SERVER_HOST;
  const studioServerPort = isStudioE2eServer
    ? STUDIO_E2E_SERVER_PORT
    : STUDIO_DEV_SERVER_PORT;
  const studioServerUrl = isStudioE2eServer
    ? STUDIO_E2E_SERVER_URL
    : STUDIO_DEV_SERVER_URL;
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
          void appendStudioDevServerLog(
            `starting Studio dev server url=${studioServerUrl} pid=${process.pid}`
          );

          server.httpServer?.once('listening', () => {
            const address = server.httpServer?.address();
            if (!address || typeof address === 'string') {
              return;
            }
            const port = (address as AddressInfo).port;
            void appendStudioDevServerLog(
              `listening Studio dev server url=${studioServerUrl} actualPort=${port} pid=${process.pid}`
            );
            const runtimeDescriptorClaim = isStudioE2eServer
              ? claimStudioRuntimeDescriptor({
                  homeDir: studioE2eIsolatedHomeDirectory,
                  host: studioServerHost,
                  port,
                  serverUrl: studioServerUrl,
                  cliNotificationToken,
                })
              : claimRequiredStudioDevRuntime({
                  port,
                  cliNotificationToken,
                  claimRuntimeDescriptor: claimStudioRuntimeDescriptor,
                  closeServer: async () => {
                    await server.close();
                  },
                });
            void runtimeDescriptorClaim
              .then((nextDescriptor) => {
                descriptor = nextDescriptor;
                heartbeat = setInterval(() => {
                  if (!descriptor) {
                    return;
                  }
                  void heartbeatStudioRuntimeDescriptor(descriptor, {
                    homeDir: studioE2eIsolatedHomeDirectory,
                  })
                    .then((updatedDescriptor) => {
                      descriptor = updatedDescriptor;
                    })
                    .catch((error) => {
                      const message =
                        error instanceof Error ? error.message : String(error);
                      server.config.logger.error(message);
                      void appendStudioDevServerLog(
                        `runtime descriptor heartbeat failed: ${message}`
                      );
                    });
                }, STUDIO_RUNTIME_HEARTBEAT_INTERVAL_MS);
              })
              .catch((error) => {
                server.config.logger.error(
                  error instanceof Error ? error.message : String(error)
                );
                process.exitCode = 1;
              });
          });

          server.httpServer?.once('close', () => {
            if (heartbeat) {
              clearInterval(heartbeat);
              heartbeat = null;
            }
            if (descriptor) {
              void releaseStudioRuntimeDescriptor(descriptor, {
                homeDir: studioE2eIsolatedHomeDirectory,
              }).catch((error) => {
                const message =
                  error instanceof Error ? error.message : String(error);
                server.config.logger.error(message);
                void appendStudioDevServerLog(
                  `runtime descriptor release failed: ${message}`
                );
              });
            }
            void appendStudioDevServerLog(
              `closed Studio dev server url=${studioServerUrl} pid=${process.pid}`
            );
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
      host: studioServerHost,
      port: studioServerPort,
      strictPort: true,
      fs: {
        allow: [
          path.resolve(__dirname, '..'),
          ...(projectRoot && fs.existsSync(projectRoot) ? [projectRoot] : []),
        ],
      },
    },
  };
});
