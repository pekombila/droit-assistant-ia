-- P3: Enable pgvector and create RAG tables for legal knowledge base
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "LegalDocument" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"lawReference" varchar(100) NOT NULL,
	"sourceFile" text,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "LegalChunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"chunkIndex" integer NOT NULL,
	"articleNumber" varchar(20),
	"content" text NOT NULL,
	"embedding" vector(1536),
	"tokens" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "LegalChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "LegalChunk_embedding_idx" ON "LegalChunk" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "LegalChunk_documentId_idx" ON "LegalChunk" ("documentId");
