/**
 * Ingère uniquement le Code Général des Impôts (CGI 2022).
 * Reprend depuis le début (supprime les données CGI existantes si partielle).
 */
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

const CGI_DOC = {
  file: "CODE-GENERAL-DES-IMPOTS-2022.md",
  title: "Code Général des Impôts du Gabon",
  lawReference: "Loi n°027/2008 du 22 janvier 2009 (mise à jour 2022)",
};

async function main() {
  const dbUrl = process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.error("POSTGRES_URL is required in .env or .env.local");
    process.exit(1);
  }

  const client = neon(dbUrl);
  const db = drizzle(client);
  const dataDir = resolve(__dirname, "../data/legal");
  const filePath = resolve(dataDir, CGI_DOC.file);

  console.log(`\n--- ${CGI_DOC.title} ---`);

  if (!existsSync(filePath)) {
    console.error(`Fichier introuvable: ${filePath}`);
    process.exit(1);
  }

  console.log(`  Lecture: ${filePath}`);
  const markdown = readFileSync(filePath, "utf-8");
  const parsed = parseLegalMarkdown(markdown, CGI_DOC.title, CGI_DOC.lawReference);

  console.log(`  ${parsed.chunks.length} articles trouvés`);

  // Supprime les données existantes (idempotent)
  const existing = await db
    .select()
    .from(legalDocument)
    .where(eq(legalDocument.lawReference, CGI_DOC.lawReference));

  if (existing.length > 0) {
    console.log(`  Suppression données existantes (id: ${existing[0].id})`);
    await db.delete(legalDocument).where(eq(legalDocument.id, existing[0].id));
  }

  // Insert LegalDocument
  const docId = uuid();
  await db.insert(legalDocument).values({
    id: docId,
    title: CGI_DOC.title,
    lawReference: CGI_DOC.lawReference,
    sourceFile: CGI_DOC.file,
    metadata: { articleCount: parsed.chunks.length },
  });
  console.log(`  LegalDocument créé: ${docId}`);

  // Insert chunks with embeddings
  let errors = 0;
  for (let i = 0; i < parsed.chunks.length; i++) {
    const chunk = parsed.chunks[i];
    const chunkId = uuid();

    process.stdout.write(
      `  [${i + 1}/${parsed.chunks.length}] Article ${chunk.articleNumber}...`
    );

    try {
      const embedding = await embedPassage(chunk.content);

      await new Promise((r) => setTimeout(r, 200));

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
    } catch (err) {
      errors++;
      console.log(` ERREUR: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n  ${parsed.chunks.length - errors} chunks ingérés, ${errors} erreurs`);
  console.log("\n=== Ingestion CGI terminée ===");
}

main().catch((err) => {
  console.error("Erreur d'ingestion:", err);
  process.exit(1);
});
