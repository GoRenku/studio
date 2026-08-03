import type { Scene } from '../../../client/screenplay/index.js';

export function projectSceneNarrativeText(scene: Scene): string {
  const lines = [scene.heading];
  for (const block of scene.blocks) {
    if (block.type === 'dialogue') {
      lines.push(block.characterName, ...block.parts.map((part) => part.text));
    } else if (block.type === 'dualDialogue') {
      for (const turn of [block.left, block.right]) {
        lines.push(turn.characterName, ...turn.parts.map((part) => part.text));
      }
    } else {
      lines.push(block.text);
    }
  }
  return lines.join('\n\n');
}
