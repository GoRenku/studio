import type {
  Scene,
  ScreenplaySection,
  ScreenplayStructureEntry,
} from '../../../../client/screenplay/index.js';
import type { FdxIdentityFactory } from '../identifiers.js';
import type { FdxParagraph } from '../parser/types.js';
import { invalidFdxParagraph } from './errors.js';

export class FdxStructureMapper {
  private activeActId: string | undefined;
  private activeSequenceId: string | undefined;
  private readonly positions = new Map<string, number>();

  constructor(
    private readonly identities: FdxIdentityFactory,
    private readonly sections: ScreenplaySection[],
    private readonly structure: ScreenplayStructureEntry[],
  ) {}

  addSection(paragraph: FdxParagraph, type: 'act' | 'sequence'): void {
    const title = paragraph.text.trim();
    if (!title) {
      throw invalidFdxParagraph(paragraph, `${paragraph.type} requires a non-empty title`);
    }
    if (type === 'act') {
      this.activeActId = this.identities.id('screenplay_section', `${paragraph.path}/act`);
      this.activeSequenceId = undefined;
    } else {
      this.activeSequenceId = this.identities.id('screenplay_section', `${paragraph.path}/sequence`);
    }
    const section: ScreenplaySection = {
      id: (type === 'act' ? this.activeActId : this.activeSequenceId) as string,
      type,
      title,
    };
    this.sections.push(section);
    this.addEntry(
      { type: 'section', sectionId: section.id },
      `${paragraph.path}/structure`,
      type === 'sequence' ? this.activeActId : undefined,
    );
  }

  endAct(paragraph: FdxParagraph): void {
    if (!this.activeActId) {
      throw invalidFdxParagraph(paragraph, 'End of Act has no open Act');
    }
    this.activeActId = undefined;
    this.activeSequenceId = undefined;
  }

  addScene(scene: Scene, paragraph: FdxParagraph): void {
    this.addEntry(
      { type: 'scene', sceneId: scene.id },
      `${paragraph.path}/structure`,
      this.activeSequenceId ?? this.activeActId,
    );
  }

  private addEntry(
    content: ScreenplayStructureEntry['content'],
    semanticPath: string,
    parentSectionId?: string,
  ): void {
    const positionKey = parentSectionId ?? 'root';
    const position = this.positions.get(positionKey) ?? 0;
    this.positions.set(positionKey, position + 1);
    this.structure.push({
      id: this.identities.id('screenplay_structure_entry', semanticPath),
      ...(parentSectionId ? { parentSectionId } : {}),
      content,
      position,
    });
  }
}
