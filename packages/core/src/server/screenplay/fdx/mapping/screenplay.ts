import type { Scene, Screenplay } from '../../../../client/screenplay/index.js';
import { ProjectDataError } from '../../../project-data-error.js';
import type {
  ScreenplayImportCandidates,
  ScreenplayImportLogEntry,
} from '../contracts.js';
import { FdxIdentityFactory } from '../identifiers.js';
import type { FdxSyntaxDocument } from '../parser/types.js';
import {
  mapFdxOrphanDialogueParagraph,
  mapFdxTextParagraph,
} from './blocks.js';
import { FdxCandidateCollector } from './candidates.js';
import {
  dialogueBlockAsTurn,
  dialogueTurnAsBlock,
  mapFdxDialogueTurn,
  mapFdxDualDialogue,
} from './dialogue.js';
import { invalidFdxAt, invalidFdxParagraph } from './errors.js';
import { FdxStructureMapper } from './sections.js';

export interface MappedFdxScreenplay {
  screenplay: Screenplay;
  candidates: ScreenplayImportCandidates;
  technicalLog: ScreenplayImportLogEntry[];
  counts: {
    scenes: number;
    acts: number;
    sequences: number;
    blocks: number;
    dialogueTurns: number;
    productionSceneNumbers: number;
  };
}

