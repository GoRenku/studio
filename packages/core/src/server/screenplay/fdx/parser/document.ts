import {
  parseXml,
  XmlCdata,
  XmlDocumentType,
  XmlElement,
  XmlError,
  XmlText,
} from '@rgrove/parse-xml';
import { ProjectDataError } from '../../../project-data-error.js';
import { FDX_LIMITS, fdxLimitExceeded } from '../limits.js';
import type {
  FdxDualDialogue,
  FdxParagraph,
  FdxSyntaxDocument,
} from './types.js';

export function parseFdxDocument(xml: string): FdxSyntaxDocument {
  if (/<!DOCTYPE(?:\s|>)/iu.test(xml)) {
    throw new ProjectDataError(
      'SCREENPLAY_FDX_UNSAFE_XML',
      'FDX source must not contain a document type declaration.',
    );
  }
  let document;
  try {
    document = parseXml(xml);
  } catch (error) {
    if (error instanceof XmlError) {
      throw new ProjectDataError(
        'SCREENPLAY_FDX_INVALID_XML',
        error.message.trimEnd(),
      );
    }
    throw error;
  }

  if (document.children.some(
    (child) => child instanceof XmlDocumentType || child.type === 'doctype',
  )) {
    throw new ProjectDataError(
      'SCREENPLAY_FDX_UNSAFE_XML',
      'FDX source must not contain a document type declaration.',
    );
  }
  const root = document.root;
  if (!root || root.name !== 'FinalDraft' || root.attributes.DocumentType !== 'Script') {
    throw invalidDocument('Expected a FinalDraft root with DocumentType="Script".');
  }
  assertBoundedFdxTree(root);
  const contentElements = elementChildren(root).filter((child) => child.name === 'Content');
  if (contentElements.length !== 1) {
    throw invalidDocument('Expected exactly one FinalDraft/Content element.');
  }

  let paragraphIndex = 0;
  let parsedParagraphCount = 0;
  let semanticTextCharacters = 0;
  const content: FdxSyntaxDocument['content'] = [];
  for (const child of contentElements[0].children) {
    if (!(child instanceof XmlElement)) {
      if (child instanceof XmlText && child.text.trim() !== '') {
        throw unsupportedContent('FinalDraft/Content', 'untyped text');
      }
      continue;
    }
    if (child.name === 'ScriptNote' || child.name === 'ScriptNotes') {
      continue;
    }
    if (child.name === 'Paragraph') {
      const path = `FinalDraft/Content/Paragraph[${paragraphIndex}]`;
      const dualDialogueContainers = elementChildren(child)
        .filter((element) => element.name === 'DualDialogue');
      if (dualDialogueContainers.length > 0) {
        const allowedWrapperChildren = new Set([
          'DualDialogue',
          'SceneProperties',
          'ScriptNote',
          'ScriptNotes',
          'Text',
        ]);
        const unknownVisible = elementChildren(child).find((element) =>
          !allowedWrapperChildren.has(element.name) && element.text.trim() !== ''
        );
        if (dualDialogueContainers.length !== 1
          || directText(child).trim() !== ''
          || unknownVisible) {
          throw unsupportedContent(path, 'malformed paragraph-wrapped DualDialogue');
        }
        const dual = parseDualDialogue(
          dualDialogueContainers[0],
          paragraphIndex,
          `${path}/DualDialogue`,
        );
        paragraphIndex += 1;
        parsedParagraphCount += 1 + dual.paragraphs.length;
        semanticTextCharacters += dual.paragraphs.reduce(
          (total, item) => total + item.text.length,
          0,
        );
        content.push(dual);
        continue;
      }
      const paragraph = parseParagraph(child, paragraphIndex, path);
      paragraphIndex += 1;
      parsedParagraphCount += 1;
      semanticTextCharacters += paragraph.text.length;
      content.push(paragraph);
      continue;
    }
    if (child.name === 'DualDialogue') {
      const dual = parseDualDialogue(child, paragraphIndex, `FinalDraft/Content/DualDialogue[${paragraphIndex}]`);
      paragraphIndex += 1;
      parsedParagraphCount += dual.paragraphs.length;
      semanticTextCharacters += dual.paragraphs.reduce(
        (total, item) => total + item.text.length,
        0,
      );
      content.push(dual);
      continue;
    }
    throw unsupportedContent('FinalDraft/Content', child.name);
  }
  if (parsedParagraphCount > FDX_LIMITS.paragraphCount) {
    throw fdxLimitExceeded('paragraph count');
  }
  if (semanticTextCharacters > FDX_LIMITS.semanticTextCharacters) {
    throw fdxLimitExceeded('semantic text');
  }
  return { content, tagsByNumber: parseTagDefinitions(root) };
}

