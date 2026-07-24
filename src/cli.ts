#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { probe } from './probe.js';
import { probeMany, parseUrlList } from './orchestrate.js';
import { groupByCategory } from './detect.js';

const USAGE = `stacksniff — detect the SaaS/tech stack a website runs

Usage:
  stacksniff <url> [--json] [--no-sandbox] [--timeout <ms>]
  stacksniff --batch [<file>] [--csv] [--concurrency <n>] [--no-sandbox]

Single URL:
  --json          Print raw JSON instead of a grouped table

Batch / inventory (reads a URL list from <file>, or stdin if omitted):
  --csv           Emit "url,tool,category,confidence" rows instead of JSON
  --concurrency   Pages fetched at once (default 8)

Common:
  --no-sandbox    Pass --no-sandbox to Chromium (containers / root)
  --timeout <ms>  Navigation timeout (default 20000)

Requires Playwright:  npm i playwright && npx playwright install chromium
`;

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function isPlaywrightMissing(msg: string): boolean {
  return /cannot find (module|package) 'playwright'/i.test(msg);
}

async function runBatch(args: string[]): Promise<number> {
  const csv = args.includes('--csv');
  const noSandbox = args.includes('--no-sandbox');
  const concurrency = Number(flag(args, '--concurrency')) || 8;
  const timeoutMs = flag(args, '--timeout') ? Number(flag(args, '--timeout')) : undefined;

  // A positional arg after --batch is a file; otherwise read stdin.
  const batchIdx = args.indexOf('--batch');
  const maybeFile = args[batchIdx + 1];
  const file = maybeFile && !maybeFile.startsWith('-') ? maybeFile : undefined;

  const text = file ? readFileSync(file, 'utf8') : await readStdin();
  const urls = parseUrlList(text);
  if (urls.length === 0) {
    process.stderr.write('error: no URLs to probe (empty list)\n');
    return 1;
  }

  process.stderr.write(`probing ${urls.length} site(s) at concurrency ${concurrency}…\n`);
  const settled = await probeMany(urls, { concurrency, noSandbox, timeoutMs });

  if (csv) {
    process.stdout.write('url,tool,category,confidence\n');
    for (const o of settled) {
      if (!o.ok) continue;
      for (const hit of o.result.hits) {
        process.stdout.write(`${o.result.finalUrl},${hit.tool},${hit.category},${hit.confidence}\n`);
      }
    }
    return 0;
  }

  const inventory = settled.map((o) =>
    o.ok
      ? { url: o.url, finalUrl: o.result.finalUrl, status: o.result.status, tools: o.result.hits.map((h) => h.tool) }
      : { url: o.url, error: o.error.message },
  );
  process.stdout.write(JSON.stringify(inventory, null, 2) + '\n');
  return 0;
}

async function runSingle(args: string[], url: string): Promise<number> {
  const json = args.includes('--json');
  const noSandbox = args.includes('--no-sandbox');
  const timeoutMs = flag(args, '--timeout') ? Number(flag(args, '--timeout')) : undefined;

  let result;
  try {
    result = await probe(url, { noSandbox, timeoutMs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      isPlaywrightMissing(msg)
        ? 'error: Playwright is not installed.\n  npm i playwright && npx playwright install chromium\n'
        : `error probing ${url}: ${msg}\n`,
    );
    return 1;
  }

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return 0;
  }

  process.stdout.write(`\n${result.finalUrl}  [${result.status ?? '?'}]\n`);
  if (result.hits.length === 0) {
    process.stdout.write('  no known tools detected\n');
    return 0;
  }
  const grouped = groupByCategory(result.hits);
  for (const category of Object.keys(grouped).sort()) {
    process.stdout.write(`\n  ${category}\n`);
    for (const hit of grouped[category as keyof typeof grouped]!) {
      process.stdout.write(`    - ${hit.tool}  (${hit.confidence})\n`);
    }
  }
  process.stdout.write('\n');
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    process.stdout.write(USAGE);
    return args.length === 0 ? 1 : 0;
  }

  if (args.includes('--batch')) return runBatch(args);

  const url = args.find((a) => !a.startsWith('-'));
  if (!url) {
    process.stderr.write('error: no URL given\n\n' + USAGE);
    return 1;
  }
  return runSingle(args, url);
}

main(process.argv)
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`unexpected error: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
