export function createBootstrapRunner(task: () => Promise<void>) {
  let bootstrapPromise: Promise<void> | null = null;

  return async function ensureBootstrapped() {
    if (bootstrapPromise) {
      return bootstrapPromise;
    }

    bootstrapPromise = task().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });

    return bootstrapPromise;
  };
}

export function hasRemoteRuntimeEndpoint(endpoint: string | null | undefined) {
  return Boolean(endpoint);
}

export function shouldSkipLocalRuntimeOnVercel(input: {
  isVercel?: boolean;
  remoteEndpoint?: string | null;
}) {
  return Boolean(input.isVercel) && !hasRemoteRuntimeEndpoint(input.remoteEndpoint);
}

export async function runNonFatalBootstrapTask(label: string, task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    console.error(`Non-fatal runtime bootstrap failure: ${label}`, error);
  }
}
