export interface MediaCardProps {
  media: MediaCardMedia | null;
  frame: MediaCardFrame;
  presentation: MediaCardPresentation;
  activation?: MediaCardActivation;
  selected?: boolean;
  selection?: MediaCardSelection;
  cornerAction?: MediaCardCornerAction;
  deleteAction?: MediaCardDeleteAction;
  emptyState?: MediaCardEmptyState;
}

export type MediaCardMedia =
  | MediaCardImage
  | MediaCardVideo
  | MediaCardMosaic
  | MediaCardMosaicGrid;

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

export interface MediaCardMosaicGrid {
  kind: 'mosaic-grid';
  items: MediaCardMosaicGridItem[];
}

export interface MediaCardMosaicGridItem {
  key: string;
  imageUrl: string;
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

export type MediaCardActivation =
  | MediaCardCallbackActivation
  | MediaCardImagePreviewActivation;

export interface MediaCardCallbackActivation {
  kind: 'callback';
  label: string;
  disabled?: boolean;
  onActivate: () => void;
}

export interface MediaCardImagePreviewActivation {
  kind: 'image-preview';
  label: string;
  disabled?: boolean;
  image: MediaCardPreviewImage;
}

export interface MediaCardPreviewImage {
  src: string;
  alt: string;
  title: string;
}

export interface MediaCardCollectionItem {
  id: string;
  card: MediaCardProps;
}

export type MediaCardCollectionDialogState =
  | {
      kind: 'loading';
      message: string;
    }
  | {
      kind: 'error';
      message: string;
      retryLabel: string;
      onRetry: () => void;
    }
  | {
      kind: 'empty';
      message: string;
    }
  | {
      kind: 'ready';
      items: MediaCardCollectionItem[];
    };

export type MediaCardCollectionDialogPresentation =
  | {
      kind: 'flush';
    }
  | {
      kind: 'inset';
    };

export type MediaCardSelection =
  | {
      kind: 'toggle';
      selected: boolean;
      selectedLabel: string;
      unselectedLabel: string;
      onToggle: () => void | Promise<void>;
    }
  | {
      kind: 'choose';
      selected: boolean;
      selectedLabel: string;
      unselectedLabel: string;
      onChoose: () => void | Promise<void>;
    };

export type MediaCardCornerAction =
  | {
      kind: 'inspect';
      label: string;
      visibility: 'always' | 'hover-or-focus';
      onAction: () => void;
    }
  | {
      kind: 'edit';
      label: string;
      visibility: 'always' | 'hover-or-focus';
      onAction: () => void;
    };

export interface MediaCardDeleteAction {
  label: string;
  confirmationTitle: string;
  confirmationMessage: string;
  onDelete: () => Promise<void>;
}

export interface MediaCardEmptyState {
  kind: 'image' | 'film' | 'waveform';
}
