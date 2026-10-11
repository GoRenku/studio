/**
 * The version the next edit starts from: the target's current selection for selectable images,
 * otherwise the newest version in the source's edit lineage (the source before any edit).
 */
export function imageEditBase(input: {
  selectable: boolean;
  selectedAssetFileId: string | null;
  lineageVersionIds: string[];
}): string | null {
  return input.selectable ? input.selectedAssetFileId : input.lineageVersionIds.at(-1) ?? null;
}
