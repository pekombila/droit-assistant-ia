-- Switch from multilingual-e5-small (384 dims) to mistral-embed (1024 dims)
DROP INDEX IF EXISTS "LegalChunk_embedding_idx";--> statement-breakpoint
ALTER TABLE "LegalChunk" ALTER COLUMN "embedding" TYPE vector(1024);--> statement-breakpoint
CREATE INDEX "LegalChunk_embedding_idx" ON "LegalChunk" USING hnsw ("embedding" vector_cosine_ops);
