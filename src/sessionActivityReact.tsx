import React, { type ReactNode } from 'react';
import { registerActivityReporter } from './activityReporter';
import { SessionActivityCoordinator, type ActivityClock } from './sessionActivity';
import { SessionActivityContext, type SessionActivityContextValue } from './sessionActivityContext';

const browserClock: ActivityClock = {
  clearInterval: (handle) => window.clearInterval(handle as number),
  clearTimeout: (handle) => window.clearTimeout(handle as number),
  now: () => Date.now(),
  setInterval: (callback, delay) => window.setInterval(callback, delay),
  setTimeout: (callback, delay) => window.setTimeout(callback, delay),
};

const createTabId = () =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function SessionActivityProvider({
  children,
  onExpire,
  sessionId,
  userId,
}: {
  children: ReactNode;
  onExpire: () => void;
  sessionId: string;
  userId: string;
}) {
  const coordinatorRef = React.useRef<SessionActivityCoordinator | undefined>(undefined);
  const onExpireRef = React.useRef(onExpire);
  const [isReady, setIsReady] = React.useState(false);

  onExpireRef.current = onExpire;

  const contextValue = React.useMemo<SessionActivityContextValue>(
    () => ({
      beginOperation: () => coordinatorRef.current?.beginOperation() ?? (() => undefined),
      clearSharedState: () => coordinatorRef.current?.clearSharedState(),
      recordActivity: () => coordinatorRef.current?.recordActivity(),
    }),
    []
  );

  React.useEffect(() => {
    setIsReady(false);
    const channelName = `frauden-session-activity:${encodeURIComponent(userId)}`;
    let channel: BroadcastChannel | undefined;
    try {
      channel =
        typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(channelName);
    } catch {
      // The `storage` event remains available as the cross-tab fallback.
      channel = undefined;
    }
    const coordinator = new SessionActivityCoordinator({
      clock: browserClock,
      notifyPeers: () => channel?.postMessage({ type: 'changed' }),
      onExpire: () => onExpireRef.current(),
      sessionId,
      storage: window.localStorage,
      tabId: createTabId(),
      userId,
    });
    coordinatorRef.current = coordinator;

    const unregisterReporter = registerActivityReporter({
      beginOperation: () => coordinator.beginOperation(),
      recordActivity: () => coordinator.recordActivity(),
    });
    const recordActivity = () => coordinator.recordActivity();
    const synchronize = () => coordinator.synchronize();
    const synchronizeWhenVisible = () => {
      if (document.visibilityState === 'visible') synchronize();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith(coordinator.keyPrefix)) synchronize();
    };

    channel?.addEventListener('message', synchronize);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', synchronize);
    document.addEventListener('visibilitychange', synchronizeWhenVisible);
    window.addEventListener('keydown', recordActivity, true);
    window.addEventListener('pointerdown', recordActivity, true);
    window.addEventListener('touchstart', recordActivity, { capture: true, passive: true });
    window.addEventListener('wheel', recordActivity, { capture: true, passive: true });
    window.addEventListener('scroll', recordActivity, { capture: true, passive: true });

    coordinator.start();
    if (!coordinator.hasExpired) setIsReady(true);

    return () => {
      unregisterReporter();
      coordinator.dispose();
      channel?.removeEventListener('message', synchronize);
      channel?.close();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', synchronize);
      document.removeEventListener('visibilitychange', synchronizeWhenVisible);
      window.removeEventListener('keydown', recordActivity, true);
      window.removeEventListener('pointerdown', recordActivity, true);
      window.removeEventListener('touchstart', recordActivity, true);
      window.removeEventListener('wheel', recordActivity, true);
      window.removeEventListener('scroll', recordActivity, true);
      if (coordinatorRef.current === coordinator) coordinatorRef.current = undefined;
    };
  }, [sessionId, userId]);

  return (
    <SessionActivityContext.Provider value={contextValue}>
      {isReady ? (
        children
      ) : (
        <div className="session-check" role="status">
          Verificando vigencia de la sesión...
        </div>
      )}
    </SessionActivityContext.Provider>
  );
}
