import { useCallback, useMemo, useRef, useState } from 'react';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import {
  chooseDetailSaveNotification,
  idleSaveNotificationSlot,
  saveNotificationStatusesEqual,
  type DetailSaveNotificationSlot,
} from './detail-save-notification';

export type DetailSaveNotificationSlotId =
  | 'shot-design'
  | 'ai-production'
  | 'references'
  | 'dialogs';

export type DetailSaveNotificationSlots = Record<
  DetailSaveNotificationSlotId,
  DetailSaveNotificationSlot
>;

const INITIAL_DETAIL_SAVE_NOTIFICATION_SLOTS: DetailSaveNotificationSlots = {
  'shot-design': idleSaveNotificationSlot,
  'ai-production': idleSaveNotificationSlot,
  references: idleSaveNotificationSlot,
  dialogs: idleSaveNotificationSlot,
};

export function useDetailSaveNotificationSlots(): {
  saveNotification: SaveNotificationStatus;
  setDetailSaveNotificationSlot: (
    slotId: DetailSaveNotificationSlotId,
    status: SaveNotificationStatus
  ) => void;
} {
  const sequenceRef = useRef(0);
  const [slots, setSlots] = useState<DetailSaveNotificationSlots>(
    INITIAL_DETAIL_SAVE_NOTIFICATION_SLOTS
  );

  const updateSlot = useCallback(
    (slotId: DetailSaveNotificationSlotId, status: SaveNotificationStatus) => {
      setSlots((current) =>
        setDetailSaveNotificationSlot(
          current,
          slotId,
          status,
          ++sequenceRef.current
        )
      );
    },
    []
  );

  const saveNotification = useMemo(
    () => chooseDetailSaveNotification(Object.values(slots)),
    [slots]
  );

  return {
    saveNotification,
    setDetailSaveNotificationSlot: updateSlot,
  };
}

export function setDetailSaveNotificationSlot(
  slots: DetailSaveNotificationSlots,
  slotId: DetailSaveNotificationSlotId,
  status: SaveNotificationStatus,
  sequence: number
): DetailSaveNotificationSlots {
  if (saveNotificationStatusesEqual(slots[slotId].status, status)) {
    return slots;
  }
  return {
    ...slots,
    [slotId]: {
      status,
      sequence,
    },
  };
}
