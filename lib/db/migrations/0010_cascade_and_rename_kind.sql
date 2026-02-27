-- P2: Add ON DELETE CASCADE to all foreign keys

-- Chat → User
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_userId_fkey";--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;--> statement-breakpoint

-- Message_v2 → Chat
ALTER TABLE "Message_v2" DROP CONSTRAINT "Message_v2_chatId_fkey";--> statement-breakpoint
ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;--> statement-breakpoint

-- Document → User
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_fkey";--> statement-breakpoint
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;--> statement-breakpoint

-- Suggestion → User
ALTER TABLE "Suggestion" DROP CONSTRAINT "Suggestion_userId_fkey";--> statement-breakpoint
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;--> statement-breakpoint

-- Suggestion → Document (composite FK, missing in DB)
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_documentId_documentCreatedAt_fkey" FOREIGN KEY ("documentId", "documentCreatedAt") REFERENCES "Document"("id", "createdAt") ON DELETE CASCADE;--> statement-breakpoint

-- Vote_v2 → Chat, Message_v2 (missing in DB)
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message_v2"("id") ON DELETE CASCADE;--> statement-breakpoint

-- Stream → Chat (missing in DB)
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE;
