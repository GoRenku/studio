export interface MediaCardProps {
  media: MediaCardMedia | null;
  frame: MediaCardFrame;
  presentation: MediaCardPresentation;
  activation?: MediaCardActivation;
  selected?: boolean;
  selection?: MediaCardSelection;
  inspectionAction?: MediaCardInspectionAction;
  deleteAction?: MediaCardDeleteAction;
  emptyState?: MediaCardEmptyState;
}

export type MediaCardMedia =
  | MediaCardImage
  | MediaCardVideo
  | MediaCardMosaic;

export interface MediaCardImage {
  kind: 'image';
  src: string;
  alt: string;
  fit: 'cover' | 'contain';
  loading?: 'lazy';
  effect: 'none' | 'zoom-on-hover' | 'desaturate-until-hover-or-selected';
}

export type MediaCardVideo =
  | {
      kind: 'video';
      src: string;
      title: string;
      playback: 'hover-muted' | 'still';
    }
  | {
      kind: 'video';
      src: string;
      title: string;
      posterSrc: string;
      playback: 'hover-muted-loop';
    };

export interface MediaCardMosaic {
  kind: 'mosaic';
  cells: readonly [
    MediaCardMosaicCell,
    MediaCardMosaicCell,
    MediaCardMosaicCell,
    MediaCardMosaicCell,
  ];
}

export interface MediaCardMosaicCell {
  id: string;
  src?: string;
  alt: string;
}

export type MediaCardFrame =
  | {
      kind: 'ratio';
      aspectRatio: number;
      detectFromImage?: boolean;
    }
  | {
      kind: 'intrinsic';
    }
  | {
      kind: 'minimum-height';
      minimumHeightPx: number;
    };

export type MediaCardPresentation =
  | {
      kind: 'overlay';
      copy?: {
        title?: string;
        description?: string;
      };
    }
  | {
      kind: 'thumbnail';
      footer?: {
        eyebrow?: string;
        title: string;
        description?: string;
      };
    }
  | {
      kind: 'evidence';
      copy?:
        | {
            kind: 'label';
            label: string;
          }
        | {
            kind: 'feature';
            title?: string;
            description: string;
          };
    }
  | {
      kind: 'summary';
      body: MediaCardSummaryBody;
    };

export interface MediaCardSummaryBody {
  title: string;
  subtitle?: string;
  description?: string;
  issue?: {
    code: string;
    message: string;
  };
  metrics?: Array<{
    label: string;
    value: string | number;
  }>;
}

export interface MediaCardActivation {
  label: string;
  disabled?: boolean;
  onActivate: () => void;
}

export interface MediaCardSelection {
  selected: boolean;
  selectedLabel: string;
  unselectedLabel: string;
  onToggle: () => void | Promise<void>;
}

export interface MediaCardInspectionAction {
  label: string;
  onInspect: () => void;
}

export interface MediaCardDeleteAction {
  label: string;
  confirmationTitle: string;
  confirmationMessage: string;
  onDelete: () => Promise<void>;
}

export interface MediaCardEmptyState {
  kind: 'image' | 'film' | 'waveform';
}
