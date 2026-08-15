import type { TextBlock, TextBlockType } from '../../../../client/screenplay/index.js';
import type { ScreenplayImportLogEntry } from '../contracts.js';
import type { FdxIdentityFactory } from '../identifiers.js';
import type { FdxParagraph } from '../parser/types.js';
import { invalidFdxParagraph } from './errors.js';

const TEXT_TYPES = new Map<string, TextBlockType>([
  ['Action', 'action'],
  ['Transition', 'transition'],
  ['Shot', 'shot'],
  ['Lyrics', 'lyrics'],
  ['Cast List', 'castList'],
  ['Special Heading', 'specialHeading'],
  ['Title', 'titleCard'],
  ['Title Card', 'titleCard'],
  ['Super', 'super'],
]);

const OPENING_TRANSITIONS = new Set(['FADE IN:', 'FADE OUT:', 'FADE TO:']);

export function mapFdxTextParagraph(
  paragraph: FdxParagraph,
  identities: FdxIdentityFactory,
  technicalLog: ScreenplayImportLogEntry[],
): TextBlock | null {
  if (paragraph.text.trim() === '') {
    return null;
  }
  let type = TEXT_TYPES.get(paragraph.type);
  if (paragraph.type === 'General') {
    type = OPENING_TRANSITIONS.has(paragraph.text.trim().toUpperCase())
      ? 'transition'
      : 'action';
    technicalLog.push({
      type: 'paragraphNormalization',
      sourceParagraphIndex: paragraph.index,
      sourceParagraphType: 'General',
      targetBlockType: type,
    });
  }
  if (!type) {
    throw invalidFdxParagraph(paragraph, `unknown paragraph type ${paragraph.type}`);
  }
  return {
    id: identities.id('screenplay_block', `${paragraph.path}/block`),
    type,
    text: paragraph.text,
  };
}

export function mapFdxOrphanDialogueParagraph(
  paragraph: FdxParagraph,
  identities: FdxIdentityFactory,
  technicalLog: ScreenplayImportLogEntry[],
): TextBlock {
  technicalLog.push({
    type: 'orphanDialogueNormalization',
    sourceParagraphIndex: paragraph.index,
    sourceParagraphType: 'Dialogue',
    targetBlockType: 'action',
  });
  return {
    id: identities.id('screenplay_block', `${paragraph.path}/block`),
    type: 'action',
    text: paragraph.text,
  };
}
