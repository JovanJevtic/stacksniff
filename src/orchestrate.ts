import { probeOnBrowser, launchArgs, type ProbeOptions, type ProbeResult } from './probe.js';

/**
 * Collapse a URL list to one URL per host. A crawl that probes ten pages of the
 * same site learns nothing new and looks like an attack — politeness is a
 * property of the schedule, not a `sleep()` bolted on later. Pure and testable.
 */
export function dedupeByHost(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    let host: string;
    try {
      host = new URL(url).host.toLowerCase();
    } catch {
      continue; // drop unparseable URLs rather than crash the run
    }
    if (seen.has(host)) continue;
    seen.add(host);
    out.push(url);
  }
  return out;
}

/**
 * Parse a newline-separated list of URLs (a file, or stdin). Blank lines and
 * `#` comments are dropped; bare hosts get an `https://` prefix so a plain
 * domain list works as-is.
 */
export function parseUrlList(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    out.push(/^https?:\/\//i.test(line) ? line : `https://${line}`);
  }
  return out;
}

export interface ProbeManyOptions extends ProbeOptions {
  /** Max pages fetched at once. Default 8. */
  concurrency?: number;
  /** Probe at most one URL per host. Default true. */
  perHostOnce?: boolean;
  /** Called as each result settles — stream results instead of waiting for all. */
  onSettled?: (outcome: SettledProbe, index: number) => void;
}

export type SettledProbe =
  | { url: string; ok: true; result: ProbeResult }
  | { url: string; ok: false; error: Error };

/**
 * Probe many URLs with a bounded worker pool. A failed page (dead DNS, parked
 * domain, timeout, bot wall) settles to `{ ok: false }` and never rejects the
 * batch — a long crawl must survive its own bad URLs.
 */
export async function probeMany(urls: string[], options: ProbeManyOptions = {}): Promise<SettledProbe[]> {
  const { concurrency = 8, perHostOnce = true, onSettled, proxy, noSandbox, ...pageOptions } = options;
  const targets = perHostOnce ? dedupeByHost(urls) : urls.slice();
  const results: SettledProbe[] = new Array(targets.length);
  if (targets.length === 0) return results;

  // Launch the browser once for the whole batch; each URL runs in its own
  // context. Browser launch is the expensive part — paying it per URL is what
  // makes a naive crawler slow.
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ args: launchArgs(noSandbox), proxy });
  try {
    let next = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const i = next++;
        if (i >= targets.length) return;
        const url = targets[i]!;
        let settled: SettledProbe;
        try {
          settled = { url, ok: true, result: await probeOnBrowser(browser, url, pageOptions) };
        } catch (err) {
          settled = { url, ok: false, error: err instanceof Error ? err : new Error(String(err)) };
        }
        results[i] = settled;
        onSettled?.(settled, i);
      }
    };

    const pool = Array.from({ length: Math.min(concurrency, targets.length) }, () => worker());
    await Promise.all(pool);
  } finally {
    await browser.close();
  }
  return results;
}
