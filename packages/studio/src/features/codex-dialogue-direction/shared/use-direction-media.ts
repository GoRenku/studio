import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readCodexAppMediaBlob, type CodexApp } from '@/services/codex-app';

export interface DirectionMediaLibrary {
  load: (uri: string) => Promise<string>;
}

/** Reads `renku-direction://` media blobs once per URI and revokes their object URLs on unmount. */
export function useDirectionMediaLibrary(bridge: CodexApp | undefined): DirectionMediaLibrary {
  const urls = useRef(new Map<string, Promise<string>>());
  const created = useRef<string[]>([]);
  const disposed = useRef(false);

  useEffect(() => {
    disposed.current = false;
    const objectUrls = created.current;
    const requests = urls.current;
    return () => {
      disposed.current = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.length = 0;
      requests.clear();
    };
  }, []);

  const load = useCallback((uri: string) => {
    if (!bridge) return Promise.reject(new Error('The host connection is not ready.'));
    const existing = urls.current.get(uri);
    if (existing) return existing;
    const request = readCodexAppMediaBlob(bridge, uri).then((blob) => {
      const url = URL.createObjectURL(blob);
      if (disposed.current) {
        URL.revokeObjectURL(url);
        throw new Error('The dialogue direction panel closed.');
      }
      created.current.push(url);
      return url;
    });
    request.catch(() => { urls.current.delete(uri); });
    urls.current.set(uri, request);
    return request;
  }, [bridge]);

  return useMemo(() => ({ load }), [load]);
}

/** Projects one media URI to its object URL, loading it when the URI is present. */
export function useDirectionMediaUrl(media: DirectionMediaLibrary, uri: string | null): { url?: string; failed: boolean } {
  const [loaded, setLoaded] = useState<{ uri: string; url?: string; failed: boolean }>();
  useEffect(() => {
    if (!uri) return;
    let active = true;
    media.load(uri).then(
      (url) => { if (active) setLoaded({ uri, url, failed: false }); },
      () => { if (active) setLoaded({ uri, failed: true }); },
    );
    return () => { active = false; };
  }, [media, uri]);
  return loaded && loaded.uri === uri ? { url: loaded.url, failed: loaded.failed } : { failed: false };
}
