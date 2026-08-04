export interface FdxParagraph {
  kind: 'paragraph';
  index: number;
  path: string;
  type: string;
  text: string;
  productionNumber?: string;
  dualDialogue: boolean;
  tagNumbers: string[];
}

export interface FdxDualDialogue {
  kind: 'dualDialogue';
  index: number;
  path: string;
  paragraphs: FdxParagraph[];
}

export interface FdxSyntaxDocument {
  content: Array<FdxParagraph | FdxDualDialogue>;
  tagsByNumber: Record<string, { label: string; category: string }>;
}
