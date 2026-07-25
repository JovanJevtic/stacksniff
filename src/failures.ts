// A crawl at any real scale needs a failure *taxonomy*, not a bare retry loop.
// Dead DNS is permanent and shouldn't be retried; a timeout or a reset
// connection is transient and usually worth one more attempt. Classifying the
// error is what lets the scheduler make that call.

export type FailureKind =
  | 'timeout'
  | 'dns'
  | 'connection'
  | 'blocked'
  | 'http-error'
  | 'unknown';

/** Bucket a probe error by its underlying cause, reading Playwright/Chromium/Node messages. */
export function classifyFailure(err: unknown): FailureKind {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  if (/timeout|timed out|exceeded/.test(msg)) return 'timeout';
  if (/err_name_not_resolved|enotfound|getaddrinfo|dns/.test(msg)) return 'dns';
  if (/econnrefused|econnreset|err_connection|err_socket|err_network_changed|socket hang up/.test(msg)) {
    return 'connection';
  }
  if (/err_too_many_redirects|err_http2_protocol_error|forbidden|\b403\b|\b429\b|captcha|access denied/.test(msg)) {
    return 'blocked';
  }
  if (/err_aborted|err_failed|err_http_response_code_failure|net::err_/.test(msg)) return 'http-error';
  return 'unknown';
}

/**
 * Whether a failure is worth retrying. Timeouts and connection blips are
 * transient; DNS, bot walls and HTTP errors will just fail again, so retrying
 * them only wastes time and looks like hammering.
 */
export function isTransient(kind: FailureKind): boolean {
  return kind === 'timeout' || kind === 'connection';
}
