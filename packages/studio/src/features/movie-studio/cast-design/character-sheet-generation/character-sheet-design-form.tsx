import { Textarea } from '@/ui/textarea';
import type {
  CharacterSheetGenerationOptions,
  CharacterSheetStyleId,
  CharacterSheetStyleOption,
  ReferenceImage,
} from '../cast-design-types';
import {
  characterSheetControlClassName,
  characterSheetSectionClassName,
  characterSheetSectionDescriptionClassName,
  characterSheetSectionHeadingClassName,
} from './character-sheet-generation-styles';
import { ReferenceImagePicker } from './reference-image-picker';
import { SheetStylePicker } from './sheet-style-picker';

interface CharacterSheetDesignFormProps {
  options: CharacterSheetGenerationOptions;
  referenceImages: ReferenceImage[];
  sheetStyles: CharacterSheetStyleOption[];
  onCharacterDescriptionChange: (description: string) => void;
  onSheetStyleChange: (style: CharacterSheetStyleId) => void;
}

export function CharacterSheetDesignForm({
  options,
  referenceImages,
  sheetStyles,
  onCharacterDescriptionChange,
  onSheetStyleChange,
}: CharacterSheetDesignFormProps) {
  return (
    <div className='mx-auto w-full max-w-[760px] space-y-5'>
      <section className={characterSheetSectionClassName}>
        <div className='mb-3'>
          <h4 className={characterSheetSectionHeadingClassName}>
            Character Description
          </h4>
          <p className={characterSheetSectionDescriptionClassName}>
            Optional visual notes to guide generation when references are sparse.
          </p>
        </div>
        <Textarea
          rows={4}
          value={options.characterDescription}
          onChange={(event) =>
            onCharacterDescriptionChange(event.currentTarget.value)
          }
          placeholder='Describe the character visually if there are no reference images.'
          className={`${characterSheetControlClassName} resize-none leading-relaxed`}
        />
      </section>

      <ReferenceImagePicker initialImages={referenceImages} />

      <SheetStylePicker
        styles={sheetStyles}
        value={options.sheetStyle}
        onValueChange={onSheetStyleChange}
      />
    </div>
  );
}
