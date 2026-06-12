/**
 * Deal Error Handler
 * 
 * Classifies Supabase/edge function errors into specific categories
 * and returns detailed, actionable error messages for staff.
 */

export type ErrorCategory =
  | 'rls_permission'
  | 'network'
  | 'edge_function_502'
  | 'edge_function_timeout'
  | 'auth_expired'
  | 'not_found'
  | 'validation'
  | 'unique_violation'
  | 'foreign_key'
  | 'storage'
  | 'rate_limit'
  | 'unknown';

export interface ClassifiedError {
  category: ErrorCategory;
  title: string;
  description: string;
  supportAction: string;
  errorCode: string;
  rawMessage: string;
  timestamp: string;
}

/**
 * Generate a short reference code for support tickets
 */
function generateErrorCode(category: ErrorCategory): string {
  const prefix: Record<ErrorCategory, string> = {
    rls_permission: 'RLS',
    network: 'NET',
    edge_function_502: 'EF5',
    edge_function_timeout: 'EFT',
    auth_expired: 'AUTH',
    not_found: 'NF',
    validation: 'VAL',
    unique_violation: 'DUP',
    foreign_key: 'FK',
    storage: 'STR',
    rate_limit: 'RL',
    unknown: 'UNK',
  };
  const ts = Date.now().toString(36).slice(-5).toUpperCase();
  return `${prefix[category]}-${ts}`;
}

/**
 * Normalize an error into a string message for pattern matching
 */
function extractMessage(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === 'object') {
    const e = err as Record<string, any>;
    // Supabase error shapes
    return [
      e.message,
      e.error_description,
      e.error,
      e.msg,
      e.details,
      e.hint,
      e.code,
      e.statusCode,
      e.status,
      JSON.stringify(e),
    ]
      .filter(Boolean)
      .join(' | ');
  }
  return String(err);
}

/**
 * Extract HTTP status code if present in the error
 */
function extractStatusCode(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as Record<string, any>;
  if (e.status) return Number(e.status);
  if (e.statusCode) return Number(e.statusCode);
  // FunctionsHttpError from supabase-js
  if (e.context?.status) return Number(e.context.status);
  return null;
}

/**
 * Classify an error into a specific category
 */
function classifyError(err: unknown): ErrorCategory {
  const msg = extractMessage(err).toLowerCase();
  const status = extractStatusCode(err);

  // --- RLS / Permission errors ---
  if (
    msg.includes('row-level security') ||
    msg.includes('rls') ||
    msg.includes('policy') ||
    msg.includes('permission denied') ||
    msg.includes('42501') ||
    msg.includes('new row violates row-level security') ||
    msg.includes('insufficient_privilege') ||
    msg.includes('check_violation')
  ) {
    return 'rls_permission';
  }

  // --- Auth / JWT errors ---
  if (
    msg.includes('jwt') ||
    msg.includes('token is expired') ||
    msg.includes('invalid claim') ||
    msg.includes('unauthorized') ||
    msg.includes('not authenticated') ||
    status === 401 ||
    msg.includes('auth') && msg.includes('expired')
  ) {
    return 'auth_expired';
  }

  // --- Rate limiting ---
  if (
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    status === 429
  ) {
    return 'rate_limit';
  }

  // --- Edge function 502/504 ---
  if (
    status === 502 ||
    status === 504 ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('bad gateway') ||
    msg.includes('gateway timeout') ||
    msg.includes('functionshttperror') ||
    msg.includes('functionsrelayerror') ||
    msg.includes('non-2xx status code') ||
    msg.includes('non-2xx') ||
    msg.includes('edge function') && (msg.includes('fail') || msg.includes('error')) ||
    msg.includes('failed to parse url from') ||
    msg.includes('supabase_url')
  ) {
    return 'edge_function_502';
  }

  // --- Edge function timeout ---
  if (
    msg.includes('deadline exceeded') ||
    msg.includes('function timed out') ||
    msg.includes('execution time limit') ||
    msg.includes('timed out') && msg.includes('function')
  ) {
    return 'edge_function_timeout';
  }

  // --- Network errors ---
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('net::err') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound') ||
    msg.includes('aborterror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('cors') ||
    msg.includes('fetch') && msg.includes('fail')
  ) {
    return 'network';
  }

  // --- Not found ---
  if (
    status === 404 ||
    msg.includes('pgrst116') ||
    msg.includes('not found') && !msg.includes('row')
  ) {
    return 'not_found';
  }

  // --- Unique violation ---
  if (
    msg.includes('23505') ||
    msg.includes('unique_violation') ||
    msg.includes('duplicate key') ||
    msg.includes('already exists')
  ) {
    return 'unique_violation';
  }

  // --- Foreign key violation ---
  if (
    msg.includes('23503') ||
    msg.includes('foreign key') ||
    msg.includes('violates foreign key')
  ) {
    return 'foreign_key';
  }

  // --- Validation / constraint errors ---
  if (
    msg.includes('23502') ||
    msg.includes('not-null') ||
    msg.includes('violates check') ||
    msg.includes('invalid input') ||
    msg.includes('22p02') ||
    msg.includes('value too long') ||
    msg.includes('22001')
  ) {
    return 'validation';
  }

  // --- Storage errors ---
  if (
    msg.includes('storage') ||
    msg.includes('bucket') ||
    msg.includes('upload') && msg.includes('error') ||
    msg.includes('object not found') && msg.includes('storage')
  ) {
    return 'storage';
  }

  return 'unknown';
}

