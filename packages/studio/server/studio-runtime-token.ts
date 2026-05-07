import crypto from 'node:crypto';

export interface StudioRuntimeToken {
  value: string;
}

export function createStudioRuntimeToken(): StudioRuntimeToken {
  return {
    value: crypto.randomBytes(32).toString('base64url'),
  };
}

export function createStudioBootstrapScript(token: StudioRuntimeToken): string {
  return `<script>window.__RENKU_STUDIO_BOOTSTRAP__=${JSON.stringify({
    studioApiToken: token.value,
  })};</script>`;
}
