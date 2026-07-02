import { useEffect, useRef } from 'react';

interface VideoPreviewProps {
  src: string;
  title: string;
  className?: string;
  active?: boolean;
}

export function VideoPreview({
  src,
  title,
  className,
  active = false,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (!active) {
      if (!video.paused) {
        video.pause();
      }
      resetPreviewFrame(video);
      return;
    }
    const play = video.play();
    if (play) {
      void play.catch(() => {
        resetPreviewFrame(video);
      });
    }
  }, [active]);

  return (
    <video
      ref={videoRef}
      src={src}
      title={title}
      muted
      playsInline
      preload={active ? 'auto' : 'metadata'}
      className={className}
    />
  );
}

function resetPreviewFrame(video: HTMLVideoElement): void {
  try {
    video.currentTime = 0;
  } catch {
    // Some browsers disallow currentTime changes before metadata is available.
  }
}
