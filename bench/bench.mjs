// Benchmarks for stacksniff. Run: npm run build && npm run bench
// The detection microbench is deterministic; the probe/probeMany numbers are
// live network measurements, so absolute values depend on your link and the
// target sites. What's stable is the *shape*: resource-blocking cuts page time,
// and the worker pool turns a serial crawl into a near-flat one.
import { performance } from 'node:perf_hooks';
import { detectStack, probe, probeMany } from '../dist/index.js';

const SAMPLE_HTML = `
<!doctype html><html><head>
<meta name="generator" content="WordPress 6.4">
<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABCD123"></script>
<script src="https://js.stripe.com/v3/"></script>
<script src="https://widget.intercom.io/widget/abc123"></script>
<script src="https://cdn.segment.com/analytics.js/v1/xyz/analytics.min.js"></script>
<link rel="preconnect" href="https://cdn.shopify.com">
</head><body>${'lorem ipsum '.repeat(2000)}
book: https://calendly.com/acme/intro</body></html>`;

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function benchDetect() {
  const N = 200_000;
  // warmup
  for (let i = 0; i < 5_000; i++) detectStack({ html: SAMPLE_HTML });
  const t0 = performance.now();
  for (let i = 0; i < N; i++) detectStack({ html: SAMPLE_HTML });
  const ms = performance.now() - t0;
  const perSec = Math.round(N / (ms / 1000));
  console.log(`\ndetectStack()  —  ${N.toLocaleString()} calls over a ${(SAMPLE_HTML.length / 1024).toFixed(0)} KB page`);
  console.log(`  ${perSec.toLocaleString()} pages/sec   (${(ms / N * 1000).toFixed(2)} µs/page)`);
}

async function benchBlocking(url) {
  const runs = 3;
  const timed = async (blockResources) => {
    const ts = [];
    for (let i = 0; i < runs; i++) {
      const t0 = performance.now();
      await probe(url, { blockResources });
      ts.push(performance.now() - t0);
    }
    return Math.round(median(ts));
  };
  const on = await timed(true);
  const off = await timed(false);
  console.log(`\nprobe("${url}")  —  median of ${runs} runs`);
  console.log(`  resource-blocking on:   ${on} ms`);
  console.log(`  resource-blocking off:  ${off} ms   (${(off / on).toFixed(1)}x slower)`);
}

async function benchPool(urls) {
  const time = async (concurrency) => {
    const t0 = performance.now();
    const settled = await probeMany(urls, { concurrency });
    const ms = performance.now() - t0;
    const ok = settled.filter((s) => s.ok).length;
    return { ms: Math.round(ms), ok };
  };
  const serial = await time(1);
  const pooled = await time(8);
  console.log(`\nprobeMany()  —  ${urls.length} sites`);
  console.log(`  concurrency 1:  ${serial.ms} ms   (${serial.ok} ok)`);
  console.log(`  concurrency 8:  ${pooled.ms} ms   (${pooled.ok} ok)   ${(serial.ms / pooled.ms).toFixed(1)}x faster`);
}

const POOL_SITES = [
  'https://stripe.com', 'https://vercel.com', 'https://linear.app',
  'https://gymshark.com', 'https://basecamp.com', 'https://github.com',
  'https://cloudflare.com', 'https://notion.so',
];

benchDetect();
await benchBlocking('https://techcrunch.com');
await benchPool(POOL_SITES);
console.log('');
