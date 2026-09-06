import { useCallback, useEffect, useRef, useState } from 'react';
import { FileUploadArea } from '@/ui/file-upload-area';
import type { ProjectSupportingFile, ProjectSupportingFilePage } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { matchesProjectAssetsResource, useStudioResourceRefresh } from '@/hooks/use-studio-resource-refresh';
import { discardSupportingFile, readProjectSupportingFiles, uploadSupportingMaterial } from '@/services/supporting-files';
import { SupportingFileCards } from './supporting-file-cards';
import { SupportingFileInfoDialog } from './supporting-file-info-dialog';

export function SupportingFilesTab({ projectName }: { projectName: string }) {
  const [page, setPage] = useState<ProjectSupportingFilePage>({ items: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspected, setInspected] = useState<ProjectSupportingFile | null>(null);
  const request = useRef(0);
  const failedCursor = useRef<string | null>(null);
  const load = useCallback((cursor: string | null = null) => {
    const sequence = ++request.current;
    return readProjectSupportingFiles(projectName, cursor).then((next) => {
      if (sequence !== request.current) return;
      setError(null);
      setPage((previous) => ({
        items: cursor ? [...previous.items, ...next.items] : next.items,
        nextCursor: next.nextCursor,
      }));
    }).catch((failure: unknown) => {
      if (sequence !== request.current) return;
      failedCursor.current = cursor;
      setError(failure instanceof Error ? failure.message : 'Could not load supporting files.');
    }).finally(() => {
      if (sequence === request.current) setLoading(false);
    });
  }, [projectName]);
  const reload = (cursor: string | null = null) => {
    setLoading(true);
    setError(null);
    return load(cursor);
  };
  useEffect(() => {
    void load();
    return () => { request.current += 1; };
  }, [load]);
  useStudioResourceRefresh({ projectName, matches: matchesProjectAssetsResource, onRefresh: () => reload() });

  const remove = async (file: ProjectSupportingFile) => {
    await discardSupportingFile(projectName, file.asset.id);
    setPage((previous) => ({
      ...previous,
      items: previous.items.filter((item) => item.asset.id !== file.asset.id),
    }));
    void load();
  };
  const upload = async (files: File[]) => {
    try {
      await uploadSupportingMaterial(projectName, files);
    } finally {
      await load();
    }
  };

  return (
    <div className='flex h-full flex-col gap-4 overflow-y-auto bg-panel-bg px-4 py-5'>
      <div className='flex items-center justify-between border-b border-border/40 pb-4'>
        <h2 className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>Supporting Files</h2>
      </div>
      {loading && !page.items.length ? <p className='py-5 text-sm text-muted-foreground'>Loading supporting files…</p> : null}
      <FileUploadArea
        label='Supporting material drop target'
        title='Upload Supporting Material'
        onUpload={upload}
        className='min-h-64 flex-1 p-0'
        cardClassName='aspect-[13/8] h-auto min-h-0 rounded-lg border border-border/40 bg-panel-header-bg p-4'
      >
        {(uploadCard) => <SupportingFileCards projectName={projectName} files={page.items} onInspect={setInspected} onDelete={remove} uploadCard={uploadCard} />}
      </FileUploadArea>
      {error ? <div className='space-y-3'><p role='alert' className='text-sm text-destructive'>{error}</p><Button variant='outline' onClick={() => void reload(failedCursor.current)}>Retry</Button></div> : null}
      {page.nextCursor && !error ? <Button variant='outline' disabled={loading} onClick={() => void reload(page.nextCursor)}>{loading ? 'Loading…' : 'Load more'}</Button> : null}
      {inspected ? <SupportingFileInfoDialog key={inspected.asset.id} projectName={projectName} file={inspected} onClose={() => setInspected(null)} /> : null}
    </div>
  );
}
