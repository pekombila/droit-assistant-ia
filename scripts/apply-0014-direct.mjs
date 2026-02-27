/**
 * Applique la migration 0014 : vector(384) → vector(1024) pour mistral-embed
 * et met à jour drizzle.__drizzle_migrations
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

config({ path: ".env.local" });

const __dir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dir, "../lib/db/migrations");

const sql = neon(process.env.POSTGRES_URL);

// Vérification du type actuel
const dimRow = await sql`
  SELECT atttypmod FROM pg_attribute
  WHERE attrelid = '"LegalChunk"'::regclass AND attname = 'embedding'
`;
const currentDim = dimRow[0]?.atttypmod ?? "?";
console.log("Dimensions actuelles:", currentDim, "(1024 = déjà migré)");

if (currentDim === 1024) {
  console.log("✅ Déjà en vector(1024), rien à faire.");
} else {
  console.log("⏳ Migration vector → 1024 dims...");

  // Vide les chunks existants (embeddings 384-dims incompatibles)
  await sql`DELETE FROM "LegalChunk"`;
  console.log("  ✅ Chunks existants supprimés");

  await sql`DROP INDEX IF EXISTS "LegalChunk_embedding_idx"`;
  console.log("  ✅ Index supprimé");

  await sql`ALTER TABLE "LegalChunk" ALTER COLUMN "embedding" TYPE vector(1024)`;
  console.log("  ✅ Colonne migrée vers vector(1024)");

  await sql`CREATE INDEX "LegalChunk_embedding_idx" ON "LegalChunk" USING hnsw ("embedding" vector_cosine_ops)`;
  console.log("  ✅ Index HNSW recréé");
}

// Met à jour drizzle.__drizzle_migrations avec 0014
const content0014 = readFileSync(join(migrationsDir, "0014_vector_1024_mistral_embed.sql"), "utf8");
const hash0014 = createHash("sha256").update(content0014).digest("hex");

await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
await sql`
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash TEXT NOT NULL,
    created_at BIGINT
  )
`;
await sql`TRUNCATE drizzle.__drizzle_migrations`;

// created_at = timestamp 0014 + 1 (max de tous les journaux)
await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash0014}, ${1740585600001n})`;
console.log("✅ drizzle.__drizzle_migrations mis à jour (0014 marquée)");
console.log("\nProchaine étape : pnpm ingest:legal");
