import { CMS_TOOL_MAP, SIGNATURES } from './signatures.js';

export type StackCategory =
  | 'analytics'
  | 'booking'
  | 'cdn'
  | 'cms'
  | 'ecommerce'
  | 'ehr'
  | 'error-monitoring'
  | 'forms'
  | 'marketing'
  | 'payments'
  | 'support'
  | 'tag-manager'
  | 'video';

export interface StackHit {
  /** Canonical tool id, e.g. `stripe`, `wordpress`, `calendly`. */
  tool: string;
  category: StackCategory;
  confidence: 'high' | 'medium' | 'low';
  /** The substring that matched — kept short so results stay auditable. */
  evidence: string;
}

export interface PageSignals {
  /** Rendered or raw HTML of the page. */
  html?: string | null;
  /** Response header values (any casing) — joined and scanned. */
  headers?: Record<string, string | string[] | undefined> | null;
  /** `src` of every <script> tag on the page. */
  scriptSrcs?: string[] | null;
  /** Names of cookies the page set. */
  cookies?: string[] | null;
  /**
   * A CMS captured out-of-band (e.g. a `generator` meta a crawler already
   * parsed). Mapped directly, so detection still works when the body carries
   * no embedded signature.
   */
  cms?: string | null;
}

function flattenHeaders(headers: PageSignals['headers']): string {
  if (!headers) return '';
  const out: string[] = [];
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    out.push(`${key}: ${Array.isArray(value) ? value.join(' ') : value}`);
  }
  return out.join('\n');
}

/**
 * Detect third-party SaaS and platform tooling from a page's signals.
 *
 * Purely synchronous and dependency-free: hand it whatever you have (raw HTML,
 * response headers, script srcs) and it returns one deduplicated hit per tool.
 * Pair it with {@link probe} when you need those signals fetched by a real
 * browser; use it standalone when you already have the HTML.
 */
export function detectStack(signals: PageSignals | null | undefined): StackHit[] {
  if (!signals) return [];

  const haystack = [
    signals.html || '',
    flattenHeaders(signals.headers),
    (signals.scriptSrcs || []).join('\n'),
    (signals.cookies || []).join('\n'),
  ].join('\n');

  const hits = new Map<string, StackHit>();

  // Direct CMS mapping takes precedence over signature guessing.
  const cms = signals.cms ? signals.cms.toLowerCase().trim() : '';
  if (cms && CMS_TOOL_MAP[cms]) {
    const tool = CMS_TOOL_MAP[cms];
    hits.set(tool, { tool, category: 'cms', confidence: 'high', evidence: `cms field: ${cms}` });
  }

  for (const sig of SIGNATURES) {
    if (hits.has(sig.tool)) continue;
    const match = sig.regex.exec(haystack);
    if (match) {
      hits.set(sig.tool, {
        tool: sig.tool,
        category: sig.category,
        confidence: sig.confidence,
        evidence: (match[0] ?? sig.tool).slice(0, 200),
      });
    }
  }

  return Array.from(hits.values());
}

/** Group hits by category, e.g. for rendering or summarising a result set. */
export function groupByCategory(hits: StackHit[]): Partial<Record<StackCategory, StackHit[]>> {
  const out: Partial<Record<StackCategory, StackHit[]>> = {};
  for (const hit of hits) {
    (out[hit.category] ??= []).push(hit);
  }
  return out;
}
