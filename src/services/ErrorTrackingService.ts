import { supabase } from '@/lib/supabase';

export type ErrorType = 'edge_function' | 'realtime' | 'db_query' | 'auth' | 'timeout' | 'unknown';
export type ErrorCategory = 'auth' | 'timeout' | 'db' | 'network' | 'parse' | 'unknown';

export interface TrackedError {
  id: string;
  error_type: ErrorType;
  error_category: ErrorCategory;
  function_name: string;
  error_message: string;
  error_details?: Record<string, any>;
  http_status?: number;
  staff_id?: string;
  staff_name?: string;
  page_context?: string;
  resolved: boolean;
  created_at: string;
}

const STORAGE_KEY = 'ayp_error_logs';
const MAX_LOCAL_ERRORS = 200;

/**
 * Default deduplication window: if the same function+category error fires
 * within this many milliseconds, the second occurrence is silently dropped.
 */
const DEDUP_WINDOW_MS = 5_000;

/**
 * Longer dedup window specifically for realtime errors.  Realtime channels
 * can fire TIMED_OUT / CHANNEL_ERROR every 10-15 s, which previously
 * generated 100+ duplicate entries in a single session.  A 5-minute window
 * collapses those into at most 1 entry per 5 minutes.
 */
const REALTIME_DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Per-function rate limiter: maximum number of errors we'll track for any
 * single function_name within a rolling 1-hour window.  Once the limit is
 * reached, further errors from that function are silently dropped until the
 * window rolls forward.  This is a safety net that prevents ANY single
 * source from flooding the log.
 */
const MAX_ERRORS_PER_FUNCTION_PER_HOUR = 5;

class ErrorTrackingService {
  private errors: TrackedError[] = [];
  private listeners: Set<() => void> = new Set();
  private persistQueue: TrackedError[] = [];
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Track the last time each function+category combination was logged so we
   * can suppress duplicates within the dedup window.
   */
  private recentErrorKeys = new Map<string, number>();

  /**
   * Per-function hourly rate limiter.  Maps function_name → array of
   * timestamps (within the last hour) when errors were logged.
   */
  private functionErrorTimestamps = new Map<string, number[]>();

