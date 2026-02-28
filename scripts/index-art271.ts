/**
 * Indexe l'Art.271 du CGI qui avait échoué (38384 chars > limite 8192 tokens).
 * Stratégie : divise le chunk en 4 sous-parties de ~12000 chars chacune,
 * suffisamment petites pour passer sous la limite Mistral embed.
 *
 * Chaque sous-partie est stockée avec articleNumber = "271-1", "271-2", etc.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import { legalDocument, legalChunk } from "../lib/db/schema";
import { embedPassage } from "../lib/ai/embedding";

function uuid(): string {
  return crypto.randomUUID();
}

const CGI_LAW_REF = "Loi n°027/2008 du 22 janvier 2009 (mise à jour 2022)";
const PART_SIZE = 12000; // ~6300 tokens @ 1.9 chars/token

async function main() {
  const dbUrl = process.env.POSTGRES_URL;
  if (!dbUrl) { console.error("POSTGRES_URL manquante"); process.exit(1); }

  const client = neon(dbUrl);
  const db = drizzle(client);

  // 1. Récupérer le LegalDocument du CGI
  const [doc] = await db
    .select()
    .from(legalDocument)
    .where(eq(legalDocument.lawReference, CGI_LAW_REF));

  if (!doc) {
    console.error("CGI non trouvé en base. Lance d'abord pnpm ingest:legal");
    process.exit(1);
  }
  console.log(`Document CGI trouvé: ${doc.id}`);

  // 2. Extraire le contenu brut de l'Art.271 depuis le fichier source
  const filePath = resolve(__dirname, "../data/legal/CODE-GENERAL-DES-IMPOTS-2022.md");
  const lines = readFileSync(filePath, "utf-8").split("\n");

  let start = -1, end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("Art.271.")) start = i;
    if (start !== -1 && i > start && lines[i].match(/^Art\.\d/)) { end = i; break; }
  }
  if (start === -1) { console.error("Art.271 introuvable dans le fichier"); process.exit(1); }
  if (end === -1) end = lines.length;

  const fullContent = lines.slice(start, end).join("\n");
  console.log(`\nArt.271 extrait: ${fullContent.length} chars (lignes ${start+1}–${end})`);

  // 3. Supprimer les éventuels sous-chunks 271-x déjà existants
  const existing = await db
    .select({ id: legalChunk.id })
    .from(legalChunk)
    .where(
      and(
        eq(legalChunk.documentId, doc.id),
        eq(legalChunk.articleNumber, "271-1")
      )
    );
  if (existing.length > 0) {
    console.log("Suppression des sous-chunks existants 271-x...");
    for (const articleNum of ["271-1", "271-2", "271-3", "271-4"]) {
      await db.delete(legalChunk).where(
        and(eq(legalChunk.documentId, doc.id), eq(legalChunk.articleNumber, articleNum))
      );
    }
  }

  // 4. Découper et indexer chaque partie
  const nbParts = Math.ceil(fullContent.length / PART_SIZE);
  console.log(`\nDécoupage en ${nbParts} parties de ~${PART_SIZE} chars :`);

  for (let i = 0; i < nbParts; i++) {
    const partContent = fullContent.slice(i * PART_SIZE, (i + 1) * PART_SIZE);
    const articleNumber = `271-${i + 1}`;

    process.stdout.write(`  [${i + 1}/${nbParts}] Art.${articleNumber} (${partContent.length} chars)...`);

    const embedding = await embedPassage(partContent);
    await new Promise((r) => setTimeout(r, 200));

    await db.insert(legalChunk).values({
      id: uuid(),
      documentId: doc.id,
      chunkIndex: 9000 + i, // index hors plage normale pour éviter les conflits
      articleNumber,
      content: partContent,
      embedding,
      tokens: Math.ceil(partContent.length / 1.9),
    });

    console.log(" OK");
  }

  console.log(`\n✅ Art.271 indexé en ${nbParts} sous-chunks (271-1 à 271-${nbParts})`);
}

main().catch((err) => {
  console.error("Erreur:", err);
  process.exit(1);
});
