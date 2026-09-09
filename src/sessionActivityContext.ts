import React from 'react';

export type SessionActivityContextValue = {
  beginOperation: () => () => void;
  clearSharedState: () => void;
  recordActivity: () => void;
};

export const SessionActivityContext = React.createContext<SessionActivityContextValue>({
  beginOperation: () => () => undefined,
  clearSharedState: () => undefined,
  recordActivity: () => undefined,
});

export function useSessionActivity() {
  return React.useContext(SessionActivityContext);
}

export function useTrackApplicationProcessing(isProcessing: boolean) {
  const { beginOperation } = useSessionActivity();

  React.useEffect(() => {
    if (!isProcessing) return undefined;
    return beginOperation();
  }, [beginOperation, isProcessing]);
}
