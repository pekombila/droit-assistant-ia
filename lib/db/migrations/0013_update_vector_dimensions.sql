-- Update vector dimensions from 1536 (OpenAI) to 384 (multilingual-e5-small)
DROP INDEX IF EXISTS "LegalChunk_embedding_idx";--> statement-breakpoint
ALTER TABLE "LegalChunk" ALTER COLUMN "embedding" TYPE vector(384);--> statement-breakpoint
CREATE INDEX "LegalChunk_embedding_idx" ON "LegalChunk" USING hnsw ("embedding" vector_cosine_ops);