  /**
   * When true, the monkey-patch on supabase.functions.invoke will NOT track
   * errors.  Components set this flag before calling an edge function that is
   * expected to fail (e.g. the first attempt in a try-edge-then-fallback-DB
   * pattern).
   */
  public suppressNextEdgeFunctionError = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.errors = JSON.parse(stored);
      }
    } catch {
      this.errors = [];
    }
  }

  private saveToStorage() {
    try {
      // Keep only last MAX_LOCAL_ERRORS entries
      if (this.errors.length > MAX_LOCAL_ERRORS) {
        this.errors = this.errors.slice(-MAX_LOCAL_ERRORS);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.errors));
    } catch {
      // Storage full - trim more aggressively
      this.errors = this.errors.slice(-50);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.errors));
      } catch {}
    }
  }

  private notifyListeners() {
    this.listeners.forEach(fn => {
      try { fn(); } catch {}
    });
  }

  private categorizeError(message: string, httpStatus?: number): ErrorCategory {
    const msg = (message || '').toLowerCase();
    
    if (msg.includes('authorization') || msg.includes('token') || msg.includes('jwt') || 
        msg.includes('unauthorized') || msg.includes('forbidden') || httpStatus === 401 || httpStatus === 403) {
      return 'auth';
    }
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted') || httpStatus === 408 || httpStatus === 504) {
      return 'timeout';
    }
    if (msg.includes('database') || msg.includes('relation') || msg.includes('column') || 
        msg.includes('violates') || msg.includes('duplicate key') || msg.includes('syntax error')) {
      return 'db';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection') || 
        msg.includes('dns') || msg.includes('econnrefused') || httpStatus === 502 || httpStatus === 503) {
      return 'network';
    }
    if (msg.includes('parse') || msg.includes('json') || msg.includes('unexpected token') || msg.includes('not iterable')) {
      return 'parse';
    }
    return 'unknown';
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Check the per-function hourly rate limiter.  Returns true if the
   * function has already hit its limit for this hour.
   */
  private isRateLimited(functionName: string): boolean {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    let timestamps = this.functionErrorTimestamps.get(functionName);
    if (!timestamps) {
      timestamps = [];
      this.functionErrorTimestamps.set(functionName, timestamps);
    }

    // Prune old timestamps
    const pruned = timestamps.filter(t => t > oneHourAgo);
    this.functionErrorTimestamps.set(functionName, pruned);

    if (pruned.length >= MAX_ERRORS_PER_FUNCTION_PER_HOUR) {
      return true; // Rate limited
    }

    // Record this timestamp
    pruned.push(now);
    return false;
  }

  /**
   * Hard block-list of errors that should NEVER be tracked under any
   * circumstances.  These are known-noise errors that previously flooded the
   * error_logs table — typically from stale browser caches running old code
   * that subscribes to Realtime channels in an environment where the
   * `supabase_realtime` publication is not configured.
   *
   * Drop rule format:  { type: ErrorType, functionName: string | RegExp }
   *
   * IMPORTANT: Keep this list narrow.  Anything that matches here is
   * completely invisible to the error dashboard.
   */
  private isBlockedError(errorType: ErrorType, functionName: string, message: string): boolean {
    // Realtime channel errors for deal-flow channels are permanently blocked —
    // Realtime is disabled in this environment so any "Channel timed out" /
    // "Channel error" from these channels is purely noise from cached clients.
    if (errorType === 'realtime') {
      const lowered = functionName.toLowerCase();
      if (
        lowered.startsWith('deal-flow-properties') ||
        lowered.startsWith('deal-flow-notifications') ||
        lowered.includes('-rt') ||
        lowered.includes('realtime')
      ) {
        return true;
      }
      // Also block generic channel timeout messages regardless of channel name
      const lowerMsg = (message || '').toLowerCase();
      if (lowerMsg.includes('channel timed out') || lowerMsg.includes('channel error')) {
        return true;
      }
    }
    return false;
  }

  trackError(params: {
    error_type: ErrorType;
    function_name: string;
    error_message: string;
    error_details?: Record<string, any>;
    http_status?: number;
    page_context?: string;
  }) {
    const category = this.categorizeError(params.error_message, params.http_status);

    // ── Hard block-list (silently drop known noise) ──
    if (this.isBlockedError(params.error_type, params.function_name, params.error_message)) {
      return null;
    }

    // ── Per-function hourly rate limiter ──
    if (this.isRateLimited(params.function_name)) {
      // Silently drop — this function has already logged enough errors this hour
      return null;
    }

    // ── Deduplication: suppress rapid-fire identical errors ──
    // Use a longer window for realtime errors since they repeat frequently
    const isRealtime = params.error_type === 'realtime';
    const dedupWindow = isRealtime ? REALTIME_DEDUP_WINDOW_MS : DEDUP_WINDOW_MS;

    const dedupKey = `${params.function_name}::${category}`;
    const now = Date.now();
    const lastSeen = this.recentErrorKeys.get(dedupKey);
    if (lastSeen && now - lastSeen < dedupWindow) {
      // Silently drop — this is a duplicate within the dedup window
      return null;
    }
    this.recentErrorKeys.set(dedupKey, now);

    // Periodically clean up old dedup keys (every 200 entries)
    if (this.recentErrorKeys.size > 200) {
      const cutoff = now - REALTIME_DEDUP_WINDOW_MS * 2;
      for (const [key, ts] of this.recentErrorKeys) {
        if (ts < cutoff) this.recentErrorKeys.delete(key);
      }
    }

    // Get staff info from localStorage
    let staffId: string | undefined;
    let staffName: string | undefined;
    try {
      const session = JSON.parse(localStorage.getItem('staffSession') || '{}');
      staffId = session.id;
      staffName = session.name || `${session.first_name || ''} ${session.last_name || ''}`.trim() || undefined;
    } catch {}

    const error: TrackedError = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      error_type: params.error_type,
      error_category: category,
      function_name: params.function_name,
      error_message: params.error_message,
      error_details: params.error_details,
      http_status: params.http_status,
      staff_id: staffId,
      staff_name: staffName,
      page_context: params.page_context || this.getCurrentPageContext(),
      resolved: false,
      created_at: new Date().toISOString(),
    };

    this.errors.push(error);
    this.saveToStorage();
    this.notifyListeners();

    // Queue for DB persistence (debounced)
    this.persistQueue.push(error);
    this.schedulePersist();

    return error;
  }


  // Convenience methods for common error types
  trackEdgeFunctionError(functionName: string, error: any, httpStatus?: number) {
    const message = typeof error === 'string' ? error : error?.message || error?.error || JSON.stringify(error);
    return this.trackError({
      error_type: 'edge_function',
      function_name: functionName,
      error_message: message,
      http_status: httpStatus,
      error_details: typeof error === 'object' ? error : { raw: error },
    });
  }

  /**
   * @deprecated No longer called after the realtime channel fix in
   * useDealFlowRealtime.ts.  Realtime channel errors are now handled
   * via console.info() and the one-shot probe pattern.  Kept for
   * backward compatibility in case any other component still calls it.
   */
  trackRealtimeError(channel: string, error: any) {
    const message = typeof error === 'string' ? error : error?.message || 'Realtime connection error';
    return this.trackError({
      error_type: 'realtime',
      function_name: channel,
      error_message: message,
      error_details: typeof error === 'object' ? error : { raw: error },
    });
  }


  trackDBError(tableName: string, error: any) {
    const message = typeof error === 'string' ? error : error?.message || 'Database query error';
    return this.trackError({
      error_type: 'db_query',
      function_name: tableName,
      error_message: message,
      error_details: typeof error === 'object' ? error : { raw: error },
    });
  }

  private getCurrentPageContext(): string {
    try {
      return window.location.pathname + window.location.hash;
    } catch {
      return 'unknown';
    }
  }

  private schedulePersist() {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistToDatabase();
      this.persistTimer = null;
    }, 5000); // Batch persist every 5 seconds
  }

  private async persistToDatabase() {
    if (this.persistQueue.length === 0) return;
    
    const batch = [...this.persistQueue];
    this.persistQueue = [];

    try {
      const rows = batch.map(e => ({
        error_type: e.error_type,
        error_category: e.error_category,
        function_name: e.function_name,
        error_message: e.error_message.slice(0, 1000), // Truncate long messages
        error_details: e.error_details || {},
        http_status: e.http_status,
        staff_id: e.staff_id,
        staff_name: e.staff_name,
        page_context: e.page_context,
        resolved: false,
      }));

      const { error } = await supabase.from('error_logs').insert(rows);
      if (error) {
        console.warn('[ErrorTracking] Failed to persist to DB:', error.message);
        // Don't re-queue to avoid infinite loops
      }
    } catch (err) {
      console.warn('[ErrorTracking] Persist error:', err);
    }
  }

  // Query methods
  getErrors(): TrackedError[] {
    return [...this.errors].reverse(); // Most recent first
  }

  getErrorsInLastHour(): TrackedError[] {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    return this.errors.filter(e => e.created_at >= oneHourAgo).reverse();
  }

  getErrorsInLast24Hours(): TrackedError[] {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return this.errors.filter(e => e.created_at >= oneDayAgo).reverse();
  }

  getErrorCountsByCategory(timeWindowMs: number = 24 * 60 * 60 * 1000): Record<ErrorCategory, number> {
    const cutoff = new Date(Date.now() - timeWindowMs).toISOString();
    const recent = this.errors.filter(e => e.created_at >= cutoff);
    
    const counts: Record<ErrorCategory, number> = {
      auth: 0, timeout: 0, db: 0, network: 0, parse: 0, unknown: 0
    };
    
    recent.forEach(e => {
      counts[e.error_category] = (counts[e.error_category] || 0) + 1;
    });
    
    return counts;
  }

  getErrorCountsByType(timeWindowMs: number = 24 * 60 * 60 * 1000): Record<ErrorType, number> {
    const cutoff = new Date(Date.now() - timeWindowMs).toISOString();
    const recent = this.errors.filter(e => e.created_at >= cutoff);
    
    const counts: Record<ErrorType, number> = {
      edge_function: 0, realtime: 0, db_query: 0, auth: 0, timeout: 0, unknown: 0
    };
    
    recent.forEach(e => {
      counts[e.error_type] = (counts[e.error_type] || 0) + 1;
    });
    
    return counts;
  }

  getTopFailingFunctions(limit: number = 10, timeWindowMs: number = 24 * 60 * 60 * 1000, sourceErrors?: TrackedError[]): { name: string; count: number; lastError: string }[] {
    const cutoff = new Date(Date.now() - timeWindowMs).toISOString();
    const pool = sourceErrors || this.errors;
    const recent = pool.filter(e => e.created_at >= cutoff);
    
    const funcMap = new Map<string, { count: number; lastError: string }>();
    recent.forEach(e => {
      const existing = funcMap.get(e.function_name);
      if (existing) {
        existing.count++;
        existing.lastError = e.error_message;
      } else {
        funcMap.set(e.function_name, { count: 1, lastError: e.error_message });
      }
    });
    
    return Array.from(funcMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Format ALL errors in the current time window as a copyable text block.
   * Used by the "Copy All Errors" button on the analytics dashboard.
   *
   * @param timeWindowMs  How far back to look (default 24 h).
   * @param sourceErrors  Optional merged error list (local + DB).  When
   *                      omitted the method falls back to `this.errors`
   *                      (local-only), which may be empty if the browser
   *                      session has been refreshed.
   */
  formatAllErrorsForCopy(timeWindowMs: number = 24 * 60 * 60 * 1000, sourceErrors?: TrackedError[]): string {
    const cutoff = new Date(Date.now() - timeWindowMs).toISOString();
    const pool = sourceErrors || this.errors;
    const recent = pool
      .filter(e => e.created_at >= cutoff && !e.resolved)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (recent.length === 0) return 'No errors in the selected time window.';

    const lines: string[] = [
      `=== Error Report (${recent.length} errors) ===`,
      `Generated: ${new Date().toISOString()}`,
      `Time Window: Last ${Math.round(timeWindowMs / 3600000)}h`,
      '',
      '--- Top Failing Functions ---',
    ];

    const topFns = this.getTopFailingFunctions(10, timeWindowMs, pool);
    topFns.forEach((fn, i) => {
      lines.push(`  ${i + 1}. ${fn.name} (${fn.count}x) — ${fn.lastError.slice(0, 120)}`);
    });

    lines.push('', '--- Full Error Log ---');

    recent.forEach((e, i) => {
      lines.push(
        `\n[${i + 1}] ${e.created_at}`,
        `  Function: ${e.function_name}`,
        `  Type: ${e.error_type} | Category: ${e.error_category}${e.http_status ? ` | HTTP ${e.http_status}` : ''}`,
        `  Message: ${e.error_message.slice(0, 300)}`,
        `  Page: ${e.page_context || 'unknown'}${e.staff_name ? ` | Staff: ${e.staff_name}` : ''}`,
      );
    });

    return lines.join('\n');
  }

  clearErrors() {
    this.errors = [];
    this.recentErrorKeys.clear();
    this.functionErrorTimestamps.clear();
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Bulk-resolve ALL unresolved errors in the given time window.
   * Updates both local state and the DB.
   */
  async resolveAllErrors(resolvedBy: string, timeWindowMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - timeWindowMs).toISOString();
    let count = 0;

    // Update local errors
    this.errors.forEach(e => {
      if (!e.resolved && e.created_at >= cutoff) {
        e.resolved = true;
        count++;
      }
    });
    this.saveToStorage();
    this.notifyListeners();

    // Update DB errors
    try {
      await supabase
        .from('error_logs')
        .update({ resolved: true, resolved_by: resolvedBy, resolved_at: new Date().toISOString() })
        .eq('resolved', false)
        .gte('created_at', cutoff);
    } catch (err) {
      console.warn('[ErrorTracking] Bulk resolve DB error:', err);
    }

    return count;
  }

  /**
   * Get hourly error counts for the last N hours, broken down by category.
   * Returns an array of { hour, auth, timeout, db, network, parse, unknown, total }.
   * Used for sparkline trend charts.
   *
   * @param hours         Number of hours to look back (default 24).
   * @param sourceErrors  Optional merged error list (local + DB).
   */
  getHourlyTrend(hours: number = 24, sourceErrors?: TrackedError[]): Array<{
    hour: string;
    hourIndex: number;
    auth: number;
    timeout: number;
    db: number;
    network: number;
    parse: number;
    unknown: number;
    total: number;
  }> {
    const now = Date.now();
    const pool = sourceErrors || this.errors;
    const buckets: Array<{
      hour: string;
      hourIndex: number;
      auth: number;
      timeout: number;
      db: number;
      network: number;
      parse: number;
      unknown: number;
      total: number;
    }> = [];

    for (let i = hours - 1; i >= 0; i--) {
      const bucketStart = now - (i + 1) * 3600000;
      const bucketEnd = now - i * 3600000;
      const d = new Date(bucketEnd);
      const label = `${d.getHours().toString().padStart(2, '0')}:00`;

      const bucket = { hour: label, hourIndex: hours - 1 - i, auth: 0, timeout: 0, db: 0, network: 0, parse: 0, unknown: 0, total: 0 };

      pool.forEach(e => {
        const ts = new Date(e.created_at).getTime();
        if (ts >= bucketStart && ts < bucketEnd && !e.resolved) {
          bucket[e.error_category] = (bucket[e.error_category] || 0) + 1;
          bucket.total++;
        }
      });

      buckets.push(bucket);
    }

    return buckets;
  }

  /**
   * Generate CSV content for all errors in the given time window.
   *
   * @param timeWindowMs  How far back to look (default 24 h).
   * @param sourceErrors  Optional merged error list (local + DB).
   */
  formatErrorsAsCSV(timeWindowMs: number = 24 * 60 * 60 * 1000, sourceErrors?: TrackedError[]): string {
    const cutoff = new Date(Date.now() - timeWindowMs).toISOString();
    const pool = sourceErrors || this.errors;
    const recent = pool
      .filter(e => e.created_at >= cutoff)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const headers = ['timestamp', 'function_name', 'error_type', 'error_category', 'http_status', 'error_message', 'page_context', 'staff_name', 'resolved'];
    const rows = recent.map(e => [
      e.created_at,
      e.function_name,
      e.error_type,
      e.error_category,
      e.http_status?.toString() || '',
      `"${(e.error_message || '').replace(/"/g, '""').slice(0, 500)}"`,
      e.page_context || '',
      e.staff_name || '',
      e.resolved ? 'true' : 'false',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Get comparison stats: current period vs previous period of same length.
   *
   * @param timeWindowMs  How far back to look (default 24 h).
   * @param sourceErrors  Optional merged error list (local + DB).
   */
  getPeriodComparison(timeWindowMs: number = 24 * 60 * 60 * 1000, sourceErrors?: TrackedError[]): {
    current: number;
    previous: number;
    changePercent: number;
    trend: 'up' | 'down' | 'flat';
  } {
    const now = Date.now();
    const pool = sourceErrors || this.errors;
    const currentCutoff = new Date(now - timeWindowMs).toISOString();
    const previousCutoff = new Date(now - timeWindowMs * 2).toISOString();

    const current = pool.filter(e => e.created_at >= currentCutoff && !e.resolved).length;
    const previous = pool.filter(e => e.created_at >= previousCutoff && e.created_at < currentCutoff && !e.resolved).length;

    const changePercent = previous === 0
      ? (current > 0 ? 100 : 0)
      : Math.round(((current - previous) / previous) * 100);

    const trend = current > previous ? 'up' : current < previous ? 'down' : 'flat';

    return { current, previous, changePercent, trend };
  }


  // Fetch persisted errors from DB for cross-session visibility
  async fetchPersistedErrors(hours: number = 24): Promise<TrackedError[]> {
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('error_logs')
        .select('*')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) {
        console.warn('[ErrorTracking] Failed to fetch persisted errors:', error.message);
        return [];
      }
      
      return (data || []).map((row: any) => ({
        id: row.id,
        error_type: row.error_type,
        error_category: row.error_category,
        function_name: row.function_name,
        error_message: row.error_message,
        error_details: row.error_details,
        http_status: row.http_status,
        staff_id: row.staff_id,
        staff_name: row.staff_name,
        page_context: row.page_context,
        resolved: row.resolved,
        created_at: row.created_at,
      }));
    } catch {
      return [];
    }
  }

  async resolveError(errorId: string, resolvedBy: string) {
    try {
      await supabase
        .from('error_logs')
        .update({ resolved: true, resolved_by: resolvedBy, resolved_at: new Date().toISOString() })
        .eq('id', errorId);
    } catch {}
    
    // Also update local
    const idx = this.errors.findIndex(e => e.id === errorId);
    if (idx !== -1) {
      this.errors[idx].resolved = true;
      this.saveToStorage();
      this.notifyListeners();
    }
  }
}


// Singleton instance
export const errorTracker = new ErrorTrackingService();

// Monkey-patch supabase.functions.invoke to automatically track errors.
// IMPORTANT: This now respects the `suppressNextEdgeFunctionError` flag,
// the built-in deduplication window, AND a list of known fallback functions
// so expected fallback errors (edge function → direct DB) no longer flood
// the error log with 200+ entries.
const originalInvoke = supabase.functions.invoke.bind(supabase.functions);

/**
 * Edge functions that use an edge-function-first + direct-DB-fallback pattern.
 * Errors from these functions are ALWAYS suppressed by the monkey-patch because
 * the calling code handles the failure gracefully by falling back to a direct
 * Supabase DB query.  This eliminates the need to set
 * `errorTracker.suppressNextEdgeFunctionError = true` before every single call
 * site (though components can still set it for non-listed functions).
 */
const KNOWN_FALLBACK_FUNCTIONS = new Set([
  'update-property',
  'get-properties',
  'delete-property',
  'clear-all-properties',
  'new-deal-create',
  'add-property',
  'manage-deal-marketplace',
]);


supabase.functions.invoke = async function(functionName: string, options?: any) {
  // Auto-suppress for known fallback functions
  const autoSuppress = KNOWN_FALLBACK_FUNCTIONS.has(functionName);

  try {
    const result = await originalInvoke(functionName, options);
    
    // If suppression is active (manual or auto), skip tracking and reset the flag
    if (errorTracker.suppressNextEdgeFunctionError || autoSuppress) {
      errorTracker.suppressNextEdgeFunctionError = false;
      return result;
    }

    // Check for error in response
    if (result.error) {
      errorTracker.trackEdgeFunctionError(functionName, result.error);
    }
    
    // Check for error in data body (some functions return {error: "..."} in data)
    // Only track if it looks like a real error, not a "no results" response
    if (result.data?.error && typeof result.data.error === 'string' && 
        !result.data.error.includes('No ') && !result.data.error.includes('not found')) {
      errorTracker.trackEdgeFunctionError(functionName, result.data.error);
    }
    
    return result;
  } catch (err: any) {
    // If suppression is active (manual or auto), skip tracking and reset the flag
    if (errorTracker.suppressNextEdgeFunctionError || autoSuppress) {
      errorTracker.suppressNextEdgeFunctionError = false;
      throw err;
    }
    errorTracker.trackEdgeFunctionError(functionName, err);
    throw err;
  }
} as typeof supabase.functions.invoke;
