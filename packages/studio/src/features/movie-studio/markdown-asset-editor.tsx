import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RichTextAssetLink } from '@gorenku/studio-core';
import {
  readMarkdownAssetContent,
  updateMarkdownAssetContent,
} from '@/services/studio-project-assets-api';
import type { ProjectWithHttp } from '@/services/studio-project-contracts';
import { useDebouncedAutosave } from '@/hooks/use-debounced-autosave';
import { AutosaveStatus } from '@/ui/autosave-status';
import { Textarea } from '@/ui/textarea';
import { cn } from '@/lib/utils';

const markdownAssetEditorControlClassName =
  'border-border/60 bg-background/35 transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25';

interface MarkdownAssetEditorProps {
  projectName: string;
  label: string;
  asset: RichTextAssetLink | undefined;
  initialContent: string;
  emptyMessage: string;
  minHeightClassName?: string;
  autosaveDelayMs?: number;
  onProjectChange: (project: ProjectWithHttp) => void;
}

export function MarkdownAssetEditor(props: MarkdownAssetEditorProps) {
  const assetKey = props.asset
    ? `${props.projectName}:${props.asset.assetId}:${props.asset.assetFileId}`
    : `${props.projectName}:missing`;

  return <MarkdownAssetEditorForm key={assetKey} {...props} />;
}

function MarkdownAssetEditorForm({
  projectName,
  label,
  asset,
  initialContent,
  emptyMessage,
  minHeightClassName,
  autosaveDelayMs,
  onProjectChange,
}: MarkdownAssetEditorProps) {
  const editorId = useId();
  const assetId = asset?.assetId;
  const assetFileId = asset?.assetFileId;
  const assetIdentity = useMemo(
    () =>
      assetId && assetFileId
        ? { assetId, assetFileId }
        : null,
    [assetFileId, assetId]
  );
  const [content, setContent] = useState(initialContent);
  const [loadState, setLoadState] = useState<
    | { state: 'missing'; message: string }
    | { state: 'loading'; message: string }
    | { state: 'ready'; message: null }
    | { state: 'error'; message: string }
  >(
    assetIdentity
      ? { state: 'loading', message: 'Loading' }
      : { state: 'missing', message: emptyMessage }
  );
  const contentRef = useRef(content);
  const initialContentRef = useRef(initialContent);
  const lastSavedContentRef = useRef(initialContent);
  const loadStateRef = useRef(loadState);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    loadStateRef.current = loadState;
  }, [loadState]);

  useEffect(() => {
    const previousInitialContent = initialContentRef.current;
    initialContentRef.current = initialContent;

    if (
      contentRef.current === lastSavedContentRef.current ||
      contentRef.current === previousInitialContent
    ) {
      lastSavedContentRef.current = initialContent;
      contentRef.current = initialContent;
      setContent(initialContent);
    }
  }, [initialContent]);

  useEffect(() => {
    let cancelled = false;
    const baselineContent = initialContentRef.current;
    lastSavedContentRef.current = baselineContent;
    contentRef.current = baselineContent;
    setContent(baselineContent);

    if (!assetIdentity) {
      setLoadState({ state: 'missing', message: emptyMessage });
      return;
    }

    setLoadState({ state: 'loading', message: 'Loading' });
    void readMarkdownAssetContent(projectName, assetIdentity)
      .then((result) => {
        if (cancelled) {
          return;
        }
        lastSavedContentRef.current = result.content;
        contentRef.current = result.content;
        setContent(result.content);
        setLoadState({ state: 'ready', message: null });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setLoadState({
          state: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Markdown asset content could not be loaded.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [assetIdentity, emptyMessage, projectName]);

  const save = useCallback(
    async (nextContent: string) => {
      if (!assetIdentity) {
        throw new Error('Markdown asset is not available.');
      }
      return await updateMarkdownAssetContent(
        projectName,
        assetIdentity,
        nextContent
      );
    },
    [assetIdentity, projectName]
  );

  const isAutosaveReady = useCallback(
    (nextContent: string) =>
      Boolean(assetIdentity) &&
      loadStateRef.current.state === 'ready' &&
      nextContent !== lastSavedContentRef.current,
    [assetIdentity]
  );

  const handleSaved = useCallback(
    (
      result: Awaited<ReturnType<typeof updateMarkdownAssetContent>>,
      savedContent: string
    ) => {
      lastSavedContentRef.current = result.content.content;
      if (contentRef.current === savedContent) {
        contentRef.current = result.content.content;
        setContent(result.content.content);
      }
      onProjectChange(result.project);
    },
    [onProjectChange]
  );

  const autosave = useDebouncedAutosave({
    value: content,
    delayMs: autosaveDelayMs,
    save,
    onSaved: handleSaved,
    isReady: isAutosaveReady,
  });

  const disabled =
    !assetIdentity ||
    loadState.state === 'loading' ||
    loadState.state === 'error';

  return (
    <section className='space-y-2 rounded-lg border border-border/45 bg-background/35 p-4 shadow-sm'>
      <div className='flex min-h-5 items-center justify-between gap-3'>
        <label
          htmlFor={editorId}
          className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'
        >
          {label}
        </label>
        {loadState.state === 'loading' ? (
          <span
            className='text-[10px] font-medium text-muted-foreground'
            role='status'
          >
            {loadState.message}
          </span>
        ) : (
          <AutosaveStatus status={autosave} className='shrink-0' />
        )}
      </div>
      <Textarea
        id={editorId}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={disabled}
        className={cn(
          'resize-y leading-relaxed',
          markdownAssetEditorControlClassName,
          minHeightClassName
        )}
      />
      {loadState.state === 'missing' || loadState.state === 'error' ? (
        <p
          className={
            loadState.state === 'error'
              ? 'text-xs font-medium text-destructive'
              : 'text-xs text-muted-foreground'
          }
          role={loadState.state === 'error' ? 'alert' : undefined}
        >
          {loadState.message}
        </p>
      ) : null}
    </section>
  );
}
