import type { QualificationAssessment, QualificationCheck, SignalRecord } from "../domain/types.js";
import type { ProspectSnapshot } from "../repository.js";

export interface QualificationInput {
  prospect: Pick<
    ProspectSnapshot["prospect"],
    "fullName" | "title" | "company" | "companyDomain" | "linkedinUrl" | "sourceSignalId"
  >;
  sourceSignal: Pick<
    SignalRecord,
    "source" | "url" | "authorTitle" | "authorCompany" | "companyDomain" | "topic" | "content"
  > | null;
  evidence?: {
    sourcePostExtract?: string | null;
    profileExtract?: string | null;
    companyExtract?: string | null;
    profileUrl?: string | null;
    companyUrl?: string | null;
  };
}

interface IcpRubric {
  personCriteria: string[];
  companyCriteria: string[];
  painCriteria: string[];
  triggerCriteria: string[];
  positiveCriteria: string[];
  negativeCriteria: string[];
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "not",
  "of",
  "on",
  "or",
  "our",
  "should",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "using",
  "use",
  "want",
  "with",
  "without",
  "you",
  "your",
]);

function unique(values: string[]) {
  return [...new Set(values)];
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return unique(
    normalizeText(value)
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !STOP_WORDS.has(token)),
  );
}

function pushUnique(target: string[], values: string[]) {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed && !target.includes(trimmed)) {
      target.push(trimmed);
    }
  }
}

function sectionBucket(heading: string) {
  const text = normalizeText(heading);

  if (/\bnegative\b|\bpoor fit\b|\bdisqual/i.test(text)) {
    return "negative";
  }
  if (/\btrigger\b|\btiming\b|\bevent\b/.test(text)) {
    return "trigger";
  }
  if (/\bpositive\b|\bbuying signal\b|\bsignal\b/.test(text)) {
    return "positive";
  }
  if (/\bpain\b|\bproblem\b|\bchallenge\b|\bfriction\b/.test(text)) {
    return "pain";
  }
  if (/\bcompany\b|\baccount\b|\bfirmographic\b|\borganization\b/.test(text)) {
    return "company";
  }
  if (/\bpersona\b|\bpersonas\b|\bbuyer\b|\bsegment\b|\bbest fit\b|\bcustomer\b|\brole\b|\btitle\b/.test(text)) {
    return "person";
  }

  return null;
}

function extractBulletValue(line: string) {
  const bulletMatch = line.match(/^\s*[-*]\s+(.+?)\s*$/);
  if (bulletMatch?.[1]) {
    return bulletMatch[1].trim();
  }
  return null;
}

function deriveIcpRubric(icpMarkdown: string): IcpRubric {
  const rubric: IcpRubric = {
    personCriteria: [],
    companyCriteria: [],
    painCriteria: [],
    triggerCriteria: [],
    positiveCriteria: [],
    negativeCriteria: [],
  };

  let currentHeading = "";
  for (const rawLine of icpMarkdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const headingMatch = line.match(/^#+\s+(.+)$/);
    if (headingMatch?.[1]) {
      currentHeading = headingMatch[1];
      continue;
    }

    const bullet = extractBulletValue(line);
    if (!bullet) {
      continue;
    }

    const bucket = sectionBucket(currentHeading);
    switch (bucket) {
      case "person":
        pushUnique(rubric.personCriteria, [bullet]);
        break;
      case "company":
        pushUnique(rubric.companyCriteria, [bullet]);
        break;
      case "pain":
        pushUnique(rubric.painCriteria, [bullet]);
        break;
      case "trigger":
        pushUnique(rubric.triggerCriteria, [bullet]);
        break;
      case "positive":
        pushUnique(rubric.positiveCriteria, [bullet]);
        break;
      case "negative":
        pushUnique(rubric.negativeCriteria, [bullet]);
        break;
      default:
        break;
    }
  }

  return rubric;
}

function phraseMatches(phrase: string, haystack: string, ratio = 0.6) {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) {
    return false;
  }

  if (haystack.includes(normalizedPhrase)) {
    return true;
  }

  const keywords = tokenize(phrase);
  if (keywords.length === 0) {
    return false;
  }

  const matched = keywords.filter((keyword) => haystack.includes(keyword)).length;
  const threshold = Math.max(1, Math.ceil(keywords.length * ratio));
  return matched >= threshold;
}

function matchCriteria(criteria: string[], haystack: string, ratio = 0.6) {
  return unique(criteria.filter((criterion) => phraseMatches(criterion, haystack, ratio)));
}

