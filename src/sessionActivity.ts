export const SESSION_INACTIVITY_MS = 60 * 60 * 1000;
export const BUSY_MARKER_LEASE_MS = 2 * 60 * 1000;
export const BUSY_MARKER_HEARTBEAT_MS = 30 * 1000;

export type ActivityClock = {
  clearInterval: (handle: unknown) => void;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
  setInterval: (callback: () => void, delay: number) => unknown;
  setTimeout: (callback: () => void, delay: number) => unknown;
};

export type ActivityStorage = Pick<
  Storage,
  'getItem' | 'key' | 'length' | 'removeItem' | 'setItem'
>;

export type SessionActivityCoordinatorOptions = {
  busyHeartbeatMs?: number;
  busyLeaseMs?: number;
  clock: ActivityClock;
  inactivityMs?: number;
  notifyPeers?: () => void;
  onExpire: () => void;
  sessionId: string;
  storage: ActivityStorage;
  tabId: string;
  userId: string;
};

type SessionRecord = {
  lastActivity: number;
  sessionId: string;
};

type BusyRecord = {
  expiresAt: number;
  sessionId: string;
  tabId: string;
};

type LogoutRecord = {
  expiredAt: number;
  sessionId: string;
};

const parseRecord = <T>(value: string | null): T | undefined => {
  if (!value) return undefined;

  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

const isFiniteTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export class SessionActivityCoordinator {
  readonly keyPrefix: string;

  get hasExpired() {
    return this.expired;
  }

  private readonly busyHeartbeatMs: number;
  private readonly busyKey: string;
  private readonly busyLeaseMs: number;
  private readonly clock: ActivityClock;
  private readonly inactivityMs: number;
  private readonly logoutKey: string;
  private readonly notifyPeers?: () => void;
  private readonly onExpire: () => void;
  private readonly sessionId: string;
  private readonly stateKey: string;
  private readonly storage: ActivityStorage;
  private readonly tabId: string;
  private evaluationTimer?: unknown;
  private expired = false;
  private heartbeatTimer?: unknown;
  private localOperations = 0;
  private started = false;

  constructor(options: SessionActivityCoordinatorOptions) {
    this.clock = options.clock;
    this.storage = options.storage;
    this.onExpire = options.onExpire;
    this.notifyPeers = options.notifyPeers;
    this.sessionId = options.sessionId;
    this.tabId = options.tabId;
    this.inactivityMs = options.inactivityMs ?? SESSION_INACTIVITY_MS;
    this.busyLeaseMs = options.busyLeaseMs ?? BUSY_MARKER_LEASE_MS;
    this.busyHeartbeatMs = options.busyHeartbeatMs ?? BUSY_MARKER_HEARTBEAT_MS;
    this.keyPrefix = `frauden:session-activity:v1:${encodeURIComponent(options.userId)}`;
    this.stateKey = `${this.keyPrefix}:state`;
    this.logoutKey = `${this.keyPrefix}:logout`;
    this.busyKey = `${this.keyPrefix}:busy:${this.tabId}`;
  }

  start() {
    if (this.started) return;
    this.started = true;

    const logout = this.readLogout();
    if (logout?.sessionId === this.sessionId) {
      this.expireLocally();
      return;
    }

    const current = this.readSession();
    if (!current || current.sessionId !== this.sessionId) {
      this.removeKeys(`${this.keyPrefix}:busy:`);
      this.storage.removeItem(this.logoutKey);
      this.writeSession(this.clock.now());
      this.notifyPeers?.();
    }

    this.synchronize();
  }

  recordActivity() {
    if (!this.canContinue()) return;

    this.writeSession(this.clock.now());
    this.scheduleEvaluation();
    this.notifyPeers?.();
  }

  beginOperation(): () => void {
    if (!this.canContinue()) return () => undefined;

    this.localOperations += 1;
    this.writeBusyMarker();

    if (this.localOperations === 1) {
      this.heartbeatTimer = this.clock.setInterval(() => {
        if (!this.expired && this.localOperations > 0) {
          this.writeBusyMarker();
          this.scheduleEvaluation();
          this.notifyPeers?.();
        }
      }, this.busyHeartbeatMs);
    }

    this.scheduleEvaluation();
    this.notifyPeers?.();

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.finishOperation();
    };
  }

  synchronize() {
    if (!this.started || this.expired) return;

    const logout = this.readLogout();
    if (logout?.sessionId === this.sessionId) {
      this.expireLocally();
      return;
    }

    const current = this.readSession();
    if (!current || current.sessionId !== this.sessionId) {
      this.stopTimers();
      return;
    }

    if (this.localOperations > 0) {
      const ownMarker = this.readBusyRecord(this.busyKey);
      if (!ownMarker || ownMarker.expiresAt <= this.clock.now()) {
        this.writeBusyMarker();
      }
    }

    this.removeStaleBusyMarkers();
    this.evaluateExpiry(current);
  }

  clearSharedState() {
    this.stopTimers();
    this.removeKeys(this.keyPrefix);
    this.localOperations = 0;
    this.notifyPeers?.();
  }

  dispose() {
    this.stopTimers();
    this.storage.removeItem(this.busyKey);
    this.localOperations = 0;
    this.notifyPeers?.();
  }

  private canContinue() {
    if (!this.started || this.expired) return false;

    const logout = this.readLogout();
    if (logout?.sessionId === this.sessionId) {
      this.expireLocally();
      return false;
    }

    const current = this.readSession();
    if (!current || current.sessionId !== this.sessionId) return false;

    if (this.localOperations > 0) {
      this.writeBusyMarker();
    }

    this.removeStaleBusyMarkers();
    if (
      this.clock.now() >= current.lastActivity + this.inactivityMs &&
      this.readActiveBusyMarkers().length === 0
    ) {
      this.expireSession();
      return false;
    }

    return true;
  }

  private finishOperation() {
    if (this.localOperations === 0) return;
    this.localOperations -= 1;

    if (this.localOperations > 0) {
      this.writeBusyMarker();
      return;
    }

    if (this.heartbeatTimer !== undefined) {
      this.clock.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    this.storage.removeItem(this.busyKey);

    if (!this.expired) {
      const current = this.readSession();
      if (current?.sessionId === this.sessionId) {
        this.removeStaleBusyMarkers();
        if (this.readActiveBusyMarkers().length === 0) {
          this.writeSession(this.clock.now());
        }
        this.scheduleEvaluation();
      }
    }

    this.notifyPeers?.();
  }

  private evaluateExpiry(current: SessionRecord) {
    const now = this.clock.now();
    const deadline = current.lastActivity + this.inactivityMs;
    const busyMarkers = this.readActiveBusyMarkers();

    if (now >= deadline && busyMarkers.length === 0) {
      this.expireSession();
      return;
    }

    this.scheduleEvaluation(current, busyMarkers);
  }

  private scheduleEvaluation(
    current = this.readSession(),
    busyMarkers = this.readActiveBusyMarkers()
  ) {
    if (this.evaluationTimer !== undefined) {
      this.clock.clearTimeout(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }

    if (this.expired || !current || current.sessionId !== this.sessionId) return;

    const now = this.clock.now();
    const inactivityDeadline = current.lastActivity + this.inactivityMs;
    const nextDeadline =
      now < inactivityDeadline || busyMarkers.length === 0
        ? inactivityDeadline
        : Math.min(...busyMarkers.map(({ expiresAt }) => expiresAt));
    const delay = Math.max(0, nextDeadline - now);

    this.evaluationTimer = this.clock.setTimeout(() => {
      this.evaluationTimer = undefined;
      this.synchronize();
    }, delay);
  }

  private expireSession() {
    if (this.expired) return;

    const logout: LogoutRecord = {
      expiredAt: this.clock.now(),
      sessionId: this.sessionId,
    };
    this.storage.setItem(this.logoutKey, JSON.stringify(logout));
    this.storage.removeItem(this.stateKey);
    this.removeKeys(`${this.keyPrefix}:busy:`);
    this.notifyPeers?.();
    this.expireLocally();
  }

  private expireLocally() {
    if (this.expired) return;
    this.expired = true;
    this.stopTimers();
    this.localOperations = 0;
    this.onExpire();
  }

  private stopTimers() {
    if (this.evaluationTimer !== undefined) {
      this.clock.clearTimeout(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }
    if (this.heartbeatTimer !== undefined) {
      this.clock.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private writeSession(lastActivity: number) {
    const current = this.readSession();
    const record: SessionRecord = {
      lastActivity:
        current?.sessionId === this.sessionId
          ? Math.max(current.lastActivity, lastActivity)
          : lastActivity,
      sessionId: this.sessionId,
    };
    this.storage.setItem(this.stateKey, JSON.stringify(record));
  }

  private readSession(): SessionRecord | undefined {
    const record = parseRecord<SessionRecord>(this.storage.getItem(this.stateKey));
    return record && isFiniteTimestamp(record.lastActivity) && typeof record.sessionId === 'string'
      ? record
      : undefined;
  }

  private readLogout(): LogoutRecord | undefined {
    const record = parseRecord<LogoutRecord>(this.storage.getItem(this.logoutKey));
    return record && isFiniteTimestamp(record.expiredAt) && typeof record.sessionId === 'string'
      ? record
      : undefined;
  }

  private writeBusyMarker() {
    const record: BusyRecord = {
      expiresAt: this.clock.now() + this.busyLeaseMs,
      sessionId: this.sessionId,
      tabId: this.tabId,
    };
    this.storage.setItem(this.busyKey, JSON.stringify(record));
  }

  private readBusyRecord(key: string): BusyRecord | undefined {
    const record = parseRecord<BusyRecord>(this.storage.getItem(key));
    return record &&
      isFiniteTimestamp(record.expiresAt) &&
      typeof record.sessionId === 'string' &&
      typeof record.tabId === 'string'
      ? record
      : undefined;
  }

  private readActiveBusyMarkers(): BusyRecord[] {
    const records: BusyRecord[] = [];
    const prefix = `${this.keyPrefix}:busy:`;
    const now = this.clock.now();

    for (const key of this.getKeys(prefix)) {
      const record = this.readBusyRecord(key);
      if (record?.sessionId === this.sessionId && record.expiresAt > now) {
        records.push(record);
      }
    }

    return records;
  }

  private removeStaleBusyMarkers() {
    const now = this.clock.now();
    for (const key of this.getKeys(`${this.keyPrefix}:busy:`)) {
      const record = this.readBusyRecord(key);
      if (!record || record.sessionId !== this.sessionId || record.expiresAt <= now) {
        this.storage.removeItem(key);
      }
    }
  }

  private removeKeys(prefix: string) {
    for (const key of this.getKeys(prefix)) {
      this.storage.removeItem(key);
    }
  }

  private getKeys(prefix: string) {
    const keys: string[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    return keys;
  }
}
