import type { Scene, ScreenplayDocument } from '../client/screenplay.js';

export function renderScreenplaySceneContextText(input: {
  scene: Scene;
  screenplay: ScreenplayDocument;
}): string {
  const parts = [sceneHeading(input.scene)];
  for (const block of input.scene.blocks) {
    if (block.type === 'dialogue') {
      const speaker = input.screenplay.cast.find(
        (member) => member.id === block.castMemberId
      )?.name ?? block.castMemberId ?? 'Dialogue';
      const attribution = block.extension
        ? `${speaker} (${block.extension})`
        : speaker;
      parts.push([
        attribution,
        ...(block.parenthetical ? [block.parenthetical] : []),
        ...block.lines,
      ].join('\n'));
      continue;
    }
    parts.push(block.text);
  }
  return parts.filter((part) => part.length > 0).join('\n\n');
}

function sceneHeading(scene: Scene): string {
  return [
    scene.setting.interiorExterior,
    scene.title,
    scene.setting.timeOfDay,
  ].filter((part): part is string => Boolean(part?.length)).join(' — ');
}
