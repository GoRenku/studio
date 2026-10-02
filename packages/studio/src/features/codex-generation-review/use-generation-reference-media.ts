import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { GenerationReviewReference } from '@gorenku/studio-codex/client';
import type { CodexApp } from '@/services/codex-app';

export function useGenerationReferenceMedia(bridge: CodexApp, reference: GenerationReviewReference, container: RefObject<HTMLDivElement | null>) {
  const resources = useRef(new Map<string, string>());
  const pending = useRef(new Map<string, Promise<string>>());
  const disposed = useRef(false);
  const scope = useMemo(() => ({ bridge, container, available: reference.available, kind: reference.kind, resourceUri: reference.resourceUri, thumbnailUri: reference.thumbnailUri }), [bridge, container, reference.available, reference.kind, reference.resourceUri, reference.thumbnailUri]);
  const [media, setMedia] = useState<{ scope: object; browserUrl?: string; loading: boolean; error?: string }>({ scope, loading: false });

  const load = useCallback((uri: string) => {
    if (disposed.current) return Promise.reject(new Error('The reference is no longer visible.'));
    const existing = resources.current.get(uri);
    if (existing) return Promise.resolve(existing);
    const loading = pending.current.get(uri);
    if (loading) return loading;
    const request = readMediaResource(bridge, uri).then((blob) => {
      if (disposed.current) throw new Error('The reference is no longer visible.');
      const url = URL.createObjectURL(blob);
      resources.current.set(uri, url);
      return url;
    }).finally(() => { pending.current.delete(uri); });
    pending.current.set(uri, request);
    return request;
  }, [bridge]);

  useEffect(() => {
    disposed.current = false;
    let active = true;
    const displayResourceUri = reference.kind === 'audio' ? reference.resourceUri : reference.thumbnailUri;
    const failureMessage = reference.kind === 'audio' ? 'Reference audio could not be loaded.' : 'Reference thumbnail could not be loaded.';
    const urls = resources.current;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || !displayResourceUri || !reference.available) return;
      observer.disconnect();
      setMedia({ scope, loading: true });
      void referenceMediaQueue.run(() => load(displayResourceUri)).then((browserUrl) => { if (active) setMedia({ scope, browserUrl, loading: false }); }).catch((failure) => { if (active) setMedia({ scope, loading: false, error: failure instanceof StructuredError ? failure.message : failureMessage }); });
    });
    if (container.current) observer.observe(container.current);
    return () => {
      disposed.current = true;
      active = false;
      observer.disconnect();
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, [container, load, reference.available, reference.kind, reference.resourceUri, reference.thumbnailUri, scope]);

  const visibleMedia = media.scope === scope ? media : { loading: false, browserUrl: undefined, error: undefined };
  return { error: visibleMedia.error, loading: visibleMedia.loading, source: { browserUrl: visibleMedia.browserUrl, loadPreview: () => { setMedia((current) => current.scope === scope ? { ...current, error: undefined } : { scope, loading: false }); return load(reference.resourceUri); } } };
}

async function readMediaResource(bridge: CodexApp, uri: string): Promise<Blob> {
  let result;
  try {
    result = await bridge.app.readServerResource({ uri });
  } catch (failure) {
    const code = failure !== null && typeof failure === 'object' && 'code' in failure && typeof failure.code === 'number' ? failure.code : undefined;
    throw new StructuredError({ code: 'CODEX_REFERENCE_READ_FAILED', message: `The host could not read this reference${code === undefined ? '.' : ` (MCP ${code}).`}` });
  }
  const content = result.contents.find((content) => content.uri === uri);
  if (!content || !('blob' in content) || !content.mimeType) throw new StructuredError({ code: 'CODEX_REFERENCE_BYTES_MISSING', message: 'The host returned a reference without its media bytes.' });
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = Uint8Array.from(atob(content.blob), (character) => character.charCodeAt(0));
  } catch {
    throw new StructuredError({ code: 'CODEX_REFERENCE_BYTES_INVALID', message: 'The host returned invalid reference bytes.' });
  }
  return new Blob([bytes], { type: content.mimeType });
}

class ReferenceMediaQueue {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= 3) await new Promise<void>((resolve) => this.waiting.push(resolve));
    else this.active += 1;
    try { return await operation(); }
    finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active -= 1;
    }
  }
}

const referenceMediaQueue = new ReferenceMediaQueue();
