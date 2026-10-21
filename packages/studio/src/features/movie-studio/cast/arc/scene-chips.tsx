import type { CastMemberCharacterArcResourceResponse } from '@/services/studio-project-contracts';

/** "Sc 31" chips for scene ids; a run of scenes shows as "Sc 5–6". */
export function SceneChips({
  sceneIds,
  scenes,
  range = false,
}: {
  sceneIds: string[];
  scenes: CastMemberCharacterArcResourceResponse['scenes'];
  range?: boolean;
}) {
  const labels = sceneIds.map((sceneId) => sceneLabel(sceneId, scenes));
  const chips = range && labels.length > 1 ? [`${labels[0]}–${labels[labels.length - 1]}`] : labels;
  return (
    <span className='inline-flex flex-wrap gap-1'>
      {chips.map((label) => (
        <span key={label} className='whitespace-nowrap rounded-[5px] bg-muted px-1.5 py-0.5 text-[11px] font-bold text-foreground'>
          Sc {label}
        </span>
      ))}
    </span>
  );
}

function sceneLabel(sceneId: string, scenes: CastMemberCharacterArcResourceResponse['scenes']): string {
  const index = scenes.findIndex((scene) => scene.id === sceneId);
  if (index === -1) {
    return '?';
  }
  return scenes[index]!.productionNumber ?? String(index + 1);
}
