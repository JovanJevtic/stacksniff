import { describe, it, expect } from 'vitest';
import { canonicalKey, normalizeName, extractCity } from '../src/canonical.js';

describe('normalizeName', () => {
  it('lowercases input', () => {
    expect(normalizeName('ACME Studio')).toBe('acme studio');
  });

  it('strips punctuation', () => {
    expect(normalizeName('Petrović, M.D.')).toBe('petrovic md');
  });

  it('removes common legal suffixes', () => {
    expect(normalizeName('Sanus d.o.o.')).toBe('sanus');
    expect(normalizeName('Acme Ltd')).toBe('acme');
    expect(normalizeName('Nordic AG')).toBe('nordic');
  });

  it('collapses whitespace', () => {
    expect(normalizeName('Studio    North   West')).toBe('studio north west');
  });

  it('folds diacritics to ASCII', () => {
    expect(normalizeName('Petrović')).toBe('petrovic');
    expect(normalizeName('Šarić Ž.')).toBe('saric z');
  });
});

describe('extractCity', () => {
  it('extracts the last comma-separated token as city', () => {
    expect(extractCity('Zmaja od Bosne 14, Sarajevo')).toBe('sarajevo');
  });

  it('returns the region when there is no comma', () => {
    expect(extractCity('Banja Luka')).toBe('banja luka');
  });

  it('trims and lowercases', () => {
    expect(extractCity('  NOVI SAD  ')).toBe('novi sad');
  });

  it('returns empty string for null/undefined', () => {
    expect(extractCity(null)).toBe('');
    expect(extractCity(undefined)).toBe('');
  });

  it('skips a trailing country token', () => {
    expect(extractCity('Hilandarska 21, Beograd 11102, Srbija')).toBe('beograd');
  });

  it('skips a trailing postal-code-only token', () => {
    expect(extractCity('Ulica 20B, Niš, 18000')).toBe('nis');
  });

  it('strips an inline postal code from the city token', () => {
    expect(extractCity('Zmaja od Bosne 7, Sarajevo 71000')).toBe('sarajevo');
  });
});

describe('canonicalKey', () => {
  it('combines normalized name and city with a double underscore', () => {
    expect(canonicalKey('Studio Sanus', 'Ferhadija 5, Sarajevo')).toBe('studio sanus__sarajevo');
  });

  it('is stable across legal-suffix and casing variation', () => {
    const a = canonicalKey('Sanus d.o.o.', 'Sarajevo');
    const b = canonicalKey('SANUS', 'Sarajevo');
    expect(a).toBe(b);
  });

  it('does not collide across cities', () => {
    const a = canonicalKey('Studio Jug', 'Sarajevo');
    const b = canonicalKey('Studio Jug', 'Beograd');
    expect(a).not.toBe(b);
  });
});
