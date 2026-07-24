// Canonicalization for deduping the same organisation seen across multiple
// sources — where the name arrives with different legal suffixes, casing,
// diacritics, and address formatting. Zero runtime dependencies.

const LEGAL_SUFFIXES = [
  'd.o.o.', 'd.o.o', 'doo',
  'd.d.', 'd.d', 'dd',
  's.p.', 's.p', 'sp',
  'ltd', 'limited', 'llc', 'inc',
  'gmbh', 'ag',
];

function foldDiacritics(s: string): string {
  return s
    .replace(/[čć]/g, 'c') // č ć
    .replace(/[ČĆ]/g, 'c') // Č Ć
    .replace(/đ/g, 'd').replace(/Đ/g, 'd') // đ Đ
    .replace(/š/g, 's').replace(/Š/g, 's') // š Š
    .replace(/ž/g, 'z').replace(/Ž/g, 'z') // ž Ž
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function stripWord(s: string, word: string): string {
  const pattern = new RegExp(`(?:^|\\s)${word.replace(/\./g, '\\.')}(?=\\s|$)`, 'gi');
  return s.replace(pattern, ' ');
}

/**
 * Reduce an organisation name to a stable comparison key: lowercased, diacritic
 * -folded, legal suffixes and punctuation stripped, whitespace collapsed.
 * "Klinika Sanus d.o.o." and "KLINIKA SANUS" both fold to "sanus".
 */
export function normalizeName(raw: string): string {
  if (!raw) return '';
  let s = raw.toLowerCase();
  s = foldDiacritics(s);
  // Strip legal suffixes before removing dots so "d.o.o." still matches.
  for (const suffix of LEGAL_SUFFIXES) {
    s = stripWord(s, suffix);
  }
  // Collapse dotted abbreviations: "m.d." -> "md", "e." -> "e ".
  s = s.replace(/\b([a-z])\.([a-z])\./g, '$1$2');
  s = s.replace(/\b([a-z])\./g, '$1 ');
  s = s.replace(/[.,"'\-_/\\()]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// Trailing country/postal tokens that are noise when picking a city out of an
// address. All pre-normalized (lowercase + diacritic-folded).
const COUNTRY_TOKENS = new Set([
  'srbija', 'serbia',
  'crna gora', 'montenegro',
  'bih', 'bosna i hercegovina', 'bosna', 'bosnia', 'bosnia and herzegovina',
  'hrvatska', 'croatia',
  'slovenija', 'slovenia',
  'severna makedonija', 'makedonija', 'macedonia', 'north macedonia',
  'kosovo',
]);

function isPostalCode(token: string): boolean {
  return /^\d{3,6}$/.test(token.trim());
}

/**
 * Pull the city out of a free-form address or region string, walking from the
 * end and skipping trailing country names and postal codes.
 */
export function extractCity(addressOrRegion: string | null | undefined): string {
  if (!addressOrRegion) return '';
  const parts = addressOrRegion.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';

  for (let i = parts.length - 1; i >= 0; i--) {
    const normalized = foldDiacritics((parts[i] ?? '').toLowerCase()).trim();
    if (COUNTRY_TOKENS.has(normalized)) continue;
    if (isPostalCode(normalized)) continue;
    // Trim a trailing postal code from within a "City 11000" token.
    const withoutPostal = normalized.replace(/\s+\d{3,6}$/, '').trim();
    if (withoutPostal) return withoutPostal;
  }

  return foldDiacritics((parts[parts.length - 1] ?? '').toLowerCase()).trim();
}

/**
 * A dedup key combining normalized name and city. Same org across sources ->
 * same key; same name in different cities -> different keys.
 */
export function canonicalKey(companyName: string, addressOrRegion: string | null | undefined): string {
  return `${normalizeName(companyName)}__${extractCity(addressOrRegion)}`;
}
