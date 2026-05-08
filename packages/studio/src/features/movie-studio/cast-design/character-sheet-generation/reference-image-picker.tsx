import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/ui/button';
import type { ReferenceImage } from '../cast-design-types';
import {
  characterSheetInteractiveTileClassName,
  characterSheetSectionClassName,
  characterSheetSectionDescriptionClassName,
  characterSheetSectionHeadingClassName,
} from './character-sheet-generation-styles';
import { ReferenceImageUploadDialog } from './reference-image-upload-dialog';

interface ReferenceImagePickerProps {
  initialImages: ReferenceImage[];
}

export function ReferenceImagePicker({
  initialImages,
}: ReferenceImagePickerProps) {
  const objectUrlsRef = useRef(new Set<string>());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [referenceImages, setReferenceImages] =
    useState<ReferenceImage[]>(initialImages);

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    return () => {
      for (const objectUrl of objectUrls) {
        URL.revokeObjectURL(objectUrl);
      }
      objectUrls.clear();
    };
  }, []);

  const addUploadedImages = (files: File[]) => {
    setReferenceImages((currentImages) => [
      ...currentImages,
      ...files.map((file, index) => {
        const imageUrl = URL.createObjectURL(file);
        objectUrlsRef.current.add(imageUrl);

        return {
          id: `reference-${Date.now()}-${index}`,
          imageUrl,
          label: file.name,
          localObjectUrl: true,
        };
      }),
    ]);
  };

  const removeReferenceImage = (imageId: string) => {
    setReferenceImages((currentImages) => {
      const imageToRemove = currentImages.find((image) => image.id === imageId);
      if (imageToRemove?.localObjectUrl) {
        URL.revokeObjectURL(imageToRemove.imageUrl);
        objectUrlsRef.current.delete(imageToRemove.imageUrl);
      }

      return currentImages.filter((image) => image.id !== imageId);
    });
  };

  return (
    <section className={characterSheetSectionClassName}>
      <div className='mb-3'>
        <h4 className={characterSheetSectionHeadingClassName}>
          Reference Images
        </h4>
        <p className={characterSheetSectionDescriptionClassName}>
          Add visual references for identity, costume, pose, or facial detail.
        </p>
      </div>

      <div className='grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-3'>
        {referenceImages.map((image) => (
          <div
            key={image.id}
            className='relative aspect-square overflow-hidden rounded-md border border-border/45 bg-background/50'
          >
            <img
              src={image.imageUrl}
              alt={image.label}
              className='h-full w-full object-contain'
            />
            <Button
              type='button'
              variant='secondary'
              size='icon'
              className='absolute right-1.5 top-1.5 h-7 w-7 shadow-md'
              onClick={() => removeReferenceImage(image.id)}
              aria-label={`Remove ${image.label}`}
            >
              <Trash2 className='h-3.5 w-3.5' />
            </Button>
          </div>
        ))}
        <Button
          type='button'
          onClick={() => setUploadOpen(true)}
          variant='ghost'
          className={`flex h-auto aspect-square flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/60 bg-background/25 text-xs font-medium text-muted-foreground transition ${characterSheetInteractiveTileClassName}`}
        >
          <ImagePlus className='h-5 w-5' />
          Add More
        </Button>
      </div>

      <ReferenceImageUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onConfirm={addUploadedImages}
      />
    </section>
  );
}
