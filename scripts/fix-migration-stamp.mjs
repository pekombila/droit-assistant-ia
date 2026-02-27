/**
 * Corrige le stamp drizzle.__drizzle_migrations.
 * Le created_at doit être > max(folderMillis) de tous les journaux
 * pour que Drizzle ne rejoue aucune migration.
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

// Max folderMillis parmi TOUTES les migrations
const maxWhen = Math.max(...journal.entries.map(e => e.when));
const stampValue = BigInt(maxWhen) + 1n;

console.log("Max folderMillis dans le journal :", maxWhen);
console.log("Stamp cible                      :", stampValue.toString());

// Hash de la dernière migration (0014)
const lastEntry = journal.entries[journal.entries.length - 1];
const content = readFileSync(join(migrationsDir, `${lastEntry.tag}.sql`), "utf8");
const hash = createHash("sha256").update(content).digest("hex");

await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
await sql`
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash TEXT NOT NULL,
    created_at BIGINT
  )
`;
await sql`TRUNCATE drizzle.__drizzle_migrations`;
await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${stampValue})`;

console.log(`✅ Stamp mis à jour : created_at = ${stampValue}`);
console.log("   Toutes les migrations seront considérées comme appliquées.");
