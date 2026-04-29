function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function stripLeadingBullets(value: string) {
  return value.replace(/^[\s\-•|·,:;]+/, "").trim();
}

function looksLikeAudienceMetric(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[•|·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /^(\d[\d.,kKmM+]*\s*(followers?|connections?|subscribers?)\s*)+$/.test(normalized);
}

export function normalizeProspectTitle(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = stripLeadingBullets(normalizeWhitespace(value));
  if (!normalized) {
    return null;
  }

  if (looksLikeAudienceMetric(normalized)) {
    return null;
  }

  return normalized;
}

export function pickNormalizedProspectTitle(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const normalized = normalizeProspectTitle(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}
