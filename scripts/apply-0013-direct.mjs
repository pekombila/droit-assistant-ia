/**
 * Applique directement le SQL de 0013 (sans passer par le migrator Drizzle),
 * puis marque toutes les migrations comme appliquées pour bloquer tout rejeu futur.
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
const journal = JSON.parse(readFileSync(join(migrationsDir, "meta/_journal.json"), "utf8"));

const sql = neon(process.env.POSTGRES_URL);

// 1. Vérifie le type actuel de LegalChunk.embedding
const typeRow = await sql`
  SELECT data_type, udt_name
  FROM information_schema.columns
  WHERE table_name = 'LegalChunk' AND column_name = 'embedding'
`;
if (typeRow.length === 0) {
  console.error("❌ Colonne LegalChunk.embedding introuvable !");
  process.exit(1);
}
console.log("Type actuel de embedding:", typeRow[0]);

// Vérifie les dimensions actuelles via pg_attribute
const dimRow = await sql`
  SELECT atttypmod FROM pg_attribute
  WHERE attrelid = '"LegalChunk"'::regclass AND attname = 'embedding'
`;
const currentDim = dimRow[0]?.atttypmod ?? "?";
console.log("Dimensions actuelles:", currentDim, "(384 = OK, 1536 = à migrer)");

// 2. Applique le SQL de 0013 si nécessaire
if (currentDim !== 384) {
  console.log("\n⏳ Application de la migration 0013...");
  try {
    await sql`DROP INDEX IF EXISTS "LegalChunk_embedding_idx"`;
    console.log("  ✅ Index supprimé");

    await sql`ALTER TABLE "LegalChunk" ALTER COLUMN "embedding" TYPE vector(384)`;
    console.log("  ✅ Colonne migrée vers vector(384)");

    await sql`CREATE INDEX "LegalChunk_embedding_idx" ON "LegalChunk" USING hnsw ("embedding" vector_cosine_ops)`;
    console.log("  ✅ Index HNSW recréé");
  } catch (e) {
    console.error("❌ Erreur lors de la migration 0013:", e.message);
    process.exit(1);
  }
} else {
  console.log("✅ embedding est déjà vector(384), 0013 déjà appliquée.");
}

// 3. Marque toutes les migrations dans drizzle.__drizzle_migrations
// La valeur max de folderMillis dans le journal est 0008 = 1768479010084
// On insère avec created_at = max + 1 pour que Drizzle ne rejoue rien
await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
await sql`
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash TEXT NOT NULL,
    created_at BIGINT
  )
`;
await sql`TRUNCATE drizzle.__drizzle_migrations`;

// Calcule le max des folderMillis
const maxWhen = Math.max(...journal.entries.map(e => e.when));
console.log("\nTimestamp max du journal:", maxWhen);

// Insère UN enregistrement avec created_at = maxWhen + 1
// Drizzle: applique si folderMillis > lastDbMigration.created_at → rien ne satisfera cette condition
const content0013 = readFileSync(join(migrationsDir, "0013_update_vector_dimensions.sql"), "utf8");
const hash0013 = createHash("sha256").update(content0013).digest("hex");

await sql`
  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  VALUES (${hash0013}, ${BigInt(maxWhen + 1)})
`;

console.log(`✅ __drizzle_migrations marqué avec created_at=${maxWhen + 1}`);
console.log("✅ Migration 0013 terminée. pnpm db:migrate ne jouera plus rien.");
