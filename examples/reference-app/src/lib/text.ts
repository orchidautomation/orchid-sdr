export function collectTextFragments(value: unknown): string[] {
  const fragments: string[] = [];
  visit(value, fragments);
  return Array.from(new Set(fragments.map((fragment) => fragment.trim()).filter(Boolean)));
}

function visit(value: unknown, fragments: string[]) {
  if (typeof value === "string") {
    fragments.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, fragments);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      visit(entry, fragments);
    }
  }
}
