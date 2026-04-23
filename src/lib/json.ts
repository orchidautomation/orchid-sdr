export function extractJsonObject<T>(input: string): T | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const direct = tryParse<T>(trimmed);
  if (direct) {
    return direct;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fencedMatch?.[1]) {
    const fenced = tryParse<T>(fencedMatch[1].trim());
    if (fenced) {
      return fenced;
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return tryParse<T>(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return null;
}

function tryParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}
