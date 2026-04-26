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

function collectCurrentPositionCompanyLinkedinUrl(metadata: Record<string, unknown>) {
  const currentPositions = Array.isArray(metadata.currentPosition) ? metadata.currentPosition : [];

  for (const entry of currentPositions) {
    const record = coerceRecord(entry);
    const normalized = normalizeAbsoluteUrl(pickString(record, ["companyLinkedinUrl", "companyUrl"]));
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function collectCurrentPositionCompanyWebsite(metadata: Record<string, unknown>) {
  const currentPositions = Array.isArray(metadata.currentPosition) ? metadata.currentPosition : [];

  for (const entry of currentPositions) {
    const record = coerceRecord(entry);
    const normalized = normalizeAbsoluteUrl(pickString(record, ["companyWebsite", "website"]));
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
    ?? pickString(meta, ["linkedinUrl", "authorLinkedinUrl", "authorUrl", "profileUrl"]);

  return canonicalizeLinkedinUrl(profileUrl)
    ?? normalizeLinkedinUrl(fallbackUrl)
    ?? null;
}

export function extractTwitterProfileUrl(
  metadata: Record<string, unknown> | null | undefined,
  fallbackUrl?: string | null,
) {
  const meta = coerceRecord(metadata);
  const author = coerceRecord(meta.author);
  const username =
    pickString(author, ["username", "screenName", "handle"])
    ?? pickString(meta, ["authorUsername", "username", "screenName", "handle"]);
  const profileUrl =
    pickString(author, ["twitterUrl", "xUrl", "url"])
    ?? pickString(meta, ["authorTwitterUrl", "authorXUrl", "authorUrl", "profileUrl"]);

  return normalizeTwitterProfileUrl(profileUrl)
    ?? (username ? `https://x.com/${username.replace(/^@/, "").trim()}` : null)
    ?? normalizeTwitterProfileUrl(fallbackUrl)
    ?? null;
}

export function extractCompanyResearchUrl(input: {
  metadata?: Record<string, unknown> | null;
  companyDomain?: string | null;
}) {
  const metadata = coerceRecord(input.metadata);
  const author = coerceRecord(metadata.author);

  return normalizeDomainToUrl(input.companyDomain)
    ?? normalizeAbsoluteUrl(
      pickString(metadata, ["companyWebsite", "website", "domain", "currentCompanyWebsite"]),
    )
    ?? normalizeAbsoluteUrl(pickString(author, ["website"]))
    ?? collectCurrentPositionCompanyWebsite(metadata)
    ?? collectCurrentPositionCompanyLinkedinUrl(metadata)
    ?? collectContentAttributeCompanyUrl(metadata)
    ?? null;
}

export function extractCompanyLinkedinUrl(metadata: Record<string, unknown> | null | undefined) {
  const meta = coerceRecord(metadata);
  const author = coerceRecord(meta.author);

  return canonicalizeLinkedinUrl(
    pickString(meta, ["companyLinkedinUrl", "currentCompanyLinkedinUrl"])
      ?? pickString(author, ["companyLinkedinUrl"])
      ?? collectCurrentPositionCompanyLinkedinUrl(meta),
  );
}

function canonicalizeLinkedinUrl(value: string | null | undefined) {
  const normalized = normalizeAbsoluteUrl(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "linkedin.com") {
      return normalized;
    }

    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//www.linkedin.com${pathname}`;
  } catch {
    return normalized;
  }
}

function normalizeLinkedinUrl(value: string | null | undefined) {
  const normalized = normalizeAbsoluteUrl(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "linkedin.com") {
      return null;
    }

    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//www.linkedin.com${pathname}`;
  } catch {
    return null;
  }
}

function normalizeTwitterProfileUrl(value: string | null | undefined) {
  const normalized = normalizeAbsoluteUrl(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "x.com" && host !== "twitter.com") {
      return null;
    }

    const [handle] = url.pathname.split("/").filter(Boolean);
    if (!handle) {
      return null;
    }

    return `https://x.com/${handle.replace(/^@/, "")}`;
  } catch {
    return null;
  }
}
