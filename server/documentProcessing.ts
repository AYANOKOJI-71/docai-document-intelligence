import pdf from "pdf-parse/lib/pdf-parse.js";

export const MAX_UPLOAD_BYTES = 7 * 1024 * 1024;
export const MAX_CHUNKS_PER_DOCUMENT = 360;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "for", "from", "how", "i", "in", "is", "it", "of", "on", "or", "the", "to", "what", "when", "where", "which", "with", "you", "your",
]);

const RELATED_TERMS: Record<string, string[]> = {
  access: ["permission", "authorization", "login", "authentication"],
  ai: ["artificial", "intelligence", "model", "llm"],
  analysis: ["evaluate", "assessment", "insight"],
  auth: ["authentication", "authorization", "login", "oauth"],
  budget: ["cost", "spend", "pricing"],
  cost: ["budget", "spend", "pricing"],
  data: ["dataset", "information", "record"],
  deploy: ["deployment", "release", "production"],
  document: ["file", "report", "paper"],
  error: ["failure", "issue", "exception"],
  login: ["authentication", "signin", "access"],
  security: ["secure", "privacy", "encryption", "authorization"],
  test: ["testing", "validation", "quality"],
};

export type ExtractedDocument = {
  text: string;
  fileType: "pdf" | "txt";
  mimeType: string;
};

export type ChunkInput = {
  content: string;
  searchText: string;
  wordCount: number;
  chunkIndex: number;
};

export type RetrievalChunk = {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  chunkIndex: number;
};

export type RankedChunk = RetrievalChunk & { score: number };

export type SourceCitation = {
  documentId: string;
  documentName: string;
  chunkId: string;
  excerpt: string;
};

export function normalizeDocumentName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 255) || "document";
}

export function getFileInfo(fileName: string): { fileType: "pdf" | "txt"; mimeType: string } {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return { fileType: "pdf", mimeType: "application/pdf" };
  if (lower.endsWith(".txt")) return { fileType: "txt", mimeType: "text/plain" };
  throw new Error("Only PDF and TXT files are supported.");
}

export async function extractDocumentText(fileName: string, bytes: Buffer): Promise<ExtractedDocument> {
  const { fileType, mimeType } = getFileInfo(fileName);
  const rawText = fileType === "pdf" ? (await pdf(bytes)).text : bytes.toString("utf8");
  const text = rawText.replace(/\u0000/g, "").replace(/[\t\r ]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();

  if (text.length < 30) {
    throw new Error("No readable text was found in this file. For PDFs, upload a text-based PDF rather than a scanned image.");
  }

  return { text, fileType, mimeType };
}

export function chunkDocumentText(text: string, targetSize = 1100, overlap = 170): ChunkInput[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const chunks: ChunkInput[] = [];
  const seen = new Set<string>();
  let start = 0;

  while (start < normalized.length && chunks.length < MAX_CHUNKS_PER_DOCUMENT) {
    let end = Math.min(start + targetSize, normalized.length);
    if (end < normalized.length) {
      const sentenceBoundary = Math.max(
        normalized.lastIndexOf(". ", end),
        normalized.lastIndexOf("? ", end),
        normalized.lastIndexOf("! ", end),
        normalized.lastIndexOf("; ", end),
      );
      const wordBoundary = normalized.lastIndexOf(" ", end);
      if (sentenceBoundary > start + Math.floor(targetSize * 0.55)) end = sentenceBoundary + 1;
      else if (wordBoundary > start + Math.floor(targetSize * 0.55)) end = wordBoundary;
    }

    const content = normalized.slice(start, end).trim();
    if (content && !seen.has(content)) {
      seen.add(content);
      chunks.push({
        content,
        searchText: content.toLowerCase(),
        wordCount: content.split(/\s+/).filter(Boolean).length,
        chunkIndex: chunks.length,
      });
    }

    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  if (normalized.length > 0 && chunks.length === MAX_CHUNKS_PER_DOCUMENT && start < normalized.length) {
    throw new Error("This document is too large to index. Please upload a shorter file.");
  }

  return chunks;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .match(/[a-z0-9]{2,}/g)
    ?.filter(term => !STOP_WORDS.has(term)) ?? [];
}

export function rankRelevantChunks(question: string, chunks: RetrievalChunk[], limit = 5): RankedChunk[] {
  const directTerms = Array.from(new Set(tokenize(question)));
  const expandedTerms = Array.from(new Set(directTerms.flatMap(term => [term, ...(RELATED_TERMS[term] ?? [])])));
  if (expandedTerms.length === 0) return [];

  return chunks
    .map(chunk => {
      const chunkText = chunk.content.toLowerCase();
      const titleText = chunk.documentTitle.toLowerCase();
      const directHits = directTerms.filter(term => chunkText.includes(term)).length;
      const relatedHits = expandedTerms.filter(term => chunkText.includes(term)).length;
      const titleHits = directTerms.filter(term => titleText.includes(term)).length;
      const phraseBonus = question.length > 7 && chunkText.includes(question.toLowerCase().trim()) ? 2 : 0;
      const score = directHits * 3 + relatedHits + titleHits * 1.5 + phraseBonus;
      return { ...chunk, score };
    })
    .filter(chunk => chunk.score > 0)
    .sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex)
    .slice(0, limit);
}

export function buildSourceCitations(sources: Array<Pick<RetrievalChunk, "id" | "documentId" | "documentTitle" | "content">>): SourceCitation[] {
  return sources.map(source => ({
    documentId: source.documentId,
    documentName: source.documentTitle,
    chunkId: source.id,
    excerpt: source.content,
  }));
}
