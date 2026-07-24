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
   * Block images, fonts and media at the network layer. On by default: the
   * probe reads structure, not pixels, and blocking heavy resources cuts page
   * time dramatically on a large crawl.
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

/**
 * Fetch a URL with a real headless browser and detect its SaaS/tech stack.
 *
 * Playwright is a peer dependency and imported dynamically, so the detection
 * core stays dependency-free — install a browser only if you actually probe
 * live URLs. One page per call; drive concurrency and per-domain politeness
 * from the caller (see the README).
 */
export async function probe(url: string, options: ProbeOptions = {}): Promise<ProbeResult> {
  const {
    timeoutMs = 20_000,
    userAgent = DEFAULT_UA,
    proxy,
    blockResources = true,
    noSandbox = false,
  } = options;

  const { chromium } = await import('playwright');

  const launchArgs = noSandbox
    ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    : [];

  const browser = await chromium.launch({ args: launchArgs, proxy });
  try {
    const context = await browser.newContext({ userAgent });
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
    await browser.close();
  }
}
