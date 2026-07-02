interface VideoPreviewProps {
  src: string;
  title: string;
  className?: string;
}

export function VideoPreview({ src, title, className }: VideoPreviewProps) {
  return (
    <video
      src={src}
      title={title}
      muted
      playsInline
      preload='metadata'
      className={className}
    />
  );
}