export function mapFdxScreenplay(
  syntax: FdxSyntaxDocument,
  sourceSha256: string,
): MappedFdxScreenplay {
  const identities = new FdxIdentityFactory(sourceSha256);
  const screenplay: Screenplay = {
    opening: [],
    scenes: [],
    sections: [],
    structure: [],
    references: [],
  };
  const technicalLog: ScreenplayImportLogEntry[] = [];
  const productionNumbers = new Set<string>();
  const candidates = new FdxCandidateCollector(syntax.tagsByNumber);
  const structure = new FdxStructureMapper(
    identities,
    screenplay.sections,
    screenplay.structure,
  );
  let activeScene: Scene | null = null;

  for (let cursor = 0; cursor < syntax.content.length; cursor += 1) {
    const element = syntax.content[cursor];
    if (element.kind === 'dualDialogue') {
      if (!activeScene) {
        throw invalidFdxAt(
          element.path,
          'Dual Dialogue before the first Scene Heading',
        );
      }
      const dual = mapFdxDualDialogue(element, identities);
      activeScene.blocks.push(dual);
      candidates.addDialogueTurn(dual.left);
      candidates.addDialogueTurn(dual.right);
      candidates.addDialogueTags(
        element.paragraphs,
        [dual.left, dual.right],
        activeScene.id,
      );
      continue;
    }

    const paragraph = element;
    if (paragraph.type === 'New Act' || paragraph.type === 'Sequence') {
      structure.addSection(paragraph, paragraph.type === 'New Act' ? 'act' : 'sequence');
      continue;
    }
    if (paragraph.type === 'End of Act') {
      structure.endAct(paragraph);
      continue;
    }
    if (paragraph.type === 'Scene Heading') {
      activeScene = mapScene(paragraph, identities, productionNumbers);
      screenplay.scenes.push(activeScene);
      structure.addScene(activeScene, paragraph);
      candidates.addTaggedTarget(paragraph.tagNumbers, {
        type: 'sceneHeading',
        sceneId: activeScene.id,
      });
      continue;
    }
    if (paragraph.type === 'Character') {
      if (!activeScene) {
        throw invalidFdxParagraph(paragraph, 'Dialogue before the first Scene Heading');
      }
      const { turn, nextCursor } = mapFdxDialogueTurn(
        syntax.content,
        cursor,
        identities,
      );
      const dialogueParagraphs = syntax.content
        .slice(cursor, nextCursor + 1)
        .filter((item): item is typeof paragraph => item.kind === 'paragraph');
      cursor = nextCursor;
      candidates.addDialogueTurn(turn);
      candidates.addDialogueTags(dialogueParagraphs, [turn], activeScene.id);
      if (paragraph.dualDialogue) {
        const left = activeScene.blocks.at(-1);
        if (!left || left.type !== 'dialogue') {
          throw invalidFdxParagraph(
            paragraph,
            'DualDialogue Character has no preceding Dialogue turn',
          );
        }
        activeScene.blocks.pop();
        activeScene.blocks.push({
          id: identities.id('screenplay_block', `${paragraph.path}/dualDialogue`),
          type: 'dualDialogue',
          left: dialogueBlockAsTurn(left),
          right: turn,
        });
      } else {
        activeScene.blocks.push(dialogueTurnAsBlock(turn));
      }
      continue;
    }
    if (paragraph.type === 'Dialogue') {
      if (paragraph.text.trim() === '') {
        continue;
      }
      if (!activeScene) {
        throw invalidFdxParagraph(paragraph, 'Dialogue before the first Scene Heading');
      }
      const block = mapFdxOrphanDialogueParagraph(
        paragraph,
        identities,
        technicalLog,
      );
      activeScene.blocks.push(block);
      candidates.addTaggedTarget(paragraph.tagNumbers, {
        type: 'block',
        sceneId: activeScene.id,
        blockId: block.id,
      });
      continue;
    }
    if (paragraph.type === 'Parenthetical') {
      if (paragraph.text.trim() === '') {
        continue;
      }
      throw invalidFdxParagraph(paragraph, 'Orphan Parenthetical');
    }
    if (paragraph.type === 'ScriptNote' || paragraph.type === 'Script Note') {
      continue;
    }

    const block = mapFdxTextParagraph(paragraph, identities, technicalLog);
    if (block) {
      if (activeScene) {
        activeScene.blocks.push(block);
        candidates.addTaggedTarget(paragraph.tagNumbers, {
          type: 'block',
          sceneId: activeScene.id,
          blockId: block.id,
        });
      } else {
        screenplay.opening.push(block);
        candidates.addTaggedTarget(paragraph.tagNumbers, {
          type: 'openingElement',
          elementId: block.id,
        });
      }
    }
  }

  if (screenplay.scenes.length === 0) {
    throw new ProjectDataError(
      'SCREENPLAY_FDX_UNSUPPORTED_VISIBLE_CONTENT',
      'Supported FDX screenplay content must contain at least one Scene Heading.',
    );
  }

  const allBlocks = screenplay.scenes.flatMap((scene) => scene.blocks);
  return {
    screenplay,
    candidates: candidates.result(screenplay.scenes),
    technicalLog,
    counts: {
      scenes: screenplay.scenes.length,
      acts: screenplay.sections.filter((section) => section.type === 'act').length,
      sequences: screenplay.sections.filter((section) => section.type === 'sequence').length,
      blocks: screenplay.opening.length + allBlocks.length,
      dialogueTurns: allBlocks.reduce(
        (total, block) => total + (block.type === 'dualDialogue' ? 2 : block.type === 'dialogue' ? 1 : 0),
        0,
      ),
      productionSceneNumbers: productionNumbers.size,
    },
  };
}

function mapScene(
  paragraph: Extract<FdxSyntaxDocument['content'][number], { kind: 'paragraph' }>,
  identities: FdxIdentityFactory,
  productionNumbers: Set<string>,
): Scene {
  const heading = paragraph.text.trim();
  if (!heading) {
    throw invalidFdxParagraph(paragraph, 'Scene Heading is empty');
  }
  if (paragraph.productionNumber) {
    if (productionNumbers.has(paragraph.productionNumber)) {
      throw new ProjectDataError(
        'SCREENPLAY_FDX_DUPLICATE_SCENE_NUMBER',
        `Duplicate FDX Scene Number at ${paragraph.path}: ${paragraph.productionNumber}.`,
      );
    }
    productionNumbers.add(paragraph.productionNumber);
  }
  return {
    id: identities.id('scene', `${paragraph.path}/scene`),
    ...(paragraph.productionNumber
      ? { productionNumber: paragraph.productionNumber }
      : {}),
    heading,
    blocks: [],
  };
}
