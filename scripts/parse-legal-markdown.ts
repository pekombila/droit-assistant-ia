export interface LegalArticleChunk {
  articleNumber: string;
  content: string;
  chapterTitle: string | null;
  sectionTitle: string | null;
  partTitle: string | null;
}

export interface ParsedLegalDocument {
  title: string;
  lawReference: string;
  chunks: LegalArticleChunk[];
}

/**
 * Parse a Gabonese legal markdown file into article-level chunks.
 *
 * Expected structures:
 *   # TITRE I - ...
 *   ## CHAPITRE I - ...
 *   ### Section 1 - ...
 *   **Article 1.** Text...
 *   Article 1er. - Text...
 *   Article 2. - Text...
 */
export function parseLegalMarkdown(
  markdown: string,
  docTitle: string,
  lawReference: string
): ParsedLegalDocument {
  const lines = markdown.split("\n");
  const chunks: LegalArticleChunk[] = [];

  let currentPart: string | null = null;
  let currentChapter: string | null = null;
  let currentSection: string | null = null;
  let currentArticleNumber: string | null = null;
  let currentArticleContent: string[] = [];

  function flushArticle() {
    if (currentArticleNumber && currentArticleContent.length > 0) {
      const content = currentArticleContent.join("\n").trim();
      if (content) {
        chunks.push({
          articleNumber: currentArticleNumber,
          content,
          chapterTitle: currentChapter,
          sectionTitle: currentSection,
          partTitle: currentPart,
        });
      }
    }
    currentArticleContent = [];
    currentArticleNumber = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect structural headings
    if (/^#\s+(TITRE|PARTIE|LIVRE)/i.test(trimmed)) {
      currentPart = trimmed.replace(/^#+\s*/, "");
    } else if (/^##\s+CHAPITRE/i.test(trimmed)) {
      currentChapter = trimmed.replace(/^#+\s*/, "");
    } else if (/^###\s+Section/i.test(trimmed)) {
      currentSection = trimmed.replace(/^#+\s*/, "");
    }

    // Detect article start: **Article 15.**, Article 1er., Art. 3, Art.11-I-1-a, Art.P-816, etc.
    const articleMatch = trimmed.match(
      /^\*{0,2}Art(?:icle)?\.?\s*((?:[A-Z]-)?(?:\d+(?:[-–][A-Za-z0-9]+)*)(?:\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies))?(?:er|ère)?)/i
    );

    if (articleMatch) {
      flushArticle();
      currentArticleNumber = articleMatch[1].trim();
      currentArticleContent.push(trimmed);
    } else if (currentArticleNumber) {
      currentArticleContent.push(line);
    }
  }

  // Flush last article
  flushArticle();

  return { title: docTitle, lawReference, chunks };
}
