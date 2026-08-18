import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  conversations,
  documentChunks,
  documents,
  InsertConversation,
  InsertDocument,
  InsertDocumentChunk,
  InsertMessage,
  InsertMessageCitation,
  InsertUser,
  messageCitations,
  messages,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database connection is unavailable.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await requireDb();
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };

  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listDocumentsForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt));
}

export async function getDocumentForUser(userId: number, documentId: string) {
  const db = await requireDb();
  const result = await db.select().from(documents).where(and(eq(documents.userId, userId), eq(documents.id, documentId))).limit(1);
  return result[0];
}

export async function createDocument(document: InsertDocument) {
  const db = await requireDb();
  await db.insert(documents).values(document);
}

export async function markDocumentReady(documentId: string, chunkCount: number) {
  const db = await requireDb();
  await db.update(documents).set({ status: "ready", chunkCount }).where(eq(documents.id, documentId));
}

export async function createDocumentChunks(chunks: InsertDocumentChunk[]) {
  const db = await requireDb();
  if (chunks.length > 0) await db.insert(documentChunks).values(chunks);
}

export async function deleteDocumentForUser(userId: number, documentId: string) {
  const db = await requireDb();
  const document = await getDocumentForUser(userId, documentId);
  if (!document) return false;

  await db.delete(messageCitations).where(eq(messageCitations.documentId, documentId));
  await db.update(conversations).set({ documentId: null }).where(and(eq(conversations.userId, userId), eq(conversations.documentId, documentId)));
  await db.delete(documentChunks).where(and(eq(documentChunks.userId, userId), eq(documentChunks.documentId, documentId)));
  await db.delete(documents).where(and(eq(documents.userId, userId), eq(documents.id, documentId)));
  return true;
}

export async function listRetrievalChunks(userId: number, documentId?: string) {
  const db = await requireDb();
  const conditions = [eq(documentChunks.userId, userId), eq(documents.userId, userId), eq(documents.status, "ready")];
  if (documentId) conditions.push(eq(documents.id, documentId));
  return db
    .select({
      id: documentChunks.id,
      documentId: documents.id,
      documentTitle: documents.title,
      content: documentChunks.content,
      chunkIndex: documentChunks.chunkIndex,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(and(...conditions))
    .orderBy(asc(documents.createdAt), asc(documentChunks.chunkIndex));
}

export async function createConversation(conversation: InsertConversation) {
  const db = await requireDb();
  await db.insert(conversations).values(conversation);
  return conversation;
}

export async function getConversationForUser(userId: number, conversationId: string) {
  const db = await requireDb();
  const result = await db.select().from(conversations).where(and(eq(conversations.userId, userId), eq(conversations.id, conversationId))).limit(1);
  return result[0];
}

export async function listConversationsForUser(userId: number) {
  const db = await requireDb();
  return db
    .select({
      id: conversations.id,
      userId: conversations.userId,
      documentId: conversations.documentId,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      documentTitle: documents.title,
    })
    .from(conversations)
    .leftJoin(documents, eq(conversations.documentId, documents.id))
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export async function createMessage(message: InsertMessage) {
  const db = await requireDb();
  await db.insert(messages).values(message);
  return message;
}

export async function createMessageCitations(citations: InsertMessageCitation[]) {
  const db = await requireDb();
  if (citations.length > 0) await db.insert(messageCitations).values(citations);
}

export async function touchConversation(conversationId: string) {
  const db = await requireDb();
  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
}

export async function getConversationMessagesForUser(userId: number, conversationId: string) {
  const db = await requireDb();
  const conversation = await getConversationForUser(userId, conversationId);
  if (!conversation) return undefined;

  const messageRows = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
  const messageIds = messageRows.map(message => message.id);
  const citationRows = messageIds.length
    ? await db.select().from(messageCitations).where(inArray(messageCitations.messageId, messageIds))
    : [];

  return {
    conversation,
    messages: messageRows.map(message => ({
      ...message,
      citations: citationRows.filter(citation => citation.messageId === message.id),
    })),
  };
}
