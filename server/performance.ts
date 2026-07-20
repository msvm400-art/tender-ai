import { Request, Response, NextFunction } from "express";

// -------------------------------------------------------------
// 1. IN-MEMORY ROUTE CACHE ENGINE (PHASE 13)
// -------------------------------------------------------------
interface CachedResponse {
  body: any;
  headers: Record<string, string | string[] | undefined>;
  expiry: number;
}

const memoryStore = new Map<string, CachedResponse>();

/**
 * Custom memory cache middleware with custom TTL (Time To Live) in ms.
 * Optimizes static resources such as categories, tenders feed, statistics, and list lookups.
 */
export function routeCache(ttlMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET queries
    if (req.method !== "GET") {
      return next();
    }

    const key = req.originalUrl || req.url;
    const cached = memoryStore.get(key);

    if (cached && Date.now() < cached.expiry) {
      // Return cached item
      res.setHeader("X-Cache-Status", "HIT");
      for (const hKey in cached.headers) {
        if (cached.headers[hKey] !== undefined) {
          res.setHeader(hKey, cached.headers[hKey] as string);
        }
      }
      return res.json(cached.body);
    }

    // Intercept response write to cache the data
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Don't cache error states
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const rawHeaders = res.getHeaders();
        const cleanHeaders: Record<string, string | string[]> = {};
        for (const key in rawHeaders) {
          const val = rawHeaders[key];
          if (val !== undefined && val !== null) {
            cleanHeaders[key] = Array.isArray(val) ? val.map(String) : String(val);
          }
        }

        memoryStore.set(key, {
          body,
          headers: cleanHeaders,
          expiry: Date.now() + ttlMs
        });
      }
      res.setHeader("X-Cache-Status", "MISS");
      return originalJson(body);
    };

    next();
  };
}

/**
 * Liquidates entire cache entries or specific sub-keys (e.g. after database writes/updates)
 */
export function invalidateRouteCache(patterns?: string[]) {
  if (!patterns) {
    memoryStore.clear();
    console.log("[CACHE ENGINE] Cache purged successfully.");
    return;
  }

  const keys = Array.from(memoryStore.keys());
  let count = 0;
  for (const key of keys) {
    if (patterns.some((pat) => key.includes(pat))) {
      memoryStore.delete(key);
      count++;
    }
  }
  console.log(`[CACHE ENGINE] Cleared ${count} cached entries matching filters:`, patterns);
}

// -------------------------------------------------------------
// 2. NON-BLOCKING ASYNC TASK QUEUE SERVICE (PHASE 13)
// -------------------------------------------------------------
interface BackgroundTask {
  id: string;
  name: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  runCount: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

const backgroundTasks = new Map<string, BackgroundTask>();

/**
 * Spawns job executions outside of the main Express requests stream
 * to avoid thread blockings, API response delays, and HTTP timeout failures.
 */
export function executeBackgroundJob<T>(params: {
  name: string;
  taskFn: () => Promise<T>;
  onComplete?: (result: T) => void;
  onFailure?: (error: Error) => void;
}): string {
  const taskId = "job-" + Math.random().toString(36).substring(3, 8);
  const task: BackgroundTask = {
    id: taskId,
    name: params.name,
    status: "PENDING",
    runCount: 0,
    createdAt: new Date().toISOString()
  };

  backgroundTasks.set(taskId, task);

  // Use setImmediate to schedule out of loop
  setImmediate(async () => {
    task.status = "RUNNING";
    task.runCount++;
    try {
      const result = await params.taskFn();
      task.status = "COMPLETED";
      task.completedAt = new Date().toISOString();
      backgroundTasks.set(taskId, task);
      if (params.onComplete) {
        params.onComplete(result);
      }
    } catch (err: any) {
      task.status = "FAILED";
      task.error = err?.message || String(err);
      task.completedAt = new Date().toISOString();
      backgroundTasks.set(taskId, task);
      console.error(`[BACKGROUND WORKER] Failed background job '${params.name}':`, err);
      if (params.onFailure) {
        params.onFailure(err instanceof Error ? err : new Error(String(err)));
      }
    }
  });

  return taskId;
}

export function getBackgroundJobStatus(id: string): BackgroundTask | undefined {
  return backgroundTasks.get(id);
}

export function getAllJobs(): BackgroundTask[] {
  return Array.from(backgroundTasks.values());
}
