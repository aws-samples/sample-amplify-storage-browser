export type ActivityReporter = {
  beginOperation: () => () => void;
  recordActivity: () => void;
};

let reporter: ActivityReporter | undefined;

export function registerActivityReporter(nextReporter: ActivityReporter) {
  reporter = nextReporter;

  return () => {
    if (reporter === nextReporter) reporter = undefined;
  };
}

export async function trackApplicationOperation<T>(operation: () => Promise<T>): Promise<T> {
  const finish = reporter?.beginOperation();

  try {
    return await operation();
  } finally {
    finish?.();
  }
}
