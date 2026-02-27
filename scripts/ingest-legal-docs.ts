import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { legalDocument, legalChunk } from "../lib/db/schema";
import { embedPassage } from "../lib/ai/embedding";
import { parseLegalMarkdown } from "./parse-legal-markdown";

function uuid(): string {
  return crypto.randomUUID();
}

const LEGAL_DOCS = [
  {
    file: "Loi_N_022_2021_du_19_11_2021_portant_Code_du_Travail_en_Republique_Gabonaise.md",
    title: "Code du Travail de la République Gabonaise",
    lawReference: "Loi n°022/2021 du 19 novembre 2021",
  },
  {
    file: "Loi_n_028_2016_portant_code_de_protection_sociale.md",
    title: "Code de la Protection Sociale",
    lawReference: "Loi n°028/2016",
  },
];

async function main() {
  const dbUrl = process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.error("POSTGRES_URL is required in .env or .env.local");
    process.exit(1);
  }

  const client = neon(dbUrl);
  const db = drizzle(client);
  const dataDir = resolve(__dirname, "../data/legal");

  for (const docDef of LEGAL_DOCS) {
    const filePath = resolve(dataDir, docDef.file);

    console.log(`\n--- ${docDef.title} ---`);

    if (!existsSync(filePath)) {
      console.warn(`  SKIP: fichier introuvable: ${filePath}`);
      continue;
    }

    console.log(`  Lecture: ${filePath}`);
    const markdown = readFileSync(filePath, "utf-8");
    const parsed = parseLegalMarkdown(
      markdown,
      docDef.title,
      docDef.lawReference
    );

    console.log(`  ${parsed.chunks.length} articles trouvés`);

    if (parsed.chunks.length === 0) {
      console.warn("  Aucun article détecté, vérifiez le format du fichier.");
      continue;
    }

    // Idempotent: delete existing data for this law reference
    const existing = await db
      .select()
      .from(legalDocument)
      .where(eq(legalDocument.lawReference, docDef.lawReference));

    if (existing.length > 0) {
      console.log(`  Suppression données existantes (id: ${existing[0].id})`);
      await db
        .delete(legalDocument)
        .where(eq(legalDocument.id, existing[0].id));
    }

    // Insert LegalDocument
    const docId = uuid();
    await db.insert(legalDocument).values({
      id: docId,
      title: docDef.title,
      lawReference: docDef.lawReference,
      sourceFile: docDef.file,
      metadata: { articleCount: parsed.chunks.length },
    });
    console.log(`  LegalDocument créé: ${docId}`);

    // Insert chunks with embeddings
    for (let i = 0; i < parsed.chunks.length; i++) {
      const chunk = parsed.chunks[i];
      const chunkId = uuid();

      process.stdout.write(
        `  [${i + 1}/${parsed.chunks.length}] Article ${chunk.articleNumber}...`
      );

      const embedding = await embedPassage(chunk.content);

      await db.insert(legalChunk).values({
        id: chunkId,
        documentId: docId,
        chunkIndex: i,
        articleNumber: chunk.articleNumber,
        content: chunk.content,
        embedding,
        tokens: Math.ceil(chunk.content.length / 4),
      });

      console.log(" OK");
    }

    console.log(
      `  ${parsed.chunks.length} chunks ingérés pour ${docDef.title}`
    );
  }

  console.log("\n=== Ingestion terminée ===");
}

main().catch((err) => {
  console.error("Erreur d'ingestion:", err);
  process.exit(1);
});
