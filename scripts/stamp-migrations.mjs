/**
 * Marque la migration 0012 comme la dernière appliquée dans drizzle.__drizzle_migrations.
 * Drizzle ne jouera ensuite que les migrations dont folderMillis > created_at du dernier enregistrement.
 * 0012 a folderMillis=1740412800000, 0013 a 1740499200000 → seule 0013 sera exécutée.
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

// Hash de 0012 (utilisé par Drizzle)
const content0012 = readFileSync(join(migrationsDir, "0012_pgvector_legal_rag.sql"), "utf8");
const hash0012 = createHash("sha256").update(content0012).digest("hex");

const sql = neon(process.env.POSTGRES_URL);

// Drizzle utilise le schéma "drizzle", pas "public"
await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
await sql`
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash TEXT NOT NULL,
    created_at BIGINT
  )
`;
console.log("✅ Schema drizzle + table prêts");

// Vide la table pour repartir propre
await sql`TRUNCATE drizzle.__drizzle_migrations`;

// Insère UN enregistrement avec created_at = timestamp de 0012
// Drizzle sautera toutes les migrations dont folderMillis <= cette valeur
const folderMillis0012 = 1740412800000n;
await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash0012}, ${folderMillis0012})`;

console.log("✅ Migration 0012 marquée comme dernière appliquée (created_at=1740412800000)");
console.log("➡️  Lance maintenant : pnpm db:migrate");
console.log("   Seule la migration 0013 (vector 384 dims) sera exécutée.");
