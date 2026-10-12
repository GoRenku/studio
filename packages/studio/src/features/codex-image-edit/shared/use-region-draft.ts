import { useState } from 'react';
import type { ImageEditRegion, ImageEditRegionBox } from '@gorenku/studio-codex/image-edit';

/** The user's regions for this panel: numbered in creation order, with one selected region. New regions use the route's first mode. */
export function useRegionDraft(defaultMode: string) {
  const [regions, setRegions] = useState<ImageEditRegion[]>([]);
  const [nextNumber, setNextNumber] = useState(1);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [focusNumber, setFocusNumber] = useState<number | null>(null);

  const update = (number: number, change: Partial<ImageEditRegion>) => setRegions((current) => current.map((region) => region.number === number ? { ...region, ...change } : region));

  return {
    regions,
    nextNumber,
    selectedNumber,
    focusNumber,
    select: setSelectedNumber,
    create: (box: ImageEditRegionBox) => {
      const number = nextNumber;
      setRegions((current) => [...current, { number, mode: defaultMode, box, instruction: '' }]);
      setNextNumber(number + 1);
      setSelectedNumber(number);
      setFocusNumber(number);
    },
    move: (number: number, box: ImageEditRegionBox) => update(number, { box }),
    setMode: (number: number, mode: string) => update(number, { mode }),
    setInstruction: (number: number, instruction: string) => update(number, { instruction }),
    remove: (number: number) => {
      setRegions((current) => current.filter((region) => region.number !== number));
      setSelectedNumber((current) => current === number ? null : current);
    },
    clear: () => {
      setRegions([]);
      setSelectedNumber(null);
    },
  };
}
