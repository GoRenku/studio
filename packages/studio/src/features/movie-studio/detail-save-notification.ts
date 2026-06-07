import type { SaveNotificationStatus } from '@/ui/save-notification';

export const idleSaveNotification: SaveNotificationStatus = {
  state: 'idle',
  message: null,
};

export interface DetailSaveNotificationSlot {
  status: SaveNotificationStatus;
  sequence: number;
}

export const idleSaveNotificationSlot: DetailSaveNotificationSlot = {
  status: idleSaveNotification,
  sequence: 0,
};

export function chooseDetailSaveNotification(
  slots: DetailSaveNotificationSlot[]
): SaveNotificationStatus {
  const [first] = [...slots].sort((left, right) => {
    const priorityDiff =
      saveNotificationPriority(right.status) -
      saveNotificationPriority(left.status);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return right.sequence - left.sequence;
  });

  return first?.status ?? idleSaveNotification;
}

export function saveNotificationStatusesEqual(
  left: SaveNotificationStatus,
  right: SaveNotificationStatus
): boolean {
  return left.state === right.state && left.message === right.message;
}

function saveNotificationPriority(status: SaveNotificationStatus): number {
  switch (status.state) {
    case 'error':
      return 3;
    case 'saving':
      return 2;
    case 'saved':
      return 1;
    case 'idle':
      return 0;
  }
}
