// The `video_played` name is the media file's base name, without the build hash
// Vite adds (`/assets/harbor-generation.Bx3kQ9aZ.mp4` → `harbor-generation`).
export function analyticsVideoName(src: string): string {
  const fileName = src.split('/').pop()?.split('?')[0] ?? '';
  return fileName.replace(/\.[^.]+$/, '').replace(/\.[\w-]{8}$/, '');
}
