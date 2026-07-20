import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { GenerationRequestInspectorDialog } from './generation-request-inspector-dialog';
import {
  GenerationRequestInspectorDialogContext,
  type GenerationRequestInspectorInput,
} from './use-generation-request-inspector';

export function GenerationRequestInspectorProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [input, setInput] = useState<GenerationRequestInspectorInput | null>(null);
  const openGenerationRequestInspector = useCallback(
    (nextInput: GenerationRequestInspectorInput) => setInput(nextInput),
    [],
  );
  const value = useMemo(
    () => ({ openGenerationRequestInspector }),
    [openGenerationRequestInspector],
  );
  return (
    <GenerationRequestInspectorDialogContext.Provider value={value}>
      {children}
      {input ? (
        <GenerationRequestInspectorDialog
          key={`${input.projectName}:${input.assetId}:${input.assetFileId}`}
          input={input}
          open
          onOpenChange={(open) => {
            if (!open) setInput(null);
          }}
        />
      ) : null}
    </GenerationRequestInspectorDialogContext.Provider>
  );
}
