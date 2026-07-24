import { describe, it, expect } from 'vitest';
import { dedupeByHost } from '../src/orchestrate.js';

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
