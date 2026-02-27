import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.POSTGRES_URL);

// Vérifie les migrations déjà appliquées
try {
  const rows = await sql`SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at`;
  if (rows.length === 0) {
    console.log("⚠️  Aucune migration enregistrée dans __drizzle_migrations");
  } else {
    console.log(`✅ ${rows.length} migrations enregistrées :`);
    rows.forEach((r, i) => console.log(`  ${i}: hash=${r.hash} at=${r.created_at}`));
  }
} catch (e) {
  if (e.message.includes("does not exist")) {
    console.log("❌ Table __drizzle_migrations inexistante → aucune migration appliquée via Drizzle");
  } else {
    console.error("Erreur:", e.message);
  }
}

// Vérifie les tables existantes
const tables = await sql`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename
`;
console.log("\nTables existantes en DB :");
tables.forEach(t => console.log(" -", t.tablename));