function parseDualDialogue(
  element: XmlElement,
  index: number,
  path: string,
): FdxDualDialogue {
  const paragraphs = elementChildren(element)
    .filter((child) => child.name === 'Paragraph')
    .map((child, offset) => parseParagraph(
      child,
      index,
      `${path}/Paragraph[${offset}]`,
    ));
  if (paragraphs.length === 0 || elementChildren(element).some((child) => child.name !== 'Paragraph')) {
    throw unsupportedContent(path, 'malformed DualDialogue');
  }
  return { kind: 'dualDialogue', index, path, paragraphs };
}

function parseParagraph(
  element: XmlElement,
  index: number,
  path: string,
): FdxParagraph {
  const type = element.attributes.Type?.trim();
  if (!type) {
    throw unsupportedContent(path, 'paragraph without Type');
  }
  const children = elementChildren(element);
  const allowed = new Set(['Text', 'SceneProperties', 'ScriptNote', 'ScriptNotes', 'DualDialogue']);
  const unknownVisible = children.find((child) => !allowed.has(child.name) && child.text.trim() !== '');
  if (unknownVisible) {
    throw unsupportedContent(path, `${type}/${unknownVisible.name}`);
  }
  const text = children
    .filter((child) => child.name === 'Text')
    .map((child) => child.text)
    .join('');
  const tagNumbers = [...new Set(
    children
      .filter((child) => child.name === 'Text')
      .map((child) => child.attributes.TagNumber?.trim())
      .filter((value): value is string => Boolean(value)),
  )];
  return {
    kind: 'paragraph',
    index,
    path,
    type,
    text,
    ...(element.attributes.Number !== undefined
      ? { productionNumber: element.attributes.Number }
      : {}),
    dualDialogue: element.attributes.DualDialogue === 'Yes',
    tagNumbers,
  };
}

function directText(element: XmlElement): string {
  return elementChildren(element)
    .filter((child) => child.name === 'Text')
    .map((child) => child.text)
    .join('');
}

function parseTagDefinitions(
  root: XmlElement,
): Record<string, { label: string; category: string }> {
  const tagData = elementChildren(root).find((element) => element.name === 'TagData');
  if (!tagData) {
    return {};
  }
  const descendants = descendantElements(tagData);
  const categories = new Map(
    descendants
      .filter((element) => element.name === 'TagCategory')
      .map((element) => [
        element.attributes.Id?.trim(),
        element.attributes.Name?.trim(),
      ] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[0] && entry[1])),
  );
  const tags: Record<string, { label: string; category: string }> = {};
  for (const definition of descendants.filter(
    (element) => element.name === 'TagDefinition',
  )) {
    const number = definition.attributes.Number?.trim();
    const label = definition.attributes.Label?.trim();
    const category = categories.get(definition.attributes.CatId?.trim());
    if (!number || !label || !category) {
      continue;
    }
    const existing = tags[number];
    if (existing && (existing.label !== label || existing.category !== category)) {
      throw invalidDocument(`Tag Number ${number} has conflicting definitions.`);
    }
    tags[number] = { label, category };
  }
  return tags;
}

function descendantElements(element: XmlElement): XmlElement[] {
  return elementChildren(element).flatMap((child) => [child, ...descendantElements(child)]);
}

function elementChildren(element: XmlElement): XmlElement[] {
  return element.children.filter((child): child is XmlElement => child instanceof XmlElement);
}

function assertBoundedFdxTree(element: XmlElement, depth = 1): void {
  if (depth > FDX_LIMITS.xmlDepth) {
    throw fdxLimitExceeded('XML depth');
  }
  const attributes = Object.entries(element.attributes);
  if (attributes.length > FDX_LIMITS.attributesPerElement) {
    throw fdxLimitExceeded('attributes per element');
  }
  if (attributes.some(([name, value]) =>
    name.length + value.length > FDX_LIMITS.attributeCharacters
  )) {
    throw fdxLimitExceeded('attribute length');
  }
  for (const child of element.children) {
    if (child instanceof XmlElement) {
      assertBoundedFdxTree(child, depth + 1);
    } else if ((child instanceof XmlText || child instanceof XmlCdata)
      && child.text.length > FDX_LIMITS.paragraphTextCharacters) {
      throw fdxLimitExceeded('text node length');
    }
  }
}

function invalidDocument(message: string): ProjectDataError {
  return new ProjectDataError('SCREENPLAY_FDX_INVALID_DOCUMENT', message);
}

function unsupportedContent(path: string, value: string): ProjectDataError {
  return new ProjectDataError(
    'SCREENPLAY_FDX_UNSUPPORTED_VISIBLE_CONTENT',
    `Unsupported visible FDX content at ${path}: ${value}.`,
  );
}
