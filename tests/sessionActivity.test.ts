import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SESSION_INACTIVITY_MS,
  SessionActivityCoordinator,
  type ActivityClock,
  type ActivityStorage,
} from '../src/sessionActivity';

test('configura el límite productivo en 60 minutos', () => {
  assert.equal(SESSION_INACTIVITY_MS, 60 * 60 * 1000);
});

class MemoryStorage implements ActivityStorage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

type Timer = {
  callback: () => void;
  interval?: number;
  runAt: number;
};

class FakeClock implements ActivityClock {
  private nextId = 1;
  private readonly timers = new Map<number, Timer>();
  private value = 0;

  now = () => this.value;

  clearInterval = (handle: unknown) => {
    this.timers.delete(handle as number);
  };

  clearTimeout = (handle: unknown) => {
    this.timers.delete(handle as number);
  };

  setInterval = (callback: () => void, delay: number) => {
    const id = this.nextId++;
    this.timers.set(id, { callback, interval: delay, runAt: this.value + delay });
    return id;
  };

  setTimeout = (callback: () => void, delay: number) => {
    const id = this.nextId++;
    this.timers.set(id, { callback, runAt: this.value + delay });
    return id;
  };

  advance(milliseconds: number) {
    const target = this.value + milliseconds;

    while (true) {
      const next = Array.from(this.timers.entries())
        .filter(([, timer]) => timer.runAt <= target)
        .sort((left, right) => left[1].runAt - right[1].runAt)[0];
      if (!next) break;

      const [id, timer] = next;
      this.value = timer.runAt;
      if (timer.interval === undefined) {
        this.timers.delete(id);
      } else {
        timer.runAt += timer.interval;
      }
      timer.callback();
    }

    this.value = target;
  }
}

const createCoordinator = ({
  clock,
  expired,
  storage,
  tabId = 'tab-a',
}: {
  clock: FakeClock;
  expired: string[];
  storage: MemoryStorage;
  tabId?: string;
}) =>
  new SessionActivityCoordinator({
    busyHeartbeatMs: 10,
    busyLeaseMs: 30,
    clock,
    inactivityMs: 100,
    onExpire: () => expired.push(tabId),
    sessionId: 'user-1:login-1',
    storage,
    tabId,
    userId: 'user-1',
  });

test('no cierra antes del límite y cierra exactamente al cumplirlo', () => {
  const clock = new FakeClock();
  const storage = new MemoryStorage();
  const expired: string[] = [];
  const coordinator = createCoordinator({ clock, expired, storage });

  coordinator.start();
  clock.advance(99);
  assert.deepEqual(expired, []);
  clock.advance(1);
  assert.deepEqual(expired, ['tab-a']);
});

test('una actividad a los 59:59 reinicia una hora completa', () => {
  const clock = new FakeClock();
  const storage = new MemoryStorage();
  const expired: string[] = [];
  const coordinator = createCoordinator({ clock, expired, storage });

  coordinator.start();
  clock.advance(99);
  coordinator.recordActivity();
  clock.advance(99);
  assert.deepEqual(expired, []);
  clock.advance(1);
  assert.deepEqual(expired, ['tab-a']);
});

test('una operación activa aplaza el cierre y al terminar concede el período completo', () => {
  const clock = new FakeClock();
  const storage = new MemoryStorage();
  const expired: string[] = [];
  const coordinator = createCoordinator({ clock, expired, storage });

  coordinator.start();
  const finish = coordinator.beginOperation();
  clock.advance(250);
  assert.deepEqual(expired, []);

  finish();
  clock.advance(99);
  assert.deepEqual(expired, []);
  clock.advance(1);
  assert.deepEqual(expired, ['tab-a']);
});

test('una recarga conserva la última actividad y no revive una sesión vencida', () => {
  const clock = new FakeClock();
  const storage = new MemoryStorage();
  const expired: string[] = [];
  const first = createCoordinator({ clock, expired, storage });

  first.start();
  first.dispose();
  clock.advance(101);

  const reloaded = createCoordinator({ clock, expired, storage, tabId: 'tab-reloaded' });
  reloaded.start();
  assert.deepEqual(expired, ['tab-reloaded']);

  const lateInteraction = reloaded.beginOperation();
  lateInteraction();
  assert.deepEqual(expired, ['tab-reloaded']);
});

test('comparte actividad, operaciones y cierre entre pestañas', () => {
  const clock = new FakeClock();
  const storage = new MemoryStorage();
  const expired: string[] = [];
  const first = createCoordinator({ clock, expired, storage, tabId: 'tab-a' });
  const second = createCoordinator({ clock, expired, storage, tabId: 'tab-b' });

  first.start();
  second.start();
  clock.advance(90);
  second.recordActivity();
  first.synchronize();
  clock.advance(90);
  assert.deepEqual(expired, []);

  const finish = second.beginOperation();
  first.synchronize();
  clock.advance(150);
  assert.deepEqual(expired, []);
  finish();
  first.synchronize();
  clock.advance(100);
  second.synchronize();

  assert.deepEqual(new Set(expired), new Set(['tab-a', 'tab-b']));
});

test('un marcador abandonado caduca y no bloquea la sesión indefinidamente', () => {
  const clock = new FakeClock();
  const storage = new MemoryStorage();
  const expired: string[] = [];
  const coordinator = createCoordinator({ clock, expired, storage });

  coordinator.start();
  storage.setItem(
    `${coordinator.keyPrefix}:busy:crashed-tab`,
    JSON.stringify({ expiresAt: 120, sessionId: 'user-1:login-1', tabId: 'crashed-tab' })
  );
  coordinator.synchronize();

  clock.advance(119);
  assert.deepEqual(expired, []);
  clock.advance(1);
  assert.deepEqual(expired, ['tab-a']);
});
