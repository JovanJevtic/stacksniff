#!/usr/bin/env node
import { probe } from './probe.js';
import { groupByCategory } from './detect.js';

const USAGE = `stacksniff — detect the SaaS/tech stack a website runs

Usage:
  stacksniff <url> [--json] [--no-sandbox] [--timeout <ms>]

Options:
  --json          Print raw JSON instead of a grouped table
  --no-sandbox    Pass --no-sandbox to Chromium (containers / root)
  --timeout <ms>  Navigation timeout (default 20000)

Requires Playwright:  npm i playwright && npx playwright install chromium
`;

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    process.stdout.write(USAGE);
    return args.length === 0 ? 1 : 0;
  }

  const json = args.includes('--json');
  const noSandbox = args.includes('--no-sandbox');
  const timeoutIdx = args.indexOf('--timeout');
  const timeoutMs = timeoutIdx >= 0 ? Number(args[timeoutIdx + 1]) : undefined;
  const url = args.find((a) => !a.startsWith('-') && a !== String(timeoutMs));

  if (!url) {
    process.stderr.write('error: no URL given\n\n' + USAGE);
    return 1;
  }

  let result;
  try {
    result = await probe(url, { noSandbox, timeoutMs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cannot find (module|package) 'playwright'/i.test(msg)) {
      process.stderr.write('error: Playwright is not installed.\n  npm i playwright && npx playwright install chromium\n');
    } else {
      process.stderr.write(`error probing ${url}: ${msg}\n`);
    }
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
    const hits = grouped[category as keyof typeof grouped]!;
    process.stdout.write(`\n  ${category}\n`);
    for (const hit of hits) {
      process.stdout.write(`    - ${hit.tool}  (${hit.confidence})\n`);
    }
  }
  process.stdout.write('\n');
  return 0;
}

main(process.argv)
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`unexpected error: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
