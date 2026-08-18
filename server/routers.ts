import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createConversation,
  createDocument,
  createDocumentChunks,
  createMessage,
  createMessageCitations,
  deleteDocumentForUser,
  getConversationForUser,
  getConversationMessagesForUser,
  getDocumentForUser,
  listConversationsForUser,
  listDocumentsForUser,
  listRetrievalChunks,
  markDocumentReady,
  touchConversation,
} from "./db";
import {
  chunkDocumentText,
  buildSourceCitations,
  extractDocumentText,
  getFileInfo,
  MAX_UPLOAD_BYTES,
  normalizeDocumentName,
  rankRelevantChunks,
} from "./documentProcessing";
import { storagePut } from "./storage";

const safeId = () => nanoid(24);

function documentTitleFromFileName(fileName: string) {
  return normalizeDocumentName(fileName.replace(/\.(pdf|txt)$/i, "")) || "Untitled document";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  documents: router({
    list: protectedProcedure.query(({ ctx }) => listDocumentsForUser(ctx.user.id)),
    upload: protectedProcedure
      .input(z.object({ fileName: z.string().min(1).max(255), base64: z.string().min(1).max(10_000_000) }))
      .mutation(async ({ ctx, input }) => {
        const fileName = normalizeDocumentName(input.fileName);
        let fileInfo: { fileType: "pdf" | "txt"; mimeType: string };
        try {
          fileInfo = getFileInfo(fileName);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unsupported file." });
        }

        const bytes = Buffer.from(input.base64, "base64");
        if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Files must be smaller than 7 MB." });
        }

        let extracted;
        try {
          extracted = await extractDocumentText(fileName, bytes);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The document could not be read." });
        }

        let chunks;
        try {
          chunks = chunkDocumentText(extracted.text);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The document could not be indexed." });
        }
        if (!chunks.length) throw new TRPCError({ code: "BAD_REQUEST", message: "No searchable passages were found in this document." });

        const documentId = safeId();
        const stored = await storagePut(`${ctx.user.id}/documents/${fileName}`, bytes, fileInfo.mimeType);
        await createDocument({
          id: documentId,
          userId: ctx.user.id,
          title: documentTitleFromFileName(fileName),
          originalName: fileName,
          fileType: extracted.fileType,
          mimeType: extracted.mimeType,
          fileSize: bytes.length,
          storageKey: stored.key,
          storageUrl: stored.url,
          status: "processing",
          chunkCount: 0,
        });
        await createDocumentChunks(chunks.map(chunk => ({ ...chunk, id: safeId(), documentId, userId: ctx.user.id })));
        await markDocumentReady(documentId, chunks.length);

        return getDocumentForUser(ctx.user.id, documentId);
      }),
    delete: protectedProcedure.input(z.object({ documentId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const deleted = await deleteDocumentForUser(ctx.user.id, input.documentId);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
      return { success: true } as const;
    }),
  }),

  chat: router({
    conversations: protectedProcedure.query(({ ctx }) => listConversationsForUser(ctx.user.id)),
    conversation: protectedProcedure.input(z.object({ conversationId: z.string().min(1) })).query(async ({ ctx, input }) => {
      const result = await getConversationMessagesForUser(ctx.user.id, input.conversationId);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found." });
      return result;
    }),
    ask: protectedProcedure
      .input(z.object({ question: z.string().min(3).max(1200), conversationId: z.string().min(1).optional(), documentId: z.string().min(1).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (input.documentId) {
          const selectedDocument = await getDocumentForUser(ctx.user.id, input.documentId);
          if (!selectedDocument) throw new TRPCError({ code: "NOT_FOUND", message: "Selected document not found." });
          if (selectedDocument.status !== "ready") throw new TRPCError({ code: "BAD_REQUEST", message: "Selected document is not ready for questions." });
        }

        const retrievalPool = await listRetrievalChunks(ctx.user.id, input.documentId);
        const rankedSources = rankRelevantChunks(input.question, retrievalPool);
        if (!rankedSources.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "I could not find a relevant passage. Try different wording or upload a more relevant document." });
        }

        let conversationId = input.conversationId;
        if (conversationId) {
          const conversation = await getConversationForUser(ctx.user.id, conversationId);
          if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found." });
        } else {
          conversationId = safeId();
          await createConversation({
            id: conversationId,
            userId: ctx.user.id,
            documentId: input.documentId ?? null,
            title: input.question.trim().slice(0, 120),
          });
        }

        await createMessage({ id: safeId(), conversationId, role: "user", content: input.question.trim() });
        const groundedContext = rankedSources
          .map((source, index) => `[${index + 1}] ${source.documentTitle}\n${source.content}`)
          .join("\n\n");
        const response = await invokeLLM({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content: "You are DocAI, a careful document analyst. Answer only from the supplied source passages. If the sources do not establish an answer, say so plainly. Use concise, professional markdown. Cite factual statements with the supplied bracket labels such as [1]. Never invent a source or fact.",
            },
            { role: "user", content: `Question: ${input.question.trim()}\n\nSource passages:\n${groundedContext}` },
          ],
        });
        const answer = String(response.choices[0]?.message?.content ?? "").trim();
        if (!answer) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The answer service returned an empty response. Please try again." });

        const assistantMessageId = safeId();
        await createMessage({ id: assistantMessageId, conversationId, role: "assistant", content: answer });
        const sourceCitations = buildSourceCitations(rankedSources);
        await createMessageCitations(sourceCitations.map(citation => ({
          id: safeId(),
          messageId: assistantMessageId,
          ...citation,
        })));
        await touchConversation(conversationId);

        return {
          conversationId,
          answer,
          sources: sourceCitations,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
