import { useStudioResourceRefresh } from '@/hooks/use-studio-resource-refresh';
import { useEffect, useRef, useState } from 'react';
import type { FdxUpdateReview, FdxUpdateStatus } from '@gorenku/studio-core/client';
import { isStudioApiErrorCode } from '@/services/studio-api-errors';
import { applyFdxUpdate, openFdxExportFolder, readFdxUpdateStatus, reviewFdxUpdate } from '@/services/screenplay/fdx-updates';

export function useFdxUpdate(projectName: string, projectId: string) {
  const [status, setStatus] = useState<FdxUpdateStatus | null>(null);
  const [folderActionLabel, setFolderActionLabel] = useState('Open containing folder');
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<FdxUpdateReview | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState(projectId);
  if (owner !== projectId) {
    setOwner(projectId);
    setStatus(null); setReview(null); setOpen(false); setStale(false); setBusy(false); setError(null);
  }
  const actions = useRef({ check: () => {}, show: () => {}, dismiss: () => {}, reviewLatest: () => {}, apply: () => {}, openFolder: () => {} });

  useStudioResourceRefresh({ projectName, matches: () => true, onRefresh: () => actions.current.check() });

  useEffect(() => {
    const controller = new AbortController();
    const sessionKey = `renku.fdx-update.dismissed:${projectId}`;
    let dismissed = sessionStorage.getItem(sessionKey);
    let currentStatus: FdxUpdateStatus | null = null;
    let currentReview: FdxUpdateReview | null = null;
    let reviewedBaseline: string | null = null;
    let dialogOpen = false;
    let invalidated = false;
    let working = false;
    let polling = false;
    let checkAgain = false;
    let reviewSequence = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      invalidated = true;
      setStale(true);
    };
    const loadReview = async () => {
      if (currentStatus?.state !== 'pending' || working) return;
      const hash = currentStatus.sourceSha256;
      const baseline = currentStatus.acceptedSourceSha256;
      const sequence = ++reviewSequence;
      working = true; setBusy(true); setError(null); setReview(null); setStale(false); currentReview = null;
      try {
        const next = await reviewFdxUpdate(projectName, hash, controller.signal);
        if (controller.signal.aborted || sequence !== reviewSequence) return;
        currentReview = next; reviewedBaseline = baseline;
        invalidated = currentStatus?.state !== 'pending' || currentStatus.sourceSha256 !== hash
          || currentStatus.acceptedSourceSha256 !== baseline;
        setReview(next); setStale(invalidated);
      } catch (failure) {
        if (!controller.signal.aborted) {
          if (isStudioApiErrorCode(failure, 'SCREENPLAY_FDX_SOURCE_CHANGED')) { closeReview(); void check(); }
          else { setError(message(failure)); }
        }
      } finally {
        working = false;
        if (!controller.signal.aborted) setBusy(false);
      }
    };
    const show = () => {
      if (dialogOpen || document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]')) return;
      dialogOpen = true; setOpen(true); setError(null);
      void loadReview();
    };
    const autoOpen = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()
        && currentStatus?.state === 'pending' && currentStatus.sourceSha256 !== dismissed) show();
    };
    const check = async () => {
      if (controller.signal.aborted || document.visibilityState !== 'visible') return;
      if (polling) { checkAgain = true; return; }
      clearTimeout(timer); polling = true;
      try {
        const response = await readFdxUpdateStatus(projectName, controller.signal);
        if (controller.signal.aborted) return;
        currentStatus = response.status;
        setStatus(currentStatus); setFolderActionLabel(response.folderActionLabel);
        if (currentReview && (currentStatus.state !== 'pending'
          || currentStatus.sourceSha256 !== currentReview.sourceSha256
          || currentStatus.acceptedSourceSha256 !== reviewedBaseline)) invalidate();
        // A hash alone cannot reveal changed production impact or revision state.
        // Compare a fresh Core fingerprint without replacing the displayed review.
        if (dialogOpen && currentReview && !invalidated && !working && currentStatus.state === 'pending') {
          const displayed = currentReview;
          try {
            const verified = await reviewFdxUpdate(projectName, currentStatus.sourceSha256, controller.signal);
            if (!controller.signal.aborted && currentReview === displayed && verified.reviewFingerprint !== displayed.reviewFingerprint) invalidate();
          } catch (failure) {
            if (!controller.signal.aborted && currentReview === displayed) { invalidate(); setError(message(failure)); }
          }
        }
        autoOpen();
      } catch (failure) {
        if (!controller.signal.aborted) {
          if (currentReview) invalidate();
          setError(message(failure));
        }
      } finally {
        polling = false;
        if (!controller.signal.aborted && document.visibilityState === 'visible') {
          timer = setTimeout(() => void check(), checkAgain ? 0 : 3000);
          checkAgain = false;
        }
      }
    };
    const closeReview = () => {
      dialogOpen = false; setOpen(false); currentReview = null; setReview(null); ++reviewSequence;
    };
    const dismiss = () => {
      dismissed = currentReview?.sourceSha256 ?? (currentStatus?.state === 'pending' ? currentStatus.sourceSha256 : null);
      if (dismissed) sessionStorage.setItem(sessionKey, dismissed);
      closeReview();
    };
    const apply = async () => {
      if (!currentReview || invalidated || working) return;
      working = true; setBusy(true); setError(null);
      try {
        const report = await applyFdxUpdate(projectName, currentReview.reviewFingerprint);
        if (controller.signal.aborted) return;
        if (report.resourceKeys.length) window.dispatchEvent(new CustomEvent('renku:studio-resource-changed', {
          detail: { projectName, resourceKeys: report.resourceKeys },
        }));
        dismiss();
      } catch (failure) {
        if (!controller.signal.aborted) { invalidate(); setError(message(failure)); }
      } finally {
        working = false;
        if (!controller.signal.aborted) { setBusy(false); void check(); }
      }
    };
    const openFolder = async () => {
      try { await openFdxExportFolder(projectName); }
      catch (failure) { if (!controller.signal.aborted) setError(message(failure)); }
    };
    actions.current = { check: () => void check(), show, dismiss, reviewLatest: () => void loadReview(), apply: () => void apply(), openFolder: () => void openFolder() };
    const onVisibility = () => { clearTimeout(timer); if (document.visibilityState === 'visible') void check(); };
    const onFocus = () => { autoOpen(); void check(); };
    const observer = new MutationObserver(autoOpen);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    void check();
    return () => {
      controller.abort(); clearTimeout(timer); observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, [projectName, projectId]);

  return { status, folderActionLabel, open, review, stale, busy, error,
    check: () => actions.current.check(), show: () => actions.current.show(), dismiss: () => actions.current.dismiss(),
    reviewLatest: () => actions.current.reviewLatest(), apply: () => actions.current.apply(), openFolder: () => actions.current.openFolder(),
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to check the external screenplay.';
}
