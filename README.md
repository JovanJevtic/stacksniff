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
npx stacksniff https://example.com

# example.com  [200]
#
#   analytics
#     - google-analytics  (high)
#   cdn
#     - cloudflare  (high)
#   payments
#     - stripe  (high)
```

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
  onSettled: (o) => {  // stream results as they land
    if (o.ok) console.log(o.url, o.result.hits.map((h) => h.tool));
  },
});

const detected = results.filter((o) => o.ok);
```

`dedupeByHost(urls)` is exported on its own — it's the pure, tested politeness rule the scheduler is built on.

## Tests

```bash
npm test        # vitest, 34 cases, no browser required
npm run build   # tsc -> dist/
```

The detection and canonicalization logic is covered by unit tests over fixture strings — no network, no browser — so the core stays fast to verify and safe to change.

## Provenance

Extracted and generalized from the tech-detection layer of an internal lead-intelligence tool, rewritten as a standalone library with no business data attached. Built by [Jovan Jevtić](https://jjovan.com).

## License

MIT
