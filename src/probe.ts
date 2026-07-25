import type { Browser } from 'playwright';
import { detectStack, type PageSignals, type StackHit } from './detect.js';

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

export interface ProbeOptions {
  /** Navigation timeout in ms. Default 20000. */
  timeoutMs?: number;
  /** Override the User-Agent. Defaults to a current desktop Chrome string. */
  userAgent?: string;
  /** Residential/datacenter proxy. Many sites block datacenter headless traffic. */
  proxy?: ProxyConfig;
  /**
   * Block images, fonts and media at the network layer, on by default. The
   * probe reads markup, not pixels, so this saves bandwidth on large crawls.
   */
  blockResources?: boolean;
  /**
   * Pass `--no-sandbox` to Chromium. Required when running as root in a
   * container, where the setuid sandbox can't initialise. Off by default so a
   * normal desktop run keeps the sandbox.
   */
  noSandbox?: boolean;
}

export interface ProbeResult {
  url: string;
  finalUrl: string;
  status: number | null;
  hits: StackHit[];
  /** The raw signals detection ran on — handy for debugging a miss. */
  signals: PageSignals;
}

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BLOCKED_RESOURCES = new Set(['image', 'media', 'font']);

/** Chromium launch args, gated on `noSandbox`. Exported so a shared-browser caller uses the same set. */
export function launchArgs(noSandbox?: boolean): string[] {
  return noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] : [];
}

type PageOptions = Pick<ProbeOptions, 'timeoutMs' | 'userAgent' | 'blockResources'>;

/**
 * Probe one URL on an already-launched browser, in its own fresh context
 * (isolated cookies and storage). probeMany fans this out across one browser.
 */
export async function probeOnBrowser(browser: Browser, url: string, options: PageOptions = {}): Promise<ProbeResult> {
  const { timeoutMs = 20_000, userAgent = DEFAULT_UA, blockResources = true } = options;

  const context = await browser.newContext({ userAgent });
  try {
    const page = await context.newPage();

    if (blockResources) {
      await page.route('**/*', (route) => {
        if (BLOCKED_RESOURCES.has(route.request().resourceType())) return route.abort();
        return route.continue();
      });
    }

    // domcontentloaded, not networkidle: analytics beacons keep the connection
    // warm indefinitely, so networkidle routinely times out on live sites.
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    const html = await page.content();
    const scriptSrcs = await page.$$eval('script[src]', (nodes) =>
      nodes.map((n) => (n as HTMLScriptElement).src).filter(Boolean),
    );
    const cookies = (await context.cookies()).map((c) => c.name);
    const headers = response ? response.headers() : {};

    const signals: PageSignals = { html, headers, scriptSrcs, cookies };

    return {
      url,
      finalUrl: page.url(),
      status: response ? response.status() : null,
      hits: detectStack(signals),
      signals,
    };
  } finally {
    await context.close();
  }
}

/**
 * Fetch a single URL with a headless browser and detect its SaaS/tech stack.
 * Launches and closes its own browser; for many URLs use probeMany, which
 * shares one browser across the batch. Playwright is imported dynamically, so
 * you only need a browser installed if you actually call this.
 */
export async function probe(url: string, options: ProbeOptions = {}): Promise<ProbeResult> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ args: launchArgs(options.noSandbox), proxy: options.proxy });
  try {
    return await probeOnBrowser(browser, url, options);
  } finally {
    await browser.close();
  }
}
