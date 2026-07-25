# stacksniff

[![CI](https://github.com/JovanJevtic/stacksniff/actions/workflows/ci.yml/badge.svg)](https://github.com/JovanJevtic/stacksniff/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Detect the SaaS and tech stack a website runs — a booking tool, an EHR, a CMS, an analytics, support or payment vendor, a CDN, an error monitor — from **static signatures** plus an optional **headless Playwright probe**.

The detection core is synchronous and dependency-free: hand it whatever page signals you already have and it returns one deduplicated hit per tool. When you don't have the signals, `probe()` fetches them with a real browser. This is the "what is this site actually running" problem — the same shape as shadow-IT discovery, competitor research, and integration targeting.

```ts
import { detectStack, probe } from 'stacksniff';

// 1. You already have the HTML (from a crawler, a cache, an archive):
detectStack({ html: pageHtml, headers, scriptSrcs });
// -> [{ tool: 'stripe', category: 'payments', confidence: 'high', evidence: 'js.stripe.com' }, ...]

// 2. You have only a URL — let Playwright fetch the signals:
const { hits } = await probe('https://example.com');
```

Or from the command line, without writing any code:

```bash
$ npx stacksniff https://gymshark.com

https://www.gymshark.com/  [200]

  cdn
    - cloudflare  (high)
  ecommerce
    - shopify  (high)
  tag-manager
    - google-tag-manager  (high)
```

That's a real run — the output above is what the tool actually prints today.

## Where this fits

"What is this domain actually running?" is the same question behind a few different jobs:

- **Shadow-IT / SaaS discovery** — point it at a list of company domains and get back a per-domain inventory of the SaaS each one exposes on the public web. A first pass at "what are we actually using", before touching SSO logs or expense data.
- **Access & vendor mapping** — knowing a site runs Stripe, Intercom, a specific EHR or booking tool tells you which vendors an org depends on, and which integrations matter.
- **Integration targeting** — when you maintain automations against hundreds of SaaS products, detecting which ones a site uses is step zero.
- **Competitive / market research** — the same signal, aimed at a market instead of your own estate.

Feed a domain list straight in and get a JSON or CSV inventory:

```bash
$ printf 'gymshark.com\ntechcrunch.com\nlinear.app\n' | npx stacksniff --batch
[
  { "url": "https://gymshark.com",   "tools": ["google-tag-manager", "cloudflare", "shopify"] },
  { "url": "https://techcrunch.com", "tools": ["google-analytics", "microsoft-clarity", "wordpress", "google-tag-manager"] },
  { "url": "https://linear.app",     "tools": ["stripe", "cloudflare"] }
]

# or:  npx stacksniff --batch domains.txt --csv > inventory.csv
```

## Seen in the wild

Real `probe()` results against a few well-known sites — nothing hand-picked or mocked:

| Site | Detected |
| --- | --- |
| gymshark.com | `shopify` · `cloudflare` · `google-tag-manager` |
| techcrunch.com | `wordpress` · `google-analytics` · `microsoft-clarity` · `google-tag-manager` |
| linear.app | `stripe` · `cloudflare` |
| stripe.com | `stripe` |

## Why two layers

Static signatures are cheap and catch most of it: you don't load `js.stripe.com`, `widget.intercom.io`, or `cdn.shopify.com` by accident, so a request to a vendor's host is high-confidence evidence. But a lot of a modern page is assembled at runtime — script tags injected by a tag manager, cookies set after hydration, third-party widgets that only appear once the DOM settles. `probe()` renders the page in headless Chromium and hands the **rendered** HTML, the live script `src` list, the response headers, and the cookie names to the exact same `detectStack()`. One detector, two ways to feed it.

## Install

```bash
npm install stacksniff
# Playwright is an optional peer dependency — install it only if you use probe():
npm install playwright && npx playwright install chromium
```

`detectStack` and the canonicalization helpers have **zero runtime dependencies**. `probe()` imports Playwright dynamically, so nothing pulls a browser binary unless you actually probe a live URL.

## API

### `detectStack(signals): StackHit[]`

```ts
interface PageSignals {
  html?: string | null;        // rendered or raw HTML
  headers?: Record<string, string | string[] | undefined> | null;
  scriptSrcs?: string[] | null; // src of every <script> tag
  cookies?: string[] | null;    // names of cookies the page set
  cms?: string | null;          // a CMS captured out-of-band, mapped directly
}

interface StackHit {
  tool: string;                 // 'stripe', 'wordpress', 'calendly', ...
  category: 'analytics' | 'booking' | 'cms' | 'ecommerce' | 'ehr'
          | 'marketing' | 'payments' | 'support' | 'tag-manager';
  confidence: 'high' | 'medium' | 'low';
  evidence: string;             // the matched substring, capped at 200 chars
}
```

Every hit carries the substring that produced it, so a result set is auditable — you can see *why* a tool was flagged, not just that it was. `groupByCategory(hits)` buckets a result set by category when you want to render or summarise it.

Categories: `analytics`, `booking`, `cdn`, `cms`, `ecommerce`, `ehr`, `error-monitoring`, `forms`, `marketing`, `payments`, `support`, `tag-manager`, `video`.

### `probe(url, options?): Promise<ProbeResult>`

```ts
interface ProbeOptions {
  timeoutMs?: number;    // navigation timeout, default 20000
  userAgent?: string;    // defaults to a current desktop Chrome UA
  proxy?: { server: string; username?: string; password?: string };
  blockResources?: boolean; // block images/fonts/media, default true
  noSandbox?: boolean;      // --no-sandbox for containerised/root runs
}
```

Design choices worth calling out, because they're the difference between a demo and something that survives a real crawl:

- **`domcontentloaded`, not `networkidle`.** Analytics beacons keep a connection warm indefinitely, so `networkidle` routinely times out on live sites. Waiting on a concrete lifecycle event is faster and far more reliable.
- **Resource blocking by default.** The probe reads structure, not pixels. Aborting images, fonts and media at the network layer cuts page time dramatically across a large run.
- **`noSandbox` is opt-in.** In a container running as root, Chromium's setuid sandbox can't initialise and launches fail without `--no-sandbox`; on a normal desktop you want the sandbox kept, so it's off unless you ask.

### Canonicalization helpers

For deduping the same organisation across sources, where names arrive with different legal suffixes, casing and diacritics:

```ts
import { canonicalKey, normalizeName, extractCity } from 'stacksniff';

normalizeName('Klinika Sanus d.o.o.'); // 'sanus'
extractCity('Zmaja od Bosne 7, Sarajevo 71000'); // 'sarajevo'
canonicalKey('Studio Sanus', 'Ferhadija 5, Sarajevo'); // 'studio sanus__sarajevo'
```

Diacritic folding is tuned for South-Slavic names (č, ć, đ, š, ž), and `extractCity` skips trailing country tokens and postal codes when picking the city out of a free-form address.

## Running many URLs

`probeMany` runs a batch through a bounded worker pool, collapses to one URL per host by default (probing ten pages of one site learns nothing and looks like an attack), and settles every URL — a dead DNS, parked domain, timeout or bot wall becomes `{ ok: false }` instead of rejecting the whole run.

```ts
import { probeMany } from 'stacksniff';

const results = await probeMany(urls, {
  concurrency: 8,      // max pages in flight
  perHostOnce: true,   // one URL per host (default)
  retries: 1,          // retry transient failures only (timeout, connection)
  onSettled: (o) => {  // stream results as they land
    if (o.ok) console.log(o.url, o.result.hits.map((h) => h.tool));
    else console.warn(o.url, 'failed:', o.kind);
  },
});

const detected = results.filter((o) => o.ok);
```

Each failure is **classified**, not just caught: `o.kind` is one of `timeout`, `dns`, `connection`, `blocked`, `http-error`, `unknown`. That distinction is what makes retrying safe — `retries` only re-attempts *transient* failures (timeout, connection); a dead DNS or a bot wall fails once and moves on, because retrying it just wastes time and looks like hammering. `classifyFailure(err)` and `isTransient(kind)` are exported and unit-tested on their own.

`dedupeByHost(urls)` is likewise exported standalone — the pure, tested politeness rule the scheduler is built on.

## Benchmarks

Run them yourself: `npm run build && npm run bench`.

**Detection is effectively free.** The pure `detectStack()` path — the part you run once per page, potentially millions of times — clears a 24 KB page in **well under a millisecond**: roughly **2,000–3,000 pages/sec on a single core** (Node 20, mid-range laptop). Detection is never the bottleneck; the network is.

**The browser cost is paid once per batch, not once per page.** `probeMany` launches Chromium a single time and runs each URL in its own context, so a batch of *N* sites doesn't pay *N* cold browser starts. That's the difference between a crawler that scales and one that spends most of its wall-clock launching browsers.

The `probe`/`probeMany` wall-clock numbers are network-bound — they depend on your connection and the target sites, not on this library — so this repo ships the benchmark rather than a screenshot of numbers that wouldn't reproduce on your machine. `bench/bench.mjs` measures detection throughput, the resource-blocking trade-off, and serial-vs-pooled crawl time against live sites.

## Tests

```bash
npm test        # vitest, 47 cases, no browser required
npm run build   # tsc -> dist/
npm run bench   # detection throughput + live crawl timing
```

The detection and canonicalization logic is covered by unit tests over fixture strings — no network, no browser — so the core stays fast to verify and safe to change.

## Provenance

Extracted and generalized from the tech-detection layer of an internal lead-intelligence tool, rewritten as a standalone library with no business data attached. Built by [Jovan Jevtić](https://jjovan.com).

## License

MIT
