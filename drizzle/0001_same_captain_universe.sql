CREATE TABLE `conversations` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`documentId` varchar(36),
	`title` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_chunks` (
	`id` varchar(36) NOT NULL,
	`documentId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`chunkIndex` int NOT NULL,
	`content` text NOT NULL,
	`searchText` text NOT NULL,
	`wordCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_chunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`fileType` enum('pdf','txt') NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`fileSize` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(768) NOT NULL,
	`status` enum('processing','ready','failed') NOT NULL DEFAULT 'processing',
	`chunkCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `message_citations` (
	`id` varchar(36) NOT NULL,
	`messageId` varchar(36) NOT NULL,
	`documentId` varchar(36) NOT NULL,
	`chunkId` varchar(36) NOT NULL,
	`documentName` varchar(255) NOT NULL,
	`excerpt` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_citations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` varchar(36) NOT NULL,
	`conversationId` varchar(36) NOT NULL,
	`messageRole` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `conversations_user_updated_idx` ON `conversations` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `chunks_document_order_idx` ON `document_chunks` (`documentId`,`chunkIndex`);--> statement-breakpoint
CREATE INDEX `chunks_user_idx` ON `document_chunks` (`userId`);--> statement-breakpoint
CREATE INDEX `documents_user_created_idx` ON `documents` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `citations_message_idx` ON `message_citations` (`messageId`);--> statement-breakpoint
CREATE INDEX `citations_document_idx` ON `message_citations` (`documentId`);--> statement-breakpoint
CREATE INDEX `messages_conversation_created_idx` ON `messages` (`conversationId`,`createdAt`);