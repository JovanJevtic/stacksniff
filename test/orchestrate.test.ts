import { describe, it, expect } from 'vitest';
import { dedupeByHost, parseUrlList } from '../src/orchestrate.js';

describe('dedupeByHost', () => {
  it('keeps one URL per host, preserving first-seen order', () => {
    const out = dedupeByHost([
      'https://a.com/one',
      'https://a.com/two',
      'https://b.com/',
      'https://a.com/three',
    ]);
    expect(out).toEqual(['https://a.com/one', 'https://b.com/']);
  });

  it('treats host case-insensitively', () => {
    const out = dedupeByHost(['https://Example.com/a', 'https://example.com/b']);
    expect(out).toHaveLength(1);
  });

  it('distinguishes subdomains as separate hosts', () => {
    const out = dedupeByHost(['https://shop.example.com', 'https://www.example.com']);
    expect(out).toHaveLength(2);
  });

  it('drops unparseable URLs instead of throwing', () => {
    const out = dedupeByHost(['not a url', 'https://ok.com/']);
    expect(out).toEqual(['https://ok.com/']);
  });

  it('returns an empty array for empty input', () => {
    expect(dedupeByHost([])).toEqual([]);
  });
});

describe('parseUrlList', () => {
  it('parses one URL per line', () => {
    expect(parseUrlList('https://a.com\nhttps://b.com')).toEqual(['https://a.com', 'https://b.com']);
  });

  it('adds https:// to bare hosts', () => {
    expect(parseUrlList('example.com')).toEqual(['https://example.com']);
  });

  it('skips blank lines and # comments', () => {
    expect(parseUrlList('# vendors\n\nacme.com\n  \n# note\nbeta.io')).toEqual([
      'https://acme.com',
      'https://beta.io',
    ]);
  });

  it('trims surrounding whitespace and handles CRLF', () => {
    expect(parseUrlList('  a.com \r\n b.com ')).toEqual(['https://a.com', 'https://b.com']);
  });

  it('leaves an http:// URL untouched', () => {
    expect(parseUrlList('http://legacy.local')).toEqual(['http://legacy.local']);
  });
});