function check(
  key: string,
  label: string,
  passed: boolean,
  detail: string,
  kind: QualificationCheck["kind"],
): QualificationCheck {
  return { key, label, passed, detail, kind };
}

export function buildQualificationInput(
  snapshot: ProspectSnapshot,
  sourceSignal: SignalRecord | null,
  evidence?: QualificationInput["evidence"],
): QualificationInput {
  return {
    prospect: {
      fullName: snapshot.prospect.fullName,
      title: snapshot.prospect.title,
      company: snapshot.prospect.company,
      companyDomain: snapshot.prospect.companyDomain,
      linkedinUrl: snapshot.prospect.linkedinUrl,
      sourceSignalId: snapshot.prospect.sourceSignalId,
    },
    sourceSignal: sourceSignal
      ? {
          source: sourceSignal.source,
          url: sourceSignal.url,
          authorTitle: sourceSignal.authorTitle ?? null,
          authorCompany: sourceSignal.authorCompany ?? null,
          companyDomain: sourceSignal.companyDomain ?? null,
          topic: sourceSignal.topic,
          content: sourceSignal.content,
        }
      : null,
    evidence,
  };
}

export function heuristicIcpQualification(
  input: QualificationInput,
  icpMarkdown = "",
): QualificationAssessment {
  const rubric = deriveIcpRubric(icpMarkdown);

  const identityPassed =
    (input.prospect.fullName && input.prospect.fullName !== "Unknown")
    || Boolean(input.prospect.linkedinUrl);
  const provenancePassed = Boolean(input.prospect.sourceSignalId);

  const roleText = normalizeText(
    [
      input.prospect.title,
      input.sourceSignal?.authorTitle,
      input.evidence?.profileExtract,
    ].filter(Boolean).join("\n"),
  );
  const companyText = normalizeText(
    [
      input.prospect.company,
      input.prospect.companyDomain,
      input.sourceSignal?.authorCompany,
      input.sourceSignal?.companyDomain,
      input.evidence?.companyExtract,
      input.evidence?.companyUrl,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const postText = normalizeText(
    [
      input.sourceSignal?.topic,
      input.sourceSignal?.content,
      input.evidence?.sourcePostExtract,
    ].filter(Boolean).join("\n"),
  );
  const combinedText = normalizeText(
    [
      input.prospect.fullName,
      input.prospect.title,
      input.prospect.company,
      input.prospect.companyDomain,
      input.prospect.linkedinUrl,
      input.sourceSignal?.authorTitle,
      input.sourceSignal?.authorCompany,
      input.sourceSignal?.companyDomain,
      input.sourceSignal?.topic,
      input.sourceSignal?.content,
      input.evidence?.sourcePostExtract,
      input.evidence?.profileExtract,
      input.evidence?.companyExtract,
      input.evidence?.profileUrl,
      input.evidence?.companyUrl,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const personMatches = matchCriteria(rubric.personCriteria, `${roleText}\n${postText}\n${combinedText}`, 0.55);
  const companyMatches = matchCriteria(rubric.companyCriteria, `${companyText}\n${postText}\n${combinedText}`, 0.55);
  const painMatches = matchCriteria(
    [...rubric.painCriteria, ...rubric.triggerCriteria, ...rubric.positiveCriteria],
    `${postText}\n${companyText}\n${roleText}\n${combinedText}`,
    0.4,
  );
  const negativeMatches = matchCriteria(rubric.negativeCriteria, combinedText, 0.5);

  const genericRoleDisqualifiers = [
    /\brecruit(ing|er)?\b/i.test(roleText)
      || /\btalent\b/i.test(roleText)
      || /\bhuman resources\b/i.test(roleText)
      || /\bhr\b/i.test(roleText)
      || /\bdirector of people\b/i.test(roleText)
      || /\bpeople ops\b/i.test(roleText)
      ? "Generic mismatch: recruiting or people title"
      : null,
    /\bwe re hiring\b/.test(postText)
      || /\bwere hiring\b/.test(postText)
      || /\bhiring\b/.test(postText)
      || /\bapply here\b/.test(postText)
      ? "Generic mismatch: hiring post"
      : null,
  ].filter((value): value is string => Boolean(value));

  const disqualifiers = unique([...negativeMatches, ...genericRoleDisqualifiers]);

  const personFitPassed = rubric.personCriteria.length === 0
    ? Boolean(roleText)
    : personMatches.length > 0 || (Boolean(roleText) && painMatches.length >= 2 && disqualifiers.length === 0);
  const companyFitPassed = rubric.companyCriteria.length === 0
    ? Boolean(companyText)
    : companyMatches.length > 0 || (Boolean(companyText) && painMatches.length >= 2 && disqualifiers.length === 0);
  const problemOrTriggerFitPassed =
    rubric.painCriteria.length + rubric.triggerCriteria.length + rubric.positiveCriteria.length === 0
      ? Boolean(postText)
      : painMatches.length > 0;
  const companyFitRequired = rubric.companyCriteria.length > 0 && Boolean(companyText) && painMatches.length === 0;

  const ok = identityPassed && provenancePassed && personFitPassed && (!companyFitRequired || companyFitPassed) && problemOrTriggerFitPassed
    && disqualifiers.length === 0;

  const matchedSegments = unique([...personMatches, ...companyMatches]).slice(0, 6);
  const matchedSignals = painMatches.slice(0, 6);
  const missingEvidence = [
    !identityPassed ? "identity" : null,
    !provenancePassed ? "source provenance" : null,
    !personFitPassed ? "person fit" : null,
    companyFitRequired && !companyFitPassed ? "company fit" : null,
    !problemOrTriggerFitPassed ? "pain or trigger fit" : null,
  ].filter((value): value is string => Boolean(value));

  const reason = !identityPassed
    ? "prospect identity missing"
    : !provenancePassed
      ? "source provenance missing"
      : disqualifiers.length > 0
        ? `poor fit: ${disqualifiers[0]}`
        : !personFitPassed
          ? "person does not match current ICP"
          : !companyFitPassed
            ? "company does not match current ICP"
            : !problemOrTriggerFitPassed
              ? "missing ICP pain or trigger evidence"
              : "matches current ICP";

  const confidence = Math.max(
    0.2,
    Math.min(
      0.96,
      0.2
      + (identityPassed ? 0.12 : 0)
      + (provenancePassed ? 0.12 : 0)
      + (personFitPassed ? 0.18 : 0)
      + (companyFitPassed ? 0.16 : 0)
      + (problemOrTriggerFitPassed ? 0.18 : 0)
      + Math.min(matchedSignals.length, 2) * 0.06
      - Math.min(disqualifiers.length, 2) * 0.18,
    ),
  );

  return {
    engine: "heuristic_icp_framework_v1",
    ruleVersion: "icp_doc_v1",
    decision: ok ? "qualified" : "rejected",
    ok,
    reason,
    summary: ok
      ? "Qualified against the current ICP using person, company, and pain/trigger evidence."
      : `Rejected for now because ${reason}.`,
    confidence,
    matchedSegments,
    matchedSignals,
    disqualifiers,
    dimensions: {
      personQualified: personFitPassed,
      companyQualified: companyFitPassed,
      signalQualified: problemOrTriggerFitPassed,
      negativeSignalsPresent: disqualifiers.length > 0,
    },
    missingEvidence,
    checks: [
      check(
        "identity",
        "Identity present",
        identityPassed,
        identityPassed
          ? `Using ${input.prospect.fullName || input.prospect.linkedinUrl || "captured identity"}.`
          : "No reliable name or profile URL was captured.",
        "required",
      ),
      check(
        "source_provenance",
        "Source provenance present",
        provenancePassed,
        provenancePassed
          ? `Captured from ${input.sourceSignal?.source || "source signal"} and linked to a source record.`
          : "No source signal was attached to this prospect.",
        "required",
      ),
      check(
        "person_fit",
        "Person fit present",
        personFitPassed,
        personFitPassed
          ? personMatches.join("; ") || "Role context aligns with the current ICP."
          : "No strong overlap between the person's role/headline and the ICP buyer/operator criteria.",
        "fit",
      ),
      check(
        "company_fit",
        "Company fit present",
        companyFitPassed,
        companyFitPassed
          ? companyMatches.join("; ") || "Company context aligns with the current ICP."
          : "No strong overlap between the company context and the ICP company criteria.",
        "fit",
      ),
      check(
        "pain_or_trigger_fit",
        "Pain or trigger fit present",
        problemOrTriggerFitPassed,
        problemOrTriggerFitPassed
          ? matchedSignals.join("; ") || "Observed pains, triggers, or buying signals align with the ICP."
          : "No strong ICP-aligned pains, triggers, or buying signals were found.",
        "supporting",
      ),
      check(
        "negative_signals",
        "Negative signals absent",
        disqualifiers.length === 0,
        disqualifiers.length === 0 ? "No explicit negatives or generic mismatches detected." : disqualifiers.join("; "),
        "negative",
      ),
    ],
  };
}
