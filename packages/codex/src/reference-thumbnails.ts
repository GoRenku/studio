import sharp from 'sharp';

export async function createReferenceThumbnail(absolutePath: string): Promise<Buffer> {
  return sharp(absolutePath, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer();
}
