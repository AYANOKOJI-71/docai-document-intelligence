import { describe, expect, it } from "vitest";
import { buildSourceCitations, chunkDocumentText, getFileInfo, rankRelevantChunks } from "./documentProcessing";

describe("document processing", () => {
  it("accepts only supported document extensions", () => {
    expect(getFileInfo("architecture.pdf")).toEqual({ fileType: "pdf", mimeType: "application/pdf" });
    expect(getFileInfo("notes.TXT")).toEqual({ fileType: "txt", mimeType: "text/plain" });
    expect(() => getFileInfo("payload.exe")).toThrow("Only PDF and TXT files are supported.");
  });

  it("creates ordered searchable chunks with overlap", () => {
    const text = "A secure upload validates each file before it is stored. ".repeat(80);
    const chunks = chunkDocumentText(text, 180, 40);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]?.chunkIndex).toBe(0);
    expect(chunks[0]?.wordCount).toBeGreaterThan(0);
    expect(chunks[1]?.content).toContain("validates");
  });

  it("ranks passages that match the question intent", () => {
    const ranked = rankRelevantChunks("How is user authentication secured?", [
      { id: "1", documentId: "a", documentTitle: "Security Architecture", chunkIndex: 0, content: "Authentication uses OAuth login and scoped authorization permissions." },
      { id: "2", documentId: "b", documentTitle: "Budget", chunkIndex: 0, content: "The budget tracks monthly infrastructure spend." },
    ]);
    expect(ranked[0]?.id).toBe("1");
    expect(ranked).toHaveLength(1);
  });

  it("preserves document names and exact source excerpts in citations", () => {
    const citations = buildSourceCitations([
      { id: "chunk-1", documentId: "document-1", documentTitle: "Security Architecture", content: "Authentication uses OAuth login and scoped authorization permissions." },
    ]);
    expect(citations).toEqual([{
      documentId: "document-1",
      documentName: "Security Architecture",
      chunkId: "chunk-1",
      excerpt: "Authentication uses OAuth login and scoped authorization permissions.",
    }]);
  });
});
