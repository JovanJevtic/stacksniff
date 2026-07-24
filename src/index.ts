export { detectStack, groupByCategory } from './detect.js';
export type { PageSignals, StackHit, StackCategory } from './detect.js';
export { SIGNATURES, CMS_TOOL_MAP } from './signatures.js';
export type { Signature } from './signatures.js';
export { probe } from './probe.js';
export type { ProbeOptions, ProbeResult, ProxyConfig } from './probe.js';
export { probeMany, dedupeByHost } from './orchestrate.js';
export type { ProbeManyOptions, SettledProbe } from './orchestrate.js';
export { normalizeName, extractCity, canonicalKey } from './canonical.js';
