import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const documents = mysqlTable(
  "documents",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    originalName: varchar("originalName", { length: 255 }).notNull(),
    fileType: mysqlEnum("fileType", ["pdf", "txt"]).notNull(),
    mimeType: varchar("mimeType", { length: 128 }).notNull(),
    fileSize: int("fileSize").notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 768 }).notNull(),
    status: mysqlEnum("status", ["processing", "ready", "failed"]).default("processing").notNull(),
    chunkCount: int("chunkCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userCreatedIndex: index("documents_user_created_idx").on(table.userId, table.createdAt),
  }),
);

export const documentChunks = mysqlTable(
  "document_chunks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    documentId: varchar("documentId", { length: 36 }).notNull(),
    userId: int("userId").notNull(),
    chunkIndex: int("chunkIndex").notNull(),
    content: text("content").notNull(),
    searchText: text("searchText").notNull(),
    wordCount: int("wordCount").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    documentChunkIndex: index("chunks_document_order_idx").on(table.documentId, table.chunkIndex),
    userIndex: index("chunks_user_idx").on(table.userId),
  }),
);

export const conversations = mysqlTable(
  "conversations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId").notNull(),
    documentId: varchar("documentId", { length: 36 }),
    title: varchar("title", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userUpdatedIndex: index("conversations_user_updated_idx").on(table.userId, table.updatedAt),
  }),
);

export const messages = mysqlTable(
  "messages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    conversationId: varchar("conversationId", { length: 36 }).notNull(),
    role: mysqlEnum("messageRole", ["user", "assistant"]).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    conversationCreatedIndex: index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  }),
);

export const messageCitations = mysqlTable(
  "message_citations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    messageId: varchar("messageId", { length: 36 }).notNull(),
    documentId: varchar("documentId", { length: 36 }).notNull(),
    chunkId: varchar("chunkId", { length: 36 }).notNull(),
    documentName: varchar("documentName", { length: 255 }).notNull(),
    excerpt: text("excerpt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    messageIndex: index("citations_message_idx").on(table.messageId),
    documentIndex: index("citations_document_idx").on(table.documentId),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = typeof documentChunks.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export type MessageCitation = typeof messageCitations.$inferSelect;
export type InsertMessageCitation = typeof messageCitations.$inferInsert;
