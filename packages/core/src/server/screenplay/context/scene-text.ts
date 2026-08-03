import type { DialogueTurn, Scene, Screenplay } from '../../../client/screenplay/index.js';

export function renderScreenplaySceneContextText(input: {
  scene: Scene;
  screenplay: Screenplay;
}): string {
  const parts = [input.scene.heading];
  for (const block of input.scene.blocks) {
    if (block.type === 'dialogue') {
      parts.push(renderDialogueTurn(block));
    } else if (block.type === 'dualDialogue') {
      parts.push(renderDialogueTurn(block.left), renderDialogueTurn(block.right));
    } else {
      parts.push(block.text);
    }
  }
  return parts.filter((part) => part.length > 0).join('\n\n');
}

function renderDialogueTurn(turn: DialogueTurn): string {
  const attribution = turn.extensions.length > 0
    ? `${turn.characterName} (${turn.extensions.join(', ')})`
    : turn.characterName;
  return [
    attribution,
    ...turn.parts.map((part) => part.type === 'parenthetical' ? `(${part.text})` : part.text),
  ].join('\n');
}
