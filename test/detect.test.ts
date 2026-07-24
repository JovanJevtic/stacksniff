import { describe, it, expect } from 'vitest';
import { detectStack, groupByCategory } from '../src/detect.js';

describe('detectStack', () => {
  it('detects calendly from a URL in the HTML', () => {
    const r = detectStack({ html: 'Book here: https://calendly.com/acme/intro' });
    expect(r.some((t) => t.tool === 'calendly' && t.confidence === 'high')).toBe(true);
  });

  it('detects stripe from a script src', () => {
    const r = detectStack({ scriptSrcs: ['https://js.stripe.com/v3/'] });
    const stripe = r.find((t) => t.tool === 'stripe');
    expect(stripe?.category).toBe('payments');
  });

  it('detects wordpress from a generator meta', () => {
    const r = detectStack({ html: '<meta name="generator" content="WordPress 6.4">' });
    expect(r.some((t) => t.tool === 'wordpress')).toBe(true);
  });

  it('detects wix from a CDN reference', () => {
    const r = detectStack({ html: '<script src="https://static.parastorage.com/services/wix-bootstrap/">' });
    expect(r.some((t) => t.tool === 'wix')).toBe(true);
  });

  it('detects a tool from a response header (CSP script-src host)', () => {
    const r = detectStack({ headers: { 'content-security-policy': "script-src 'self' https://js.stripe.com" } });
    // the CSP header lists the allowed script host even when the body has no signature
    expect(r.some((t) => t.tool === 'stripe')).toBe(true);
  });

  it('maps a CMS field directly, taking precedence', () => {
    const r = detectStack({ cms: 'webflow' });
    expect(r).toEqual([{ tool: 'webflow', category: 'cms', confidence: 'high', evidence: 'cms field: webflow' }]);
  });

  it('detects multiple distinct tools on one page', () => {
    const r = detectStack({
      html: '<link rel="stylesheet" href="https://site.example/wp-content/themes/acme/style.css">',
      scriptSrcs: ['https://js.stripe.com/v3/', 'https://widget.intercom.io/widget/abc'],
    });
    const tools = r.map((t) => t.tool).sort();
    expect(tools).toContain('wordpress');
    expect(tools).toContain('stripe');
    expect(tools).toContain('intercom');
  });

  it('returns one hit per tool even on repeated matches', () => {
    const r = detectStack({ html: 'calendly.com/a and calendly.com/b' });
    expect(r.filter((t) => t.tool === 'calendly')).toHaveLength(1);
  });

  it('returns an empty array when nothing matches', () => {
    expect(detectStack({ html: 'Plain page, no third-party tools.' })).toEqual([]);
  });

  it('handles null and undefined input', () => {
    expect(detectStack(null)).toEqual([]);
    expect(detectStack(undefined)).toEqual([]);
  });

  it('keeps evidence short and auditable', () => {
    const r = detectStack({ html: `x${'a'.repeat(500)}js.stripe.com` });
    const stripe = r.find((t) => t.tool === 'stripe');
    expect(stripe).toBeDefined();
    expect(stripe!.evidence.length).toBeLessThanOrEqual(200);
  });

  it('detects a CDN from a response header alone', () => {
    const r = detectStack({ headers: { 'cf-ray': '8ab12cd34ef56-FRA', server: 'cloudflare' } });
    expect(r.some((t) => t.tool === 'cloudflare' && t.category === 'cdn')).toBe(true);
  });
});

describe('groupByCategory', () => {
  it('buckets hits by their category', () => {
    const grouped = groupByCategory([
      { tool: 'stripe', category: 'payments', confidence: 'high', evidence: 'js.stripe.com' },
      { tool: 'paypal', category: 'payments', confidence: 'high', evidence: 'paypal.com/sdk/js' },
      { tool: 'wordpress', category: 'cms', confidence: 'high', evidence: 'wp-content' },
    ]);
    expect(grouped.payments).toHaveLength(2);
    expect(grouped.cms).toHaveLength(1);
    expect(grouped.analytics).toBeUndefined();
  });

  it('returns an empty object for no hits', () => {
    expect(groupByCategory([])).toEqual({});
  });
});
