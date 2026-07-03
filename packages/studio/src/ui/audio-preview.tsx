interface AudioPreviewProps {
  src: string;
  title: string;
  className?: string;
}

export function AudioPreview({ src, title, className }: AudioPreviewProps) {
  return (
    <audio
      className={className}
      controls
      preload='metadata'
      src={src}
      aria-label={title}
    />
  );
}
