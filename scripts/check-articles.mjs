import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.POSTGRES_URL);

// Vérifie le contenu des articles 193-202 stockés en DB
const rows = await sql`
  SELECT c."articleNumber", LEFT(c."content", 200) as excerpt
  FROM "LegalChunk" c
  JOIN "LegalDocument" d ON c."documentId" = d.id
  WHERE d."lawReference" = 'Loi n°022/2021 du 19 novembre 2021'
    AND c."articleNumber" IN ('193','194','195','196','197','198','199','200','201','202')
  ORDER BY c."chunkIndex"
`;

if (rows.length === 0) {
  console.log("Aucun article trouvé dans cette plage.");
} else {
  // Affiche les clés réelles du premier résultat
  console.log("Clés disponibles:", Object.keys(rows[0]));

  for (const row of rows) {
    const num = row.articleNumber ?? row.articlenumber ?? row["articleNumber"] ?? "(null)";
    console.log(`\n--- Article ${num} ---`);
    console.log(row.excerpt ?? row["excerpt"]);
  }
}
