import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ImageRevisionDialog } from './image-revision-dialog';
import {
  ImageRevisionDialogContext,
  type OpenImageRevisionInput,
} from './use-image-revision-dialog';

export function ImageRevisionDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<OpenImageRevisionInput | null>(null);
  const [open, setOpen] = useState(false);
  const openImageRevision = useCallback((input: OpenImageRevisionInput) => {
    setRequest(input);
    setOpen(true);
  }, []);
  const value = useMemo(() => ({ openImageRevision }), [openImageRevision]);
  return (
    <ImageRevisionDialogContext.Provider value={value}>
      {children}
      {request ? (
        <ImageRevisionDialog
          key={`${request.projectName}:${JSON.stringify(request.target)}`}
          open={open}
          request={request}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) setRequest(null);
          }}
        />
      ) : null}
    </ImageRevisionDialogContext.Provider>
  );
}
