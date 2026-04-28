import { extractJsonObject } from "../lib/json.js";

export interface DiscoveryTermCandidate {
  term: string;
  status: string;
  priority: number;
  totalRuns: number;
  totalSignals: number;
  totalProspects: number;
  lastUsedAt: number | null;
  lastYieldAt: number | null;
}

export interface PlannedDiscoveryTerm {
  term: string;
  reason: string;
  priority: number;
}

export interface ParsedDiscoveryPlan {
  terms: PlannedDiscoveryTerm[];
}

export function selectFallbackDiscoveryTerms(input: {
  seedTerms: string[];
  history: DiscoveryTermCandidate[];
  maxRuns: number;
}) {
  const dedupedSeeds = normalizeTerms(input.seedTerms);
  const historyMap = new Map(input.history.map((entry) => [normalizeTerm(entry.term), entry]));
  const candidates: Array<PlannedDiscoveryTerm & { sortScore: number }> = [];

  for (const term of dedupedSeeds) {
    const normalized = normalizeTerm(term);
    const prior = historyMap.get(normalized);
    const freshnessScore = prior?.lastUsedAt ? -prior.lastUsedAt / 1_000_000_000_000 : 6;
    const yieldScore = prior ? prior.totalProspects * 3 + prior.totalSignals - prior.totalRuns : 8;
    candidates.push({
      term,
      reason: prior ? "Returning term with prior yield history." : "Seed term has not been tried yet.",
      priority: prior ? clampPriority(prior.priority + 0.05) : 0.75,
      sortScore: yieldScore + freshnessScore,
    });
  }

  for (const entry of input.history) {
    const normalized = normalizeTerm(entry.term);
    if (dedupedSeeds.includes(normalized)) {
      continue;
    }
    const sortScore =
      entry.totalProspects * 4 +
      entry.totalSignals * 1.5 -
      entry.totalRuns +
      (entry.lastUsedAt ? -entry.lastUsedAt / 1_000_000_000_000 : 1);
    candidates.push({
      term: entry.term,
      reason:
        entry.totalProspects > 0
          ? "Prior term produced prospects and should be revisited."
          : "Prior term is being retried on a low cadence.",
      priority: clampPriority(Math.max(entry.priority, entry.totalProspects > 0 ? 0.8 : 0.55)),
      sortScore,
    });
  }

  return candidates
    .sort((left, right) => right.sortScore - left.sortScore || right.priority - left.priority)
    .slice(0, input.maxRuns)
    .map(({ sortScore: _sortScore, ...term }) => term);
}

export function parseDiscoveryPlan(outputText: string, maxRuns: number) {
  const parsed = extractJsonObject<{
    terms?: Array<{
      term?: string;
      reason?: string;
      priority?: number;
    }>;
  }>(outputText);

  if (!parsed?.terms?.length) {
    return null;
  }

  const terms = parsed.terms
    .map((term) => ({
      term: normalizeTerm(term.term ?? ""),
      reason: term.reason?.trim() || "Chosen by discovery planner.",
      priority: clampPriority(term.priority ?? 0.7),
    }))
    .filter((term) => Boolean(term.term))
    .slice(0, maxRuns);

  if (!terms.length) {
    return null;
  }

  return { terms };
}

export function normalizeTerms(terms: string[]) {
  return Array.from(new Set(terms.map((term) => normalizeTerm(term)).filter(Boolean)));
}

function normalizeTerm(term: string) {
  return term.trim().replace(/\s+/g, " ").toLowerCase();
}

function clampPriority(priority: number) {
  if (Number.isNaN(priority)) {
    return 0.7;
  }

  return Math.max(0.1, Math.min(1, priority));
}
