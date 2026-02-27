/**
 * Extrait le texte d'un PDF scanné via l'API OCR de Mistral
 * Usage: node scripts/ocr-pdf-mistral.mjs <chemin/vers/fichier.pdf> [nom-sortie.md]
 *
 * Le fichier markdown résultant est sauvegardé dans data/legal/
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, basename, dirname } from "path";
import { fileURLToPath } from "url";

config({ path: ".env.local" });

const __dir = dirname(fileURLToPath(import.meta.url));
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

if (!MISTRAL_API_KEY) {
  console.error("❌ MISTRAL_API_KEY manquante dans .env.local");
  process.exit(1);
}

const pdfArg = process.argv[2];
if (!pdfArg) {
  console.error("Usage: node scripts/ocr-pdf-mistral.mjs <chemin.pdf> [sortie.md]");
  process.exit(1);
}

const pdfPath = resolve(pdfArg);
const outputName = process.argv[3] ?? basename(pdfPath, ".pdf") + ".md";
const outputPath = resolve(__dir, "../data/legal", outputName);

console.log(`📄 PDF source : ${pdfPath}`);
console.log(`📝 Sortie     : ${outputPath}`);

// 1. Upload du PDF via l'API Files de Mistral
console.log("\n⏳ Upload du PDF vers Mistral Files API...");

const pdfBuffer = readFileSync(pdfPath);
const formData = new FormData();
formData.append("purpose", "ocr");
formData.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), basename(pdfPath));

const uploadRes = await fetch("https://api.mistral.ai/v1/files", {
  method: "POST",
  headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` },
  body: formData,
});

if (!uploadRes.ok) {
  const err = await uploadRes.text();
  console.error("❌ Erreur upload:", err);
  process.exit(1);
}

const uploadData = await uploadRes.json();
const fileId = uploadData.id;
console.log(`✅ Fichier uploadé : id=${fileId}`);

// 2. Récupération du signed URL pour le fichier
console.log("\n⏳ Récupération du signed URL...");
const signedRes = await fetch(`https://api.mistral.ai/v1/files/${fileId}/url?expiry=24`, {
  headers: {
    Authorization: `Bearer ${MISTRAL_API_KEY}`,
    Accept: "application/json",
  },
});

if (!signedRes.ok) {
  const err = await signedRes.text();
  console.error("❌ Erreur signed URL:", err);
  process.exit(1);
}

const { url: signedUrl } = await signedRes.json();
console.log("✅ Signed URL obtenu");

// 3. Appel OCR avec le signed URL
console.log("\n⏳ Extraction OCR en cours (peut prendre plusieurs minutes pour un long document)...");

const ocrRes = await fetch("https://api.mistral.ai/v1/ocr", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${MISTRAL_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mistral-ocr-latest",
    document: {
      type: "document_url",
      document_url: signedUrl,
    },
    include_image_base64: false,
  }),
});

if (!ocrRes.ok) {
  const err = await ocrRes.text();
  console.error("❌ Erreur OCR:", err);
  process.exit(1);
}

const ocrData = await ocrRes.json();
const pages = ocrData.pages ?? [];
console.log(`✅ OCR terminé : ${pages.length} pages extraites`);

// 4. Concatène toutes les pages en un seul markdown
const markdown = pages.map((p) => p.markdown ?? "").join("\n\n");

// 5. Sauvegarde
mkdirSync(resolve(__dir, "../data/legal"), { recursive: true });
writeFileSync(outputPath, markdown, "utf-8");

console.log(`\n✅ Fichier sauvegardé : ${outputPath}`);
console.log(`   ${pages.length} pages, ${markdown.length} caractères`);
console.log("\nProchaine étape : pnpm ingest:legal");

// 6. Nettoyage : supprime le fichier uploadé sur Mistral
await fetch(`https://api.mistral.ai/v1/files/${fileId}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` },
});
console.log("🗑️  Fichier supprimé de Mistral Files");
