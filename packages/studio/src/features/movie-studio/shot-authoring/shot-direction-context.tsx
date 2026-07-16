/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import type { ShotDirectionDraft } from '@gorenku/studio-core/client';

interface ShotDirectionContextValue {
  direction: ShotDirectionDraft;
  onChange: (direction: ShotDirectionDraft) => void;
}

const ShotDirectionContext = createContext<ShotDirectionContextValue | null>(
  null
);

interface ShotDirectionProviderProps extends ShotDirectionContextValue {
  children: ReactNode;
}

export function ShotDirectionProvider({
  direction,
  onChange,
  children,
}: ShotDirectionProviderProps) {
  return (
    <ShotDirectionContext.Provider value={{ direction, onChange }}>
      {children}
    </ShotDirectionContext.Provider>
  );
}

export function useShotDirection(): ShotDirectionContextValue {
  const value = useContext(ShotDirectionContext);
  if (!value) {
    throw new Error(
      'useShotDirection must be used within a ShotDirectionProvider.'
    );
  }
  return value;
}
