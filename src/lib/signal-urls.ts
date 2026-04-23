function coerceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickString(value: unknown, keys: string[]): string | null {
  const record = coerceRecord(value);
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function normalizeAbsoluteUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function normalizeDomainToUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!trimmed) {
    return null;
  }

  return `https://${trimmed}`;
}

function collectContentAttributeCompanyUrl(metadata: Record<string, unknown>) {
  const contentAttributes = Array.isArray(metadata.contentAttributes) ? metadata.contentAttributes : [];

  for (const entry of contentAttributes) {
    const record = coerceRecord(entry);
    if (pickString(record, ["type"]) !== "COMPANY_NAME") {
      continue;
    }

    const company = coerceRecord(record.company);
    const url =
      pickString(company, ["linkedinUrl", "url", "website"])
      ?? pickString(record, ["hyperlink", "textLink"]);

    const normalized = normalizeAbsoluteUrl(url);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function extractLinkedinProfileUrl(
  metadata: Record<string, unknown> | null | undefined,
  fallbackUrl?: string | null,
) {
  const meta = coerceRecord(metadata);
  const author = coerceRecord(meta.author);
  const profileUrl =
    pickString(author, ["linkedinUrl", "url"])
    ?? pickString(meta, ["authorLinkedinUrl", "authorUrl", "profileUrl"]);

  return normalizeAbsoluteUrl(profileUrl)
    ?? normalizeAbsoluteUrl(fallbackUrl)
    ?? null;
}

export function extractCompanyResearchUrl(input: {
  metadata?: Record<string, unknown> | null;
  companyDomain?: string | null;
}) {
  const metadata = coerceRecord(input.metadata);
  const author = coerceRecord(metadata.author);

  return normalizeDomainToUrl(input.companyDomain)
    ?? normalizeAbsoluteUrl(pickString(author, ["website"]))
    ?? normalizeAbsoluteUrl(pickString(metadata, ["companyWebsite", "website", "domain"]))
    ?? collectContentAttributeCompanyUrl(metadata)
    ?? null;
}
