/**
 * Nettoie le fichier OCR du Code Général des Impôts :
 * - Supprime les références d'images ![...](...)
 * - Supprime les en-têtes de page répétitifs
 * - Supprime les numéros de page isolés
 * - Compresse les lignes vides multiples
 * - Sauvegarde sous le nom canonique
 */
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dir, "../data/legal");

const inputFile  = resolve(dataDir, "code_general_impots_raw.md");
const outputFile = resolve(dataDir, "CODE-GENERAL-DES-IMPOTS-2022.md");

let content = readFileSync(inputFile, "utf-8");
const originalLength = content.length;

// 1. Supprime les références d'images markdown : ![...](...)
content = content.replace(/!\[.*?\]\(.*?\)\n?/g, "");

// 2. Supprime les en-têtes de page répétitifs (lignes exactes du pied/haut de page)
const pageHeaders = [
  /^Code général des impôts 2022\s*$/gim,
  /^CODE GÉNÉRAL DES IMPÔTS 2022\s*$/gim,
];
for (const pattern of pageHeaders) {
  content = content.replace(pattern, "");
}

// 3. Supprime les lignes contenant uniquement un numéro de page (1-4 chiffres)
content = content.replace(/^\s*\d{1,4}\s*$/gm, "");

// 4. Supprime les lignes vides multiples consécutives (> 2)
content = content.replace(/\n{3,}/g, "\n\n");

// 5. Nettoie les espaces en début/fin de fichier
content = content.trim() + "\n";

writeFileSync(outputFile, content, "utf-8");
console.log(`✅ Nettoyage terminé`);
console.log(`   Avant : ${originalLength} caractères`);
console.log(`   Après : ${content.length} caractères`);
console.log(`   Fichier : ${outputFile}`);

// Supprime le fichier brut
unlinkSync(inputFile);
console.log(`🗑️  Supprimé : ${inputFile}`);
