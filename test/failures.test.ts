import { describe, it, expect } from 'vitest';
import { classifyFailure, isTransient } from '../src/failures.js';

describe('classifyFailure', () => {
  it('classifies a Playwright navigation timeout', () => {
    expect(classifyFailure(new Error('page.goto: Timeout 20000ms exceeded.'))).toBe('timeout');
  });

  it('classifies DNS resolution failure', () => {
    expect(classifyFailure(new Error('net::ERR_NAME_NOT_RESOLVED at https://nope.invalid'))).toBe('dns');
    expect(classifyFailure(new Error('getaddrinfo ENOTFOUND example.invalid'))).toBe('dns');
  });

  it('classifies a refused/reset connection', () => {
    expect(classifyFailure(new Error('connect ECONNREFUSED 127.0.0.1:443'))).toBe('connection');
    expect(classifyFailure(new Error('net::ERR_CONNECTION_RESET'))).toBe('connection');
  });

  it('classifies a bot wall / forbidden as blocked', () => {
    expect(classifyFailure(new Error('Request failed with 403 Forbidden'))).toBe('blocked');
    expect(classifyFailure(new Error('net::ERR_TOO_MANY_REDIRECTS'))).toBe('blocked');
  });

  it('classifies a generic net failure as http-error', () => {
    expect(classifyFailure(new Error('net::ERR_ABORTED'))).toBe('http-error');
  });

  it('falls back to unknown for unrecognised errors', () => {
    expect(classifyFailure(new Error('something weird happened'))).toBe('unknown');
    expect(classifyFailure('not even an error')).toBe('unknown');
  });
});

describe('isTransient', () => {
  it('treats timeouts and connection blips as retry-worthy', () => {
    expect(isTransient('timeout')).toBe(true);
    expect(isTransient('connection')).toBe(true);
  });

  it('treats DNS, bot walls and HTTP errors as permanent', () => {
    expect(isTransient('dns')).toBe(false);
    expect(isTransient('blocked')).toBe(false);
    expect(isTransient('http-error')).toBe(false);
    expect(isTransient('unknown')).toBe(false);
  });
});
