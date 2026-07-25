// Classify a probe failure so the caller can decide whether to retry.
// DNS failures and bot walls are permanent; timeouts and connection resets are
// usually transient and worth another attempt.

export type FailureKind =
  | 'timeout'
  | 'dns'
  | 'connection'
  | 'blocked'
  | 'http-error'
  | 'unknown';

/** Map a probe error to a FailureKind by matching Playwright/Chromium/Node messages. */
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

/** Transient failures (timeout, connection) are worth retrying; the rest aren't. */
export function isTransient(kind: FailureKind): boolean {
  return kind === 'timeout' || kind === 'connection';
}
