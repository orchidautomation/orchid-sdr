import { createHash } from "node:crypto";

export interface DashboardCacheConfig {
  coreStaleAfterMs?: number;
  runtimeStaleAfterMs?: number;
  maxAgeMs?: number;
}

export function getDashboardPassword(input: {
  dashboardPassword?: string | null;
  sandboxToken: string;
}) {
  return input.dashboardPassword ?? input.sandboxToken;
}

export function hashDashboardPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

export function readCookie(request: Request, key: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return undefined;
  }

  for (const chunk of cookieHeader.split(";")) {
    const separatorIndex = chunk.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const name = chunk.slice(0, separatorIndex).trim();
    if (name !== key) {
      continue;
    }

    return decodeURIComponent(chunk.slice(separatorIndex + 1).trim());
  }

  return undefined;
}

export function isDashboardAuthenticated(request: Request, cookieName: string, password: string) {
  const cookieValue = readCookie(request, cookieName);
  return cookieValue === hashDashboardPassword(password);
}

export function isSecureRequest(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.includes("https");
  }

  return request.url.startsWith("https://");
}

export async function withFallback<T>(input: T | PromiseLike<T>, fallback: Awaited<T>, timeoutMs: number) {
  const promise = Promise.resolve(input);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<Awaited<T>>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function calculateDurationMs(startedAt: number | null, completedAt: number | null) {
  if (startedAt === null) {
    return null;
  }

  const end = completedAt ?? Date.now();
  return Math.max(0, end - startedAt);
}

export function createDashboardStateController<CoreState extends Record<string, unknown>, RuntimeState extends Record<string, unknown>>(
  input: {
    buildCoreState: () => Promise<CoreState>;
    buildRuntimeState: () => Promise<RuntimeState>;
    cache?: DashboardCacheConfig;
  },
) {
  const cache = {
    coreStaleAfterMs: input.cache?.coreStaleAfterMs ?? 8_000,
    runtimeStaleAfterMs: input.cache?.runtimeStaleAfterMs ?? 15_000,
    maxAgeMs: input.cache?.maxAgeMs ?? 5 * 60_000,
  };

  let cachedCoreState: CoreState | null = null;
  let cachedCoreStateAt = 0;
  let coreStateRefreshPromise: Promise<CoreState> | null = null;
  let cachedRuntimeState: RuntimeState | null = null;
  let cachedRuntimeStateAt = 0;
  let runtimeStateRefreshPromise: Promise<RuntimeState> | null = null;

  async function getState(options?: { forceFresh?: boolean }) {
    const [coreState, runtimeState] = await Promise.all([
      getCoreState(options),
      getRuntimeState(options),
    ]);

    return {
      ...coreState,
      ...runtimeState,
      cache: {
        core: coreState.cache,
        runtime: runtimeState.cache,
        servedFromCache: coreState.cache.servedFromCache && runtimeState.cache.servedFromCache,
        refreshing: coreState.cache.refreshing || runtimeState.cache.refreshing,
      },
    };
  }

  async function getCoreState(options?: { forceFresh?: boolean }) {
    const now = Date.now();
    const forceFresh = options?.forceFresh === true;
    const cacheAgeMs = cachedCoreState ? now - cachedCoreStateAt : null;
    const cacheIsUsable = cachedCoreState !== null && cacheAgeMs !== null && cacheAgeMs <= cache.maxAgeMs;
    const cacheIsFresh = cacheIsUsable && cacheAgeMs <= cache.coreStaleAfterMs;

    if (forceFresh || !cacheIsUsable) {
      const freshState = await refreshCoreState();
      return {
        ...freshState,
        cache: {
          servedFromCache: false,
          ageMs: 0,
          refreshing: false,
        },
      };
    }

    if (cacheIsFresh) {
      return {
        ...cachedCoreState,
        cache: {
          servedFromCache: true,
          ageMs: cacheAgeMs,
          refreshing: false,
        },
      };
    }

    void refreshCoreState().catch(() => {});

    return {
      ...cachedCoreState,
      cache: {
        servedFromCache: true,
        ageMs: cacheAgeMs,
        refreshing: true,
      },
    };
  }

  async function getRuntimeState(options?: { forceFresh?: boolean }) {
    const now = Date.now();
    const forceFresh = options?.forceFresh === true;
    const cacheAgeMs = cachedRuntimeState ? now - cachedRuntimeStateAt : null;
    const cacheIsUsable = cachedRuntimeState !== null && cacheAgeMs !== null && cacheAgeMs <= cache.maxAgeMs;
    const cacheIsFresh = cacheIsUsable && cacheAgeMs <= cache.runtimeStaleAfterMs;

    if (forceFresh || !cacheIsUsable) {
      const freshState = await refreshRuntimeState();
      return {
        ...freshState,
        cache: {
          servedFromCache: false,
          ageMs: 0,
          refreshing: false,
        },
      };
    }

    if (cacheIsFresh) {
      return {
        ...cachedRuntimeState,
        cache: {
          servedFromCache: true,
          ageMs: cacheAgeMs,
          refreshing: false,
        },
      };
    }

    void refreshRuntimeState().catch(() => {});

    return {
      ...cachedRuntimeState,
      cache: {
        servedFromCache: true,
        ageMs: cacheAgeMs,
        refreshing: true,
      },
    };
  }

  function refreshCoreState() {
    if (coreStateRefreshPromise) {
      return coreStateRefreshPromise;
    }

    coreStateRefreshPromise = input.buildCoreState()
      .then((state) => {
        cachedCoreState = state;
        cachedCoreStateAt = Date.now();
        return state;
      })
      .finally(() => {
        coreStateRefreshPromise = null;
      });

    return coreStateRefreshPromise;
  }

  function refreshRuntimeState() {
    if (runtimeStateRefreshPromise) {
      return runtimeStateRefreshPromise;
    }

    runtimeStateRefreshPromise = input.buildRuntimeState()
      .then((state) => {
        cachedRuntimeState = state;
        cachedRuntimeStateAt = Date.now();
        return state;
      })
      .finally(() => {
        runtimeStateRefreshPromise = null;
      });

    return runtimeStateRefreshPromise;
  }

  return {
    getState,
    getCoreState,
    getRuntimeState,
  };
}
