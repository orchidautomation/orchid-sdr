import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { knowledgeRoot } from "../lib/project-paths.js";

export interface KnowledgeMatch {
  file: string;
  title: string;
  snippet: string;
  score: number;
}

interface KnowledgeDocument {
  file: string;
  title: string;
  content: string;
}

export class KnowledgeService {
  private documents: KnowledgeDocument[] | null = null;

  async load() {
    if (this.documents) {
      return this.documents;
    }

    const files = await readdir(knowledgeRoot);
    const docs = await Promise.all(
      files
        .filter((file) => file.endsWith(".md"))
        .map(async (file) => {
          const content = await readFile(path.join(knowledgeRoot, file), "utf8");
          const title = content.match(/^#\s+(.+)$/m)?.[1] ?? file.replace(/\.md$/, "");
          return {
            file,
            title,
            content,
          };
        }),
    );

    this.documents = docs;
    return docs;
  }

  async search(query: string, limit = 5): Promise<KnowledgeMatch[]> {
    const docs = await this.load();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    return docs
      .map((doc) => {
        const haystack = doc.content.toLowerCase();
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        if (score === 0) {
          return null;
        }

        const index = Math.max(
          0,
          terms
            .map((term) => haystack.indexOf(term))
            .filter((value) => value >= 0)
            .sort((a, b) => a - b)[0] ?? 0,
        );

        return {
          file: doc.file,
          title: doc.title,
          snippet: doc.content.slice(index, index + 320).trim(),
          score,
        };
      })
      .filter((value): value is KnowledgeMatch => Boolean(value))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getDocumentContent(file: string) {
    const docs = await this.load();
    return docs.find((doc) => doc.file === file)?.content ?? null;
  }

  async composeKnowledgeContext(query: string, limit = 4) {
    const matches = await this.search(query, limit);
    return matches
      .map((match) => `## ${match.title}\nFile: ${match.file}\n${match.snippet}`)
      .join("\n\n");
  }
}
