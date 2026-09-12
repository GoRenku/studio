import { useEffect, useState } from 'react';
import type { StudioShotPlanClips } from '@/services/shot-plan-previs/contracts';

export function useClipDurations(report?: StudioShotPlanClips) {
  const [measured, setMeasured] = useState<Record<string, number | null>>({});
  const urls = JSON.stringify([...new Set([...(report?.assets ?? []), ...(report?.unassignedAssets ?? [])]
    .flatMap((asset) => asset.files.filter((file) => file.mediaKind === 'video').map((file) => file.url)))]);
  useEffect(() => {
    let active = true;
    const videos = (JSON.parse(urls) as string[]).map((url) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const save = (value: number | null) => { if (active) setMeasured((current) => ({ ...current, [url]: value })); };
      video.onloadedmetadata = () => save(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null);
      video.onerror = () => save(null);
      video.src = url;
      return video;
    });
    return () => { active = false; videos.forEach((video) => { video.onloadedmetadata = null; video.onerror = null; video.removeAttribute('src'); video.load(); }); };
  }, [urls]);
  return measured;
}
