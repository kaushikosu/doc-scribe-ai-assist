import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SessionStateContextType {
  isTranscriptFinalized: boolean;
  setIsTranscriptFinalized: (val: boolean) => void;
}

const SessionStateContext = createContext<SessionStateContextType | undefined>(undefined);

export const useSessionState = () => {
  const ctx = useContext(SessionStateContext);
  if (!ctx) throw new Error('useSessionState must be used within a SessionStateProvider');
  return ctx;
};

export const SessionStateProvider = ({ children }: { children: ReactNode }) => {
  const [isTranscriptFinalized, setIsTranscriptFinalized] = useState(false);
  return (
    <SessionStateContext.Provider value={{ isTranscriptFinalized, setIsTranscriptFinalized }}>
      {children}
    </SessionStateContext.Provider>
  );
};