/**
 * Build a detailed, user-friendly error object from any caught error
 */
export function classifyDealError(
  err: unknown,
  operation: 'add' | 'delete' | 'update' | 'fetch' | 'search' | 'clear' | 'publish' | 'photos' | 'discover'
): ClassifiedError {
  const category = classifyError(err);
  const rawMessage = extractMessage(err);
  const errorCode = generateErrorCode(category);
  const timestamp = new Date().toISOString();

  const operationLabels: Record<string, string> = {
    add: 'adding the deal',
    delete: 'deleting the deal',
    update: 'updating the deal',
    fetch: 'loading deals',
    search: 'searching deals',
    clear: 'clearing all deals',
    publish: 'publishing the deal',
    photos: 'uploading photos',
    discover: 'discovering properties',
  };
  const opLabel = operationLabels[operation] || operation;

  switch (category) {
    case 'rls_permission':
      return {
        category,
        title: `Permission Denied — Cannot ${operation === 'fetch' ? 'Load' : operation.charAt(0).toUpperCase() + operation.slice(1)} Deal`,
        description: `The database rejected the request while ${opLabel} due to a Row-Level Security (RLS) policy restriction. This means the current session does not have the required permissions for this table.`,
        supportAction: `Report to support: "RLS policy blocking ${operation} on properties table." Reference: ${errorCode}. An admin needs to update the RLS policies in the Supabase Dashboard → Authentication → Policies.`,
        errorCode,
        rawMessage,
        timestamp,
      };

    case 'auth_expired':
      return {
        category,
        title: 'Session Expired',
        description: `Your authentication session has expired or is invalid. The system could not complete ${opLabel}.`,
        supportAction: 'Please log out and log back in. If the issue persists, clear your browser cookies and try again. If it still fails, contact support with reference: ' + errorCode,
        errorCode,
        rawMessage,
        timestamp,
      };

    case 'edge_function_502':
      return {
        category,
        title: `Server Error (502/504) — Edge Function Failure`,
        description: `The edge function returned a server error while ${opLabel}. This is typically caused by a missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable in the Edge Functions configuration. The system attempted a direct database fallback, but it also failed.`,
        supportAction: `Report to support: "Edge function returning 502/504. Likely missing SUPABASE_URL env var in Edge Functions Secrets." Reference: ${errorCode}. Admin should check Supabase Dashboard → Settings → Edge Functions → Secrets and ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.`,
        errorCode,
        rawMessage,
        timestamp,
      };

    case 'edge_function_timeout':
      return {
        category,
        title: 'Edge Function Timed Out',
        description: `The server function timed out while ${opLabel}. This may be due to a large dataset or slow external API response.`,
        supportAction: `Try again in a moment. If the issue persists, report to support: "Edge function timeout during ${operation}." Reference: ${errorCode}`,
        errorCode,
        rawMessage,
        timestamp,
      };

    case 'network':
      return {
        category,
        title: 'Network Connection Error',
        description: `Could not reach the server while ${opLabel}. This could be due to your internet connection, a VPN/firewall blocking the request, or the Supabase service being temporarily unavailable.`,
        supportAction: `Check your internet connection and try again. If you're on a VPN, try disconnecting it. If the issue persists, check https://status.supabase.com for service outages. Reference: ${errorCode}`,
        errorCode,
        rawMessage,
        timestamp,
      };

    case 'not_found':
      return {
        category,
        title: 'Record Not Found',
        description: `The property record was not found while ${opLabel}. It may have been deleted by another user or the ID is invalid.`,
        supportAction: `Refresh the deal list and try again. If the deal should exist, contact support with reference: ${errorCode}`,
        errorCode,
        rawMessage,
        timestamp,
      };

    case 'unique_violation':
      return {
        category,
        title: 'Duplicate Record',
        description: `A property with the same unique identifier already exists. The system prevented ${opLabel} to avoid duplicates.`,
        supportAction: `Check if this property has already been added. Search for the address in the deal flow. Reference: ${errorCode}`,
        errorCode,
        rawMessage,
        timestamp,
      };

    case 'foreign_key':
      return {
        category,
        title: 'Related Record Missing',
        description: `The operation failed while ${opLabel} because a related record (e.g., staff member, investor, or linked property) doesn't exist or was deleted.`,
        supportAction: `Ensure all referenced records exist. If deleting, try removing related records first. Reference: ${errorCode}`,
        errorCode,
        rawMessage,
        timestamp,
      };

    case 'validation':
      return {
        category,
        title: 'Invalid Data',
        description: `The data provided while ${opLabel} didn't pass database validation. A required field may be missing or a value may be in the wrong format.`,
        supportAction: `Double-check all required fields (address, city, state, monthly rent). Ensure numbers are valid and text fields aren't too long. Reference: ${errorCode}`,
        errorCode,
        rawMessage,
        timestamp,
      };

    case 'storage':
      return {
        category,
        title: 'Photo Storage Error',
        description: `There was an error with the photo storage system while ${opLabel}. The storage bucket may not exist or permissions may be misconfigured.`,
        supportAction: `Try saving the deal without photos first, then upload photos separately. Report to support: "Storage bucket error during photo upload." Reference: ${errorCode}`,
        errorCode,
        rawMessage,
        timestamp,
      };

    case 'rate_limit':
      return {
        category,
        title: 'Too Many Requests',
        description: `The server is rate-limiting requests while ${opLabel}. Too many operations were sent in a short period.`,
        supportAction: `Wait 30-60 seconds and try again. Avoid rapid repeated clicks. Reference: ${errorCode}`,
        errorCode,
        rawMessage,
        timestamp,
      };

    default:
      return {
        category: 'unknown',
        title: `Unexpected Error While ${operation.charAt(0).toUpperCase() + operation.slice(1)}ing Deal`,
        description: `An unexpected error occurred while ${opLabel}. The system was unable to determine the specific cause.`,
        supportAction: `Try again. If the issue persists, report to support with this information — Error: "${rawMessage.slice(0, 200)}". Reference: ${errorCode}`,
        errorCode,
        rawMessage,
        timestamp,
      };
  }
}

/**
 * Format a classified error into a toast-friendly object
 */
export function formatErrorToast(classified: ClassifiedError): {
  title: string;
  description: string;
  variant: 'destructive';
} {
  return {
    title: classified.title,
    description: `${classified.description}\n\n${classified.supportAction}`,
    variant: 'destructive' as const,
  };
}

/**
 * Log the full error details to console for debugging
 */
export function logDealError(classified: ClassifiedError, context?: Record<string, any>): void {
  console.error(
    `[DealError] ${classified.errorCode} | ${classified.category} | ${classified.timestamp}`,
    {
      title: classified.title,
      rawMessage: classified.rawMessage,
      supportAction: classified.supportAction,
      ...context,
    }
  );
}

/**
 * Convenience: classify, log, and return toast-ready error in one call
 */
export function handleDealError(
  err: unknown,
  operation: 'add' | 'delete' | 'update' | 'fetch' | 'search' | 'clear' | 'publish' | 'photos' | 'discover',
  context?: Record<string, any>
): {
  toast: { title: string; description: string; variant: 'destructive' };
  classified: ClassifiedError;
} {
  const classified = classifyDealError(err, operation);
  logDealError(classified, context);
  return {
    toast: formatErrorToast(classified),
    classified,
  };
}
